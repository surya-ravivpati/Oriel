import type { SessionPhase } from "@/db/schema";
import type { AnswerHeuristics } from "@/lib/analysis/text";
import { getPack, type BankQuestion, type InterviewType } from "./domain-packs";
import { PERSONAS, type PanelRole, type PersonaId } from "./personas";
import { adaptPressure, pressurePolicy, type PressureLevel, type PressurePolicy } from "./pressure";

/**
 * Deterministic interview controller.
 *
 * The language model never decides what happens next — it only phrases what this
 * controller decided. Given the state and an analysed answer, `decide` returns the
 * next action plus the new state. Randomness (curveballs, numeric probes) comes from
 * a seeded PRNG so every session can be replayed exactly in tests and in the admin
 * console.
 */

export interface SeatedInterviewer {
  id: string;
  personaId: PersonaId;
  panelRole: PanelRole | null;
  seat: number;
  name: string;
  /** Set when the person named this interviewer: used whole in conversation (not cut to a first name). */
  callName?: string;
  /** Set when the person chose this interviewer's voice. */
  voice?: string;
}

export interface OpenClaim {
  id: string;
  kind: string;
  text: string;
  status: "open" | "probed" | "supported" | "weak";
  answerSeq: number;
}

export interface InterviewState {
  version: 1;
  phase: SessionPhase;
  basePressure: PressureLevel;
  currentPressure: PressureLevel;
  domain: string;
  type: InterviewType;
  level: string;
  role: string;
  mode: "single" | "panel";
  interviewers: SeatedInterviewer[];
  plan: PlannedQuestion[];
  planCursor: number;
  currentPrimary: { questionId: string; competency: string; seat: number } | null;
  lastQuestion: { questionId: string; seat: number; kind: QuestionKind } | null;
  followUpDepth: number;
  coverage: Record<string, number[]>; // competency → answer qualities
  qualityHistory: number[];
  curveballsEnabled: boolean;
  curveballsUsed: number;
  memoryCallbacksUsed: number;
  crossQuestionsUsed: number;
  answerSeq: number;
  targetMinutes: number;
  rngSeed: number;
  closingAsked: boolean;
}

export interface PlannedQuestion {
  bankId: string;
  competency: string;
  text: string;
  difficulty: number;
  seat: number;
}

export type QuestionKind = "intro" | "primary" | "follow_up" | "pressure" | "memory_callback" | "curveball" | "closing" | "cross" | "farewell";

export type Intent =
  | "open_interview"
  | "ask_primary"
  | "ask_specifics"
  | "ask_personal_role"
  | "ask_result"
  | "probe_number"
  | "challenge_claim"
  | "redirect_after_interrupt"
  | "clarify_short"
  | "memory_callback"
  | "curveball"
  | "cross_question"
  | "invite_questions"
  | "farewell";

export interface Decision {
  action: "INTRO" | "FOLLOW_UP" | "PRESSURE_EVENT" | "NEXT_QUESTION" | "CLOSING" | "COMPLETE";
  intent: Intent;
  kind: QuestionKind;
  seat: number;
  competency: string | null;
  /** Exact question text for bank/curveball questions; the renderer keeps its meaning. */
  baseQuestion: string | null;
  /** Verbatim claim being referenced (memory callback / number probe / challenge). */
  claim: { id: string; text: string } | null;
  acknowledgement: "none" | "brief" | "warm";
  preSilenceMs: number;
  handoffFromSeat: number | null;
  avatarCue: "nod" | "still" | "brow_raise" | "lean_in" | "gaze_shift";
  pressure: PressureLevel;
  reason: string;
}

export interface AnswerInput {
  text: string;
  heuristics: AnswerHeuristics;
  durationSec: number;
  interrupted: boolean;
  firstWordLatencyMs: number | null;
  elapsedMs: number;
  claims: OpenClaim[]; // all claims in the session ledger
}

// ─── PRNG ──────────────────────────────────────────────────────────────────

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Planning ──────────────────────────────────────────────────────────────

export interface PlanInput {
  domain: string;
  type: InterviewType;
  level: string;
  role: string;
  targetMinutes: number;
  interviewers: SeatedInterviewer[];
  jdCompetencies?: string[]; // competency labels/keys from the parsed job description
  resumeRole?: { title: string; organization: string | null } | null;
  seed: number;
}

const LEVEL_DIFFICULTY: Record<string, number> = { recruiter: 1, hiring_manager: 2, senior_manager: 3, executive: 3 };

/** Which competencies each panel role gravitates to. */
const PANEL_FOCUS: Record<PanelRole, string[]> = {
  hiring_manager: ["motivation", "ownership", "impact", "product_sense", "strategy", "clinical_judgement"],
  peer: ["collaboration", "technical_depth", "system_design", "debugging", "teamwork", "methods", "structuring", "technicals"],
  skeptic: ["impact", "adversity", "metrics", "quant", "rigor", "judgement", "exec_judgement", "detail"],
  executive: ["strategy", "org_building", "exec_judgement", "communication", "motivation"],
};

export function buildPlan(input: PlanInput): PlannedQuestion[] {
  const pack = getPack(input.domain);
  const rng = mulberry32(input.seed);
  const maxDifficulty = LEVEL_DIFFICULTY[input.level] ?? 2;
  const primaries = Math.max(3, Math.min(8, Math.round(input.targetMinutes / 3.5)));
  const fitsType = (q: BankQuestion) => input.type === "mixed" || q.types.includes(input.type);

  const candidates = pack.questions.filter((q) => fitsType(q) && q.id !== "core-intro" && q.difficulty <= Math.max(maxDifficulty, 2));
  // Prioritise competencies the job description emphasises.
  const jd = (input.jdCompetencies ?? []).map((c) => c.toLowerCase());
  const jdBoost = (q: BankQuestion) => {
    const comp = pack.competencies.find((c) => c.key === q.competency);
    const label = (comp?.label ?? q.competency).toLowerCase();
    return jd.some((j) => label.includes(j) || j.includes(q.competency.replace(/_/g, " ")) || j.includes(label.split(" ")[0])) ? 1 : 0;
  };
  const scored = candidates
    .map((q) => ({ q, score: jdBoost(q) * 2 + (q.difficulty === maxDifficulty ? 0.6 : 0) + (pack.questions.indexOf(q) >= 7 ? 0.5 : 0) + rng() }))
    .sort((a, b) => b.score - a.score);

  const chosen: BankQuestion[] = [];
  const usedComp = new Set<string>();
  for (const { q } of scored) {
    if (chosen.length >= primaries - 1) break;
    if (usedComp.has(q.competency)) continue;
    chosen.push(q);
    usedComp.add(q.competency);
  }
  for (const { q } of scored) {
    if (chosen.length >= primaries - 1) break;
    if (!chosen.includes(q)) chosen.push(q);
  }

  const intro = pack.questions.find((q) => q.id === "core-intro")!;
  const plan: PlannedQuestion[] = [{ bankId: intro.id, competency: intro.competency, text: intro.text, difficulty: 1, seat: 0 }];

  // A resume-grounded question uses only verbatim resume fields.
  if (input.resumeRole?.title) {
    const where = input.resumeRole.organization ? ` at ${input.resumeRole.organization}` : "";
    plan.push({
      bankId: "resume-role", competency: "ownership",
      text: `Your resume lists your role as ${input.resumeRole.title}${where}. What's the hardest problem you personally owned in that role?`,
      difficulty: 2, seat: 0,
    });
  }

  for (const q of chosen) {
    if (plan.length >= primaries) break;
    plan.push({ bankId: q.id, competency: q.competency, text: q.text, difficulty: q.difficulty, seat: 0 });
  }

  // Assign seats for panels by competency focus, keeping the lead on the opener.
  if (input.interviewers.length > 1) {
    let rr = 1;
    for (let i = 1; i < plan.length; i++) {
      const fit = input.interviewers.find((iv) => iv.panelRole && PANEL_FOCUS[iv.panelRole].includes(plan[i].competency) && iv.seat !== plan[i - 1].seat);
      plan[i].seat = fit ? fit.seat : input.interviewers[rr++ % input.interviewers.length].seat;
    }
  }
  return plan;
}

export function initialState(input: PlanInput & { pressure: PressureLevel; mode: "single" | "panel"; curveballs: boolean }): InterviewState {
  return {
    version: 1,
    phase: "INTRO",
    basePressure: input.pressure,
    currentPressure: input.pressure,
    domain: input.domain,
    type: input.type,
    level: input.level,
    role: input.role,
    mode: input.mode,
    interviewers: input.interviewers,
    plan: buildPlan(input),
    planCursor: 0,
    currentPrimary: null,
    lastQuestion: null,
    followUpDepth: 0,
    coverage: {},
    qualityHistory: [],
    curveballsEnabled: input.curveballs || input.pressure >= 3,
    curveballsUsed: 0,
    memoryCallbacksUsed: 0,
    crossQuestionsUsed: 0,
    answerSeq: 0,
    targetMinutes: input.targetMinutes,
    rngSeed: input.seed,
    closingAsked: false,
  };
}

export function policyFor(state: InterviewState, seat: number): PressurePolicy {
  const iv = state.interviewers.find((i) => i.seat === seat) ?? state.interviewers[0];
  return pressurePolicy(state.currentPressure, PERSONAS[iv.personaId]);
}

// ─── Opening ───────────────────────────────────────────────────────────────

export function openingDecision(state: InterviewState): { decision: Decision; state: InterviewState } {
  const first = state.plan[0];
  const next: InterviewState = { ...state, phase: "QUESTION", planCursor: 1, followUpDepth: 0 };
  return {
    state: next,
    decision: {
      action: "INTRO", intent: "open_interview", kind: "intro", seat: first.seat, competency: first.competency,
      baseQuestion: first.text, claim: null, acknowledgement: "none", preSilenceMs: 0, handoffFromSeat: null,
      avatarCue: "still", pressure: state.currentPressure, reason: "Session start: AI disclosure, introductions, opening question.",
    },
  };
}

// ─── The decision ─────────────────────────────────────────────────────────

export function decide(state: InterviewState, input: AnswerInput): { decision: Decision; state: InterviewState } {
  const rng = mulberry32(state.rngSeed + (state.answerSeq + 1) * 7919);
  const h = input.heuristics;
  const answeringSeat = state.lastQuestion?.seat ?? 0;
  const lastKind = state.lastQuestion?.kind;

  // Book-keeping shared by every branch.
  const competency = state.currentPrimary?.competency ?? "communication";
  const coverage = { ...state.coverage, [competency]: [...(state.coverage[competency] ?? []), h.quality] };
  const qualityHistory = [...state.qualityHistory, h.quality];
  const newPressure = adaptPressure(state.basePressure, state.currentPressure, qualityHistory);
  let s: InterviewState = { ...state, coverage, qualityHistory, currentPressure: newPressure, answerSeq: state.answerSeq + 1, phase: "ANALYZING" };
  const policy = policyFor(s, answeringSeat);
  const persona = PERSONAS[(s.interviewers.find((i) => i.seat === answeringSeat) ?? s.interviewers[0]).personaId];
  const pressureNote = newPressure !== state.currentPressure ? ` Pressure adapted ${state.currentPressure}→${newPressure}.` : "";

  const ack = (): Decision["acknowledgement"] => {
    if (h.quality >= 0.6 && rng() < policy.reassurance) return policy.reassurance > 0.6 ? "warm" : "brief";
    return rng() < policy.reassurance * 0.5 ? "brief" : "none";
  };
  const make = (d: Omit<Decision, "pressure" | "preSilenceMs"> & { preSilenceMs?: number }): Decision => ({
    preSilenceMs: d.preSilenceMs ?? policy.preResponseSilenceMs, pressure: newPressure, ...d, reason: d.reason + pressureNote,
  });
  const elapsedMin = input.elapsedMs / 60000;
  const timeUp = elapsedMin >= s.targetMinutes;

  // 1. Closing sequence.
  if (lastKind === "closing") {
    return finish(s, make({
      action: "COMPLETE", intent: "farewell", kind: "farewell", seat: s.interviewers[0].seat, competency: null,
      baseQuestion: null, claim: null, acknowledgement: "brief", preSilenceMs: 400, handoffFromSeat: null, avatarCue: "nod",
      reason: "Candidate responded to the closing invitation; end the interview.",
    }), "COMPLETE");
  }

  // 2. Interrupted answers get redirected — a pressure event.
  if (input.interrupted) {
    return follow(s, make({
      action: "PRESSURE_EVENT", intent: "redirect_after_interrupt", kind: "pressure", seat: answeringSeat, competency,
      baseQuestion: null, claim: null, acknowledgement: "none", preSilenceMs: 0, handoffFromSeat: null, avatarCue: "lean_in",
      reason: `Interrupted after ${Math.round(input.durationSec)}s (${h.vagueness >= policy.vagueThreshold ? "vague" : "long"} answer at pressure ${newPressure}).`,
    }));
  }

  const canFollow = s.followUpDepth < policy.maxFollowUpDepth && lastKind !== "curveball" && lastKind !== "memory_callback" && !timeUp;
  const sessionClaimsThisAnswer = input.claims.filter((c) => c.answerSeq === s.answerSeq);
  const numericClaim = sessionClaimsThisAnswer.find((c) => (c.kind === "number" || c.kind === "outcome" || c.kind === "team") && c.status === "open");

  if (canFollow) {
    // 3. Very short answer.
    if (h.wordCount < 18) {
      return follow(s, make({
        action: "FOLLOW_UP", intent: "clarify_short", kind: "follow_up", seat: answeringSeat, competency, baseQuestion: null,
        claim: null, acknowledgement: "none", handoffFromSeat: null, avatarCue: newPressure >= 4 ? "still" : "lean_in",
        reason: `Answer too short (${h.wordCount} words) to evaluate.`,
      }));
    }
    // 4. Skeptic challenge of a stated claim (pressure event), or a numeric probe.
    if (numericClaim && rng() < policy.numericProbeRate) {
      const challenge = policy.skepticism >= 0.6 && rng() < policy.skepticism;
      // In a panel the skeptic may cut across with the challenge.
      const skepticSeat = s.interviewers.find((i) => i.panelRole === "skeptic" && i.seat !== answeringSeat)?.seat;
      const cross = challenge && skepticSeat !== undefined && s.crossQuestionsUsed < 3 && rng() < 0.6;
      if (cross) s = { ...s, crossQuestionsUsed: s.crossQuestionsUsed + 1 };
      return follow(s, make({
        action: challenge ? "PRESSURE_EVENT" : "FOLLOW_UP",
        intent: cross ? "cross_question" : challenge ? "challenge_claim" : "probe_number",
        kind: cross ? "cross" : challenge ? "pressure" : "follow_up",
        seat: cross ? skepticSeat! : answeringSeat, competency, baseQuestion: null,
        claim: { id: numericClaim.id, text: numericClaim.text }, acknowledgement: "none",
        handoffFromSeat: cross ? answeringSeat : null, avatarCue: challenge ? "brow_raise" : "lean_in",
        reason: `${cross ? "Skeptic cuts in to test" : challenge ? "Challenging" : "Probing"} the number the candidate gave: "${numericClaim.text}".`,
      }));
    }
    // 5. Vague answer.
    if (h.vagueness >= policy.vagueThreshold) {
      const challenge = rng() < policy.skepticism * 0.6;
      return follow(s, make({
        action: challenge ? "PRESSURE_EVENT" : "FOLLOW_UP", intent: "ask_specifics", kind: challenge ? "pressure" : "follow_up",
        seat: answeringSeat, competency, baseQuestion: null, claim: null, acknowledgement: "none", handoffFromSeat: null,
        avatarCue: challenge ? "brow_raise" : "lean_in",
        reason: `Vagueness ${h.vagueness.toFixed(2)} ≥ threshold ${policy.vagueThreshold.toFixed(2)}.`,
      }));
    }
    // 6. Ownership blurred (no personal action).
    if (!h.star.action && h.wordCount > 40 && persona.specificityDemand >= 0.4) {
      return follow(s, make({
        action: "FOLLOW_UP", intent: "ask_personal_role", kind: "follow_up", seat: answeringSeat, competency, baseQuestion: null,
        claim: null, acknowledgement: ack(), handoffFromSeat: null, avatarCue: "lean_in",
        reason: "No first-person action detected — asking what the candidate personally did.",
      }));
    }
    // 7. No result / outcome stated.
    if (!h.star.result && rng() < 0.4 + policy.skepticism * 0.5) {
      return follow(s, make({
        action: "FOLLOW_UP", intent: "ask_result", kind: "follow_up", seat: answeringSeat, competency, baseQuestion: null,
        claim: null, acknowledgement: ack(), handoffFromSeat: null, avatarCue: "lean_in",
        reason: "Answer has no stated result — asking for the outcome.",
      }));
    }
  }

  // Moving on. Time's up → closing.
  if (timeUp || s.planCursor >= s.plan.length) {
    return closing(s, make, timeUp ? `Target length (${s.targetMinutes} min) reached.` : "Question plan complete.");
  }

  // 8. Memory callback on an earlier claim (not from the answer just given).
  const earlier = input.claims.filter((c) => c.answerSeq < s.answerSeq && (c.status === "open" || c.status === "weak"));
  if (earlier.length && s.memoryCallbacksUsed < 2 && s.answerSeq >= 2 && rng() < 0.3 + policy.skepticism * 0.35) {
    const pick = earlier.find((c) => c.status === "weak") ?? earlier[Math.floor(rng() * earlier.length)];
    return follow({ ...s, memoryCallbacksUsed: s.memoryCallbacksUsed + 1, followUpDepth: policy.maxFollowUpDepth }, make({
      action: "PRESSURE_EVENT", intent: "memory_callback", kind: "memory_callback", seat: answeringSeat, competency,
      baseQuestion: null, claim: { id: pick.id, text: pick.text }, acknowledgement: ack(), handoffFromSeat: null, avatarCue: "gaze_shift",
      reason: `Returning to an earlier ${pick.status === "weak" ? "weak " : ""}claim from answer #${pick.answerSeq}: "${pick.text}".`,
    }));
  }

  // 9. Curveball.
  if (s.curveballsEnabled && s.curveballsUsed < 2 && s.answerSeq >= 2 && rng() < policy.curveballRate + (s.curveballsEnabled && s.basePressure >= 4 ? 0.1 : 0)) {
    const pack = getPack(s.domain);
    const text = pack.curveballs[Math.floor(rng() * pack.curveballs.length)];
    const seat = s.interviewers[Math.floor(rng() * s.interviewers.length)].seat;
    return primary({ ...s, curveballsUsed: s.curveballsUsed + 1 }, make({
      action: "NEXT_QUESTION", intent: "curveball", kind: "curveball", seat, competency: "communication", baseQuestion: text,
      claim: null, acknowledgement: "none", handoffFromSeat: seat !== answeringSeat ? answeringSeat : null, avatarCue: "still",
      reason: "Curveball — unexpected question to test composure.",
    }), false);
  }

  // 10. Next planned question.
  const next = s.plan[s.planCursor];
  return primary({ ...s, planCursor: s.planCursor + 1 }, make({
    action: "NEXT_QUESTION", intent: "ask_primary", kind: "primary", seat: next.seat, competency: next.competency,
    baseQuestion: next.text, claim: null, acknowledgement: ack(), handoffFromSeat: next.seat !== answeringSeat ? answeringSeat : null,
    avatarCue: "nod", reason: `Next planned question (${next.competency}).`,
  }), true);
}

function follow(s: InterviewState, d: Decision) {
  return { decision: d, state: { ...s, phase: (d.action === "PRESSURE_EVENT" ? "PRESSURE_EVENT" : "FOLLOW_UP") as SessionPhase, followUpDepth: s.followUpDepth + 1 } };
}

function primary(s: InterviewState, d: Decision, isPlanned: boolean) {
  return {
    decision: d,
    state: {
      ...s, phase: "NEXT_QUESTION" as SessionPhase, followUpDepth: 0,
      currentPrimary: isPlanned || !s.currentPrimary ? { questionId: "", competency: d.competency ?? "communication", seat: d.seat } : s.currentPrimary,
    },
  };
}

function closing(s: InterviewState, make: (d: Omit<Decision, "pressure" | "preSilenceMs"> & { preSilenceMs?: number }) => Decision, why: string) {
  return {
    decision: make({
      action: "CLOSING", intent: "invite_questions", kind: "closing", seat: s.interviewers[0].seat, competency: null,
      baseQuestion: "What questions do you have for me?", claim: null, acknowledgement: "brief", preSilenceMs: 600,
      handoffFromSeat: null, avatarCue: "nod", reason: `${why} Moving to close.`,
    }),
    state: { ...s, phase: "CLOSING" as SessionPhase, closingAsked: true, followUpDepth: 0 },
  };
}

function finish(s: InterviewState, d: Decision, phase: SessionPhase) {
  return { decision: d, state: { ...s, phase } };
}

/** Called once the question row exists, so later decisions know what was asked. */
export function recordAsked(state: InterviewState, d: Decision, questionId: string): InterviewState {
  const s: InterviewState = { ...state, lastQuestion: { questionId, seat: d.seat, kind: d.kind } };
  if (d.kind === "primary" || d.kind === "intro" || d.kind === "curveball") {
    s.currentPrimary = { questionId, competency: d.competency ?? "communication", seat: d.seat };
  }
  if (s.phase !== "COMPLETE") s.phase = s.phase === "CLOSING" ? "CLOSING" : "LISTENING";
  return s;
}

/** Client-side interruption thresholds for the Room. */
export function listeningPolicy(state: InterviewState) {
  const seat = state.lastQuestion?.seat ?? 0;
  const p = policyFor(state, seat);
  const noInterrupt = state.lastQuestion?.kind === "intro" || state.lastQuestion?.kind === "closing";
  return {
    pressure: state.currentPressure,
    interruptAfterSec: noInterrupt ? null : p.interruptAfterSec,
    vagueInterruptAfterSec: noInterrupt ? null : p.vagueInterruptAfterSec,
    vagueThreshold: p.vagueThreshold,
    stillness: p.stillness,
    reassurance: p.reassurance,
  };
}
