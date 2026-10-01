/**
 * Avatar provider contract (client side). The Room talks only to this interface.
 * A provider receives the interviewer's audio and renders a face that speaks it.
 *  - LocalAvatarProvider: on-device WebGL interviewer (default, no per-minute cost)
 *  - ExternalAvatarProvider: managed real-time avatar vendor over WebRTC (needs server credentials)
 */
import type { AvatarStyle } from "./style";

export type AvatarState = "idle" | "listening" | "thinking" | "speaking" | "interrupting";
export type AvatarCue = "nod" | "still" | "brow_raise" | "lean_in" | "gaze_shift";

export interface AvatarSeatConfig {
  seat: number;
  personaId: string;
  name: string;
  accent: string;
  expressiveness: number;
  warmth: number;
  skepticism: number;
  /** The person's own look for this interviewer (shape, colour, accessory, name); defaults per persona. */
  style?: Partial<AvatarStyle> | null;
}

export interface AvatarSessionConfig {
  seats: AvatarSeatConfig[];
  pressure: number;
  stillness: number;
  /** Where the recording mix should receive interviewer audio. */
  recordingDestination?: MediaStreamAudioDestinationNode | null;
}

export interface AudioChunk { pcmBase64: string; sampleRate: number }

export interface AvatarSession {
  id: string;
  provider: string;
  config: AvatarSessionConfig;
}

export interface AvatarProvider {
  readonly id: string;
  createSession(config: AvatarSessionConfig): Promise<AvatarSession>;
  sendAudio(session: AvatarSession, audio: AudioChunk): Promise<void>;
  setState(session: AvatarSession, state: AvatarState, opts?: { seat?: number; cue?: AvatarCue }): Promise<void>;
  endSession(session: AvatarSession): Promise<void>;
}
