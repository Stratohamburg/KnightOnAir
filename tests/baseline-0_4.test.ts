import { describe, expect, it } from "vitest";
import { NetworkController, playerIntent } from "../src/simulation/Controllers";
import { AIRFRAMES, airframeById } from "../src/data/aircrafts";
import { hitEntity } from "../src/simulation/HitTest";
import { World } from "../src/simulation/World";
import { routePosition } from "../src/simulation/Routes";
import { ERAS } from "../src/data/eras";
import { RULES } from "../src/data/config";
import { HEALTH_SUPPLY } from "../src/data/pickups";
import { combatantById } from "../src/data/combatants";
import { upgradeById } from "../src/data/upgrades";
import { WEAPONS } from "../src/data/weapons";

function run(seed: number) {
  const world = new World(AIRFRAMES[0], seed, { director: false, supply: false });
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

  it("skips a disabled front part and hits the next part behind it", () => {
    const entity = {
      x: 0,
      z: 0,
      heading: 0,
      parts: [
        { id: "front", kind: "gun", slot: "nose" as const, x: 0, z: 1, radius: 0.5, health: 0, maxHealth: 10, destroyed: false, state: "disabled" as const, weight: 0, addedMass: 0 },
        { id: "rear", kind: "body", slot: "center" as const, x: 0, z: 0, radius: 0.5, health: 10, maxHealth: 10, destroyed: false, state: "intact" as const, weight: 0, addedMass: 0 },
      ],
    };
    expect(hitEntity(entity, { prevX: 0, prevZ: -2, x: 0, z: 2 })?.part.id).toBe("rear");
  });

  it("repairs body segments by deterministic priority", () => {
    const world = new World(AIRFRAMES[0], 42, { director: false, supply: false });
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

  it("keeps player and NPC actors in one combat collection with mounted weapons", () => {
    const world = new World(AIRFRAMES[0], 42, { director: false, supply: false });
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
    const pioneer = new World(airframeById("sparrow_05"), 42, { director: false });
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
    const world = new World(airframeById("sparrow_05"), 43, { supply: false });
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
    const world = new World(airframeById("swift_01"), 42, { director: false });
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
    const world = new World(airframeById("sparrow_05"), 42, { director: false });
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
    const world = new World(airframeById("kestrel_08"), 42, { director: false });
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
    const world = new World(airframeById("sparrow_05"), 42, { director: false, supply: false });
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
    expect(world.bombs[0].startY).toBe(RULES.flightAltitude);
  });

  it("offers an opening pair of repair kits and keeps the field cap", () => {
    const world = new World(airframeById("sparrow_05"), 42, { director: false, supply: true });
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
      const world = new World(airframeById("swift_01"), 42, { director: false });
      world.enemies = [];
      const controller = new NetworkController();
      controller.push({ time: 1.5, intent: playerIntent({ heading: Math.PI / 2, throttle: .8 }) });
      controller.push({ time: 0, intent: playerIntent({ heading: Math.PI, throttle: .4, fire: true }) });
      const enemy = world.spawnReplayOpponent(airframeById("swift_01"), controller, 0, 24);
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
