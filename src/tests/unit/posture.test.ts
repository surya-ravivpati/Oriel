import { describe, expect, it } from "vitest";
import { leanFrom, movement, postureEvents, postureKind, postureRatio, slouchFrom, POSTURE_THRESHOLDS } from "@/lib/analysis/posture";
import { computeRead, type AnswerInputRow, type AudioSample, type VisionSample } from "@/lib/analysis/read";

// A head-and-shoulders webcam frame (MediaPipe pose indices: 2/5 eyes, 11/12 shoulders).
const W = 640, H = 480;
function pose({ scale = 1, eyeDrop = 0 } = {}) {
  const pts: { x: number; y: number; visibility: number }[] = Array.from({ length: 17 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
  const at = (x: number, y: number) => ({ x: 0.5 + (x - 0.5) * scale, y: 0.5 + (y - 0.5) * scale, visibility: 0.9 });
  pts[2] = at(0.45, 0.4 + eyeDrop);
  pts[5] = at(0.55, 0.4 + eyeDrop);
  pts[11] = at(0.32, 0.72);
  pts[12] = at(0.68, 0.72);
  return pts;
}

describe("posture measures", () => {
  const upright = postureRatio(pose(), W, H)!;

  it("does not change when you sit back or lean in", () => {
    for (const scale of [0.6, 0.75, 1.25]) expect(postureRatio(pose({ scale }), W, H)).toBeCloseTo(upright, 9);
    // The old measure was the raw eye-to-shoulder height, which shrinks with distance:
    // sitting back to 0.6× read as a 40% slouch.
    const rawHeight = (p: ReturnType<typeof pose>) => (p[11].y + p[12].y) / 2 - (p[2].y + p[5].y) / 2;
    expect(1 - rawHeight(pose({ scale: 0.6 })) / rawHeight(pose())).toBeCloseTo(0.4, 6);
    expect(slouchFrom(postureRatio(pose({ scale: 0.6 }), W, H), upright, 0)).toBeCloseTo(0, 9);
  });

  it("reads a dropped head as a slouch", () => {
    const slouched = slouchFrom(postureRatio(pose({ eyeDrop: 0.08 }), W, H), upright, 0)!; // eye line 25% closer to the shoulders
    expect(slouched).toBeCloseTo(0.25, 6);
    expect(postureKind({ face: true, slouch: slouched, lean: 1, motion: 0 })).toBe("slouch");
  });

  it("ignores frames where the head is tipped down to read notes", () => {
    expect(slouchFrom(postureRatio(pose({ eyeDrop: 0.08 }), W, H), upright, POSTURE_THRESHOLDS.lookDownDeg + 1)).toBeNull();
  });

  it("needs shoulders and eyes in view", () => {
    const hidden = pose();
    hidden[11] = { ...hidden[11], visibility: 0.2 };
    expect(postureRatio(hidden, W, H)).toBeNull();
    expect(slouchFrom(null, upright, 0)).toBeNull();
  });

  it("reads lean from distance against calibration", () => {
    expect(leanFrom(40, 50)).toBeCloseTo(1.25);
    expect(postureKind({ face: true, slouch: 0, lean: leanFrom(40, 50), motion: 0 })).toBe("lean_in");
    expect(postureKind({ face: true, slouch: 0, lean: leanFrom(60, 50), motion: 0 })).toBe("lean_back");
    expect(postureKind({ face: true, slouch: 0.05, lean: 1.02, motion: 0.001 })).toBeNull();
    expect(postureKind({ face: false, slouch: null, lean: null, motion: null })).toBe("off_frame");
  });

  it("only reports postures held for two seconds", () => {
    const at = (t: number, slouch: number): VisionSample => ({ t, face: true, engaged: null, yaw: 0, pitch: 0, lean: 1, slouch, sway: 0.5, motion: 0, brightness: 120 });
    const brief = [0, 250, 500, 750, 1000, 1250, 1500].map((t) => at(t, t >= 250 && t <= 1000 ? 0.3 : 0));
    expect(postureEvents(brief)).toEqual([]);
    const held = Array.from({ length: 20 }, (_, i) => at(i * 250, i >= 2 && i < 16 ? 0.3 : 0));
    expect(postureEvents(held)).toEqual([{ t: 500, kind: "slouch", durationMs: 3500 }]);
  });
});

describe("posture in the Read", () => {
  const answers: AnswerInputRow[] = [{ id: "a1", questionId: "q1", questionText: "Tell me about yourself", questionKind: "intro", questionDifficulty: 1, questionEndMs: 0, text: "I build payment systems and led a rewrite that cut failed checkouts by 30 percent.", startMs: 1000, endMs: 30000, firstWordLatencyMs: 900, interrupted: false }];
  const audio: AudioSample[] = Array.from({ length: 300 }, (_, i) => ({ t: 1000 + i * 100, rms: 0.05, voiced: true, pitch: 130 }));
  const frames = (over: (i: number) => Partial<VisionSample>): VisionSample[] =>
    Array.from({ length: 100 }, (_, i) => ({ t: 1000 + i * 250, face: true, engaged: null, yaw: 0, pitch: 0, lean: 1, slouch: 0, sway: 0.5, motion: 0.004, brightness: 120, ...over(i) }));
  const movementMetric = (vision: VisionSample[]) => computeRead(answers, audio, vision, null, { cameraMetrics: true, gaze: true, posture: true }).metrics.find((m) => m.key === "movement")!;

  it("counts slouches it measured", () => {
    expect(movementMetric(frames((i) => ({ slouch: i >= 40 && i < 60 ? 0.3 : 0.02 }))).note).toMatch(/^1 slouch shift, 0 lean-ins/);
  });

  it("says so instead of reporting zero when slouch and lean weren't measured", () => {
    const note = movementMetric(frames(() => ({ slouch: null, lean: null }))).note;
    expect(note).not.toMatch(/slouch shift/);
    expect(note).toMatch(/weren't measured/);
  });

  it("explains when only the shoulders were missing at calibration", () => {
    expect(movementMetric(frames(() => ({ slouch: null }))).note).toMatch(/shoulders weren't in view during calibration/);
  });
});

describe("restlessness", () => {
  // Nose, left shoulder, right shoulder in pixels.
  const still = [320, 200, 200, 380, 440, 380];
  const shifted = (dx: number, scale = 1) => still.map((v, i) => (i % 2 === 0 ? 320 + (v - 320) * scale + dx : 240 + (v - 240) * scale));

  it("is relative to shoulder width, so distance doesn't change it", () => {
    expect(movement(still, shifted(12))).toBeCloseTo(0.05, 6); // 12 px over a 240 px shoulder width
    expect(movement(shifted(0, 0.5), shifted(6, 0.5))).toBeCloseTo(0.05, 6); // same movement, sitting twice as far
  });

  it("ignores one jittery point", () => {
    const jitter = [...still];
    jitter[0] += 40; // the nose estimate jumps; shoulders hold still
    expect(movement(still, jitter)).toBe(0);
  });

  it("needs two samples with shoulders", () => {
    expect(movement(null, still)).toBeNull();
    expect(movement(still, [320, 200, NaN, NaN, 440, 380])).toBeNull();
  });
});
