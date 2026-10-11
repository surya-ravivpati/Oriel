import { describe, expect, it } from "vitest";
import type { LanguageModelProvider } from "@/lib/ai/providers/types";
import { competency } from "@/lib/training/competencies";
import { evaluate, groundModelOutput, patternEvaluate, precheck, quotedFrom } from "@/lib/training/evaluate";
import { acceptGenerated, similarity } from "@/lib/training/generate";

const c = competency("decision_reasoning");
const ANSWER = "We had to choose between delaying the launch or shipping to ten percent of users. I chose the partial rollout because recovery time mattered more than speed. We didn't know how churn would react, so I set a two-week checkpoint. It worked: churn stayed flat.";
const input = { competency: c, question: "Tell me about a decision you made without all the information.", expected: "Options, criteria, uncertainty.", answer: ANSWER, inputMode: "text" as const, target: null };

const llm = (respond: () => unknown, calls?: { n: number }): LanguageModelProvider => ({
  id: "fake", isMock: false,
  async generateText() { throw new Error("unused"); },
  async generateJson<T>() { if (calls) calls.n++; return { data: respond() as T, usage: { model: "fake", inputTokens: 1, outputTokens: 1 }, latencyMs: 1 }; },
});

const good = () => ({
  criteria: [
    { id: "alternatives", level: "shown", evidence: "delaying the launch or shipping to ten percent of users", interpretation: "Two options." },
    { id: "criteria", level: "shown", evidence: "recovery time mattered more than speed", interpretation: "Explicit basis." },
    { id: "uncertainty", level: "shown", evidence: "We didn't know how churn would react", interpretation: "Named." },
    { id: "justified", level: "partly", evidence: null, interpretation: "Comparison implied." },
  ],
  enoughEvidence: true, confidence: "high",
  primaryWeakness: { criterionId: "justified", observation: "You chose the rollout but didn't say why it beat delaying.", whyItMatters: "The comparison is the evidence.", instruction: "Compare your choice against the strongest alternative." },
  secondary: [], limitations: null,
});

describe("grounding", () => {
  it("accepts only excerpts that appear in the answer", () => {
    expect(quotedFrom("recovery time mattered more than speed", ANSWER)).toBe(true);
    expect(quotedFrom("Recovery time  mattered, more than speed.", ANSWER)).toBe(true);
    expect(quotedFrom("we grew revenue by 40%", ANSWER)).toBe(false);
    expect(quotedFrom("I", ANSWER)).toBe(false);
  });

  it("drops invented quotes, and a 'shown' without a real quote becomes 'can't tell'", () => {
    const out = good();
    out.criteria[0].evidence = "we interviewed forty customers first"; // not in the answer
    const e = groundModelOutput(c, ANSWER, out as never);
    const alt = e.criteria.find((x) => x.id === "alternatives")!;
    expect(alt.evidence).toBeNull();
    expect(alt.level).toBeNull();
    expect(e.confidence).toBe("low");
    expect(e.limitations).toMatch(/didn't match the answer/);
  });

  it("drops unknown criteria, treats missing ones as 'can't tell', and rejects duplicates", () => {
    const out = good();
    out.criteria = [out.criteria[0], { id: "charisma", level: "shown", evidence: null, interpretation: "" }];
    const e = groundModelOutput(c, ANSWER, out as never);
    expect(e.criteria.map((x) => x.id)).toEqual(c.criteria.map((x) => x.id));
    expect(e.criteria.find((x) => x.id === "criteria")!.level).toBeNull();
    const dup = good();
    dup.criteria.push({ ...dup.criteria[0] });
    expect(() => groundModelOutput(c, ANSWER, dup as never)).toThrow(/duplicate/);
  });

  it("ignores a primary weakness that names a criterion already shown", () => {
    const out = good();
    out.primaryWeakness!.criterionId = "criteria";
    expect(groundModelOutput(c, ANSWER, out as never).primary).toBeNull();
  });
});

describe("evaluate", () => {
  it("returns a grounded model evaluation", async () => {
    const r = await evaluate(llm(good), input);
    expect(r.evaluation.evaluator).toBe("model");
    expect(r.evaluation.rubricVersion).toBe(c.version);
    expect(r.evaluation.primary?.criterionId).toBe("justified");
  });

  it("rejects malformed output safely: one retry, then the labelled pattern evaluator", async () => {
    const calls = { n: 0 };
    const r = await evaluate(llm(() => ({ criteria: "nope" }), calls), input);
    expect(calls.n).toBe(2);
    expect(r.evaluation.evaluator).toBe("pattern");
    expect(r.evaluation.confidence).toBe("low");
    expect(r.evaluation.limitations).toMatch(/pattern rules/);
  });

  it("a failed model request falls back without throwing", async () => {
    const failing: LanguageModelProvider = { ...llm(good), async generateJson() { throw new Error("429 quota"); } };
    const r = await evaluate(failing, input);
    expect(r.evaluation.evaluator).toBe("pattern");
    expect(r.error).toMatch(/429/);
  });

  it("too little to judge is 'not enough evidence', never a low score, and the model isn't asked", async () => {
    const calls = { n: 0 };
    const r = await evaluate(llm(good, calls), { ...input, answer: "I decided quickly." });
    expect(calls.n).toBe(0);
    expect(r.evaluation.enoughEvidence).toBe(false);
    expect(r.evaluation.criteria.every((x) => x.level === null)).toBe(true);
    expect(r.evaluation.insufficientReason).toMatch(/too short/);
  });

  it("an unreliable voice transcript asks for another try instead of being judged", () => {
    expect(precheck("So we (inaudible) the launch and then (inaudible) I decided to go with the smaller rollout because of risk", "voice")).toMatch(/transcribed/);
    expect(precheck(ANSWER, "voice")).toBeNull();
  });

  it("a question about what happened, answered only hypothetically, isn't judged; a real story is", () => {
    const q = "Tell me about a time you had to choose between moving fast and getting it right.";
    expect(precheck("I would look at the options first and I would weigh the risks, then I'd pick the safer path and I'd explain it to the team clearly.", "text", q)).toMatch(/actually happened/);
    expect(precheck("Last year we had to choose. I would normally move fast, but I decided to slow down because the payment flow was at risk, and we shipped a week later.", "text", q)).toBeNull();
    // A question that asks what you would do is answered hypothetically by design.
    expect(precheck("I would look at the options first and I would weigh the risks, then I'd pick the safer path and I'd explain it to the team clearly.", "text", "How would you decide what to prioritize?")).toBeNull();
  });

  it("the pattern evaluator quotes only real sentences from the answer", () => {
    const e = patternEvaluate(input, "No language model is configured.");
    for (const j of e.criteria) if (j.evidence) expect(quotedFrom(j.evidence, ANSWER)).toBe(true);
    expect(e.criteria.find((x) => x.id === "alternatives")!.level).toBe(2);
  });
});

describe("generated transfer questions", () => {
  it("rejects paraphrases of a question already used", () => {
    const used = "Tell me about a time you had to make a decision without all the information you wanted.";
    expect(similarity(used, "Tell me about a time you made a decision without all the information you wanted?")).toBeGreaterThan(0.5);
    expect(acceptGenerated("Tell me about a time you made a decision without all the information you wanted?", [used])).toBe(false);
    expect(acceptGenerated("Your team has two weeks left and conflicting evidence about which feature to release. How would you decide?", [used])).toBe(true);
  });
});
