import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { QUALITIES } from "../src/data/config";
import { CloudField } from "../src/rendering/CloudField";
import { surfaceHeight } from "../src/simulation/Terrain";

function puffGroups(scene: THREE.Scene) {
  return scene.children.filter((child): child is THREE.Group => child instanceof THREE.Group);
}

describe("cloud field", () => {
  it("allocates the configured counts and reproduces cloud transforms and tint", () => {
    const scenes = [new THREE.Scene(), new THREE.Scene()];
    const fields = scenes.map((scene) => new CloudField(scene, 491));
    for (const [quality, count] of [["low", 4], ["standard", 7], ["high", 10]] as const) {
      const snapshots = fields.map((field, index) => {
        field.setQuality(quality);
        field.update(7.25, 12, -34);
        const active = puffGroups(scenes[index]).filter((group) => group.visible);
        expect(active).toHaveLength(count);
        return active.map((group) => ({
          position: group.position.toArray(),
          puffs: group.children.map((child) => {
            const batch = child as THREE.InstancedMesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
            expect(batch.material.uniforms.time.value).toBe(7.25);
            expect(new Set(batch.instanceColor?.array).size).toBeGreaterThan(1);
            return [batch.instanceMatrix.array, batch.instanceColor?.array];
          }),
        }));
      });
      expect(snapshots[0]).toEqual(snapshots[1]);
    }
    fields.forEach((field) => field.dispose());
  });

  it("changes puff and shell budgets in place", () => {
    const scene = new THREE.Scene();
    const field = new CloudField(scene);
    const resources = puffGroups(scene)[0].children as THREE.InstancedMesh<THREE.BufferGeometry, THREE.ShaderMaterial>[];
    const geometries = resources.map((mesh) => mesh.geometry);
    const materials = resources.map((mesh) => mesh.material);
    for (const quality of ["low", "high", "standard", "low"] as const) {
      field.setQuality(quality);
      expect(resources.reduce((count, mesh) => count + mesh.count, 0)).toBe(QUALITIES[quality].cloud.puffs);
      expect(resources[0].material.uniforms.shell.value).toBe(Number(QUALITIES[quality].cloud.shell));
      resources.forEach((mesh, index) => {
        expect(mesh.geometry).toBe(geometries[index]);
        expect(mesh.material).toBe(materials[index]);
      });
    }
    field.dispose();
  });

  it("attaches each cloud shadow to the final surface at its offset", () => {
    const clouds = new THREE.Scene();
    const world = new THREE.Scene();
    const field = new CloudField(clouds, 491, world);
    const shadows = world.children[0] as THREE.InstancedMesh;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    for (const quality of ["high", "low", "standard"] as const) {
      field.setQuality(quality);
      field.update(4, 12, 15, new THREE.Vector3(12, 40, -12));
      expect(world.children).toEqual([shadows]);
      expect(shadows.count).toBeGreaterThan(0);
      for (let index = 0; index < shadows.count; index++) {
        shadows.getMatrixAt(index, matrix);
        position.setFromMatrixPosition(matrix);
        expect(position.y).toBeCloseTo(surfaceHeight(position.x, position.z, 491) + .06, 4);
        expect(matrix.elements[5]).toBeCloseTo(0);
      }
    }
    field.dispose();
  });

  it("wraps deterministically around the player in both directions", () => {
    const scene = new THREE.Scene();
    const field = new CloudField(scene);
    const position = (playerX: number, playerZ: number) => {
      field.update(100_000, playerX, playerZ);
      return puffGroups(scene).map((group) => [group.position.x - playerX, group.position.z - playerZ]);
    };
    const first = position(-315, 208);
    const repeated = position(485, -432);
    for (let index = 0; index < first.length; index++) {
      expect(first[index][0]).toBeGreaterThanOrEqual(-80);
      expect(first[index][0]).toBeLessThan(80);
      expect(first[index][1]).toBeGreaterThanOrEqual(-80);
      expect(first[index][1]).toBeLessThan(80);
      expect(repeated[index][0]).toBeCloseTo(first[index][0]);
      expect(repeated[index][1]).toBeCloseTo(first[index][1]);
    }
    field.dispose();
  });
});
