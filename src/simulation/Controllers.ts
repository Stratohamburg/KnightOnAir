import type { AirAttackProfile, MotionConfig, NpcProfile } from "../data/combatants";
import { angleDelta, clamp, RAD } from "../services/Random";
import { weaponMountActive } from "./AirframeActor";
import type { AirCombatGeometry, ContinuousTurn, ControllerIntent, Enemy, Part, RuntimeWeapon } from "./types";

export interface ControllerSnapshot {
  x: number;
  z: number;
  heading: number;
  vx: number;
  vz: number;
  speed: number;
  energy?: number;
  energyMax?: number;
  health?: number;
  maxHealth?: number;
  turnVelocity?: number;
  weapons?: readonly RuntimeWeapon[];
  parts?: readonly Part[];
}

export interface PlayerControllerInput {
  heading: number;
  continuousTurn?: ContinuousTurn;
  throttle: number;
  boost?: number;
  fire?: boolean;
  bomb?: boolean;
}

export function playerIntent(input: PlayerControllerInput): ControllerIntent {
  return {
    targetHeading: input.heading,
    continuousTurn: input.continuousTurn,
    throttle: Math.max(0, Math.min(1, input.throttle)),
    boost: Math.max(0, Math.min(1, input.boost ?? 0)),
    fire: Boolean(input.fire),
    bomb: Boolean(input.bomb),
    brake: false,
  };
}

export function npcIntent(
  profile: NpcProfile,
  actor: Enemy,
  player: ControllerSnapshot,
  time: number,
  anchor?: ControllerSnapshot,
  frame?: Extract<MotionConfig, { model: "air" }>,
  dt = 0,
): ControllerIntent {
  if (frame && profile.airAttack) {
    return airCombatIntent(profile, profile.airAttack, actor, player, frame, dt, anchor);
  }
  const behavior = profile.behavior;
  const dx = player.x - actor.x, dz = player.z - actor.z;
  const distance = Math.hypot(dx, dz);
  const flee = behavior.kind === "flee" || (actor.health < actor.maxHealth * .2 && actor.damage.engineFactor < .65);
  let x = player.x, z = player.z;
  let throttle = distance > behavior.preferredRange[1] ? 1 : .7;
  const bearing = Math.atan2(dx, dz);

  if (flee) {
    x = actor.x - dx;
    z = actor.z - dz;
    throttle = 1;
  } else if (behavior.kind === "intercept") {
    const lead = Math.min(3, distance / Math.max(actor.speed, 2)) + behavior.leadTime;
    x += player.vx * lead;
    z += player.vz * lead;
  } else if (behavior.kind === "escort" && anchor) {
    x = anchor.x + Math.cos(anchor.heading) * 6 - Math.sin(anchor.heading) * 3;
    z = anchor.z - Math.sin(anchor.heading) * 6 - Math.cos(anchor.heading) * 3;
    throttle = Math.hypot(x - actor.x, z - actor.z) > 8 ? 1 : .3;
  } else if (behavior.kind === "standoff" && behavior.targetPolicy !== "route") {
    const offset = bearing + (distance < behavior.preferredRange[0] ? Math.PI * .8 : Math.PI * .38);
    x = actor.x + Math.sin(offset) * 12;
    z = actor.z + Math.cos(offset) * 12;
  } else if (behavior.kind === "patrol" && behavior.targetPolicy !== "route") {
    x = Math.sin(time * .12) * 18;
    z = 24 + Math.cos(time * .12) * 18;
    throttle = .35;
  } else if (behavior.kind === "crossing") {
    const side = Math.cos(time * .27);
    x += Math.cos(player.heading) * side * 15;
    z -= Math.sin(player.heading) * side * 15;
  } else if (behavior.kind === "dive" || behavior.kind === "strafe") {
    const attacking = time % 8 < 3;
    if (!attacking) {
      x -= Math.cos(player.heading) * 15;
      z += Math.sin(player.heading) * 15;
    }
    throttle = attacking ? 1 : .35;
  } else if (behavior.targetPolicy === "route" || behavior.kind === "static") {
    x = actor.x + Math.sin(actor.heading);
    z = actor.z + Math.cos(actor.heading);
  }
  return {
    targetHeading: Math.atan2(x - actor.x, z - actor.z),
    throttle, boost: 0,
    fire: !flee && distance <= behavior.engageRadius,
    bomb: false, brake: false,
  };
}

function airCombatIntent(
  profile: NpcProfile,
  attack: AirAttackProfile,
  actor: Enemy,
  player: ControllerSnapshot,
  frame: Extract<MotionConfig, { model: "air" }>,
  dt: number,
  anchor?: ControllerSnapshot,
): ControllerIntent {
  const tactical = {
    ...attack,
    tailDistance: attack.tailDistance ?? [7, 12] as [number, number],
    tailHoldTime: attack.tailHoldTime ?? attack.attackWindow,
    lostAngle: attack.lostAngle ?? .8,
    breakOffset: attack.breakOffset ?? .3,
    actionCooldown: attack.actionCooldown ?? .25,
    aimTolerance: attack.aimTolerance ?? 10 * RAD,
  };
  const behavior = profile.behavior;
  const dx = player.x - actor.x;
  const dz = player.z - actor.z;
  const distance = Math.hypot(dx, dz);
  const bearing = Math.atan2(dx, dz);
  const closing = ((actor.vx - player.vx) * dx + (actor.vz - player.vz) * dz) / Math.max(1, distance);
  const weapons = actor.weapons.filter(weapon => weaponMountActive(actor.parts, weapon));
  const weaponSpeed = weapons[0]?.config.speed ?? 24;
  const firstLead = distance / Math.max(1, weaponSpeed);
  const lead = Math.min(1.25, Math.hypot(dx + player.vx * firstLead, dz + player.vz * firstLead) / weaponSpeed);
  const aimX = player.x + player.vx * lead;
  const aimZ = player.z + player.vz * lead;
  const aimHeading = Math.atan2(aimX - actor.x, aimZ - actor.z);
  const error = Math.abs(angleDelta(aimHeading, actor.heading));
  const routeAttack = ["crossing", "standoff", "patrol", "escort", "static"].includes(behavior.kind);
  const hunter = behavior.kind === "chase";
  const fastPass = tactical.attackBoost > 0;
  const targetAlong = dx * Math.sin(player.heading) + dz * Math.cos(player.heading);
  const lateralOffset = dx * Math.cos(player.heading) - dz * Math.sin(player.heading);
  const tail = !routeAttack && targetAlong > Math.abs(lateralOffset) * .55 &&
    Math.abs(angleDelta(actor.heading, player.heading)) < tactical.lostAngle;
  const weaponSolution = weapons.some((weapon) => {
    const range = weapon.config.range;
    const arc = weapon.config.category === "turret" ? weapon.config.turretArc : weapon.config.arc;
    return distance <= range && error <= Math.min(tactical.attackAngle * RAD, arc * RAD / 2 + tactical.aimTolerance);
  });
  const geometry = (profile.radial || error <= tactical.attackAngle * RAD) &&
    distance <= behavior.engageRadius && (profile.radial || weaponSolution) && (routeAttack || (distance > 2.6 && closing >= -1.15));
  const tailDistance = (tactical.tailDistance[0] + tactical.tailDistance[1]) * .5;
  const trailHeading = player.heading + clamp((player.turnVelocity ?? 0) * .18, -.45, .45);
  const pursuitLead = Math.min(.85, behavior.leadTime + distance * .012);
  const tailTarget = {
    x: player.x + player.vx * pursuitLead - Math.sin(trailHeading) * tailDistance,
    z: player.z + player.vz * pursuitLead - Math.cos(trailHeading) * tailDistance,
  };
  const geometrySnapshot: AirCombatGeometry = {
    distance,
    bearing,
    targetHeadingDelta: angleDelta(player.heading, actor.heading),
    closingSpeed: closing,
    lateralOffset,
    energy: actor.energy,
    targetEnergy: player.energy ?? 0,
    predicted: { x: aimX, z: aimZ },
    aimError: error,
    weaponSolution,
  };
  actor.combatGeometry = geometrySnapshot;
  const intent: ControllerIntent = {
    targetHeading: aimHeading, targetPoint: { x: aimX, z: aimZ }, attackPoint: { x: aimX, z: aimZ },
    throttle: 1, boost: 0, fire: false, bomb: false, brake: false,
  };
  actor.phaseTime += dt;
  const transition = (state: Enemy["state"]) => {
    actor.state = state;
    actor.phaseTime = 0;
    actor.lostAttackTime = 0;
  };
  const side = actor.id % 2 ? 1 : -1;

  if (actor.state !== "fleeing" &&
      (behavior.kind === "flee" || actor.health < actor.maxHealth * tactical.fleeHealth)) {
    transition("fleeing");
  }
  if (actor.state === "fleeing") {
    actor.attackWindow = actor.breakWindow = 0;
    intent.targetHeading = bearing + Math.PI;
    intent.boost = tactical.attackBoost;
    return intent;
  }
  const threatBearing = angleDelta(bearing + Math.PI, player.heading);
  const threatened = !routeAttack && actor.factionId !== "player" &&
    Math.abs(angleDelta(bearing, actor.heading)) > 1.4 &&
    player.weapons?.some(weapon => {
      if (weapon.config.category === "area" || !(weapon.config.targetLayers ?? ["air"]).includes("air")) return false;
      if (player.parts && !weaponMountActive(player.parts, weapon)) return false;
      return distance <= Math.min(19, weapon.config.range) &&
        Math.abs(angleDelta(threatBearing, weapon.baseAngle)) <= Math.max(.24, weapon.config.arc * RAD / 2);
    });
  if (threatened && actor.state !== "defending") {
    actor.breakHeading = actor.heading + (Math.abs(lateralOffset) < .8 ? side : -Math.sign(lateralOffset)) * 1.12;
    transition("defending");
  }
  if (actor.state === "defending") {
    actor.attackWindow = actor.breakWindow = 0;
    if (actor.phaseTime < .95 || threatened && actor.phaseTime < 1.4) {
      intent.targetHeading = actor.breakHeading;
      intent.throttle = actor.speed > frame.cruiseSpeed + 2 ? .32 : .65;
      return intent;
    }
    if (threatened) {
      const previousTurn = Math.sign(angleDelta(actor.breakHeading, actor.heading)) || side;
      actor.breakHeading = actor.heading - previousTurn * 1.14;
      transition("defending");
      intent.targetHeading = actor.breakHeading;
      intent.throttle = 1;
      return intent;
    }
    transition("reentering");
  }
  const evasiveTurn = actor.tailAttack && Math.abs(angleDelta(player.heading, actor.attackTargetHeading)) > tactical.lostAngle;
  const committed = actor.phaseTime >= tactical.actionCooldown;
  const holdingTail = hunter && actor.state === "attacking" && actor.tailAttack;
  const tailLost = !tail || distance > tactical.tailDistance[1] + 5 || distance < 3.1 ||
    closing < -1.8 && distance > tailDistance;
  const attackLost = holdingTail ? tailLost : !geometry || evasiveTurn;
  if (actor.state === "attacking") actor.lostAttackTime = attackLost ? (actor.lostAttackTime ?? 0) + dt : 0;
  const attackLimit = holdingTail ? tactical.tailHoldTime : hunter ? 1.15 : tactical.attackWindow;
  if (actor.state === "attacking" && committed &&
      ((holdingTail ? (actor.lostAttackTime ?? 0) >= .5 : attackLost) || actor.phaseTime >= attackLimit)) {
    if (!routeAttack) actor.breakHeading = actor.heading + side * tactical.breakOffset;
    transition("breaking");
  }
  if (actor.state === "breaking" && actor.phaseTime >= tactical.breakTime &&
      (routeAttack || distance >= tactical.breakDistance || actor.phaseTime >= tactical.breakTime * 2)) {
    transition("reentering");
  }
  if (actor.state === "reentering" && distance <= tactical.reentryDistance && actor.phaseTime >= .35) {
    transition("cruising");
  }
  const readyToAttack = hunter && tail
    ? distance <= tactical.tailDistance[1] + 2 && distance > 3.1 && closing > -1.8
    : geometry;
  if ((actor.state === "entering" || actor.state === "cruising") && readyToAttack && weapons.length > 0) {
    actor.tailAttack = tail && !routeAttack;
    actor.attackTargetHeading = player.heading;
    transition("attacking");
  }
  actor.attackWindow = actor.state === "attacking" ? (hunter ? actor.tailAttack ? tactical.tailHoldTime : 1.15 : tactical.attackWindow) - actor.phaseTime : 0;
  actor.breakWindow = actor.state === "breaking" ? Math.max(0, tactical.breakTime - actor.phaseTime) : 0;

  if (actor.state === "breaking" && !routeAttack) {
    intent.targetHeading = actor.breakHeading;
    intent.boost = fastPass ? tactical.attackBoost : 0;
    if (hunter && distance < tailDistance && closing > 1) intent.brake = true;
    return intent;
  }

  if (behavior.kind === "escort" && anchor) {
    const x = anchor.x + Math.cos(anchor.heading) * side * 6 - Math.sin(anchor.heading) * 3;
    const z = anchor.z - Math.sin(anchor.heading) * side * 6 - Math.cos(anchor.heading) * 3;
    intent.targetHeading = Math.atan2(x - actor.x, z - actor.z);
    const desired = anchor.speed + Math.min(3, (Math.hypot(x - actor.x, z - actor.z) - 5) * .42);
    intent.throttle = clamp((desired - frame.cruiseSpeed) / Math.max(.1, frame.maxSpeed - frame.cruiseSpeed));
  } else if (behavior.kind === "crossing") {
    const across = player.heading + side * Math.PI / 2;
    const crossDirection = actor.age <= dt ? across : actor.breakHeading;
    if (actor.age <= dt) actor.breakHeading = crossDirection;
    intent.targetHeading = crossDirection;
    intent.throttle = .45;
  } else if (behavior.kind === "patrol" || behavior.kind === "static") {
    intent.targetHeading = actor.heading + (behavior.kind === "patrol" ? side * .12 : 0);
    intent.throttle = .25;
  } else if (behavior.kind === "standoff") {
    intent.targetHeading = bearing + side * (distance < behavior.preferredRange[0] ? 1.8 : .75);
    intent.throttle = .45;
  } else if (hunter && (tail || holdingTail)) {
    const gap = targetAlong - tailDistance;
    const closingTarget = gap > 0 ? Math.min(6, Math.sqrt(2.2 * gap)) : Math.max(-1.8, gap * .77);
    const desiredSpeed = player.speed + closingTarget;
    const speedSpan = Math.max(.1, frame.maxSpeed * actor.damage.engineFactor - frame.cruiseSpeed);
    intent.throttle = clamp((desiredSpeed - frame.cruiseSpeed) / speedSpan);
    intent.brake = distance < tactical.tailDistance[1] && closing > Math.max(2, closingTarget + 2);
    if (distance > tactical.tailDistance[1] + 1 || holdingTail && tailLost) {
      intent.targetPoint = tailTarget;
      intent.targetHeading = Math.atan2(tailTarget.x - actor.x, tailTarget.z - actor.z);
    }
  } else if (actor.state === "attacking") {
    intent.throttle = tactical.attackThrottle;
    intent.boost = tactical.attackBoost;
  } else {
    const lead = Math.min(2, distance / Math.max(2, frame.maxSpeed));
    const offset = side * Math.min(actor.state === "reentering" ? 12 : 8, distance * .35);
    if (hunter && distance > 6) {
      intent.targetPoint = { x: tailTarget.x + Math.cos(player.heading) * offset * .5,
        z: tailTarget.z - Math.sin(player.heading) * offset * .5 };
      intent.targetHeading = Math.atan2(intent.targetPoint.x - actor.x, intent.targetPoint.z - actor.z);
    } else {
      intent.targetHeading = Math.atan2(dx + player.vx * lead + Math.cos(player.heading) * offset,
        dz + player.vz * lead - Math.sin(player.heading) * offset);
    }
  }
  intent.fire = actor.state === "attacking" && (profile.radial || (geometrySnapshot.weaponSolution &&
    geometrySnapshot.aimError <= tactical.aimTolerance && (routeAttack || geometrySnapshot.closingSpeed >= -1.15)));
  return intent;
}

export interface TimedControllerIntent {
  /** Simulation time since the start of the sortie, in seconds. */
  time: number;
  intent: ControllerIntent;
}

const SAMPLE_TIME_TOLERANCE = 1e-9;

export class NetworkController {
  private readonly buffer: TimedControllerIntent[] = [];
  private cursor = 0;
  private lastSample = -1;
  private current = playerIntent({ heading: Math.PI, throttle: 0 });

  push(sample: TimedControllerIntent) {
    const { time, intent } = sample;
    const turn = intent.continuousTurn;
    if (!Number.isFinite(time) || time <= this.lastSample + SAMPLE_TIME_TOLERANCE ||
        !Number.isFinite(intent.throttle) || !Number.isFinite(intent.boost) ||
        (turn !== undefined && turn !== -1 && turn !== 1) ||
        (intent.targetHeading !== undefined && !Number.isFinite(intent.targetHeading))) return false;
    const snapshot = {
      ...intent,
      throttle: Math.min(1, Math.max(0, intent.throttle)),
      boost: Math.min(1, Math.max(0, intent.boost)),
    };
    const index = this.buffer.findIndex(({ time: queued }) => time <= queued);
    if (index === -1) this.buffer.push({ time, intent: snapshot });
    else if (this.buffer[index].time === time) this.buffer[index] = { time, intent: snapshot };
    else this.buffer.splice(index, 0, { time, intent: snapshot });
    return true;
  }

  sample(time: number): ControllerIntent {
    if (time >= this.lastSample) {
      while (this.cursor < this.buffer.length && this.buffer[this.cursor].time <= time + SAMPLE_TIME_TOLERANCE)
        this.current = this.buffer[this.cursor++].intent;
      this.lastSample = time;
      if (this.cursor >= 64) {
        this.buffer.splice(0, this.cursor);
        this.cursor = 0;
      }
    }
    return this.current;
  }
}
