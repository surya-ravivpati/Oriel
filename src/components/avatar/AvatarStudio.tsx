"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FieldError, Input } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/components/ui/cn";
import { api, ApiError } from "@/lib/client/api";
import { AvatarStore } from "@/lib/avatar/store";
import { BOT_ACCESSORIES, BOT_COLORS, BOT_SHAPES, BOT_VOICES, DEFAULT_STYLES, NAME_MAX, VOICE_SAMPLE, cleanName, nameProblem, styleFor, type AvatarStyle, type BotColorId, type BotVoice } from "@/lib/avatar/style";
import { InterviewerAudio, speakWithBrowser } from "@/lib/avatar/audio";
import { readNdjson } from "@/features/room/engine/stream";
import type { RoomEvent } from "@/server/interview/service";
import { PERSONAS, type PersonaId } from "@/lib/interview/personas";
import { BotAvatar } from "./BotAvatar";
import { BotStill } from "./BotStill";

export type SavedStyles = Partial<Record<PersonaId, AvatarStyle>>;

/**
 * "Make it yours": pick an interviewer's shape, colour and accessory and give it a name.
 * The live preview morphs as you choose, and speaks a sample in any voice you try. The
 * look, name and voice are yours; how the interviewer behaves (warmth, skepticism,
 * pressure) stays with the persona.
 */
export function AvatarStudio({ personaId, saved, onClose, onSaved }: {
  personaId: PersonaId | null;
  saved: SavedStyles;
  onClose: () => void;
  onSaved: (styles: SavedStyles) => void;
}) {
  return (
    <Modal open={!!personaId} onClose={onClose} title="Make it yours" className="w-[min(900px,calc(100vw-32px))]">
      {personaId && <Studio key={personaId} personaId={personaId} saved={saved} onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}

function Studio({ personaId, saved, onClose, onSaved }: { personaId: PersonaId; saved: SavedStyles; onClose: () => void; onSaved: (styles: SavedStyles) => void }) {
  const persona = PERSONAS[personaId];
  const defaultName = persona.name.split(" ")[0];
  const [draft, setDraft] = useState<AvatarStyle>(() => styleFor(personaId, saved[personaId]));
  const [nameInput, setNameInput] = useState(draft.name ?? "");
  const [busy, setBusy] = useState<"save" | "reset" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const store = useMemo(() => {
    const s = new AvatarStore();
    s.setMode("listening");
    s.pressure = 1;
    return s;
  }, []);

  const [playing, setPlaying] = useState<string | null>(null);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const audio = useRef<InterviewerAudio | null>(null);
  const playToken = useRef(0);
  useEffect(() => () => audio.current?.close(), []);

  const name = cleanName(nameInput);
  const problem = nameProblem(name);
  const style: AvatarStyle = { ...draft, name: name || null };
  const shown = name || defaultName;
  const isDefault = JSON.stringify({ ...style, voice: style.voice ?? null }) === JSON.stringify({ ...DEFAULT_STYLES[personaId], voice: null });
  const voice = draft.voice ?? persona.voice;

  /** Play the sample line in a voice; the preview bot speaks it. Pressing again stops it. */
  async function play(v: string) {
    const token = ++playToken.current;
    const a = (audio.current ??= new InterviewerAudio());
    a.stop();
    if (playing === v) { setPlaying(null); store.setMode("listening", 0); return; }
    await a.resume();
    setPlaying(v);
    setVoiceNote(null);
    store.setLevel(() => a.level());
    store.setMode("speaking", 0);
    try {
      const res = await fetch("/api/avatar/voice-preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ voice: v }) });
      if (res.status === 429) { setVoiceNote("Voice previews are busy — try again in a few seconds."); return; }
      if (!res.ok) throw new Error(String(res.status));
      let started = false, fallback = false;
      await readNdjson<RoomEvent>(res, (ev) => {
        if (token !== playToken.current) return;
        if (ev.type === "audio") { if (!started) { a.beginUtterance(); started = true; } a.enqueuePcm(ev.pcm, ev.sampleRate); }
        else if (ev.type === "audio_end") a.endUtterance();
        else if (ev.type === "tts_fallback") fallback = true;
      });
      if (token !== playToken.current) return;
      if (fallback) {
        setVoiceNote("Interviewer voices need the speech service, which isn't available right now — this is your browser's voice instead.");
        await speakWithBrowser(VOICE_SAMPLE, { audio: a });
      } else if (started) await a.waitForEnd();
    } catch {
      setVoiceNote("Couldn't play that voice — try again.");
    } finally {
      if (token === playToken.current) { setPlaying(null); store.setMode("listening", 0); store.setLevel(() => 0); }
    }
  }

  // A nod (and, for the warmer interviewers, a smile) once you've given it a name.
  useEffect(() => {
    if (!name || problem) return;
    const id = setTimeout(() => store.fireCue("nod", 0), 450);
    return () => clearTimeout(id);
  }, [name, problem, store]);

  const seat = { seat: 0, personaId, name: shown, accent: persona.accent, expressiveness: persona.expressiveness, warmth: persona.warmth, skepticism: persona.skepticism, style };

  async function save() {
    if (problem) return;
    setBusy("save");
    setError(null);
    try {
      const r = await api<{ styles: SavedStyles }>("/api/avatar/styles", { method: "PUT", json: { personaId, style } });
      onSaved(r.styles);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save");
      setBusy(null);
    }
  }

  async function reset() {
    setBusy("reset");
    setError(null);
    try {
      const r = await api<{ styles: SavedStyles }>("/api/avatar/styles", { method: "DELETE", json: { personaId } });
      onSaved(r.styles);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't reset");
      setBusy(null);
    }
  }

  return (
    <div className="grid max-h-[calc(100dvh-48px)] overflow-y-auto md:grid-cols-[1fr_1.2fr] md:overflow-hidden">
      {/* Preview */}
      <div className="relative flex flex-col items-center justify-center overflow-hidden border-b hairline bg-[radial-gradient(120%_80%_at_50%_0%,rgba(233,184,114,0.13),transparent_60%)] px-6 pb-8 pt-6 md:border-b-0 md:border-r">
        <p className="self-start font-mono text-[11px] uppercase tracking-[0.18em] text-mist-400">Make it yours</p>
        <BotAvatar store={store} seats={[seat]} compact className="mt-2 h-52 w-full sm:h-64 md:h-72" />
        <p className="mt-1 max-w-full truncate font-display text-4xl leading-tight" aria-live="polite">{shown}</p>
        <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-mist-400">{persona.title}</p>
        <p className="mt-5 max-w-[30ch] text-center text-[13px] leading-relaxed text-mist-400">The look, name and voice are yours. How {shown} interviews stays the same.</p>
      </div>

      {/* Choices */}
      <div className="space-y-7 p-6 md:max-h-[calc(100dvh-48px)] md:overflow-y-auto md:p-8">
        <div>
          <label htmlFor="bot-name" className="mb-2 block text-[13px] font-medium text-mist-200">Name</label>
          <Input id="bot-name" value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder={defaultName} maxLength={NAME_MAX + 6} autoComplete="off" aria-invalid={!!problem} />
          {problem ? <FieldError>{problem}</FieldError> : <p className="mt-2 text-xs text-mist-400">It introduces itself with this name. Leave it blank for {defaultName}.</p>}
        </div>

        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-mist-200">Voice</legend>
          <div role="radiogroup" aria-label="Voice" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {BOT_VOICES.map((v) => {
              const on = voice === v.id;
              return (
                <div key={v.id} className={cn("flex items-center rounded-xl border pl-3 pr-1 transition-colors duration-200", on ? "border-lume/60 bg-lume/[0.07]" : "hairline-strong bg-white/[0.02] hover:bg-white/[0.05]")}>
                  <button type="button" role="radio" aria-checked={on} onClick={() => setDraft({ ...draft, voice: v.id === persona.voice ? null : (v.id as BotVoice) })} className="min-w-0 flex-1 py-2 text-left">
                    <span className={cn("block truncate text-sm", on ? "text-mist-100" : "text-mist-200")}>{v.id}</span>
                    <span className="block truncate text-[11px] text-mist-400">{v.label}{v.id === persona.voice ? " · default" : ""}</span>
                  </button>
                  <button type="button" onClick={() => play(v.id)} aria-label={playing === v.id ? `Stop ${v.id}` : `Play ${v.id}`} title={playing === v.id ? "Stop" : "Hear it"}
                    className={cn("grid size-8 shrink-0 place-items-center rounded-full transition-colors hover:bg-white/10", playing === v.id ? "text-lume" : "text-mist-300 hover:text-lume")}>
                    {playing === v.id
                      ? <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden><rect width="10" height="10" rx="1.5" fill="currentColor" /></svg>
                      : <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden><path d="M0 0v12l10-6z" fill="currentColor" /></svg>}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-mist-400" aria-live="polite">{voiceNote ?? "Press play to hear a voice. The interviewer speaks with it in the Room and in drills."}</p>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-mist-200">Shape</legend>
          <div role="radiogroup" aria-label="Shape" className="grid grid-cols-4 gap-2">
            {BOT_SHAPES.map((s) => {
              const on = draft.shape === s.id;
              return (
                <button key={s.id} type="button" role="radio" aria-checked={on} aria-label={s.label} onClick={() => setDraft({ ...draft, shape: s.id })}
                  className={cn("flex flex-col items-center rounded-2xl border px-1 pb-2 pt-1 transition-colors duration-200", on ? "border-lume/60 bg-lume/[0.07]" : "hairline-strong bg-white/[0.02] hover:bg-white/[0.05]")}>
                  <BotStill personaId={personaId} style={{ ...draft, shape: s.id }} className="aspect-square w-full" />
                  <span className={cn("text-xs", on ? "text-mist-100" : "text-mist-400")}>{s.label}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-mist-200">Colour</legend>
          <div role="radiogroup" aria-label="Colour" className="flex flex-wrap gap-2.5">
            {(Object.entries(BOT_COLORS) as [BotColorId, (typeof BOT_COLORS)[BotColorId]][]).map(([id, c]) => {
              const on = draft.color === id;
              return (
                <button key={id} type="button" role="radio" aria-checked={on} aria-label={c.label} title={c.label} onClick={() => setDraft({ ...draft, color: id })}
                  className={cn("size-8 rounded-full border transition-[box-shadow,transform] duration-200 hover:scale-110", on ? "border-transparent shadow-[0_0_0_2px_#0b0b0d,0_0_0_4px_rgba(233,184,114,0.85)]" : "border-white/15")}
                  style={{ background: `radial-gradient(circle at 35% 30%, ${c.face}, ${c.shade})` }} />
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-mist-200">Accessory</legend>
          <div role="radiogroup" aria-label="Accessory" className="flex flex-wrap gap-2">
            {BOT_ACCESSORIES.map((a) => {
              const on = draft.accessory === a.id;
              return (
                <button key={a.id} type="button" role="radio" aria-checked={on} onClick={() => setDraft({ ...draft, accessory: a.id })}
                  className={cn("rounded-full border px-3.5 py-1.5 text-sm transition-colors duration-200", on ? "border-lume/50 bg-lume/[0.08] text-mist-100" : "hairline-strong text-mist-300 hover:text-mist-100")}>
                  {a.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <FieldError>{error}</FieldError>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t hairline pt-5">
          <Button variant="ghost" size="sm" onClick={reset} loading={busy === "reset"} disabled={!!busy || (isDefault && !saved[personaId])}>Reset to {defaultName}</Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={!!busy}>Cancel</Button>
            <Button variant="lume" onClick={save} loading={busy === "save"} disabled={!!busy || !!problem}>Save</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
