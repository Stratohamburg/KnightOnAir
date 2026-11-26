import { Box3, PerspectiveCamera, Scene, Vector3 } from "three";
import { describe, expect, it, vi } from "vitest";
import { ProceduralAircraft } from "../src/content/3d/AircraftFactory";
import { ContentCatalog } from "../src/content/3d/ContentCatalog";
import { CombatEffects } from "../src/content/fx/CombatEffects";
import { airframeById } from "../src/data/aircrafts";
import { RULES } from "../src/data/config";
import { frameBattleCamera, UpgradeCamera } from "../src/rendering/BattleCamera";
import { UpgradeAircraft, UpgradePartMotion, upgradeInstallSeconds } from "../src/rendering/UpgradeAircraft";
import { GameAudio } from "../src/services/Audio";
import { World } from "../src/simulation/World";
import type { UpgradeInstalledEvent } from "../src/simulation/types";

function firstRefit() {
  const world = new World(airframeById("heron_09"), 7, { showroom: true });
  world.upgradesAvailable = 10;
  world.coins = 100;
  world.openUpgrades();
  const wing = world.choices[2];
  world.selectUpgrade(wing.id);
  return { world, wing };
}

describe("refit aircraft presentation", () => {
  it("replaces previews by identity and releases their resources on switch and install", () => {
    const { world, wing } = firstRefit();
    const catalog = new ContentCatalog();
    const scene = new Scene();
    const live = new ProceduralAircraft(world.player, catalog);
    scene.add(live.group);
    const preview = new UpgradeAircraft(scene, catalog);
    const resources = () => {
      const { geometries, materials, textures } = catalog.stats;
      return { geometries, materials, textures };
    };
    const baseline = resources();
    const projection = world.upgradePreview!;
    const model = preview.show(projection, live);
    expect(model).toBe(preview.show(projection, live));
    expect(model.actor).toEqual(projection.player);
    expect(model.partNode(projection.partIds[0])).toBeDefined();
    expect(live.group.visible).toBe(false);
    const previewResources = resources();
    const materialCount = model.materialCount;
    for (let index = 0; index < 8; index++) {
      world.selectUpgrade("quick_feed");
      preview.show(world.upgradePreview, live);
      expect(model.materialCount).toBe(0);
      world.selectUpgrade(wing.id);
      expect(preview.show(world.upgradePreview, live).materialCount).toBe(materialCount);
      expect(resources()).toEqual(previewResources);
      expect(scene.children).toHaveLength(2);
    }
    world.confirmUpgrade();
    expect(preview.show(world.upgradePreview, live)).toBe(live);
    expect(scene.children).toHaveLength(1);
    expect(resources()).toEqual(baseline);
    live.update(0, 0);
    expect(live.partNode(projection.partIds[0])).toBeDefined();
    live.dispose();
    expect(resources()).toEqual({ geometries: 0, materials: 0, textures: 0 });
  });

  it("moves only the new wing node outward, scales it, and restores its anchor after settling", () => {
    const { world, wing } = firstRefit();
    world.confirmUpgrade();
    const initialEvent = world.upgradeInstallation!;
    world.finishUpgradeInstallation();
    world.openUpgrades();
    if (!world.choices.includes(wing)) world.choices[2] = wing;
    world.selectUpgrade(wing.id);
    world.confirmUpgrade();
    const next = world.upgradeInstallation!;
    const model = new ProceduralAircraft(world.player);
    try {
      const firstNode = model.partNode(initialEvent.partIds[0])!;
      const oldPosition = firstNode.position.clone();
      const node = model.partNode(next.partIds[0])!;
      const finalPosition = node.position.clone();
      const part = world.player.parts.find(candidate => candidate.id === next.partIds[0])!;
      const anchorX = () => node.position.x + (part.x - finalPosition.x) * node.scale.x;
      const motion = new UpgradePartMotion(model, next);
      motion.update(0);
      const start = anchorX();
      expect(node.scale.x).toBeLessThan(.15);
      motion.update(upgradeInstallSeconds * .33);
      expect(Math.sign(anchorX() - start)).toBe(wing.id.startsWith("left") ? -1 : 1);
      motion.update(upgradeInstallSeconds * .84);
      expect(node.scale.x).toBeGreaterThan(1);
      motion.update(upgradeInstallSeconds);
      expect(node.position.distanceTo(finalPosition)).toBeLessThan(1e-7);
      expect(node.scale.x).toBeCloseTo(1);
      expect(firstNode.position).toEqual(oldPosition);
    } finally {
      model.dispose();
    }
  });

  it("delivers ten queued impacts once and keeps the low quality effect bounded", () => {
    const { world, wing } = firstRefit();
    const events: UpgradeInstalledEvent[] = [];
    world.confirmUpgrade();
    for (let index = 0; index < 10; index++) {
      events.push(world.upgradeInstallation!);
      world.finishUpgradeInstallation();
      if (index === 9) break;
      world.openUpgrades();
      if (!world.choices.includes(wing)) world.choices[2] = wing;
      world.selectUpgrade(wing.id);
      world.confirmUpgrade();
    }
    const audio = new GameAudio();
    const play = vi.spyOn(audio, "play");
    audio.consumeBattle(events);
    expect(play).toHaveBeenCalledTimes(10);
    const camera = new PerspectiveCamera();
    const sources = [{ id: "player", pose: world.actorPose(world.player), parts: world.player.parts }];
    const high = new CombatEffects(new Scene());
    const low = new CombatEffects(new Scene());
    try {
      high.update(0, camera, "high", [], undefined, events, sources, [], { refitDt: .3 });
      low.update(0, camera, "low", [], undefined, events, sources, [], { refitDt: .3 });
      expect(high.diagnostics.pools.refitGlow.active).toBe(10);
      expect(low.diagnostics.pools.refitGlow.active).toBe(10);
      expect(high.diagnostics.pools.refitSparks.active).toBeGreaterThan(0);
      expect(low.diagnostics.pools.refitSparks.active).toBe(0);
      low.update(0, camera, "low", [], undefined, [], sources, [], { refitDt: .5 });
      expect(low.diagnostics.pools.refitGlow.active).toBe(0);
    } finally {
      high.dispose();
      low.dispose();
    }
  });
});

describe("upgrade camera", () => {
  it.each([[360, 640], [390, 844], [430, 932], [1440, 900]])("frames edge refits and returns smoothly at %i×%i", (width, height) => {
    for (const bombing of [0, 1]) {
      const camera = new PerspectiveCamera(48, width / height);
      const upgrade = new UpgradeCamera();
      const y = RULES.flightAltitude;
      const base = new Box3(new Vector3(-3, y - 1, -3), new Vector3(3, y + 1, 3));
      const extent = new Box3(new Vector3(-14, y - 1, -3), new Vector3(3, y + 1, 3));
      const affected = new Box3(new Vector3(-14, y - .3, -1), new Vector3(-13, y + .3, 1));
      const frame = (dt: number, aircraft?: Box3, part = new Box3()) => {
        frameBattleCamera(camera, 0, 0, bombing);
        upgrade.update(camera, 0, 0, dt, aircraft ? { aircraft, affected: part } : undefined);
      };
      frame(0);
      const initial = camera.position.clone();
      const orientation = camera.quaternion.clone();
      frame(0, base);
      expect(camera.position.distanceTo(initial)).toBeLessThan(1e-7);
      for (let index = 0; index < 90; index++) frame(1 / 60, base);
      const smallDistance = camera.position.distanceTo(new Vector3(0, y, 0));
      const old = camera.position.clone();
      frame(0, extent, affected);
      expect(camera.position.distanceTo(old)).toBeLessThan(1e-7);
      for (let index = 0; index < 90; index++) frame(1 / 60, extent, affected);
      const center = affected.getCenter(new Vector3()).project(camera);
      expect(Math.abs(center.x)).toBeLessThan(.95);
      expect(center.y).toBeGreaterThan(-1 / 3);
      expect(camera.position.distanceTo(new Vector3(0, y, 0))).toBeGreaterThanOrEqual(smallDistance);
      const zoomed = camera.position.clone();
      frame(0);
      expect(camera.position.distanceTo(zoomed)).toBeLessThan(1e-7);
      for (let index = 0; index < 90; index++) frame(1 / 60);
      expect(camera.position.distanceTo(initial)).toBeCloseTo(0, 4);
      expect(camera.quaternion.angleTo(orientation)).toBeCloseTo(0, 5);
    }
  });
});
