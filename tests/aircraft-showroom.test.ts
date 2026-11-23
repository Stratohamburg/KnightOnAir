import { describe, expect, it } from "vitest";
import { airframeById } from "../src/data/aircrafts";
import { upgradeById } from "../src/data/upgrades";
import { World } from "../src/simulation/World";

const upgrade = (id: string) => {
  const value = upgradeById(id);
  if (!value) throw new Error(`missing upgrade ${id}`);
  return value;
};

describe("showroom refit builds", () => {
  it("replays an asymmetric six-station Mastodon build from ordered cards", () => {
    const world = new World(airframeById("mastodon_03"), 7, {
      director: false,
      supply: false,
      showroom: true,
    });
    const rightWing = world.player.parts.find((part) => part.id === "right_wing")!;
    const rightWingX = rightWing.x;

    world.installUpgrade(upgrade("left_wing_segment"));
    world.installUpgrade(upgrade("left_wing_segment"));
    world.installUpgrade(upgrade("tail_side_bay"));
    world.installUpgrade(upgrade("quick_feed"));

    expect(world.player.weapons).toHaveLength(6);
    expect(world.player.stats.fireRate).toBeCloseTo(1.15);
    expect(world.player.parts.filter((part) => part.id.startsWith("left_wing_segment_")).length).toBe(2);
    expect(world.player.parts.filter((part) => part.id.startsWith("tail_side_bay_")).length).toBe(1);
    expect(world.player.parts.find((part) => part.id.startsWith("left_wing_segment_2_"))?.parentId).toContain("left_wing_segment_1_");
    expect(rightWing.x).toBe(rightWingX);
    expect(world.legalUpgradeOptions.some((candidate) => candidate.id === "left_wing_segment")).toBe(false);
  });

  it("keeps the battle rate multiplier on mounts added after the card", () => {
    const world = new World(airframeById("mastodon_03"), 8, { director: false, supply: false, showroom: true });
    world.installUpgrade(upgrade("quick_feed"));
    world.installUpgrade(upgrade("left_wing_segment"));
    expect(world.player.stats.fireRate).toBeCloseTo(1.15);
    expect(world.player.weapons.at(-1)?.config.fireRate).toBeGreaterThan(0);
    expect(world.player.weapons.every((weapon) => 1 / (weapon.config.fireRate * world.player.stats.fireRate) < 1 / weapon.config.fireRate)).toBe(true);
  });

  it("keeps showroom fire as a mount preview without battle actors", () => {
    const world = new World(airframeById("mastodon_03"), 9, { director: false, supply: false, showroom: true });
    world.previewFire();
    const events = world.consumeEvents();
    expect(world.enemies).toHaveLength(0);
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((event) => event.type === "weapon_fired")).toBe(true);
  });
});
