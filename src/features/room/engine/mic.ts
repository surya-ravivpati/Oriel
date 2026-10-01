import type { AudioSample } from "@/lib/analysis/read";
import { analyzeFrame, newVadState, type VadState } from "@/lib/analysis/audio-frames";

/**
 * Microphone analysis at 10 Hz: loudness, voice activity (adaptive noise floor) and
 * pitch. Drives endpointing, first-word latency and the Read's pause and vocal-variety
 * measurements. The per-frame maths lives in lib/analysis/audio-frames (shared with
 * the validation harness). Audio itself is not stored by this class.
 */
export class MicAnalyzer {
  private analyser: AnalyserNode;
  private source: MediaStreamAudioSourceNode;
  private buf: Float32Array<ArrayBuffer>;
  private timer: ReturnType<typeof setInterval> | null = null;
  private st: VadState = newVadState();
  samples: AudioSample[] = [];
  level = 0;
  muted = false;

  constructor(private ctx: AudioContext, stream: MediaStream, private clock: () => number) {
    this.source = ctx.createMediaStreamSource(stream);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.source.connect(this.analyser);
    this.buf = new Float32Array(this.analyser.fftSize);
  }

  get voiced() { return this.st.voiced; }
  get lastVoicedAt() { return this.st.lastVoicedAt; }
  get voiceStartedAt() { return this.st.voiceStartedAt; }
  get peakDb() { return this.st.peakDb; }

  start() {
    this.stop();
    this.timer = setInterval(() => this.tick(), 100);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private tick() {
    this.analyser.getFloatTimeDomainData(this.buf);
    const sample = analyzeFrame(this.buf, this.ctx.sampleRate, this.clock(), this.st, this.muted);
    this.level = Math.min(1, sample.rms * 8);
    this.samples.push(sample);
  }

  get noiseFloorDb() {
    return this.st.noiseFloor > 0 ? Math.round(20 * Math.log10(this.st.noiseFloor)) : -90;
  }

  drain(): AudioSample[] {
    return this.samples.splice(0);
  }

  close() {
    this.stop();
    this.source.disconnect();
  }
}
