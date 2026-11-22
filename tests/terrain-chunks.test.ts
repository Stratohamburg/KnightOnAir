import * as THREE from "three";
import { expect, it } from "vitest";
import { TerrainChunks } from "../src/rendering/TerrainChunks";
import { isWater, riverZ, sampleTerrain, surfaceHeight, TERRAIN } from "../src/simulation/Terrain";

it("keeps the simulated water surface above the rendered river bed", () => {
  const seed = 491;
  const x = -30;
  const z = riverZ(x, seed);
  const river = sampleTerrain(x, z, seed);
  expect(river.bedHeight).toBeLessThan(TERRAIN.waterLevel);
  expect(river.height).toBe(TERRAIN.waterLevel);
  expect(surfaceHeight(x, z, seed)).toBe(river.height);
  expect(isWater(x, z, seed)).toBe(true);

  const ridge = sampleTerrain(-49, 53, seed);
  expect(ridge.bedHeight).toBe(ridge.height);
  expect(ridge.height).toBeGreaterThan(river.height + 8);
});

it("aligns the terrain and water mesh across streaming boundaries", () => {
  const scene = new THREE.Scene();
  const groundMaterial = new THREE.ShaderMaterial();
  const terrain = new TerrainChunks(scene, groundMaterial, 491, {});
  try {
    terrain.update(0, 0);
    const meshes = scene.children.filter((child): child is THREE.Mesh<THREE.BufferGeometry> =>
      child instanceof THREE.Mesh && !(child instanceof THREE.InstancedMesh));
    const origin = meshes.find((mesh) => mesh.material === groundMaterial && mesh.position.lengthSq() === 0)!;
    const east = meshes.find((mesh) => mesh.material === groundMaterial && mesh.position.x === TERRAIN.chunk && mesh.position.z === 0)!;
    const bed = origin.geometry.attributes.position;
    const eastBed = east.geometry.attributes.position;
    const segments = TERRAIN.segments;
    for (let row = 0; row <= segments; row++) {
      expect(bed.getY(row * (segments + 1) + segments)).toBe(eastBed.getY(row * (segments + 1)));
    }

    const water = meshes.find((mesh) => mesh.material !== groundMaterial && mesh.geometry.attributes.position === bed)!;
    const index = water.geometry.index!;
    expect(index.count).toBeGreaterThan(0);
    for (let offset = 0; offset < index.count; offset += 3) {
      const depth = Math.min(bed.getY(index.getX(offset)), bed.getY(index.getX(offset + 1)), bed.getY(index.getX(offset + 2)));
      expect(depth).toBeLessThan(TERRAIN.waterLevel);
    }

    terrain.update(TERRAIN.chunk, 0);
    expect(scene.children).toContain(origin);
    expect(scene.children).toContain(water);
  } finally {
    terrain.dispose();
    groundMaterial.dispose();
  }
  expect(scene.children).toHaveLength(0);
});
