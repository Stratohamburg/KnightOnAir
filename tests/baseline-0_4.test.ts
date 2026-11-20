import { describe, expect, it } from "vitest";
import { AIRFRAMES } from "../src/data/aircrafts";
import { hitEntity } from "../src/simulation/HitTest";
import { World } from "../src/simulation/World";

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
    const enemy = world.spawnEnemy("hunter", 0, 15)!;
    enemy.cooldown = 0;
    expect(world.actors.some((actor) => actor.id === "player")).toBe(true);
    expect(world.actors.some((actor) => actor.id === enemy.id)).toBe(true);
    expect(enemy.weapons[0].partId).toBe("center_body");
    const events = [] as ReturnType<World["consumeEvents"]>;
    for (let i = 0; i < 90; i++) {
      world.frame(1 / 60);
      events.push(...world.consumeEvents());
    }
    expect(events.some((event) => event.type === "enemy_fire")).toBe(true);
    expect(events.some((event) => event.type === "player_hit")).toBe(true);
  });
});
