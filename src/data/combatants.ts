import { AIRFRAMES } from "./aircrafts";
import { ENEMIES } from "./enemies";
import { WEAPONS } from "./weapons";
import type { PartRole, Slot, ControllerIntent } from "../simulation/types";

export type EraId = "pioneer" | "ww1" | "ww2" | "jet";
export type Layer = "air" | "ground" | "water";
export type BehaviorKind = "chase" | "patrol" | "intercept" | "escort" | "crossing" | "strafe" | "dive" | "standoff" | "convoy" | "static" | "flee";
export interface CombatPartRecipe { id: string; role: PartRole; slot: Slot; side: -1 | 0 | 1; health: number; damageTransfer: number; detachable: boolean; kind?: string; x?: number; z?: number; radius?: number; weight?: number; lift?: number; thrust?: number; }
export type MotionConfig = { model: "air"; mass: number; length: number; wingspan: number; wingArea: number; maxSpeed: number; cruiseSpeed: number; acceleration: number; turnRate: number; energyMax: number; energyDrain: number; energyRecover: number } | { model: "ground" | "water"; mass: number; length: number; radius: number; maxSpeed: number; acceleration: number; turnRate: number; routeKinds: ("road" | "rail" | "water")[] };
export interface MountRecipe { id: string; partId: string; weaponId: string; count: number; arc: number; baseAngle: number; targetLayers: Layer[]; x?: number; z?: number; overrides?: Partial<Record<string, number>>; }
export interface CombatantConfig { id: string; name?: string; era: EraId; layer: Layer; tags: string[]; frame: MotionConfig; parts: CombatPartRecipe[]; mounts: MountRecipe[]; capabilities: { bombing: boolean; lock: boolean; boost: boolean; routeKinds: ("road" | "rail" | "water")[] }; visual: { modelKey: string; eraSkin: EraId; color: string; accent: string; scale: number }; combat: { collisionRadius: number; weaponDamage: number; fireInterval: number }; }
export interface NpcProfile { id: string; combatantId: string; behavior: { kind: BehaviorKind; targetPolicy: "player" | "route" | "intercept" | "escort" | "groundTarget" | "none"; preferredRange: [number, number]; engageRadius: number; disengageRange: number; leadTime: number; breakChance: number; patrolRoute?: string; escortAnchorTag?: string }; spawn: { phases: ("intro" | "skirmish" | "pressure" | "mixed")[]; weight: number; maxAlive: number; slotCost: number; formation?: "line" | "v" | "orbit" | "escort" | "crossing" }; rewards: { xp: number; coins: number; score: number; drops?: string[] }; }
export interface ConfigDiagnostic { id: string; errors: string[]; }

const partsFor = (frame: (typeof AIRFRAMES)[number]): CombatPartRecipe[] => {
  const parts: CombatPartRecipe[] = [
    { id: "center_body", role: "body", slot: "center", side: 0, x: 0, z: 0, health: frame.health * .45, damageTransfer: 1, detachable: false },
    { id: "left_wing", role: "wing", slot: "leftWing", side: -1, x: -frame.wingspan * .23, z: -.1, health: frame.health * .12, damageTransfer: .5, detachable: false, lift: 1 },
    { id: "right_wing", role: "wing", slot: "rightWing", side: 1, x: frame.wingspan * .23, z: -.1, health: frame.health * .12, damageTransfer: .5, detachable: false, lift: 1 },
    { id: "tail", role: "tail", slot: "tail", side: 0, x: 0, z: -frame.length * .34, health: frame.health * .08, damageTransfer: 1, detachable: false },
    { id: "bay", kind: "bombBay", role: "bay", slot: "bottom", side: 0, x: 0, z: -.3, health: frame.health * .05, damageTransfer: 1, detachable: false },
    { id: "nose", role: "gun", slot: "nose", side: 0, x: 0, z: frame.length * .31, health: frame.health * .08, damageTransfer: 1, detachable: false },
  ];
  for (let i = 0; i < frame.engines; i++) {
    const x = frame.engines === 1 ? 0 : (i - (frame.engines - 1) / 2) * frame.wingspan * .2;
    parts.push({ id: `engine_${i}`, role: "engine", slot: x < 0 ? "leftWing" : x > 0 ? "rightWing" : "tail", side: x < 0 ? -1 : x > 0 ? 1 : 0, x, z: -frame.length * .2, health: frame.health * .1 / Math.max(1, frame.engines), damageTransfer: .35, detachable: false, thrust: 1 });
  }
  if (frame.turret) parts.push({ id: "top_turret", role: "turret", slot: "top", side: 0, health: frame.health * .08, damageTransfer: 1, detachable: false });
  return parts;
};

const mountsFor = (frame: (typeof AIRFRAMES)[number]): MountRecipe[] => {
  const mainCount = frame.gun.includes("quad") ? 4 : frame.gun.includes("pair") ? 2 : 1;
  const mounts: MountRecipe[] = frame.gun.includes("wing")
    ? [
        { id: "primary_left", partId: "left_wing", weaponId: frame.gun, count: mainCount / 2, arc: 22, baseAngle: 0, targetLayers: ["air"] },
        { id: "primary_right", partId: "right_wing", weaponId: frame.gun, count: mainCount / 2, arc: 22, baseAngle: 0, targetLayers: ["air"] },
      ]
    : [{ id: "primary", partId: "nose", weaponId: frame.gun, count: mainCount, arc: 22, baseAngle: 0, targetLayers: ["air"] }];
  if (frame.missile) mounts.push({ id: "lock", partId: "nose", weaponId: "lock_missile", count: 1, arc: 26, baseAngle: 0, targetLayers: ["air"] });
  if (frame.turret) mounts.push({ id: "turret", partId: "top_turret", weaponId: "top_turret", count: 1, arc: 180, baseAngle: 0, targetLayers: ["air"] });
  mounts.push({ id: "bomb", partId: "bay", weaponId: frame.bomb, count: 1, arc: 360, baseAngle: 0, targetLayers: ["ground", "water"] });
  return mounts;
};

export const COMBATANT_CONFIGS: Record<string, CombatantConfig> = Object.fromEntries(AIRFRAMES.map((frame) => [frame.id, {
  id: frame.id, name: frame.name, era: "jet" as EraId, layer: "air" as Layer, tags: [frame.role],
  frame: { model: "air" as const, mass: frame.mass, length: frame.length, wingspan: frame.wingspan, wingArea: frame.wingArea, maxSpeed: frame.maxSpeed, cruiseSpeed: frame.cruiseSpeed, acceleration: frame.acceleration, turnRate: frame.turnRate, energyMax: frame.energyMax, energyDrain: frame.energyDrain, energyRecover: frame.energyRecover },
  parts: partsFor(frame), mounts: mountsFor(frame), capabilities: { bombing: Boolean(frame.bomb), lock: frame.missile, boost: true, routeKinds: [] }, visual: { modelKey: frame.id, eraSkin: "jet" as EraId, color: frame.color, accent: frame.accent, scale: 1 }, combat: { collisionRadius: frame.footprint, weaponDamage: 0, fireInterval: 2 },
}]));

for (const [id, enemy] of Object.entries(ENEMIES)) {
  const air = enemy.layer === "air";
  COMBATANT_CONFIGS[id] = {
    id,
    name: enemy.name,
    era: "jet",
    layer: enemy.layer,
    tags: [enemy.name],
    frame: air
      ? { model: "air", mass: enemy.radius * 900, length: enemy.radius * 2.4, wingspan: enemy.radius * 2.8, wingArea: enemy.radius * 4, maxSpeed: enemy.speed, cruiseSpeed: enemy.speed, acceleration: 0, turnRate: enemy.turnRate, energyMax: 0, energyDrain: 0, energyRecover: 0 }
      : { model: enemy.layer as "ground" | "water", mass: enemy.radius * 700, length: enemy.radius * 2, radius: enemy.radius, maxSpeed: enemy.speed, acceleration: 0, turnRate: enemy.turnRate, routeKinds: [enemy.layer === "water" ? "water" : id === "armored_train" ? "rail" : "road"] },
    parts: air ? [
      { id: "center_body", role: "body", slot: "center", side: 0, health: enemy.health * .55, damageTransfer: 1, detachable: false, x: 0, z: 0, radius: enemy.radius * .75 },
      { id: "left_wing", role: "wing", slot: "leftWing", side: -1, health: enemy.health * .2, damageTransfer: .5, detachable: false, lift: 1, x: -enemy.radius * .8, z: 0, radius: enemy.radius * .65 },
      { id: "right_wing", role: "wing", slot: "rightWing", side: 1, health: enemy.health * .2, damageTransfer: .5, detachable: false, lift: 1, x: enemy.radius * .8, z: 0, radius: enemy.radius * .65 },
      { id: "engine", role: "engine", slot: "tail", side: 0, health: enemy.health * .05, damageTransfer: .35, detachable: false, thrust: 1, x: 0, z: -enemy.radius * .5, radius: enemy.radius * .45 },
    ] : [
      { id: "center_body", role: "body", slot: "center", side: 0, health: enemy.health * .55, damageTransfer: 1, detachable: false, x: 0, z: 0, radius: enemy.radius * .75 },
      { id: "mobility", role: "engine", slot: "center", side: 0, health: enemy.health * .25, damageTransfer: .35, detachable: false, thrust: 1, x: 0, z: -enemy.radius * .45, radius: enemy.radius * .5 },
      { id: "weapon", role: "gun", slot: "top", side: 0, health: enemy.health * .2, damageTransfer: 1, detachable: false, x: 0, z: enemy.radius * .25, radius: enemy.radius * .45 },
    ],
    mounts: enemy.damage > 0 ? [{ id: "primary", partId: air ? "center_body" : "weapon", weaponId: "light_cannon", count: id === "elite" ? 12 : id === "aa_truck" ? 5 : 1, arc: 24, baseAngle: 0, targetLayers: ["air"], overrides: { damage: enemy.damage, speed: id === "missile_truck" ? 10 : 12, range: 45, homing: id === "missile_truck" ? 35 : 0, homingLife: id === "missile_truck" ? 4 : 0 } }] : [],
    capabilities: { bombing: false, lock: false, boost: false, routeKinds: air ? [] : [enemy.layer === "water" ? "water" : id === "armored_train" ? "rail" : "road"] },
    visual: { modelKey: id, eraSkin: "jet", color: enemy.color, accent: enemy.color, scale: enemy.scale },
    combat: { collisionRadius: enemy.radius, weaponDamage: enemy.damage, fireInterval: enemy.fireInterval },
  };
}

export const NPC_PROFILES: Record<string, NpcProfile> = Object.fromEntries(Object.keys(ENEMIES).map((id) => {
  const enemy = ENEMIES[id];
  const route = enemy.layer === "water" ? "water-491" : id === "armored_train" ? "rail-492" : "road-491";
  const kind: BehaviorKind = id === "scout" ? "crossing" : id === "bomber" ? "standoff" : id === "escort" ? "escort" : id === "striker" ? "dive" : id === "elite" || id === "missile_truck" ? "standoff" : id === "aa_truck" || id === "gunboat" ? "patrol" : enemy.layer === "air" ? "chase" : id === "depot" ? "static" : "convoy";
  const targetPolicy: NpcProfile["behavior"]["targetPolicy"] = enemy.layer === "air" ? (kind === "escort" ? "escort" : "player") : kind === "static" ? "groundTarget" : "route";
  return [id, {
    id,
    combatantId: id,
    behavior: { kind, targetPolicy, preferredRange: [12, 28], engageRadius: 24, disengageRange: 45, leadTime: .35, breakChance: .1, ...(enemy.layer === "air" || kind === "static" ? {} : { patrolRoute: route }), ...(kind === "escort" ? { escortAnchorTag: "elite" } : {}) },
    spawn: { phases: ["intro", "skirmish", "pressure", "mixed"], weight: 1, maxAlive: id === "elite" ? 1 : enemy.layer === "air" ? 5 : 4, slotCost: id === "elite" ? 4 : 1 },
    rewards: { xp: enemy.xp, coins: enemy.coins, score: enemy.xp * 4 },
  } satisfies NpcProfile];
}));
export const COMBATANTS = COMBATANT_CONFIGS;
export const PLAYER_COMBATANTS = Object.fromEntries(AIRFRAMES.map((frame) => [frame.id, COMBATANT_CONFIGS[frame.id]]));
export const ENEMY_COMBATANTS = Object.fromEntries(Object.keys(ENEMIES).map((id) => [id, COMBATANT_CONFIGS[id]]));
export const NPC_PROFILE_CONFIGS = NPC_PROFILES;
export const combatantById = (id: string) => COMBATANT_CONFIGS[id];
export const npcProfileById = (id: string) => NPC_PROFILES[id];
export function validateCombatantConfig(config: CombatantConfig): ConfigDiagnostic | undefined {
  const errors: string[] = [];
  const partIds = new Set<string>();
  for (const part of config.parts) {
    if (partIds.has(part.id)) errors.push(`duplicate part ${part.id}`);
    partIds.add(part.id);
    if (!Number.isFinite(part.health) || part.health <= 0) errors.push(`invalid health ${part.id}`);
    if (!Number.isFinite(part.damageTransfer) || part.damageTransfer < 0 || part.damageTransfer > 1) errors.push(`invalid damageTransfer ${part.id}`);
  }
  if (!config.parts.some((part) => part.role === "body")) errors.push("at least one body segment is required");
  for (const mount of config.mounts) {
    if (!partIds.has(mount.partId)) errors.push(`unknown mount part ${mount.partId}`);
    if (!WEAPONS[mount.weaponId]) errors.push(`unknown mount weapon ${mount.weaponId}`);
    if (!mount.targetLayers.length) errors.push(`mount ${mount.id} has no target layer`);
    if (!Number.isFinite(mount.count) || mount.count < 1) errors.push(`invalid mount count ${mount.id}`);
  }
  if (config.layer === "air" && !config.parts.some((part) => (part.lift ?? 0) > 0)) errors.push("air combatant needs a lift source");
  if (config.layer !== "air" && !config.capabilities.routeKinds.length) errors.push("ground or water combatant needs route capability");
  return errors.length ? { id: config.id, errors } : undefined;
}
export function validateNpcProfile(profile: NpcProfile, combatants: ReadonlyMap<string, CombatantConfig> | Record<string, CombatantConfig>) {
  const errors: string[] = [];
  const exists = typeof (combatants as ReadonlyMap<string, CombatantConfig>).get === "function" ? Boolean((combatants as ReadonlyMap<string, CombatantConfig>).get(profile.combatantId)) : Boolean((combatants as Record<string, CombatantConfig>)[profile.combatantId]);
  if (!exists) errors.push(`unknown combatant ${profile.combatantId}`);
  if (profile.spawn.maxAlive < 1 || profile.spawn.slotCost < 1 || profile.spawn.weight < 0) errors.push("invalid spawn budget");
  if (["patrol", "convoy"].includes(profile.behavior.kind) && !profile.behavior.patrolRoute) errors.push("route behavior needs patrolRoute");
  if (profile.behavior.kind === "escort" && !profile.behavior.escortAnchorTag) errors.push("escort behavior needs escortAnchorTag");
  return errors.length ? { id: profile.id, errors } : undefined;
}
export const CONFIG_DIAGNOSTICS: ConfigDiagnostic[] = [
  ...Object.values(COMBATANT_CONFIGS).flatMap((config) => { const diagnostic = validateCombatantConfig(config); return diagnostic ? [diagnostic] : []; }),
  ...Object.values(NPC_PROFILES).flatMap((profile) => { const diagnostic = validateNpcProfile(profile, COMBATANT_CONFIGS); return diagnostic ? [diagnostic] : []; }),
];
export function assertCombatantConfigIntegrity() {
  if (CONFIG_DIAGNOSTICS.length) throw new Error(CONFIG_DIAGNOSTICS.map((diagnostic) => `${diagnostic.id}: ${diagnostic.errors.join(", ")}`).join("; "));
}
export type ControllerIntentShape = ControllerIntent;
