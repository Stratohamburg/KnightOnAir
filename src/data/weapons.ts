export interface WeaponConfig {
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
      damage: 75,
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
      category: "area",
      damage: 45,
      fireRate: 0.125,
      explosion: 3.5,
      duration: 5,
      burn: 28,
    }),
  ].map((w) => [w.id, w]),
);
