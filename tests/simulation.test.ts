import { describe, expect, it } from "vitest";
import { AIRFRAMES, STARTER_FRAME_ID } from "../src/data/aircrafts";
import { RULES } from "../src/data/config";
import { UPGRADES, upgradeById } from "../src/data/upgrades";
import { WEAPONS } from "../src/data/weapons";
import { World, requiredXp } from "../src/simulation/World";
import { NO_INPUT, type Intent } from "../src/simulation/types";
import { SaveStore } from "../src/services/Save";

function advance(
  world: World,
  seconds: number,
  input: Intent = NO_INPUT,
  fps = 60,
) {
  for (let i = 0; i < Math.round(seconds * fps); i++)
    world.frame(1 / fps, input);
}
function fresh(seed = 42) {
  const w = new World(AIRFRAMES[0], seed, { director: false });
  w.player.invulnerable = 10000;
  return w;
}

describe("flight and clock", () => {
  it("maps heading without reversing instantly; coasts and recovers on release", () => {
    const w = fresh();
    advance(w, 2, { x: 1, z: 0, magnitude: 1, active: true });
    expect(w.player.heading).toBeCloseTo(Math.PI / 2, 1);
    expect(w.player.speed).toBeGreaterThan(w.player.frame.cruiseSpeed);
    const energy = w.player.energy,
      speed = w.player.speed,
      heading = w.player.heading;
    advance(w, 1);
    expect(w.player.energy).toBeCloseTo(energy);
    expect(w.player.speed).toBeLessThan(speed);
    expect(w.player.heading).toBeCloseTo(heading, 2);
    w.frame(1 / 60, { x: -1, z: 0, magnitude: 1, active: true });
    expect(w.player.heading).toBeGreaterThan(1);
  });
  it("produces the same simulation at 30, 60 and 120 render frames per second", () => {
    const worlds = [30, 60, 120].map((fps) => {
      const w = fresh();
      advance(w, 12, { x: 0.5, z: 1, active: true, magnitude: 0.8 }, fps);
      return w;
    });
    for (const w of worlds.slice(1)) {
      expect(w.player.x).toBeCloseTo(worlds[0].player.x, 7);
      expect(w.player.z).toBeCloseTo(worlds[0].player.z, 7);
      expect(w.player.energy).toBeCloseTo(worlds[0].player.energy, 7);
      expect(w.elapsed).toBeCloseTo(12, 5);
    }
  });
  it("freezes every simulation system during upgrade and preserves bombing mode", () => {
    const w = fresh();
    advance(w, 1);
    w.toggleBombing();
    w.awardXp(1000);
    expect(w.openUpgrades()).toBe(true);
    const before = JSON.stringify({
      player: w.player,
      enemies: w.enemies,
      bullets: w.projectiles.items,
      pickups: w.pickups.items,
      wind: w.wind,
      clock: w.elapsed,
      aim: w.aim,
    });
    advance(w, 10, { x: 1, z: 0, active: true, magnitude: 1 });
    expect(
      JSON.stringify({
        player: w.player,
        enemies: w.enemies,
        bullets: w.projectiles.items,
        pickups: w.pickups.items,
        wind: w.wind,
        clock: w.elapsed,
        aim: w.aim,
      }),
    ).toBe(before);
    expect(w.chooseUpgrade("not-a-choice")).toBe(false);
    const chosen = w.choices[0].id;
    expect(w.chooseUpgrade(chosen)).toBe(true);
    expect(w.phase).toBe("bombing");
    expect(w.player.upgrades).toContain(chosen);
    expect(w.clock.timeScale).toBe(1);
  });
  it("pauses on demand and does not accumulate a catch-up jump", () => {
    const w = fresh();
    advance(w, 1);
    w.pause();
    const time = w.elapsed;
    advance(w, 15);
    expect(w.elapsed).toBe(time);
    w.resume();
    w.frame(1 / 60);
    expect(w.elapsed - time).toBeCloseTo(1 / 60);
  });
});

describe("weapons, damage and bombing", () => {
  it("keeps player weapons on their configured mount direction without auto-targeting", () => {
    const w = fresh();
    w.enemies = [w.spawnEnemy("bomber", 0, 17)!];
    const p = w.player;
    advance(w, 0.5);
    expect(p.weapons.every((weapon) => weapon.targetId === 0)).toBe(true);
    expect(p.weapons.every((weapon) => weapon.lockProgress === 0)).toBe(true);
    const shots = w.projectiles.items.filter((projectile) => projectile.active && projectile.team === "player");
    expect(shots.length).toBeGreaterThan(0);
    expect(shots.every((projectile) => projectile.targetId === 0)).toBe(true);
    expect(w.telemetry.events.some((event) => event.type === "lock_start")).toBe(false);
  });
  it("uses swept projectile collision to prevent fast bullets passing through enemies", () => {
    const w = fresh();
    w.enemies = [];
    w.player.weapons = [];
    const target = w.spawnEnemy("hunter", 0, 6)!;
    w.shoot(
      0,
      0,
      0,
      { ...WEAPONS.light_cannon, speed: 1000, range: 100, damage: 500 },
      "player",
    );
    w.frame(1 / 60);
    expect(target.health).toBeLessThan(target.maxHealth);
    expect(target.parts.some((part) => part.state === "disabled")).toBe(true);
  });
  it("stabilizes only in bombing mode, locks an immutable landing point and enforces cooldown", () => {
    const w = fresh();
    expect(w.dropBomb()).toBe(false);
    w.toggleBombing();
    advance(w, 2);
    expect(w.canBomb).toBe(true);
    const target = w.spawnEnemy("depot", w.aim.x, w.aim.z)!;
    expect(w.dropBomb()).toBe(true);
    const landing = { x: w.bombs[0].x, z: w.bombs[0].z };
    expect(w.dropBomb()).toBe(false);
    expect(w.bombCooldown).toBeGreaterThan(0);
    advance(w, 0.4, { x: 1, z: 0, magnitude: 1, active: true });
    expect(w.bombs[0].x).toBe(landing.x);
    expect(w.bombs[0].z).toBe(landing.z);
    advance(w, 1.05);
    expect(target.health).toBeLessThan(target.maxHealth);
    expect(w.bombsHit).toBe(1);
    expect(w.bombs).toHaveLength(0);
    expect(w.phase).toBe("bombing");
  });
  it("removes a disabled engine contribution and deactivates a destroyed weapon mount", () => {
    const w = fresh();
    w.player.invulnerable = 0;
    const engine = w.player.parts.find((p) => p.kind === "engine")!;
    w.damagePlayer(50, engine.x, engine.z, "test");
    expect(engine.health).toBe(0);
    advance(w, 2, { x: 0, z: 1, magnitude: 1, active: true });
    expect(w.player.speed).toBeLessThanOrEqual(
      w.player.stats.maxSpeed * 0.75 + 0.01,
    );
    const nose = w.player.parts.find((p) => p.id === "nose")!;
    nose.health = 0;
    w.projectiles.clear();
    w.enemies = [];
    w.spawnEnemy("bomber", w.player.x, w.player.z + 15);
    advance(w, 0.3);
    expect(
      w.projectiles.items.filter((v) => v.active && v.team === "player"),
    ).toHaveLength(0);
  });
  it("enters a 1.2-second crash then a result state", () => {
    const w = new World(AIRFRAMES[0], 1);
    for (const part of w.player.parts) {
      w.player.invulnerable = 0;
      w.damagePlayer(part.maxHealth, w.player.x + part.x, w.player.z + part.z);
    }
    w.frame(1 / 60);
    expect(w.phase).toBe("dying");
    advance(w, 1.3);
    expect(w.phase).toBe("result");
    expect(w.clock.timeScale).toBe(0);
    expect(
      w.telemetry.events.filter((e) => e.type === "session_end"),
    ).toHaveLength(1);
  });
});

describe("progression and saves", () => {
  it("retains XP overflow, produces three unique legal candidates and consumes one pending upgrade", () => {
    const w = fresh();
    w.awardXp(requiredXp(1) + requiredXp(2) + 17);
    expect(w.level).toBe(3);
    expect(w.xp).toBe(17);
    expect(w.upgradesAvailable).toBe(2);
    w.installUpgrade(upgradeById("right_engine")!);
    w.openUpgrades();
    expect(new Set(w.choices.map((u) => u.id)).size).toBe(3);
    expect(
      w.choices.some((u) => ["right_engine", "dual_engine"].includes(u.id)),
    ).toBe(false);
    expect(w.chooseUpgrade(w.choices[0].id)).toBe(true);
    expect(w.upgradesAvailable).toBe(1);
  });
  it("keeps legal choices available after unique upgrades are exhausted", () => {
    const w = fresh();
    for (const u of UPGRADES.filter((u) => !u.max)) w.installUpgrade(u);
    w.upgradesAvailable = 1;
    w.openUpgrades();
    expect(w.choices).toHaveLength(3);
    expect(w.choices.every((u) => u.repeatable)).toBe(true);
  });
  it("makes heavy, light and asymmetric builds differ in stats, geometry recipes and collision zones", () => {
    const heavy = fresh(),
      light = fresh(),
      right = fresh();
    heavy.installUpgrade(upgradeById("giant_wing")!);
    light.installUpgrade(upgradeById("low_drag")!);
    right.installUpgrade(upgradeById("right_engine")!);
    expect(heavy.player.stats.wingspan).toBeGreaterThan(
      light.player.stats.wingspan,
    );
    expect(heavy.player.stats.turnRate).toBeLessThan(
      light.player.stats.turnRate,
    );
    expect(right.player.stats.leftTurn).toBeGreaterThan(
      right.player.stats.rightTurn,
    );
    expect(
      heavy.player.parts.find((p) => p.id === "left_wing")!.radius,
    ).toBeGreaterThan(
      light.player.parts.find((p) => p.id === "left_wing")!.radius,
    );
    expect(heavy.player.parts.some((p) => p.id.startsWith("giant_wing"))).toBe(
      true,
    );
  });
  it("repairs disabled and destroyed mounts without corrupting the base frame", () => {
    const w = fresh();
    const body = w.player.parts.find((p) => p.id === "center_body")!;
    const engine = w.player.parts.find((p) => p.kind === "engine")!;
    body.health = 0;
    body.state = "disabled";
    engine.health = 0;
    engine.state = "disabled";
    w.spawnPickup("repairSmall", w.player.x, w.player.z);
    w.frame(1 / 60);
    expect(body.health).toBeGreaterThan(0);
    expect(engine.health).toBe(0);
    expect(w.player.health).toBeGreaterThan(0);
    expect(AIRFRAMES[0].health).toBe(100);
  });
  it("saves unlocks, protects locked equipment, validates malformed data and tolerates unavailable storage", () => {
    let raw = "";
    const storage = {
      getItem: () => raw,
      setItem: (_: string, val: string) => {
        raw = val;
      },
    };
    const save = new SaveStore(storage);
    expect(save.equip("mastodon_03")).toBe(false);
    const w = fresh();
    w.score = 7600;
    w.coins = 23;
    advance(w, 1);
    w.end();
    save.record(w);
    expect(save.equip("mastodon_03")).toBe(true);
    const restored = new SaveStore(storage);
    expect(restored.data.equipped).toBe("mastodon_03");
    expect(restored.data.currency).toBe(w.coins);
    raw = "{bad json";
    expect(new SaveStore(storage).data.equipped).toBe(STARTER_FRAME_ID);
    raw =
      '{"version":1,"equipped":"unknown","unlocked":3,"currency":-50,"bestScore":"oops"}';
    const corrupt = new SaveStore(storage);
    expect(corrupt.data.currency).toBe(0);
    expect(corrupt.data.equipped).toBe(STARTER_FRAME_ID);
    const unavailable = new SaveStore({
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    });
    expect(() => unavailable.persist()).not.toThrow();
    expect(unavailable.available).toBe(false);
  });
});

describe("five-minute endurance", () => {
  it.each(AIRFRAMES)(
    "$name runs for five minutes with finite state, bounded pools and functioning encounters",
    (frame) => {
      const w = new World(frame, 123);
      w.player.invulnerable = 10000;
      let peak = 0;
      let peakEnemies = 0;
      for (let i = 0; i < 60 * 300; i++) {
        const angle = Math.sin(i / 1400) * 2.5;
        w.frame(1 / 60, {
          x: Math.sin(angle),
          z: Math.cos(angle),
          active: i % 300 < 180,
          magnitude: 0.7,
        });
        if (w.upgradesAvailable && w.openUpgrades())
          w.chooseUpgrade(w.choices[0].id);
        if (i % 600 === 0 && w.phase === "battle") w.toggleBombing();
        if (w.canBomb) w.dropBomb();
        if (w.phase === "bombing" && i % 600 === 400) w.toggleBombing();
        peakEnemies = Math.max(peakEnemies, w.enemies.length);
        peak = Math.max(
          peak,
          w.enemies.length +
            w.projectiles.count +
            w.pickups.count,
        );
        if (i % 600 === 0) {
          expect(
            Number.isFinite(
              w.player.x + w.player.z + w.player.energy + w.player.speed,
            ),
          ).toBe(true);
          expect(w.enemies.length).toBeLessThanOrEqual(
            RULES.maxTotal,
          );
        }
      }
      expect(w.elapsed).toBeCloseTo(300, 3);
      expect(w.phase).not.toBe("result");
      expect(peakEnemies).toBeGreaterThan(0);
      expect(w.level).toBeGreaterThanOrEqual(1);
      expect(peak).toBeLessThan(250);
      expect(w.telemetry.events.length).toBeLessThanOrEqual(500);
      if (frame.bomb || frame.missile)
        expect(w.telemetry.events.some((event) => event.type === "lock_fire" || event.type === "bomb_drop")).toBe(true);
      else if (!w.bombWeapon)
        expect(w.bombsDropped).toBe(0);
    },
  );
});
