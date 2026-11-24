import type { EraId, Airframe } from "../data/aircrafts";
import { WEAPONS, type WeaponConfig } from "../data/weapons";
import type { Upgrade } from "../data/upgrades";
import type { Part, RuntimeWeapon } from "./types";

export interface RefitContext {
  frame: Airframe;
  era: EraId;
  upgrades: readonly string[];
  parts: readonly Part[];
  weapons: readonly RuntimeWeapon[];
}

export function refitWeaponForEra(id: string, era: EraId): WeaponConfig {
  if (era === "pioneer" || era === "ww1") {
    if (id === "nose_cannon_pair") return WEAPONS.ww1_twin_mg;
    if (id === "light_cannon") return WEAPONS.ww1_wing_gun;
  }
  if (id === "rocket_pod" && era === "jet") return WEAPONS.jet_rocket_pod;
  if (id === "rocket_pod" && era === "ww2") return WEAPONS.ww2_rocket_battery;
  return WEAPONS[id];
}

export function refitLimit(context: RefitContext, upgrade: Upgrade) {
  if (context.frame.geometryProfile === "fokkerDr1") return 1;
  const headroom = context.frame.refit?.headroom ??
    (context.frame.hardpoints >= 8 ? .8 : context.era === "ww1" ? .55 : .35);
  if (headroom >= .5 && upgrade.parts.some((part) =>
    ["wing", "engine", "gun", "cannon", "turret", "tailGun"].includes(part.kind)))
    return Math.max(2, Math.floor(context.frame.hardpoints * headroom / 3));
  return 1;
}

export function weaponCapacity(context: RefitContext) {
  const extra = context.parts.filter((part) => part.id.startsWith("giant_wing_") && part.health > 0).length;
  return context.frame.hardpoints + extra +
    (context.upgrades.includes("modular_frame") ? 3 : 0);
}

export function isUpgradeEligible(context: RefitContext, upgrade: Upgrade) {
  const uses = context.upgrades.filter((id) => id === upgrade.id).length;
  const weaponEraCompatible = upgrade.weapons?.every((id) => {
    const weapon = refitWeaponForEra(id, context.era);
    return !!weapon && (!weapon.eras || weapon.eras.includes(context.era));
  }) ?? true;
  const eraCompatible = context.era === "jet" ||
    !["reactor", "nose_radar"].includes(upgrade.id);
  const conflicts = upgrade.conflicts?.some((id) => context.upgrades.includes(id)) ?? false;
  const prerequisites = upgrade.requires?.every((id) =>
    context.upgrades.includes(id) ||
    (id === "bomb_bay" && context.parts.some((part) => part.role === "bay")) ||
    (id === "top_turret" && context.weapons.some((weapon) => weapon.config.category === "turret"))
  ) ?? true;
  const fits = !upgrade.weapons?.length ||
    context.weapons.length + upgrade.weapons.length <= weaponCapacity(context);
  const limit = upgrade.max ?? (upgrade.repeatable ? Number.POSITIVE_INFINITY : refitLimit(context, upgrade));
  return uses < limit &&
    weaponEraCompatible && eraCompatible && !conflicts && prerequisites && fits;
}

export function legalUpgrades(context: RefitContext, upgrades: readonly Upgrade[]) {
  return upgrades.filter((upgrade) => isUpgradeEligible(context, upgrade));
}

export function upgradePreviewStats<T extends Record<string, number>>(
  stats: T,
  upgrade: Upgrade,
) {
  const next = { ...stats };
  for (const [key, value] of Object.entries(upgrade.add ?? {}))
    next[key as keyof T] = (next[key as keyof T] ?? 0) + (value ?? 0) as T[keyof T];
  for (const [key, value] of Object.entries(upgrade.multiply ?? {}))
    next[key as keyof T] = (next[key as keyof T] ?? 0) * (value ?? 1) as T[keyof T];
  return next;
}
