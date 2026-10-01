import type { BotLook } from "./looks";
import { extent, halfWidthAt, shapeGeom, type ShapeGeom } from "./shapes";

/**
 * Pure canvas drawing for one bot. Everything is expressed in units of `S`, the
 * smaller side of the canvas, so the bot is crisp at any size.
 */
export interface BotPose {
  yaw: number; // -1..1 simulated head turn
  roll: number; // radians
  bob: number; // vertical offset in units of S
  scale: number; // lean / emphasis
  gazeX: number; // -1..1
  gazeY: number; // -1..1
  open: number; // 0 (closed) .. 1.15 (wide)
  lidTopL: number; // 0..1 cut from the top of the left eye
  lidTopR: number;
  tiltL: number; // -1..1 top-lid angle (positive = outer corner lower)
  tiltR: number;
  happy: number; // 0..1 bottom arc (smile eyes)
  eyeScale: number;
  voice: number; // 0..1 speaking light
  blush: number; // 0..1 extra blush
  glow: number; // 0..1 accessory / eye glow emphasis
}

function capsule(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number) {
  const r = Math.min(w, h) / 2;
  const x = cx - w / 2, y = cy - h / 2;
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
  ctx.lineTo(x + w, y + h - r);
  ctx.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  ctx.lineTo(x + r, y + h);
  ctx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  ctx.lineTo(x, y + r);
  ctx.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
  ctx.closePath();
}

/**
 * Draw one bot. `geom` is the face shape and feature layout (pass a morphing copy to
 * animate between shapes); it defaults to the look's own shape.
 */
export function drawBot(ctx: CanvasRenderingContext2D, W: number, H: number, look: BotLook, p: BotPose, accent: string, geom: ShapeGeom = shapeGeom(look.shape)) {
  const S = Math.min(W, H);
  ctx.clearRect(0, 0, W, H);
  const o = geom.outline;
  const ext = extent(o);
  const turn = Math.abs(p.yaw);
  const sx = S * p.scale * (1 - 0.06 * turn), sy = S * p.scale;
  const a = ext.maxX * sx; // face half-width
  const b = Math.max(-ext.top, ext.bottom) * sy; // face half-height
  const cx = W / 2 + p.yaw * S * 0.025;
  const cy = H / 2 - S * 0.03 + p.bob * S;
  const X = (u: number) => cx + u * sx, Y = (v: number) => cy + v * sy;
  const trace = () => {
    ctx.moveTo(X(o[0]), Y(o[1]));
    for (let i = 2; i < o.length; i += 2) ctx.lineTo(X(o[i]), Y(o[i + 1]));
    ctx.closePath();
  };

  // Floor shadow.
  const floorY = Y(ext.bottom) + S * 0.08;
  const sh = ctx.createRadialGradient(cx, floorY, 0, cx, floorY, a * 0.95);
  sh.addColorStop(0, "rgba(0,0,0,0.55)");
  sh.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = sh;
  ctx.beginPath();
  ctx.ellipse(cx, floorY, a * 0.95, S * 0.035, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(p.roll);
  ctx.translate(-cx, -cy);

  // Accessories behind the face.
  if (look.accessory === "antenna") drawAntenna(ctx, cx, Y(ext.top), S, look, p, accent);
  if (look.accessory === "headset") drawHeadsetCups(ctx, geom, X, Y, S, look);

  // Face body with soft studio shading.
  ctx.beginPath();
  trace();
  const body = ctx.createRadialGradient(cx - a * 0.18, cy - b * 0.45, a * 0.1, cx, cy, a * 1.15);
  body.addColorStop(0, look.face);
  body.addColorStop(0.55, look.face);
  body.addColorStop(1, look.faceShade);
  ctx.fillStyle = body;
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = S * 0.08;
  ctx.shadowOffsetY = S * 0.02;
  ctx.fill();
  ctx.shadowColor = "transparent";

  ctx.save();
  ctx.clip();
  // Key light: warm highlight from upper left; moves slightly with the head turn.
  const hl = ctx.createRadialGradient(cx - a * (0.35 + p.yaw * 0.15), cy - b * 0.55, 0, cx - a * 0.35, cy - b * 0.55, a * 1.25);
  hl.addColorStop(0, "rgba(255,250,242,0.35)");
  hl.addColorStop(0.45, "rgba(255,250,242,0.05)");
  hl.addColorStop(1, "rgba(255,248,236,0)");
  ctx.fillStyle = hl;
  ctx.fillRect(cx - a * 1.2, cy - b * 1.2, a * 2.4, b * 2.4);
  // Rim light from the window behind (warm accent on the top edge).
  ctx.lineWidth = S * 0.012;
  const rim = ctx.createLinearGradient(cx, Y(ext.top), cx, cy);
  rim.addColorStop(0, "rgba(233,184,114,0.55)");
  rim.addColorStop(1, "rgba(233,184,114,0)");
  ctx.strokeStyle = rim;
  ctx.beginPath();
  trace();
  ctx.stroke();

  // Blush (inside the face whatever its shape).
  const blush = Math.min(1, look.blush + p.blush);
  if (blush > 0.01) {
    for (const side of [-1, 1]) {
      const bx = X(side * geom.spacing * 1.24) + p.yaw * a * 0.2, by = Y(geom.eyeY + 0.1);
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, S * 0.07);
      g.addColorStop(0, `rgba(236,140,120,${0.28 * blush})`);
      g.addColorStop(1, "rgba(236,140,120,0)");
      ctx.fillStyle = g;
      ctx.fillRect(bx - S * 0.08, by - S * 0.08, S * 0.16, S * 0.16);
    }
  }
  ctx.restore();

  if (look.accessory === "rim") {
    ctx.beginPath();
    trace();
    ctx.lineWidth = S * 0.011;
    ctx.strokeStyle = look.accessoryColor;
    ctx.globalAlpha = 0.95;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Eyes.
  const spacing = geom.spacing * sx;
  const ew0 = S * 0.082 * p.eyeScale * geom.eyeK;
  const eh0 = ew0 * 2.05;
  const eyeY = Y(geom.eyeY) + p.gazeY * eh0 * 0.22;
  for (const side of [-1, 1] as const) {
    const far = Math.max(0, p.yaw * side); // eye on the side we turn toward narrows
    const ew = ew0 * (1 - 0.38 * far);
    const eh = eh0 * Math.max(0.12, p.open);
    const ex = cx + side * spacing * (1 - 0.18 * turn) + p.yaw * a * 0.28 + p.gazeX * ew0 * 0.9;
    const lidTop = side < 0 ? p.lidTopL : p.lidTopR;
    const tilt = side < 0 ? p.tiltL : p.tiltR;
    drawEye(ctx, ex, eyeY, ew, eh, lidTop, tilt * side, p.happy, look, p.glow);
  }

  // Voice light: the bot has no mouth; a small light breathes with its voice.
  if (p.voice > 0.02) {
    const vw = S * (0.02 + p.voice * 0.085);
    const vh = S * 0.016;
    ctx.beginPath();
    capsule(ctx, cx + p.yaw * a * 0.25, Y(geom.eyeY + geom.voiceDy), vw, vh);
    ctx.fillStyle = look.eye;
    ctx.globalAlpha = Math.min(0.9, 0.2 + p.voice * 1.1);
    if (look.glowEyes) { ctx.shadowColor = look.eye; ctx.shadowBlur = S * 0.03; }
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowColor = "transparent";
  }

  if (look.accessory === "glasses") drawGlasses(ctx, cx + p.yaw * a * 0.28, eyeY, spacing * (1 - 0.18 * turn), ew0, eh0, S, look);
  if (look.accessory === "headset") drawHeadsetMic(ctx, geom, X, Y, S, p);
  if (look.accessory === "tuft") drawTuft(ctx, cx, Y(ext.top), S, look);
  ctx.restore();
}

function drawEye(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, lidTop: number, tilt: number, happy: number, look: BotLook, glow: number) {
  ctx.save();
  // Lid mask: region between an angled top lid and a (possibly arched) bottom lid.
  const pad = w;
  const top = y - h / 2 + lidTop * h;
  const tl = top - tilt * h * 0.28, tr = top + tilt * h * 0.28;
  const bottom = y + h / 2 + 2;
  const arch = happy * h * 1.1;
  ctx.beginPath();
  ctx.moveTo(x - w / 2 - pad, tl);
  ctx.lineTo(x + w / 2 + pad, tr);
  ctx.lineTo(x + w / 2 + pad, bottom);
  ctx.quadraticCurveTo(x, bottom - arch * 2, x - w / 2 - pad, bottom);
  ctx.closePath();
  ctx.clip();

  ctx.beginPath();
  capsule(ctx, x, y, w, h);
  ctx.fillStyle = look.eye;
  if (look.glowEyes) { ctx.shadowColor = look.eye; ctx.shadowBlur = w * 0.9; }
  ctx.fill();
  ctx.shadowColor = "transparent";
  // Warm vertical highlight, like a reflection of the window light (hidden as the eye closes).
  if (h > w * 1.1) {
    ctx.beginPath();
    capsule(ctx, x + w * 0.16, y - h * 0.16, w * 0.17, Math.min(h * 0.36, w * 0.52));
    ctx.fillStyle = look.highlight;
    ctx.globalAlpha = 0.85 * (0.6 + glow * 0.4);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawGlasses(ctx: CanvasRenderingContext2D, cx: number, y: number, spacing: number, ew: number, eh: number, S: number, look: BotLook) {
  const fw = ew * 2.55, fh = eh * 1.25;
  ctx.save();
  ctx.lineWidth = S * 0.009;
  ctx.strokeStyle = look.accessoryColor;
  for (const side of [-1, 1]) {
    const x = cx + side * spacing;
    ctx.beginPath();
    const r = S * 0.045;
    ctx.roundRect(x - fw / 2, y - fh / 2, fw, fh, r);
    ctx.stroke();
    // lens glint
    ctx.beginPath();
    ctx.moveTo(x - fw * 0.28, y - fh * 0.3);
    ctx.lineTo(x - fw * 0.05, y - fh * 0.42);
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.stroke();
    ctx.strokeStyle = look.accessoryColor;
  }
  ctx.beginPath();
  ctx.moveTo(cx - spacing + fw / 2, y - fh * 0.1);
  ctx.quadraticCurveTo(cx, y - fh * 0.3, cx + spacing - fw / 2, y - fh * 0.1);
  ctx.stroke();
  ctx.restore();
}

function drawHeadsetCups(ctx: CanvasRenderingContext2D, g: ShapeGeom, X: (u: number) => number, Y: (v: number) => number, S: number, look: BotLook) {
  const y = g.eyeY - 0.006;
  const hw = halfWidthAt(g.outline, y);
  // Lean the cups with the side of the face (a triangle's sides slope; a circle's don't at eye level).
  const lean = Math.atan2(halfWidthAt(g.outline, y + 0.02) - halfWidthAt(g.outline, y - 0.02), 0.04);
  ctx.save();
  for (const side of [-1, 1]) {
    const x = X(side * hw * 0.98);
    ctx.save();
    ctx.translate(x, Y(y));
    ctx.rotate(-side * lean);
    const grad = ctx.createLinearGradient(-S * 0.04, 0, S * 0.04, 0);
    grad.addColorStop(0, side < 0 ? "#AEB2BA" : look.accessoryColor);
    grad.addColorStop(1, side < 0 ? look.accessoryColor : "#AEB2BA");
    ctx.fillStyle = grad;
    ctx.beginPath();
    capsule(ctx, 0, 0, S * 0.07, S * 0.15);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawHeadsetMic(ctx: CanvasRenderingContext2D, g: ShapeGeom, X: (u: number) => number, Y: (v: number) => number, S: number, p: BotPose) {
  ctx.save();
  const hw = halfWidthAt(g.outline, g.eyeY + 0.053);
  ctx.lineWidth = S * 0.011;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#3A3D44";
  ctx.beginPath();
  ctx.moveTo(X(hw * 0.98), Y(g.eyeY + 0.053));
  ctx.quadraticCurveTo(X(hw * 0.93), Y(g.eyeY + 0.23), X(g.spacing * 0.67), Y(g.eyeY + 0.2));
  ctx.stroke();
  ctx.fillStyle = p.voice > 0.05 ? "#E9B872" : "#2A2C31";
  ctx.beginPath();
  capsule(ctx, X(g.spacing * 0.57), Y(g.eyeY + 0.2), S * 0.06, S * 0.03);
  ctx.fill();
  ctx.restore();
}

function drawAntenna(ctx: CanvasRenderingContext2D, cx: number, topY: number, S: number, look: BotLook, p: BotPose, accent: string) {
  ctx.save();
  ctx.lineWidth = S * 0.01;
  ctx.lineCap = "round";
  ctx.strokeStyle = look.accessoryColor;
  ctx.beginPath();
  ctx.moveTo(cx, topY + S * 0.02);
  ctx.lineTo(cx + S * 0.01, topY - S * 0.07);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx + S * 0.01, topY - S * 0.085, S * 0.022, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.shadowColor = accent;
  ctx.shadowBlur = S * (0.02 + p.voice * 0.05 + p.glow * 0.03);
  ctx.fill();
  ctx.restore();
}

function drawTuft(ctx: CanvasRenderingContext2D, cx: number, topY: number, S: number, look: BotLook) {
  ctx.save();
  ctx.fillStyle = look.accessoryColor;
  // Two soft leaves sprouting from the crown.
  for (const [dx, h, lean] of [[-0.012, 0.085, -0.25], [0.03, 0.06, 0.45]] as const) {
    ctx.save();
    ctx.translate(cx + dx * S, topY + S * 0.02);
    ctx.rotate(lean);
    ctx.beginPath();
    ctx.ellipse(0, -h * S * 0.5, S * 0.022, h * S * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
