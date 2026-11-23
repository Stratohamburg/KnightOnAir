import { describe, expect, it, vi } from "vitest";
import { Euler, Vector3 } from "three";
import { engineOutlet, localToWorld, muzzleAnchor } from "../src/content/3d/anchors";
import { AIRFRAMES } from "../src/data/aircrafts";
import { ENEMIES } from "../src/data/enemies";
import { combatantById, npcProfileById } from "../src/data/combatants";
import { npcIntent } from "../src/simulation/Controllers";
import * as controllers from "../src/simulation/Controllers";
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
  it("advances equivalent player, NPC and replay inputs through the same flight state", () => {
    const w = aircraft();
    const p = w.player;
    const npcWorld = aircraft();
    const replayWorld = aircraft();
    const profile = npcProfileById("hunter", w.era)!;
    const previousCombatant = profile.combatantId;
    const controller = new controllers.NetworkController();
    const npcController = vi.spyOn(controllers, "npcIntent");
    try {
      profile.combatantId = p.configId;
      const npc = npcWorld.spawnEnemy("hunter", 0, 0)!;
      const replay = replayWorld.spawnReplayOpponent(p.frame, controller, 0, 0);
      p.weapons = [];
      for (const actor of [p, npc, replay]) {
        actor.x = actor.z = 0;
        actor.heading = 0;
        actor.vx = 0;
        actor.vz = p.speed;
        actor.parts[0].health *= .75;
        actor.weapons = [];
      }
      for (const host of [npcWorld, replayWorld]) {
        host.player.weapons = [];
        host.player.x = -30;
      }
      for (let step = 0; step < 240; step++) {
        const heading = step < 120 ? .52 : -.37;
        const throttle = step < 170 ? .7 : .25;
        const boost = step < 75 ? .9 : 0;
        const intent = controllers.playerIntent({ heading, throttle, boost });
        npcController.mockReturnValue(intent);
        controller.push({ time: (step + 1) / 60, intent });
        w.frame(1 / 60, { x: Math.sin(heading), z: Math.cos(heading), active: true, magnitude: throttle, boost });
        npcWorld.frame(1 / 60);
        replayWorld.frame(1 / 60);
        for (const actor of [npc, replay]) {
          for (const key of ["x", "z", "vx", "vz", "speed", "heading", "bank", "rollVelocity", "energy"] as const) {
            expect(actor[key], `step ${step}, ${actor.controllerId}, ${key}`).toBeCloseTo(p[key], 9);
          }
        }
      }
    } finally {
      npcController.mockRestore();
      profile.combatantId = previousCombatant;
    }
  });

  it.each(["straight", "turn", "boost"])("uses a bounded tail attack window with a %s player", (maneuver) => {
    const w = aircraft();
    const p = w.player;
    p.weapons = [];
    const hunter = w.spawnEnemy("hunter", 0, -12)!;
    hunter.cooldown = 0;
    let attackSteps = 0;
    let shots = 0;
    for (let i = 0; i < 200 && hunter.state !== "breaking"; i++) {
      const steering = attackSteps > 0 && maneuver === "turn";
      const boosting = attackSteps > 0 && maneuver === "boost";
      w.frame(1 / 60, {
        x: steering ? 1 : 0, z: steering ? 0 : 1,
        active: steering || boosting, magnitude: boosting ? 1 : 0, boost: Number(boosting),
      });
      if (hunter.state === "attacking") {
        attackSteps++;
        expect(hunter.attackWindow).toBeGreaterThan(0);
      }
      shots += w.consumeEvents().filter((event) => event.type === "enemy_fire").length;
    }
    expect(hunter.state).toBe("breaking");
    expect(hunter.warning).toBe(0);
    expect(hunter.breakWindow).toBeGreaterThan(0);
    if (maneuver === "straight") {
      expect(attackSteps).toBeGreaterThan(60);
      expect(shots).toBe(1);
    } else {
      expect(attackSteps).toBeGreaterThan(0);
      expect(attackSteps).toBeLessThan(60);
      if (maneuver === "boost") expect(shots).toBe(0);
    }
  });

  it("gives an interceptor the speed to pass the player and hold its breakaway", () => {
    const w = aircraft();
    w.player.weapons = [];
    const enemy = w.spawnEnemy("interceptor", 0, -16)!;
    const motion = combatantById(enemy.configId!).frame;
    if (motion.model !== "air") throw new Error("Expected air envelope");
    let peak = enemy.speed;
    let passedWhileBreaking = false;
    for (let i = 0; i < 270; i++) {
      w.frame(1 / 60);
      peak = Math.max(peak, enemy.speed);
      passedWhileBreaking ||= enemy.state === "breaking" && enemy.z > w.player.z + 9;
    }
    expect(peak).toBeGreaterThan(motion.maxSpeed);
    expect(enemy.energy).toBeLessThan(motion.energyMax);
    expect(passedWhileBreaking).toBe(true);
  });

  it("sets light, formation, crossing and buoyant aircraft apart in the WWI pool", () => {
    const w = aircraft(AIRFRAMES.findIndex((frame) => frame.era === "ww1"));
    w.player.weapons = [];
    const scout = w.spawnEnemy("scout", -16, 28)!;
    const striker = w.spawnEnemy("striker", 16, 28)!;
    const balloon = w.spawnEnemy("recon_balloon", -23, -22)!;
    const airship = w.spawnEnemy("elite", 25, 33)!;
    const escort = w.spawnEnemy("escort", 34, 32)!;
    const bomber = w.spawnEnemy("bomber", 24, -24)!;
    expect(combatantById(scout.configId!).frame.turnRate).toBeGreaterThan(combatantById(striker.configId!).frame.turnRate);
    const motion = combatantById(escort.configId!).frame;
    if (motion.model !== "air") throw new Error("Expected air envelope");
    const intent = npcIntent(npcProfileById("escort", w.era)!, escort, w.player, 0, airship, motion, 1 / 60);
    const side = escort.id % 2 ? 1 : -1;
    const expectedHeading = Math.atan2(
      airship.x + Math.cos(airship.heading) * side * 6 - Math.sin(airship.heading) * 3 - escort.x,
      airship.z - Math.sin(airship.heading) * side * 6 - Math.cos(airship.heading) * 3 - escort.z,
    );
    expect(intent.targetHeading).toBeCloseTo(expectedHeading);
    bomber.heading = bomber.id % 2 ? Math.PI / 2 : -Math.PI / 2;
    const start = { x: bomber.x, z: bomber.z };
    for (let i = 0; i < 150; i++) w.frame(1 / 60);
    expect(Math.abs(bomber.x - start.x)).toBeGreaterThan(7);
    expect(Math.abs(bomber.z - start.z)).toBeLessThan(2);
    expect(balloon.speed).toBeLessThan(.6);
    expect(airship.speed).toBeLessThan(3);
    expect(airship.speed).toBeLessThan(bomber.speed);
  });

  it("resolves refit and engine anchors through the same rolled aircraft pose", () => {
    const w = aircraft();
    const p = w.player;
    p.heading = .73;
    p.bank = -.89;
    w.installUpgrade(upgradeById("wing_turret")!);
    const weapon = p.weapons.find(({ config }) => config.id === "wing_turret")!;
    const turret = p.parts.find(({ id }) => id === weapon.partId)!;
    weapon.heading = p.heading - .63;
    const pose = w.actorPose(p);
    const local = muzzleAnchor(turret, weapon, p.heading, 0);
    const expected = new Vector3(local.x, local.y, local.z)
      .applyEuler(new Euler(0, p.heading, p.bank)).add(new Vector3(pose.x, pose.y, pose.z));
    const muzzle = w.weaponMuzzle(p, weapon, 0)!;
    expect([muzzle.x, muzzle.y, muzzle.z]).toEqual(expected.toArray().map((value) => expect.closeTo(value, 10)));
    const engine = p.parts.find(({ role }) => role === "engine")!;
    const outlet = localToWorld(pose, engineOutlet(engine));
    expect(outlet.direction.z).toBeCloseTo(-Math.cos(p.heading));
    turret.destroyed = true;
    expect(w.weaponMuzzle(p, weapon, 0)).toBeUndefined();
  });
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
