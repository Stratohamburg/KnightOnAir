import type { Airframe } from "../data/aircrafts";
import type { WeaponConfig } from "../data/weapons";
import type { Point3 } from "../content/3d/anchors";
export type Phase =
  "battle" | "bombing" | "upgrade" | "paused" | "dying" | "result";
export type Slot =
  "center" | "nose" | "tail" | "leftWing" | "rightWing" | "top" | "bottom";
export interface Intent {
  x: number;
  z: number;
  magnitude: number;
  active: boolean;
  boost?: number;
  travel?: number;
}
export const NO_INPUT: Intent = { x: 0, z: 1, magnitude: 0, active: false };
export interface Part {
  id: string;
  kind: string;
  slot: Slot;
  x: number;
  y?: number;
  z: number;
  radius: number;
  health: number;
  maxHealth: number;
  destroyed: boolean;
  weight: number;
  addedMass: number;
  role?: PartRole;
  side?: -1 | 0 | 1;
  lift?: number;
  thrust?: number;
  weaponIds?: string[];
  damageTransfer?: number;
  state?: PartDamageState;
  disabled?: boolean;
  visual?: { kind: string; scale: number; detachable: boolean };
  hitCircles?: { x: number; z: number; r: number }[];
  silhouette?: Point3[][];
  detachSeed?: number;
  parentId?: string;
  connection?: { side: -1 | 0 | 1; x: number; z: number };
}
export type PartRole =
  | "body"
  | "wing"
  | "engine"
  | "tail"
  | "gun"
  | "bay"
  | "turret"
  | "float"
  | "radar";
export type PartDamageState =
  | "intact"
  | "damaged"
  | "critical"
  | "disabled"
  | "destroyed";
export interface ControlDamage {
  liftLeft: number;
  liftRight: number;
  thrustLeft: number;
  thrustRight: number;
  rollAuthorityLeft: number;
  rollAuthorityRight: number;
  turnAuthorityLeft: number;
  turnAuthorityRight: number;
  yawStability: number;
  instability: number;
  engineFactor: number;
  weaponFactor: number;
  lockFactor: number;
  bombFactor: number;
  response: number;
  rollBias: number;
  yawDrift: number;
}
export interface Player extends AirMotionState {
  id: string;
  configId: string;
  factionId: string;
  layer: "air";
  controllerId: string;
  frame: Airframe;
  x: number;
  z: number;
  prevX: number;
  prevZ: number;
  prevHeading?: number;
  prevBank?: number;
  /** Total current health across all body segments and attached parts. */
  health: number;
  maxHealth: number;
  damageTransfer: number;
  hitFlash: number;
  invulnerable: number;
  stats: Stats;
  parts: Part[];
  weapons: RuntimeWeapon[];
  upgrades: string[];
  revision: number;
  damage: ControlDamage;
  partRevision: number;
  hitExtent: number;
  damageRevision: number;
}
export interface Stats {
  maxSpeed: number;
  acceleration: number;
  turnRate: number;
  energyMax: number;
  energyDrain: number;
  energyRecover: number;
  health: number;
  wingspan: number;
  length: number;
  radius: number;
  leftTurn: number;
  rightTurn: number;
  bombSettle: number;
  bombCooldown: number;
  lockTime: number;
  lockArc: number;
  damage: number;
  fireRate: number;
  damageTransfer: number;
  windResponse: number;
}
export interface RuntimeWeapon {
  config: WeaponConfig;
  anchorId: string;
  partId: string;
  offset: Point3;
  barrelSpacing: number;
  cooldown: number;
  targetId: number;
  lockProgress: number;
  lockLost: boolean;
  heading: number;
  baseAngle: number;
}
export interface Enemy extends AirMotionState {
  id: number;
  kind: string;
  configId?: string;
  profileId?: string;
  layer: "air" | "ground" | "water";
  x: number;
  z: number;
  prevX?: number;
  prevZ?: number;
  prevHeading?: number;
  prevBank?: number;
  health: number;
  maxHealth: number;
  radius: number;
  age: number;
  cooldown: number;
  warning: number;
  aimX: number;
  aimZ: number;
  flash: number;
  burn: number;
  slow: number;
  armorBreak: number;
  called: boolean;
  state: "entering" | "cruising" | "attacking" | "breaking" | "reentering" | "fleeing";
  phaseTime: number;
  breakHeading: number;
  attackWindow: number;
  tailAttack: boolean;
  attackTargetHeading: number;
  breakWindow: number;
  factionId?: string;
  controllerId?: string;
  parts: Part[];
  weapons: RuntimeWeapon[];
  damage: ControlDamage;
  damageTransfer: number;
  partRevision: number;
  hitExtent: number;
  damageRevision: number;
  routeId?: string;
  routeDistance?: number;
  laneOffset?: number;
}
export interface Projectile {
  active: boolean;
  id: number;
  team: "player" | "enemy";
  targetLayers?: WeaponConfig["targetLayers"];
  armorPierce?: number;
  kind: "bullet" | "missile" | "flak";
  x: number;
  z: number;
  y: number;
  prevY?: number;
  vy: number;
  weaponId: string;
  damageType: DamageType;
  prevX: number;
  prevZ: number;
  heading: number;
  speed: number;
  life: number;
  age: number;
  damage: number;
  targetId: number;
  pierce: number;
  bounce: number;
  explosion: number;
  homing: number;
  homingLife: number;
  escort: boolean;
  hitIds: number[];
  burn: number;
  slow: number;
  armorBreak: number;
}
export interface AirMotionState {
  heading: number;
  speed: number;
  vx: number;
  vz: number;
  turnVelocity: number;
  bank: number;
  rollVelocity: number;
  energy: number;
  boost: number;
  boosting: boolean;
  boostLocked: boolean;
}
export interface ControllerIntent {
  targetHeading?: number;
  targetPoint?: { x: number; z: number };
  throttle: number;
  boost: number;
  fire: boolean;
  bomb: boolean;
  brake: boolean;
}
export interface GroundMotionState {
  heading: number;
  speed: number;
  routeId?: string;
  routeDistance?: number;
  laneOffset?: number;
}
export interface WaterMotionState extends GroundMotionState {}
export interface CombatEntity {
  id: number | string;
  configId?: string;
  factionId?: string;
  layer: "air" | "ground" | "water";
  position?: { x: number; z: number; y: number };
  previous?: { x: number; z: number; y: number };
  motion?: AirMotionState | GroundMotionState | WaterMotionState;
  x: number;
  z: number;
  heading: number;
  health: number;
  maxHealth: number;
  parts: Part[];
  weapons: RuntimeWeapon[];
  damageTransfer: number;
  damage: ControlDamage;
  partRevision: number;
  damageRevision: number;
  controllerId?: string;
}
export type PickupKind = "coin" | "repairSmall" | "repairLarge";
export type DamageType = "kinetic" | "explosive" | "fire" | "contact";
export interface CombatSnapshot {
  position: Point3;
  direction: Point3;
  velocity: Point3;
  heading: number;
  bank: number;
  damageType: DamageType;
  weaponId?: string;
}
export type WorldEvent =
  | { type: "effect_requested"; time: number; profile: "burst" | "coin" | "heal"; position: Point3; size: number; duration: number }
  | { type: "weapon_fired"; time: number; owner: "player" | "enemy"; entityId: number | string; anchorId: string; projectileId?: number; snapshot: CombatSnapshot }
  | { type: "part_detached"; time: number; owner: "player" | "enemy"; entityId: number | string; partId: string; partKind: string; color: string; snapshot: CombatSnapshot }
  | { type: "player_destroyed"; time: number; snapshot: CombatSnapshot }
  | { type: "enemy_fire"; time: number; enemyId: number; heading: number; aimX: number; aimZ: number; count: number; threat: number }
  | { type: "ground_attack"; time: number; enemyId: number; heading: number; aimX: number; aimZ: number; count: number; threat: number }
  | { type: "missile_lock_warning"; time: number; enemyId: number; heading: number; aimX: number; aimZ: number; count: number; threat: number }
  | { type: "enemy_hit"; time: number; enemyId: number; amount: number; part?: string; snapshot: CombatSnapshot }
  | { type: "enemy_destroyed"; time: number; enemyId: number; kind: string; score: number; coins: number; combo: number; snapshot: CombatSnapshot }
  | { type: "player_hit"; time: number; amount: number; source: string; part?: string; snapshot: CombatSnapshot }
  | { type: "part_disabled"; time: number; owner: "player" | "enemy"; entityId: number | string; partId: string; label: string; snapshot: CombatSnapshot }
  | { type: "pickup"; time: number; kind: PickupKind; amount: number };
export interface Pickup {
  active: boolean;
  x: number;
  z: number;
  value: number;
  xp: number;
  life: number;
  kind: PickupKind;
}
export interface Bomb {
  startY: number;
  x: number;
  z: number;
  startX: number;
  startZ: number;
  age: number;
  weapon: WeaponConfig;
}
export interface FireZone {
  x: number;
  z: number;
  radius: number;
  life: number;
  dps: number;
}
