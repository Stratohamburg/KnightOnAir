import { beforeAll, describe, expect, it } from "vitest";
import { Group, Vector2, Vector3, type WebGLRenderer } from "three";
import { ProceduralAircraft } from "../src/content/3d/AircraftFactory";
import { airframeById, STARTER_FRAME_ID } from "../src/data/aircrafts";
import { World } from "../src/simulation/World";
import { CloudWake, VehicleCloudWakes, cloudWakeCapacity, wakeLifetime } from "../src/rendering/CloudWake";
import { buildCloudGeometry } from "../src/content/3d/CloudGeometry";
import { QUALITIES } from "../src/data/config";
import { ERAS } from "../src/data/eras";
import { cloudBillowOffset, cloudMorph, cloudSelfMorphSpeed, cloudVelocity, morphWallDensity } from "../src/rendering/CloudFlow";
import { Cloudscape } from "../src/rendering/Cloudscape";
import { evaluateActiveClouds, evaluateCloudGroupSdf } from "../src/rendering/CloudLobes";
import { bakeCloudWall, cloudWallWeight, sampleCloudWall } from "../src/rendering/CloudWall";
import {
  bakeBillowNoise, bakeCloudMap, bakeCloudNoise, cloudBase, cloudMapSize, cloudNoiseSize, cloudTop,
  cloudSun, estimateCloudDensity, sampleCloudColumn,
} from "../src/rendering/CloudscapeLayout";

describe("coastal cloudscape", () => {
  it("cuts at each vehicle's own height and keeps disconnected histories after removal", () => {
    const field = new VehicleCloudWakes(), drift = new Vector2();
    const makeHull = (x: number, y: number) => {
      const group = new Group();
      group.position.set(x, y, 0);
      return { group, cloudContactSites: [new Vector3(0, 1, -1), new Vector3(0, 1, 1), new Vector3(0, 1, 0)], dispose() {} };
    };
    const truck = makeHull(24, 0), boat = makeHull(-24, 0);
    const fog = (_x: number, y: number) => Number(y >= 12);
    field.update(.1, drift, undefined, [truck, boat], fog);
    expect(field.cutCount).toBe(0);
    truck.group.position.y = boat.group.position.y = 12;
    for (let i = 0; i < 24; i++) {
      truck.group.position.z += 1.5;
      boat.group.position.z -= 1.5;
      field.update(.05, drift, undefined, [truck, boat], fog);
    }
    expect(field.count).toBe(cloudWakeCapacity);
    expect(field.cutCount).toBe(6);
    expect(field.cuts.slice(0, 6).every(c => c.y === 13 && c.w <= 2.1)).toBe(true);
    for (let i = 0; i < field.count; i++) expect(field.starts[i].x).toBe(field.ends[i].x);
    for (const x of [-24, 24]) expect(field.starts.slice(0, field.count).some(p => p.x === x)).toBe(true);
    field.update(.1, drift, undefined, [], fog);
    expect(field.cutCount).toBe(0);
    expect(field.count).toBeGreaterThan(0);
    field.update(wakeLifetime, drift, undefined, [], fog);
    expect(field.count).toBe(0);
  });
  it("keeps a grazing wing's trail in cloud space across a turn, a gap and a pause", () => {
    const world = new World(airframeById(STARTER_FRAME_ID), 491);
    const plane = new ProceduralAircraft(world.player);
    const wake = new CloudWake();
    const drift = new Vector2();
    try {
      const fly = (z: number, dt: number, contact = true) => {
        plane.group.position.set(drift.x, 24, z + drift.y);
        wake.update(dt, drift, plane, x => Number(contact && x > drift.x + .1));
      };
      fly(0, .1);
      fly(6, .1);
      expect(wake.contacts.map(tip => tip.w)).toEqual([0, 1, 0]);
      expect(wake.count).toBe(3);
      const recorded = wake.starts[0].clone();
      drift.set(3, 2);
      fly(8, .1, false);
      world.player.heading = .3;
      plane.group.rotation.y = .3;
      fly(12, .1);
      expect(wake.count).toBe(4);
      expect(wake.starts[0].x).toBe(recorded.x);
      expect(wake.starts[0].z).toBe(recorded.z);
      expect(wake.starts[3]).toEqual(wake.ends[3]);
      const frozen = wake.ends.map(p => p.clone());
      fly(15, 0);
      expect(wake.ends).toEqual(frozen);
      fly(15, wakeLifetime + .1, false);
      expect(wake.count).toBe(0);
    } finally {
      plane.dispose();
      world.dispose();
    }
  });
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
    expect(QUALITIES.low.cloud.resolution).toBe(.55);
    expect(QUALITIES.standard.cloud.resolution).toBe(.75);
    expect(QUALITIES.high.cloud.resolution).toBe(1);
    expect(QUALITIES.low.cloud.resolution).toBeLessThan(QUALITIES.standard.cloud.resolution);
    expect(QUALITIES.standard.cloud.resolution).toBeLessThan(QUALITIES.high.cloud.resolution);
    expect(QUALITIES.low.cloud.samples).toBeLessThan(QUALITIES.standard.cloud.samples);
    expect(QUALITIES.standard.cloud.samples).toBeLessThan(QUALITIES.high.cloud.samples);
    expect(QUALITIES.high.cloud.samples).toBeLessThanOrEqual(24);
  });

  it("extracts the joined coast bank as one closed, outward-facing indexed surface", () => {
    const field = evaluateActiveClouds(0, 18, 0, 0, 0, 0, 491, true);
    const bank = field.clusters.find(group => group.count > 8)!;
    const lobes = field.lobes.slice(bank.start, bank.start + bank.count);
    const geometry = buildCloudGeometry(lobes);
    try {
      const positions = geometry.getAttribute("position");
      const normals = geometry.getAttribute("normal");
      const indices = geometry.getIndex()!;
      expect(indices.count / 3).toBeLessThan(15000);
      expect(indices.count).toBeGreaterThan(positions.count * 4);
      const uses = new Map<number, number>();
      const a = new Vector3(), ab = new Vector3(), ac = new Vector3(), n = new Vector3();
      let facing = 0;
      for (let i = 0; i < indices.count; i += 3) {
        const ia = indices.getX(i), ib = indices.getX(i + 1), ic = indices.getX(i + 2);
        for (const [u, v] of [[ia, ib], [ib, ic], [ic, ia]]) {
          const key = Math.min(u, v) * positions.count + Math.max(u, v);
          uses.set(key, (uses.get(key) ?? 0) + 1);
        }
        a.fromBufferAttribute(positions, ia);
        ab.fromBufferAttribute(positions, ib).sub(a);
        ac.fromBufferAttribute(positions, ic).sub(a);
        facing += Number(ab.cross(ac).dot(n.fromBufferAttribute(normals, ia)) > 0);
      }
      expect([...uses.values()].every(use => use === 2)).toBe(true);
      expect(facing / (indices.count / 3)).toBeGreaterThan(.99);
      for (let i = 0; i < positions.count; i += 11) {
        a.fromBufferAttribute(positions, i);
        expect(Math.abs(evaluateCloudGroupSdf(lobes, a.x, a.y, a.z))).toBeLessThan(.25);
      }
    } finally {
      geometry.dispose();
    }
  });

  it("attenuates sunlight on a facing patch when a separate crown crosses the light path", () => {
    const towardSun = new Vector3(cloudSun[0] * 1.55, cloudSun[1] * .52, cloudSun[2] * 1.55).normalize();
    const base = { x: 0, y: 28, z: 0, radius: 8, yScale: 1, blend: 2, phase: 0, crownBias: 0 };
    const blocker = { ...base, x: towardSun.x * 32, y: base.y + towardSun.y * 32, z: towardSun.z * 32 };
    const patch = towardSun.clone().multiplyScalar(8).add(new Vector3(0, base.y, 0));
    function transmission(lobes: typeof base[]) {
      const g = buildCloudGeometry(lobes);
      try {
        const points = g.getAttribute("position");
        const light = g.getAttribute("cloudLighting");
        const p = new Vector3();
        let total = 0, count = 0;
        for (let i = 0; i < points.count; i++) {
          if (p.fromBufferAttribute(points, i).distanceToSquared(patch) < 9) {
            total += light.getY(i);
            count++;
          }
        }
        expect(count).toBeGreaterThan(0);
        return total / count;
      } finally {
        g.dispose();
      }
    }
    expect(transmission([base])).toBeGreaterThan(.8);
    expect(transmission([base, blocker])).toBeLessThan(.4);
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

  it("bakes deterministic 3D billowing noise, keeps sunny openings clear, and keeps calm billowing local", () => {
    const billowA = bakeBillowNoise(491);
    const billowB = bakeBillowNoise(491);
    expect(billowA.length).toBe(cloudNoiseSize ** 3 * 4);
    expect(billowA).toEqual(billowB);
    expect(billowA).not.toEqual(bakeBillowNoise(492));

    // Calm billowing evolves deterministically in 3D with bounded local shift and no net horizontal drift.
    const t0 = cloudBillowOffset(billowA, 180, 28, -220, 0, .72);
    const t1 = cloudBillowOffset(billowA, 180, 28, -220, 4, .72);
    expect(t0).toEqual(cloudBillowOffset(billowB, 180, 28, -220, 0, .72));
    expect(Math.abs(t1.tuft - t0.tuft) + Math.abs(t1.dy - t0.dy)).toBeGreaterThan(.05);
    expect(Math.hypot(t1.dx, t1.dz)).toBeLessThan(2.5);

    const renderer = { extensions: { has: () => false } } as unknown as WebGLRenderer;
    const clouds = new Cloudscape(renderer, 491);
    const camera = new Vector3(0, 76, -50);
    try {
      // Sunny openings between cloud walls stay clear (no full-map overcast low cloud sea).
      for (const y of [16, 20, 28, 36]) {
        expect(clouds.sampleDensityAt(0, y, -10)).toBeLessThan(.1);
      }
      // Flanking cloud walls outside the estuary opening remain dense and towering.
      expect(clouds.sampleDensityAt(28, 30, 0)).toBeGreaterThan(.4);
      expect(clouds.sampleDensityAt(-30, 30, 0)).toBeGreaterThan(.4);

      // Calm air evolves local billowing without changing horizontal drift; pause freezes both.
      clouds.update(2, 0, 0, 0, camera, 0, 24, 0, 0, 0, true);
      expect(clouds.flow.drift).toEqual([0, 0]);
      expect(clouds.flow.selfTime).toBeGreaterThan(0);
      const frozenTime = clouds.flow.selfTime;
      const frozenSample = clouds.sampleDensityAt(28, 30, 0);
      clouds.update(0, 1, 1, 1, camera, 0, 24, 0, 0, 0, true);
      expect(clouds.flow.selfTime).toBe(frozenTime);
      expect(clouds.sampleDensityAt(28, 30, 0)).toBe(frozenSample);

      // Era palette updates cloud atmosphere colors cleanly.
      clouds.setPalette(ERAS.ww2.colors);
      expect(clouds.palette).toEqual({
        cloudLit: ERAS.ww2.colors.cloudLit,
        cloudShadow: ERAS.ww2.colors.cloudShadow,
        cloudRim: ERAS.ww2.colors.cloudRim,
        skyHorizon: ERAS.ww2.colors.skyHorizon,
        valleyFog: ERAS.ww2.colors.skyHorizon,
      });
    } finally {
      clouds.dispose();
    }
  });
});
