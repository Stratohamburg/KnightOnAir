import type { DamageType } from "../../simulation/types";

export interface EffectPreview<K extends string = string> {
  readonly name: string;
  readonly trigger: string;
  readonly kind: K;
  readonly playback: "once" | "continuous";
}

const muzzle = (name: string, ammunition: "gun" | "powered" = "gun") => ({
  name, kind: "muzzle", trigger: "从参考挂点发射一次", playback: "once", ammunition,
} as const);
const airflow = (name: string): EffectPreview<"airflow"> => ({
  name, kind: "airflow", trigger: "沿弧线移动参考挂点", playback: "continuous",
});

export const weaponEffects = {
  machineGun: { preview: muzzle("机枪枪口"), color: "#ffce77", core: "#fff7c5", size: .67, duration: .105, sparks: 3, speed: 7, trail: .42, smoke: .39 },
  cannon: { preview: muzzle("机炮炮口"), color: "#ff9a3a", core: "#fff1b7", size: 1.04, duration: .14, sparks: 5, speed: 8.5, trail: .68, smoke: .6 },
  rocket: { preview: muzzle("火箭发射", "powered"), color: "#fc6a24", core: "#fff2b3", size: 1.4, duration: .19, sparks: 7, speed: 10, trail: 1.1, smoke: .85 },
  missile: { preview: muzzle("导弹发射", "powered"), color: "#82dfff", core: "#eafcff", size: 1.58, duration: .22, sparks: 8, speed: 11, trail: 1.4, smoke: 1 },
} as const;

export type WeaponEffectId = keyof typeof weaponEffects;
export const propulsionPreviews = {
  propeller: { name: "桨盘滑流", trigger: "转动参考桨盘", kind: "propeller", playback: "continuous" },
  exhaust: { name: "活塞排气", trigger: "参考排气口加力", kind: "exhaust", playback: "continuous" },
  jetOutlet: { name: "喷气尾焰", trigger: "参考喷口加力", kind: "jetOutlet", playback: "continuous" },
  noseWave: { name: "机头冲击波", trigger: "参考机头进入高速", kind: "noseWave", playback: "once" },
  burst: { name: "爆点", trigger: "触发瞬时爆点", kind: "burst", playback: "once" },
  coin: { name: "金币光效", trigger: "触发拾取光效", kind: "coin", playback: "once" },
  heal: { name: "修理光效", trigger: "触发修理光效", kind: "heal", playback: "once" },
} as const;
export function weaponEffectId(weaponId = "", damageType: DamageType = "kinetic"): WeaponEffectId {
  if (weaponId.includes("missile")) return "missile";
  if (weaponId.includes("rocket") || damageType === "explosive") return "rocket";
  if (/cannon|flak|howitzer|naval|turret/.test(weaponId)) return "cannon";
  return "machineGun";
}

export const flightEffectProfiles: Record<string, { waveThreshold: number; boostLength: number; segmented: boolean }> = {
  default: { waveThreshold: 1.1, boostLength: 1.2, segmented: false },
  stingray_16: { waveThreshold: 1.04, boostLength: 2.1, segmented: true },
  jet_bomber: { waveThreshold: 1.08, boostLength: 1.65, segmented: true },
};


// Seconds of visible motion history and the opacity at the point of release.
export const airflowProfiles = {
  wingTip:    { preview: airflow("主翼尖涡"), life: .30, extension: .46, opacity: .43, brighten: .35 },
  tailTip:    { preview: airflow("尾翼尖涡"), life: .23, extension: .24, opacity: .28, brighten: .19 },
  wingFlow:   { preview: airflow("翼中气流带"), life: .34, extension: .40, opacity: .18, brighten: .16, widthScale: 1.30 },
  protrusion: { preview: airflow("突出点气流"), life: .31, extension: .20, opacity: .29, brighten: .18 },
  wake:       { preview: airflow("机尾尾流"), life: .23, extension: .44, opacity: .19, brighten: .19 },
} as const;

export type AirflowKind = keyof typeof airflowProfiles;
export interface AirflowProfile {
  preview: EffectPreview<"airflow">;
  life: number;
  extension: number;
  opacity: number;
  brighten: number;
  widthScale?: number;
}

export function airflowProfile(id: string, profiles: Readonly<Record<string, AirflowProfile>> = airflowProfiles) {
  return Object.hasOwn(profiles, id) ? profiles[id] : undefined;
}

export function resolveAirflowProfile(kind: AirflowKind, references?: Partial<Record<AirflowKind, string>>,
  profiles: Readonly<Record<string, AirflowProfile>> = airflowProfiles) {
  const id = references?.[kind] ?? kind;
  return { id, profile: airflowProfile(id, profiles) };
}

export function weaponEffectProfile(id: string) {
  return Object.hasOwn(weaponEffects, id) ? weaponEffects[id as WeaponEffectId] : undefined;
}

export const upgradeImpact = {
  color: "#ffd989", life: .27, size: .72,
  sparks: 6, lowSize: .31, delay: .26,
} as const;
