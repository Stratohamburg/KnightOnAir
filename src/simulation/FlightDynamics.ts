import { clamp, RAD } from "../services/Random";
import type { Player } from "./types";

// Game distances represent two metres. Keep the coordinated-turn equation in
// world units: yaw rate = g * tan(bank) / airspeed.
export const FLIGHT_GRAVITY = 9.81 / 2;

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
