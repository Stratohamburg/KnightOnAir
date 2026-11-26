import { simulationFrames } from "./fixtures/simulationFrames";
import { describe, expect, it, vi } from "vitest";
import { Euler, Vector3 } from "three";
import { engineOutlet, localToWorld, muzzleAnchor } from "../src/content/3d/anchors";
import { RULES } from "../src/data/config";
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
import type { ContinuousTurn, Intent } from "../src/simulation/types";

function aircraft(index = 0) {
  const w = new World(simulationFrames[index], 42, { director: false });
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

function headingInput(heading: number, continuousTurn?: ContinuousTurn): Intent {
  return { x: Math.sin(heading), z: Math.cos(heading), active: true, magnitude: .7, continuousTurn };
}

describe("continuous player turns", () => {
  it.each([-1, 1] as const)("uses heading sign %s on both sides of the shortest-path branch", (sign) => {
    const w = aircraft();
    for (const degrees of [170, 178, 184, 190]) {
      w.frame(RULES.step, headingInput(sign * degrees * RAD, sign));
      expect(w.player.turnVelocity * sign).toBeGreaterThan(0);
      expect(angleDelta(w.player.heading, w.player.prevHeading!) * sign).toBeGreaterThan(0);
      expect(w.player.bank * sign).toBeLessThan(0);
    }

    const absolute = aircraft();
    absolute.frame(RULES.step, headingInput(sign * 184 * RAD));
    expect(absolute.player.turnVelocity * sign).toBeLessThan(0);
  });

  it("uses the shortest path outside the branch guard and settles on the target", () => {
    const w = aircraft();
    const target = -12 * RAD;
    const input = headingInput(target, 1);
    w.frame(RULES.step, input);
    expect(w.player.turnVelocity).toBeLessThan(0);
    for (let i = 0; i < 180; i++) w.frame(RULES.step, input);
    expect(Math.abs(angleDelta(target, w.player.heading))).toBeLessThan(.001);
    expect(Math.abs(w.player.bank)).toBeLessThan(.001);
    expect(Math.abs(w.player.turnVelocity)).toBeLessThan(.001);
  });

  it.each([-1, 1] as const)("reduces damaged turn authority without reversing heading sign %s", (sign) => {
    const healthy = aircraft();
    const damaged = aircraft();
    const side = sign === -1 ? "leftWing" : "rightWing";
    const wing = damaged.player.parts.find((part) => part.slot === side)!;
    wing.health = 0;
    const input = headingInput(sign * 185 * RAD, sign);
    for (let i = 0; i < 20; i++) {
      healthy.frame(RULES.step, input);
      damaged.frame(RULES.step, input);
      expect(damaged.player.turnVelocity * sign).toBeGreaterThan(0);
      expect(angleDelta(damaged.player.heading, damaged.player.prevHeading!) * sign).toBeGreaterThan(0);
    }
    expect(Math.abs(damaged.player.turnVelocity)).toBeLessThan(Math.abs(healthy.player.turnVelocity));
  });

  it("clears the interrupted turn lock at the boundary and retains release-to-cruise", () => {
    const w = aircraft();
    const p = w.player;
    p.z = RULES.boundary + 2;
    p.x = -10;
    const inherited = headingInput(Math.PI + .05, -1);
    w.frame(RULES.step, inherited);
    expect(p.turnVelocity).toBeGreaterThan(0);

    p.z = p.x = 0;
    w.frame(RULES.step, headingInput(Math.PI - .05, -1));
    expect(p.turnVelocity).toBeGreaterThan(0);

    p.speed = p.stats.maxSpeed;
    for (let i = 0; i < 480; i++) w.frame(RULES.step);
    expect(p.speed).toBeCloseTo(p.frame.cruiseSpeed, 3);
    expect(Math.abs(p.bank)).toBeLessThan(.001);
    expect(Math.abs(p.turnVelocity)).toBeLessThan(.001);

    w.frame(RULES.step, headingInput(p.heading + Math.PI - .05, -1));
    expect(p.turnVelocity).toBeLessThan(0);
  });

  it.each([-1, 1] as const)("replays heading sign %s through a boundary crossing", (sign) => {
    const live = aircraft();
    const playback = aircraft();
    live.player.weapons = [];
    playback.player.weapons = [];
    playback.player.x = -25;
    const controller = new controllers.NetworkController();
    const replay = playback.spawnReplayOpponent(live.player.frame, controller, 0, 0);
    replay.weapons = [];
    replay.heading = live.player.heading;
    expect(controller.push({
      time: RULES.step,
      intent: { ...controllers.playerIntent({ heading: 0, throttle: 0 }), continuousTurn: 0 as ContinuousTurn },
    })).toBe(false);

    const headings = [170, 176, 182, 188, 194].map((degrees) => sign * degrees * RAD);
    for (let i = headings.length - 1; i >= 0; i--) {
      const intent = controllers.playerIntent({ heading: headings[i], throttle: .7, continuousTurn: sign });
      expect(controller.push({ time: (i + 1) * RULES.step, intent })).toBe(true);
      intent.continuousTurn = undefined;
    }
    expect(controller.push({
      time: (headings.length + 1) * RULES.step,
      intent: { targetHeading: 0, throttle: 0, boost: 0, fire: false, bomb: false, brake: false },
    })).toBe(true);

    for (const heading of headings) {
      live.frame(RULES.step, headingInput(heading, sign));
      playback.frame(RULES.step);
      expect(controller.sample(playback.elapsed).continuousTurn).toBe(sign);
      expect(replay.turnVelocity * sign).toBeGreaterThan(0);
      for (const key of ["x", "z", "speed", "heading", "bank", "turnVelocity"] as const)
        expect(replay[key]).toBeCloseTo(live.player[key], 9);
    }
    playback.frame(RULES.step);
    expect(controller.sample(playback.elapsed).continuousTurn).toBeUndefined();
  });
});

describe("aerodynamic banking and enemy handling", () => {
  it("starts turning as soon as roll begins", () => {
    const w = aircraft();
    const before = w.player.heading;
    w.frame(1 / 60, { x: 1, z: 0, active: true, magnitude: 1 });
    expect(Math.abs(w.player.bank)).toBeGreaterThan(0);
    expect(Math.abs(angleDelta(w.player.heading, before))).toBeGreaterThan(0);
  });

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

  it("reenters after a broken tail instead of snapping back to the player", () => {
    const w = aircraft();
    w.player.weapons = [];
    const hunter = w.spawnEnemy("hunter", 0, -12)!;
    const states = new Set<string>();
    let breakingPosition = 0;
    for (let i = 0; i < 900; i++) {
      const turning = i > 95 && i < 260;
      w.frame(RULES.step, {
        x: turning ? 1 : 0,
        z: turning ? 0 : 1,
        active: turning,
        magnitude: turning ? 1 : 0,
      });
      states.add(hunter.state);
      if (hunter.state === "breaking" && breakingPosition === 0) breakingPosition = hunter.z;
      if (hunter.state === "reentering") break;
    }
    expect(states.has("attacking")).toBe(true);
    expect(states.has("breaking")).toBe(true);
    expect(states.has("reentering")).toBe(true);
    expect(Math.abs(hunter.z - breakingPosition)).toBeGreaterThan(1);
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

  it("keeps a chase aircraft on a predicted tail point and exposes relative geometry", () => {
    const w = aircraft();
    w.player.weapons = [];
    const hunter = w.spawnEnemy("hunter", 0, -24)!;
    const profile = npcProfileById("hunter", w.era)!;
    const motion = combatantById(hunter.configId!)!.frame;
    if (motion.model !== "air") throw new Error("Expected air envelope");
    const intent = npcIntent(profile, hunter, w.player, 0, undefined, motion, RULES.step);
    expect(hunter.combatGeometry?.distance).toBeGreaterThan(20);
    expect(hunter.combatGeometry?.closingSpeed).toBeLessThan(0);
    expect(hunter.combatGeometry?.lateralOffset).toBeCloseTo(0, 5);
    expect(intent.targetPoint?.z).toBeLessThan(w.player.z);
    expect(intent.attackPoint?.z).toBeGreaterThan(intent.targetPoint?.z ?? 0);
  });

  it("requires a solved weapon geometry before an enemy opens fire", () => {
    const w = aircraft();
    const hunter = w.spawnEnemy("hunter", 0, -10)!;
    const profile = npcProfileById("hunter", w.era)!;
    const motion = combatantById(hunter.configId!)!.frame;
    if (motion.model !== "air") throw new Error("Expected air envelope");
    hunter.heading = Math.PI / 2;
    const intent = npcIntent(profile, hunter, w.player, 0, undefined, motion, RULES.step);
    expect(hunter.combatGeometry?.weaponSolution).toBe(false);
    expect(intent.fire).toBe(false);
  });

  it("keeps dive and crossing roles on their attack axes", () => {
    const w = aircraft(simulationFrames.findIndex((frame) => frame.era === "ww1"));
    w.player.weapons = [];
    const striker = w.spawnEnemy("striker", -18, 24)!;
    const bomber = w.spawnEnemy("bomber", 18, 24)!;
    const strikerProfile = npcProfileById("striker", w.era)!;
    const bomberProfile = npcProfileById("bomber", w.era)!;
    const strikerMotion = combatantById(striker.configId!)!.frame;
    const bomberMotion = combatantById(bomber.configId!)!.frame;
    if (strikerMotion.model !== "air" || bomberMotion.model !== "air") throw new Error("Expected air envelope");
    const strikerIntent = npcIntent(strikerProfile, striker, w.player, 0, undefined, strikerMotion, RULES.step);
    const bomberIntent = npcIntent(bomberProfile, bomber, w.player, 0, undefined, bomberMotion, RULES.step);
    expect(strikerProfile.airAttack?.attackBoost).toBeGreaterThan(0);
    expect(strikerMotion.maxSpeed).toBeGreaterThan(strikerMotion.cruiseSpeed);
    expect(strikerIntent.throttle).toBeGreaterThan(0);
    expect(Math.abs(bomberIntent.targetHeading! - bomber.heading)).toBeLessThan(Math.PI / 2);
  });

  it("spawns the first available chase role from a safe rear bearing", () => {
    const w = new World(simulationFrames[0], 42, { supply: false });
    w.isSpawnVisible = () => false;
    w.player.weapons = [];
    for (let i = 0; i < 720; i++) w.frame(RULES.step);
    const rear = w.enemies.some((enemy) => {
      if (enemy.layer !== "air") return false;
      const along = (enemy.x - w.player.x) * Math.sin(w.player.heading) +
        (enemy.z - w.player.z) * Math.cos(w.player.heading);
      return along < -30;
    });
    expect(rear).toBe(true);
  });

  it("sets light, formation, crossing and buoyant aircraft apart in the WWI pool", () => {
    const w = aircraft(simulationFrames.findIndex((frame) => frame.era === "ww1"));
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
    const banks = simulationFrames.map((_, index) => circling(aircraft(index), 4));
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
      expect(ENEMIES[kind].turnRate).toBeLessThan(simulationFrames[0].turnRate / 2);
      expect(Number.isFinite(e.bank + e.heading + e.speed)).toBe(true);
    },
  );
});
