import { z } from "zod";
import type { LanguageModelProvider } from "@/lib/ai/providers/types";
import { words } from "@/lib/analysis/text";
import type { Category, Competency } from "./competencies";
import type { Exercise } from "./questions";

/*
 * Transfer questions from the model, only when the curated bank has nothing left in a new
 * situation. The engine fixes the competency and category; the model only writes the question.
 * Output is validated (length, a real question, not a paraphrase of the questions already
 * used), and the result is marked unvalidated: it is never added to the curated bank.
 */

const Out = z.object({ question: z.string().min(20).max(300), situation: z.string().min(3).max(40), expected: z.string().min(10).max(300) });

/** Share of content words two questions have in common. */
export function similarity(a: string, b: string): number {
  const set = (s: string) => new Set(words(s).map((w) => w.toLowerCase().replace(/[^a-z]/g, "")).filter((w) => w.length > 3));
  const A = set(a), B = set(b);
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const w of A) if (B.has(w)) n++;
  return n / Math.min(A.size, B.size);
}

export function acceptGenerated(q: string, used: string[]): boolean {
  const t = q.trim();
  return t.length >= 20 && /\?$|^(?:tell me|describe|walk me|talk me)/i.test(t) && used.every((u) => similarity(t, u) < 0.5);
}

export async function generateExercise(llm: LanguageModelProvider, c: Competency, category: Category, used: { text: string; situation: string }[], difficulty: 1 | 2 | 3): Promise<Exercise | null> {
  if (llm.isMock) return null;
  try {
    const r = await llm.generateJson({
      tier: "analysis",
      system: "You write one realistic interview question. Output only the question, a short kebab-case label for its situation, and what a strong answer has to show. Never include hints about how to answer.",
      prompt: [
        `Interview type: ${category}. Difficulty ${difficulty} of 3.`,
        `The question must require this skill: ${c.label} (${c.summary}), without naming it.`,
        "It must put the candidate in a meaningfully different situation from these, not a paraphrase:",
        ...used.map((u) => `- [${u.situation}] ${u.text}`),
      ].join("\n"),
      schema: Out, maxTokens: 300, timeoutMs: 10000,
    });
    const d = Out.parse(r.data);
    if (!acceptGenerated(d.question, used.map((u) => u.text)) || used.some((u) => u.situation === d.situation)) return null;
    return {
      id: `gen-${Date.now().toString(36)}`, text: d.question.trim(), category, competencies: [c.id], difficulty, situation: d.situation,
      expected: d.expected, followUps: [], source: "generated", validated: false,
    };
  } catch {
    return null;
  }
}
