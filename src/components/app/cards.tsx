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
        <span className="font-mono text-meta text-olive-light tabular">{mmss(clip.startMs)}</span>
        <span className="font-medium text-ivory">{clip.title}</span>
        <span className="ml-auto hidden sm:block"><ConfidenceMark confidence={clip.confidence} /></span>
      </div>
      <p className="mt-1.5 line-clamp-1 font-display text-ui italic text-stone-dim">{clip.questionText}</p>
      <p className="mt-3 text-ui text-stone">{clip.observed}</p>
      <p className="mt-2 text-ui text-ivory">{clip.suggestion.startsWith("Try:") ? <><span className="font-medium text-olive-light">Try:</span>{clip.suggestion.slice(4)}</> : clip.suggestion}</p>
    </>
  );
  const cls = cn("block w-full border-t px-1 py-5 text-left transition-colors duration-150", active ? "border-olive-light bg-olive-ground/60" : "border-divider hover:bg-surface-1");
  if (href) return <Link href={href} className={cls}>{body}</Link>;
  return <button type="button" onClick={onClick} className={cls} aria-pressed={active}>{body}</button>;
}

export function DrillCard({ drill, recommended, lastValue }: { drill: { id: string; title: string; objective: string; durationSec: number; requiresCamera: boolean }; recommended?: string | null; lastValue?: string | null }) {
  return (
    <Link href={`/drills/${drill.id}`} className={cn("group flex flex-col border-t pb-2 pt-4 transition-colors duration-150", recommended ? "border-olive-light" : "border-control hover:border-stone-dim")}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-meta text-stone-dim">{Math.round(drill.durationSec / 60) || 1} min{drill.requiresCamera ? " · camera" : ""}</span>
        {recommended && <span className="text-meta font-medium text-olive-light">Recommended</span>}
      </div>
      <p className="mt-3 font-display text-[26px] leading-[1.15] text-ivory">{drill.title}</p>
      <p className="mt-2 flex-1 text-ui text-stone">{drill.objective}</p>
      {recommended && <p className="mt-3 text-meta text-ivory">{recommended}</p>}
      <div className="mt-5 flex items-center justify-between text-ui">
        <span className="text-stone-dim">{lastValue ? `Last: ${lastValue}` : "Not tried yet"}</span>
        <span className="font-medium text-ivory underline decoration-olive-light decoration-1 underline-offset-4 group-hover:decoration-2">Start</span>
      </div>
    </Link>
  );
}

export function LadderStep({ step, current }: { step: { level: number; name: string; description: string; unlocked: boolean; completed: boolean; qualifying: number; mode: string; personaIds: string[]; pressure: number }; current: boolean }) {
  return (
    <div className={cn("relative grid grid-cols-[3rem_1fr] gap-x-4 border-t py-5", current ? "border-olive-light" : "border-divider", !step.unlocked && "opacity-55")}>
      <span className={cn("pt-0.5 font-mono text-meta tabular", step.completed ? "text-signal-good" : current ? "text-olive-light" : "text-stone-dim")}>{String(step.level).padStart(2, "0")}</span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="font-display text-[22px] leading-tight text-ivory">{step.name}</p>
          <p className="font-mono text-meta text-stone-dim">{step.mode === "panel" ? `${step.personaIds.length}-person panel` : "one-on-one"} · pressure {step.pressure}/5</p>
          <p className={cn("ml-auto text-meta font-medium", step.completed ? "text-signal-good" : current ? "text-olive-light" : "text-stone-dim")}>{step.completed ? "Done" : current ? "You are here" : step.unlocked ? "Open" : "Locked"}</p>
        </div>
        <p className="mt-1 text-ui text-stone">{step.description}</p>
        {step.unlocked && !step.completed && <p className="mt-2 font-mono text-meta text-stone">{step.qualifying}/2 sessions above your baseline</p>}
      </div>
    </div>
  );
}
