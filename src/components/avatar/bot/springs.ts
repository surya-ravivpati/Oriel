/** Critically-ish damped spring, stepped at a fixed rate for stable expression morphing. */
export class Spring {
  v = 0;
  constructor(public x: number, public k = 170, public c = 24) {}
  step(target: number, dt: number) {
    const a = this.k * (target - this.x) - this.c * this.v;
    this.v += a * dt;
    this.x += this.v * dt;
    return this.x;
  }
  snap(x: number) {
    this.x = x;
    this.v = 0;
  }
}

/** Integrate a set of springs with fixed 1/120 s sub-steps. */
export function stepAll(springs: Record<string, Spring>, targets: Record<string, number>, dt: number) {
  const h = 1 / 120;
  let t = Math.min(dt, 0.1);
  while (t > 0) {
    const s = Math.min(h, t);
    for (const k in springs) springs[k].step(targets[k] ?? springs[k].x, s);
    t -= s;
  }
}
