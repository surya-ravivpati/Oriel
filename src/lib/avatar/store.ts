import type { AvatarCue, AvatarSeatConfig, AvatarState } from "./types";

/**
 * Mutable avatar state read every animation frame (not React state — no re-renders).
 */
export class AvatarStore {
  mode: AvatarState = "idle";
  modeSince = 0;
  activeSeat = 0;
  seats: AvatarSeatConfig[] = [];
  pressure = 2;
  stillness = 0.3;
  cue: { kind: AvatarCue; at: number; seat: number } | null = null;
  /** Current interviewer voice level 0..1 (from the audio analyser or a synthetic driver). */
  level: () => number = () => 0;
  /** Candidate is speaking right now (drives listening reactions). */
  candidateSpeaking = false;
  private listeners = new Set<() => void>();

  now() {
    return typeof performance !== "undefined" ? performance.now() / 1000 : 0;
  }

  setMode(mode: AvatarState, seat?: number) {
    if (seat !== undefined) this.activeSeat = seat;
    if (mode !== this.mode) {
      this.mode = mode;
      this.modeSince = this.now();
      this.emit();
    }
  }

  fireCue(kind: AvatarCue, seat = this.activeSeat) {
    this.cue = { kind, at: this.now(), seat };
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const l of this.listeners) l();
  }
}
