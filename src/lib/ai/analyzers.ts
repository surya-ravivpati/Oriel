import { z } from "zod";
import type { ParsedJobDescription, ParsedResume } from "@/db/schema";
import { analyzeAnswer, quantifiedStatements, sentences } from "@/lib/analysis/text";
import type { LanguageModelProvider, LlmUsage } from "./providers/types";

/**
 * Independent AI systems, each with its own prompt, schema and deterministic fallback.
 * All outputs are schema-validated. Every prompt forbids inventing facts, and outputs
 * that quote the candidate are verified against the source text before use.
 */

export const NO_INVENTION = "Never invent accomplishments, metrics, employers, responsibilities or history. If something is not in the source text, leave it out or use null. Copy facts verbatim.";

export type WithMeta<T> = { data: T; source: "llm" | "heuristic"; usage: LlmUsage | null; latencyMs: number; error?: string };

export async function tryLlm<T>(llm: LanguageModelProvider, fn: () => Promise<{ data: T; usage: LlmUsage; latencyMs: number }>, fallback: () => T): Promise<WithMeta<T>> {
  if (llm.isMock) return { data: fallback(), source: "heuristic", usage: null, latencyMs: 0 };
  try {
    const r = await fn();
    return { data: r.data, source: "llm", usage: r.usage, latencyMs: r.latencyMs };
  } catch (err) {
    return { data: fallback(), source: "heuristic", usage: null, latencyMs: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

/** True when `excerpt` genuinely appears in `source` (whitespace/case-insensitive). */
export function isGrounded(excerpt: string, source: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}%$]+/gu, " ").trim();
  const e = norm(excerpt);
  if (e.length < 3) return false;
  const src = norm(source);
  if (src.includes(e)) return true;
  // Allow light paraphrase only when most content words are present.
  const words = e.split(" ").filter((w) => w.length > 3);
  if (words.length < 3) return false;
  return words.filter((w) => src.includes(w)).length / words.length >= 0.8;
}

// ─── Resume Parser ─────────────────────────────────────────────────────────

const ResumeSchema = z.object({
  headline: z.string().nullable(),
  summary: z.string().nullable(),
  roles: z.array(z.object({
    title: z.string(), organization: z.string().nullable(), start: z.string().nullable(), end: z.string().nullable(),
    highlights: z.array(z.string()).max(6),
  })).max(12),
  skills: z.array(z.string()).max(40),
  education: z.array(z.object({ institution: z.string(), credential: z.string().nullable(), year: z.string().nullable() })).max(6),
  metrics: z.array(z.string()).max(15),
});

export async function parseResume(llm: LanguageModelProvider, rawText: string): Promise<WithMeta<ParsedResume>> {
  const text = rawText.slice(0, 30000);
  const r = await tryLlm(llm, () => llm.generateJson({
    tier: "analysis",
    system: `You extract structured data from resumes. ${NO_INVENTION} "metrics" are quantified statements copied verbatim from the resume.`,
    prompt: `Resume text:\n"""\n${text}\n"""`,
    schema: ResumeSchema,
  }), () => heuristicResume(text));
  // Drop anything the model produced that is not actually in the resume.
  const d = r.data as z.infer<typeof ResumeSchema>;
  const grounded: ParsedResume = {
    ...d,
    roles: d.roles.filter((ro) => isGrounded(ro.title, text)).map((ro) => ({
      ...ro,
      organization: ro.organization && isGrounded(ro.organization, text) ? ro.organization : null,
      highlights: ro.highlights.filter((h) => isGrounded(h, text)),
    })),
    metrics: d.metrics.filter((m) => isGrounded(m, text)),
    skills: d.skills.filter((s) => isGrounded(s, text)),
    source: r.source,
  };
  return { ...r, data: grounded };
}

export function heuristicResume(text: string): ParsedResume {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const titleRe = /\b(engineer|developer|manager|director|analyst|consultant|scientist|designer|nurse|physician|lead|head|officer|associate|intern|researcher|specialist|architect|vp|vice president|founder|product|administrator)\b/i;
  const dateRe = /((?:19|20)\d{2}|present|current)/i;
  const roles: ParsedResume["roles"] = [];
  for (let i = 0; i < lines.length && roles.length < 8; i++) {
    const l = lines[i];
    if (l.length < 90 && titleRe.test(l) && (dateRe.test(l) || dateRe.test(lines[i + 1] ?? ""))) {
      const [title, org] = l.split(/\s+(?:at|@|—|–|-|,|\|)\s+/);
      const years = (l + " " + (lines[i + 1] ?? "")).match(/(?:19|20)\d{2}|present|current/gi) ?? [];
      const highlights = lines.slice(i + 1, i + 6).filter((x) => /^[•\-*·]/.test(x) || x.length > 40).map((x) => x.replace(/^[•\-*·]\s*/, "")).slice(0, 4);
      roles.push({ title: title.replace(dateRe, "").replace(/[\s,–—-]+$/, "").trim(), organization: org ? org.replace(/(?:19|20)\d{2}.*$/, "").trim() || null : null, start: years[0] ?? null, end: years[1] ?? null, highlights });
    }
  }
  const skillsLine = lines.find((l) => /^skills?\b/i.test(l));
  return {
    headline: lines[1] && lines[1].length < 100 ? lines[1] : null,
    summary: null,
    roles,
    skills: skillsLine ? skillsLine.replace(/^skills?\s*[:\-]?\s*/i, "").split(/[,;|•]/).map((s) => s.trim()).filter(Boolean).slice(0, 30) : [],
    education: [],
    metrics: quantifiedStatements(text).slice(0, 10),
    source: "heuristic",
  };
}

// ─── Job Description Parser ────────────────────────────────────────────────

const JdSchema = z.object({
  title: z.string().nullable(),
  company: z.string().nullable(),
  seniority: z.string().nullable(),
  competencies: z.array(z.object({ key: z.string(), label: z.string(), evidence: z.string() })).max(10),
  requirements: z.array(z.string()).max(15),
});

export async function parseJobDescription(llm: LanguageModelProvider, rawText: string): Promise<WithMeta<ParsedJobDescription>> {
  const text = rawText.slice(0, 20000);
  const r = await tryLlm(llm, () => llm.generateJson({
    tier: "analysis",
    system: `You extract the competencies an interviewer would probe from a job description. ${NO_INVENTION} "evidence" must be a short phrase copied from the posting. Use snake_case keys like ownership, collaboration, system_design, metrics, stakeholder_management, communication, leadership.`,
    prompt: `Job description:\n"""\n${text}\n"""`,
    schema: JdSchema,
  }), () => heuristicJd(text));
  const d = r.data as z.infer<typeof JdSchema>;
  return { ...r, data: { ...d, competencies: d.competencies.filter((c) => isGrounded(c.evidence, text) || r.source === "heuristic"), source: r.source } };
}

const JD_KEYWORDS: [string, string, RegExp][] = [
  ["ownership", "Ownership", /\b(own|ownership|accountab|drive|end-to-end)\w*/i],
  ["collaboration", "Collaboration", /\b(collaborat|cross-functional|partner|stakeholder)\w*/i],
  ["communication", "Communication", /\b(communicat|present|written|verbal)\w*/i],
  ["impact", "Impact", /\b(impact|results|outcomes|metrics|kpi)\w*/i],
  ["system_design", "System design", /\b(architect|distributed|scalab|system design)\w*/i],
  ["metrics", "Metrics & analytics", /\b(data|analytic|sql|experiment|a\/b)\w*/i],
  ["strategy", "Strategy", /\b(strateg|vision|roadmap)\w*/i],
  ["org_building", "Leadership", /\b(lead|mentor|manage|hire|coach)\w*/i],
];

export function heuristicJd(text: string): ParsedJobDescription {
  const first = text.split(/\n+/).map((l) => l.trim()).find(Boolean) ?? null;
  const competencies = JD_KEYWORDS.flatMap(([key, label, re]) => {
    const m = re.exec(text);
    if (!m) return [];
    const s = sentences(text).find((x) => re.test(x)) ?? m[0];
    return [{ key, label, evidence: s.slice(0, 120) }];
  });
  const requirements = text.split(/\n+/).map((l) => l.trim()).filter((l) => /^[•\-*·]/.test(l)).map((l) => l.replace(/^[•\-*·]\s*/, "")).slice(0, 12);
  const seniority = /\b(principal|staff|senior|lead|director|vp|head|junior|entry|associate)\b/i.exec(text)?.[1] ?? null;
  return { title: first && first.length < 90 ? first : null, company: null, seniority, competencies, requirements, source: "heuristic" };
}

// ─── Answer Analyzer ───────────────────────────────────────────────────────

const AnswerAnalysisSchema = z.object({
  star: z.object({ situation: z.boolean(), action: z.boolean(), result: z.boolean(), outcome: z.boolean() }),
  specificity: z.number().min(0).max(1),
  answeredTheQuestion: z.boolean(),
  claims: z.array(z.object({ text: z.string(), kind: z.enum(["number", "team", "project", "responsibility", "outcome"]), supported: z.boolean() })).max(8),
  weakestSentence: z.string().nullable(),
  competencyEvidence: z.string().nullable(),
});
export type AnswerAnalysis = z.infer<typeof AnswerAnalysisSchema> & { source: "llm" | "heuristic" };

export async function analyzeAnswerWithModel(llm: LanguageModelProvider, question: string, answer: string, rubric: string | null): Promise<WithMeta<AnswerAnalysis>> {
  const r = await tryLlm(llm, () => llm.generateJson({
    tier: "analysis",
    system: `You analyse one spoken interview answer. ${NO_INVENTION} Claims must be exact excerpts from the answer. "supported" means the answer itself backs the claim with specifics (how, baseline, evidence). "weakestSentence" is copied verbatim.`,
    prompt: `Question: ${question}\n${rubric ? `What a strong answer shows: ${rubric}\n` : ""}Answer (speech transcript):\n"""\n${answer}\n"""`,
    schema: AnswerAnalysisSchema,
    timeoutMs: 20000,
  }), () => {
    const h = analyzeAnswer(answer);
    return {
      star: h.star, specificity: 1 - h.vagueness, answeredTheQuestion: h.wordCount > 20,
      claims: h.claims.map((c) => ({ text: c.text, kind: c.kind, supported: false })),
      weakestSentence: null, competencyEvidence: null,
    };
  });
  const d = r.data as z.infer<typeof AnswerAnalysisSchema>;
  return {
    ...r,
    data: {
      ...d,
      claims: d.claims.filter((c) => isGrounded(c.text, answer)),
      weakestSentence: d.weakestSentence && isGrounded(d.weakestSentence, answer) ? d.weakestSentence : null,
      source: r.source,
    },
  };
}

// ─── Coaching Generator ────────────────────────────────────────────────────

export interface MomentForCoaching {
  id: string;
  question: string;
  transcript: string;
  signal: string;
  evidence: string; // observed facts (measured), e.g. "Paused 4.8s before first word; 3 hedges in first sentence"
}

const CoachingSchema = z.object({
  moments: z.array(z.object({ id: z.string(), title: z.string(), observed: z.string(), suggestion: z.string() })),
  headline: z.string(),
  strengths: z.array(z.string()).max(3),
  focus: z.array(z.string()).max(3),
  rewrite: z.object({ original: z.string(), rewritten: z.string(), note: z.string() }).nullable(),
});
export type Coaching = z.infer<typeof CoachingSchema>;

export async function generateCoaching(
  llm: LanguageModelProvider,
  input: { role: string; moments: MomentForCoaching[]; weakestAnswer: { question: string; answer: string } | null; metricsSummary: string },
): Promise<WithMeta<Coaching>> {
  const r = await tryLlm(llm, () => llm.generateJson({
    tier: "analysis",
    system: [
      "You are Oriel's coach. You write specific, kind, direct feedback tied to evidence.",
      NO_INVENTION,
      "For each moment: 'title' is 2-5 words naming the moment (e.g. 'Salary expectations').",
      "'observed' states what happened using ONLY the measured evidence and transcript given (distinguish observed facts from inference; never guess emotions or intent).",
      "'suggestion' is ONE concrete change to try next time, starting with 'Try:'. No generic advice like 'be more confident'.",
      "Never comment on appearance, accent, age, emotion, personality or attractiveness.",
      "The rewrite must keep ONLY the candidate's own facts from their answer — tighten structure (lead with the point, action, result). If a number is missing, write [your number] rather than inventing one.",
    ].join("\n"),
    prompt: JSON.stringify({ role: input.role, metrics: input.metricsSummary, moments: input.moments, weakestAnswer: input.weakestAnswer }, null, 1),
    schema: CoachingSchema,
    timeoutMs: 45000,
  }), () => heuristicCoaching(input));
  const d = r.data as Coaching;
  // Guard: a rewrite may not introduce digits that are absent from the original answer.
  if (d.rewrite && input.weakestAnswer) {
    const srcNums = new Set(input.weakestAnswer.answer.match(/\d[\d,.]*/g) ?? []);
    const invented = (d.rewrite.rewritten.match(/\d[\d,.]*/g) ?? []).filter((n) => !srcNums.has(n));
    if (invented.length) d.rewrite = { ...d.rewrite, rewritten: d.rewrite.rewritten.replace(/\d[\d,.]*%?/g, (n) => (srcNums.has(n.replace("%", "")) ? n : "[your number]")) };
  }
  return { ...r, data: d };
}

export function heuristicCoaching(input: { moments: MomentForCoaching[]; weakestAnswer: { question: string; answer: string } | null }): Coaching {
  const SUGGEST: Record<string, [string, string]> = {
    recovery: ["Slow start", "Try: buy two seconds out loud — 'Good question, let me think about the best example' — then lead with your answer."],
    fillers: ["Filler-heavy stretch", "Try: when you feel an 'um' coming, close your mouth and pause for a beat instead."],
    hedges: ["Hedged claims", "Try: state the claim plainly first ('I led…'), then add the caveat if it matters."],
    vague: ["Missing specifics", "Try: attach one number, one name, and one timeframe to the result."],
    structure: ["No clear result", "Try: finish with the result and what it meant — 'As a result, … which meant …'."],
    length: ["Long answer", "Try: give the headline in your first sentence, then offer detail: 'Happy to go deeper on any part.'"],
    pace: ["Rushed delivery", "Try: pause at the end of each sentence; aim for about 140 words per minute."],
    camera: ["Looked away from the lens", "Try: return your eyes to the camera each time you finish a thought."],
    interrupted: ["Interrupted mid-answer", "Try: lead with your point in the first 20 seconds so an interruption lands after it, not before."],
  };
  const moments = input.moments.map((m) => {
    const [title, suggestion] = SUGGEST[m.signal] ?? ["Moment to review", "Try: lead with the point, then the evidence."];
    return { id: m.id, title, observed: m.evidence, suggestion };
  });
  return {
    moments,
    headline: moments.length ? `Your biggest opportunity: ${moments[0].title.toLowerCase()}.` : "A steady session.",
    strengths: [],
    focus: moments.slice(0, 3).map((m) => m.suggestion.replace(/^Try:\s*/, "")),
    rewrite: null,
  };
}

// ─── Drill Feedback ────────────────────────────────────────────────────────

const DrillFeedbackSchema = z.object({ feedback: z.string(), nextTry: z.string() });

export async function generateDrillFeedback(llm: LanguageModelProvider, drill: { title: string; objective: string }, transcript: string, measured: string): Promise<WithMeta<{ feedback: string; nextTry: string }>> {
  return tryLlm(llm, () => llm.generateJson({
    tier: "analysis",
    system: `You coach a five-minute interview drill. Two sentences of feedback grounded in the measurement and transcript, then one concrete thing to try next. ${NO_INVENTION} No comments on appearance, accent or emotion.`,
    prompt: `Drill: ${drill.title} — ${drill.objective}\nMeasured: ${measured}\nTranscript:\n"""\n${transcript}\n"""`,
    schema: DrillFeedbackSchema,
    timeoutMs: 20000,
  }), () => ({ feedback: `Measured: ${measured}.`, nextTry: "Repeat the drill once more and aim to beat this number." }));
}
