import { clamp, RAD } from "../services/Random";
import type { AirMotionState, ControlDamage, ControllerIntent, Player } from "./types";

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
  speedMultiplier?: number;
  thrustMultiplier?: number;
}

export interface AirActorState extends AirMotionState {
  x: number;
  z: number;
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

export function updateFlightTurn(
  p: Player,
  error: number,
  turnLimit: number,
  dt: number,
  engineFactor: number,
  wingFactor: number,
) {
  const envelope = flightEnvelope(p, engineFactor, wingFactor);
  const desiredTurn = clamp(
    error * 4.5 - p.turnVelocity * 0.45,
    -turnLimit,
    turnLimit,
  );
  const targetBank = clamp(
    -Math.atan2(p.speed * desiredTurn, FLIGHT_GRAVITY),
    -envelope.maxBank,
    envelope.maxBank,
  );
  const frequency = envelope.response;
  p.rollVelocity +=
    ((targetBank - p.bank) * frequency ** 2 - 2 * frequency * p.rollVelocity) *
    dt;
  p.rollVelocity = clamp(p.rollVelocity, -frequency * 0.35, frequency * 0.35);
  p.bank = clamp(p.bank + p.rollVelocity * dt, -87.5 * RAD, 87.5 * RAD);
  p.turnVelocity = clamp(
    (-FLIGHT_GRAVITY * Math.tan(p.bank)) / Math.max(1, p.speed),
    -turnLimit,
    turnLimit,
  );
  return p.turnVelocity * dt;
}

/** Shared air integration entry point for player, NPC, and replay inputs. */
export function integrateAirActor(
  actor: AirActorState,
  intent: ControllerIntent,
  config: AirActorConfig,
  damage: ControlDamage,
  dt: number,
) {
  const target = intent.targetHeading ?? actor.heading;
  const error = angleDelta(target, actor.heading);
  const baseTurnLimit = config.turnRate * RAD;
  const authority = error < 0 ? damage.turnAuthorityLeft : damage.turnAuthorityRight;
  const turnLimit = baseTurnLimit * authority;
  const desiredTurn = clamp(error * 4.5 - actor.turnVelocity * 0.45, -turnLimit, turnLimit);
  const wingFactor = (damage.liftLeft + damage.liftRight) * 0.5;
  const wingLoading = config.mass / Math.max(1, config.wingArea);
  const maxLoad = 1 +
    12 *
      (config.acceleration * damage.engineFactor / 9.5) ** 2 *
      (105 / wingLoading) ** 1.4 *
      (1800 / Math.max(1, config.mass)) ** 0.3 *
      wingFactor;
  const bankLimit = Math.min(87.5 * RAD, Math.acos(1 / Math.max(1, maxLoad)));
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
  actor.bank = clamp(actor.bank + actor.rollVelocity * dt, -87.5 * RAD, 87.5 * RAD);
  actor.turnVelocity = clamp(
    (-FLIGHT_GRAVITY * Math.tan(actor.bank)) / Math.max(1, actor.speed),
    -turnLimit,
    turnLimit,
  );
  actor.heading = angleDelta(actor.heading + actor.turnVelocity * dt + damage.yawDrift * dt, 0);
  const boost = clamp(intent.boost);
  const thrust = Math.max(0, intent.throttle) + ((config.thrustMultiplier ?? 1.9) - 1) * boost;
  actor.speed += config.acceleration * damage.engineFactor * thrust * dt;
  if (thrust <= 0) actor.speed -= 1.2 * dt;
  const normalMax = Math.max(config.cruiseSpeed, config.maxSpeed * damage.engineFactor);
  const softMax = normalMax * (1 + ((config.speedMultiplier ?? 1.55) - 1) * boost);
  if (actor.speed > softMax) actor.speed = Math.max(softMax, actor.speed - 8 * dt);
  actor.speed = clamp(actor.speed, config.cruiseSpeed, normalMax * (config.speedMultiplier ?? 1.55));
  actor.turnVelocity = clamp(
    (-FLIGHT_GRAVITY * Math.tan(actor.bank)) / Math.max(1, actor.speed),
    -turnLimit,
    turnLimit,
  );
  actor.vx = Math.sin(actor.heading) * actor.speed;
  actor.vz = Math.cos(actor.heading) * actor.speed;
  actor.x += actor.vx * dt;
  actor.z += actor.vz * dt;
  return actor;
}

function angleDelta(target: number, current: number) {
  let value = target - current;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}
