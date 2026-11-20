import type { EraId } from "./aircrafts";

export type TargetLayer = "air" | "ground" | "water";
export interface WeaponConfig {
  eras?: EraId[];
  targetLayers?: TargetLayer[];
  armorPierce?: number;
  id: string;
  name: string;
  category: "directional" | "turret" | "area";
  damage: number;
  fireRate: number;
  speed: number;
  range: number;
  count: number;
  arc: number;
  spread: number;
  pierce: number;
  bounce: number;
  explosion: number;
  lockTime: number;
  lossRate: number;
  homing: number;
  homingLife: number;
  escort: boolean;
  turnRate: number;
  turretArc: number;
  duration: number;
  burn: number;
  slow: number;
  armorBreak: number;
}
const weapon = (
  id: string,
  name: string,
  p: Partial<WeaponConfig>,
): WeaponConfig => ({
  id,
  name,
  category: "directional",
  damage: 8,
  fireRate: 5,
  speed: 22,
  range: 22,
  count: 1,
  arc: 24,
  spread: 0,
  pierce: 0,
  bounce: 0,
  explosion: 0,
  lockTime: 0,
  lossRate: 0.5,
  homing: 0,
  homingLife: 0,
  escort: false,
  turnRate: 110,
  turretArc: 270,
  duration: 0,
  burn: 0,
  slow: 0,
  armorBreak: 0,
  ...p,
});
export const WEAPONS: Record<string, WeaponConfig> = Object.fromEntries(
  [
    weapon("ww1_sync_mg", "同步机枪", { damage: 4, fireRate: 9, speed: 22, range: 20, arc: 20, eras: ["pioneer", "ww1"] }),
    weapon("ww1_twin_mg", "双联同步机枪", { damage: 5.6, fireRate: 8, speed: 22, range: 20, count: 2, arc: 22, eras: ["pioneer", "ww1"] }),
    weapon("ww1_wing_gun", "翼上机枪", { damage: 4, fireRate: 8, speed: 22, range: 21, spread: 2, eras: ["pioneer", "ww1"] }),
    weapon("pioneer_light_bomb", "早期轻型炸弹", { category: "area", damage: 48, fireRate: .25, explosion: 3.5, eras: ["pioneer"], targetLayers: ["ground"] }),
    weapon("ww1_light_bomb", "轻型炸弹", { category: "area", damage: 64, fireRate: .25, explosion: 3.5, eras: ["ww1"], targetLayers: ["ground"] }),
    weapon("early_torpedo", "早期鱼雷", { category: "area", damage: 192, fireRate: .14, explosion: 5, eras: ["ww1"], targetLayers: ["water"] }),
    weapon("ww2_torpedo", "航空鱼雷", { category: "area", damage: 228, fireRate: .14, explosion: 6, eras: ["ww2"], targetLayers: ["water"] }),
    weapon("ww2_medium_bomb", "中型炸弹", { category: "area", damage: 171, fireRate: .19, explosion: 6, eras: ["ww1", "ww2"], targetLayers: ["ground", "water"] }),
    weapon("ww2_autocannon", "航空机炮", { damage: 13.3, armorPierce: .25, fireRate: 5, speed: 28, range: 26, arc: 20, eras: ["ww2"] }),
    weapon("ww2_heavy_cannon", "重型航空机炮", { damage: 28.5, armorPierce: .45, fireRate: 2.2, speed: 30, range: 28, arc: 18, pierce: 1, eras: ["ww2"] }),
    weapon("ww2_rocket_battery", "翼下火箭阵列", { damage: 28.5, fireRate: .8, speed: 14.3, range: 28.5, count: 6, arc: 18, spread: 5, explosion: 2.6, eras: ["ww2"], targetLayers: ["air", "ground", "water"] }),
    weapon("aa_autocannon", "防空机关炮", { category: "turret", damage: 8, fireRate: 6, speed: 27, range: 30, arc: 14 }),
    weapon("naval_gun", "舰炮", { category: "turret", damage: 35, fireRate: .6, speed: 30, range: 40, arc: 16, turretArc: 180, eras: ["ww1", "ww2", "jet"] }),
    weapon("jet_autocannon", "喷气式机炮", { damage: 16, armorPierce: .35, fireRate: 7, speed: 34, range: 30, arc: 20, eras: ["jet"] }),
    weapon("jet_heavy_cannon", "喷气式重炮", { damage: 40, armorPierce: .5, fireRate: 1.8, speed: 36, range: 32, arc: 18, pierce: 1, eras: ["jet"] }),
    weapon("jet_air_missile", "拦截导弹", { damage: 85, fireRate: .5, speed: 14, range: 42, arc: 18, lockTime: 1, explosion: 3, homing: 170, homingLife: 4, eras: ["jet"] }),
    weapon("ww2_incendiary", "航空燃烧弹", { category: "area", damage: 57, fireRate: .125, explosion: 3.5, duration: 6, burn: 30, eras: ["ww2"], targetLayers: ["ground"] }),
    weapon("jet_rocket_pod", "喷气机火箭巢", { damage: 28, fireRate: .8, speed: 16, range: 30, count: 8, arc: 18, spread: 5, explosion: 2.4, eras: ["jet"], targetLayers: ["air", "ground", "water"] }),
    weapon("flak_88", "重型防空炮", { damage: 45, fireRate: .8, speed: 30, range: 40, explosion: 3.5, eras: ["ww2", "jet"], targetLayers: ["air"] }),
    weapon("howitzer", "自行火炮", { damage: 90, fireRate: .5, speed: 30, range: 50, explosion: 5, eras: ["pioneer", "ww1", "ww2", "jet"], targetLayers: ["ground"] }),
    weapon("light_cannon", "轻型机炮", {
      damage: 6,
      fireRate: 8,
      speed: 24,
      range: 24,
      arc: 20,
    }),
    weapon("nose_cannon_pair", "双联机炮", {
      damage: 11,
      fireRate: 4,
      speed: 28,
      range: 28,
      count: 2,
      arc: 22,
      spread: 1.5,
    }),
    weapon("wing_machinegun_pair", "双翼机枪", {
      count: 2,
      arc: 26,
      spread: 2.5,
    }),
    weapon("heavy_machinegun_quad", "四联重机枪", {
      damage: 9,
      fireRate: 7,
      speed: 25,
      range: 27,
      count: 4,
      arc: 28,
      spread: 3.5,
      pierce: 1,
    }),
    weapon("top_turret", "机背自动炮塔", {
      category: "turret",
      damage: 7,
      fireRate: 4.5,
      speed: 21,
      range: 21,
      arc: 14,
    }),
    weapon("wing_turret", "翼端旋转炮塔", {
      category: "turret",
      damage: 10,
      fireRate: 3.2,
      speed: 23,
      range: 24,
      arc: 16,
      turnRate: 80,
      turretArc: 180,
      pierce: 1,
    }),
    weapon("rocket_pod", "火箭巢", {
      eras: ["ww2", "jet"],
      targetLayers: ["air", "ground", "water"],
      damage: 24,
      fireRate: 0.8,
      speed: 15,
      range: 30,
      count: 4,
      arc: 18,
      spread: 5,
      explosion: 2.2,
    }),
    weapon("lock_missile", "锁定导弹", {
      eras: ["jet"],
      damage: 75,
      armorPierce: .4,
      fireRate: 0.5,
      speed: 12,
      range: 40,
      arc: 18,
      lockTime: 1.2,
      explosion: 2.8,
      homing: 150,
      homingLife: 4,
    }),
    weapon("gravity_bomb", "重力炸弹", {
      category: "area",
      damage: 120,
      fireRate: 0.25,
      explosion: 4.5,
    }),
    weapon("heavy_bomb", "重型炸弹", {
      category: "area",
      damage: 220,
      fireRate: 1 / 7,
      explosion: 7.5,
    }),
    weapon("napalm_bomb", "凝固汽油弹", {
      eras: ["ww2", "jet"],
      category: "area",
      damage: 45,
      fireRate: 0.125,
      explosion: 3.5,
      duration: 5,
      burn: 28,
    }),
  ].map((w) => [w.id, w]),
);
