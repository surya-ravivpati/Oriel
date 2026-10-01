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
        <span className="font-mono text-sm text-lume tabular">{mmss(clip.startMs)}</span>
        <span className="text-mist-100">{clip.title}</span>
        <span className="ml-auto hidden sm:block"><ConfidenceMark confidence={clip.confidence} /></span>
      </div>
      <p className="mt-1.5 line-clamp-1 text-xs text-mist-400">Q: {clip.questionText}</p>
      <p className="mt-3 text-sm leading-relaxed text-mist-300">{clip.observed}</p>
      <p className="mt-2 text-sm leading-relaxed text-mist-100">{clip.suggestion.startsWith("Try:") ? <><span className="text-lume">Try:</span>{clip.suggestion.slice(4)}</> : clip.suggestion}</p>
    </>
  );
  const cls = cn("block w-full rounded-2xl border p-5 text-left transition-all duration-300", active ? "border-lume/40 bg-lume/[0.06]" : "hairline bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/15");
  if (href) return <Link href={href} className={cls}>{body}</Link>;
  return <button type="button" onClick={onClick} className={cls} aria-pressed={active}>{body}</button>;
}

export function DrillCard({ drill, recommended, lastValue }: { drill: { id: string; title: string; objective: string; durationSec: number; requiresCamera: boolean }; recommended?: string | null; lastValue?: string | null }) {
  return (
    <Link href={`/drills/${drill.id}`} className={cn("group flex flex-col rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-0.5", recommended ? "border-lume/35 bg-lume/[0.05]" : "hairline bg-white/[0.02] hover:bg-white/[0.04]")}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-widest text-mist-400">{Math.round(drill.durationSec / 60) || 1} min{drill.requiresCamera ? " · camera" : ""}</span>
        {recommended && <span className="rounded-full bg-lume/15 px-2 py-0.5 text-[11px] text-lume">Recommended</span>}
      </div>
      <p className="mt-4 font-display text-2xl leading-tight">{drill.title}</p>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-mist-400">{drill.objective}</p>
      {recommended && <p className="mt-3 text-[13px] text-mist-300">{recommended}</p>}
      <div className="mt-5 flex items-center justify-between text-sm">
        <span className="text-mist-400">{lastValue ? `Last: ${lastValue}` : "Not tried yet"}</span>
        <span className="text-mist-100 transition-transform group-hover:translate-x-0.5">Start →</span>
      </div>
    </Link>
  );
}

export function LadderStep({ step, current }: { step: { level: number; name: string; description: string; unlocked: boolean; completed: boolean; qualifying: number; mode: string; personaIds: string[]; pressure: number }; current: boolean }) {
  return (
    <div className={cn("relative flex gap-5 rounded-2xl border p-5 transition-all", current ? "border-lume/40 bg-lume/[0.05]" : step.unlocked ? "hairline bg-white/[0.02]" : "hairline bg-transparent opacity-55")}>
      <div className={cn("grid size-10 shrink-0 place-items-center rounded-full border font-mono text-sm", step.completed ? "border-signal-good/40 text-signal-good" : current ? "border-lume/50 text-lume" : "hairline-strong text-mist-400")}>
        {step.completed ? "✓" : step.unlocked ? String(step.level).padStart(2, "0") : "🔒"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <p className="text-mist-100">{step.name}</p>
          <p className="font-mono text-[11px] text-mist-400">{step.mode === "panel" ? `${step.personaIds.length}-person panel` : "one-on-one"} · pressure {step.pressure}/5</p>
        </div>
        <p className="mt-1 text-sm text-mist-400">{step.description}</p>
        {step.unlocked && !step.completed && <p className="mt-2 text-[12px] text-mist-300">{step.qualifying}/2 sessions above your baseline</p>}
      </div>
    </div>
  );
}
