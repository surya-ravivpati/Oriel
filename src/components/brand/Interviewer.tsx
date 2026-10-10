import { cn } from "@/components/ui/cn";

export type InterviewerState = "idle" | "listening" | "speaking";

/**
 * Oriel's interviewer: an ivory rounded face with two upright eyes, drawn in inline SVG from
 * tokens. One geometry everywhere: the wordmark (24px), the favicon, and the preview (~140px).
 * Static by default. Motion is opted into by a single instance (the landing preview), which sets
 * `data-blink` and `state` from the client; reduced-motion users always get the still face.
 */
export function Interviewer({ size = 140, state = "idle", blink = false, waiting = false, className, title }: {
  size?: number;
  state?: InterviewerState;
  /** A single blink, driven by the one animated instance. */
  blink?: boolean;
  /** A slow, repeating blink in CSS: the loading state inside the app. */
  waiting?: boolean;
  className?: string;
  title?: string;
}) {
  const small = size < 40;
  // Listening: attention shifts slightly toward the conversation (right on desktop, down on phones).
  const look = state === "listening" ? "translate(2.5px, 1.5px)" : "translate(0, 0)";
  return (
    <svg viewBox="0 0 120 96" width={size} height={size * 0.8} className={cn("h-auto shrink-0", className)} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      {!small && (
        <defs>
          <linearGradient id="oriel-face" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--color-ivory)" />
            <stop offset="1" stopColor="var(--color-ivory-press)" />
          </linearGradient>
        </defs>
      )}
      <rect x="2" y="2" width="116" height="92" rx="34" fill={small ? "var(--color-ivory)" : "url(#oriel-face)"} />
      <g style={{ transform: look, transition: "transform var(--dur-panel) var(--ease-state)" }}>
        <g className={cn("[transform-box:fill-box] origin-center", state === "speaking" && "motion-safe:animate-[speak_1.6s_var(--ease-state)_infinite]")}>
          <g className={cn("[transform-box:fill-box] origin-center transition-transform duration-[75ms]", blink && "scale-y-[0.1]", waiting && "motion-safe:animate-[blink_3.6s_ease-in-out_infinite]")}>
            <rect x={small ? 33 : 36} y={small ? 28 : 31} width={small ? 15 : 12} height={small ? 40 : 34} rx={small ? 7.5 : 6} fill="var(--color-ink)" />
            <rect x={small ? 72 : 72} y={small ? 28 : 31} width={small ? 15 : 12} height={small ? 40 : 34} rx={small ? 7.5 : 6} fill="var(--color-ink)" />
            {!small && (
              <>
                <rect x="40" y="36" width="3.5" height="9" rx="1.75" fill="var(--color-ivory)" opacity="0.85" />
                <rect x="76" y="36" width="3.5" height="9" rx="1.75" fill="var(--color-ivory)" opacity="0.85" />
              </>
            )}
          </g>
        </g>
      </g>
    </svg>
  );
}
