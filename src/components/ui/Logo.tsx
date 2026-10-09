import { cn } from "./cn";

/**
 * The mark is the interviewer's face: an ivory rounded square with two upright eyes, the same
 * geometry the avatar is drawn from. With `blink` it doubles as Oriel's loading state.
 */
export function LogoMark({ className, blink }: { className?: string; blink?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-6", className)} aria-hidden>
      <rect x="1.5" y="3.5" width="21" height="17" rx="6.5" fill="var(--color-mist-100)" />
      <g className={cn("[transform-box:fill-box] origin-center", blink && "motion-safe:animate-[blink_3.6s_ease-in-out_infinite]")}>
        <rect x="7.2" y="8" width="2.9" height="7.4" rx="1.45" fill="var(--color-ink-950)" />
        <rect x="13.9" y="8" width="2.9" height="7.4" rx="1.45" fill="var(--color-ink-950)" />
      </g>
    </svg>
  );
}

/** The wordmark is set in the serif: Oriel speaks in the same voice as its headlines. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-mist-100", className)}>
      <LogoMark />
      <span className="font-display text-[23px] font-medium leading-none tracking-[-0.01em]">Oriel</span>
    </span>
  );
}

/** A waiting state in Oriel's own shape: the face, blinking, with a line beneath. */
export function Thinking({ label, className }: { label: string; className?: string }) {
  return (
    <span role="status" className={cn("inline-flex items-center gap-2.5 text-callout text-mist-300", className)}>
      <LogoMark blink className="size-5" />
      {label}
    </span>
  );
}
