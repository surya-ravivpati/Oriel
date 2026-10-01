import type { AudioSample } from "./read";

/**
 * Frame-level voice analysis shared by the browser (MicAnalyzer, 10 Hz) and the
 * offline validation harness — so what we validate is exactly what runs in the Room.
 */
export interface VadState {
  noiseFloor: number;
  voicedRun: number;
  silentRun: number;
  voiced: boolean;
  voiceStartedAt: number;
  lastVoicedAt: number;
  peakDb: number;
}

export function newVadState(): VadState {
  return { noiseFloor: 0.01, voicedRun: 0, silentRun: 0, voiced: false, voiceStartedAt: -1, lastVoicedAt: -1, peakDb: -90 };
}

export function rmsOf(buf: Float32Array) {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  return Math.sqrt(sum / buf.length);
}

/** Autocorrelation pitch estimate in Hz (70–400), or null. */
export function pitchOf(buf: Float32Array, sampleRate: number): number | null {
  const n = buf.length;
  const minLag = Math.floor(sampleRate / 400), maxLag = Math.floor(sampleRate / 70);
  let best = -1, bestLag = -1, energy = 0;
  for (let i = 0; i < n; i++) energy += buf[i] * buf[i];
  if (energy < 1e-4) return null;
  for (let lag = minLag; lag <= maxLag && lag < n; lag++) {
    let c = 0;
    for (let i = 0; i < n - lag; i++) c += buf[i] * buf[i + lag];
    if (c > best) { best = c; bestLag = lag; }
  }
  const norm = best / energy;
  return norm > 0.45 && bestLag > 0 ? Math.round(sampleRate / bestLag) : null;
}

/**
 * Process one 100 ms analysis frame. Adaptive noise floor (fast down, slow up),
 * hysteresis of 2 frames on / 3 frames off, first-voice time back-dated by 200 ms.
 */
export function analyzeFrame(buf: Float32Array, sampleRate: number, t: number, st: VadState, muted = false): AudioSample {
  const rms = muted ? 0 : rmsOf(buf);
  st.noiseFloor = rms < st.noiseFloor ? st.noiseFloor * 0.9 + rms * 0.1 : st.noiseFloor * 0.998 + rms * 0.002;
  const threshold = Math.max(st.noiseFloor * 3, 0.012);
  if (rms > threshold) { st.voicedRun++; st.silentRun = 0; } else { st.silentRun++; st.voicedRun = 0; }
  if (!st.voiced && st.voicedRun >= 2) { st.voiced = true; st.voiceStartedAt = t - 200; }
  if (st.voiced && st.silentRun >= 3) st.voiced = false;
  if (st.voiced) st.lastVoicedAt = t;
  if (rms > 0) st.peakDb = Math.max(st.peakDb, 20 * Math.log10(rms));
  // Pitch only on frames that are loud enough to be speech — not on the quiet tail frames
  // the hysteresis still counts as voiced (those produce spurious harmonics).
  const pitch = st.voiced && rms > threshold ? pitchOf(buf, sampleRate) : null;
  return { t: Math.round(t), rms: Math.round(rms * 10000) / 10000, voiced: st.voiced, pitch };
}

/** Run the analyser over a whole PCM clip (mono float32) at 10 Hz with a 2048-sample window. */
export function analyzeClip(pcm: Float32Array, sampleRate: number, windowSize = 2048): { samples: AudioSample[]; state: VadState } {
  const st = newVadState();
  const samples: AudioSample[] = [];
  const hop = Math.round(sampleRate / 10);
  for (let end = windowSize; end <= pcm.length; end += hop) {
    const t = (end / sampleRate) * 1000;
    samples.push(analyzeFrame(pcm.subarray(end - windowSize, end), sampleRate, t, st));
  }
  return { samples, state: st };
}
