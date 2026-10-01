import { cn } from "./cn";

/** The mark: a bay window seen from above — three lit panes jutting out of a wall. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-6", className)} aria-hidden>
      <path d="M3 22h26" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <path d="M7 22l3-10h12l3 10" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
      <path d="M10.6 21l2-7h6.8l2 7z" fill="var(--color-lume)" opacity="0.9" />
      <path d="M13.3 14v7M18.7 14v7" stroke="var(--color-ink-950)" strokeWidth="0.8" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-mist-100", className)}>
      <LogoMark />
      <span className="font-display text-[22px] leading-none tracking-tight">Oriel</span>
    </span>
  );
}
