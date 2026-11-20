export interface SeparationActor {
  x: number;
  z: number;
  radius?: number;
}

export function separationForce<T extends SeparationActor>(actor: T, all: readonly T[], radius = 7) {
  let x = 0;
  let z = 0;
  let hard = 0;
  for (const other of all) {
    if (other === actor) continue;
    const dx = actor.x - other.x;
    const dz = actor.z - other.z;
    const distance = Math.hypot(dx, dz);
    if (!distance || distance >= radius) continue;
    const overlap = (radius - distance) / radius;
    x += (dx / distance) * overlap;
    z += (dz / distance) * overlap;
    if (distance < radius * 0.55) hard += (radius * 0.55 - distance) / (radius * 0.55);
  }
  return { x, z, level: Math.min(1, Math.hypot(x, z)), hard: Math.min(1, hard) };
}

export function separationTarget(
  heading: number,
  actor: SeparationActor,
  all: readonly SeparationActor[],
  radius = 7,
) {
  const force = separationForce(actor, all, radius);
  if (!force.x && !force.z) return heading;
  const away = Math.atan2(force.x, force.z);
  let delta = away - heading;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return heading + delta * Math.min(0.9, 0.35 + force.level * 0.55);
}
