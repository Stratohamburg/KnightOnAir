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
  if (part.health <= 0)
    return "disabled";
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
  state: PartDamageState;
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
  return parts.reduce((sum, part) => sum + Math.max(0, part.health), 0);
}

export function totalPartMaxHealth(parts: readonly Part[]) {
  return parts.reduce((sum, part) => sum + part.maxHealth, 0);
}

/** Repairs damaged parts in a deterministic structural priority order. */
export function repairPartsWithOverflow(parts: Part[], amount: number) {
  let remaining = Math.max(0, amount);
  const ordered = [...parts].sort(
    (a, b) => (repairPriority[a.role ?? a.kind] ?? 100) - (repairPriority[b.role ?? b.kind] ?? 100) || a.id.localeCompare(b.id),
  );
  for (const part of ordered) {
    if (remaining <= 0) break;
    const missing = Math.max(0, part.maxHealth - part.health);
    if (!missing) continue;
    const restored = Math.min(missing, remaining);
    part.health += restored;
    remaining -= restored;
    part.destroyed = false;
    part.state = stateFor(part);
    part.disabled = part.state === "disabled";
  }
  return { used: amount - remaining, remaining, repaired: ordered.filter((part) => part.health > 0) };
}

/** Applies damage using the same transfer calculation for every combat entity. */
export function applyPartDamage(
  entity: Pick<CombatEntity, "health" | "maxHealth" | "parts" | "damageTransfer" | "partRevision" | "damageRevision">,
  part: Part,
  amount: number,
): PartDamageResult {
  const before = stateFor(part);
  const safeAmount = Math.max(0, amount);
  part.health = Math.max(0, part.health - safeAmount);
  entity.health = Math.max(0, entity.health - safeAmount);
  const state = stateFor(part);
  part.state = state;
  part.disabled = state === "disabled";
  if (state !== before) entity.partRevision++;
  entity.damageRevision++;
  return { appliedDamage: safeAmount, state };
}
