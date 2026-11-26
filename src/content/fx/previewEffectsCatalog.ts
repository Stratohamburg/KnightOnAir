import type { Airframe } from "../../data/aircrafts";
import { combatantById } from "../../data/combatants";
import { WEAPONS } from "../../data/weapons";
import { rainPreview } from "./WeatherRain";
import { surfaceDamagePreviews } from "./SurfaceDamage";
import { airflowProfiles, weaponEffects, weaponEffectId, weaponEffectProfile, resolveAirflowProfile,
  propulsionPreviews, type AirflowProfile, type AirflowKind, type EffectPreview } from "./profiles";

type PreviewKind = "muzzle" | "impact" | "projectile" | "airflow" | "rain" | "propeller" | "exhaust" |
  "jetOutlet" | "noseWave" | "damage" | "detach" | "destroyed" | "burst" | "coin" | "heal";
type Ammunition = "gun" | "powered";
export type EffectEntry = EffectPreview<PreviewKind> & {
  readonly id: string;
  readonly profile?: string;
  readonly ammunition?: Ammunition;
};

export function previewEffectsCatalog(
  weapons: Readonly<Record<string, { readonly preview: EffectPreview<"muzzle"> & { readonly ammunition: Ammunition } }>> = weaponEffects,
  airflow: Readonly<Record<string, AirflowProfile>> = airflowProfiles,
): readonly EffectEntry[] {
  return Object.freeze([
    ...Object.entries(weapons).flatMap(([id, { preview }]): EffectEntry[] => [
      { ...preview, id: `${id}/muzzle`, profile: id },
      { id: `${id}/impact`, profile: id, ammunition: preview.ammunition, name: `${preview.name} · 命中`, trigger: "击中靶面", kind: "impact", playback: "once" },
      { id: `${id}/projectile`, profile: id, ammunition: preview.ammunition, name: `${preview.name} · 弹道`, trigger: "发射并观察飞行弹体", kind: "projectile", playback: "once" },
    ]),
    ...Object.entries(airflow).map(([id, { preview }]) => ({ ...preview, id, profile: id })),
    ...Object.entries({ ...propulsionPreviews, ...surfaceDamagePreviews, rain: rainPreview })
      .map(([id, preview]) => ({ ...preview, id })),
  ]);
}

export function previewDependencies(frame: Airframe, airflow: Readonly<Record<string, AirflowProfile>> = airflowProfiles) {
  const missing: { action: string; id: string }[] = [];
  for (const kind of Object.keys(frame.airflowEffects ?? {}) as AirflowKind[]) {
    const { id, profile } = resolveAirflowProfile(kind, frame.airflowEffects, airflow);
    if (!profile) missing.push({ action: kind, id });
  }
  for (const mount of combatantById(frame.id)?.mounts ?? []) {
    const weapon = WEAPONS[mount.weaponId];
    if (!weapon) {
      missing.push({ action: mount.id, id: mount.weaponId });
      continue;
    }
    const id = weapon.effectId ?? weaponEffectId(weapon.id, weapon.explosion > 0 || weapon.homing > 0 ? "explosive" : "kinetic");
    if (!weaponEffectProfile(id)) missing.push({ action: mount.id, id });
  }
  return missing;
}
