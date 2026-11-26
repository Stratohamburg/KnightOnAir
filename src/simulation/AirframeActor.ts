import type { Airframe } from "../data/aircrafts";
import type { AirframeMotionConfig, CombatantConfig, Layer, MountRecipe } from "../data/combatants";
import { WEAPONS } from "../data/weapons";
import { localToWorld, mountOffset, muzzleAnchor, type ActorPose } from "../content/3d/anchors";
import { mountForPart } from "./CenterlineLayout";
import { neutralDamage } from "./DamageModel";
import { partFromRecipe } from "./parts";
import type { Enemy, Player, RuntimeWeapon, Stats, WorldEvent } from "./types";

export function createAirframeActor(frame: Airframe, config: CombatantConfig): Player {
  const motion = config.frame;
  if (motion.model !== "air") throw new Error(`Missing air motion configuration for ${frame.id}`);
  return {
    id: "player",
    configId: frame.id,
    factionId: "player",
    layer: "air",
    controllerId: "player-input",
    frame,
    x: 0,
    z: 0,
    prevX: 0,
    prevZ: 0,
    vx: 0,
    vz: motion.cruiseSpeed,
    heading: 0,
    turnVelocity: 0,
    bank: 0,
    rollVelocity: 0,
    speed: motion.cruiseSpeed,
    energy: motion.energyMax,
    health: frame.health,
    maxHealth: frame.health,
    damageTransfer: 0,
    hitFlash: 0,
    invulnerable: 0,
    stats: baseStats(frame, motion),
    parts: configuredParts(config, frame),
    weapons: [],
    upgrades: [],
    revision: 0,
    boost: 0,
    boosting: false,
    boostLocked: false,
    damage: neutralDamage(),
    partRevision: 0,
    hitExtent: 0,
    damageRevision: 0,
  };
}

function baseStats(f: Airframe, motion: AirframeMotionConfig): Stats {
  return {
    maxSpeed: motion.maxSpeed,
    acceleration: motion.acceleration,
    turnRate: motion.turnRate,
    energyMax: motion.energyMax,
    energyDrain: motion.energyDrain,
    energyRecover: motion.energyRecover,
    health: f.health,
    wingspan: f.wingspan,
    length: f.length,
    radius: 0.65,
    leftTurn: 1,
    rightTurn: 1,
    bombSettle: 1,
    bombCooldown: 0,
    lockTime: 0,
    lockArc: 0,
    damage: 1,
    fireRate: 1,
    damageTransfer: 0.7,
    windResponse: 1,
  };
}

export function configuredParts(config: CombatantConfig, frame?: Airframe) {
  return config.parts.map((recipe) => {
    return partFromRecipe(recipe.id, {
      ...recipe,
      centerline: frame ? recipe.centerline ?? mountForPart({ ...recipe, x: recipe.x ?? 0, z: recipe.z ?? 0 }, frame) : recipe.centerline,
    });
  });
}

export function addConfiguredWeapon(
  entity: Player | Enemy,
  mount: MountRecipe,
  layer: Layer,
  cooldown: () => number = () => 0,
) {
  const weaponConfig = WEAPONS[mount.weaponId];
  if (!weaponConfig) return;
  const part = entity.parts.find((value) => value.id === mount.partId);
  if (!part) return;
  const weapon: RuntimeWeapon = {
    config: { ...weaponConfig, count: mount.count, arc: mount.arc, targetLayers: mount.targetLayers, ...(mount.overrides ?? {}) },
    anchorId: mount.id,
    partId: mount.partId,
    offset: mount.offset ?? mountOffset(part, weaponConfig),
    barrelSpacing: mount.barrelSpacing ?? (part.role === "turret" ? .3 : .46),
    cooldown: cooldown(),
    targetId: 0,
    lockProgress: 0,
    lockLost: false,
    heading: entity.heading + mount.baseAngle,
    baseAngle: mount.baseAngle,
    centerline: mount.centerline,
  };
  part.weaponIds = [...(part.weaponIds ?? []), weapon.config.id];
  if (layer !== "air" && weapon.config.damage <= 0) return;
  entity.weapons.push(weapon);
}

export function weaponMuzzle(entity: Player | Enemy, pose: ActorPose, weapon: RuntimeWeapon, index: number) {
  const part = entity.parts.find(({ id }) => id === weapon.partId);
  if (!part || part.destroyed || part.state === "destroyed") return;
  let parentId = part.parentId;
  while (parentId) {
    const parent = entity.parts.find((candidate) => candidate.id === parentId);
    if (!parent || parent.destroyed || parent.state === "destroyed") return;
    parentId = parent.parentId;
  }
  return localToWorld(pose, muzzleAnchor(part, weapon, entity.heading, index));
}

export function aircraftPreviewFire(player: Player, pose: ActorPose, time: number, enabled: (weapon: RuntimeWeapon) => boolean = () => true) {
  const events: WorldEvent[] = [];
  for (const weapon of player.weapons) {
    if (!enabled(weapon)) continue;
    const part = player.parts.find((candidate) => candidate.id === weapon.partId);
    if (!part || part.health <= 0 || part.destroyed || part.state === "disabled") continue;
    for (let index = 0; index < weapon.config.count; index++) {
      const muzzle = weaponMuzzle(player, pose, weapon, index);
      if (!muzzle) continue;
      events.push({
        type: "weapon_fired",
        time,
        owner: "player",
        entityId: player.id,
        anchorId: weapon.anchorId,
        snapshot: {
          position: { x: muzzle.x, y: muzzle.y, z: muzzle.z },
          direction: muzzle.direction,
          actorPose: pose, barrel: { partId: part.id, index },
          ammunition: weapon.config.homing || weapon.config.id.includes("rocket") ? "powered" : "gun",
          heading: weapon.heading,
          bank: player.bank,
          velocity: muzzle.velocity,
          damageType: weapon.config.explosion > 0 || weapon.config.homing > 0 ? "explosive" : "kinetic",
          weaponId: weapon.config.id,
        },
      });
    }
  }
  return events;
}
