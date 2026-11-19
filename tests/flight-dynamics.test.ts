import { describe, expect, it } from "vitest";
import { AIRFRAMES } from "../src/data/aircrafts";
import { ENEMIES } from "../src/data/enemies";
import { upgradeById } from "../src/data/upgrades";
import { angleDelta, RAD } from "../src/services/Random";
import {
  flightEnvelope,
  FLIGHT_GRAVITY,
} from "../src/simulation/FlightDynamics";
import { World } from "../src/simulation/World";

function aircraft(index = 0) {
  const w = new World(AIRFRAMES[index], 42, { director: false });
  w.enemies = [];
  w.player.invulnerable = 10000;
  return w;
}
function circling(w: World, seconds: number, side = 1) {
  let peakBank = 0;
  for (let i = 0; i < seconds * 60; i++) {
    const target = w.player.heading + side * Math.PI * 0.8;
    w.frame(1 / 60, {
      x: Math.sin(target),
      z: Math.cos(target),
      active: true,
      magnitude: 1,
    });
    peakBank = Math.max(peakBank, Math.abs(w.player.bank));
  }
  return peakBank / RAD;
}

describe("aerodynamic banking and enemy handling", () => {
  it("banks light powerful aircraft near knife-edge and keeps a heavy aircraft shallower", () => {
    const banks = AIRFRAMES.map((_, index) => circling(aircraft(index), 4));
    expect(banks[3]).toBeGreaterThan(84);
    expect(banks[3]).toBeLessThan(88);
    expect(banks[0]).toBeGreaterThan(80);
    expect(banks[0]).toBeLessThan(banks[3]);
    expect(banks[1]).toBeLessThan(banks[0]);
    expect(banks[1]).toBeGreaterThan(65);
    expect(banks[2]).toBeLessThan(banks[1]);
    expect(banks[2]).toBeLessThan(56);
    expect(banks[2]).toBeGreaterThan(45);
  });
  it("reduces the load envelope and roll response with more mass, span, less power or engine damage", () => {
    const w = aircraft(),
      p = w.player;
    const base = flightEnvelope(p);
    p.stats.acceleration *= 0.5;
    expect(flightEnvelope(p).maxBank).toBeLessThan(base.maxBank);
    expect(flightEnvelope(p).response).toBeLessThan(base.response);
    p.stats.acceleration *= 2;
    expect(flightEnvelope(p, 0.5).maxBank).toBeLessThan(base.maxBank);
    w.installUpgrade(upgradeById("giant_wing")!);
    expect(flightEnvelope(p).maxBank).toBeLessThan(base.maxBank);
    expect(flightEnvelope(p).response).toBeLessThan(base.response);
    expect(flightEnvelope(p).mass).toBeGreaterThan(base.mass);
  });
  it("uses bank to produce lateral acceleration, banks inward on either side and rolls level after release", () => {
    for (const side of [-1, 1]) {
      const w = aircraft();
      circling(w, 2, side);
      const p = w.player;
      expect(Math.sign(p.bank)).toBe(-side);
      expect(p.turnVelocity * p.speed).toBeCloseTo(
        -FLIGHT_GRAVITY * Math.tan(p.bank),
        6,
      );
      for (let i = 0; i < 120; i++) w.frame(1 / 60);
      expect(Math.abs(p.bank)).toBeLessThan(0.5 * RAD);
      expect(Math.abs(p.rollVelocity)).toBeLessThan(0.02);
    }
  });
  it("rolls gradually into a reversal and preserves finite state at the bank limits", () => {
    const w = aircraft(3);
    circling(w, 3);
    const before = w.player.bank;
    w.frame(1 / 60, {
      x: Math.sin(w.player.heading - 2),
      z: Math.cos(w.player.heading - 2),
      active: true,
      magnitude: 1,
    });
    expect(w.player.bank).toBeLessThan(0);
    expect(Math.abs(w.player.bank - before)).toBeLessThan(8 * RAD);
    circling(w, 3, -1);
    expect(w.player.bank).toBeGreaterThan(80 * RAD);
    expect(Number.isFinite(w.player.turnVelocity + w.player.rollVelocity)).toBe(
      true,
    );
  });
  it.each(["scout", "hunter", "bomber", "escort", "striker", "elite"])(
    "%s has steering inertia and less agility than the starter aircraft",
    (kind) => {
      const w = aircraft(),
        e = w.spawnEnemy(kind, 25, 25)!;
      w.player.weapons = [];
      const before = e.heading;
      e.heading = angleDelta(before + Math.PI / 2, 0);
      const firstHeading = e.heading;
      w.frame(1 / 60);
      expect(Math.abs(angleDelta(e.heading, firstHeading))).toBeLessThan(
        0.2 * RAD,
      );
      for (let i = 0; i < 90; i++) w.frame(1 / 60);
      expect(Math.abs(e.turnVelocity)).toBeLessThanOrEqual(
        ENEMIES[kind].turnRate * RAD + 1e-8,
      );
      expect(ENEMIES[kind].turnRate).toBeLessThan(AIRFRAMES[0].turnRate / 2);
      expect(Number.isFinite(e.bank + e.heading + e.speed)).toBe(true);
    },
  );
});
