import { EYE, EYE_HIGHLIGHT } from "@/components/avatar/bot/draw";
import { shapeGeom } from "@/components/avatar/bot/shapes";
import { BOT_COLORS } from "@/lib/avatar/style";
import { cn } from "@/components/ui/cn";

/*
 * The mark: a vector reduction of the Classic interviewer (the ivory squircle every new account
 * meets as Daniel), drawn from the renderer's own geometry, so the logo and the avatars cannot
 * drift apart. Same outline, same eye proportions and placement, same colours; the studio
 * lighting is reduced to one soft gradient, and dropped entirely at icon sizes.
 */
const geom = shapeGeom("squircle");
const U = 100; // units of S, the avatar's own scale
const f = (n: number) => Math.round(n * U * 10) / 10;
const OUTLINE = (() => {
  const o = geom.outline, pts: string[] = [];
  for (let i = 0; i < o.length; i += 8) pts.push(`${f(o[i])} ${f(o[i + 1])}`); // 90 of the 360 resampled points
  return `M${pts.join("L")}Z`;
})();
const HALF_W = Math.max(...Array.from(geom.outline.filter((_, i) => i % 2 === 0), Math.abs)) * U;
const HALF_H = Math.abs(geom.outline[1]) * U;
const EYE_W = EYE.width * geom.eyeK * U, EYE_H = EYE_W * EYE.ratio;
const EYE_X = geom.spacing * U, EYE_Y = geom.eyeY * U;
const HL_W = EYE_W * EYE_HIGHLIGHT.width, HL_H = Math.min(EYE_H * EYE_HIGHLIGHT.height, EYE_W * EYE_HIGHLIGHT.maxHeightToWidth);
const LOOK = BOT_COLORS.ivory;
const VIEW = `${-HALF_W - 0.5} ${-HALF_H - 0.5} ${HALF_W * 2 + 1} ${HALF_H * 2 + 1}`;

export function Interviewer({ size = 24, waiting = false, className, title }: {
  /** Rendered width in px; below 40 the face is flat, as an icon should be. */
  size?: number;
  /** A slow, repeating blink: the loading state inside the app. Still under reduced motion. */
  waiting?: boolean;
  className?: string;
  title?: string;
}) {
  const small = size < 40;
  // Deterministic, so server and client agree; marks of the same size share identical gradients.
  const id = `oriel-mark-${Math.round(size)}`;
  return (
    <svg viewBox={VIEW} width={size} height={(size * (HALF_H * 2 + 1)) / (HALF_W * 2 + 1)} className={cn("h-auto shrink-0", className)}
      role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      {!small && (
        <defs>
          {/* drawBot's body and key light, in bounding-box units: a focal point up and to the left, the edge in shade. */}
          <radialGradient id={`${id}-face`} cx="0.5" cy="0.5" r="0.575" fx="0.41" fy="0.275" fr="0.05">
            <stop offset="0" stopColor={LOOK.face} />
            <stop offset="0.55" stopColor={LOOK.face} />
            <stop offset="1" stopColor={LOOK.shade} />
          </radialGradient>
          <radialGradient id={`${id}-key`} cx="0.325" cy="0.225" r="0.625">
            <stop offset="0" stopColor="rgb(255 250 242)" stopOpacity="0.35" />
            <stop offset="0.45" stopColor="rgb(255 250 242)" stopOpacity="0.05" />
            <stop offset="1" stopColor="rgb(255 248 236)" stopOpacity="0" />
          </radialGradient>
        </defs>
      )}
      <path d={OUTLINE} fill={small ? LOOK.face : `url(#${id}-face)`} />
      {!small && <path d={OUTLINE} fill={`url(#${id}-key)`} />}
      <g className={cn("[transform-box:fill-box] origin-center", waiting && "motion-safe:animate-[blink_3.6s_ease-in-out_infinite]")}>
        {[-1, 1].map((side) => (
          <g key={side}>
            <rect x={side * EYE_X - EYE_W / 2} y={EYE_Y - EYE_H / 2} width={EYE_W} height={EYE_H} rx={EYE_W / 2} fill={LOOK.eye} />
            {!small && (
              <rect x={side * EYE_X + EYE_W * EYE_HIGHLIGHT.dx - HL_W / 2} y={EYE_Y + EYE_H * EYE_HIGHLIGHT.dy - HL_H / 2} width={HL_W} height={HL_H} rx={HL_W / 2}
                fill={LOOK.highlight} opacity={EYE_HIGHLIGHT.alpha} />
            )}
          </g>
        ))}
      </g>
    </svg>
  );
}
