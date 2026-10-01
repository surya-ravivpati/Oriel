"use client";

import { useEffect, useRef, useState } from "react";
import type { AvatarStore } from "@/lib/avatar/store";
import type { AvatarSeatConfig } from "@/lib/avatar/types";
import { cn } from "@/components/ui/cn";
import { drawBot, type BotPose } from "./bot/draw";
import { lookFor, type BotLook } from "./bot/looks";
import { approachGeom, cloneGeom, shapeGeom } from "./bot/shapes";
import { Spring, stepAll } from "./bot/springs";

/**
 * The Oriel interviewer: a minimal bot whose eyes carry the conversation.
 *
 *   idle        slow breathing bob, calm curious gaze, natural blinks
 *   listening   eyes on you, occasional nod (never constant), micro-saccades
 *   thinking    a glance up and aside, lids lowered a touch, then back
 *   speaking    eyes lift with the voice, the voice light breathes, small head beats
 *   interrupting leans in, eyes widen and flatten — it is about to cut in
 *   pressure    fewer movements, fewer blinks, a steadier, flatter stare
 *
 * Persona temperament (warmth, skepticism, expressiveness) shapes every state:
 * the recruiter smiles with its eyes; the skeptic narrows one eye; the executive barely moves.
 */
export function BotAvatar({ store, seats, className, labels, compact }: {
  store: AvatarStore;
  seats: AvatarSeatConfig[];
  className?: string;
  labels?: (seat: AvatarSeatConfig, active: boolean) => React.ReactNode;
  compact?: boolean;
}) {
  const [active, setActive] = useState(store.activeSeat);
  useEffect(() => {
    const id = setInterval(() => setActive((a) => (a !== store.activeSeat ? store.activeSeat : a)), 120);
    return () => clearInterval(id);
  }, [store]);
  const panel = seats.length > 1;
  const activeIndex = Math.max(0, seats.findIndex((s) => s.seat === active));
  return (
    <div className={cn("flex items-center justify-center overflow-hidden", className)} aria-hidden={!labels}>
      <div
        className={cn("flex w-full items-center justify-center gap-[2vw] transition-transform duration-700 ease-[var(--ease-out-expo)]", compact && "h-full")}
        style={{ transform: panel ? `translateX(${((seats.length - 1) / 2 - activeIndex) * 2.5}%)` : undefined }}
      >
        {seats.map((s) => {
          const isActive = !panel || s.seat === active;
          return (
            <div key={s.seat}
              className={cn("relative flex min-w-0 flex-col items-center transition-all duration-700 ease-[var(--ease-out-expo)]", panel ? "flex-1 max-w-[34vw]" : "w-full", compact && "h-full")}
              style={{ transform: panel ? `scale(${isActive ? 1.06 : 0.9})` : undefined, opacity: panel ? (isActive ? 1 : 0.72) : 1 }}>
              <BotSeat store={store} seat={s} count={seats.length} className={cn(compact ? "h-full w-full" : panel ? "aspect-square w-full" : "aspect-square w-[min(72vw,62vh,640px)]")} />
              {labels && <div className="-mt-[6%]">{labels(s, isActive)}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

type Rgb = [number, number, number];
const rgbOf = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
const hexOf = (c: Rgb) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
const PAINT = ["face", "faceShade", "eye", "highlight"] as const;
const lookKey = (l: BotLook) => `${l.shape}|${l.face}|${l.accessory}`;

function BotSeat({ store, seat, count, className }: { store: AvatarStore; seat: AvatarSeatConfig; count: number; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  // Read every frame, so restyling a bot morphs it in place instead of restarting it.
  const seatRef = useRef(seat);
  useEffect(() => { seatRef.current = seat; }, [seat]);
  useEffect(() => {
    const el = canvas.current;
    const wrap = box.current;
    if (!el || !wrap) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    let source = seatRef.current;
    let look = lookFor(source.personaId, source.style);
    const geom = cloneGeom(shapeGeom(look.shape));
    const paint = Object.fromEntries(PAINT.map((k) => [k, rgbOf(look[k])])) as Record<(typeof PAINT)[number], Rgb>;
    const sp: Record<keyof BotPose, Spring> = {
      yaw: new Spring(0, 90, 18), roll: new Spring(0, 80, 16), bob: new Spring(0, 140, 20), scale: new Spring(1, 120, 18),
      gazeX: new Spring(0, 260, 26), gazeY: new Spring(0, 260, 26), open: new Spring(1, 420, 30),
      lidTopL: new Spring(0, 160, 22), lidTopR: new Spring(0, 160, 22), tiltL: new Spring(0, 120, 20), tiltR: new Spring(0, 120, 20),
      happy: new Spring(0, 140, 20), eyeScale: new Spring(1, 200, 22), voice: new Spring(0, 380, 28), blush: new Spring(0, 60, 14), glow: new Spring(0, 90, 16),
    };
    const b = {
      gazeX: 0, gazeY: 0, nextSaccade: 0, blinkAt: rand(1, 3), blinkStart: -10, nodStart: -10, nextNod: rand(5, 9),
      lastMode: "", thinkUntil: 0, thinkDir: 1, avertUntil: 0, happyUntil: 0, popUntil: 0, phase: rand(0, 10),
    };
    let raf = 0;
    let last = performance.now();
    let W = 0, H = 0;

    // The wrapper owns the layout size; the canvas is absolutely positioned so its
    // pixel-size attribute can never feed back into layout.
    const resize = () => {
      const r = wrap.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = r.width; H = r.height;
      el.width = Math.max(1, Math.round(W * dpr));
      el.height = Math.max(1, Math.round(H * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      const seat = seatRef.current;
      if (seat !== source) {
        const next = lookFor(seat.personaId, seat.style);
        if (lookKey(next) !== lookKey(look)) b.popUntil = t + 0.16;
        look = next;
        source = seat;
      }
      const isActive = store.activeSeat === seat.seat;
      const mode = isActive ? store.mode : store.mode === "listening" ? "listening" : "attending";
      const still = Math.min(1, store.stillness * 0.7 + (1 - seat.expressiveness) * 0.35);
      const pressure = store.pressure;
      const level = isActive && (mode === "speaking" || mode === "interrupting") ? store.level() : 0;
      const cue = store.cue && store.cue.seat === seat.seat ? store.cue : null;
      const cueAge = cue ? store.now() - cue.at : 99;
      const move = reduced ? 0.25 : 1;

      // State transitions.
      if (mode !== b.lastMode) {
        if (mode === "thinking") { b.thinkUntil = t + rand(0.6, 1.2) * (1 + seat.skepticism * 0.4); b.thinkDir = Math.random() < 0.5 ? -1 : 1; }
        if (mode === "speaking" && Math.random() < 0.4 * (1 - still)) { b.avertUntil = t + rand(0.35, 0.8); b.thinkDir = Math.random() < 0.5 ? -1 : 1; }
        b.blinkAt = Math.min(b.blinkAt, t + 0.1);
        b.lastMode = mode;
      }
      if (cue?.kind === "nod" && cueAge < 0.05) {
        b.nodStart = t;
        if (seat.warmth > 0.55 && pressure <= 2) b.happyUntil = t + 1.1;
      }

      // Gaze: saccades, thinking glances, watching the speaker in a panel.
      if (t > b.nextSaccade) {
        const amp = 0.28 * (1 - still * 0.75);
        b.gazeX = rand(-amp, amp);
        b.gazeY = rand(-amp * 0.5, amp * 0.5);
        b.nextSaccade = t + rand(0.7, 2.8) * (1 + still * 1.6);
      }
      let gx = b.gazeX, gy = b.gazeY, yaw = 0;
      const speakerOffset = (store.activeSeat - seat.seat) / Math.max(1, count - 1);
      if (mode === "attending") { gx = Math.sign(speakerOffset) * 0.85; gy = 0.05; yaw = Math.sign(speakerOffset) * 0.45; }
      if (mode === "thinking" && t < b.thinkUntil) { gx = 0.8 * b.thinkDir; gy = -0.75; yaw = 0.18 * b.thinkDir; }
      if (mode === "speaking" && t < b.avertUntil) { gx = 0.55 * b.thinkDir; gy = -0.3; }
      if (cue?.kind === "gaze_shift" && cueAge < 0.9) { gx = -0.7; gy = -0.5; }

      // Blinks: fewer under pressure (longer eye contact), sometimes doubled.
      if (t > b.blinkAt) { b.blinkStart = t; b.blinkAt = t + rand(2.4, 5.6) * (1 + still * 0.9) * (Math.random() < 0.15 ? 0.2 : 1); }
      const bp = (t - b.blinkStart) / 0.14;
      const blink = bp >= 0 && bp <= 1 ? Math.sin(bp * Math.PI) : 0;

      // Nods while listening — occasional, fewer with pressure, never constant.
      if (mode === "listening" && store.candidateSpeaking && t > b.nextNod && seat.expressiveness > 0.2 && pressure <= 4) {
        b.nodStart = t;
        b.nextNod = t + rand(6, 12) * (1 + still * 2);
      }
      const np = (t - b.nodStart) / 0.8;
      const nod = np >= 0 && np <= 1 ? Math.sin(np * Math.PI * 2) * (1 - np * 0.3) : 0;

      // Expression targets.
      const drift = 0.5 * (1 - still * 0.85) * (0.5 + seat.expressiveness) * move;
      const breath = Math.sin(t * (Math.PI * 2) / 4.2 + b.phase);
      let lidTop = still * 0.1 + (pressure >= 4 ? 0.1 : 0);
      let tiltL = 0, tiltR = 0, open = 1, happy = 0, scale = 1, blushExtra = 0;
      if (mode === "thinking" && t < b.thinkUntil) lidTop += 0.18;
      if (mode === "listening" && seat.skepticism > 0.6) { tiltL = 0.35; lidTop += 0.08; }
      if (cue?.kind === "brow_raise" && cueAge < 1.5) { tiltL = 0.8; tiltR = -0.3; lidTop += 0.1; }
      if (mode === "interrupting") { open = 1.12; lidTop = 0.12; tiltL = tiltR = 0.25; scale = 1.06; }
      if (cue?.kind === "lean_in" && cueAge < 1.4) scale = Math.max(scale, 1 + 0.04 * Math.sin(Math.min(1, cueAge / 1.4) * Math.PI));
      if (t < b.popUntil) scale = Math.max(scale, 1.07); // a little bounce when restyled
      const baselineSmile = pressure <= 2 ? seat.warmth * 0.14 : 0;
      if (t < b.happyUntil) { happy = 0.6; blushExtra = 0.35; } else if (mode === "listening" || mode === "idle") happy = baselineSmile;
      const lidL = Math.min(0.65, lidTop + (tiltL > 0 ? tiltL * 0.18 : 0));
      const lidR = Math.min(0.65, lidTop + (tiltR > 0 ? tiltR * 0.18 : 0));

      stepAll(sp, {
        yaw: (yaw + Math.sin(t * 0.37 + b.phase) * 0.12 * drift) * move,
        roll: (Math.sin(t * 0.29 + b.phase * 2) * 0.03 * drift + (mode === "thinking" && t < b.thinkUntil ? 0.05 * b.thinkDir : 0)) * move,
        bob: breath * 0.004 * move + nod * 0.03 * (0.4 + seat.expressiveness) + (mode === "speaking" ? -level * 0.012 : 0),
        scale: scale + breath * 0.004,
        gazeX: gx, gazeY: gy, open: open * (1 - blink * 0.92) + (mode === "speaking" ? level * 0.06 : 0),
        lidTopL: lidL, lidTopR: lidR, tiltL, tiltR, happy,
        eyeScale: 1 + (mode === "speaking" ? level * 0.05 : 0) + (mode === "listening" && store.candidateSpeaking ? 0.02 : 0),
        voice: level > 0.04 ? Math.min(1, level * 1.4) : 0, blush: blushExtra, glow: isActive ? 1 : 0,
      }, dt);
      const pose = Object.fromEntries(Object.entries(sp).map(([k, s]) => [k, s.x])) as unknown as BotPose;
      // Morph shape and colour toward the current look (a quarter-second ease; instant with reduced motion).
      const k = reduced ? 1 : 1 - Math.exp(-dt * 11);
      approachGeom(geom, shapeGeom(look.shape), k);
      for (const key of PAINT) {
        const target = rgbOf(look[key]);
        for (let i = 0; i < 3; i++) paint[key][i] += (target[i] - paint[key][i]) * k;
      }
      const drawn: BotLook = { ...look, face: hexOf(paint.face), faceShade: hexOf(paint.faceShade), eye: hexOf(paint.eye), highlight: hexOf(paint.highlight) };
      if (W > 0 && H > 0) drawBot(ctx, W, H, drawn, pose, seat.accent, geom);
      raf = requestAnimationFrame(frame);
    };
    // Paint one frame synchronously so the bot is visible even before the first
    // animation frame (e.g. in a background tab), then animate.
    frame(performance.now());
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [store, seat.seat, count]);
  return (
    <div ref={box} className={cn("relative", className)}>
      <canvas ref={canvas} className="absolute inset-0 block h-full w-full" />
    </div>
  );
}
