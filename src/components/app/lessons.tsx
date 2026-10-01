import Link from "next/link";
import { cn } from "@/components/ui/cn";
import { LESSONS, PRACTICE_PASSES_NEEDED as PRACTICE_NEEDED, TRACKS, formatMeasure } from "@/lib/lessons/library";
import type { LessonEvidence, LessonKey, Track } from "@/lib/lessons/types";

export interface LessonSummary {
  key: LessonKey;
  status: "active" | "queued" | "mastered";
  evidence: Pick<LessonEvidence, "display" | "target"> | null;
  practicePasses: number;
  viewed: boolean;
  metricKey?: string;
  startValue?: number | null;
  latestValue?: number | null;
}

export function summarize(r: { lessonKey: string; status: "active" | "queued" | "mastered"; evidence: LessonEvidence; practicePasses: number; viewedAt: Date | null; metricKey: string; startValue: number | null; latestValue: number | null }): LessonSummary {
  return { key: r.lessonKey as LessonKey, status: r.status, evidence: r.evidence, practicePasses: r.practicePasses, viewed: !!r.viewedAt, metricKey: r.metricKey, startValue: r.startValue, latestValue: r.latestValue };
}


/** Learn → practise → use it in an interview: where a lesson stands. Only what actually happened is ticked. */
export function LessonSteps({ l, className }: { l: LessonSummary; className?: string }) {
  const practised = l.practicePasses >= PRACTICE_NEEDED;
  const steps = [
    { label: "Learn", done: l.viewed || l.practicePasses > 0 },
    { label: practised ? "Practised" : `Practise ${Math.min(l.practicePasses, PRACTICE_NEEDED)}/${PRACTICE_NEEDED}`, done: practised },
    { label: l.status === "mastered" ? "Confirmed in an interview" : "Use it in an interview", done: l.status === "mastered" },
  ];
  return (
    <ol className={cn("flex gap-1.5", className)} aria-label="Lesson progress">
      {steps.map((s) => (
        <li key={s.label} className="min-w-0 flex-1">
          <span className={cn("block h-1 rounded-full", s.done ? "bg-lume" : "bg-white/10")} />
          <span className={cn("mt-1.5 block truncate text-[11px]", s.done ? "text-mist-200" : "text-mist-400")}>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

export function TrackLabel({ track, className }: { track: Track; className?: string }) {
  return <span className={cn("font-mono text-[10px] uppercase tracking-[0.18em] text-mist-400", className)}>{TRACKS[track].label}</span>;
}

export function LessonCard({ l }: { l: LessonSummary }) {
  const def = LESSONS[l.key];
  return (
    <Link href={`/lessons/${l.key}`} className={cn("group block rounded-2xl border p-5 transition-colors duration-200", l.status === "active" ? "hairline-strong bg-white/[0.025] hover:bg-white/[0.05]" : "hairline hover:bg-white/[0.03]")}>
      <div className="flex items-start justify-between gap-3">
        <TrackLabel track={def.track} />
        {l.status === "queued" && <span className="rounded-full border hairline px-2 py-0.5 text-[10px] text-mist-400">Up next</span>}
        {l.status === "mastered" && <span className="rounded-full border border-signal-good/30 px-2 py-0.5 text-[10px] text-signal-good">Mastered</span>}
      </div>
      <p className="mt-2 font-display text-2xl leading-tight text-mist-100 group-hover:text-white">{def.title}</p>
      {l.status === "mastered" && l.metricKey && l.startValue != null && l.latestValue != null && l.startValue !== l.latestValue ? (
        <p className="mt-2 text-sm text-mist-400">was {formatMeasure(l.metricKey, l.startValue)} · <span className="text-signal-good">now {formatMeasure(l.metricKey, l.latestValue)}</span></p>
      ) : l.evidence && <p className="mt-2 text-sm text-mist-300"><span className="text-mist-100">{l.evidence.display}</span> <span className="text-mist-400">· target {l.evidence.target}</span></p>}
      {l.status !== "queued" && <LessonSteps l={l} className="mt-4" />}
    </Link>
  );
}
