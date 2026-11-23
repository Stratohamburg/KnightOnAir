import type { DamageType } from "../../simulation/types";

export const weaponEffects = {
  machineGun: { color: "#ffce77", core: "#fff7c5", size: .67, duration: .105, sparks: 3, speed: 7, trail: .42, smoke: .39 },
  cannon: { color: "#ff9a3a", core: "#fff1b7", size: 1.04, duration: .14, sparks: 5, speed: 8.5, trail: .68, smoke: .6 },
  rocket: { color: "#fc6a24", core: "#fff2b3", size: 1.4, duration: .19, sparks: 7, speed: 10, trail: 1.1, smoke: .85 },
  missile: { color: "#82dfff", core: "#eafcff", size: 1.58, duration: .22, sparks: 8, speed: 11, trail: 1.4, smoke: 1 },
} as const;

export type WeaponEffectId = keyof typeof weaponEffects;
export function weaponEffectId(weaponId = "", damageType: DamageType = "kinetic"): WeaponEffectId {
  if (weaponId.includes("missile")) return "missile";
  if (weaponId.includes("rocket") || damageType === "explosive") return "rocket";
  if (/cannon|flak|howitzer|naval|turret/.test(weaponId)) return "cannon";
  return "machineGun";
}
