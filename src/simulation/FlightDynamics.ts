import { RULES } from "../data/config";
import { angleDelta, clamp, RAD } from "../services/Random";
import type { AirMotionState, ControlDamage, ControllerIntent, Part, Player } from "./types";

// Game distances represent two metres. Keep the coordinated-turn equation in
// world units: yaw rate = g * tan(bank) / airspeed.
export const FLIGHT_GRAVITY = 9.81 / 2;

export interface AirActorConfig {
  mass: number;
  wingspan: number;
  wingArea: number;
  acceleration: number;
  maxSpeed: number;
  cruiseSpeed: number;
  turnRate: number;
  energyMax: number;
  energyDrain: number;
  energyRecover: number;
  windResponse?: number;
  bankLimit?: number;
  liftCenterY?: number;
  liftCenterZ?: number;
}

export interface AirActorState extends AirMotionState {
  x: number;
  z: number;
}

export function configuredFlight(base: AirActorConfig, parts: readonly Part[]): AirActorConfig {
  return {
    ...base,
    mass: base.mass + parts.reduce((sum, part) => sum + part.addedMass, 0),
    wingArea: base.wingArea + parts.reduce((sum, part) =>
      part.id.startsWith("giant_wing_") ? sum + (part.lift ?? 1) * 2.4 : sum, 0),
  };
}

export function flightEnvelope(p: Player, engineFactor = 1, wingFactor = 1) {
  const f = p.frame,
    s = p.stats;
  const spanRatio = Math.max(0.5, s.wingspan / f.wingspan);
  const lengthRatio = Math.max(0.5, s.length / f.length);
  const payload = p.parts.reduce((sum, part) => sum + part.addedMass, 0);
  const mass = f.mass * spanRatio ** 0.8 * lengthRatio ** 1.2 + payload;
  const wingArea = f.wingArea * spanRatio;
  const wingLoading = mass / wingArea;
  const specificThrust = s.acceleration * engineFactor;
  // Arcade load envelope: thrust reserve pays the induced-drag cost of a turn;
  // wing loading and size reduce the sustainable load. This is a tuned flight
  // model, not a full six-degree-of-freedom aerodynamic solver.
  const maxLoad =
    1 +
    12 *
      (specificThrust / 9.5) ** 2 *
      (105 / wingLoading) ** 1.4 *
      (1800 / mass) ** 0.3 *
      wingFactor;
  const maxBank = Math.min(87.5 * RAD, Math.acos(1 / maxLoad));
  // Roll inertia grows with mass * span²; control authority grows with thrust.
  const inertia = (mass * s.wingspan ** 2) / 12;
  const referenceInertia = (1800 * 6.2 ** 2) / 12;
  const response = clamp(
    12 *
      Math.sqrt(((specificThrust / 9.5) * referenceInertia) / inertia) *
      wingFactor,
    2.5,
    18,
  );
  return { maxBank, response, mass, wingLoading };
}

function updateBoost(actor: AirActorState, intent: ControllerIntent, config: AirActorConfig, dt: number) {
  const request = RULES.boost.enabled && !intent.brake ? clamp(intent.boost) : 0;
  if (actor.boostLocked && request === 0 && actor.energy >= Math.min(config.energyMax, RULES.boost.rearm)) {
    actor.boostLocked = false;
  }
  actor.boost = !actor.boostLocked && actor.energy > 0 ? request : 0;
  if (actor.boost > 0) {
    actor.energy = Math.max(0, actor.energy - config.energyDrain * actor.boost * dt);
    if (actor.energy === 0) {
      actor.boostLocked = true;
      actor.boost = 0;
    }
  } else {
    actor.energy = Math.min(config.energyMax, actor.energy + config.energyRecover * dt);
  }
  actor.boosting = actor.boost > 0;
}

/** Shared air integration entry point for player, NPC, and replay inputs. */
export function integrateAirActor(
  actor: AirActorState,
  intent: ControllerIntent,
  config: AirActorConfig,
  damage: ControlDamage,
  dt: number,
  wind: { sample(x: number, z: number): { x: number; z: number } },
  speedFactor = 1,
) {
  const startingBank = actor.bank;
  const target = intent.targetHeading ?? actor.heading;
  const shortestError = angleDelta(target, actor.heading);
  const distanceToTarget = Math.abs(shortestError);
  const { turnBranchGuardDegrees, turnSettleDegrees } = RULES.joystick;
  const branchTurn = distanceToTarget >= Math.PI - turnBranchGuardDegrees * RAD &&
    distanceToTarget > turnSettleDegrees * RAD
    ? intent.continuousTurn
    : undefined;
  const error = branchTurn !== undefined && shortestError * branchTurn < 0
    ? shortestError + branchTurn * 2 * Math.PI
    : shortestError;
  const baseTurnLimit = config.turnRate * RAD;
  const authority = error < 0 ? damage.turnAuthorityLeft : damage.turnAuthorityRight;
  const turnLimit = baseTurnLimit * authority;
  const minTurn = branchTurn === 1 ? 0 : -turnLimit;
  const maxTurn = branchTurn === -1 ? 0 : turnLimit;
  const desiredTurn = clamp(error * 4.5 - actor.turnVelocity * 0.45, -turnLimit, turnLimit);
  const wingFactor = (damage.liftLeft + damage.liftRight) * 0.5;
  const wingLoading = config.mass / Math.max(1, config.wingArea);
  const maxLoad = 1 +
    12 *
      (config.acceleration * damage.engineFactor / 9.5) ** 2 *
      (105 / wingLoading) ** 1.4 *
      (1800 / Math.max(1, config.mass)) ** 0.3 *
      wingFactor;
  const bankLimit = Math.min(config.bankLimit ?? 87.5 * RAD, Math.acos(1 / Math.max(1, maxLoad)));
  const targetBank = clamp(
    -Math.atan2(actor.speed * desiredTurn, FLIGHT_GRAVITY) + damage.rollBias,
    -bankLimit,
    bankLimit,
  );
  const inertia = (config.mass * config.wingspan ** 2) / 12;
  const referenceInertia = (1800 * 6.2 ** 2) / 12;
  const response = clamp(
    12 * Math.sqrt(((config.acceleration * damage.engineFactor / 9.5) * referenceInertia) / Math.max(1, inertia)) * damage.response * wingFactor,
    2.5,
    18,
  );
  const rollAuthority = targetBank > actor.bank ? damage.rollAuthorityLeft : damage.rollAuthorityRight;
  actor.rollVelocity += ((targetBank - actor.bank) * response ** 2 * rollAuthority - 2 * response * actor.rollVelocity) * dt;
  actor.rollVelocity = clamp(actor.rollVelocity, -response * 0.35, response * 0.35);
  const bank = actor.bank + actor.rollVelocity * dt;
  actor.bank = clamp(bank, -bankLimit, bankLimit);
  if (bank !== actor.bank) actor.rollVelocity = 0;
  // Coordinated yaw responds throughout the roll. Using the step midpoint
  // keeps a newly established bank effective immediately without waiting for
  // the aircraft to reach its final bank angle.
  const bankForTurn = (startingBank + actor.bank) * 0.5;
  actor.turnVelocity = clamp(
    (-FLIGHT_GRAVITY * Math.tan(bankForTurn)) / Math.max(1, actor.speed),
    minTurn,
    maxTurn,
  );
  const yaw = actor.turnVelocity + damage.yawDrift;
  const appliedYaw = branchTurn === undefined ? yaw : clamp(yaw, minTurn, maxTurn);
  actor.heading = angleDelta(actor.heading + appliedYaw * dt, 0);
  updateBoost(actor, intent, config, dt);
  const throttle = intent.brake ? 0 : clamp(intent.throttle);
  const cruise = config.cruiseSpeed * speedFactor;
  const normalMax = Math.max(cruise, config.maxSpeed * damage.engineFactor * speedFactor);
  const previousSpeed = actor.speed;
  actor.effectiveThrottle = throttle;
  const thrust = throttle + (RULES.boost.thrustMultiplier - 1) * actor.boost;
  const baseTarget = cruise + (normalMax - cruise) * throttle;
  const targetSpeed = baseTarget + normalMax * (RULES.boost.speedMultiplier - 1) * actor.boost;
  if (actor.speed < targetSpeed) {
    actor.speed = Math.min(targetSpeed, actor.speed + config.acceleration * damage.engineFactor * thrust * dt);
  } else {
    const deceleration = intent.brake || actor.speed > normalMax ? RULES.boost.overspeedDecay : 1.2;
    actor.speed = Math.max(targetSpeed, actor.speed - deceleration * dt);
  }
  actor.turnVelocity = clamp(
    (-FLIGHT_GRAVITY * Math.tan(actor.bank)) / Math.max(1, actor.speed),
    minTurn,
    maxTurn,
  );
  actor.acceleration = dt > 0 ? (actor.speed - previousSpeed) / dt : 0;
  actor.turnLoad = Math.abs(actor.turnVelocity * actor.speed) / FLIGHT_GRAVITY;
  actor.vx = Math.sin(actor.heading) * actor.speed;
  actor.vz = Math.cos(actor.heading) * actor.speed;
  const drift = wind.sample(actor.x + actor.vx * dt, actor.z + actor.vz * dt);
  actor.vx += drift.x * (config.windResponse ?? 1);
  actor.vz += drift.z * (config.windResponse ?? 1);
  actor.x += actor.vx * dt;
  actor.z += actor.vz * dt;
  return actor;
}
