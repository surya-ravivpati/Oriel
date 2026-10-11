"use client";

import { InterviewerAudio, speakWithBrowser } from "@/lib/avatar/audio";
import { AvatarStore } from "@/lib/avatar/store";
import { LiveTranscriber } from "@/features/room/engine/speech";
import { AnswerRecorder, pickMime } from "@/features/room/engine/recorder";
import { readNdjson } from "@/features/room/engine/stream";
import type { RoomEvent } from "@/server/interview/service";

/*
 * Voice for a practice loop: the interviewer speaks the question (server voice, or the browser's
 * if that isn't available) with its face moving to the sound, and an answer can be given out
 * loud: recorded, captioned live, then transcribed on the server when that's configured. The
 * transcript is handed back for the person to read and correct before it is submitted; the
 * audio itself is never stored.
 */
export class TrainingVoice {
  readonly store = new AvatarStore();
  private audio: InterviewerAudio | null = null;
  private stream: MediaStream | null = null;
  private rec: AnswerRecorder | null = null;
  private tx: LiveTranscriber | null = null;
  private speaking: AbortController | null = null;

  constructor(private loopId: string) {
    this.store.stillness = 0.4;
    this.store.pressure = 2;
    this.store.setMode("idle", 0);
  }

  static canRecord() {
    return typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && !!pickMime(false);
  }

  /** Must first be called from a click (browsers only allow sound after a gesture). */
  private ensureAudio() {
    if (!this.audio) {
      this.audio = new InterviewerAudio();
      this.store.setLevel(() => this.audio?.level() ?? 0);
    }
    return this.audio;
  }

  /** Speak the current question. Resolves when it has been said (or was stopped). */
  async speakQuestion(text: string): Promise<void> {
    this.stopSpeaking();
    const audio = this.ensureAudio();
    const ctl = new AbortController();
    this.speaking = ctl;
    this.store.setMode("speaking");
    let spoke = false;
    try {
      const res = await fetch(`/api/training/${this.loopId}/speak`, { method: "POST", signal: ctl.signal });
      if (res.ok) {
        let started = false;
        await readNdjson<RoomEvent>(res, (ev) => {
          if (ctl.signal.aborted) return;
          if (ev.type === "audio") {
            if (!started) { audio.beginUtterance(); started = true; }
            audio.enqueuePcm(ev.pcm, ev.sampleRate);
            spoke = true;
          } else if (ev.type === "audio_end") audio.endUtterance();
        });
        if (spoke && !ctl.signal.aborted) await audio.waitForEnd();
      }
    } catch { /* stopped, or offline: fall back below */ }
    if (!spoke && !ctl.signal.aborted) await speakWithBrowser(text, { audio });
    if (this.speaking === ctl) {
      this.speaking = null;
      this.store.setMode("listening");
    }
  }

  stopSpeaking() {
    this.speaking?.abort();
    this.speaking = null;
    this.audio?.stop();
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }

  /** Start recording an answer; live captions go to `onText`. Throws if the microphone is refused. */
  async startAnswer(onText: (t: string) => void) {
    this.stopSpeaking();
    this.stream ??= await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    this.rec = new AnswerRecorder();
    this.rec.start(this.stream);
    if (LiveTranscriber.supported()) {
      this.tx = new LiveTranscriber();
      this.tx.onUpdate = onText;
      this.tx.start();
    }
    this.store.setMode("listening");
    this.store.candidateSpeaking = true;
  }

  /** Stop recording and return the best transcript: the server's when it has one, else the live captions. */
  async finishAnswer(): Promise<{ text: string; source: "server" | "live" | "none" }> {
    this.store.candidateSpeaking = false;
    this.store.setMode("thinking");
    const live = (await this.tx?.stop()) ?? "";
    this.tx = null;
    const blob = await this.rec?.stop();
    this.rec = null;
    this.release();
    if (blob && blob.size > 1000) {
      try {
        const res = await fetch(`/api/training/${this.loopId}/transcribe`, { method: "POST", headers: { "content-type": blob.type.split(";")[0] }, body: blob });
        if (res.ok) {
          const t = ((await res.json()) as { text: string }).text?.trim() ?? "";
          // Trust the server transcript unless it is far shorter than what was captioned live.
          if (t && t.split(/\s+/).length >= live.split(/\s+/).filter(Boolean).length * 0.5) return { text: t, source: "server" };
        }
      } catch { /* keep the live captions */ }
    }
    this.store.setMode("listening");
    return { text: live, source: live ? "live" : "none" };
  }

  cancelAnswer() {
    this.tx?.abort();
    this.tx = null;
    void this.rec?.stop();
    this.rec = null;
    this.release();
    this.store.candidateSpeaking = false;
    this.store.setMode("listening");
  }

  private release() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  dispose() {
    this.stopSpeaking();
    this.cancelAnswer();
    this.audio?.close();
    this.audio = null;
  }
}
