import type { Airframe } from "../data/aircrafts";
import type { WeaponConfig } from "../data/weapons";
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
  detachSeed?: number;
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
export interface Player {
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
  vx: number;
  vz: number;
  heading: number;
  turnVelocity: number;
  bank: number;
  rollVelocity: number;
  speed: number;
  energy: number;
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
  boost: number;
  boosting: boolean;
  boostLocked: boolean;
  damage: ControlDamage;
  partRevision: number;
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
  partId: string;
  x: number;
  z: number;
  cooldown: number;
  targetId: number;
  lockProgress: number;
  lockLost: boolean;
  heading: number;
  baseAngle: number;
}
export interface Enemy {
  id: number;
  kind: string;
  configId?: string;
  profileId?: string;
  layer: "air" | "ground" | "water";
  x: number;
  z: number;
  vx: number;
  vz: number;
  heading: number;
  turnVelocity: number;
  bank: number;
  rollVelocity: number;
  speed: number;
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
  state: "entering" | "cruising" | "attacking" | "breaking" | "fleeing";
  factionId?: string;
  controllerId?: string;
  parts: Part[];
  weapons: RuntimeWeapon[];
  damage: ControlDamage;
  damageTransfer: number;
  partRevision: number;
  damageRevision: number;
  routeId?: string;
  routeDistance?: number;
  laneOffset?: number;
}
export interface Projectile {
  active: boolean;
  id: number;
  team: "player" | "enemy";
  kind: "bullet" | "missile" | "flak";
  x: number;
  z: number;
  y: number;
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
export type WorldEvent =
  | { type: "enemy_fire"; time: number; enemyId: number; heading: number; aimX: number; aimZ: number; count: number; threat: number }
  | { type: "ground_attack"; time: number; enemyId: number; heading: number; aimX: number; aimZ: number; count: number; threat: number }
  | { type: "missile_lock_warning"; time: number; enemyId: number; heading: number; aimX: number; aimZ: number; count: number; threat: number }
  | { type: "enemy_hit"; time: number; enemyId: number; amount: number; part?: string }
  | { type: "enemy_destroyed"; time: number; enemyId: number; kind: string; score: number; coins: number; combo: number }
  | { type: "player_hit"; time: number; amount: number; source: string; part?: string }
  | { type: "part_disabled"; time: number; owner: "player" | "enemy"; entityId: number | string; partId: string; label: string }
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
export interface Effect {
  active: boolean;
  x: number;
  z: number;
  y: number;
  life: number;
  maxLife: number;
  radius: number;
  kind: "hit" | "explosion" | "ground" | "coin" | "heal" | "smoke" | "debris";
  seed: number;
}
export interface Bomb {
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
