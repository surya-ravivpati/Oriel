import { EYE } from "@/components/avatar/bot/draw";
import { shapeGeom } from "@/components/avatar/bot/shapes";
import { BOT_COLORS } from "@/lib/avatar/style";
import { cn } from "@/components/ui/cn";

/*
 * The mark: a vector reduction of the Classic interviewer (the ivory squircle every new account
 * meets as Daniel), drawn from the renderer's own geometry, so the logo and the avatars cannot
 * drift apart. Same outline, same eye proportions and placement, same colours; the studio
 * drawing is flat, as on the canvas: one colour for the face, solid eyes.
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
const LOOK = BOT_COLORS.ivory;
const VIEW = `${-HALF_W - 0.5} ${-HALF_H - 0.5} ${HALF_W * 2 + 1} ${HALF_H * 2 + 1}`;

export function Interviewer({ size = 24, waiting = false, className, title }: {
  /** Rendered width in px. */
  size?: number;
  /** A slow, repeating blink: the loading state inside the app. Still under reduced motion. */
  waiting?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <svg viewBox={VIEW} width={size} height={(size * (HALF_H * 2 + 1)) / (HALF_W * 2 + 1)} className={cn("h-auto shrink-0", className)}
      role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      {/* Flat, like the canvas faces: one fill for the face, solid eyes. */}
      <path d={OUTLINE} fill={LOOK.face} />
      <g className={cn("[transform-box:fill-box] origin-center", waiting && "motion-safe:animate-[blink_3.6s_ease-in-out_infinite]")}>
        {[-1, 1].map((side) => (
          <rect key={side} x={side * EYE_X - EYE_W / 2} y={EYE_Y - EYE_H / 2} width={EYE_W} height={EYE_H} rx={EYE_W / 2} fill={LOOK.eye} />
        ))}
      </g>
    </svg>
  );
}
