export const clamp = (v: number, min = 0, max = 1) =>
  Math.max(min, Math.min(max, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const damp = (a: number, b: number, rate: number, dt: number) =>
  lerp(a, b, 1 - Math.exp(-rate * dt));
export const RAD = Math.PI / 180;
export const angleDelta = (target: number, current: number) =>
  Math.atan2(Math.sin(target - current), Math.cos(target - current));
export const distance = (
  a: { x: number; z: number },
  b: { x: number; z: number },
) => Math.hypot(a.x - b.x, a.z - b.z);
export function segmentDistance(
  x: number,
  z: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
) {
  const dx = bx - ax,
    dz = bz - az;
  const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1));
  return Math.hypot(x - ax - dx * t, z - az - dz * t);
}
export class Random {
  constructor(private seed = 34917) {}
  next() {
    this.seed |= 0;
    this.seed = (this.seed + 0x6d2b79f5) | 0;
    let t = Math.imul(this.seed ^ (this.seed >>> 15), 1 | this.seed);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number) {
    return lerp(a, b, this.next());
  }
  pick<T>(values: readonly T[]): T {
    return values[Math.floor(this.next() * values.length)];
  }
}
