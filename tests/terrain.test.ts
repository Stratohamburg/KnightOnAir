import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { placeTerrainLandmarks } from "../src/rendering/TerrainLandmarks";
import { terrainMaterial } from "../src/rendering/ShaderMaterials";
import {
  prepareTerrainChunk,
  riverZ,
  sampleTerrain,
  sampleTerrainStructure,
  surfaceHeight,
  terrainDerivationDiagnostics,
  terrainHeight,
  terrainStructureMetrics,
  TERRAIN,
} from "../src/simulation/Terrain";

describe("deterministic terrain relief", () => {
  it("exposes bounded, repeatable elevation and landform weights", () => {
    const points = [[0, 0], [-39, 2], [61, 35], [-30, riverZ(-30, 491) + 7]] as const;
    for (const [x, z] of points) {
      const first = sampleTerrain(x, z, 491);
      const second = sampleTerrain(x, z, 491);
      expect(second).toEqual(first);
      expect(first.elevation).toBeGreaterThanOrEqual(0);
      expect(first.elevation).toBeLessThanOrEqual(1);
      for (const weight of [
        first.lowlandWeight, first.valleyWeight, first.hillWeight, first.shoulderWeight,
        first.highlandWeight, first.meadowWeight, first.flowerWeight, first.wetlandWeight,
        first.sandWeight, first.rockWeight,
      ]) expect(weight).toBeGreaterThanOrEqual(0);
    }
  });

  it("keeps the final surface query shared by water and terrain consumers", () => {
    const shoreZ = Array.from({ length: 32 }, (_, offset) => riverZ(-30, 491) + offset)
      .find((z) => sampleTerrain(-30, z, 491).surface === "land" && sampleTerrain(-30, z, 491).shoreMask > 0)!;
    const shore = sampleTerrain(-30, shoreZ, 491);
    expect(surfaceHeight(-30, riverZ(-30, 491), 491)).toBe(TERRAIN.waterLevel);
    expect(terrainHeight(-39, 2, 491)).toBeGreaterThan(terrainHeight(0, 0, 491));
    expect(shore.surface).toBe("land");
    expect(shore.shoreMask).toBeGreaterThan(0);
    expect(shore.height).toBe(surfaceHeight(-30, shoreZ, 491));
  });

  it("has no seam at a streamed chunk boundary", () => {
    const x = TERRAIN.chunk / 2;
    for (const z of [-160, -80, 0, 80, 160]) {
      const left = sampleTerrain(x - .0001, z, 491);
      const right = sampleTerrain(x + .0001, z, 491);
      expect(Math.abs(left.height - right.height)).toBeLessThan(.05);
      expect(Math.abs(left.slopeX - right.slopeX)).toBeLessThan(.2);
    }
  });

  it("keeps the viewport fixture spatially anchored", () => {
    const first = placeTerrainLandmarks(0, 0, 491);
    const second = placeTerrainLandmarks(0, 0, 491);
    expect(second).toEqual(first);
    expect(new Set(first.map((item) => item.id)).size).toBe(first.length);
    expect(first.every((item) => item.y === surfaceHeight(item.x, item.z, 491))).toBe(true);

    const detail = new THREE.Texture();
    const material = terrainMaterial(detail);
    expect(material.vertexShader).toContain("landformWeights");
    expect(material.vertexShader).toContain("reliefWeights");
    expect(material.fragmentShader).toContain("vElevation");
    expect(material.fragmentShader).not.toContain("sceneTime");
    expect(material.fragmentShader).not.toContain("windDirection");
    material.dispose();
    detail.dispose();
  });

  it("keeps structured relief and bounded erosion derivation deterministic", () => {
    const structure = sampleTerrainStructure(-49, 53, 491);
    expect(sampleTerrainStructure(-49, 53, 491)).toEqual(structure);
    expect(structure.ridgeWeight).toBeGreaterThan(0);
    expect(structure.drainageOrder).toBeGreaterThanOrEqual(0);
    expect(structure.drainageOrder).toBeLessThanOrEqual(3);
    expect(terrainStructureMetrics(491)).toEqual(terrainStructureMetrics(491));

    const first = prepareTerrainChunk(2, -1, 491);
    const second = prepareTerrainChunk(2, -1, 491);
    expect(second).toEqual(first);
    expect(first.thermalIterations).toBeGreaterThan(0);
    expect(first.hydraulicIterations).toBeGreaterThan(0);
    expect(first.seamError).toBeLessThan(.05);
    expect(terrainDerivationDiagnostics().activeCells).toBeGreaterThan(0);
  });
});
