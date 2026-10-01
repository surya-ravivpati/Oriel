import type { AudioChunk, AvatarCue, AvatarProvider, AvatarSession, AvatarSessionConfig, AvatarState } from "./types";
import { AvatarStore } from "./store";
import { InterviewerAudio } from "./audio";

/**
 * On-device interviewer. Audio is played locally through WebAudio and the WebGL face
 * lip-syncs from the output level. No video leaves or enters the network.
 */
export class LocalAvatarProvider implements AvatarProvider {
  readonly id = "local";
  readonly store = new AvatarStore();
  audio: InterviewerAudio | null = null;

  async createSession(config: AvatarSessionConfig): Promise<AvatarSession> {
    this.audio = new InterviewerAudio();
    await this.audio.resume();
    this.store.seats = config.seats;
    this.store.pressure = config.pressure;
    this.store.stillness = config.stillness;
    this.store.level = () => this.audio?.level() ?? 0;
    return { id: `local-${Date.now()}`, provider: this.id, config };
  }

  async sendAudio(_session: AvatarSession, audio: AudioChunk) {
    this.audio?.enqueuePcm(audio.pcmBase64, audio.sampleRate);
  }

  async setState(_session: AvatarSession, state: AvatarState, opts: { seat?: number; cue?: AvatarCue } = {}) {
    this.store.setMode(state, opts.seat);
    if (opts.cue) this.store.fireCue(opts.cue, opts.seat);
  }

  async endSession() {
    this.audio?.close();
    this.audio = null;
    this.store.setMode("idle");
  }
}
