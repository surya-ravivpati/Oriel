import { describe, expect, it } from "vitest";
import { candidateMoments, computeRead, findPauses, selectMoments, type AnswerInputRow, type AudioSample, type VisionSample } from "@/lib/analysis/read";

function audio(from: number, to: number, silentRanges: [number, number][] = []): AudioSample[] {
  const out: AudioSample[] = [];
  for (let t = from; t <= to; t += 100) {
    const silent = silentRanges.some(([a, b]) => t >= a && t < b);
    out.push({ t, rms: silent ? 0.001 : 0.05, voiced: !silent, pitch: silent ? null : 120 + 30 * Math.sin(t / 700) });
  }
  return out;
}

const answers: AnswerInputRow[] = [
  { id: "a1", questionId: "q1", questionText: "Tell me about yourself", questionKind: "intro", questionDifficulty: 1, questionEndMs: 4000, text: "I'm a backend engineer with six years at two startups. I led the payments rewrite at my last company, and as a result we cut failed checkouts by 30 percent in 2023.", startMs: 5000, endMs: 20000, firstWordLatencyMs: 1000, interrupted: false },
  { id: "a2", questionId: "q2", questionText: "What are your salary expectations?", questionKind: "follow_up", questionDifficulty: 3, questionEndMs: 30000, text: "Um, I think, uh, maybe, like, I'm not sure, I guess it kind of depends, um, on the whole package and things, uh, you know, and various stuff like that really.", startMs: 34800, endMs: 50000, firstWordLatencyMs: 4800, interrupted: false },
];

describe("the Read", () => {
  const a = [...audio(5000, 20000), ...audio(34800, 50000, [[40000, 43000]])];
  const vision: VisionSample[] = Array.from({ length: 80 }, (_, i) => ({ t: 5000 + i * 600, face: true, engaged: i % 3 === 0 ? 0.2 : 0.8, yaw: 0, pitch: 0, lean: 1, slouch: 0.1, sway: 0.5 + (i % 5) * 0.002, motion: 0.005, brightness: 120 }));
  const { metrics, per } = computeRead(answers, a, vision, { brightness: 50, faceX: 0.5, faceY: 0.45, faceSize: 0.2, micLevelDb: -20, noiseFloorDb: -60 }, { cameraMetrics: true, gaze: true, posture: true });
  const m = (k: string) => metrics.find((x) => x.key === k)!;

  it("reports high-confidence speech metrics", () => {
    expect(m("pace_wpm").confidence).toBe("high");
    expect(m("filler_per_min").value).toBeGreaterThan(5);
    expect(m("hedges_per_min").value).toBeGreaterThan(0);
  });
  it("finds pauses from the audio timeline", () => {
    expect(findPauses(a, 34800, 50000).some((p) => p.durationMs >= 2900)).toBe(true);
  });
  it("labels camera engagement as an estimate with medium confidence", () => {
    expect(m("camera_engagement").confidence).toBe("medium");
    expect(m("camera_engagement").unit).toContain("estimated");
    expect(m("camera_engagement").low).toBeLessThan(m("camera_engagement").value!);
  });
  it("flags setup issues it can observe", () => {
    expect(m("setup").note).toMatch(/dim/);
  });
  it("omits camera metrics entirely when disabled", () => {
    const r = computeRead(answers, a, vision, null, { cameraMetrics: false, gaze: false, posture: false });
    expect(r.metrics.find((x) => x.key === "camera_engagement")).toBeUndefined();
    expect(r.metrics.find((x) => x.key === "movement")).toBeUndefined();
  });
  it("selects the salary moment with timestamp evidence", () => {
    const moments = selectMoments(candidateMoments(per, { cameraMetrics: true, gaze: true, posture: true }), 5);
    const salary = moments.find((x) => x.answerId === "a2")!;
    expect(salary).toBeDefined();
    expect(salary.evidence).toMatch(/4\.8 seconds|filler|hedges/);
    expect(salary.startMs).toBeLessThan(34800);
  });
  it("never produces emotion or appearance metrics", () => {
    for (const x of metrics) expect(x.key).not.toMatch(/(^|_)(emotion|attractiveness|age|accent|beauty|personality)(_|$)/);
  });
});
