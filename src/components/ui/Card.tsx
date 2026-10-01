import { cn } from "./cn";

export function Card({ className, children, as: As = "div", ...rest }: { className?: string; children: React.ReactNode; as?: "div" | "section" | "article" } & React.HTMLAttributes<HTMLElement>) {
  return <As className={cn("rounded-2xl border hairline bg-gradient-to-b from-white/[0.035] to-white/[0.01] backdrop-blur-[2px]", className)} {...rest}>{children}</As>;
}

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("font-mono text-[11px] uppercase tracking-[0.18em] text-mist-400", className)}>{children}</p>;
}

export function Badge({ children, tone = "neutral", className }: { children: React.ReactNode; tone?: "neutral" | "lume" | "good" | "warn" | "bad"; className?: string }) {
  const tones = {
    neutral: "bg-white/[0.06] text-mist-300 border-white/10",
    lume: "bg-lume/10 text-lume border-lume/25",
    good: "bg-signal-good/10 text-signal-good border-signal-good/25",
    warn: "bg-signal-warn/10 text-signal-warn border-signal-warn/25",
    bad: "bg-signal-bad/10 text-signal-bad border-signal-bad/25",
  };
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide", tones[tone], className)}>{children}</span>;
}
