import { cn } from "./cn";
import type { Confidence } from "@/db/schema";

const CONF: Record<Confidence, { label: string; cls: string; dots: number }> = {
  high: { label: "High confidence", cls: "text-signal-good", dots: 3 },
  medium: { label: "Medium confidence", cls: "text-signal-warn", dots: 2 },
  low: { label: "Low confidence", cls: "text-mist-400", dots: 1 },
};

export function ConfidenceMark({ confidence }: { confidence: Confidence }) {
  const c = CONF[confidence];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11px]", c.cls)} title={c.label}>
      <span className="flex gap-0.5" aria-hidden>{[0, 1, 2].map((i) => <span key={i} className={cn("size-1 rounded-full", i < c.dots ? "bg-current" : "bg-white/15")} />)}</span>
      {c.label}
    </span>
  );
}

/** A measurement with its range, target band and confidence. Never a bare grade. */
export function Metric({ label, value, unit, low, high, targetLow, targetHigh, confidence, note, format, scaleMax }: {
  label: string; value: number | null; unit: string; low?: number | null; high?: number | null; targetLow?: number | null; targetHigh?: number | null;
  confidence: Confidence; note?: string; format?: (v: number) => string; scaleMax?: number;
}) {
  const fmt = format ?? ((v: number) => (Math.abs(v) >= 100 ? Math.round(v).toString() : (Math.round(v * 10) / 10).toString()));
  const max = scaleMax ?? Math.max(targetHigh ?? 0, high ?? 0, value ?? 0, 1) * 1.25;
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  const inTarget = value !== null && targetLow != null && targetHigh != null && value >= targetLow && value <= targetHigh;
  return (
    <div className="rounded-2xl border hairline bg-white/[0.02] p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] text-mist-300">{label}</p>
        <ConfidenceMark confidence={confidence} />
      </div>
      <p className="mt-3 flex items-baseline gap-1.5">
        <span className="font-display text-[44px] leading-none tracking-tight tabular">{value === null ? "—" : fmt(value)}</span>
        <span className="text-sm text-mist-400">{unit}</span>
      </p>
      {value !== null && (targetLow != null || low != null) && (
        <div className="relative mt-5 h-1.5 rounded-full bg-white/[0.05]" aria-hidden>
          {targetLow != null && targetHigh != null && <div className="absolute inset-y-0 rounded-full bg-signal-good/20" style={{ left: pct(targetLow), width: `calc(${pct(targetHigh)} - ${pct(targetLow)})` }} />}
          {low != null && high != null && <div className="absolute inset-y-[-2px] rounded-full border border-mist-300/40" style={{ left: pct(low), width: `calc(${pct(high)} - ${pct(low)})` }} />}
          <div className={cn("absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full", inTarget ? "bg-signal-good" : "bg-lume")} style={{ left: pct(value) }} />
        </div>
      )}
      {(targetLow != null && targetHigh != null) && value !== null && (
        <p className="mt-2 text-[11px] text-mist-400 font-mono">target {fmt(targetLow)}–{fmt(targetHigh)}{low != null && high != null ? ` · your range ${fmt(low)}–${fmt(high)}` : ""}</p>
      )}
      {note && <p className="mt-3 text-[13px] leading-relaxed text-mist-300">{note}</p>}
    </div>
  );
}
