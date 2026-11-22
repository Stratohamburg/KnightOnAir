import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { QUALITIES } from "../src/data/config";
import { placeVegetation, VegetationField } from "../src/rendering/VegetationField";
import { updateVegetationWind, vegetationWindUniforms } from "../src/rendering/VegetationWind";
import { sampleTerrain, surfaceHeight } from "../src/simulation/Terrain";
import { WindField } from "../src/simulation/WindField";

describe("wind vegetation", () => {
  it.each([true, false])("reproduces positions, colors and phase for tree=%s", (tree) => {
    const seed = 491;
    const plants = placeVegetation(-1, 0, seed, tree);
    expect(plants.length).toBeGreaterThan(0);
    expect(plants).toEqual(placeVegetation(-1, 0, seed, tree));
    expect(plants).not.toEqual(placeVegetation(-1, 0, seed + 1, tree));
    const candidates = [-2, -1, 0, 1, 2].flatMap((x) =>
      [-2, -1, 0, 1, 2].flatMap((z) => placeVegetation(x, z, seed, tree)),
    );
    expect(candidates.length).toBeLessThan(25 * 24);
    for (const plant of candidates) {
      const terrain = sampleTerrain(plant.x, plant.z, seed);
      expect(plant.y).toBe(surfaceHeight(plant.x, plant.z, seed));
      expect(terrain.surfaceMask).toBe(0);
      expect(terrain.roadMask).toBeLessThan(.3);
      expect(Math.hypot(terrain.slopeX, terrain.slopeZ)).toBeLessThanOrEqual(tree ? .48 : .4);
    }
  });

  it("updates tuft budgets without replacing resources or changing shared tree placement", () => {
    const scene = new THREE.Scene();
    const field = new VegetationField(scene, vegetationWindUniforms(), 491);
    const [trees, tufts] = scene.children as THREE.InstancedMesh[];
    const geometry = tufts.geometry;
    const material = tufts.material;
    field.update(0, 0, "standard");
    const matrices = trees.instanceMatrix.array.slice(0, trees.count * 16);
    const phases = trees.geometry.attributes.plantMotion.array.slice(0, trees.count * 2);
    const counts = (["low", "standard", "high"] as const).map((quality) => {
      field.update(0, 0, quality);
      expect(field.tuftCount).toBeLessThanOrEqual(9 * QUALITIES[quality].vegetation.tufts);
      expect(tufts.geometry).toBe(geometry);
      expect(tufts.material).toBe(material);
      expect(trees.instanceMatrix.array.slice(0, trees.count * 16)).toEqual(matrices);
      return field.tuftCount;
    });
    expect(counts[0]).toBe(0);
    expect(counts[1]).toBeGreaterThan(0);
    expect(counts[2]).toBeGreaterThan(counts[1]);
    field.update(320, -320, "high");
    field.update(0, 0, "standard");
    expect(trees.instanceMatrix.array.slice(0, trees.count * 16)).toEqual(matrices);
    expect(trees.geometry.attributes.plantMotion.array.slice(0, trees.count * 2)).toEqual(phases);
    field.dispose();
  });

  it("keeps tree roots unweighted and uses the simulation wind sample", () => {
    const uniforms = vegetationWindUniforms();
    const wind = new WindField();
    wind.update(55);
    updateVegetationWind(uniforms, 8, wind, 36, -22);
    const flow = wind.sample(36, -22);
    expect(uniforms.windDirection.value.toArray()).toEqual(new THREE.Vector2(flow.x, flow.z).normalize().toArray());
    expect(uniforms.windGust.value).toBe(wind.gust);
    expect(uniforms.windTime.value).toBe(wind.time);
    expect(uniforms.sceneTime.value).toBe(8);
    const scene = new THREE.Scene();
    const field = new VegetationField(scene, uniforms, 491);
    const tree = scene.children[0] as THREE.InstancedMesh;
    const { position, bendWeight } = tree.geometry.attributes;
    expect(Math.max(...bendWeight.array)).toBeCloseTo(1);
    for (let vertex = 0; vertex < position.count; vertex++) {
      expect(bendWeight.getX(vertex)).toBeCloseTo((position.getY(vertex) / 2.685) ** 2);
    }
    field.dispose();
  });
});
