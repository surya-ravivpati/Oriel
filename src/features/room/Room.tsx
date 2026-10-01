"use client";

import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { BotAvatar } from "@/components/avatar/BotAvatar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/components/ui/cn";
import { LogoMark } from "@/components/ui/Logo";
import { LocalAvatarProvider } from "@/lib/avatar/local-provider";
import { ExternalAvatarProvider } from "@/lib/avatar/external-provider";
import type { AvatarSeatConfig, AvatarSession } from "@/lib/avatar/types";
import { ConsentDialog, type ConsentChoices } from "./ConsentDialog";
import { RoomController, type RoomUiState } from "./engine/controller";
import { LiveTranscriber } from "./engine/speech";
import { VisionTracker } from "./engine/vision";
import { postureKind, type PostureKind } from "@/lib/analysis/posture";
import { callName } from "@/lib/avatar/style";

export interface RoomProps {
  sessionId: string;
  resuming: boolean;
  seats: (AvatarSeatConfig & { title: string })[];
  pressure: number;
  stillness: number;
  role: string;
  targetMinutes: number;
  privacy: { recordVideo: boolean; cameraMetrics: boolean; posture: boolean };
  serverStt: boolean;
}

type Stage = "consent" | "check" | "entering" | "live" | "ending";

const LIVE_POSTURE: Record<PostureKind | "upright", string> = {
  upright: "Upright", slouch: "Slouching", lean_in: "Leaning in", lean_back: "Sitting back", fidget: "Moving a lot", off_frame: "Face not in view",
};

/** A rendering failure falls back to the voice-only interviewer instead of breaking the Room. */
class AvatarBoundary extends Component<{ fallback: ReactNode; onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function Room(props: RoomProps) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("consent");
  const [consent, setConsent] = useState<ConsentChoices | null>(null);
  const [devices, setDevices] = useState<{ mic: MediaStream | null; cam: MediaStream | null; micError: string | null; camError: string | null } | null>(null);
  const [ui, setUi] = useState<RoomUiState | null>(null);
  const [voiceOnly, setVoiceOnly] = useState(false);
  const [captions, setCaptions] = useState(false);
  const [muted, setMuted] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [typed, setTyped] = useState("");
  const [calib, setCalib] = useState<"idle" | "running" | "done" | "failed" | "unavailable">("idle");
  const [visionReady, setVisionReady] = useState(false);
  const [postureReady, setPostureReady] = useState(false);
  const [livePosture, setLivePosture] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const provider = useMemo(() => new LocalAvatarProvider(), []);
  const controller = useRef<RoomController | null>(null);
  const avatarSession = useRef<AvatarSession | null>(null);
  const vision = useRef<VisionTracker | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const checkVideoRef = useRef<HTMLVideoElement>(null);
  // Hidden, always-mounted element that on-device vision reads from (survives stage changes).
  const analysisVideoRef = useRef<HTMLVideoElement>(null);
  const [micLevel, setMicLevel] = useState(0);

  // ─── Consent → devices ──────────────────────────────────────────────────
  async function onConsent(c: ConsentChoices, version: string, signature: string | null) {
    setConsent(c);
    void fetch(`/api/sessions/${props.sessionId}/consent`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ version, signature: signature ?? undefined, consents: [
        { kind: "ai_disclosure", granted: true }, { kind: "microphone", granted: c.microphone }, { kind: "camera", granted: c.camera },
        { kind: "recording", granted: c.recording }, { kind: "camera_metrics", granted: c.cameraMetrics },
      ] }),
    });
    const res: { mic: MediaStream | null; cam: MediaStream | null; micError: string | null; camError: string | null } = { mic: null, cam: null, micError: null, camError: null };
    if (c.microphone) {
      try {
        res.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      } catch (e) {
        res.micError = e instanceof DOMException && e.name === "NotAllowedError" ? "Microphone access was blocked." : "No microphone was found.";
      }
    }
    if (c.camera) {
      try {
        res.cam = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } });
      } catch (e) {
        res.camError = e instanceof DOMException && e.name === "NotAllowedError" ? "Camera access was blocked." : "No camera was found.";
      }
    }
    setDevices(res);
    setStage("check");
    if (res.cam && c.cameraMetrics) {
      const v = new VisionTracker();
      vision.current = v;
      void v.init().then((ok) => { setVisionReady(ok); if (!ok) setCalib("unavailable"); });
    }
  }

  useEffect(() => {
    const cam = devices?.cam;
    for (const el of [checkVideoRef.current, videoRef.current, analysisVideoRef.current]) if (el && cam && el.srcObject !== cam) { el.srcObject = cam; void el.play().catch(() => {}); }
  }, [devices, stage]);

  // Mic meter during the check.
  useEffect(() => {
    if (stage !== "check" || !devices?.mic) return;
    const ctx = new AudioContext();
    const an = ctx.createAnalyser();
    ctx.createMediaStreamSource(devices.mic).connect(an);
    const buf = new Float32Array(an.fftSize);
    const id = setInterval(() => {
      an.getFloatTimeDomainData(buf);
      let s = 0;
      for (const x of buf) s += x * x;
      setMicLevel(Math.min(1, Math.sqrt(s / buf.length) * 8));
    }, 80);
    return () => { clearInterval(id); void ctx.close(); };
  }, [stage, devices]);

  async function calibrate() {
    if (!vision.current || !analysisVideoRef.current) return;
    setCalib("running");
    const ok = await vision.current.calibrate(analysisVideoRef.current);
    setPostureReady(ok && vision.current.postureReady);
    setCalib(ok ? "done" : "failed");
  }

  // Live posture readout during the check, so people can see what will be measured.
  // Same code and thresholds as the interview; nothing here is sent or stored.
  useEffect(() => {
    const v = vision.current, el = analysisVideoRef.current;
    if (stage !== "check" || calib !== "done" || !postureReady || !props.privacy.posture || !v || !el) return;
    const recent: string[] = [];
    const id = setInterval(() => {
      const f = v.analyze(el);
      if (!f) return;
      const s = v.toSample(f, 0);
      recent.push(!s.face ? LIVE_POSTURE.off_frame : s.sway === null ? "Shoulders out of view" : s.slouch === null ? "Looking down" : LIVE_POSTURE[postureKind(s) ?? "upright"]);
      if (recent.length > 4) recent.shift();
      // Show what held for most of the last second, so tracker jitter doesn't flicker the label.
      const counts = new Map<string, number>();
      for (const r of recent) counts.set(r, (counts.get(r) ?? 0) + 1);
      setLivePosture([...counts].sort((a, b) => b[1] - a[1])[0][0]);
    }, 250);
    return () => clearInterval(id);
  }, [stage, calib, postureReady, props.privacy.posture]);

  // ─── Enter the Room ─────────────────────────────────────────────────────
  const enter = useCallback(async () => {
    if (!consent || !devices) return;
    setStage("entering");
    // Prefer a managed avatar vendor when configured; the on-device interviewer is the fallback.
    try {
      await new ExternalAvatarProvider().createSession({ seats: props.seats, pressure: props.pressure, stillness: props.stillness });
    } catch { /* not configured → local */ }
    avatarSession.current = await provider.createSession({ seats: props.seats, pressure: props.pressure, stillness: props.stillness });
    const sttMode = !devices.mic ? "none" : LiveTranscriber.supported() ? "browser" : props.serverStt ? "server" : "none";
    const c = new RoomController({
      sessionId: props.sessionId, provider, avatarSession: avatarSession.current,
      micStream: devices.mic, cameraStream: devices.cam, record: consent.recording,
      vision: consent.cameraMetrics && visionReady ? vision.current : null, videoEl: analysisVideoRef.current,
      sttMode, onState: setUi, onEnded: () => router.push(`/playback/${props.sessionId}?processing=1`),
    });
    if (sttMode === "none") c.switchToText();
    controller.current = c;
    await new Promise((r) => setTimeout(r, 900)); // let the room light up before the first word
    setStage("live");
    void c.start();
  }, [consent, devices, props, provider, router, visionReady]);

  useEffect(() => {
    if (stage !== "live") return;
    const t0 = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - t0), 1000);
    return () => clearInterval(id);
  }, [stage]);

  // Keyboard: Space = done answering (when not typing), M = mute.
  useEffect(() => {
    if (stage !== "live") return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") return;
      if (e.code === "Space" && ui?.phase === "listening" && ui.inputMode === "voice") { e.preventDefault(); void controller.current?.finishAnswer(false); }
      if (e.key === "m") toggleMute();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Leaving mid-interview (reload, closed tab) keeps the session live so it can be
  // rejoined; the server finalises abandoned sessions after 30 idle minutes.

  useEffect(() => () => {
    devices?.mic?.getTracks().forEach((t) => t.stop());
    devices?.cam?.getTracks().forEach((t) => t.stop());
    vision.current?.close();
  }, [devices]);

  function toggleMute() {
    const m = !muted;
    setMuted(m);
    controller.current?.setMuted(m);
  }

  async function endNow() {
    setConfirmEnd(false);
    setStage("ending");
    await controller.current?.end("ended_early");
  }

  const phase = ui?.phase;
  const active = props.seats.find((s) => s.seat === (ui?.activeSeat ?? 0)) ?? props.seats[0];
  const remaining = Math.max(0, props.targetMinutes * 60000 - elapsed);

  return (
    <div className="fixed inset-0 overflow-hidden bg-ink-950 text-mist-100">
      {devices?.cam && <video ref={analysisVideoRef} muted playsInline aria-hidden className="pointer-events-none absolute size-px opacity-0" />}
      {/* The room: warm window light behind the interviewer. */}
      <div className={cn("absolute inset-0 transition-opacity duration-[1600ms]", stage === "live" || stage === "ending" ? "opacity-100" : "opacity-40")}>
        <div className="absolute inset-0 window-light" />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink-950 to-transparent" />
      </div>

      {/* Interviewer */}
      {(stage === "entering" || stage === "live" || stage === "ending") && (
        <div className={cn("absolute inset-0 transition-all duration-[1400ms] ease-[var(--ease-out-expo)]", stage === "entering" ? "scale-[1.04] opacity-0" : "scale-100 opacity-100")}>
          {voiceOnly ? <VoiceOrb provider={provider} name={active.name} /> : (
            <AvatarBoundary fallback={<VoiceOrb provider={provider} name={active.name} />} onError={() => setVoiceOnly(true)}>
              <BotAvatar store={provider.store} seats={props.seats} className="absolute inset-0 pb-24"
                labels={props.seats.length > 1 ? (s, active) => (
                  <span className={cn("block whitespace-nowrap rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors duration-500", active ? "bg-lume/15 text-lume" : "text-mist-400/80")}>
                    {callName(s.name, s.style)} · {props.seats.find((x) => x.seat === s.seat)?.title}
                  </span>
                ) : undefined} />
            </AvatarBoundary>
          )}
        </div>
      )}

      {/* Top bar */}
      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-5 py-4 sm:px-8">
        <div className="flex items-center gap-3">
          <LogoMark className="size-5 text-mist-300" />
          {stage === "live" && (
            <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-mist-400">
              {ui?.recording && <span className="size-1.5 animate-pulse rounded-full bg-signal-bad" aria-label="Recording" />}
              {Math.floor(elapsed / 60000)}:{String(Math.floor((elapsed % 60000) / 1000)).padStart(2, "0")}
              <span className="text-mist-400/60">· ~{Math.ceil(remaining / 60000)} min left</span>
            </span>
          )}
        </div>
        {stage === "live" && (
          <div className="flex items-center gap-2 rounded-full border hairline bg-ink-950/60 px-3 py-1.5 backdrop-blur">
            <span className={cn("size-1.5 rounded-full", phase === "interviewer" ? "bg-lume" : phase === "listening" ? "bg-signal-good" : "bg-mist-400")} />
            <span className="text-[12px] text-mist-300">{active.name} · {active.title}</span>
            <span className="text-[11px] text-mist-400">AI</span>
          </div>
        )}
        <div className="w-24" />
      </header>

      {/* Candidate camera (secondary) */}
      {devices?.cam && (stage === "live" || stage === "entering" || stage === "ending") && (
        <div className="absolute bottom-28 right-5 z-10 aspect-video w-[min(26vw,300px)] min-w-[150px] overflow-hidden rounded-2xl border hairline-strong bg-ink-900 shadow-2xl sm:right-8">
          <video ref={videoRef} muted playsInline className="h-full w-full -scale-x-100 object-cover" />
          <span className="absolute bottom-2 left-2.5 font-mono text-[10px] text-white/70">You</span>
          {phase === "listening" && ui?.inputMode === "voice" && <MicRing controller={controller.current} />}
        </div>
      )}

      {/* Captions (off by default) */}
      {stage === "live" && captions && ui?.caption && (
        <div className="absolute inset-x-0 bottom-40 z-10 mx-auto max-w-3xl px-6 text-center">
          <p className="inline rounded-lg bg-ink-950/75 px-3 py-1.5 text-[15px] leading-relaxed text-mist-100 backdrop-blur">{ui.caption}</p>
        </div>
      )}

      {/* Listening affordances: live transcript is hidden by default to keep it real; text mode input. */}
      {stage === "live" && ui?.phase === "listening" && ui.inputMode === "text" && (
        <form onSubmit={(e) => { e.preventDefault(); controller.current?.submitText(typed); setTyped(""); }} className="absolute inset-x-0 bottom-28 z-20 mx-auto flex max-w-2xl gap-2 px-5">
          <textarea autoFocus value={typed} onChange={(e) => { controller.current?.noteKeystroke(); setTyped(e.target.value); }} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); controller.current?.submitText(typed); setTyped(""); } }}
            rows={2} placeholder="Type your answer — Enter to send" className="flex-1 resize-none rounded-2xl border hairline-strong bg-ink-900/85 px-4 py-3 text-[15px] outline-none backdrop-blur focus:border-lume/50" />
          <Button type="submit" disabled={!typed.trim()} className="self-end">Send</Button>
        </form>
      )}
      {stage === "live" && ui?.hint && <p className="absolute inset-x-0 bottom-44 z-10 mx-auto max-w-lg px-6 text-center text-sm text-mist-300">{ui.hint}</p>}

      {/* Controls */}
      {stage === "live" && (
        <nav aria-label="Interview controls" className="absolute inset-x-0 bottom-8 z-20 flex items-center justify-center gap-2">
          <Ctl label={muted ? "Unmute" : "Mute"} danger={muted} onClick={toggleMute} disabled={!devices?.mic}>{muted ? "Mic off" : "Mic"}</Ctl>
          <Ctl label="Captions" on={captions} onClick={() => setCaptions(!captions)}>CC</Ctl>
          {ui?.inputMode === "voice" ? (
            <>
              <Ctl label="Type instead" onClick={() => controller.current?.switchToText()}>Type</Ctl>
              <Button variant="secondary" size="md" disabled={ui?.phase !== "listening"} onClick={() => void controller.current?.finishAnswer(false)} title="Done answering (Space)">Done answering</Button>
            </>
          ) : devices?.mic ? <Ctl label="Speak instead" onClick={() => controller.current?.switchToVoice()}>Speak</Ctl> : null}
          <Button variant="danger" size="md" onClick={() => setConfirmEnd(true)}>End</Button>
        </nav>
      )}

      {/* Status whisper (never a score) */}
      {stage === "live" && (
        <p aria-live="polite" className="absolute inset-x-0 bottom-[5.25rem] z-10 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-mist-400/70">
          {phase === "starting" ? "Connecting" : phase === "listening" ? (ui?.inputMode === "text" ? "Your turn — type" : "Listening") : phase === "interviewer" ? "" : phase === "processing" ? "" : ""}
          {ui?.voice === "browser" && phase === "interviewer" ? "Backup voice" : ""}
        </p>
      )}

      {/* Consent */}
      <ConsentDialog open={stage === "consent"} recordingAllowed={props.privacy.recordVideo}
        defaults={{ microphone: true, camera: true, recording: props.privacy.recordVideo, cameraMetrics: props.privacy.cameraMetrics }}
        onConfirm={onConsent} onCancel={() => router.push("/practice")} />

      {/* Device check */}
      {stage === "check" && devices && (
        <div className="relative z-10 mx-auto grid min-h-dvh max-w-5xl items-center gap-10 px-5 py-20 lg:grid-cols-[1.2fr_1fr]">
          <div className="relative aspect-video overflow-hidden rounded-3xl border hairline-strong bg-ink-900">
            {devices.cam ? <video ref={checkVideoRef} muted playsInline className="h-full w-full -scale-x-100 object-cover" /> : <div className="grid h-full place-items-center text-sm text-mist-400">{devices.camError ?? "Camera off"}</div>}
            {calib === "running" && <div className="absolute inset-0 grid place-items-center bg-ink-950/40"><p className="rounded-full bg-ink-950/80 px-4 py-2 text-sm">Look straight into your camera lens…</p></div>}
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-mist-400">{props.resuming ? "Rejoining" : "Before you walk in"}</p>
            <h1 className="mt-3 font-display text-5xl leading-tight">{props.resuming ? "Pick up where you left off." : "Check your setup."}</h1>
            <ul className="mt-8 space-y-4 text-sm">
              <Check ok={!!devices.mic} label={devices.mic ? "Microphone" : devices.micError ?? "Microphone off"}>
                {devices.mic && <div className="mt-2 h-1 w-40 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-signal-good transition-[width] duration-100" style={{ width: `${micLevel * 100}%` }} /></div>}
                {devices.mic && <p className="mt-1 text-xs text-mist-400">Say something — the bar should move.</p>}
              </Check>
              <Check ok={!!devices.cam} label={devices.cam ? "Camera" : devices.camError ?? "Camera off"} />
              <Check ok={!devices.mic ? false : LiveTranscriber.supported() || props.serverStt} label={!devices.mic ? "Text mode — you'll type your answers" : LiveTranscriber.supported() ? "Live speech recognition" : props.serverStt ? "Server transcription (answers are transcribed after you finish)" : "No speech recognition — you'll type"} />
              {consent?.cameraMetrics && devices.cam && (
                <Check ok={calib === "done"} label={calib === "done" ? "Camera lens calibrated" : calib === "unavailable" ? "On-device tracking unavailable — camera signals will be skipped" : "Calibrate to measure camera engagement and posture (skip it and we won't measure gaze, slouch or lean)"}>
                  {calib !== "done" && calib !== "unavailable" && <Button size="sm" variant="secondary" className="mt-2" onClick={calibrate} loading={calib === "running"} disabled={!visionReady}>{visionReady ? "Sit as you normally would and look at the lens for 2 seconds" : "Loading on-device model…"}</Button>}
                  {calib === "failed" && <p className="mt-1 text-xs text-signal-warn">We couldn&apos;t see your face clearly. Check your lighting and try again.</p>}
                </Check>
              )}
              {consent?.cameraMetrics && props.privacy.posture && devices.cam && calib === "done" && (
                <Check ok={postureReady} label={postureReady ? "Posture" : "Posture: shoulders not in view"}>
                  {postureReady ? (
                    <p className="mt-1 text-xs text-mist-400" aria-live="polite">Right now: <span className="text-mist-100">{livePosture ?? "…"}</span>. Try sitting back or leaning in. Nothing here is saved.</p>
                  ) : (
                    <>
                      <p className="mt-1 text-xs text-signal-warn">Sit back a little or tilt your camera down so your shoulders are in view, then recalibrate. Without that we can measure sway, but not slouch.</p>
                      <Button size="sm" variant="secondary" className="mt-2" onClick={calibrate}>Recalibrate</Button>
                    </>
                  )}
                </Check>
              )}
            </ul>
            {(devices.micError || devices.camError) && <p className="mt-6 text-[13px] text-mist-400">To allow access later, use the camera icon in your browser&apos;s address bar, then reload.</p>}
            <div className="mt-10 flex gap-3">
              <Button variant="lume" size="lg" onClick={enter}>{props.resuming ? "Rejoin the Room" : "Enter the Room"}</Button>
              <Button variant="ghost" size="lg" onClick={() => router.push("/practice")}>Back</Button>
            </div>
          </div>
        </div>
      )}

      {(stage === "entering" || (stage === "live" && phase === "starting")) && (
        <p className="absolute inset-x-0 top-1/2 z-10 text-center font-display text-3xl text-mist-300 opacity-80">{stage === "entering" ? "Entering the room…" : ""}</p>
      )}

      {(stage === "ending" || phase === "ending" || phase === "ended") && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-ink-950/70 backdrop-blur-sm">
          <div className="text-center"><p className="font-display text-4xl">{ui?.complete ? "That's the interview." : "Wrapping up…"}</p><p className="mt-3 text-sm text-mist-400">Saving your session and preparing your Read.</p></div>
        </div>
      )}

      {/* Recovery */}
      <Modal open={stage === "live" && phase === "error"} onClose={() => {}} title="Connection problem" dismissible={false}>
        <div className="p-8">
          <h2 className="font-display text-3xl">{ui?.error?.message ?? "We lost the interviewer connection."}</h2>
          <p className="mt-3 text-sm text-mist-300">Everything you&apos;ve said so far is saved.</p>
          <div className="mt-7 flex flex-wrap gap-2">
            <Button onClick={() => void controller.current?.retry()}>Reconnect</Button>
            {!voiceOnly && <Button variant="secondary" onClick={() => { setVoiceOnly(true); void controller.current?.retry(); }}>Continue with voice</Button>}
            <Button variant="danger" onClick={endNow}>End session</Button>
          </div>
        </div>
      </Modal>

      <Modal open={confirmEnd} onClose={() => setConfirmEnd(false)} title="End the interview?">
        <div className="p-8">
          <h2 className="font-display text-3xl">End the interview?</h2>
          <p className="mt-3 text-sm text-mist-300">You&apos;ll still get a Read and Playback for everything you said so far.</p>
          <div className="mt-7 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmEnd(false)}>Keep going</Button>
            <Button variant="danger" onClick={endNow}>End and see my Read</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Ctl({ children, label, on, onClick, disabled, danger }: { children: ReactNode; label: string; on?: boolean; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button type="button" aria-label={label} aria-pressed={on} onClick={onClick} disabled={disabled}
      className={cn("h-10 min-w-10 rounded-full border px-4 text-[13px] transition-colors disabled:opacity-40", danger ? "border-signal-bad/40 bg-signal-bad/15 text-signal-bad" : on ? "border-lume/40 bg-lume/10 text-lume" : "hairline-strong bg-ink-950/60 text-mist-200 hover:bg-white/10 backdrop-blur")}>
      {children}
    </button>
  );
}

function Check({ ok, label, children }: { ok: boolean; label: string; children?: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px]", ok ? "bg-signal-good/15 text-signal-good" : "bg-white/[0.06] text-mist-400")}>{ok ? "✓" : "–"}</span>
      <div><p className={ok ? "text-mist-100" : "text-mist-300"}>{label}</p>{children}</div>
    </li>
  );
}

function MicRing({ controller }: { controller: RoomController | null }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      if (ref.current && controller) ref.current.style.boxShadow = `inset 0 0 0 ${1 + controller.micLevel * 3}px rgba(156,199,164,${0.25 + controller.micLevel * 0.6})`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [controller]);
  return <div ref={ref} className="pointer-events-none absolute inset-0 rounded-2xl" />;
}

/** Voice-only interviewer: a breathing orb driven by the same voice level. */
function VoiceOrb({ provider, name }: { provider: LocalAvatarProvider; name: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const l = provider.store.level();
      const t = performance.now() / 1000;
      if (ref.current) ref.current.style.transform = `scale(${1 + Math.sin(t * 1.4) * 0.015 + l * 0.18})`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [provider]);
  return (
    <div className="absolute inset-0 grid place-items-center">
      <div className="text-center">
        <div ref={ref} className="mx-auto size-48 rounded-full bg-[radial-gradient(circle_at_40%_35%,var(--color-lume-soft),var(--color-lume-deep)_45%,transparent_72%)] opacity-80 blur-[1px]" />
        <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.2em] text-mist-400">{name} · voice mode</p>
      </div>
    </div>
  );
}
