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
}
export interface Player {
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
  speed: number;
  energy: number;
  health: number;
  hitFlash: number;
  invulnerable: number;
  stats: Stats;
  parts: Part[];
  weapons: RuntimeWeapon[];
  upgrades: string[];
  revision: number;
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
  layer: "air" | "ground";
  x: number;
  z: number;
  vx: number;
  vz: number;
  heading: number;
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
export interface Pickup {
  active: boolean;
  x: number;
  z: number;
  value: number;
  xp: number;
  life: number;
  repair: boolean;
}
export interface Effect {
  active: boolean;
  x: number;
  z: number;
  y: number;
  life: number;
  maxLife: number;
  radius: number;
  kind: "hit" | "explosion" | "ground" | "coin" | "smoke" | "debris";
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
