"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlaybackClipCard } from "@/components/app/cards";
import { Metric } from "@/components/ui/Metric";
import { Badge, Card, Eyebrow } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/components/ui/cn";
import { mmss } from "@/lib/format";
import { LessonCard, type LessonSummary } from "@/components/app/lessons";
import { POSTURE_LABEL, type PostureKind } from "@/lib/analysis/posture";
import type { Confidence } from "@/db/schema";

export interface PlaybackData {
  sessionId: string;
  title: string;
  subtitle: string;
  headline: string | null;
  summarySource: string | null;
  strengths: string[];
  focus: string[];
  rewrite: { question: string; original: string; rewritten: string; note: string } | null;
  comparison: { question: string; first: string; latest: string; firstDate: string } | null;
  media: { url: string; mimeType: string; expiresAt: string | null } | null;
  mediaDeleted: boolean;
  durationMs: number;
  clips: { id: string; startMs: number; endMs: number; title: string; observed: string; suggestion: string; confidence: Confidence; questionText: string; transcript: string; signal: string }[];
  metrics: { key: string; label: string; value: number | null; low: number | null; high: number | null; unit: string; confidence: Confidence; targetLow: number | null; targetHigh: number | null; note: string; detail: Record<string, unknown> | null }[];
  competencies: { key: string; label: string; answers: number; avgQuality: number }[];
  posture: { t: number; kind: PostureKind; durationMs: number }[];
  transcript: { id: string; speaker: "candidate" | "interviewer"; who: string; text: string; startMs: number; endMs: number; kind?: string }[];
  questions: { id: string; startMs: number; kind: string }[];
  recommendedDrill: { id: string; title: string; reason: string };
  playbackLevel: "basic" | "full";
  comparisonToBaseline: { label: string; current: string | null; baseline: string | null; improved: boolean | null }[];
  initialT: number | null;
  initialClip: string | null;
  lessons: LessonSummary[];
}

const POSTURE_COLOR: Record<PostureKind, string> = {
  slouch: "bg-signal-warn/70", lean_in: "bg-lume/60", lean_back: "bg-mist-300/50", fidget: "bg-mist-400/35", off_frame: "bg-white/15",
};

const METRIC_ORDER = ["pace_wpm", "filler_per_min", "pauses", "hedges_per_min", "structure_score", "specificity", "recovery_ms", "vocal_variety", "camera_engagement", "movement", "setup"];

export function PlaybackView({ d }: { d: PlaybackData }) {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const [activeClip, setActiveClip] = useState<string | null>(d.initialClip);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(d.durationMs / 1000);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [mediaError, setMediaError] = useState(false);

  const seek = useCallback((ms: number, play = true) => {
    const v = video.current;
    if (!v) return;
    v.currentTime = Math.max(0, ms / 1000);
    if (play) void v.play().catch(() => {});
    v.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  useEffect(() => {
    const v = video.current;
    if (!v || d.initialT === null) return;
    const go = () => seek(d.initialT!, false);
    if (v.readyState >= 1) go();
    else v.addEventListener("loadedmetadata", go, { once: true });
  }, [d.initialT, seek]);

  // MediaRecorder WebM files have no duration header; fall back to the session length.
  const onMeta = () => {
    const v = video.current;
    if (v && Number.isFinite(v.duration) && v.duration > 0) setDuration(v.duration);
  };

  const metrics = useMemo(() => [...d.metrics].sort((a, b) => METRIC_ORDER.indexOf(a.key) - METRIC_ORDER.indexOf(b.key)), [d.metrics]);
  const tl = Math.max(duration * 1000, d.durationMs, 1);

  async function del() {
    setDeleting(true);
    await fetch(`/api/sessions/${d.sessionId}`, { method: "DELETE" });
    router.push("/playback");
    router.refresh();
  }

  return (
    <div className="space-y-16">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <Eyebrow>Playback · {d.subtitle}</Eyebrow>
          <h1 className="mt-3 max-w-3xl font-display text-[clamp(2.2rem,4.5vw,3.8rem)] leading-[1.02]">{d.headline ?? "Now you know what happened."}</h1>
          {d.summarySource === "heuristic" && <p className="mt-2 text-xs text-mist-400">Coaching generated from measurements (no language model configured).</p>}
        </div>
        <div className="flex gap-2">
          <ButtonLink href={`/drills/${d.recommendedDrill.id}?from=${d.sessionId}`} variant="lume">Drill: {d.recommendedDrill.title}</ButtonLink>
          <ButtonLink href="/practice" variant="secondary">Practice again</ButtonLink>
        </div>
      </header>

      {/* Evidence: recording + moments */}
      <section className="grid gap-6 lg:grid-cols-[1.45fr_1fr]">
        <div>
          <div className="relative overflow-hidden rounded-3xl border hairline-strong bg-ink-900">
            {d.media && !mediaError ? (
              <video ref={video} src={d.media.url} controls playsInline preload="metadata" onLoadedMetadata={onMeta} onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)} onError={() => setMediaError(true)}
                className={cn("aspect-video w-full bg-black", d.media.mimeType.startsWith("audio") && "h-24 aspect-auto")} />
            ) : (
              <div className="grid aspect-video place-items-center p-8 text-center">
                <div>
                  <p className="text-mist-100">{d.mediaDeleted ? "The recording was deleted." : mediaError ? "The recording couldn't be loaded." : "No recording for this session."}</p>
                  <p className="mt-2 text-sm text-mist-400">{d.mediaDeleted ? "Raw video is removed after your retention period. Your transcript and Read remain." : "Your transcript and Read are below."}</p>
                </div>
              </div>
            )}
          </div>
          {/* Timeline: questions, clips and posture shifts on the session clock. */}
          <div className="relative mt-4 h-10 select-none" aria-label="Session timeline">
            <div className="absolute inset-x-0 top-1/2 h-px bg-white/10" />
            {d.questions.map((q) => (
              <button key={q.id} type="button" title={`Question at ${mmss(q.startMs)}`} onClick={() => seek(q.startMs)}
                className={cn("absolute top-1/2 h-3 w-px -translate-y-1/2", ["pressure", "cross", "curveball", "memory_callback"].includes(q.kind) ? "bg-signal-warn/70" : "bg-mist-400/60")} style={{ left: `${(q.startMs / tl) * 100}%` }} />
            ))}
            {d.posture.map((p, i) => {
              const label = `${POSTURE_LABEL[p.kind]} at ${mmss(p.t)} for ${Math.round(p.durationMs / 1000)} s`;
              return <button key={i} type="button" onClick={() => seek(p.t)} title={label} aria-label={label}
                className={cn("absolute top-[70%] h-1.5 rounded-full transition-transform hover:scale-y-150", POSTURE_COLOR[p.kind])} style={{ left: `${(p.t / tl) * 100}%`, width: `${Math.max(0.4, (p.durationMs / tl) * 100)}%` }} />;
            })}
            {d.clips.map((c) => (
              <button key={c.id} type="button" onClick={() => { setActiveClip(c.id); seek(c.startMs); }} title={`${mmss(c.startMs)} — ${c.title}`}
                className={cn("absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink-950 transition-transform hover:scale-150", activeClip === c.id ? "bg-lume scale-125" : "bg-lume/70")} style={{ left: `${(c.startMs / tl) * 100}%` }} />
            ))}
            <span className="absolute top-1/2 h-5 w-0.5 -translate-y-1/2 rounded bg-mist-100" style={{ left: `${Math.min(100, ((time * 1000) / tl) * 100)}%` }} />
          </div>
          <div className="flex justify-between font-mono text-[10px] text-mist-400"><span>00:00</span><span>{mmss(tl)}</span></div>
          {d.posture.length > 0 && (
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-mist-400">
              <span>Posture:</span>
              {[...new Set(d.posture.map((p) => p.kind))].map((k) => <span key={k} className="inline-flex items-center gap-1.5"><span className={cn("h-1.5 w-3 rounded-full", POSTURE_COLOR[k])} />{POSTURE_LABEL[k]}</span>)}
            </p>
          )}
        </div>
        <div>
          <div className="mb-3 flex items-center justify-between"><Eyebrow>The moments that mattered</Eyebrow>{d.playbackLevel === "basic" && <Badge>Basic</Badge>}</div>
          <div className="space-y-3">
            {d.clips.length ? d.clips.map((c) => (
              <PlaybackClipCard key={c.id} clip={c} active={activeClip === c.id} onClick={() => { setActiveClip(c.id); seek(c.startMs); }} />
            )) : <p className="rounded-2xl border hairline p-6 text-sm text-mist-400">No standout moments were detected — a steady session. Try a higher pressure level next time.</p>}
          </div>
        </div>
      </section>

      {(d.strengths.length > 0 || d.focus.length > 0) && (
        <section className="grid gap-4 md:grid-cols-2">
          {d.strengths.length > 0 && <Card className="p-6"><Eyebrow>What worked</Eyebrow><ul className="mt-4 space-y-2 text-sm text-mist-200">{d.strengths.map((s) => <li key={s} className="flex gap-2.5"><span className="text-signal-good">—</span>{s}</li>)}</ul></Card>}
          {d.focus.length > 0 && <Card className="p-6"><Eyebrow>Focus next</Eyebrow><ul className="mt-4 space-y-2 text-sm text-mist-200">{d.focus.map((s) => <li key={s} className="flex gap-2.5"><span className="text-lume">—</span>{s}</li>)}</ul></Card>}
        </section>
      )}

      {d.lessons.length > 0 && (
        <section>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><Eyebrow>Lessons</Eyebrow><h2 className="mt-3 font-display text-4xl">What to work on next</h2></div>
            <Link href="/lessons" className="text-sm text-mist-400 hover:text-mist-100">All lessons →</Link>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-mist-400">Built from this interview — each one uses your own answers as the example and ends with measured practice.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{d.lessons.map((l) => <LessonCard key={l.key} l={l} />)}</div>
        </section>
      )}

      {/* The Read */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><Eyebrow>The Read</Eyebrow><h2 className="mt-3 font-display text-4xl">What we measured</h2></div>
          <p className="max-w-md text-sm text-mist-400">Each measure shows a range and how far to trust it. Camera-based signals are estimates. Nothing here judges appearance, accent or emotion.</p>
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map((m) => (
            <Metric key={m.key} label={m.label} value={m.value} unit={m.unit} low={m.low} high={m.high} targetLow={m.targetLow} targetHigh={m.targetHigh} confidence={m.confidence} note={m.note}
              format={m.key === "recovery_ms" ? (v) => (v / 1000).toFixed(1) : undefined} scaleMax={m.key === "structure_score" || m.key === "specificity" || m.key === "camera_engagement" ? 100 : undefined} />
          ))}
        </div>
        {d.comparisonToBaseline.some((c) => c.baseline !== null && c.current !== null) && (
          <Card className="mt-6 p-6">
            <Eyebrow>Against your baseline</Eyebrow>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {d.comparisonToBaseline.filter((c) => c.baseline !== null && c.current !== null).map((c) => (
                <div key={c.label}>
                  <p className="text-xs text-mist-400">{c.label}</p>
                  <p className={cn("mt-1 font-display text-2xl tabular", c.improved ? "text-signal-good" : "text-mist-100")}>{c.current}</p>
                  <p className="text-xs text-mist-400">baseline {c.baseline}{c.improved ? " · better" : ""}</p>
                </div>
              ))}
            </div>
          </Card>
        )}
        {d.competencies.length > 0 && (
          <Card className="mt-6 p-6">
            <Eyebrow>Competencies covered</Eyebrow>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {d.competencies.map((c) => (
                <li key={c.key} className="flex items-center gap-3">
                  <span className="w-44 shrink-0 text-sm text-mist-200">{c.label}</span>
                  <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]"><span className="block h-full rounded-full bg-mist-300/60" style={{ width: `${Math.round(c.avgQuality * 100)}%` }} /></span>
                  <span className="w-16 text-right font-mono text-[11px] text-mist-400">{c.answers} ans.</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-mist-400">Bars show answer strength (structure and specificity), inferred from your transcript — not a grade of you.</p>
          </Card>
        )}
      </section>

      {d.rewrite && (
        <section>
          <Eyebrow>Your weakest answer, tightened</Eyebrow>
          <p className="mt-3 text-sm text-mist-400">Q: {d.rewrite.question}</p>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <Card className="p-6"><p className="font-mono text-[11px] uppercase tracking-widest text-mist-400">What you said</p><p className="mt-3 text-[15px] leading-relaxed text-mist-300">{d.rewrite.original}</p></Card>
            <Card className="border-lume/25 p-6"><p className="font-mono text-[11px] uppercase tracking-widest text-lume">Same facts, tighter</p><p className="mt-3 text-[15px] leading-relaxed text-mist-100">{d.rewrite.rewritten}</p><p className="mt-4 text-xs text-mist-400">{d.rewrite.note} Only facts from your answer are used; [brackets] mark details only you can fill in.</p></Card>
          </div>
        </section>
      )}

      {d.comparison && (
        <section>
          <Eyebrow>First session vs. now</Eyebrow>
          <p className="mt-3 text-sm text-mist-400">A {d.comparison.question.toLowerCase().startsWith("tell") ? "similar question" : "question in the same competency"}, {d.comparison.firstDate} vs. today.</p>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <Card className="p-6"><p className="font-mono text-[11px] uppercase tracking-widest text-mist-400">Then</p><p className="mt-3 text-[15px] leading-relaxed text-mist-300">{d.comparison.first}</p></Card>
            <Card className="p-6"><p className="font-mono text-[11px] uppercase tracking-widest text-mist-400">Now</p><p className="mt-3 text-[15px] leading-relaxed text-mist-100">{d.comparison.latest}</p></Card>
          </div>
        </section>
      )}

      {/* Transcript */}
      <section>
        <Eyebrow>Transcript</Eyebrow>
        <ol className="mt-5 divide-y divide-white/[0.05] rounded-2xl border hairline">
          {d.transcript.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => seek(s.startMs)} disabled={!d.media} className={cn("flex w-full gap-5 px-5 py-4 text-left transition-colors enabled:hover:bg-white/[0.02]", time * 1000 >= s.startMs && time * 1000 < s.endMs && "bg-lume/[0.04]")}>
                <span className="w-12 shrink-0 font-mono text-xs text-mist-400 tabular">{mmss(s.startMs)}</span>
                <span className={cn("w-24 shrink-0 text-xs", s.speaker === "interviewer" ? "text-lume" : "text-mist-300")}>{s.who}</span>
                <span className={cn("text-[15px] leading-relaxed", s.speaker === "interviewer" ? "text-mist-300" : "text-mist-100")}>{s.text}</span>
              </button>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 border-t hairline pt-8 text-sm text-mist-400">
        <p>{d.media?.expiresAt ? `Raw video is deleted automatically on ${new Date(d.media.expiresAt).toLocaleDateString()}.` : "Transcript and Read are kept until you delete them."}</p>
        <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>Delete this session</Button>
      </section>
      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete session">
        <div className="p-8">
          <h2 className="font-display text-3xl">Delete this session?</h2>
          <p className="mt-3 text-sm text-mist-300">The recording, transcript, Read and Playback are permanently removed. This can&apos;t be undone.</p>
          <div className="mt-7 flex justify-end gap-2"><Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button><Button variant="danger" loading={deleting} onClick={del}>Delete permanently</Button></div>
        </div>
      </Modal>
      <p className="text-center text-xs text-mist-400"><Link href="/playback" className="hover:text-mist-100">← All sessions</Link></p>
    </div>
  );
}
