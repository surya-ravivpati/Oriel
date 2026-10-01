import { cn } from "./cn";
export function ProgressBar({ value, max = 1, className, label }: { value: number; max?: number; className?: string; label?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={cn("h-1 w-full overflow-hidden rounded-full bg-white/[0.06]", className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="h-full rounded-full bg-gradient-to-r from-lume-deep to-lume transition-[width] duration-700 ease-[var(--ease-out-expo)]" style={{ width: `${pct}%` }} />
    </div>
  );
}
