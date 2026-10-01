import { z } from "zod";
import { FILLER_PATTERNS, HEDGE_PATTERNS } from "@/lib/analysis/text";
import { LESSONS } from "@/lib/lessons/library";
import type { Assessment } from "@/lib/lessons/planner";
import type { LessonContent, LessonKey } from "@/lib/lessons/types";
import { NO_INVENTION, isGrounded, tryLlm, type WithMeta } from "./analyzers";
import type { LanguageModelProvider } from "./providers/types";

/**
 * Lesson Writer: the personal part of each lesson — what we noticed, one tailored tip,
 * and (where it teaches the skill) the person's own answer rewritten. One call per plan.
 * The model only rewords what it is given; every output is checked against the measured
 * facts and the person's own words, and anything that fails falls back to templates.
 */
const Schema = z.object({
  lessons: z.array(z.object({
    key: z.string(),
    observation: z.string().max(600),
    tip: z.string().max(320),
    rewrite: z.object({ before: z.string().max(1500), after: z.string().max(1500) }).nullable(),
  })).max(12),
});

const SYSTEM = `You are an interview coach writing short, personal notes inside practice lessons. Use only the measured facts and the candidate's own words provided. ${NO_INVENTION}
- "observation": at most two sentences, second person, warm and direct, about what was measured. Restate only numbers that appear in the facts.
- "tip": one concrete sentence applying the lesson to this person's answers.
- "rewrite": only when a focus answer is given. "before" must be copied verbatim from the focus answer (a sentence or two). "after" applies the lesson to those same words: restructure, trim and lead with the point, but never add numbers, names, employers, tools or results that are not in the focus answer, and never make a claim stronger than they made it — "it went okay" stays okay, "helped" doesn't become "led". Where a number or result would help, write a bracketed placeholder such as [number], [timeframe] or [what changed]. Otherwise null.`;

export async function writeLessons(llm: LanguageModelProvider, input: { role: string; lessons: Assessment[] }): Promise<WithMeta<Record<string, LessonContent>>> {
  const fallback = () => Object.fromEntries(input.lessons.map((a) => [a.key, heuristicContent(a)]));
  if (!input.lessons.length) return { data: {}, source: "heuristic", usage: null, latencyMs: 0 };
  const prompt = `Target role: ${input.role}\n\n` + input.lessons.map((a) => {
    const def = LESSONS[a.key];
    const focus = def.rewrites && a.focus ? `Focus answer (to the question "${a.focus.question}"):\n"""${a.focus.text.slice(0, 1500)}"""` : "Focus answer: none (rewrite must be null).";
    return `### key: ${a.key}\nLesson: ${def.title} — ${def.promise}\nMeasured facts:\n${a.evidence.facts.map((f) => `- ${f}`).join("\n")}\nTarget: ${a.evidence.target}\nTheir words:\n${a.evidence.quotes.map((q) => `- "${q.text}"`).join("\n") || "- (none)"}\n${focus}`;
  }).join("\n\n");
  const r = await tryLlm(llm, () => llm.generateJson({ tier: "analysis", system: SYSTEM, prompt, schema: Schema }), () => ({ lessons: [] }));
  if (r.source === "heuristic") return { ...r, data: fallback() };
  const out: Record<string, LessonContent> = {};
  for (const a of input.lessons) out[a.key] = checked(a, r.data.lessons.find((l) => l.key === a.key));
  return { ...r, data: out };
}

/** Accept model text only where it stays inside the evidence; fill the rest from templates. */
function checked(a: Assessment, m: z.infer<typeof Schema>["lessons"][number] | undefined): LessonContent {
  const base = heuristicContent(a);
  if (!m) return base;
  const known = [...a.evidence.facts, a.evidence.display, a.evidence.target, ...a.evidence.quotes.map((q) => q.text)].join(" ");
  const observation = m.observation.trim() && numbersWithin(m.observation, known) ? m.observation.trim() : base.observation;
  const tip = m.tip.trim() && numbersWithin(m.tip, known + " " + (a.focus?.text ?? "")) ? m.tip.trim() : base.tip;
  let rewrite = base.rewrite;
  // Fillers and softeners are taught by removing them from the person's exact words — a model
  // rewrite would only add room to overclaim, so the deterministic version is kept.
  if (LESSONS[a.key].rewrites && a.focus && m.rewrite && a.key !== "fillers" && a.key !== "hedging") {
    const { before, after } = m.rewrite;
    const ok = isGrounded(before, a.focus.text) && after.trim().length > 0 && numbersWithin(after.replace(/\[[^\]]*\]/g, ""), a.focus.text);
    if (ok) rewrite = { before: before.trim(), after: after.trim(), note: "Your own words, rewritten. Anything in [brackets] is yours to fill in — we never add facts." };
  }
  const changed = observation !== base.observation || tip !== base.tip || rewrite !== base.rewrite;
  return { observation, tip, rewrite, source: changed ? "llm" : "heuristic" };
}

const NUM = /\d+(?:[.,]\d+)?/g;
/** Every number in `text` appears in `source` (so the model can't introduce figures). */
export function numbersWithin(text: string, source: string): boolean {
  const have = new Set((source.match(NUM) ?? []).map((n) => n.replace(",", ".")));
  return (text.match(NUM) ?? []).every((n) => have.has(n.replace(",", ".")));
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Remove matches of `patterns` and tidy the punctuation left behind. */
export function stripPatterns(text: string, patterns: { re: RegExp }[]): string {
  let t = text;
  for (const { re } of patterns) t = t.replace(new RegExp(re.source, re.flags), "");
  return t.replace(/\s*,\s*(?=[,.!?])/g, "").replace(/(^|[.!?]\s+)[,\s]+/g, "$1").replace(/\s+([,.!?])/g, "$1").replace(/,{2,}/g, ",")
    .replace(/\s{2,}/g, " ").trim().replace(/(^|[.!?]\s+)([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase());
}

/** Template content from the measurements alone — what the lesson shows without a model. */
export function heuristicContent(a: Assessment): LessonContent {
  const def = LESSONS[a.key as LessonKey];
  const [first, second] = a.evidence.facts;
  const observation = `${cap(first ?? a.evidence.display)} — the target is ${a.evidence.target}.${second ? ` ${cap(second)}.` : ""}`;
  const tip = `${def.steps[0].title}: ${def.steps[0].body}`;
  let rewrite: LessonContent["rewrite"] = null;
  if (a.focus && a.evidence.quotes.length && (a.key === "fillers" || a.key === "hedging")) {
    const before = a.evidence.quotes[0].text; // one sentence, exactly as said
    // Softeners include "kind of"/"sort of"; "I'm not sure" can be honest, so it stays.
    const after = stripPatterns(before, a.key === "fillers" ? FILLER_PATTERNS : [...HEDGE_PATTERNS.filter((h) => h.key !== "i'm not sure"), ...FILLER_PATTERNS.filter((f) => f.key === "kind of")]);
    if (after && after !== before) rewrite = { before, after, note: a.key === "fillers" ? "The same words with the fillers taken out. Put a short pause where each one was." : "The same words without the softeners. It says exactly what you did." };
  }
  return { observation, tip, rewrite, source: "heuristic" };
}
