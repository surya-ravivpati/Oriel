import { competency, competenciesFor, type Category, type Competency, type Level } from "./competencies";
import { poolFor, type Exercise } from "./questions";

/*
 * The learning engine. Deterministic: it decides what happens next from stored evaluations,
 * never from how encouraging an evaluator sounded. Five stages:
 *
 *   1. attempt   answer a question cold
 *   2. diagnose  the one criterion that matters most is chosen (the evaluator proposes,
 *                the engine validates)
 *   3. retry     answer the same question again, applying a principle (scaffolding grows on
 *                each miss, at most two retries, never a model answer)
 *   4. transfer  a different situation that needs the same skill, with no hint of which
 *   5. review    later, a different question again, to see whether it held
 *
 * Three outcomes are kept separate and never merged into one score: improved on the same
 * question, carried to a new question, held after a delay. "Not assessed" (not enough evidence,
 * or never tried) is its own state and is never counted as a failure.
 */

// ─── Evaluations ────────────────────────────────────────────────────────────

/** A criterion's judgment: a level, or "cannot tell" when the answer didn't give enough to judge. */
export type CriterionLevel = Level | null;

export interface CriterionJudgment {
  id: string;
  /** The criterion's label as it was when judged (rubrics change; history must not). */
  label: string;
  level: CriterionLevel;
  /** A verbatim excerpt of the answer, checked to appear in it; null when none supports the judgment. */
  evidence: string | null;
  interpretation: string;
}

export interface Weakness {
  criterionId: string;
  observation: string;
  whyItMatters: string;
  instruction: string;
}

export interface Evaluation {
  competencyId: string;
  rubricVersion: number;
  evaluator: "model" | "pattern";
  criteria: CriterionJudgment[];
  /** False when the answer (or its transcript) can't support a judgment of this competency at all. */
  enoughEvidence: boolean;
  confidence: "high" | "medium" | "low";
  primary: Weakness | null;
  secondary: string[];
  limitations: string | null;
  /** Why the answer couldn't be assessed, when it couldn't. */
  insufficientReason: string | null;
}

export function levelOf(e: Evaluation | null | undefined, criterionId: string): CriterionLevel {
  if (!e || !e.enoughEvidence) return null;
  return e.criteria.find((c) => c.id === criterionId)?.level ?? null;
}

/** Shown means every criterion is at least partly there and none is missing outright. */
export function demonstrated(e: Evaluation): boolean | null {
  if (!e.enoughEvidence) return null;
  const levels = e.criteria.map((c) => c.level);
  if (levels.every((l) => l === null)) return null;
  return levels.every((l) => l === null || l >= 1) && levels.some((l) => l === 2);
}

/**
 * The criterion to train: the evaluator's proposal when it is a real criterion that isn't
 * already shown; otherwise the first criterion (in rubric order) that is missing, then partly
 * shown. Null when everything is clearly shown.
 */
export function chooseTarget(c: Competency, e: Evaluation): string | null {
  const levels = new Map(e.criteria.map((j) => [j.id, j.level]));
  const proposed = e.primary?.criterionId;
  if (proposed && c.criteria.some((x) => x.id === proposed) && levels.get(proposed) !== 2) return proposed;
  return c.criteria.find((x) => levels.get(x.id) === 0)?.id ?? c.criteria.find((x) => levels.get(x.id) === 1)?.id ?? null;
}

// ─── The loop ───────────────────────────────────────────────────────────────

export type Stage = "attempt" | "retry" | "transfer" | "done";
export type AttemptStage = "initial" | "retry" | "transfer" | "review";

export interface LoopState {
  kind: "practice" | "review";
  stage: Stage;
  targetCriterion: string | null;
  scaffold: 0 | 1 | 2;
  retries: number;
  insufficientStreak: number;
}

export const MAX_RETRIES = 2;
export const MAX_INSUFFICIENT = 2;

export type Step =
  | { kind: "reassess"; reason: string; canSkip: boolean }          // couldn't judge: answer again (not a failure)
  | { kind: "retry"; target: string; scaffold: 0 | 1 | 2 }          // same question, apply the principle
  | { kind: "transfer"; target: string | null; skipped: "shown" | "retries" | "unassessed" | null }
  | { kind: "done" };

/** Which attempt stage the loop's current stage produces. */
export function attemptStageOf(s: LoopState): AttemptStage {
  if (s.kind === "review") return "review";
  return s.stage === "retry" ? "retry" : s.stage === "transfer" ? "transfer" : "initial";
}

/** Decide the next step after an evaluation. Pure; the caller persists the result. */
export function advance(c: Competency, s: LoopState, e: Evaluation): { state: LoopState; step: Step } {
  const stage = attemptStageOf(s);
  if (!e.enoughEvidence) {
    const streak = s.insufficientStreak + 1;
    // Reviews and transfers can't be repeated forever either: after two unassessable answers, move on.
    if (streak >= MAX_INSUFFICIENT && (stage === "transfer" || stage === "review")) return { state: { ...s, stage: "done", insufficientStreak: streak }, step: { kind: "done" } };
    if (streak >= MAX_INSUFFICIENT && stage === "initial") return { state: { ...s, stage: "transfer", insufficientStreak: 0 }, step: { kind: "transfer", target: null, skipped: "unassessed" } };
    return { state: { ...s, insufficientStreak: streak }, step: { kind: "reassess", reason: e.insufficientReason ?? "There wasn't enough in the answer to judge.", canSkip: streak >= 1 } };
  }
  const base = { ...s, insufficientStreak: 0 };
  switch (stage) {
    case "initial": {
      const target = chooseTarget(c, e);
      if (!target) return { state: { ...base, stage: "transfer", targetCriterion: null }, step: { kind: "transfer", target: null, skipped: "shown" } };
      return { state: { ...base, stage: "retry", targetCriterion: target, scaffold: 0, retries: 0 }, step: { kind: "retry", target, scaffold: 0 } };
    }
    case "retry": {
      const target = s.targetCriterion!;
      const retries = s.retries + 1;
      if (levelOf(e, target) === 2) return { state: { ...base, stage: "transfer", retries }, step: { kind: "transfer", target, skipped: null } };
      // Not there yet: more support, but never endless repetition of one question.
      if (retries >= MAX_RETRIES) return { state: { ...base, stage: "transfer", retries }, step: { kind: "transfer", target, skipped: "retries" } };
      const scaffold = Math.min(2, s.scaffold + 1) as 1 | 2;
      return { state: { ...base, retries, scaffold }, step: { kind: "retry", target, scaffold } };
    }
    case "transfer":
    case "review":
      return { state: { ...base, stage: "done" }, step: { kind: "done" } };
  }
}

// ─── Outcomes ───────────────────────────────────────────────────────────────

export interface AttemptRecord { stage: AttemptStage; createdAt: Date; evaluation: Evaluation | null }

export type Outcome = "yes" | "no" | "not_assessed";

export interface LoopOutcome {
  /** Did the targeted criterion improve between the first attempt and the last retry on the same question? */
  improvedOnRetry: Outcome;
  /** Was the targeted criterion clearly shown on a different question, with no hint? */
  transferred: Outcome;
  /** For a review: was it clearly shown after the delay? */
  retained: Outcome;
}

const rank = (l: CriterionLevel) => (l === null ? -1 : l);

/**
 * Outcomes from the attempts alone. An improvement on the same question is never counted as
 * mastery; a failed or unassessed transfer is never counted as transfer; a missing assessment is
 * "not assessed", not "no".
 */
export function outcomeOf(kind: "practice" | "review", target: string | null, attempts: AttemptRecord[]): LoopOutcome {
  const assessed = (st: AttemptStage) => attempts.filter((a) => a.stage === st && a.evaluation?.enoughEvidence);
  const lastOf = (st: AttemptStage) => assessed(st).at(-1)?.evaluation ?? null;
  const out: LoopOutcome = { improvedOnRetry: "not_assessed", transferred: "not_assessed", retained: "not_assessed" };
  if (kind === "review") {
    const r = lastOf("review");
    if (r && target) out.retained = levelOf(r, target) === 2 ? "yes" : levelOf(r, target) === null ? "not_assessed" : "no";
    else if (r) out.retained = demonstrated(r) === null ? "not_assessed" : demonstrated(r) ? "yes" : "no";
    return out;
  }
  const initial = lastOf("initial");
  const retry = lastOf("retry");
  if (target && initial && retry) {
    const a = levelOf(initial, target), b = levelOf(retry, target);
    out.improvedOnRetry = a === null || b === null ? "not_assessed" : rank(b) > rank(a) ? "yes" : "no";
  }
  const t = lastOf("transfer");
  if (t) {
    if (target) out.transferred = levelOf(t, target) === null ? "not_assessed" : levelOf(t, target) === 2 ? "yes" : "no";
    else out.transferred = demonstrated(t) === null ? "not_assessed" : demonstrated(t) ? "yes" : "no";
  }
  return out;
}

// ─── Scheduling ─────────────────────────────────────────────────────────────

const DAY = 86_400_000;

/**
 * When to look again. After practice: three days if it transferred (spacing tests retention),
 * one day if it didn't (it needs work while fresh). After a review: two weeks if it held,
 * two days if it didn't.
 */
export function nextReviewAt(kind: "practice" | "review", o: LoopOutcome, now: Date): Date {
  const days = kind === "review" ? (o.retained === "yes" ? 14 : 2) : o.transferred === "yes" ? 3 : 1;
  return new Date(now.getTime() + days * DAY);
}

// ─── Choosing what to practise ──────────────────────────────────────────────

export interface CompetencyHistory {
  competencyId: string;
  lastPracticedAt: Date | null;
  assessed: boolean;
  transferred: Outcome;
  retained: Outcome;
}

/** Not yet assessed first, then skills that haven't transferred or held, then the least recently practised. */
export function chooseCompetency(category: Category, history: CompetencyHistory[]): string {
  const candidates = competenciesFor(category);
  const h = new Map(history.map((x) => [x.competencyId, x]));
  const score = (id: string) => {
    const x = h.get(id);
    if (!x || !x.assessed) return 0;
    if (x.transferred === "no" || x.retained === "no") return 1;
    if (x.transferred !== "yes") return 2;
    return 3 + (x.lastPracticedAt ? x.lastPracticedAt.getTime() / 1e15 : 0);
  };
  return [...candidates].sort((a, b) => score(a.id) - score(b.id) || a.id.localeCompare(b.id))[0].id;
}

/**
 * A curated exercise for this competency that the person hasn't answered, in a situation they
 * haven't met in this loop. Null when the bank is exhausted (the caller may then generate one).
 */
export function pickExercise(competencyId: string, category: Category, usedIds: Set<string>, avoidSituations: Set<string>, seed: number): Exercise | null {
  const pool = poolFor(competencyId, category);
  const fresh = pool.filter((e) => !usedIds.has(e.id) && !avoidSituations.has(e.situation));
  const fallback = pool.filter((e) => !avoidSituations.has(e.situation));
  const list = fresh.length ? fresh : fallback;
  if (!list.length) return null;
  // Easier questions first for a first attempt; a stable pick otherwise.
  const sorted = [...list].sort((a, b) => a.difficulty - b.difficulty || a.id.localeCompare(b.id));
  return sorted[Math.abs(seed) % Math.min(sorted.length, 2)];
}

export { competency };
