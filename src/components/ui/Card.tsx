import { cn } from "./cn";

/**
 * A ruled panel: a hairline frame, no fill, no shadow. Only for a real object the eye should
 * read as one thing (a form, a recording, a plan); sections and lists are separated by rules.
 */
export function Card({ className, children, as: As = "div", ...rest }: { className?: string; children: React.ReactNode; as?: "div" | "section" | "article" } & React.HTMLAttributes<HTMLElement>) {
  return <As className={cn("rounded-control border border-divider", className)} {...rest}>{children}</As>;
}

/** The small label above a heading. Quiet: it orients, it doesn't decorate, and never repeats the navigation. */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-meta font-medium text-stone", className)}>{children}</p>;
}

/** A status, said in words with a coloured mark, not wrapped in a pill. */
export function Badge({ children, tone = "neutral", className }: { children: React.ReactNode; tone?: "neutral" | "lume" | "good" | "warn" | "bad"; className?: string }) {
  const tones = {
    neutral: "text-stone [--dot:var(--color-stone-dim)]",
    lume: "text-olive-light [--dot:var(--color-olive-light)]",
    good: "text-signal-good [--dot:var(--color-signal-good)]",
    warn: "text-signal-warn [--dot:var(--color-signal-warn)]",
    bad: "text-signal-bad [--dot:var(--color-signal-bad)]",
  };
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-meta font-medium", tones[tone], className)}>
      <span className="size-1.5 shrink-0 rounded-full bg-[var(--dot)]" aria-hidden />
      {children}
    </span>
  );
}
