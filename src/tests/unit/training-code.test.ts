import { describe, expect, it } from "vitest";
import type { LanguageModelProvider } from "@/lib/ai/providers/types";
import { competency } from "@/lib/training/competencies";
import { CODE_PROBLEMS, summarize, validResults, type CodeResult } from "@/lib/training/code";
import { evaluateCode } from "@/lib/training/evaluate";
import { poolFor } from "@/lib/training/questions";

const c = competency("implementation");
const dedupe = CODE_PROBLEMS.find((p) => p.id === "k-dedupe")!;
const results = (passing: (name: string, edge: boolean) => boolean): CodeResult[] =>
  dedupe.spec.tests.map((t) => ({ name: t.name, edge: !!t.edge, pass: passing(t.name, !!t.edge), got: passing(t.name, !!t.edge) ? JSON.stringify(t.expected) : "[]" }));
const prompts: string[] = [];
const spy: LanguageModelProvider = {
  id: "spy", isMock: false,
  async generateText() { throw new Error("unused"); },
  async generateJson<T>(req: { prompt: string }) {
    prompts.push(req.prompt);
    return { data: { criteria: [{ id: "explains", level: "shown", evidence: "linear time and linear extra space", interpretation: "" }], enoughEvidence: true, confidence: "high", primaryWeakness: null, secondary: [], limitations: null } as T, usage: { model: "x", inputTokens: 1, outputTokens: 1 }, latencyMs: 1 };
  },
};
const SOURCE = "function dedupe(items) { return [...new Set(items)]; } // SECRET_SOURCE_MARKER";

describe("coding exercises", () => {
  it("there are at least five problems, each its own situation, all in the technical pool", () => {
    const pool = poolFor("implementation", "technical");
    expect(pool.length).toBeGreaterThanOrEqual(5);
    expect(new Set(pool.map((p) => p.situation)).size).toBe(pool.length);
    expect(pool.every((p) => p.code && p.code.tests.some((t) => t.edge) && p.code.tests.some((t) => !t.edge))).toBe(true);
  });

  it("accepts results only when there is one per test, by name and kind, in order", () => {
    expect(validResults(dedupe.spec, results(() => true))).toBe(true);
    expect(validResults(dedupe.spec, results(() => true).slice(1))).toBe(false);
    const swapped = results(() => true); [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
    expect(validResults(dedupe.spec, swapped)).toBe(false);
  });

  it("decides correctness only from the tests, and targets the first failing kind", async () => {
    const r = await evaluateCode(spy, { competency: c, question: dedupe.text, spec: dedupe.spec, submission: { source: SOURCE, explanation: "", results: results((_, edge) => !edge), ranIn: "browser" }, target: null });
    const lv = (id: string) => r.evaluation.criteria.find((x) => x.id === id)!.level;
    expect(lv("correct")).toBe(2);
    expect(lv("edge_cases")).toBe(0);
    expect(lv("explains")).toBeNull(); // no explanation: can't tell, not a fail
    expect(r.evaluation.primary?.criterionId).toBe("edge_cases");
    expect(r.evaluation.primary?.observation).toMatch(/dedupe\(\[\]\) returned \[\]|edge case dedupe/);
    expect(summarize(r.evaluation.criteria.length ? results((_, e) => !e) : []).edge.pass).toBe(0);
  });

  it("asks the model about the explanation only, never the code", async () => {
    prompts.length = 0;
    const r = await evaluateCode(spy, { competency: c, question: dedupe.text, spec: dedupe.spec, submission: { source: SOURCE, explanation: "I keep a Set of items already seen and walk the array once, so it runs in linear time and linear extra space.", results: results(() => true), ranIn: "browser" }, target: null });
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).not.toContain("SECRET_SOURCE_MARKER");
    expect(r.evaluation.criteria.map((x) => x.level)).toEqual([2, 2, 2]);
    expect(r.evaluation.primary).toBeNull();
  });
});
