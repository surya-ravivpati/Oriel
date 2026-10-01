import type { Persona } from "./personas";

/**
 * The pressure engine. A pressure level (1..5) plus the interviewer persona produce a
 * concrete behaviour policy. Every field here is consumed by real code:
 *  - the controller (follow-up depth, vagueness tolerance, numeric probing, curveballs)
 *  - the Room client (interrupt timers, pre-question silence)
 *  - the avatar (reassurance, stillness, eye contact)
 */
export type PressureLevel = 1 | 2 | 3 | 4 | 5;

export const PRESSURE_LABELS: Record<PressureLevel, string> = {
  1: "Warm-up",
  2: "Realistic",
  3: "Challenging",
  4: "High Pressure",
  5: "Stress Test",
};

export const PRESSURE_DESCRIPTIONS: Record<PressureLevel, string> = {
  1: "Patient interviewer, gentle follow-ups, no interruptions.",
  2: "Like a typical first-round interview. Follow-ups when answers are thin.",
  3: "Deeper follow-ups, tests your numbers, less reassurance.",
  4: "Interrupts long answers, holds silence, challenges vague claims.",
  5: "Cuts in early, pushes on every claim, adds curveballs. Built to rattle you.",
};

export interface PressurePolicy {
  level: PressureLevel;
  /** Interrupt an answer that runs past this many seconds (null = never). */
  interruptAfterSec: number | null;
  /** Interrupt earlier if the running answer is vague for this many seconds (null = never). */
  vagueInterruptAfterSec: number | null;
  /** Deliberate silence before the interviewer speaks after an answer. */
  preResponseSilenceMs: number;
  /** Max follow-ups on one primary question before moving on. */
  maxFollowUpDepth: number;
  /** 0..1 — how readily a vague/unsupported answer triggers a challenge. */
  skepticism: number;
  /** 0..1 — probability of probing a number the candidate stated. */
  numericProbeRate: number;
  /** Vagueness score (0..1) at or above which the answer counts as vague. */
  vagueThreshold: number;
  /** 0..1 — probability of an unexpected question when moving on. */
  curveballRate: number;
  /** 0..1 — how often the interviewer offers reassurance ("That's helpful."). */
  reassurance: number;
  /** Avatar stillness 0..1 (higher = fewer movements, longer eye contact). */
  stillness: number;
}

const BASE: Record<PressureLevel, Omit<PressurePolicy, "level">> = {
  1: { interruptAfterSec: null, vagueInterruptAfterSec: null, preResponseSilenceMs: 300, maxFollowUpDepth: 1, skepticism: 0.15, numericProbeRate: 0.1, vagueThreshold: 0.8, curveballRate: 0, reassurance: 0.9, stillness: 0.1 },
  2: { interruptAfterSec: 180, vagueInterruptAfterSec: null, preResponseSilenceMs: 500, maxFollowUpDepth: 1, skepticism: 0.35, numericProbeRate: 0.3, vagueThreshold: 0.65, curveballRate: 0.05, reassurance: 0.6, stillness: 0.3 },
  3: { interruptAfterSec: 120, vagueInterruptAfterSec: 75, preResponseSilenceMs: 900, maxFollowUpDepth: 2, skepticism: 0.55, numericProbeRate: 0.5, vagueThreshold: 0.55, curveballRate: 0.12, reassurance: 0.35, stillness: 0.5 },
  4: { interruptAfterSec: 90, vagueInterruptAfterSec: 45, preResponseSilenceMs: 1800, maxFollowUpDepth: 3, skepticism: 0.75, numericProbeRate: 0.7, vagueThreshold: 0.45, curveballRate: 0.2, reassurance: 0.15, stillness: 0.7 },
  5: { interruptAfterSec: 60, vagueInterruptAfterSec: 30, preResponseSilenceMs: 3000, maxFollowUpDepth: 3, skepticism: 0.92, numericProbeRate: 0.9, vagueThreshold: 0.35, curveballRate: 0.35, reassurance: 0.05, stillness: 0.9 },
};

const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));

export function clampPressure(n: number): PressureLevel {
  return Math.round(Math.min(5, Math.max(1, n))) as PressureLevel;
}

/** Combine a pressure level with a persona's temperament into one policy. */
export function pressurePolicy(level: PressureLevel, persona?: Persona): PressurePolicy {
  const b = BASE[level];
  if (!persona) return { level, ...b };
  // Persona shifts the policy by up to ±20% around the level; the level dominates.
  const interruptScale = 1.2 - persona.interruptionRate * 0.4; // high interrupter → earlier
  return {
    level,
    interruptAfterSec: b.interruptAfterSec === null ? (persona.interruptionRate > 0.4 && level >= 2 ? 150 : null) : Math.round(b.interruptAfterSec * interruptScale),
    vagueInterruptAfterSec: b.vagueInterruptAfterSec === null ? null : Math.round(b.vagueInterruptAfterSec * interruptScale),
    preResponseSilenceMs: Math.round(b.preResponseSilenceMs * (0.7 + persona.silenceTolerance * 0.6)),
    maxFollowUpDepth: b.maxFollowUpDepth + (persona.specificityDemand > 0.8 && level >= 3 ? 1 : 0),
    skepticism: clamp(b.skepticism * 0.75 + persona.skepticism * 0.25),
    numericProbeRate: clamp(b.numericProbeRate * 0.8 + persona.specificityDemand * 0.2),
    vagueThreshold: clamp(b.vagueThreshold + (0.5 - persona.specificityDemand) * 0.15),
    curveballRate: b.curveballRate,
    reassurance: clamp(b.reassurance * 0.7 + persona.warmth * 0.3 * (level <= 2 ? 1 : 0.4)),
    stillness: clamp(b.stillness * 0.7 + (1 - persona.expressiveness) * 0.3),
  };
}

/**
 * Adaptive pressure: the interviewer reads the candidate. Strong, specific answers
 * earn a harder interviewer (up to base+1); repeated struggle at the gentler levels
 * eases off one notch. Stress Test never eases.
 */
export function adaptPressure(base: PressureLevel, current: PressureLevel, recentQuality: number[]): PressureLevel {
  const window = recentQuality.slice(-3);
  if (window.length < 2) return current;
  const avg = window.reduce((a, b) => a + b, 0) / window.length;
  if (avg >= 0.72 && current < Math.min(5, base + 1)) return clampPressure(current + 1);
  if (avg <= 0.3 && base <= 3 && current > Math.max(1, base - 1)) return clampPressure(current - 1);
  if (avg > 0.3 && avg < 0.72 && current !== base) return clampPressure(current + Math.sign(base - current));
  return current;
}
