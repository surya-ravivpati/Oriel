import type { VisionSample } from "./read";

/**
 * Posture from on-device pose landmarks — pure maths shared by the Room (live check),
 * the Read (timeline events) and the tests.
 *
 * Every measure is relative to the person's own 2-second calibration and is built so that
 * sitting nearer or farther from the camera can't masquerade as a posture change:
 *  - slouch: drop in (eye line → shoulder line height) ÷ shoulder width. Both lengths shrink
 *    together as you sit back, so the ratio doesn't; a raw height (what this used to be)
 *    read leaning back as slouching.
 *  - lean: the face tracker's own distance estimate against calibration, which head
 *    rotation doesn't change (a face's apparent size does).
 *  - fidget: head-and-shoulder movement per 250 ms sample as a share of shoulder width. On
 *    perfectly still portraits the tracker's own jitter reaches ~0.02.
 * Thresholds are provisional until checked against recordings of real people
 * (docs/validation/camera-report.md).
 */
export const POSTURE_THRESHOLDS = { slouch: 0.2, leanIn: 1.15, leanBack: 0.87, fidget: 0.05, lookDownDeg: 15 } as const;

export type PostureKind = "slouch" | "lean_in" | "lean_back" | "fidget" | "off_frame";
export type PostureEvent = { t: number; kind: PostureKind; durationMs: number };

export const POSTURE_LABEL: Record<PostureKind, string> = {
  slouch: "Slouched", lean_in: "Leaned in", lean_back: "Sat back", fidget: "Restless", off_frame: "Out of frame",
};

type Landmark = { x: number; y: number; visibility?: number };

/** (eye line → shoulder line height) ÷ shoulder width, in pixels so the frame's aspect ratio cancels out. */
export function postureRatio(pose: readonly Landmark[], width: number, height: number): number | null {
  const seen = (i: number) => !!pose[i] && (pose[i].visibility ?? 1) > 0.5;
  // MediaPipe pose: 2/5 = eyes, 11/12 = shoulders. The eye line, not the nose, because the
  // nose tip swings down further when you glance at notes.
  if (!seen(2) || !seen(5) || !seen(11) || !seen(12)) return null;
  const shoulderWidth = Math.hypot((pose[11].x - pose[12].x) * width, (pose[11].y - pose[12].y) * height);
  if (shoulderWidth < 1e-6) return null;
  const eyeY = (pose[2].y + pose[5].y) / 2;
  const shoulderY = (pose[11].y + pose[12].y) / 2;
  return ((shoulderY - eyeY) * height) / shoulderWidth;
}

/** Nose and both shoulders in pixels ([x, y] × 3, NaN when not visible) for frame-to-frame movement. */
export function trackedPoints(pose: readonly Landmark[], width: number, height: number): number[] {
  return [0, 11, 12].flatMap((i) => (pose[i] && (pose[i].visibility ?? 1) > 0.5 ? [pose[i].x * width, pose[i].y * height] : [NaN, NaN]));
}

/**
 * Upper-body movement between two samples as a share of shoulder width. Head and shoulders
 * only — hands are left out because gesturing while you talk isn't restlessness, and
 * off-screen wrists are guesses that jitter. The median point resists one noisy landmark.
 */
export function movement(prev: readonly number[] | null, cur: readonly number[] | null): number | null {
  if (!prev || !cur) return null;
  const shoulderWidth = Math.hypot(cur[2] - cur[4], cur[3] - cur[5]);
  if (!(shoulderWidth > 1)) return null;
  const d: number[] = [];
  for (let i = 0; i + 1 < cur.length; i += 2) {
    const dist = Math.hypot(cur[i] - prev[i], cur[i + 1] - prev[i + 1]);
    if (Number.isFinite(dist)) d.push(dist);
  }
  if (!d.length) return null;
  d.sort((a, b) => a - b);
  return d[Math.floor(d.length / 2)] / shoulderWidth;
}

/**
 * 0..1 drop from the calibrated ratio. Null when it can't be measured, or while the head is
 * tipped down past `lookDownDeg` (positive pitch = down): reading notes isn't slouching.
 */
export function slouchFrom(ratio: number | null, calibrated: number | null, pitchDownDeg: number | null): number | null {
  if (ratio === null || calibrated === null || calibrated <= 0) return null;
  if (pitchDownDeg !== null && pitchDownDeg > POSTURE_THRESHOLDS.lookDownDeg) return null;
  return Math.max(0, Math.min(1, 1 - ratio / calibrated));
}

/** Distance ratio against calibration: >1 = closer to the camera. */
export function leanFrom(distance: number | null, calibrated: number | null): number | null {
  if (distance === null || calibrated === null || distance <= 0 || calibrated <= 0) return null;
  return calibrated / distance;
}

export function postureKind(v: Pick<VisionSample, "face" | "slouch" | "lean" | "motion">): PostureKind | null {
  const T = POSTURE_THRESHOLDS;
  return !v.face ? "off_frame"
    : v.slouch !== null && v.slouch > T.slouch ? "slouch"
    : v.lean !== null && v.lean > T.leanIn ? "lean_in"
    : v.lean !== null && v.lean < T.leanBack ? "lean_back"
    : v.motion !== null && v.motion > T.fidget ? "fidget" : null;
}

/** Runs of the same posture held for at least two seconds. */
export function postureEvents(vision: VisionSample[]): PostureEvent[] {
  const events: PostureEvent[] = [];
  let current = null as { kind: PostureKind; t: number } | null;
  let last = 0;
  const close = (t: number) => {
    if (current && t - current.t >= 2000) events.push({ t: current.t, kind: current.kind, durationMs: t - current.t });
    current = null;
  };
  for (const v of vision) {
    last = v.t;
    const kind = postureKind(v);
    if (kind !== current?.kind) {
      close(v.t);
      if (kind) current = { kind, t: v.t };
    }
  }
  close(last);
  return events.slice(0, 60);
}
