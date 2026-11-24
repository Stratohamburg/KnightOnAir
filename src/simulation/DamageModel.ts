import type {
  CombatEntity,
  ControlDamage,
  Part,
  PartDamageState,
  PartRole,
} from "./types";

const healthFactor = (part: Part) =>
  part.maxHealth > 0 ? Math.max(0, Math.min(1, part.health / part.maxHealth)) : 0;

export function stateFor(part: Part): PartDamageState {
  if (part.destroyed || part.state === "destroyed") return "destroyed";
  if (part.health <= 0) return part.visual?.detachable ? "destroyed" : "disabled";
  const ratio = healthFactor(part);
  return ratio > 0.7 ? "intact" : ratio > 0.4 ? "damaged" : "critical";
}

const roleOf = (part: Part): PartRole =>
  part.role ??
  (part.kind === "winglet" ? "wing" :
    part.kind === "bombBay" ? "bay" :
      ["gun", "cannon", "rocket", "ammo", "tailGun"].includes(part.kind)
        ? "gun"
        : part.kind === "armor" || part.kind === "frame" || part.kind === "reactor"
          ? "body"
          : (part.kind as PartRole));

const sideOf = (part: Part) =>
  part.side ?? (part.slot === "leftWing" ? -1 : part.slot === "rightWing" ? 1 : 0);

export const neutralDamage = (): ControlDamage => ({
  liftLeft: 1,
  liftRight: 1,
  thrustLeft: 1,
  thrustRight: 1,
  rollAuthorityLeft: 1,
  rollAuthorityRight: 1,
  turnAuthorityLeft: 1,
  turnAuthorityRight: 1,
  yawStability: 1,
  instability: 0,
  engineFactor: 1,
  weaponFactor: 1,
  lockFactor: 1,
  bombFactor: 1,
  response: 1,
  rollBias: 0,
  yawDrift: 0,
});

/** Calculates all shared damage consequences from one part list. */
export function evaluateDamage(parts: readonly Part[]): ControlDamage {
  const damage = neutralDamage();
  const wings = parts.filter((part) => ["wing", "float"].includes(roleOf(part)));
  const engines = parts.filter((part) => roleOf(part) === "engine");
  const liftLeft = wings.filter((part) => sideOf(part) < 0);
  const liftRight = wings.filter((part) => sideOf(part) > 0);
  const lift = (items: Part[]) => {
    if (!items.length) return 1;
    return items.reduce((sum, part) => sum + (part.lift ?? 1) * healthFactor(part), 0) /
      Math.max(1, items.reduce((sum, part) => sum + (part.lift ?? 1), 0));
  };
  const left = lift(liftLeft), right = lift(liftRight);
  damage.liftLeft = 0.2 + 0.8 * left;
  damage.liftRight = 0.2 + 0.8 * right;
  const engineShare = (side: -1 | 1) => {
    const candidates = engines.filter((part) => sideOf(part) === side || sideOf(part) === 0);
    const nominal = candidates.reduce((sum, part) => sum + (part.thrust ?? 1) * (sideOf(part) === 0 ? 0.5 : 1), 0);
    return nominal
      ? candidates.reduce((sum, part) => sum + (part.thrust ?? 1) * healthFactor(part) * (sideOf(part) === 0 ? 0.5 : 1), 0) / nominal
      : 0;
  };
  damage.thrustLeft = engineShare(-1);
  damage.thrustRight = engineShare(1);
  if (!engines.length) damage.thrustLeft = damage.thrustRight = 1;
  damage.engineFactor = 0.5 + 0.5 * ((damage.thrustLeft + damage.thrustRight) / 2);
  const liftBias = (damage.liftLeft - damage.liftRight) / 2;
  damage.rollAuthorityLeft = Math.max(0.15, 1 - Math.max(0, liftBias) * 0.85);
  damage.rollAuthorityRight = Math.max(0.15, 1 - Math.max(0, -liftBias) * 0.85);
  damage.turnAuthorityLeft = Math.pow(damage.rollAuthorityLeft, 0.55);
  damage.turnAuthorityRight = Math.pow(damage.rollAuthorityRight, 0.55);
  damage.rollBias = -liftBias * 0.16;
  damage.yawDrift = liftBias * 0.06;
  const tail = parts.filter((part) => roleOf(part) === "tail");
  const tailHealth = tail.length
    ? tail.reduce((sum, part) => sum + healthFactor(part), 0) / tail.length
    : 1;
  damage.yawStability = 0.2 + 0.8 * tailHealth;
  damage.response = 0.65 + 0.35 * damage.yawStability;
  damage.instability = (1 - damage.yawStability) * 0.5 + Math.abs(liftBias) * 0.35;
  const weaponParts = parts.filter((part) => ["gun", "turret"].includes(roleOf(part)));
  const weaponHealth = weaponParts.length
    ? weaponParts.reduce((sum, part) => sum + healthFactor(part), 0) / weaponParts.length
    : 1;
  damage.weaponFactor = weaponHealth;
  const radar = parts.filter((part) => roleOf(part) === "radar");
  damage.lockFactor = radar.length
    ? radar.reduce((sum, part) => sum + healthFactor(part), 0) / radar.length
    : weaponHealth;
  const bay = parts.filter((part) => roleOf(part) === "bay");
  damage.bombFactor = bay.length
    ? bay.reduce((sum, part) => sum + healthFactor(part), 0) / bay.length
    : 1;
  return damage;
}

export interface PartDamageResult {
  appliedDamage: number;
  transitions: { part: Part; state: PartDamageState }[];
  destroyed: boolean;
}

const repairPriority: Record<string, number> = {
  body: 0,
  engine: 10,
  wing: 20,
  float: 25,
  tail: 30,
  bombBay: 40,
  bay: 40,
  gun: 50,
  cannon: 50,
  turret: 55,
  radar: 60,
};

export function totalPartHealth(parts: readonly Part[]) {
  return parts.reduce((sum, part) => sum + (part.destroyed ? 0 : Math.max(0, part.health)), 0);
}

export function totalPartMaxHealth(parts: readonly Part[]) {
  return parts.reduce((sum, part) => sum + (part.destroyed ? 0 : part.maxHealth), 0);
}

/** Repairs damaged parts in a deterministic structural priority order. */
export function repairPartsWithOverflow(parts: Part[], amount: number) {
  let remaining = Math.max(0, amount);
  const ordered = [...parts].sort(
    (a, b) => (repairPriority[a.role ?? a.kind] ?? 100) - (repairPriority[b.role ?? b.kind] ?? 100) || a.id.localeCompare(b.id),
  );
  for (const part of ordered) {
    if (remaining <= 0) break;
    if (part.destroyed || part.state === "destroyed") continue;
    const missing = Math.max(0, part.maxHealth - part.health);
    if (!missing) continue;
    const restored = Math.min(missing, remaining);
    part.health += restored;
    remaining -= restored;
    part.state = stateFor(part);
    part.disabled = part.state === "disabled";
  }
  return { used: amount - remaining, remaining, repaired: ordered.filter((part) => part.health > 0) };
}

export function applyPartDamage(
  entity: Pick<CombatEntity, "health" | "maxHealth" | "parts" | "damage" | "partRevision" | "damageRevision">,
  part: Part | undefined,
  amount: number,
): PartDamageResult {
  const previousHealth = totalPartHealth(entity.parts);
  const appliedDamage = Math.min(previousHealth, Math.max(0, amount));
  const transitions: PartDamageResult["transitions"] = [];
  if (!(appliedDamage > 0)) return { appliedDamage: 0, transitions, destroyed: false };
  let remaining = appliedDamage;
  const spend = (target: Part, share: number) => {
    const damage = Math.min(target.health, share);
    target.health = Math.max(0, target.health - damage);
    const previous = target.state ?? "intact";
    target.state = stateFor(target);
    target.destroyed = target.state === "destroyed";
    target.disabled = target.destroyed || target.state === "disabled";
    if (target.state !== previous) transitions.push({ part: target, state: target.state });
    return damage;
  };
  if (part && part.health > 0 && !part.destroyed && part.state !== "disabled") remaining -= spend(part, remaining);
  const available = entity.parts.filter((candidate) => candidate.health > 0 && !candidate.destroyed)
    .sort((a, b) => a.health - b.health);
  const fatal = appliedDamage === previousHealth;
  for (let i = 0; i < available.length && (remaining > 0 || fatal); i++) {
    const target = available[i];
    const share = fatal ? target.health : remaining / (available.length - i);
    remaining = Math.max(0, remaining - spend(target, share));
  }
  const remainingHealth = totalPartHealth(entity.parts);
  entity.health = remainingHealth < 1e-6 ? 0 : remainingHealth;
  entity.maxHealth = totalPartMaxHealth(entity.parts);
  if (transitions.length) entity.partRevision++;
  entity.damageRevision++;
  entity.damage = evaluateDamage(entity.parts);
  return { appliedDamage, transitions, destroyed: entity.health === 0 };
}
