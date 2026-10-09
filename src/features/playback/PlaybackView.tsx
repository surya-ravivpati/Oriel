"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlaybackClipCard } from "@/components/app/cards";
import { ConfidenceMark } from "@/components/ui/Metric";
import { Badge } from "@/components/ui/Card";
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
  slouch: "bg-signal-warn/80", lean_in: "bg-lume", lean_back: "bg-mist-300/60", fidget: "bg-mist-400/50", off_frame: "bg-line-strong",
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

  const groups = grouped(metrics);
  const baseline = d.comparisonToBaseline.filter((c) => c.baseline !== null && c.current !== null);

  return (
    <article>
      <header className="border-b border-line pb-10">
        <p className="text-[13px] font-medium text-mist-400">Playback · {d.subtitle}</p>
        <h1 className="mt-3 max-w-[24ch] text-display text-mist-100">{d.headline ?? "Now you know what happened."}</h1>
        {d.summarySource === "heuristic" && <p className="mt-3 text-[13px] text-mist-400">Coaching generated from measurements (no language model configured).</p>}
      </header>

      {/* At a glance: where you stand, and what to do about it. */}
      <section aria-label="At a glance" className="grid gap-12 border-b border-line py-10 lg:grid-cols-12 lg:gap-x-10">
        <div className="lg:col-span-7">
          <h2 className="text-[13px] font-medium text-mist-400">Where you stand</h2>
          <Breakdown metrics={metrics} />
          {baseline.length > 0 && (
            <div className="mt-6">
              <h3 className="text-[13px] font-medium text-mist-400">Against your baseline</h3>
              <dl className="mt-2 grid grid-cols-2 gap-x-6 sm:grid-cols-4">
                {baseline.map((c) => (
                  <div key={c.label} className="border-t border-line py-3">
                    <dt className="text-[12px] text-mist-400">{c.label}</dt>
                    <dd className={cn("mt-1 font-mono text-[18px] tabular", c.improved ? "text-signal-good" : "text-mist-100")}>{c.current}</dd>
                    <dd className="font-mono text-[11px] text-mist-400">was {c.baseline}{c.improved ? " · better" : ""}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
        <div className="lg:col-span-5">
          <h2 className="text-[13px] font-medium text-mist-400">Next steps</h2>
          {d.focus.length > 0 ? (
            <ol className="mt-3 border-t border-line">
              {d.focus.slice(0, 3).map((f, i) => (
                <li key={f} className="grid grid-cols-[2rem_minmax(0,1fr)] border-b border-line py-3.5">
                  <span className="pt-0.5 font-mono text-[12px] text-lume">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-callout text-mist-100">{f}</span>
                </li>
              ))}
            </ol>
          ) : <p className="mt-3 border-t border-line pt-3 text-callout text-mist-300">{d.recommendedDrill.reason}</p>}
          <div className="mt-6 flex flex-wrap gap-2">
            <ButtonLink href={`/drills/${d.recommendedDrill.id}?from=${d.sessionId}`}>Drill: {d.recommendedDrill.title}</ButtonLink>
            <ButtonLink href="/practice" variant="secondary">Practice again</ButtonLink>
          </div>
          {d.strengths.length > 0 && (
            <div className="mt-10">
              <h3 className="text-[13px] font-medium text-mist-400">What worked</h3>
              <ul className="mt-2 space-y-1.5 text-callout text-mist-200">{d.strengths.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          )}
        </div>
      </section>

      {/* The recording, and the moments in it worth watching. */}
      <section className="border-b border-line py-10">
        <div className="mb-6 flex items-baseline justify-between gap-4">
          <h2 className="text-title text-mist-100">The moments that mattered</h2>
          {d.playbackLevel === "basic" && <Badge>Basic Playback</Badge>}
        </div>
        <div className="grid gap-8 lg:grid-cols-[1.45fr_1fr]">
          <div>
            <div className="relative overflow-hidden rounded-lg border border-line-strong bg-ink-900">
              {d.media && !mediaError ? (
                <video ref={video} src={d.media.url} controls playsInline preload="metadata" onLoadedMetadata={onMeta} onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)} onError={() => setMediaError(true)}
                  className={cn("aspect-video w-full bg-ink-950", d.media.mimeType.startsWith("audio") && "h-24 aspect-auto")} />
              ) : (
                <div className="grid aspect-video place-items-center p-8 text-center">
                  <div>
                    <p className="text-mist-100">{d.mediaDeleted ? "The recording was deleted." : mediaError ? "The recording couldn't be loaded." : "No recording for this session."}</p>
                    <p className="mt-2 text-[13px] text-mist-400">{d.mediaDeleted ? "Raw video is removed after your retention period. Your transcript and Read remain." : "Your transcript and Read are below."}</p>
                  </div>
                </div>
              )}
            </div>
            {/* Timeline: questions, moments and posture shifts on the session clock. */}
            <div className="relative mt-4 h-9 select-none" aria-label="Session timeline">
              <div className="absolute inset-x-0 top-1/2 h-px bg-line-strong" />
              {d.questions.map((q) => (
                <button key={q.id} type="button" title={`Question at ${mmss(q.startMs)}`} onClick={() => seek(q.startMs)}
                  className={cn("absolute top-1/2 h-3 w-px -translate-y-1/2", ["pressure", "cross", "curveball", "memory_callback"].includes(q.kind) ? "bg-signal-warn/80" : "bg-mist-400")} style={{ left: `${(q.startMs / tl) * 100}%` }} />
              ))}
              {d.posture.map((pz, i) => {
                const label = `${POSTURE_LABEL[pz.kind]} at ${mmss(pz.t)} for ${Math.round(pz.durationMs / 1000)} s`;
                return <button key={i} type="button" onClick={() => seek(pz.t)} title={label} aria-label={label}
                  className={cn("absolute top-[72%] h-1 transition-transform hover:scale-y-150", POSTURE_COLOR[pz.kind])} style={{ left: `${(pz.t / tl) * 100}%`, width: `${Math.max(0.4, (pz.durationMs / tl) * 100)}%` }} />;
              })}
              {d.clips.map((c) => (
                <button key={c.id} type="button" onClick={() => { setActiveClip(c.id); seek(c.startMs); }} title={`${mmss(c.startMs)}: ${c.title}`} aria-label={`Jump to ${mmss(c.startMs)}: ${c.title}`}
                  className={cn("absolute top-1/2 h-4 w-[3px] -translate-x-1/2 -translate-y-1/2 transition-colors", activeClip === c.id ? "bg-lume" : "bg-lume-deep hover:bg-lume")} style={{ left: `${(c.startMs / tl) * 100}%` }} />
              ))}
              <span className="absolute top-1/2 h-5 w-px -translate-y-1/2 bg-mist-100" style={{ left: `${Math.min(100, ((time * 1000) / tl) * 100)}%` }} />
            </div>
            <div className="flex justify-between font-mono text-[11px] text-mist-400"><span>00:00</span><span>{mmss(tl)}</span></div>
            {d.posture.length > 0 && (
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-mist-400">
                <span>Posture:</span>
                {[...new Set(d.posture.map((pz) => pz.kind))].map((k) => <span key={k} className="inline-flex items-center gap-1.5"><span className={cn("h-1 w-3", POSTURE_COLOR[k])} />{POSTURE_LABEL[k]}</span>)}
              </p>
            )}
          </div>
          <div className="border-b border-line">
            {d.clips.length ? d.clips.map((c) => (
              <PlaybackClipCard key={c.id} clip={c} active={activeClip === c.id} onClick={() => { setActiveClip(c.id); seek(c.startMs); }} />
            )) : <p className="border-t border-line py-5 text-callout text-mist-400">No standout moments were detected: a steady session. Try a higher pressure level next time.</p>}
          </div>
        </div>
      </section>

      {d.lessons.length > 0 && (
        <section className="border-b border-line py-10">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="text-title text-mist-100">What to work on next</h2>
            <Link href="/lessons" className="text-[13px] text-mist-300 underline decoration-lume underline-offset-4 hover:text-mist-100">All lessons</Link>
          </div>
          <p className="mt-2 max-w-2xl text-callout text-mist-400">Built from this interview; each one uses your own answers as the example and ends with measured practice.</p>
          <div className="mt-5 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">{d.lessons.map((l) => <LessonCard key={l.key} l={l} />)}</div>
        </section>
      )}

      {/* The Read, part by part. */}
      <section className="border-b border-line py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-title text-mist-100">What we measured</h2>
          <p className="max-w-md text-[13px] text-mist-400">Each measure shows your range and how far to trust it. Camera-based signals are estimates. Nothing here judges appearance, accent or emotion.</p>
        </div>
        {groups.map((g) => (
          <div key={g.title} className="mt-8">
            <h3 className="flex items-baseline gap-3 text-[13px]"><span className="font-medium text-mist-200">{g.title}</span><span className="text-mist-400">{g.blurb}</span></h3>
            <div className="mt-2 border-t border-line">{g.rows.map((m) => <MeasureRow key={m.key} m={m} />)}</div>
          </div>
        ))}
        {d.competencies.length > 0 && (
          <div className="mt-10">
            <h3 className="text-[13px] font-medium text-mist-200">By competency</h3>
            <ul className="mt-2 border-t border-line">
              {d.competencies.map((c) => (
                <li key={c.key} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_4rem] items-center gap-4 border-b border-line py-3">
                  <span className="text-callout text-mist-100">{c.label}</span>
                  <span className="h-1 bg-line"><span className="block h-full origin-left bg-mist-300" style={{ transform: `scaleX(${Math.max(0, Math.min(1, c.avgQuality))})` }} /></span>
                  <span className="text-right font-mono text-[12px] text-mist-400">{c.answers} ans.</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[13px] text-mist-400">Lines show answer strength (structure and specificity), inferred from your transcript, not a grade of you.</p>
          </div>
        )}
      </section>

      {(d.rewrite || d.comparison) && (
        <section className="border-b border-line py-10">
          {d.rewrite && (
            <div>
              <h2 className="text-title text-mist-100">Your weakest answer, tightened</h2>
              <p className="mt-3 font-display text-[17px] italic text-mist-400">{d.rewrite.question}</p>
              <div className="mt-6 grid gap-x-10 gap-y-6 lg:grid-cols-2">
                <figure className="border-t border-line pt-4"><figcaption className="text-[12px] font-medium text-mist-400">What you said</figcaption><blockquote className="mt-2 font-display text-[18px] leading-snug text-mist-300">{d.rewrite.original}</blockquote></figure>
                <figure className="border-t border-lume pt-4"><figcaption className="text-[12px] font-medium text-lume">Same facts, tighter</figcaption><blockquote className="mt-2 font-display text-[18px] leading-snug text-mist-100">{d.rewrite.rewritten}</blockquote><p className="mt-3 text-[13px] text-mist-400">{d.rewrite.note} Only facts from your answer are used; [brackets] mark details only you can fill in.</p></figure>
              </div>
            </div>
          )}
          {d.comparison && (
            <div className={cn(d.rewrite && "mt-12")}>
              <h2 className="text-title text-mist-100">First session vs. now</h2>
              <p className="mt-3 text-callout text-mist-400">A {d.comparison.question.toLowerCase().startsWith("tell") ? "similar question" : "question in the same competency"}, {d.comparison.firstDate} vs. today.</p>
              <div className="mt-6 grid gap-x-10 gap-y-6 lg:grid-cols-2">
                <figure className="border-t border-line pt-4"><figcaption className="text-[12px] font-medium text-mist-400">Then</figcaption><blockquote className="mt-2 font-display text-[18px] leading-snug text-mist-300">{d.comparison.first}</blockquote></figure>
                <figure className="border-t border-mist-400 pt-4"><figcaption className="text-[12px] font-medium text-mist-200">Now</figcaption><blockquote className="mt-2 font-display text-[18px] leading-snug text-mist-100">{d.comparison.latest}</blockquote></figure>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="py-10">
        <h2 className="text-title text-mist-100">Transcript</h2>
        <ol className="mt-5 divide-y divide-line border-y border-line">
          {d.transcript.map((x) => (
            <li key={x.id}>
              <button type="button" onClick={() => seek(x.startMs)} disabled={!d.media} className={cn("grid w-full grid-cols-[3rem_minmax(0,1fr)] gap-x-4 px-1 py-4 text-left transition-colors enabled:hover:bg-ink-900 sm:grid-cols-[3rem_8rem_minmax(0,1fr)]", d.media && time > 0 && time * 1000 >= x.startMs && time * 1000 < x.endMs && "bg-bronze")}>
                <span className="pt-1 font-mono text-[12px] text-mist-400 tabular">{mmss(x.startMs)}</span>
                <span className={cn("pt-0.5 text-[13px] font-medium", x.speaker === "interviewer" ? "text-mist-400" : "text-mist-100")}>{x.who}</span>
                <span className={cn("col-start-2 font-display text-[17px] leading-snug sm:col-start-auto", x.speaker === "interviewer" ? "text-mist-300" : "text-mist-100")}>{x.text}</span>
              </button>
            </li>
          ))}
        </ol>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-8 text-[13px] text-mist-400">
        <p>{d.media?.expiresAt ? `Raw video is deleted automatically on ${new Date(d.media.expiresAt).toLocaleDateString()}.` : "Transcript and Read are kept until you delete them."}</p>
        <div className="flex items-center gap-6">
          <Link href="/playback" className="hover:text-mist-100">All sessions</Link>
          <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>Delete this session</Button>
        </div>
      </footer>
      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete session">
        <div className="p-8">
          <h2 className="text-title text-mist-100">Delete this session?</h2>
          <p className="mt-3 text-callout text-mist-300">The recording, transcript, Read and Playback are permanently removed. This can&apos;t be undone.</p>
          <div className="mt-7 flex justify-end gap-2"><Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button><Button variant="danger" loading={deleting} onClick={del}>Delete permanently</Button></div>
        </div>
      </Modal>
    </article>
  );
}

type Row = PlaybackData["metrics"][number];
type Mark = "on" | "off" | "open" | "none";

/** The Read in four parts, so a long list of numbers reads as a few plain answers. */
const GROUPS: { title: string; keys: string[]; blurb: string }[] = [
  { title: "Delivery", keys: ["pace_wpm", "filler_per_min", "pauses", "vocal_variety"], blurb: "How you sound" },
  { title: "Content", keys: ["structure_score", "specificity", "hedges_per_min"], blurb: "What you say" },
  { title: "Composure", keys: ["recovery_ms"], blurb: "How you handle a hard question" },
  { title: "Presence", keys: ["camera_engagement", "movement", "setup"], blurb: "How you come across on camera" },
];

function markOf(m: Row): Mark {
  if (m.value === null) return "none";
  if (m.targetLow === null || m.targetHigh === null) return "open";
  return m.value >= m.targetLow && m.value <= m.targetHigh ? "on" : "off";
}

function grouped(metrics: Row[], keepEmpty = false) {
  const used = new Set(GROUPS.flatMap((g) => g.keys));
  const out = GROUPS.map((g) => ({ ...g, rows: g.keys.map((k) => metrics.find((m) => m.key === k)).filter((m): m is Row => !!m) }));
  const rest = metrics.filter((m) => !used.has(m.key));
  if (rest.length) out.push({ title: "Other", keys: [], blurb: "", rows: rest });
  return keepEmpty ? out : out.filter((g) => g.rows.length);
}

/** One line per part of the Read: how many measures landed on target, as a row of ticks. */
function Breakdown({ metrics }: { metrics: Row[] }) {
  return (
    <ul className="mt-3 border-t border-line">
      {grouped(metrics, true).map((g) => {
        const marks = g.rows.map(markOf);
        const scored = marks.filter((x) => x === "on" || x === "off").length;
        const on = marks.filter((x) => x === "on").length;
        const off = g.rows.filter((m) => markOf(m) === "off").map((m) => m.label.toLowerCase());
        const verdict = !g.rows.some((m) => m.value !== null) ? "Not measured" : !scored ? "Measured, no target" : on === scored ? "On target" : `${on} of ${scored} on target`;
        const why = !g.rows.some((m) => m.value !== null) && g.title === "Presence" ? "Camera signals were off" : g.blurb;
        return (
          <li key={g.title} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-1 border-b border-line py-3.5 sm:grid-cols-[8rem_minmax(0,1fr)_auto]">
            <p className="font-medium text-mist-100">{g.title}</p>
            <p className="col-span-2 row-start-2 text-[13px] text-mist-400 sm:col-span-1 sm:row-start-auto">{off.length ? `Off target: ${off.join(", ")}` : why}</p>
            <div className="col-start-2 row-start-1 flex items-center gap-3 sm:col-start-auto sm:row-start-auto">
              <span className={cn("text-[13px]", verdict === "On target" ? "text-lume" : "text-mist-300")}>{verdict}</span>
              <span className="flex gap-1" aria-hidden>
                {marks.map((x, i) => <span key={i} className={cn("h-3 w-1.5 rounded-[1px]", x === "on" ? "bg-lume" : x === "off" ? "bg-signal-warn" : x === "open" ? "bg-mist-400" : "border border-line-strong")} />)}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** A measurement as a line of the report: value, where it sits against its target, and the evidence. */
function MeasureRow({ m }: { m: Row }) {
  const fmt = m.key === "recovery_ms" ? (v: number) => (v / 1000).toFixed(1) : (v: number) => (Math.abs(v) >= 100 ? Math.round(v).toString() : (Math.round(v * 10) / 10).toString());
  const max = m.key === "structure_score" || m.key === "specificity" || m.key === "camera_engagement" ? 100 : Math.max(m.targetHigh ?? 0, m.high ?? 0, m.value ?? 0, 1) * 1.25;
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  const mark = markOf(m);
  const unit = m.key === "recovery_ms" ? "s" : m.unit;
  return (
    <div className="grid gap-x-6 gap-y-2 border-b border-line py-4 sm:grid-cols-[11rem_7.5rem_minmax(0,1fr)]">
      <div>
        <p className="text-callout font-medium text-mist-100">{m.label}</p>
        <div className="mt-1"><ConfidenceMark confidence={m.confidence} /></div>
      </div>
      <p className="flex items-baseline gap-1.5 sm:block">
        <span className={cn("font-mono text-[24px] leading-none tabular", mark === "off" ? "text-signal-warn" : "text-mist-100")}>{m.value === null ? "n/a" : fmt(m.value)}</span>
        <span className="text-[12px] text-mist-400 sm:ml-1">{unit}</span>
      </p>
      <div className="min-w-0">
        {m.value !== null && (m.targetLow !== null || m.low !== null) && (
          <div className="relative mt-2 h-1 bg-ink-600" aria-hidden>
            {m.targetLow !== null && m.targetHigh !== null && <div className="absolute inset-y-0 bg-lume/55" style={{ left: pct(m.targetLow), width: `calc(${pct(m.targetHigh)} - ${pct(m.targetLow)})` }} />}
            {m.low !== null && m.high !== null && <div className="absolute inset-y-[-3px] border-x border-mist-300/70" style={{ left: pct(m.low), width: `calc(${pct(m.high)} - ${pct(m.low)})` }} />}
            <div className={cn("absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-ink-950", mark === "off" ? "bg-signal-warn" : "bg-mist-100")} style={{ left: pct(m.value) }} />
          </div>
        )}
        {m.targetLow !== null && m.targetHigh !== null && m.value !== null && (
          <p className="mt-2 font-mono text-[11px] text-mist-400">target {fmt(m.targetLow)}–{fmt(m.targetHigh)}{m.low !== null && m.high !== null ? ` · your range ${fmt(m.low)}–${fmt(m.high)}` : ""}</p>
        )}
        {m.note && <p className="mt-2 text-[13px] leading-relaxed text-mist-300">{m.note}</p>}
      </div>
    </div>
  );
}
