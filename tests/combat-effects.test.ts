import { describe, expect, it, vi } from "vitest";
import { InstancedMesh, Matrix4, PerspectiveCamera, Scene, Vector3 } from "three";
import { CombatEffects } from "../src/content/fx/CombatEffects";
import { engineOutlet, localToWorld } from "../src/content/3d/anchors";
import { partFromRecipe } from "../src/simulation/parts";
import type { CombatSnapshot, WorldEvent } from "../src/simulation/types";
import { GameAudio } from "../src/services/Audio";

const snapshot: CombatSnapshot = {
  position: { x: 2, y: 25, z: 3 },
  direction: { x: 0, y: 0, z: 1 },
  velocity: { x: 7, y: 0, z: -2 },
  heading: .63, bank: -.71, damageType: "kinetic", weaponId: "light_cannon",
};

function position(batch: InstancedMesh, index = 0) {
  const matrix = new Matrix4();
  batch.getMatrixAt(index, matrix);
  return new Vector3().setFromMatrixPosition(matrix);
}

describe("combat effect lifetimes", () => {
  it("throttles fire and impact cues independently by their combat categories", () => {
    const audio = new GameAudio();
    const play = vi.spyOn(audio, "play").mockImplementation(() => {});
    const shot: WorldEvent = { type: "weapon_fired", time: 0, owner: "player", entityId: "player", anchorId: "test", snapshot };
    const hit: WorldEvent = { type: "enemy_hit", time: 0, enemyId: 3, amount: 10, snapshot };
    const missile: WorldEvent = { ...shot, snapshot: { ...snapshot, weaponId: "lock_missile", damageType: "explosive" } };
    audio.consumeBattle([shot, hit, shot, hit, missile, { ...hit, snapshot: missile.snapshot }]);
    audio.consumeBattle([{ ...shot, time: .07 }, { ...shot, time: .21 }]);
    expect(play.mock.calls.flat()).toEqual(["cannon", "impact", "missile", "explosiveImpact", "cannon"]);
    audio.resetBattle();
    audio.consumeBattle([shot]);
    expect(play).toHaveBeenCalledTimes(6);
  });
  it("keeps impacts when firing saturates the pools and recycles expired slots", () => {
    const scene = new Scene();
    const effects = new CombatEffects(scene);
    const camera = new PerspectiveCamera();
    const shot: WorldEvent = { type: "weapon_fired", time: 0, owner: "player", entityId: "player", anchorId: "test", snapshot };
    const impact: WorldEvent = { type: "enemy_hit", time: 0, enemyId: 12, amount: 7,
      snapshot: { ...snapshot, position: { x: 9, y: 25, z: 9 } } };
    effects.update(0, camera, "standard", [], undefined, [...Array<WorldEvent>(200).fill(shot), impact]);
    const stats = effects.diagnostics;
    expect(stats.pools.flashes.active).toBe(stats.pools.flashes.capacity);
    expect(stats.pools.flashes.dropped).toBeGreaterThan(0);
    expect(stats.pools.flashes.recycled).toBeGreaterThan(0);
    const flashes = scene.children[0] as InstancedMesh;
    expect(Array.from({ length: flashes.count }, (_, i) => position(flashes, i).x)).toContain(9);
    effects.update(2, camera, "standard", []);
    effects.update(0, camera, "standard", [], undefined, [impact]);
    expect(effects.diagnostics.pools.smoke.recycled).toBeGreaterThan(0);
    expect(effects.diagnostics.pools.debris.recycled).toBeGreaterThan(0);
    effects.reset();
    effects.update(0, camera, "low", [], undefined, [impact]);
    expect(effects.diagnostics.pools.flashes.active).toBe(1);
    expect(effects.diagnostics.pools.smoke.active).toBe(1);
    expect(effects.diagnostics.pools.sparks.active).toBeLessThan(5);
    expect(effects.diagnostics.dynamicGpuCreations).toBe(0);
    effects.dispose();
  });
  it("holds contact smoke at the world position, then drifts, expires and resets", () => {
    const scene = new Scene();
    const camera = new PerspectiveCamera();
    const effects = new CombatEffects(scene);
    const smoke = scene.children[4] as InstancedMesh;
    const wind = { sample: () => ({ x: 2, z: -1 }) };
    effects.update(0, camera, "standard", [], wind, [
      { type: "enemy_hit", time: 0, enemyId: 123, amount: 7, snapshot },
    ]);
    expect(smoke.count).toBe(2);
    expect(position(smoke).toArray()).toEqual([2, 25, 3]);
    effects.update(.2, camera, "standard", [], wind);
    effects.update(0, camera, "standard", [], wind);
    expect(position(smoke).toArray()).toEqual([2, 25, 3]);
    effects.update(.22, camera, "standard", [], wind);
    expect(position(smoke).x).toBeGreaterThan(2);
    expect(position(smoke).y).toBeGreaterThan(25);
    effects.update(1, camera, "standard", [], wind);
    expect(smoke.count).toBe(0);
    effects.reset();
    expect(effects.active).toBe(0);
    effects.dispose();
    expect(scene.children).toHaveLength(0);
  });

  it("uses the rolled engine outlet and advances detached parts without their actor", () => {
    const scene = new Scene();
    const camera = new PerspectiveCamera();
    const effects = new CombatEffects(scene);
    const { heading, bank } = snapshot;
    const pose = { ...snapshot.position, heading, bank, vx: 7, vz: -2 };
    const engine = partFromRecipe("engine", { kind: "engine", x: 1, z: -.6, health: 20 });
    engine.health = 4;
    const smoke = scene.children[4] as InstancedMesh;
    const detached = scene.children[6] as InstancedMesh;
    const event: WorldEvent = { type: "part_detached", time: 0, owner: "enemy", entityId: 42,
      partId: "wing_tip", partKind: "wing", color: "#624437", snapshot };
    effects.update(.01, camera, "standard", [], undefined, [event], [{ id: 42, pose, parts: [engine] }]);
    const outlet = localToWorld(pose, engineOutlet(engine));
    expect(position(smoke).toArray()).toEqual([outlet.x, outlet.y, outlet.z].map((value) => expect.closeTo(value, 5)));
    expect(position(detached).toArray()).toEqual([2, 25, 3]);
    effects.update(.5, camera, "standard", []);
    expect(smoke.count).toBe(1);
    expect(position(detached).x).toBeCloseTo(5.5);
    expect(position(detached).y).toBeLessThan(25);
    effects.dispose();
  });
});
