import { hoEngines, hoEngineMount, hoGear, hoUnit, hoX, hoZ } from "./ho229V2Sheet";
import { stationZ, unit, wingSegments } from "./fokkerDr1Sheet";
import { AIRFRAMES, eraOf, type Airframe, type EraId } from "./aircrafts";
import { fighterStationZ, fighterUnit, spitfireVbSheet, zero21Sheet } from "./pistonFighterSheets";
import { ENEMIES } from "./enemies";
import { ERA_ENEMIES } from "./eraEnemies";
import { referenceJetById } from "./referenceJetParts";
import { ERAS } from "./eras";
import { WEAPONS } from "./weapons";
import { upgradeConfigDiagnostics } from "./upgrades";
import { RAD } from "../services/Random";
import type { PartRole, Slot, ControllerIntent } from "../simulation/types";
import type { Point3 } from "../content/3d/anchors";
import { aircraftGeometryProfile } from "../content/3d/airframeShape";
import { defaultTopology, mountForPart, type AircraftTopology, type CenterlineMount } from "../simulation/CenterlineLayout";
import { validateAircraftLivery } from "./aircraftLiveries";

export type { EraId } from "./aircrafts";
export type Layer = "air" | "ground" | "water";
export type BehaviorKind = "chase" | "patrol" | "intercept" | "escort" | "crossing" | "strafe" | "dive" | "standoff" | "convoy" | "static" | "flee";
export interface CombatPartRecipe { outletOffset?: Point3; id: string; parentId?: string; role: PartRole; slot: Slot; side: -1 | 0 | 1; health: number; damageTransfer: number; detachable: boolean; kind?: string; x?: number; y?: number; z?: number; radius?: number; weight?: number; lift?: number; thrust?: number; centerline?: CenterlineMount; engineInstallation?: "tractor" | "pusher"; silhouette?: Point3[][]; layeredWing?: boolean; }
export type AirframeMotionConfig = {
  model: "air";
  mass: number;
  length: number;
  wingspan: number;
  wingArea: number;
  maxSpeed: number;
  cruiseSpeed: number;
  acceleration: number;
  turnRate: number;
  energyMax: number;
  energyDrain: number;
  energyRecover: number;
  windResponse?: number;
  bankLimit?: number;
  liftCenterY?: number;
  liftCenterZ?: number;
};
export type MotionConfig = AirframeMotionConfig | { model: "ground" | "water"; mass: number; length: number; radius: number; maxSpeed: number; acceleration: number; turnRate: number; routeKinds: ("road" | "rail" | "water")[] };
export interface MountRecipe { id: string; partId: string; weaponId: string; count: number; arc: number; baseAngle: number; targetLayers: Layer[]; offset?: Point3; barrelSpacing?: number; overrides?: Partial<Record<string, number>>; centerline?: CenterlineMount; }
export interface CombatantConfig { id: string; name?: string; era: EraId; layer: Layer; tags: string[]; frame: MotionConfig; parts: CombatPartRecipe[]; mounts: MountRecipe[]; topology?: AircraftTopology; capabilities: { bombing: boolean; lock: boolean; boost: boolean; routeKinds: ("road" | "rail" | "water")[] }; visual: { modelKey: string; eraSkin: EraId; color: string; accent: string; liveryId?: string; scale: number }; combat: { collisionRadius: number; weaponDamage: number; fireInterval: number }; }
export interface AirAttackProfile {
  attackWindow: number;
  attackAngle: number;
  attackThrottle: number;
  attackBoost: number;
  breakTime: number;
  breakDistance: number;
  reentryDistance: number;
  fleeHealth: number;
  tailDistance?: [number, number];
  tailHoldTime?: number;
  lostAngle?: number;
  breakOffset?: number;
  actionCooldown?: number;
  aimTolerance?: number;
}
export interface NpcProfile { id: string; kind?: string; elite?: boolean; reinforcement?: string; spread?: number; radial?: boolean; combatantId: string; airAttack?: AirAttackProfile; behavior: { kind: BehaviorKind; targetPolicy: "player" | "route" | "intercept" | "escort" | "groundTarget" | "none"; preferredRange: [number, number]; engageRadius: number; disengageRange: number; leadTime: number; breakChance: number; patrolRoute?: string; escortAnchorTag?: string }; spawn: { phases: ("intro" | "skirmish" | "pressure" | "mixed")[]; weight: number; maxAlive: number; slotCost: number; formation?: "line" | "v" | "orbit" | "escort" | "crossing" }; rewards: { xp: number; coins: number; score: number; drops?: string[] }; }
export interface ConfigDiagnostic { id: string; errors: string[]; }

const fighterSheetFor = (frame: Airframe) =>
  frame.geometryProfile === "spitfireVb" ? spitfireVbSheet :
    frame.geometryProfile === "zero21" ? zero21Sheet : undefined;

const partsFor = (frame: Airframe): CombatPartRecipe[] => {
  const parts: CombatPartRecipe[] = [
    { id: "center_body", role: "body", slot: "center", side: 0, x: 0, z: 0, health: frame.health * .45, damageTransfer: 1, detachable: false },
    { id: "left_wing", role: "wing", slot: "leftWing", side: -1, x: -frame.wingspan * .23, z: -.1, health: frame.health * .10, damageTransfer: .5, detachable: false, lift: .85 },
    { id: "right_wing", role: "wing", slot: "rightWing", side: 1, x: frame.wingspan * .23, z: -.1, health: frame.health * .10, damageTransfer: .5, detachable: false, lift: .85 },
    { id: "left_wing_tip", role: "wing", slot: "leftWing", side: -1, health: frame.health * .02, damageTransfer: .5, detachable: true, lift: .15 },
    { id: "right_wing_tip", role: "wing", slot: "rightWing", side: 1, health: frame.health * .02, damageTransfer: .5, detachable: true, lift: .15 },
    { id: "tail", role: "tail", slot: "tail", side: 0, x: 0, z: -frame.length * .34, health: frame.health * .08, damageTransfer: 1, detachable: false },
    { id: "bay", kind: "bombBay", role: "bay", slot: "bottom", side: 0, x: 0, z: -.3, health: frame.health * .05, damageTransfer: 1, detachable: false },
    { id: "nose", role: frame.gun ? "gun" : "body", slot: "nose", side: 0, x: 0, z: frame.length * .31, health: frame.health * .08, damageTransfer: 1, detachable: false },
  ];
  if (!frame.bomb) {
    const bay = parts.findIndex((part) => part.id === "bay");
    parts[0].health += parts[bay].health;
    parts.splice(bay, 1);
  }
  const layout = frame.pioneerLayout;
  const fighter = fighterSheetFor(frame);
  if (layout || fighter) {
    // Both meshes assign the complete wing to its main part, with no separate damageable tip.
    for (const side of [-1, 1]) {
      const id = side < 0 ? "left_wing" : "right_wing";
      const wing = parts.find(part => part.id === id)!;
      const tip = parts.findIndex(part => part.id === id + "_tip");
      wing.health += parts[tip].health;
      wing.lift = 1;
      wing.parentId = "center_body";
      parts.splice(tip, 1);
      if (layout) wing.z = layout.wingZ;
      if (fighter) {
        const [sheetX, leftFore, , rightFore] = fighter.readings.plan.at(-1)!;
        const [, leftHigh, , rightHigh] = fighter.readings.front.at(-1)!;
        Object.assign(wing, {
          x: side * (250 - sheetX) * fighterUnit,
          y: (95 - (leftHigh + rightHigh) / 2) * fighterUnit,
          z: fighterStationZ(fighter, (leftFore + rightFore) / 2 - 14),
        });
      }
    }
    const tail = parts.find(part => part.id === "tail")!;
    const nose = parts.find(part => part.id === "nose")!;
    if (fighter) {
      tail.z = fighterStationZ(fighter, fighter.assembly.fin[0][0]);
      parts[0].health += nose.health;
      parts.splice(parts.indexOf(nose), 1);
    } else if (layout) {
      const gunPosition = { x: 0, y: 1, z: layout.wingZ + .25 };
      Object.assign(nose, { id: "service_gun", parentId: "center_body", ...gunPosition,
        centerline: { lineId: "fuselage", station: gunPosition.z, offset: { x: 0, y: gunPosition.y, z: 0 } } });
      if (layout.tailZ !== undefined) tail.z = layout.tailZ;
      else {
        parts[0].health += tail.health;
        parts.splice(parts.indexOf(tail), 1);
      }
      if (layout.canardZ !== undefined) {
        const health = frame.health * .08;
        parts[0].health -= health;
        parts.push({ id: "nose", role: "body", slot: "nose", parentId: "center_body", side: 0,
          x: 0, z: layout.canardZ, health, detachable: false, damageTransfer: 1 });
      }
    }
  }
  if (frame.geometryProfile === "ho229V2") {
    const tail = parts.find(part => part.id === "tail")!;
    const nose = parts.find(part => part.id === "nose")!;
    const gear = hoGear[0];
    Object.assign(nose, { kind: "cannon", parentId: "center_body", z: hoZ(270),
      centerline: { lineId: "fuselage", station: hoZ(270), layer: "weapon" } });
    Object.assign(tail, { id: "landing_gear", kind: "landingGear", role: "body", slot: "bottom",
      parentId: "center_body", x: 0, y: gear.height * hoUnit, z: hoZ(gear.row) });
    for (const part of parts.filter(p => p.role === "wing")) {
      part.parentId = part.id.endsWith("_tip") ? part.id.replace("_tip", "") : "center_body";
    }
  }
  if (frame.geometryProfile === "fokkerDr1") {
    // Keep total native wing health, weight and lift while giving every
    // station an independently addressable part on its own half-wing line.
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].role === "wing") parts.splice(i, 1);
    for (const segment of wingSegments) {
      const share = (segment.end - segment.start) / (segment.wing.span / 2) / 3;
      parts.push({
        id: segment.id, parentId: segment.parentId, role: "wing", side: segment.side,
        slot: segment.side < 0 ? "leftWing" : "rightWing", health: frame.health * .12 * share,
        weight: 10 * share, lift: share, damageTransfer: .5, detachable: segment.role === "tip",
        centerline: { lineId: segment.lineId, nodeId: segment.role, layer: "structure",
          segmentRole: segment.role === "main" ? "mount" : segment.role },
      });
    }
    const gearHealth = frame.health * .04;
    parts[0].health -= gearHealth;
    parts.push({
      id: "landing_gear",
      kind: "landingGear",
      role: "body",
      slot: "bottom",
      side: 0,
      x: 0,
      y: -55 * unit,
      z: stationZ(42),
      health: gearHealth,
      damageTransfer: .4,
      detachable: false,
      radius: .56,
      weight: 2,
    });
  }
  for (let i = 0; i < frame.engines; i++) {
    if (frame.geometryProfile === "ho229V2") {
      const engine = hoEngines[i];
      const x = hoX(engine.column), mount = hoEngineMount(engine);
      const side = i === 0 ? -1 : 1;
      parts.push({ id: `engine_${i}`, role: "engine", parentId: "center_body",
        slot: side < 0 ? "leftWing" : "rightWing", side, x, ...mount,
        centerline: { lineId: "fuselage", station: mount.z, layer: "engine", offset: { x, y: mount.y, z: 0 } },
        health: frame.health * .05, damageTransfer: .35, detachable: false, thrust: 1 });
      continue;
    }
    const installed = layout?.engines[i];
    const x = installed?.[0] ?? (frame.engines === 1
      ? 0
      : (i - (frame.engines - 1) / 2) * frame.wingspan * .2);
    const side = x < 0 ? -1 : x > 0 ? 1 : 0;
    const slot: Slot = frame.engines > 1 ? side < 0 ? "leftWing" : "rightWing" : layout?.pusher ? "tail" : "nose";
    const y = installed?.[1] ?? 0;
    const z = installed?.[2] ?? (fighter ? fighterStationZ(fighter, fighter.assembly.propStation) :
      frame.geometryProfile === "fokkerDr1" ? stationZ(12) : frame.length * .38);
    const modelAnchor: CenterlineMount | undefined = installed || fighter
      ? { lineId: "fuselage", layer: "engine", station: z, offset: { x, y, z: 0 }, axis: layout?.pusher ? "pusher" : "tractor" }
      : undefined;
    parts.push({ id: `engine_${i}`, role: "engine", slot, side, x, y, z, health: frame.health * .1 / Math.max(1, frame.engines),
      parentId: modelAnchor ? "center_body" : undefined, centerline: modelAnchor,
      damageTransfer: .35, detachable: false, thrust: 1, engineInstallation: layout?.pusher ? "pusher" : "tractor" });
  }
  if (frame.turret) parts.push({ id: "top_turret", role: "turret", slot: "top", side: 0, health: frame.health * .08, damageTransfer: 1, detachable: false });
  const wingProfile = aircraftGeometryProfile(frame.geometryProfile)?.wing;
  const wingRootOffset = wingProfile?.layers?.[0]?.rootOffset ?? frame.wingspan * .06;
  const wingLineLength = Math.max(.1, frame.wingspan * .5 - wingRootOffset) * (wingProfile?.spanScale ?? 1);
  return parts.map((part) => ({
    ...part,
    centerline: part.centerline ?? mountForPart(part, frame, {
      segmentRole: part.id.endsWith("_tip") || part.id === "tail" ? "tip" : part.role === "wing" ? "root" : "mount",
      layer: part.role === "engine" ? "engine" : part.role === "gun" || part.role === "turret" ? "weapon" : part.role === "bay" ? "payload" : "structure",
      station: part.id.endsWith("_tip")
        ? wingLineLength * .78
        : frame.geometryProfile === "fokkerDr1" && part.role === "wing"
          ? 0
          : undefined,
      axis: part.engineInstallation,
      clearance: part.role === "engine" ? .8 : undefined,
    }),
  }));
};

function primaryMounts(weaponId?: string): MountRecipe[] {
  if (!weaponId) return [];
  const gun = WEAPONS[weaponId];
  const mainCount = gun.count;
  const layers = gun.targetLayers ?? ["air"];
  return (weaponId.includes("wing") || weaponId.includes("quad") || weaponId === "ww2_rocket_battery")
    ? [
        { id: "primary_left", partId: "left_wing", weaponId, count: mainCount / 2, arc: gun.arc, baseAngle: 0, targetLayers: layers },
        { id: "primary_right", partId: "right_wing", weaponId, count: mainCount / 2, arc: gun.arc, baseAngle: 0, targetLayers: layers },
      ]
    : [{ id: "primary", partId: "nose", weaponId, count: mainCount, arc: gun.arc, baseAngle: 0, targetLayers: layers }];
}

const mountsFor = (frame: Airframe, parts: readonly CombatPartRecipe[]): MountRecipe[] => {
  const mounts = primaryMounts(frame.gun);
  const fighter = fighterSheetFor(frame);
  if (fighter) {
    const [primary] = mounts.splice(0, 1);
    for (const partId of ["left_wing", "right_wing"]) {
      const wing = parts.find(part => part.id === partId)!;
      const muzzleZ = fighterStationZ(fighter, fighter === spitfireVbSheet ? 49 : 86);
      const muzzleY = (95 - (fighter === spitfireVbSheet ? 118 : 106)) * fighterUnit;
      mounts.push({ ...primary, id: "primary_" + partId, partId, count: 1,
        offset: { x: wing.side * 85 * fighterUnit - wing.x!, y: muzzleY - wing.y!, z: muzzleZ - wing.z! } });
    }
  }
  if (frame.pioneerLayout) {
    mounts[0].partId = "service_gun";
    mounts[0].offset = { x: 0, y: 0, z: .43 };
  }
  if (frame.missile) mounts.push({ id: "lock", partId: "nose", weaponId: "lock_missile", count: 1, arc: 26, baseAngle: 0, targetLayers: ["air"] });
  if (frame.turret) mounts.push({ id: "turret", partId: "top_turret", weaponId: "top_turret", count: 1, arc: WEAPONS.top_turret.arc, baseAngle: 0, targetLayers: ["air"] });
  if (frame.bomb) mounts.push({ id: "bomb", partId: "bay", weaponId: frame.bomb, count: 1, arc: 360, baseAngle: 0, targetLayers: WEAPONS[frame.bomb].targetLayers ?? ["ground", "water"] });
  return mounts.map((mount) => ({
    ...mount,
    ...(frame.geometryProfile === "ho229V2" && mount.id === "primary"
      ? { count: 2, offset: { x: 0, y: .20, z: .34 }, barrelSpacing: .55 }
      : {}),
    ...(frame.geometryProfile === "fokkerDr1" && mount.id === "primary"
      ? { offset: { x: 0, y: .2, z: .9 }, barrelSpacing: .2 }
      : {}),
    centerline: ((fighter || frame.pioneerLayout) ? parts.find(part => part.id === mount.partId)?.centerline : undefined) ?? mountForPart(
      {
        id: mount.partId,
        kind: mount.partId === "top_turret" ? "turret" : mount.partId === "bay" ? "bombBay" : "gun",
        role: mount.partId === "top_turret" ? "turret" : mount.partId === "bay" ? "bay" : "gun",
        slot: mount.partId === "left_wing" ? "leftWing" : mount.partId === "right_wing" ? "rightWing" : mount.partId === "top_turret" ? "top" : mount.partId === "bay" ? "bottom" : "nose",
        side: mount.partId === "left_wing" ? -1 : mount.partId === "right_wing" ? 1 : 0,
        x: 0,
        z: 0,
      },
      frame,
      { layer: mount.weaponId.includes("bomb") || mount.weaponId.includes("torpedo") ? "payload" : "weapon" },
    ),
  }));
};

export function playerCombatant(frame: Airframe): CombatantConfig {
  const parts = partsFor(frame);
  return {
    id: frame.id, name: frame.name, era: eraOf(frame), layer: "air", tags: [frame.role],
    frame: { model: "air", mass: frame.mass, length: frame.length, wingspan: frame.wingspan, wingArea: frame.wingArea, maxSpeed: frame.maxSpeed, cruiseSpeed: frame.cruiseSpeed, acceleration: frame.acceleration, turnRate: frame.turnRate, energyMax: frame.energyMax, energyDrain: frame.energyDrain, energyRecover: frame.energyRecover, liftCenterY: frame.liftCenterY, liftCenterZ: frame.liftCenterZ },
    parts, mounts: mountsFor(frame, parts), topology: defaultTopology(frame), capabilities: { bombing: Boolean(frame.bomb), lock: frame.missile, boost: true, routeKinds: [] }, visual: { modelKey: frame.id, eraSkin: eraOf(frame), color: frame.color, accent: frame.accent, liveryId: frame.liveryId, scale: 1 }, combat: { collisionRadius: frame.footprint, weaponDamage: 0, fireInterval: 2 },
  };
}

export const COMBATANT_CONFIGS: Record<string, CombatantConfig> = Object.fromEntries(
  AIRFRAMES.map(frame => [frame.id, playerCombatant(frame)]),
);

for (const [id, enemy] of Object.entries(ENEMIES)) {
  const air = enemy.layer === "air";
  COMBATANT_CONFIGS[id] = {
    id,
    name: enemy.name,
    era: "jet",
    layer: enemy.layer,
    tags: [enemy.name],
    frame: air
      ? { model: "air", mass: enemy.radius * 900, length: enemy.radius * 2.4, wingspan: enemy.radius * 2.8, wingArea: enemy.radius * 4, maxSpeed: enemy.speed, cruiseSpeed: enemy.speed, acceleration: Math.max(3.5, enemy.speed * .85), turnRate: enemy.turnRate, energyMax: 0, energyDrain: 0, energyRecover: 0, liftCenterY: id === "elite" ? 0 : .1, liftCenterZ: id === "elite" ? 0 : enemy.radius * .12 }
      : { model: enemy.layer as "ground" | "water", mass: enemy.radius * 700, length: enemy.radius * 2, radius: enemy.radius, maxSpeed: enemy.speed, acceleration: 0, turnRate: enemy.turnRate, routeKinds: [enemy.layer === "water" ? "water" : id === "armored_train" ? "rail" : "road"] },
    parts: air ? [
      { id: "center_body", role: "body", slot: "center", side: 0, health: enemy.health * .55, damageTransfer: 1, detachable: false, x: 0, z: 0, radius: enemy.radius * .75 },
      { id: "left_wing", role: "wing", slot: "leftWing", side: -1, health: enemy.health * .17, damageTransfer: .5, detachable: false, lift: .85, x: -enemy.radius * .8, z: 0, radius: enemy.radius * .65 },
      { id: "right_wing", role: "wing", slot: "rightWing", side: 1, health: enemy.health * .17, damageTransfer: .5, detachable: false, lift: .85, x: enemy.radius * .8, z: 0, radius: enemy.radius * .65 },
      { id: "left_wing_tip", role: "wing", slot: "leftWing", side: -1, health: enemy.health * .03, damageTransfer: .5, detachable: true, lift: .15 },
      { id: "right_wing_tip", role: "wing", slot: "rightWing", side: 1, health: enemy.health * .03, damageTransfer: .5, detachable: true, lift: .15 },
      { id: "engine", role: "engine", slot: "tail", side: 0, health: enemy.health * .05, damageTransfer: .35, detachable: false, thrust: 1, x: 0, z: -enemy.radius * .5, radius: enemy.radius * .45 },
    ] : [
      { id: "center_body", role: "body", slot: "center", side: 0, health: enemy.health * .55, damageTransfer: 1, detachable: false, x: 0, z: 0, radius: enemy.radius * .75 },
      { id: "mobility", role: "engine", slot: "center", side: 0, health: enemy.health * .25, damageTransfer: .35, detachable: false, thrust: 1, x: 0, z: -enemy.radius * .45, radius: enemy.radius * .5 },
      { id: "weapon", role: "gun", slot: "top", side: 0, health: enemy.health * .2, damageTransfer: 1, detachable: false, x: 0, z: enemy.radius * .25, radius: enemy.radius * .45 },
    ],
    mounts: enemy.damage > 0 ? [{ id: "primary", partId: air ? "center_body" : "weapon", weaponId: "light_cannon", count: id === "elite" ? 12 : id === "aa_truck" ? 5 : 1, arc: 24, baseAngle: 0, targetLayers: ["air"], overrides: { damage: enemy.damage, speed: id === "missile_truck" ? 10 : 12, range: 45, homing: id === "missile_truck" ? 35 : 0, homingLife: id === "missile_truck" ? 4 : 0 } }] : [],
    capabilities: { bombing: false, lock: false, boost: false, routeKinds: air ? [] : [enemy.layer === "water" ? "water" : id === "armored_train" ? "rail" : "road"] },
    visual: { modelKey: id, eraSkin: "jet", color: enemy.color, accent: enemy.color, liveryId: `legacy:${id}`, scale: enemy.scale },
    combat: { collisionRadius: enemy.radius, weaponDamage: enemy.damage, fireInterval: enemy.fireInterval },
  };
}

function airAttackFor(kind: BehaviorKind): AirAttackProfile {
  const fast = kind === "intercept" || kind === "dive" || kind === "strafe";
  const tail = kind === "chase";
  const route = kind === "crossing" || kind === "escort" || kind === "standoff" || kind === "patrol";
  return {
    attackWindow: fast ? 1.15 : tail ? 4.2 : route ? 1.1 : 1.3,
    attackAngle: fast ? 22 : tail ? 28 : 32,
    attackThrottle: fast ? 1 : tail ? .74 : route ? .65 : .76,
    attackBoost: fast ? 1 : 0,
    breakTime: fast ? 2.1 : tail ? 1.6 : 1.3,
    breakDistance: fast ? 18 : tail ? 12 : 10,
    reentryDistance: fast ? 30 : tail ? 23 : 19,
    fleeHealth: .2,
    tailDistance: tail ? [7, 12] : [10, 18],
    tailHoldTime: tail ? 4.2 : .65,
    lostAngle: tail ? .82 : 1.05,
    breakOffset: fast ? .34 : tail ? .86 : .26,
    actionCooldown: fast ? .45 : tail ? .3 : .25,
    aimTolerance: fast ? 8 * RAD : tail ? 11 * RAD : 14 * RAD,
  };
}

function npcFlight(base: AirframeMotionConfig, id: string, behavior: BehaviorKind, speed: number, turnRate: number): AirframeMotionConfig {
  const fast = behavior === "intercept" || behavior === "dive" || behavior === "strafe";
  const light = id === "scout";
  const buoyant = id === "recon_balloon" || id === "elite";
  const route = behavior === "crossing" || behavior === "standoff" || behavior === "patrol";
  const hunter = behavior === "chase";
  const bank = buoyant ? 22 : route ? 45 : light ? 79 : fast ? 58 : 74;
  return {
    ...base,
    maxSpeed: speed * (fast ? 1.23 : route ? 1 : 1.12),
    cruiseSpeed: speed * (buoyant ? .76 : route ? .80 : behavior === "escort" ? .38 : hunter ? .38 : .59),
    turnRate,
    acceleration: Math.max(.35, speed * (fast ? .94 : route ? .46 : .82)),
    bankLimit: bank * Math.PI / 180,
    windResponse: buoyant ? .7 : 1,
    energyMax: fast ? 65 : 0,
    energyDrain: fast ? 18 : 0,
    energyRecover: fast ? 9 : 0,
  };
}

export const NPC_PROFILES: Record<string, NpcProfile> = Object.fromEntries(Object.keys(ENEMIES).map((id) => {
  const enemy = ENEMIES[id];
  const route = enemy.layer === "water" ? "water-491" : id === "armored_train" ? "rail-492" : "road-491";
  const kind: BehaviorKind = id === "scout" ? "crossing" : id === "bomber" ? "standoff" : id === "escort" ? "escort" : id === "striker" ? "dive" : id === "elite" || id === "missile_truck" ? "standoff" : id === "aa_truck" || id === "gunboat" ? "patrol" : enemy.layer === "air" ? "chase" : id === "depot" ? "static" : "convoy";
  const config = COMBATANT_CONFIGS[id];
  if (config.frame.model === "air") {
    config.frame = npcFlight(config.frame, id, kind, enemy.speed, enemy.turnRate);
    config.capabilities.boost = config.frame.energyMax > 0;
  }
  const targetPolicy: NpcProfile["behavior"]["targetPolicy"] = enemy.layer === "air" ? (kind === "escort" ? "escort" : "player") : kind === "static" ? "groundTarget" : "route";
  return [id, {
    id,
    elite: id === "elite",
    radial: id === "elite",
    reinforcement: id === "scout" ? "hunter" : undefined,
    combatantId: id,
    airAttack: enemy.layer === "air" ? airAttackFor(kind) : undefined,
    behavior: { kind, targetPolicy, preferredRange: [12, 28], engageRadius: 24, disengageRange: 45, leadTime: .35, breakChance: .1, ...(enemy.layer === "air" || kind === "static" ? {} : { patrolRoute: route }), ...(kind === "escort" ? { escortAnchorTag: "elite" } : {}) },
    spawn: { phases: ["intro", "skirmish", "pressure", "mixed"], weight: 1, maxAlive: id === "elite" ? 1 : enemy.layer === "air" ? 5 : 4, slotCost: id === "elite" ? 4 : 1 },
    rewards: { xp: enemy.xp, coins: enemy.coins, score: enemy.xp * 4 },
  } satisfies NpcProfile];
}));
const phases: NpcProfile["spawn"]["phases"] = ["intro", "skirmish", "pressure", "mixed"];
export const BALLOON_TARGET_MODEL_ID = "target:recon_balloon";
const ww1AircraftFromPioneer = new Set(["reference_caudron_g3", "reference_ilya_muromets", "reference_voisin_iii"]);

export function combatAircraftFrame(modelId: string) {
  return AIRFRAMES.find(frame => frame.id === modelId);
}

function modelMatchesEra(modelId: string, era: EraId) {
  const modelEra = combatAircraftFrame(modelId)?.era ?? referenceJetById(modelId)?.frame.era;
  return modelEra === era || (era === "ww1" && ww1AircraftFromPioneer.has(modelId));
}

for (const [era, kind, name, template, behavior, availableFrom, health, speed, turnRate, xp, coins, weaponId, modelId] of ERA_ENEMIES) {
  const base = COMBATANT_CONFIGS[template];
  const original = NPC_PROFILES[template];
  const id = era === "jet" ? kind : era + ":" + kind;
  const aircraft = modelId ? COMBATANT_CONFIGS[modelId] : undefined;
  const reference = modelId ? referenceJetById(modelId) : undefined;
  const balloon = kind === "recon_balloon";
  const parts: CombatPartRecipe[] = aircraft?.parts ?? reference?.parts ?? (balloon ? [{
    id: "center_body", role: "body", slot: "center", side: 0, health, damageTransfer: 1,
    detachable: false, radius: 1.1, lift: 1, thrust: 1,
  }] : base.parts);
  const maxHealth = parts.reduce((sum, part) => sum + part.health, 0);
  const weapon = weaponId ? WEAPONS[weaponId] : undefined;
  if (weaponId && !weapon) throw new Error("Unknown era weapon " + weaponId);
  const elite = availableFrom === "elite";
  const damage = weapon ? Math.min(base.combat.weaponDamage || weapon.damage, weapon.damage) : 0;
  const primary: MountRecipe = {
    id: "primary",
    partId: base.layer === "air" ? "center_body" : "weapon",
    weaponId: weaponId ?? "",
    count: weapon?.count ?? 1,
    arc: weapon?.arc ?? 0,
    baseAngle: 0,
    targetLayers: weapon?.targetLayers ?? ["air"],
    overrides: { damage },
  };
  const aircraftMounts = aircraft?.mounts.filter(mount => mount.id.startsWith("primary"));
  const mounts = aircraftMounts?.length ? aircraftMounts.map(mount => ({
    ...mount, weaponId: primary.weaponId, arc: primary.arc, targetLayers: primary.targetLayers, overrides: primary.overrides,
  })) : [{ ...primary, ...(reference ? { offset: { x: 0, y: -.24, z: reference.frame.length * .46 }, barrelSpacing: .18 } : {}) }];
  const airMotion = aircraft?.frame.model === "air" ? aircraft.frame : base.frame;
  COMBATANT_CONFIGS[id] = {
    ...base, id, name, era,
    tags: [kind, ...(elite ? ["elite"] : [])],
    parts: parts.map(part => ({ ...part, health: part.health * health / maxHealth })),
    topology: aircraft?.topology,
    frame: airMotion.model === "air"
      ? npcFlight({ ...airMotion, ...(reference && {
        length: reference.frame.length, wingspan: reference.frame.wingspan,
        mass: reference.mass, wingArea: reference.wingArea,
        liftCenterY: reference.frame.liftCenterY, liftCenterZ: reference.frame.liftCenterZ,
      }), ...(balloon && { length: 2.2, wingspan: 1.8 }) }, kind, behavior, speed, turnRate ?? airMotion.turnRate)
      : { ...base.frame, maxSpeed: speed, turnRate: turnRate ?? base.frame.turnRate },
    capabilities: { ...base.capabilities, boost: base.layer === "air" && airAttackFor(behavior).attackBoost > 0 },
    mounts: weapon ? mounts : [],
    visual: { ...base.visual, modelKey: balloon ? BALLOON_TARGET_MODEL_ID : modelId ?? kind, eraSkin: era },
    combat: { ...base.combat, collisionRadius: aircraft?.combat.collisionRadius ?? (reference ? reference.frame.length * .14 : balloon ? 1.1 : base.combat.collisionRadius),
      weaponDamage: damage, fireInterval: behavior === "chase" ? 1.15 : base.combat.fireInterval },
  };
  NPC_PROFILES[id] = {
    ...original, id, kind, elite, radial: false, combatantId: id,
    airAttack: base.layer === "air" ? airAttackFor(behavior) : undefined,
    reinforcement: kind === "radar_truck" || (kind === "scout" && era !== "pioneer") ? "hunter" : undefined,
    behavior: {
      ...original.behavior, kind: behavior,
      targetPolicy: behavior === "escort" ? "escort" : base.layer === "air" ? "player" : behavior === "static" ? "none" : "route",
      ...(behavior === "patrol" && base.layer === "air" ? { patrolRoute: "air-patrol" } : {}),
      ...(behavior === "escort" ? { escortAnchorTag: "elite" } : {}),
    },
    spawn: { ...original.spawn, phases: elite ? [] : phases.slice(phases.indexOf(availableFrom as typeof phases[number])),
      maxAlive: elite ? 1 : original.spawn.maxAlive, slotCost: elite ? 1 : original.spawn.slotCost },
    rewards: { xp, coins, score: xp * 4, drops: elite ? ["repairLarge"] : undefined },
  };
}

export const COMBATANTS = COMBATANT_CONFIGS;
export const PLAYER_COMBATANTS = Object.fromEntries(AIRFRAMES.map((frame) => [frame.id, COMBATANT_CONFIGS[frame.id]]));
export const ENEMY_COMBATANTS = Object.fromEntries(Object.keys(ENEMIES).map((id) => [id, COMBATANT_CONFIGS[id]]));
export const NPC_PROFILE_CONFIGS = NPC_PROFILES;
export const combatantById = (id: string) => COMBATANT_CONFIGS[id];
export const npcProfileById = (id: string, era: EraId = "jet"): NpcProfile | undefined =>
  NPC_PROFILES[era === "jet" ? id : era + ":" + id];
export function validateCombatantConfig(config: CombatantConfig): ConfigDiagnostic | undefined {
  const errors: string[] = [];
  const partIds = new Set<string>();
  for (const part of config.parts) {
    if (partIds.has(part.id)) errors.push(`duplicate part ${part.id}`);
    partIds.add(part.id);
    if ([part.x ?? 0, part.y ?? 0, part.z ?? 0].some((value) => !Number.isFinite(value)))
      errors.push(`invalid part anchor ${part.id}`);
    if ([part.weight, part.lift, part.thrust].some((value) => value !== undefined && (!Number.isFinite(value) || value < 0)))
      errors.push("invalid part weight, lift or thrust " + part.id);
    if (!Number.isFinite(part.health) || part.health <= 0) errors.push(`invalid health ${part.id}`);
    if (!Number.isFinite(part.damageTransfer) || part.damageTransfer < 0 || part.damageTransfer > 1) errors.push(`invalid damageTransfer ${part.id}`);
  }
  if (!config.parts.some((part) => part.role === "body")) errors.push("at least one body segment is required");
  const mountIds = new Set<string>();
  for (const mount of config.mounts) {
    if (mountIds.has(mount.id)) errors.push(`duplicate mount anchor ${mount.id}`);
    mountIds.add(mount.id);
    if (!partIds.has(mount.partId)) errors.push(`unknown mount part ${mount.partId}`);
    const weapon = WEAPONS[mount.weaponId];
    if (!weapon) errors.push(`unknown mount weapon ${mount.weaponId}`);
    if (weapon?.eras && !weapon.eras.includes(config.era)) errors.push(`weapon unavailable in era ${mount.weaponId}`);
    if (mount.targetLayers.some((layer) => !["air", "ground", "water"].includes(layer))) errors.push(`invalid target layer ${mount.id}`);
    if (!mount.targetLayers.length) errors.push(`mount ${mount.id} has no target layer`);
    if (!Number.isFinite(mount.count) || mount.count < 1) errors.push(`invalid mount count ${mount.id}`);
    if ([mount.baseAngle, ...Object.values(mount.offset ?? {})].some((value) => !Number.isFinite(value)))
      errors.push(`invalid mount anchor ${mount.id}`);
  }
  if (config.topology) {
    const lineIds = new Set<string>();
    for (const line of config.topology.centerlines) {
      if (lineIds.has(line.id)) errors.push(`duplicate centerline ${line.id}`);
      lineIds.add(line.id);
      if (!Number.isFinite(line.length) || line.length <= 0) errors.push(`invalid centerline length ${line.id}`);
      if (Math.hypot(line.direction.x, line.direction.y, line.direction.z) < 1e-6) errors.push(`centerline has no direction ${line.id}`);
      for (const node of line.nodes) {
        if (!Number.isFinite(node.station) || Math.abs(node.station) > line.length * 1.5) errors.push(`invalid centerline node ${line.id}:${node.id}`);
      }
    }
    for (const part of config.parts) {
      if (part.centerline && !lineIds.has(part.centerline.lineId)) errors.push(`unknown part centerline ${part.id}`);
    }
    for (const mount of config.mounts) {
      if (mount.centerline && !lineIds.has(mount.centerline.lineId)) errors.push(`unknown mount centerline ${mount.id}`);
    }
    for (const connection of config.topology.connections) {
      if (!lineIds.has(connection.from) || !lineIds.has(connection.to)) errors.push(`unknown centerline connection ${connection.id}`);
    }
  }
  if (config.layer === "air" && !config.parts.some((part) => (part.lift ?? 0) > 0)) errors.push("air combatant needs a lift source");
  if (config.frame.model !== config.layer) errors.push("motion model does not match layer");
  if (config.frame.model === "air") {
    const f = config.frame;
    if ([f.mass, f.length, f.wingspan, f.wingArea, f.maxSpeed, f.cruiseSpeed, f.acceleration, f.turnRate]
        .some((value) => !Number.isFinite(value) || value <= 0) || f.cruiseSpeed > f.maxSpeed)
      errors.push("invalid air flight envelope");
    if ([f.energyMax, f.energyDrain, f.energyRecover, f.windResponse ?? 1].some((value) => !Number.isFinite(value) || value < 0) ||
        (config.capabilities.boost && Math.min(f.energyMax, f.energyDrain, f.energyRecover) <= 0))
      errors.push("invalid air boost or wind response");
    if (f.bankLimit !== undefined && (!Number.isFinite(f.bankLimit) || f.bankLimit <= 0 || f.bankLimit >= Math.PI / 2))
      errors.push("invalid bank limit");
  }
  if (config.layer !== "air" && !config.capabilities.routeKinds.length) errors.push("ground or water combatant needs route capability");
  return errors.length ? { id: config.id, errors } : undefined;
}
export function validateNpcProfile(profile: NpcProfile, combatants: ReadonlyMap<string, CombatantConfig> | Record<string, CombatantConfig>) {
  const errors: string[] = [];
  const config = typeof (combatants as ReadonlyMap<string, CombatantConfig>).get === "function" ?
    (combatants as ReadonlyMap<string, CombatantConfig>).get(profile.combatantId) :
    (combatants as Record<string, CombatantConfig>)[profile.combatantId];
  if (!config) errors.push(`unknown combatant ${profile.combatantId}`);
  if (!Number.isInteger(profile.spawn.maxAlive) || profile.spawn.maxAlive < 1 ||
      !Number.isInteger(profile.spawn.slotCost) || profile.spawn.slotCost < 1 ||
      !Number.isFinite(profile.spawn.weight) || profile.spawn.weight < 0) errors.push("invalid spawn budget");
  if (["patrol", "convoy"].includes(profile.behavior.kind) && !profile.behavior.patrolRoute) errors.push("route behavior needs patrolRoute");
  if (profile.behavior.kind === "escort" && !profile.behavior.escortAnchorTag) errors.push("escort behavior needs escortAnchorTag");
  if (config?.frame.model === "air") {
    const trainingTarget = profile.kind === "recon_balloon" && config.visual.modelKey === BALLOON_TARGET_MODEL_ID && !config.mounts.length;
    if (!trainingTarget && !modelMatchesEra(config.visual.modelKey, config.era))
      errors.push("missing era-appropriate prototype aircraft model");
    const { kind, engageRadius, leadTime, preferredRange } = profile.behavior;
    if (!["chase", "patrol", "intercept", "escort", "crossing", "strafe", "dive", "standoff", "static", "flee"].includes(kind) ||
        [engageRadius, leadTime, ...preferredRange].some((value) => !Number.isFinite(value) || value <= 0) ||
        preferredRange[0] > preferredRange[1])
      errors.push("invalid air behavior");
    const attack = profile.airAttack;
    if (!attack || [attack.attackWindow, attack.attackAngle, attack.breakTime, attack.breakDistance, attack.reentryDistance]
        .some((value) => !Number.isFinite(value) || value <= 0) ||
        [attack.attackThrottle, attack.attackBoost, attack.fleeHealth].some((value) => !Number.isFinite(value) || value < 0 || value > 1) ||
        attack.attackAngle > 180 || attack.reentryDistance < attack.breakDistance ||
        (attack.tailDistance !== undefined && (attack.tailDistance.length !== 2 || attack.tailDistance.some((value) => !Number.isFinite(value) || value <= 0) || attack.tailDistance[0] > attack.tailDistance[1])) ||
        [attack.tailHoldTime, attack.lostAngle, attack.breakOffset, attack.actionCooldown, attack.aimTolerance]
          .some((value) => value !== undefined && (!Number.isFinite(value) || value <= 0)) ||
        (attack.attackBoost > 0 && !config.capabilities.boost))
      errors.push("invalid air attack, breakaway or reentry profile");
  }
  return errors.length ? { id: profile.id, errors } : undefined;
}
export const CONFIG_DIAGNOSTICS: ConfigDiagnostic[] = [
  ...upgradeConfigDiagnostics(AIRFRAMES),
  ...AIRFRAMES.flatMap((frame) => { const diagnostic = validateAircraftLivery(frame); return diagnostic ? [diagnostic] : []; }),
  ...Object.values(COMBATANT_CONFIGS).flatMap((config) => { const diagnostic = validateCombatantConfig(config); return diagnostic ? [diagnostic] : []; }),
  ...Object.entries(ERAS).flatMap(([era, plan]) =>
    [...new Set([...plan.opening, ...plan.air, ...plan.surface, ...plan.elite])]
      .filter((id) => !npcProfileById(id, era as EraId))
      .map((id) => ({ id: era + ":" + id, errors: ["missing era spawn profile"] }))),
  ...Object.values(NPC_PROFILES).flatMap((profile) => { const diagnostic = validateNpcProfile(profile, COMBATANT_CONFIGS); return diagnostic ? [diagnostic] : []; }),
];
export function assertCombatantConfigIntegrity() {
  if (CONFIG_DIAGNOSTICS.length) throw new Error(CONFIG_DIAGNOSTICS.map((diagnostic) => `${diagnostic.id}: ${diagnostic.errors.join(", ")}`).join("; "));
}
export type ControllerIntentShape = ControllerIntent;
