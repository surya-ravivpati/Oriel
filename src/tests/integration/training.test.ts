import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { newId } from "@/lib/id";
import { HttpError } from "@/lib/api/errors";
import { setProvidersForTesting } from "@/lib/ai/providers/registry";
import type { LanguageModelProvider } from "@/lib/ai/providers/types";
import { competency } from "@/lib/training/competencies";
import { deleteLoop, dueReviews, learningState, loopView, startPractice, startReview, submitAttempt } from "@/server/training/service";

/*
 * The practice loop end to end against the real database, with a scripted evaluator: each call
 * returns the next judgment in the script, quoting the answer it was given.
 */

const c = competency("decision_reasoning");
let script: ("weak" | "fixed" | "malformed" | "throw")[] = [];
const scripted: LanguageModelProvider = {
  id: "scripted", isMock: false,
  async generateText() { throw new Error("unused"); },
  async generateJson<T>(req: { prompt: string }) {
    const step = script.shift() ?? "fixed";
    if (step === "throw") throw new Error("timeout");
    if (step === "malformed") return { data: { nope: true } as T, usage: { model: "x", inputTokens: 1, outputTokens: 1 }, latencyMs: 1 };
    const answer = req.prompt.split('"""\n')[1]?.split("\n\"\"\"")[0] ?? "";
    const quote = answer.split(/(?<=\.)\s/)[0].replace(/\.$/, "");
    const lvl = step === "fixed" ? "shown" : "not_shown";
    return {
      data: {
        criteria: c.criteria.map((x) => ({ id: x.id, level: x.id === "criteria" ? lvl : "shown", evidence: x.id === "criteria" && lvl === "not_shown" ? null : quote, interpretation: "" })),
        enoughEvidence: true, confidence: "medium",
        primaryWeakness: step === "weak" ? { criterionId: "criteria", observation: "You said what you chose but not how you chose it.", whyItMatters: "Judgment shows in how you weigh things.", instruction: "Say what mattered most and how each option scored on it." } : null,
        secondary: [], limitations: null,
      } as T,
      usage: { model: "x", inputTokens: 1, outputTokens: 1 }, latencyMs: 1,
    };
  },
};

function makeUser() {
  const db = getDb();
  const id = newId("usr");
  db.insert(schema.users).values({ id, email: `${id}@oriel.test`, passwordHash: "x", onboardedAt: new Date() }).run();
  db.insert(schema.profiles).values({ userId: id, name: "Sam Rivera", targetRole: "Product Manager", domain: "product" }).run();
  return id;
}

const A = (s: string) => `${s} We had two options and I weighed them carefully with the team before we committed to one of them in the end.`;
let k = 0;
const submit = (u: string, loop: string, text: string, clientKey = `key-${++k}-xxxx`) => submitAttempt(u, loop, { response: A(text), inputMode: "text", durationMs: 30000, clientKey });

describe("the practice loop", () => {
  let user: string;
  let other: string;
  let loop: string;

  beforeAll(() => {
    setProvidersForTesting({ llm: scripted });
    user = makeUser();
    other = makeUser();
  });

  it("runs attempt → diagnosis → retry → transfer → summary, and schedules a review", async () => {
    loop = startPractice(user, { category: "behavioral", competencyId: "decision_reasoning" });
    const first = loopView(user, loop);
    expect(first.stage).toBe("attempt");
    expect(first.attempts).toEqual([]);
    const original = first.question.text;

    script = ["weak"];
    const v1 = await submit(user, loop, "I decided to ship the smaller rollout.");
    expect(v1.stage).toBe("retry");
    expect(v1.question.text).toBe(original);               // the retry is the same question
    expect(v1.target?.id).toBe("criteria");
    expect(v1.attempts[0].evaluation?.primary?.instruction).toMatch(/what mattered most/);

    script = ["fixed"];
    const v2 = await submit(user, loop, "Recovery time mattered most, so I chose the rollout over delaying.");
    expect(v2.stage).toBe("transfer");
    expect(v2.question.text).not.toBe(original);           // a different question for the transfer
    expect(v2.question.source).toBe("curated");

    script = ["weak"];
    const v3 = await submit(user, loop, "I would ship the bug fix first since the others can wait a week.");
    expect(v3.stage).toBe("done");
    expect(v3.outcome).toEqual({ improvedOnRetry: "yes", transferred: "no", retained: "not_assessed" });
    expect(v3.nextReview).not.toBeNull();

    // A transfer that didn't carry over is not counted as transfer in the learning state.
    const s = learningState(user).find((x) => x.competencyId === "decision_reasoning")!;
    expect(s.assessed).toBe(true);
    expect(s.improvedOnRetry.outcome).toBe("yes");
    expect(s.transferred.outcome).toBe("no");
    expect(s.retained.outcome).toBe("not_assessed");
    // Other skills are "not assessed", not weak.
    expect(learningState(user).find((x) => x.competencyId === "structuring")!.assessed).toBe(false);
  });

  it("keeps the rubric version and the criteria as judged on every evaluation", () => {
    const rows = getDb().select().from(schema.trainingEvaluations).where(eq(schema.trainingEvaluations.userId, user)).all();
    expect(rows.length).toBe(3);
    for (const r of rows) {
      expect(r.rubricVersion).toBe(c.version);
      expect(r.criteria.map((x) => x.label)).toEqual(c.criteria.map((x) => x.label));
    }
  });

  it("surfaces the review when it falls due, with yet another question, as its own outcome", async () => {
    expect(dueReviews(user)).toEqual([]);
    const later = new Date(Date.now() + 2 * 86_400_000);
    const due = dueReviews(user, later);
    expect(due).toHaveLength(1);
    const review = startReview(user, due[0].id);
    expect(startReview(user, due[0].id)).toBe(review); // starting twice resumes
    const used = getDb().select({ q: schema.trainingAttempts.questionText }).from(schema.trainingAttempts).where(eq(schema.trainingAttempts.userId, user)).all().map((r) => r.q);
    const rv = loopView(user, review);
    expect(rv.kind).toBe("review");
    expect(used).not.toContain(rv.question.text);
    script = ["fixed"];
    const done = await submit(user, review, "What mattered most was speed of recovery, so I picked the rollout.");
    expect(done.outcome).toEqual({ improvedOnRetry: "not_assessed", transferred: "not_assessed", retained: "yes" });
    const s = learningState(user).find((x) => x.competencyId === "decision_reasoning")!;
    expect(s.retained.outcome).toBe("yes");
    expect(s.transferred.outcome).toBe("no"); // the earlier transfer result is not rewritten
  });

  it("never shows one person's practice to another", async () => {
    const tryIt = async (f: () => unknown) => { try { await f(); return null; } catch (e) { return e; } };
    for (const f of [() => loopView(other, loop), () => submit(other, loop, "Mine now."), () => deleteLoop(other, loop)]) {
      const e = await tryIt(f);
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).status).toBe(404);
    }
    const r = dueReviews(user, new Date(Date.now() + 30 * 86_400_000))[0];
    expect(await tryIt(() => startReview(other, r.id))).toBeInstanceOf(HttpError);
  });

  it("a resent submission does not create a second attempt or evaluation", async () => {
    const l = startPractice(user, { category: "behavioral", competencyId: "decision_reasoning" });
    script = ["weak"];
    const a = await submit(user, l, "I went with the rollout.", "same-key-1234");
    const b = await submit(user, l, "I went with the rollout.", "same-key-1234");
    expect(b.attempts).toHaveLength(1);
    expect(a.attempts[0].id).toBe(b.attempts[0].id);
    expect(getDb().select().from(schema.trainingEvaluations).where(eq(schema.trainingEvaluations.attemptId, a.attempts[0].id)).all()).toHaveLength(1);
  });

  it("a failing or malformed evaluator doesn't corrupt the loop: the pattern evaluator stands in, labelled", async () => {
    const l = startPractice(user, { category: "case", competencyId: "structuring" });
    script = ["throw"];
    const v = await submit(user, l, "I would look at three things: revenue, costs and competition. I'd start with costs because revenue has been flat.");
    expect(v.attempts).toHaveLength(1);
    expect(v.attempts[0].evaluation?.evaluator).toBe("pattern");
    expect(["retry", "transfer"]).toContain(v.stage);
    script = ["malformed", "malformed"];
    const l2 = startPractice(user, { category: "case", competencyId: "structuring" });
    const v2 = await submit(user, l2, "There are a few ways to think about this business problem and I would probably start somewhere sensible.");
    expect(v2.attempts[0].evaluation?.evaluator).toBe("pattern");
  });

  it("an answer too short to judge is asked for again and never counted against the skill", async () => {
    const fresh = makeUser();
    const l = startPractice(fresh, { category: "technical", competencyId: "tradeoff_reasoning" });
    const v = await submitAttempt(fresh, l, { response: "Use a cache.", inputMode: "text", durationMs: 4000, clientKey: "short-answer-1" });
    expect(v.stage).toBe("attempt");
    expect(v.step?.kind).toBe("reassess");
    expect(learningState(fresh).find((x) => x.competencyId === "tradeoff_reasoning")!.assessed).toBe(false);
  });

  it("deleting a practice removes its answers, evaluations and scheduled review", async () => {
    deleteLoop(user, loop);
    expect(getDb().select().from(schema.trainingAttempts).where(eq(schema.trainingAttempts.loopId, loop)).all()).toHaveLength(0);
    expect(getDb().select().from(schema.trainingReviews).where(eq(schema.trainingReviews.sourceLoopId, loop)).all()).toHaveLength(0);
  });
});
