import type { CombatEntity, Part } from "./types";

export interface SweptProjectile {
  prevX: number;
  prevZ: number;
  x: number;
  z: number;
  radius?: number;
}
export interface HitPart {
  part: Part;
  t: number;
  x: number;
  z: number;
}

const pointSegment = (
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
) => {
  const dx = bx - ax;
  const dz = bz - az;
  const lengthSq = dx * dx + dz * dz;
  const t = lengthSq ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / lengthSq)) : 0;
  const x = ax + dx * t;
  const z = az + dz * t;
  return { t, distance: Math.hypot(px - x, pz - z), x, z };
};

/** Returns the earliest local part hit by a swept projectile. */
export function hitEntity(entity: Pick<CombatEntity, "x" | "z" | "heading" | "parts">, projectile: SweptProjectile): HitPart | undefined {
  const sin = Math.sin(entity.heading);
  const cos = Math.cos(entity.heading);
  const local = (x: number, z: number) => {
    const dx = x - entity.x;
    const dz = z - entity.z;
    return { x: dx * cos - dz * sin, z: dx * sin + dz * cos };
  };
  const start = local(projectile.prevX, projectile.prevZ);
  const end = local(projectile.x, projectile.z);
  let best: HitPart | undefined;
  for (const part of entity.parts) {
    if (part.health <= 0 || part.destroyed || part.state === "destroyed" || part.state === "disabled") continue;
    const circles = part.hitCircles?.length
      ? part.hitCircles
      : [{ x: part.x, z: part.z, r: part.radius }];
    for (const circle of circles) {
      const hit = pointSegment(circle.x, circle.z, start.x, start.z, end.x, end.z);
      if (hit.distance > circle.r + (projectile.radius ?? 0.1)) continue;
      if (!best || hit.t < best.t || (hit.t === best.t && part.id < best.part.id)) {
        best = { part, t: hit.t, x: hit.x, z: hit.z };
      }
    }
  }
  return best;
}
