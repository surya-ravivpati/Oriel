import { describe, expect, it } from "vitest";
import { analyzeClip } from "@/lib/analysis/audio-frames";
import { findPauses } from "@/lib/analysis/read";
import { consentTextHash } from "@/lib/privacy/consent-hash";

function tone(sr: number, spec: [number, boolean][]): Float32Array {
  const total = spec.reduce((a, [ms]) => a + Math.round((ms / 1000) * sr), 0);
  const out = new Float32Array(total);
  let i = 0;
  for (const [ms, on] of spec) {
    const n = Math.round((ms / 1000) * sr);
    for (let k = 0; k < n; k++, i++) out[i] = on ? 0.25 * Math.sin((2 * Math.PI * 140 * i) / sr) : 0.0005 * Math.sin(i);
  }
  return out;
}

describe("shared frame analysis (browser + validation harness)", () => {
  const sr = 24000;
  const clip = tone(sr, [[1500, false], [2000, true], [1200, false], [1500, true], [800, false]]);
  const { samples } = analyzeClip(clip, sr);

  it("finds the first word within 250 ms of truth", () => {
    const first = samples.find((s) => s.voiced)!;
    expect(Math.abs(first.t - 200 - 1500)).toBeLessThan(250);
  });
  it("measures the inserted pause", () => {
    const start = samples.find((s) => s.voiced)!.t;
    const end = [...samples].reverse().find((s) => s.voiced)!.t;
    const pauses = findPauses(samples, start, end);
    expect(pauses).toHaveLength(1);
    expect(Math.abs(pauses[0].durationMs - 1200)).toBeLessThan(350);
  });
  it("tracks pitch on voiced frames", () => {
    const pitches = samples.filter((s) => s.voiced && s.pitch).map((s) => s.pitch!);
    expect(pitches.length).toBeGreaterThan(10);
    for (const p of pitches) expect(Math.abs(p - 140)).toBeLessThan(15);
  });
});

describe("consent records", () => {
  it("hashes the exact wording, and the camera release includes the signature text", () => {
    const a = consentTextHash("camera_metrics");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(consentTextHash("camera"));
    expect(consentTextHash("unknown-kind")).toBeNull();
  });
});
