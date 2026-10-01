import type { BotShape } from "@/lib/avatar/style";

/**
 * Face shapes for the bot family, in units of S (the canvas's smaller side) around the
 * face centre. Every outline is resampled at the same OUTLINE_POINTS angles (from the top,
 * clockwise), so any shape can morph into any other by plain interpolation. Each shape
 * also places the features: where the eyes sit, how far apart, how big, and the voice light.
 */
export const OUTLINE_POINTS = 360;

export interface ShapeGeom {
  outline: Float32Array; // OUTLINE_POINTS × (x, y)
  eyeY: number; // eye centre line
  spacing: number; // half the distance between eye centres
  eyeK: number; // eye size multiplier
  voiceDy: number; // voice light below the eye line
}

type Pt = [number, number];

function superellipse(a: number, b: number, n: number, steps = 720): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const c = Math.cos(t), s = Math.sin(t);
    pts.push([a * Math.sign(c) * Math.abs(c) ** (2 / n), b * Math.sign(s) * Math.abs(s) ** (2 / n)]);
  }
  return pts;
}

function arc(cx: number, cy: number, r: number, from: number, to: number, steps = 32): Pt[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = from + ((to - from) * i) / steps;
    return [cx + r * Math.cos(t), cy + r * Math.sin(t)] as Pt;
  });
}

/** A convex polygon with every corner rounded to radius r. */
function roundedPolygon(verts: Pt[], r: number): Pt[] {
  const pts: Pt[] = [];
  verts.forEach((v, i) => {
    const prev = verts[(i + verts.length - 1) % verts.length], next = verts[(i + 1) % verts.length];
    const u1 = norm([prev[0] - v[0], prev[1] - v[1]]), u2 = norm([next[0] - v[0], next[1] - v[1]]);
    const half = Math.acos(Math.max(-1, Math.min(1, u1[0] * u2[0] + u1[1] * u2[1]))) / 2;
    const bis = norm([u1[0] + u2[0], u1[1] + u2[1]]);
    const c: Pt = [v[0] + (bis[0] * r) / Math.sin(half), v[1] + (bis[1] * r) / Math.sin(half)];
    const d = r / Math.tan(half);
    const t1: Pt = [v[0] + u1[0] * d, v[1] + u1[1] * d], t2: Pt = [v[0] + u2[0] * d, v[1] + u2[1] * d];
    const a1 = Math.atan2(t1[1] - c[1], t1[0] - c[0]);
    let delta = Math.atan2(t2[1] - c[1], t2[0] - c[0]) - a1;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    pts.push(...arc(c[0], c[1], r, a1, a1 + delta));
  });
  return pts;
}

function norm([x, y]: Pt): Pt {
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
}

/** A window: round top, straight sides, softly rounded bottom corners. */
function arch(halfW: number, top: number, bottom: number, r: number): Pt[] {
  const yc = top + halfW;
  return [
    ...arc(0, yc, halfW, Math.PI, Math.PI * 2, 96),
    ...arc(halfW - r, bottom - r, r, 0, Math.PI / 2),
    ...arc(-halfW + r, bottom - r, r, Math.PI / 2, Math.PI),
  ];
}

const hexagon = (R: number): Pt[] => Array.from({ length: 6 }, (_, k) => [R * Math.cos((k * Math.PI) / 3), R * Math.sin((k * Math.PI) / 3)] as Pt);

const DEFS: Record<BotShape, { points: () => Pt[]; eyeY: number; spacing: number; eyeK: number; voiceDy: number }> = {
  // Wide, soft squircle (≈1.25:1) from the original design sheet.
  squircle: { points: () => superellipse(0.37, 0.295, 3.4), eyeY: -0.018, spacing: 0.155, eyeK: 1, voiceDy: 0.142 },
  circle: { points: () => superellipse(0.335, 0.335, 2), eyeY: -0.025, spacing: 0.13, eyeK: 0.95, voiceDy: 0.15 },
  // Point up: the eyes sit low, in the wide part.
  triangle: { points: () => roundedPolygon([[0, -0.37], [0.45, 0.33], [-0.45, 0.33]], 0.1), eyeY: 0.09, spacing: 0.115, eyeK: 0.88, voiceDy: 0.11 },
  hexagon: { points: () => roundedPolygon(hexagon(0.37), 0.07), eyeY: -0.02, spacing: 0.145, eyeK: 0.97, voiceDy: 0.15 },
  pill: { points: () => roundedPolygon([[-0.245, -0.345], [0.245, -0.345], [0.245, 0.345], [-0.245, 0.345]], 0.245), eyeY: -0.04, spacing: 0.1, eyeK: 0.88, voiceDy: 0.15 },
  diamond: { points: () => roundedPolygon([[0, -0.39], [0.42, 0], [0, 0.39], [-0.42, 0]], 0.1), eyeY: -0.01, spacing: 0.12, eyeK: 0.88, voiceDy: 0.13 },
  arch: { points: () => arch(0.3, -0.35, 0.31, 0.08), eyeY: -0.01, spacing: 0.13, eyeK: 0.95, voiceDy: 0.15 },
  blob: { points: () => superellipse(0.33, 0.31, 2.7), eyeY: -0.019, spacing: 0.139, eyeK: 1, voiceDy: 0.149 },
};

/** Resample a closed outline at equal angles around the centre (every shape here is convex around it). */
function radial(poly: Pt[]): Float32Array {
  const out = new Float32Array(OUTLINE_POINTS * 2);
  for (let i = 0; i < OUTLINE_POINTS; i++) {
    const th = -Math.PI / 2 + (i / OUTLINE_POINTS) * Math.PI * 2;
    const dx = Math.cos(th), dy = Math.sin(th);
    let far = 0;
    for (let j = 0; j < poly.length; j++) {
      const [x1, y1] = poly[j], [x2, y2] = poly[(j + 1) % poly.length];
      const ex = x2 - x1, ey = y2 - y1;
      const den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-12) continue;
      const t = (x1 * ey - y1 * ex) / den;
      const u = (x1 * dy - y1 * dx) / den;
      // Tolerant at segment ends: a ray through a vertex must still hit (circles put vertices on the rays).
      if (t > far && u >= -1e-9 && u <= 1 + 1e-9) far = t;
    }
    if (far === 0 && i > 0) far = Math.hypot(out[i * 2 - 2], out[i * 2 - 1]);
    out[i * 2] = dx * far;
    out[i * 2 + 1] = dy * far;
  }
  return out;
}

const cache = new Map<BotShape, ShapeGeom>();

export function shapeGeom(shape: BotShape): ShapeGeom {
  let g = cache.get(shape);
  if (!g) {
    const d = DEFS[shape] ?? DEFS.squircle;
    g = { outline: radial(d.points()), eyeY: d.eyeY, spacing: d.spacing, eyeK: d.eyeK, voiceDy: d.voiceDy };
    cache.set(shape, g);
  }
  return g;
}

export function cloneGeom(g: ShapeGeom): ShapeGeom {
  return { ...g, outline: new Float32Array(g.outline) };
}

/** Move `cur` a fraction k of the way to `target` (in place) — a frame of a shape morph. */
export function approachGeom(cur: ShapeGeom, target: ShapeGeom, k: number) {
  for (let i = 0; i < cur.outline.length; i++) cur.outline[i] += (target.outline[i] - cur.outline[i]) * k;
  cur.eyeY += (target.eyeY - cur.eyeY) * k;
  cur.spacing += (target.spacing - cur.spacing) * k;
  cur.eyeK += (target.eyeK - cur.eyeK) * k;
  cur.voiceDy += (target.voiceDy - cur.voiceDy) * k;
}

/** Top (at the centre line), bottom and widest half-width of an outline. */
export function extent(o: Float32Array) {
  let maxX = 0;
  for (let i = 0; i < o.length; i += 2) maxX = Math.max(maxX, Math.abs(o[i]));
  return { top: o[1], bottom: o[OUTLINE_POINTS + 1], maxX };
}

/** Half-width of the outline at height y (widest crossing). */
export function halfWidthAt(o: Float32Array, y: number): number {
  let w = 0;
  for (let i = 0; i < OUTLINE_POINTS; i++) {
    const x1 = o[i * 2], y1 = o[i * 2 + 1];
    const j = ((i + 1) % OUTLINE_POINTS) * 2;
    const x2 = o[j], y2 = o[j + 1];
    if ((y1 - y) * (y2 - y) > 0 || y1 === y2) continue;
    const x = x1 + ((y - y1) / (y2 - y1)) * (x2 - x1);
    w = Math.max(w, Math.abs(x));
  }
  return w;
}

/** Point-in-outline test (even–odd), used by the geometry tests. */
export function insideOutline(o: Float32Array, x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = OUTLINE_POINTS - 1; i < OUTLINE_POINTS; j = i++) {
    const xi = o[i * 2], yi = o[i * 2 + 1], xj = o[j * 2], yj = o[j * 2 + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
