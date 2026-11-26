import { lightJet, simulationFrame } from "./fixtures/simulationFrames";
import { describe, expect, it } from "vitest";
import { NetworkController, playerIntent } from "../src/simulation/Controllers";
import { airframeById } from "../src/data/aircrafts";
import { hitEntity } from "../src/simulation/HitTest";
import { applyPartDamage, repairPartsWithOverflow, totalPartHealth } from "../src/simulation/DamageModel";
import { World } from "../src/simulation/World";
import { routePosition } from "../src/simulation/Routes";
import { ERAS } from "../src/data/eras";
import { RULES } from "../src/data/config";
import { HEALTH_SUPPLY } from "../src/data/pickups";
import { combatantById } from "../src/data/combatants";
import { upgradeById } from "../src/data/upgrades";
import { WEAPONS } from "../src/data/weapons";

function run(seed: number) {
  const world = new World(lightJet, seed, { director: false, supply: false });
  for (let i = 0; i < 60; i++)
    world.frame(1 / 60, { x: 0.3, z: 1, magnitude: 0.8, active: true, travel: 0.8, boost: 0 });
  return world;
}

describe("0.4 fixed-seed baseline", () => {
  it("keeps the fixed-step player and enemy snapshot deterministic", () => {
    const a = run(20261120);
    const b = run(20261120);
    expect({
      player: [a.player.x, a.player.z, a.player.heading, a.player.speed, a.player.health],
      enemies: a.enemies.map((enemy) => [enemy.kind, enemy.x, enemy.z, enemy.heading, enemy.health]),
    }).toEqual({
      player: [b.player.x, b.player.z, b.player.heading, b.player.speed, b.player.health],
      enemies: b.enemies.map((enemy) => [enemy.kind, enemy.x, enemy.z, enemy.heading, enemy.health]),
    });
  });

  it("defines total health as the sum of all body segments", () => {
    const world = run(42);
    expect(world.player.health).toBeCloseTo(
      world.player.parts.reduce((sum, part) => sum + part.health, 0),
    );
    expect(world.playerMaxHealth).toBeCloseTo(
      world.player.parts.reduce((sum, part) => sum + part.maxHealth, 0),
    );
  });

  it("retains attached disabled parts in the swept silhouette", () => {
    const entity = {
      x: 0,
      z: 0,
      heading: 0,
      parts: [
        { id: "front", kind: "gun", slot: "nose" as const, x: 0, z: 1, radius: 0.5, health: 0, maxHealth: 10, destroyed: false, state: "disabled" as const, weight: 0, addedMass: 0 },
        { id: "rear", kind: "body", slot: "center" as const, x: 0, z: 0, radius: 0.5, health: 10, maxHealth: 10, destroyed: false, state: "intact" as const, weight: 0, addedMass: 0 },
      ],
    };
    expect(hitEntity(entity, { prevX: 0, prevZ: 3, x: 0, z: -2 })?.part?.id).toBe("front");
  });

  it("finds relative motion contacts at the first world-space point", () => {
    const world = new World(lightJet, 42, { director: false, supply: false });
    const entity = world.player;
    entity.prevX = -10;
    entity.x = 10;
    const hit = hitEntity(entity, { prevX: 0, prevZ: -4, x: 0, z: 4 });
    expect(hit?.t).toBeGreaterThan(.2);
    expect(hit?.t).toBeLessThan(.55);
    expect(hit?.x).toBe(0);
    expect(hit?.z).toBeCloseTo(-4 + 8 * hit!.t);
  });

  it("covers the visible tip, preserves outline gaps, and excludes detached tips", () => {
    const world = new World(lightJet, 42, { director: false, supply: false });
    const p = world.player;
    const wing = p.parts.find(({ id }) => id === "right_wing")!;
    const tip = p.parts.find(({ id }) => id === "right_wing_tip")!;
    wing.health = 0;
    wing.state = "disabled";
    const sweep = (x: number, z: number) => hitEntity(p, { prevX: x, prevZ: z - .1, x, z: z + .1 });
    expect(sweep(wing.x, -.15)?.part).toBe(wing);
    expect(sweep(tip.x, tip.z)?.part).toBe(tip);
    expect(sweep(tip.x, p.frame.length * .28)).toBeUndefined();
    tip.destroyed = true;
    expect(sweep(tip.x, tip.z)).toBeUndefined();
  });

  it("sweeps the edge of a heavy aircraft's expanded wing", () => {
    const w = new World(simulationFrame("behemoth_17"), 42, { director: false, supply: false });
    for (const id of ["giant_wing", "wing_turret", "right_engine", "left_engine"]) w.installUpgrade(upgradeById(id)!);
    const tip = w.player.parts.find(({ id }) => id === "right_wing_tip")!;
    const x = Math.max(...tip.silhouette![0].map((point) => point.x)) - .1;
    expect(x).toBeGreaterThan(14);
    expect(hitEntity(w.player, { prevX: x, prevZ: 2, x, z: -5 })?.part).toBe(tip);
  });

  it("publishes only actual damage recipients and distinguishes area coordinates", () => {
    const world = new World(lightJet, 42, { director: false, supply: false });
    const enemy = world.spawnEnemy("hunter", 0, 8)!;
    const before = enemy.parts.map(part => part.health);
    world.damageEnemy(enemy, 4);
    const hit = world.consumeEvents().find(event => event.type === "enemy_hit")!;
    expect(hit.snapshot.contact).toBeFalsy();
    expect(hit.snapshot.actorPose).toMatchObject({ x: 0, z: 8 });
    for (const {id, amount} of hit.snapshot.damagedParts!) {
      const i = enemy.parts.findIndex(part => part.id === id);
      expect(before[i] - enemy.parts[i].health).toBeCloseTo(amount);
    }
    expect(hit.snapshot.damagedParts!.reduce((sum, part) => sum + part.amount, 0)).toBeCloseTo(4);
    world.frame(1 / 60, { x: 0, z: 1, magnitude: 1, active: true });
    expect(world.player.effectiveThrottle).toBeGreaterThan(0);
    expect(world.player.acceleration).toBeGreaterThan(0);
    expect(Number.isFinite(world.player.turnLoad)).toBe(true);
  });

  it("resolves penetrating hits by contact time regardless of spawn order", () => {
    const world = new World(lightJet, 42, { director: false, supply: false });
    world.enemies = [];
    world.player.weapons = [];
    const far = world.spawnEnemy("hunter", 0, 15)!;
    const near = world.spawnEnemy("hunter", 0, 8)!;
    world.shoot(0, 0, 0, { ...WEAPONS.ww1_sync_mg, speed: 1800, range: 100, pierce: 1 }, "player");
    world.frame(1 / 60);
    expect(world.consumeEvents().flatMap((e) => e.type === "enemy_hit" ? [e.enemyId] : []))
      .toEqual([near.id, far.id]);
  });

  it("retains successful rolled-mount and destruction snapshots across fixed steps", () => {
    const world = new World(lightJet, 42, { director: false, supply: false });
    world.enemies = [];
    const p = world.player;
    p.bank = .65;
    const enemy = world.spawnEnemy("hunter", 0, 10)!;
    world.frame(2 * RULES.step);
    const shots = world.consumeEvents().filter((event) => event.type === "weapon_fired");
    expect(shots.length).toBeGreaterThan(0);
    for (const shot of shots) {
      const projectile = world.projectiles.items.find(({ id }) => id === shot.projectileId)!;
      expect(shot.snapshot.position.y).toBe(projectile.y);
      expect(shot.snapshot.bank).toBeGreaterThan(.4);
    }
    world.damageEnemy(enemy, enemy.maxHealth);
    const deathX = enemy.x;
    world.frame(3 * RULES.step);
    expect(world.enemies).not.toContain(enemy);
    const events = world.consumeEvents();
    expect(events.find((event) => event.type === "enemy_destroyed")?.snapshot.position.x).toBe(deathX);
    expect(events.filter((event) => event.type === "part_detached")).toHaveLength(2);
    expect(world.consumeEvents()).toEqual([]);
  });

  it("repairs body segments by deterministic priority", () => {
    const world = new World(lightJet, 42, { director: false, supply: false });
    const body = world.player.parts.find((part) => part.id === "center_body")!;
    const engine = world.player.parts.find((part) => part.kind === "engine")!;
    body.health = 0;
    body.state = "disabled";
    engine.health = 0;
    engine.state = "disabled";
    world.spawnPickup("repairSmall", world.player.x, world.player.z);
    world.frame(1 / 60);
    expect(body.health).toBeGreaterThan(0);
    expect(engine.health).toBe(0);
  });

  it("spends overflow evenly, preserves detached parts during repair, and emits destruction once", () => {
    const world = new World(lightJet, 42, { director: false, supply: false });
    const p = world.player;
    const tip = p.parts.find(({ id }) => id === "right_wing_tip")!;
    const body = p.parts.find(({ id }) => id === "center_body")!;
    tip.health = 1;
    body.health = .25;
    const survivors = p.parts.filter((part) => part !== body && part !== tip);
    const before = survivors.map(({ health }) => health);
    const first = applyPartDamage(p, tip, 1.25 + survivors.length * .6);
    expect(first.transitions.find(({ part }) => part === tip)?.state).toBe("destroyed");
    expect(body.health).toBe(0);
    expect(survivors.map(({ health }) => health)).toEqual(before.map((health) => expect.closeTo(health - .6)));
    applyPartDamage(p, body, survivors.length * .6);
    expect(survivors.map(({ health }) => health)).toEqual(before.map((health) => expect.closeTo(health - 1.2)));
    repairPartsWithOverflow(p.parts, 7);
    expect(tip.health).toBe(0);
    expect(tip.destroyed).toBe(true);
    world.installUpgrade(upgradeById("nose_cannon")!);
    expect(p.health).toBe(totalPartHealth(p.parts));

    const enemy = world.spawnEnemy("hunter", 0, 16)!;
    world.damageEnemy(enemy, enemy.health * 2);
    world.damageEnemy(enemy, 10);
    expect(enemy.health).toBe(0);
    expect(totalPartHealth(enemy.parts)).toBe(0);
    const events = world.consumeEvents();
    expect(events.filter((event) => event.type === "enemy_destroyed")).toHaveLength(1);
    expect(events.filter((event) => event.type === "part_disabled")).toHaveLength(enemy.parts.length);
  });

  it("keeps player and NPC actors in one combat collection with mounted weapons", () => {
    const world = new World(lightJet, 42, { director: false, supply: false });
    world.enemies = [];
    world.player.weapons = [];
    const enemy = world.spawnEnemy("hunter", 0, 15)!;
    enemy.cooldown = 0;
    expect(world.actors.some((actor) => actor.id === "player")).toBe(true);
    expect(world.actors.some((actor) => actor.id === enemy.id)).toBe(true);
    expect(enemy.weapons[0].partId).toBe("center_body");
    const events = [] as ReturnType<World["consumeEvents"]>;
    for (let i = 0; i < 150; i++) {
      world.frame(1 / 60);
      events.push(...world.consumeEvents());
    }
    expect(events.some((event) => event.type === "enemy_fire")).toBe(true);
    expect(events.some((event) => event.type === "player_hit")).toBe(true);
  });
});

describe("0.4 era and combat rules", () => {
  it("creates the correct era variant and shares the surface budget across all layers", () => {
    const pioneer = new World(simulationFrame("sparrow_05"), 42, { director: false });
    const hunter = pioneer.enemies.find((enemy) => enemy.kind === "hunter")!;
    expect(hunter.health).toBeCloseTo(39);
    expect(hunter.weapons[0].config.id).toBe("ww1_twin_mg");
    expect(pioneer.spawnEnemy("missile_truck", 0, 30)).toBeUndefined();

    const world = new World(airframeById("falcon_13"), 42, { director: false });
    for (let i = 0; i < 3; i++) {
      expect(world.spawnEnemy("aa_truck", 0, 30 + i * 10)).toBeDefined();
      expect(world.spawnEnemy("patrol_boat", -30 - i * 10, 0)).toBeDefined();
    }
    expect(world.enemies.filter((enemy) => enemy.layer !== "air")).toHaveLength(6);
    expect(world.spawnEnemy("landing_ship", 24, 0)).toBeUndefined();
  });

  it("retries an opening wave when the viewport clears and respects the era caps", () => {
    const world = new World(simulationFrame("sparrow_05"), 43, { supply: false });
    world.player.invulnerable = 200;
    world.isSpawnVisible = () => true;
    for (let i = 0; i < 90; i++) world.frame(1 / 60);
    expect(world.enemies).toHaveLength(0);
    world.isSpawnVisible = () => false;
    for (let i = 0; i < 5400; i++) {
      world.frame(1 / 60);
      const air = world.enemies.filter((enemy) => enemy.layer === "air");
      const surface = world.enemies.filter((enemy) => enemy.layer !== "air");
      expect(air.length).toBeLessThanOrEqual(ERAS.pioneer.caps.air);
      expect(surface.length).toBeLessThanOrEqual(ERAS.pioneer.caps.surface);
      expect(world.enemies.every((enemy) => combatantById(enemy.configId!)?.era === "pioneer")).toBe(true);
    }
    expect(world.enemies.length).toBeGreaterThan(0);
    expect(world.enemies.some((enemy) => enemy.kind === "elite")).toBe(false);
  });

  it("keeps a faster following vehicle behind the slower lead vehicle on the shared road", () => {
    const world = new World(lightJet, 42, { director: false });
    world.enemies = [];
    world.player.weapons = [];
    world.player.invulnerable = 100;
    const road = world.routes.find((candidate) => candidate.kind === "road")!;
    const start = road.length / 2 - 20;
    const rear = routePosition(road, start), front = routePosition(road, start + 8);
    const fast = world.spawnEnemy("resource", rear.x, rear.z)!;
    const slow = world.spawnEnemy("aa_truck", front.x, front.z)!;
    for (let i = 0; i < 540; i++) {
      world.frame(1 / 60);
      expect(slow.routeDistance! - fast.routeDistance!).toBeGreaterThanOrEqual(fast.radius + slow.radius + 2 - 1e-6);
    }
    expect(fast.routeDistance).toBeGreaterThan(start);
    expect(fast.routeId).toBe(road.id);
  });

  it("keeps all three fallback choices eligible after more than 999 uses and preserves damaged health", () => {
    const world = new World(simulationFrame("sparrow_05"), 42, { director: false });
    const body = world.player.parts.find((part) => part.id === "center_body")!;
    body.health -= 10;
    const before = body.health, capacity = body.maxHealth;
    const belt = upgradeById("armor_belt")!;
    world.player.upgrades.push(...Array<string>(1000).fill(belt.id));
    world.installUpgrade(belt);
    expect(body.health).toBe(before);
    expect(body.maxHealth).toBeCloseTo(capacity + 12);
    world.upgradesAvailable = 1;
    expect(world.openUpgrades()).toBe(true);
  });

  it("disables bombing until a compatible bay is fitted and excludes other target layers", () => {
    const world = new World(simulationFrame("kestrel_08"), 42, { director: false });
    world.toggleBombing();
    expect(world.phase).toBe("battle");
    expect(world.dropBomb()).toBe(false);
    world.installUpgrade(upgradeById("bomb_bay")!);
    expect(world.bombWeapon?.id).toBe("ww1_light_bomb");
    world.toggleBombing();
    expect(world.phase).toBe("bombing");

    world.enemies = [];
    const air = world.spawnEnemy("hunter", 0, 6)!;
    world.player.weapons = [];
    world.shoot(0, 0, 0, { ...WEAPONS.ww1_sync_mg, targetLayers: ["water"], speed: 500 }, "player");
    world.frame(1 / 60);
    expect(air.health).toBe(air.maxHealth);
  });

  it("releases air weapons at the same altitude over different terrain", () => {
    const world = new World(simulationFrame("sparrow_05"), 42, { director: false, supply: false });
    world.enemies = [];
    world.player.weapons = [];
    expect(world.surfaceHeight(0, 0)).not.toBe(world.surfaceHeight(25, 40));
    world.shoot(0, 0, 0, WEAPONS.ww1_sync_mg, "player");
    world.shoot(25, 40, 0, WEAPONS.ww1_sync_mg, "player");
    expect(world.projectiles.items.filter((projectile) => projectile.active).map((projectile) => projectile.y))
      .toEqual([RULES.flightAltitude, RULES.flightAltitude]);
    world.toggleBombing();
    for (let i = 0; i < 180; i++) world.frame(1 / 60);
    expect(world.dropBomb()).toBe(true);
    const bay = world.player.parts.find((part) => part.role === "bay")!;
    expect(world.bombs[0].startY).toBeCloseTo(RULES.flightAltitude + (bay.y! - .22) * Math.cos(world.player.bank));
  });

  it("offers an opening pair of repair kits and keeps the field cap", () => {
    const world = new World(simulationFrame("sparrow_05"), 42, { director: false, supply: true });
    world.enemies = [];
    const repairs = () => world.pickups.items.filter((item) => item.active && item.kind !== "coin");
    for (let i = 0; i < 60 * 5; i++) world.frame(1 / 60);
    expect(repairs()).toHaveLength(2);
    for (let i = 0; i < HEALTH_SUPPLY.fieldCap * 2; i++)
      world.spawnPickup("repairLarge", i * 4, 20);
    expect(repairs()).toHaveLength(HEALTH_SUPPLY.fieldCap);
  });

  it("replays timestamped remote controls deterministically at different render rates", () => {
    function run(hz: number) {
      const world = new World(lightJet, 42, { director: false });
      world.enemies = [];
      world.player.weapons = [];
      const controller = new NetworkController();
      controller.push({ time: 1.5, intent: playerIntent({ heading: Math.PI / 2, throttle: .8 }) });
      controller.push({ time: 0, intent: playerIntent({ heading: Math.PI, throttle: .4, fire: true }) });
      const enemy = world.spawnReplayOpponent(lightJet, controller, 0, 24);
      for (let i = 0; i < 3 * hz; i++) world.frame(1 / hz);
      expect(world.actors.some((actor) => actor.id === enemy.id)).toBe(true);
      expect(enemy.bank).not.toBe(0);
      expect(controller.push({ time: 1, intent: playerIntent({ heading: 0, throttle: 0 }) })).toBe(false);
      return [enemy.x, enemy.z, enemy.heading, enemy.bank, enemy.health, world.player.health];
    }
    expect(run(30)).toEqual(run(60));
    expect(run(120)).toEqual(run(60));
  });
});
