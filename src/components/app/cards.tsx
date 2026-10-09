import Link from "next/link";
import { cn } from "@/components/ui/cn";
import { ConfidenceMark } from "@/components/ui/Metric";
import { mmss } from "@/lib/format";
import type { Confidence } from "@/db/schema";

export function PlaybackClipCard({ clip, href, active, onClick }: {
  clip: { startMs: number; title: string; observed: string; suggestion: string; confidence: Confidence; questionText: string };
  href?: string; active?: boolean; onClick?: () => void;
}) {
  const body = (
    <>
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[13px] text-lume tabular">{mmss(clip.startMs)}</span>
        <span className="font-medium text-mist-100">{clip.title}</span>
        <span className="ml-auto hidden sm:block"><ConfidenceMark confidence={clip.confidence} /></span>
      </div>
      <p className="mt-1.5 line-clamp-1 font-display text-[15px] italic text-mist-400">{clip.questionText}</p>
      <p className="mt-3 text-callout text-mist-300">{clip.observed}</p>
      <p className="mt-2 text-callout text-mist-100">{clip.suggestion.startsWith("Try:") ? <><span className="font-medium text-lume">Try:</span>{clip.suggestion.slice(4)}</> : clip.suggestion}</p>
    </>
  );
  const cls = cn("block w-full border-t px-1 py-5 text-left transition-colors duration-150", active ? "border-lume bg-bronze/60" : "border-line hover:bg-ink-900");
  if (href) return <Link href={href} className={cls}>{body}</Link>;
  return <button type="button" onClick={onClick} className={cls} aria-pressed={active}>{body}</button>;
}

export function DrillCard({ drill, recommended, lastValue }: { drill: { id: string; title: string; objective: string; durationSec: number; requiresCamera: boolean }; recommended?: string | null; lastValue?: string | null }) {
  return (
    <Link href={`/drills/${drill.id}`} className={cn("group flex flex-col border-t pb-2 pt-4 transition-colors duration-150", recommended ? "border-lume" : "border-line-strong hover:border-mist-400")}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[12px] text-mist-400">{Math.round(drill.durationSec / 60) || 1} min{drill.requiresCamera ? " · camera" : ""}</span>
        {recommended && <span className="text-[12px] font-medium text-lume">Recommended</span>}
      </div>
      <p className="mt-3 font-display text-[26px] leading-[1.15] text-mist-100">{drill.title}</p>
      <p className="mt-2 flex-1 text-callout text-mist-300">{drill.objective}</p>
      {recommended && <p className="mt-3 text-[13px] text-mist-200">{recommended}</p>}
      <div className="mt-5 flex items-center justify-between text-[14px]">
        <span className="text-mist-400">{lastValue ? `Last: ${lastValue}` : "Not tried yet"}</span>
        <span className="font-medium text-mist-100 underline decoration-lume decoration-1 underline-offset-4 group-hover:decoration-2">Start</span>
      </div>
    </Link>
  );
}

export function LadderStep({ step, current }: { step: { level: number; name: string; description: string; unlocked: boolean; completed: boolean; qualifying: number; mode: string; personaIds: string[]; pressure: number }; current: boolean }) {
  return (
    <div className={cn("relative grid grid-cols-[3rem_1fr] gap-x-4 border-t py-5", current ? "border-lume" : "border-line", !step.unlocked && "opacity-55")}>
      <span className={cn("pt-0.5 font-mono text-[13px] tabular", step.completed ? "text-signal-good" : current ? "text-lume" : "text-mist-400")}>{String(step.level).padStart(2, "0")}</span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="font-display text-[22px] leading-tight text-mist-100">{step.name}</p>
          <p className="font-mono text-[12px] text-mist-400">{step.mode === "panel" ? `${step.personaIds.length}-person panel` : "one-on-one"} · pressure {step.pressure}/5</p>
          <p className={cn("ml-auto text-[12px] font-medium", step.completed ? "text-signal-good" : current ? "text-lume" : "text-mist-400")}>{step.completed ? "Done" : current ? "You are here" : step.unlocked ? "Open" : "Locked"}</p>
        </div>
        <p className="mt-1 text-callout text-mist-300">{step.description}</p>
        {step.unlocked && !step.completed && <p className="mt-2 font-mono text-[12px] text-mist-300">{step.qualifying}/2 sessions above your baseline</p>}
      </div>
    </div>
  );
}
