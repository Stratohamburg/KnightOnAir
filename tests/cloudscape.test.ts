import { beforeAll, describe, expect, it } from "vitest";
import { Vector3, type WebGLRenderer } from "three";
import { QUALITIES } from "../src/data/config";
import { cloudMorph, cloudSelfMorphSpeed, cloudVelocity, morphWallDensity } from "../src/rendering/CloudFlow";
import { Cloudscape } from "../src/rendering/Cloudscape";
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

  it("integrates the wind vector without rotating past cloud displacement", () => {
    const renderer = { extensions: { has: () => false } } as unknown as WebGLRenderer;
    const clouds = new Cloudscape(renderer, 491);
    const camera = new Vector3(16, 38, -30);
    const advance = (dt: number, x: number, z: number, gust = 0) =>
      clouds.update(dt, x, z, gust, camera, 0, 24, 0, 0, 0, true);

    try {
      advance(60, 1, 0);
      const east = clouds.flow.drift[0];
      advance(.25, 0, 1);
      const north = clouds.flow.drift[1];
      expect(clouds.flow.drift[0]).toBe(east);
      expect(north).toBeCloseTo(cloudVelocity(0, 1, 0).z * .25);
      expect(north).toBeGreaterThan(0);
      advance(.25, -1, 0);
      const afterTurn = clouds.flow.drift;
      expect(afterTurn[0]).toBeCloseTo(east - north);
      expect(afterTurn[1]).toBe(north);

      const afterTurnTime = clouds.flow.selfTime;
      advance(2, 0, 0, 1);
      expect(clouds.flow.drift).toEqual(afterTurn);
      expect(clouds.flow.selfTime).toBeGreaterThan(afterTurnTime);
      const pausedTime = clouds.flow.selfTime;
      advance(0, 1, 1, 1);
      expect(clouds.flow.drift).toEqual(afterTurn);
      expect(clouds.flow.selfTime).toBe(pausedTime);
    } finally {
      clouds.dispose();
    }
  });

  it("changes local cloud density and lift at different phases in calm air", () => {
    expect(cloudVelocity(.8, 0, 0).x).toBeGreaterThan(cloudVelocity(.2, 0, 0).x);
    expect(cloudVelocity(.2, 0, 1.1).x).toBeGreaterThan(cloudVelocity(.2, 0, 0).x);
    const calm = cloudSelfMorphSpeed(0, 0, 0);
    expect(calm).toBeGreaterThan(0);
    expect(cloudSelfMorphSpeed(.8, 0, 0)).toBeGreaterThan(cloudSelfMorphSpeed(0, 0, 0));
    expect(cloudSelfMorphSpeed(.2, 0, 1.1)).toBeGreaterThan(cloudSelfMorphSpeed(.2, 0, 0));

    const noise = bakeCloudNoise(491);
    const sample = (y: number, z: number, time: number) => cloudMorph(noise, 20, y, z, time, .72);
    const densityChange = (y: number, z: number) =>
      morphWallDensity(.2, sample(y, z, 3 * calm).pulse) - morphWallDensity(.2, sample(y, z, 0).pulse);
    const changes = [-45, -30, -15, 0, 15, 30].map(z => densityChange(36, z));
    expect(Math.max(...changes)).toBeGreaterThan(.025);
    expect(Math.min(...changes)).toBeLessThan(-.025);
    expect(sample(36, -30, 0).lift).not.toBeCloseTo(sample(52, -30, 0).lift);
    expect(morphWallDensity(0, sample(36, -30, 3 * calm).pulse)).toBe(0);
  });
});
