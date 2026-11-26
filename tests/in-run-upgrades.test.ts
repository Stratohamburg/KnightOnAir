import { describe, expect, it } from "vitest";
import { Box3 } from "three";
import { ProceduralAircraft } from "../src/content/3d/AircraftFactory";
import { airframeById, eraOf } from "../src/data/aircrafts";
import { FOKKER_UPGRADES, HO229_UPGRADES, UPGRADES, upgradeById, upgradeConfigDiagnostics, upgradePrice, validateUpgrade } from "../src/data/upgrades";
import { World } from "../src/simulation/World";
import { lineExtension } from "../src/simulation/CenterlineLayout";
import { weaponCapacity } from "../src/simulation/RefitRules";
import { heavyJet } from "./fixtures/simulationFrames";

describe("in-run upgrade configuration", () => {
  it("rejects invalid prices, dimensions, limits, capacity, and references", () => {
    const upgrade = upgradeById("left_wing_segment")!;
    expect(validateUpgrade({ ...upgrade, price: Infinity, stackLimit: 0, structureLength: -1,
      capacityContribution: 0, requires: ["missing"], weapons: ["unknown"] })).toEqual([
      "invalid upgrade price", "invalid upgrade stack limit", "invalid structure length",
      "invalid weapon capacity contribution", "invalid dependency missing", "unknown weapon unknown",
    ]);
    expect(upgradeConfigDiagnostics([{ ...heavyJet, upgradeStackLimits: { missing: 10, radiator: 0 } }]))
      .toContainEqual({ id: heavyJet.id, errors: ["invalid stack limit for missing", "invalid stack limit for radiator"] });
  });
  it("resolves a positive coin price for every enabled upgrade", () => {
    for (const upgrade of [...UPGRADES, ...FOKKER_UPGRADES, ...HO229_UPGRADES]) {
      const price = upgradePrice(upgrade);
      expect(Number.isSafeInteger(price), upgrade.id).toBe(true);
      expect(price, upgrade.id).toBeGreaterThan(0);
      expect(upgradePrice({ ...upgrade, price: 17 })).toBe(17);
    }
  });

  it("uses installed counts for default and airframe-specific stacks and single-use modifiers", () => {
    const world = new World({ ...heavyJet, upgradeStackLimits: { radiator: 2 } }, 7);
    const legal = (id: string) => world.legalUpgradeOptions.some(upgrade => upgrade.id === id);
    const install = (id: string) => world.installUpgrade(upgradeById(id)!);
    install("radiator");
    expect(legal("radiator")).toBe(true);
    install("radiator");
    expect(legal("radiator")).toBe(false);
    expect(world.player.parts.filter(part => part.id.startsWith("radiator_"))).toHaveLength(2);
    for (let count = 0; count < 9; count++) install("quick_feed");
    expect(legal("quick_feed")).toBe(true);
    install("quick_feed");
    expect(legal("quick_feed")).toBe(false);
    install("twin_mount");
    expect(legal("twin_mount")).toBe(false);
  });

  it.each(["left", "right"] as const)("extends the Dr.I lower %s wing one metre per segment", side => {
    const world = new World(airframeById("heron_09"), 7, { showroom: true });
    const upgrade = FOKKER_UPGRADES.find(upgrade => upgrade.id === side + "_wing_segment")!;
    const outerX = (parts: typeof world.player.parts) => Math.max(...parts.flatMap(part =>
      (part.silhouette ?? []).flat().map(point => Math.abs(point.x))));
    const onLowerWing = (part: typeof world.player.parts[number]) => part.centerline?.lineId === side + "-wing-0";
    const baseline = outerX(world.player.parts.filter(onLowerWing));
    const baseMounts = world.player.weapons.length;
    for (let count = 1; count <= 10; count++) {
      expect(world.legalUpgradeOptions).toContain(upgrade);
      world.installUpgrade(upgrade);
      expect(lineExtension(world.player.parts, side + "-wing-0")).toBeCloseTo(count);
      expect(outerX(world.player.parts.filter(onLowerWing)) - baseline).toBeCloseTo(count);
    }
    const addedWeapons = world.player.weapons.slice(baseMounts);
    expect(addedWeapons).toHaveLength(10);
    expect(new Set(addedWeapons.map(weapon => weapon.anchorId)).size).toBe(10);
    expect(new Set(addedWeapons.map(weapon => weapon.partId)).size).toBe(10);
    expect(weaponCapacity({ ...world.player, era: eraOf(world.player.frame) })).toBe(world.player.frame.hardpoints + 10);
    expect(world.legalUpgradeOptions).not.toContain(upgrade);
    const aircraft = new ProceduralAircraft(world.player);
    try {
      const outline = new Box3().setFromObject(aircraft.group, true);
      expect(side === "left" ? -outline.min.x : outline.max.x).toBeCloseTo(baseline + 10, 1);
    } finally {
      aircraft.dispose();
      world.dispose();
    }
  });
});

it("projects candidate switches without mutating the current player or run funds", () => {
  const world = new World(airframeById("heron_09"), 7, { showroom: true });
  world.upgradesAvailable = 2;
  world.coins = 15;
  world.openUpgrades();
  const player = structuredClone(world.player);
  const wing = world.choices[2];
  expect(world.selectUpgrade(wing.id)).toBe(true);
  expect(world.upgradePreview?.partIds).toHaveLength(1);
  expect(world.upgradePreview?.mountIds).toHaveLength(1);
  expect(world.selectUpgrade("quick_feed")).toBe(true);
  expect(world.selectedUpgradeId).toBe("quick_feed");
  expect(world.upgradePreview?.player.stats.fireRate).toBeCloseTo(player.stats.fireRate * 1.15);
  expect(world.upgradePreview?.partIds).toEqual([]);
  expect(world.player).toEqual(player);
  expect(world.coins).toBe(15);
  expect(world.upgradesAvailable).toBe(2);
});

it("rejects insufficient funds, preserves offers on return and emits each installation once", () => {
  const world = new World(airframeById("heron_09"), 7, { showroom: true });
  world.upgradesAvailable = 2;
  world.openUpgrades();
  const choices = world.choices.map(choice => choice.id);
  const upgrade = world.choices[2];
  const price = upgradePrice(upgrade);
  world.selectUpgrade(upgrade.id);
  const player = structuredClone(world.player);
  expect(world.confirmUpgrade()).toBe(false);
  expect(world.player).toEqual(player);
  expect(world.upgradesAvailable).toBe(2);
  expect(world.coins).toBe(0);
  expect(world.phase).toBe("upgrade");
  expect(world.returnFromUpgrade()).toBe(true);
  world.coins = price;
  world.openUpgrades();
  expect(world.choices.map(choice => choice.id)).toEqual(choices);
  world.selectUpgrade(upgrade.id);
  const partIds = world.upgradePreview!.partIds;
  const mountIds = world.upgradePreview!.mountIds;
  expect(world.confirmUpgrade()).toBe(true);
  expect(world.coins).toBe(0);
  expect(world.upgradesAvailable).toBe(1);
  expect(world.confirmUpgrade()).toBe(false);
  world.frame(.1);
  expect(world.elapsed).toBe(0);
  expect(world.phase).toBe("upgrade");
  expect(world.consumeEvents()).toEqual([expect.objectContaining({
    type: "upgrade_installed", upgradeId: upgrade.id, partIds, mountIds,
    animation: "extension", pose: world.actorPose(world.player),
  })]);
  expect(world.consumeEvents()).toEqual([]);
  expect(world.finishUpgradeInstallation()).toBe(true);
  expect(world.phase).toBe("battle");
});

it("rejects a stale offer without spending and preserves damage on a subsequent refit", () => {
  const frame = { ...airframeById("heron_09"), upgradeStackLimits: { quick_feed: 1 } };
  const world = new World(frame, 7, { showroom: true });
  world.upgradesAvailable = 1;
  world.coins = 20;
  world.openUpgrades();
  world.selectUpgrade("quick_feed");
  world.installUpgrade(upgradeById("quick_feed")!);
  const damaged = world.player.parts[0];
  damaged.health /= 4;
  damaged.state = "critical";
  const before = structuredClone(world.player);
  expect(world.confirmUpgrade()).toBe(false);
  expect(world.player).toEqual(before);
  expect(world.coins).toBe(20);
  expect(world.choices.some(choice => choice.id === "quick_feed")).toBe(false);
  world.choices[0] = FOKKER_UPGRADES.find(upgrade => upgrade.id === "left_wing_segment")!;
  world.selectUpgrade(world.choices[0].id);
  expect(world.confirmUpgrade()).toBe(true);
  expect(world.player.parts.find(part => part.id === damaged.id))
    .toMatchObject({ health: damaged.health, maxHealth: damaged.maxHealth, state: "critical" });
  const wing = world.player.parts.at(-1)!;
  expect(wing.health).toBe(wing.maxHealth);
  expect(world.player.hitExtent).toBeGreaterThan(before.hitExtent);
});

it("replays identical offers, payments and ten consecutive wing installations", () => {
  const replay = () => {
    const world = new World(airframeById("heron_09"), 7, { showroom: true });
    world.coins = 100;
    world.upgradesAvailable = 10;
    const wing = FOKKER_UPGRADES.find(upgrade => upgrade.id === "left_wing_segment")!;
    const offers: string[][] = [];
    for (let index = 0; index < 10; index++) {
      expect(world.openUpgrades()).toBe(true);
      offers.push(world.choices.map(choice => choice.id));
      if (!world.choices.includes(wing)) world.choices[2] = wing;
      expect(world.selectUpgrade(wing.id)).toBe(true);
      expect(world.confirmUpgrade()).toBe(true);
      world.finishUpgradeInstallation();
    }
    const events = world.consumeEvents();
    expect(events).toHaveLength(10);
    expect(new Set(events.flatMap(event => event.type === "upgrade_installed" ? event.mountIds : [])).size).toBe(10);
    expect(world.coins).toBe(100 - upgradePrice(wing) * 10);
    return { offers, coins: world.coins, stats: world.player.stats, events };
  };
  expect(replay()).toEqual(replay());
});
