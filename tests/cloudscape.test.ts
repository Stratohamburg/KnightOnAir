import { beforeAll, describe, expect, it } from "vitest";
import { QUALITIES } from "../src/data/config";
import {
  cloudFlowAdvance, cloudFlowPosition, cloudFlowSpeed, cloudSelfMorphSpeed,
  smoothCloudFlow,
} from "../src/rendering/CloudFlow";
import { bakeCloudWall, cloudWallWeight, sampleCloudWall } from "../src/rendering/CloudWall";
import {
  bakeCloudMap, bakeCloudNoise, cloudBase, cloudMapSize, cloudNoiseSize, cloudTop,
  estimateCloudDensity, sampleCloudColumn,
} from "../src/rendering/CloudscapeLayout";

describe("coastal cloudscape", () => {
  let map: Uint8Array;
  beforeAll(() => { map = bakeCloudMap(491); });

  it("bakes reproducible coverage, heights and sun shading", () => {
    expect(map.length).toBe(cloudMapSize ** 2 * 4);
    expect(map).toEqual(bakeCloudMap(491));
    const noise = bakeCloudNoise(491);
    expect(noise.length).toBe(cloudNoiseSize ** 3 * 2);
    expect(noise).toEqual(bakeCloudNoise(491));
    expect(noise).not.toEqual(bakeCloudNoise(492));
  });

  it("leaves the river opening between continuous banks", () => {
    for (const z of [-15, -10, -5, 0, 5, 10]) {
      expect(estimateCloudDensity(map, 0, 34, z)).toBeLessThan(.1);
      expect(estimateCloudDensity(map, 30, 34, z)).toBeGreaterThan(.4);
      expect(estimateCloudDensity(map, -26, 34, z)).toBeGreaterThan(.4);
    }
    expect(estimateCloudDensity(map, 8, 83, 49)).toBeGreaterThan(.25);
    expect(estimateCloudDensity(map, 0, 83, 98)).toBe(0);
  });

  it("keeps density inside the cloud layer and bounds", () => {
    const column = sampleCloudColumn(map, 28, 17)!;
    expect(column.base).toBeGreaterThan(cloudBase);
    expect(column.top).toBeGreaterThan(column.base);
    expect(column.top).toBeLessThan(cloudTop);
    expect(estimateCloudDensity(map, 28, cloudBase - 1, 17)).toBe(0);
    expect(estimateCloudDensity(map, 28, cloudTop + 1, 17)).toBe(0);
    expect(estimateCloudDensity(map, 600, 45, 17)).toBe(0);
  });

  it("leaves clear space under a cloud lobe and bakes its solar shadow", () => {
    const wall = bakeCloudWall(bakeCloudNoise(491));
    expect(sampleCloudWall(wall, 16, 27, -30)).toBeGreaterThan(.6);
    expect(sampleCloudWall(wall, 16, 35, -30)).toBeLessThan(.45);
    expect(sampleCloudWall(wall, 16, 45, -30)).toBeGreaterThan(.6);

    // Both points contain cloud, but the lower one is below more cloud along the sun ray.
    expect(sampleCloudWall(wall, 16, 55, -30)).toBeGreaterThan(.6);
    const below = sampleCloudWall(wall, 16, 45, -30, 1);
    const cap = sampleCloudWall(wall, 16, 55, -30, 1);
    expect(below - cap).toBeGreaterThan(.15);
  });

  it("bridges lobe gaps with a continuous volumetric curtain", () => {
    const wall = bakeCloudWall(bakeCloudNoise(491));
    expect(sampleCloudWall(wall, 60, 38, -35)).toBeGreaterThan(.08);
    expect(sampleCloudWall(wall, 60, 38, 35)).toBeGreaterThan(.08);
  });

  it("blends the detailed wall out at its edges and at a distance", () => {
    expect(cloudWallWeight(0, -30, 30)).toBe(0);
    expect(cloudWallWeight(16, -30, 30)).toBe(1);
    expect(cloudWallWeight(16, -30, 116)).toBeCloseTo(.5);
    expect(cloudWallWeight(16, -30, 144)).toBe(0);
  });

  it("keeps each quality tier within the ray marcher budget", () => {
    expect(QUALITIES.low.cloud.resolution).toBeLessThan(QUALITIES.standard.cloud.resolution);
    expect(QUALITIES.standard.cloud.resolution).toBe(.5);
    expect(QUALITIES.high.cloud.resolution).toBeLessThan(1);
    expect(QUALITIES.low.cloud.samples).toBeLessThan(QUALITIES.standard.cloud.samples);
    expect(QUALITIES.standard.cloud.samples).toBeLessThan(QUALITIES.high.cloud.samples);
    expect(QUALITIES.high.cloud.samples).toBeLessThanOrEqual(24);
  });

  it("uses wind direction and magnitude for cloud flow", () => {
    const east = cloudFlowPosition(12, 38, -7, 16, 1, 0);
    const north = cloudFlowPosition(12, 38, -7, 16, 0, 1);
    expect(east).not.toEqual(north);
    expect(cloudFlowSpeed(0.8, 0, 0)).toBeGreaterThan(cloudFlowSpeed(0.2, 0, 0));
    expect(cloudFlowSpeed(0, 0, 0)).toBe(0);
    expect(cloudFlowSpeed(0.2, 0, 1.1)).toBeGreaterThan(cloudFlowSpeed(0.2, 0, 0));
    expect(cloudSelfMorphSpeed(0, 0, 0)).toBeGreaterThan(0);
    expect(cloudSelfMorphSpeed(.8, 0, 0)).toBeGreaterThan(cloudSelfMorphSpeed(0, 0, 0));
    expect(cloudSelfMorphSpeed(.2, 0, 1.1)).toBeGreaterThan(cloudSelfMorphSpeed(.2, 0, 0));
    expect(cloudFlowAdvance(0, 1, 0, 0)).toBe(0);
    expect(cloudFlowAdvance(1, 1, 0, 0)).toBeCloseTo(cloudFlowSpeed(1, 0, 0));
    const lower = cloudFlowPosition(12, 24, -7, 16, 1, 0);
    const upper = cloudFlowPosition(12, 52, -7, 16, 1, 0);
    expect(Math.abs(upper.x - lower.x) + Math.abs(upper.z - lower.z)).toBeGreaterThan(.01);
    const still = cloudFlowPosition(12, 38, -7, 0, 1, 0, 0);
    const bubbled = cloudFlowPosition(12, 38, -7, 0, 1, 0, 5);
    expect(Math.abs(still.x - bubbled.x) + Math.abs(still.y - bubbled.y) + Math.abs(still.z - bubbled.z)).toBeGreaterThan(.01);
    const abrupt = Math.abs(cloudFlowSpeed(1, 0, 0) - cloudFlowSpeed(.2, 0, 0));
    expect(Math.abs(smoothCloudFlow(.5, 1, 1) - .5)).toBeLessThan(abrupt);
  });
});
