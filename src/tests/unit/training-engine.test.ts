import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { COMPETENCIES, competency, competenciesFor, CATEGORIES } from "@/lib/training/competencies";
import { EXERCISES, poolFor } from "@/lib/training/questions";
import { advance, chooseCompetency, chooseTarget, demonstrated, nextReviewAt, outcomeOf, pickExercise, type AttemptRecord, type CompetencyHistory, type Evaluation, type LoopState } from "@/lib/training/engine";

const c = competency("decision_reasoning");
const ids = c.criteria.map((x) => x.id); // alternatives, criteria, uncertainty, justified

function ev(levels: (0 | 1 | 2 | null)[], over: Partial<Evaluation> = {}): Evaluation {
  return {
    competencyId: c.id, rubricVersion: c.version, evaluator: "model", enoughEvidence: true, confidence: "medium", primary: null, secondary: [], limitations: null, insufficientReason: null,
    criteria: ids.map((id, i) => ({ id, label: id, level: levels[i] ?? null, evidence: null, interpretation: "" })), ...over,
  };
}
const insufficient = (): Evaluation => ev([null, null, null, null], { enoughEvidence: false, insufficientReason: "too short" });
const start: LoopState = { kind: "practice", stage: "attempt", targetCriterion: null, scaffold: 0, retries: 0, insufficientStreak: 0 };
const at = (stage: AttemptRecord["stage"], e: Evaluation | null): AttemptRecord => ({ stage, createdAt: new Date(), evaluation: e });

describe("the bank", () => {
  it("has at least five curated questions in distinct situations for every skill in every type it covers", () => {
    for (const cat of CATEGORIES) for (const comp of competenciesFor(cat.id)) {
      const pool = poolFor(comp.id, cat.id);
      expect(new Set(pool.map((q) => q.situation)).size, `${comp.id} in ${cat.id}`).toBeGreaterThanOrEqual(5);
    }
  });
  it("only references real competencies, and every curated question is validated", () => {
    const known = new Set(COMPETENCIES.map((x) => x.id));
    for (const q of EXERCISES) {
      expect(q.validated && q.source === "curated").toBe(true);
      for (const id of q.competencies) expect(known.has(id)).toBe(true);
    }
  });
});

describe("the loop", () => {
  it("targets the weakest criterion, and validates the evaluator's proposal", () => {
    expect(chooseTarget(c, ev([2, 0, 1, 2]))).toBe("criteria");
    // A proposal for a criterion that is already shown is ignored.
    expect(chooseTarget(c, ev([2, 0, 1, 2], { primary: { criterionId: "alternatives", observation: "", whyItMatters: "", instruction: "" } }))).toBe("criteria");
    expect(chooseTarget(c, ev([2, 1, 0, 2], { primary: { criterionId: "made_up", observation: "", whyItMatters: "", instruction: "" } }))).toBe("uncertainty");
    expect(chooseTarget(c, ev([2, 2, 2, 2]))).toBeNull();
  });

  it("an improved retry moves on to transfer; it does not end the loop as mastery", () => {
    const a = advance(c, start, ev([2, 0, 2, 2]));
    expect(a.step).toEqual({ kind: "retry", target: "criteria", scaffold: 0 });
    const b = advance(c, a.state, ev([2, 2, 2, 2]));
    expect(b.state.stage).toBe("transfer");
    expect(b.step).toMatchObject({ kind: "transfer", target: "criteria", skipped: null });
  });

  it("adds scaffolding on a missed retry and stops repeating after two retries", () => {
    let s = advance(c, start, ev([2, 0, 2, 2])).state;
    const r1 = advance(c, s, ev([2, 0, 2, 2]));
    expect(r1.step).toEqual({ kind: "retry", target: "criteria", scaffold: 1 });
    s = r1.state;
    const r2 = advance(c, s, ev([2, 1, 2, 2]));
    expect(r2.state.stage).toBe("transfer");
    expect(r2.step).toMatchObject({ skipped: "retries" });
  });

  it("skips the retry when everything is already shown, but still tests transfer", () => {
    const a = advance(c, start, ev([2, 2, 2, 2]));
    expect(a.state.stage).toBe("transfer");
    expect(a.step).toMatchObject({ kind: "transfer", skipped: "shown" });
  });

  it("an unassessable answer asks for another, and is not treated as a failure", () => {
    const a = advance(c, start, insufficient());
    expect(a.step.kind).toBe("reassess");
    expect(a.state.stage).toBe("attempt");
    expect(a.state.targetCriterion).toBeNull();
    expect(demonstrated(insufficient())).toBeNull();
  });
});

describe("outcomes", () => {
  it("a failed transfer is not counted as transfer, even after an improved retry", () => {
    const o = outcomeOf("practice", "criteria", [at("initial", ev([2, 0, 2, 2])), at("retry", ev([2, 2, 2, 2])), at("transfer", ev([2, 1, 2, 2]))]);
    expect(o).toEqual({ improvedOnRetry: "yes", transferred: "no", retained: "not_assessed" });
  });
  it("a missing assessment is 'not assessed', never 'no'", () => {
    const o = outcomeOf("practice", "criteria", [at("initial", ev([2, 0, 2, 2])), at("retry", null), at("transfer", insufficient())]);
    expect(o).toEqual({ improvedOnRetry: "not_assessed", transferred: "not_assessed", retained: "not_assessed" });
  });
  it("a delayed review is its own outcome, separate from the immediate retry", () => {
    const practice = outcomeOf("practice", "criteria", [at("initial", ev([2, 0, 2, 2])), at("retry", ev([2, 2, 2, 2])), at("transfer", ev([2, 2, 2, 2]))]);
    const review = outcomeOf("review", "criteria", [at("review", ev([2, 0, 2, 2]))]);
    expect(practice).toMatchObject({ improvedOnRetry: "yes", transferred: "yes", retained: "not_assessed" });
    expect(review).toEqual({ improvedOnRetry: "not_assessed", transferred: "not_assessed", retained: "no" });
  });
  it("spaces reviews by what happened", () => {
    const now = new Date("2026-10-10T12:00:00Z");
    const d = (x: Date) => Math.round((x.getTime() - now.getTime()) / 86_400_000);
    expect(d(nextReviewAt("practice", { improvedOnRetry: "yes", transferred: "yes", retained: "not_assessed" }, now))).toBe(3);
    expect(d(nextReviewAt("practice", { improvedOnRetry: "yes", transferred: "no", retained: "not_assessed" }, now))).toBe(1);
    expect(d(nextReviewAt("review", { improvedOnRetry: "not_assessed", transferred: "not_assessed", retained: "yes" }, now))).toBe(14);
  });
});

describe("choosing", () => {
  it("prefers skills not yet assessed, then those that didn't carry over", () => {
    const first = chooseCompetency("behavioral", []);
    expect(competenciesFor("behavioral").map((x) => x.id)).toContain(first);
    const all: CompetencyHistory[] = competenciesFor("behavioral").map((x) => ({ competencyId: x.id, lastPracticedAt: new Date(), assessed: true, transferred: "yes", retained: "yes" }));
    all[2] = { ...all[2], transferred: "no" };
    expect(chooseCompetency("behavioral", all)).toBe(all[2].competencyId);
  });
  it("a transfer question is never the same question or situation", () => {
    const pool = poolFor("decision_reasoning", "behavioral");
    const first = pool[0];
    const t = pickExercise("decision_reasoning", "behavioral", new Set([first.id]), new Set([first.situation]), 1)!;
    expect(t.id).not.toBe(first.id);
    expect(t.situation).not.toBe(first.situation);
  });
});

describe("history", () => {
  it("the training migration only adds tables; it never alters or drops existing ones", () => {
    const sql = fs.readFileSync(path.join(process.cwd(), "drizzle", "0004_training.sql"), "utf8");
    const statements = sql.split("--> statement-breakpoint").map((x) => x.trim()).filter(Boolean);
    for (const st of statements) expect(st).toMatch(/^CREATE (?:UNIQUE )?(?:TABLE|INDEX) `training_/);
    expect(sql.match(/CREATE TABLE/g)?.length).toBe(4);
  });
});
