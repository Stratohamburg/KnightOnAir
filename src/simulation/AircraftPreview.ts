import type { Airframe } from "../data/aircrafts";
import { combatantById } from "../data/combatants";
import { RULES } from "../data/config";
import { localToWorld, partAnchor, type ActorPose, type Point3 } from "../content/3d/anchors";
import { addConfiguredWeapon, aircraftPreviewFire, createAirframeActor } from "./AirframeActor";
import { evaluateDamage, stateFor, totalPartHealth, totalPartMaxHealth } from "./DamageModel";
import { applyCenterlineLayout, defaultTopology } from "./CenterlineLayout";
import { configuredFlight, integrateAirActor } from "./FlightDynamics";
import { applyHoPanelLayout } from "./Ho229Layout";
import { refreshAirframeSilhouette } from "./parts";
import type { CombatSnapshot, Player, RuntimeWeapon, WorldEvent } from "./types";

export const previewTracks = {
  straight: { name: "平飞", offset: () => 0 },
  slalom: { name: "S 弯", offset: (time: number) => -Math.cos(time * Math.PI / 2.8) * 1.15 },
  left: { name: "持续左转", offset: () => 1.15 },
  right: { name: "持续右转", offset: () => -1.15 },
};
export const previewPower = {
  low: { name: "低速", throttle: 0, boost: 0, brake: true, speedFactor: .72 },
  cruise: { name: "巡航", throttle: 0, boost: 0, brake: false, speedFactor: 1 },
  boost: { name: "加力", throttle: 1, boost: 1, brake: false, speedFactor: 1 },
};
export type Track = keyof typeof previewTracks;
export type Power = keyof typeof previewPower;
type DamageAction = { partId: string; siteId: number; local?: Point3; fault?: boolean };
export type AircraftPreviewInput =
  | { type: "track"; value: Track }
  | { type: "power"; value: Power }
  | { type: "fire" }
  | ({ type: "hit" } & DamageAction)
  | { type: "repair"; siteId: number }
  | { type: "detach"; partId: string };

export class AircraftPreview {
  readonly actor: Player;
  readonly canBoost: boolean;
  readonly config;
  track: Track = "straight";
  power: Power = "cruise";
  private trackStart = 0;
  readonly damageSites = new Map<number, { partId: string; amount: number }>();

  constructor(frame: Airframe, private readonly enabledWeapon: (w: RuntimeWeapon) => boolean = () => true) {
    const config = combatantById(frame.id);
    if (!config || config.frame.model !== "air") throw new Error(`缺少飞行配置 · ${frame.id}`);
    this.actor = createAirframeActor(frame, config);
    this.canBoost = config.capabilities.boost && config.frame.energyMax > 0 && RULES.boost.enabled;
    const { parts } = this.actor;
    refreshAirframeSilhouette(parts, frame.wingspan, frame.length, frame.engines === 4 ? .75 : .48,
      frame.wingCount ?? 1, frame.length, undefined, frame);
    applyCenterlineLayout(config.topology ?? defaultTopology(frame), parts);
    if (frame.geometryProfile === "ho229V2") applyHoPanelLayout(parts, frame.wingspan);
    for (const mount of config.mounts) if (mount.weaponId !== frame.bomb) addConfiguredWeapon(this.actor, mount, "air");
    this.actor.health = totalPartHealth(parts);
    this.actor.maxHealth = totalPartMaxHealth(parts);
    this.actor.damage = evaluateDamage(parts);
    this.config = configuredFlight(config.frame, parts);
  }

  get pose(): ActorPose {
    const { x, z, heading, bank, vx, vz } = this.actor;
    return { x, z, y: 0, heading, bank, vx, vz };
  }

  advance(time: number, dt: number) {
    const actor = this.actor;
    const { speedFactor, ...power } = previewPower[this.power];
    const targetHeading = actor.heading + previewTracks[this.track].offset(time - this.trackStart);
    integrateAirActor(actor, { ...power, targetHeading, fire: false, bomb: false },
      this.config, actor.damage, dt, { sample: () => ({ x: 0, z: 0 }) }, speedFactor);
    for (const weapon of actor.weapons) weapon.heading = actor.heading + (weapon.baseAngle ?? 0);
  }

  apply(input: AircraftPreviewInput, time: number): WorldEvent[] {
    switch (input.type) {
      case "track": this.track = input.value; this.trackStart = time; return [];
      case "power": if (input.value !== "boost" || this.canBoost) this.power = input.value; return [];
      case "fire": return aircraftPreviewFire(this.actor, this.pose, time, this.enabledWeapon);
      case "hit": return this.hit(input, time);
      case "repair": this.repair(input.siteId); return [];
      case "detach": return this.detach(input.partId, time);
    }
  }

  private syncDamage() {
    this.actor.health = totalPartHealth(this.actor.parts);
    this.actor.damage = evaluateDamage(this.actor.parts);
  }

  private hit(input: DamageAction, time: number): WorldEvent[] {
    const part = this.actor.parts.find(({ id }) => id === input.partId);
    if (!part || part.destroyed || part.health <= 0 || this.damageSites.has(input.siteId)) return [];
    const amount = input.fault ? part.health : Math.min(part.maxHealth * .28, part.health * .8);
    part.health -= amount;
    part.state = stateFor(part);
    part.disabled = part.state === "disabled";
    this.damageSites.set(input.siteId, { partId: part.id, amount });
    this.syncDamage();
    const pose = this.pose;
    const contact = localToWorld(pose, input.local ? { ...input.local, yaw: 0 } : partAnchor(part));
    return [{ type: "player_hit", source: "preview", part: part.id, amount, time, snapshot: {
      position: contact, contact: !!input.local, actorPose: pose, damageSiteId: input.siteId,
      direction: { x: 0, y: 1, z: 0 }, velocity: contact.velocity, heading: pose.heading, bank: pose.bank,
      damageType: "kinetic", damagedParts: [{ id: part.id, amount }],
    } }];
  }

  private repair(siteId: number) {
    const site = this.damageSites.get(siteId);
    if (!site) return;
    const part = this.actor.parts.find(({ id }) => id === site.partId);
    if (!part || part.destroyed) return;
    part.health = Math.min(part.maxHealth, part.health + site.amount);
    part.state = stateFor(part);
    part.disabled = part.state === "disabled";
    this.damageSites.delete(siteId);
    this.syncDamage();
  }

  private detach(partId: string, time: number): WorldEvent[] {
    const part = this.actor.parts.find(({ id }) => id === partId);
    if (!part?.visual?.detachable || part.destroyed) return [];
    const pose = this.pose;
    const anchor = localToWorld(pose, partAnchor(part));
    const snapshot: CombatSnapshot = { position: anchor, actorPose: pose, direction: anchor.direction,
      heading: pose.heading, bank: pose.bank, velocity: anchor.velocity, damageType: "kinetic" };
    part.health = 0;
    part.destroyed = true;
    part.state = "destroyed";
    for (const [id, site] of this.damageSites) if (site.partId === partId) this.damageSites.delete(id);
    this.syncDamage();
    return [{ type: "part_detached", time, owner: "player", entityId: this.actor.id,
      partId, partKind: part.kind, color: this.actor.frame.color, snapshot }];
  }
}
