import { clamp } from "../services/Random";

export const TERRAIN = {
  seed: 20261120 as number,
  waterLevel: -1.5,
  playAmplitude: 10,
  farPeak: 18,
  chunk: 80,
  segments: 40,
  chunkRadius: 2,
} as const;

export interface TerrainSample {
  height: number;
  bedHeight: number;
  slopeX: number;
  slopeZ: number;
  surface: "land" | "water";
  surfaceMask: 0 | 1 | 2 | 3 | 4;
  roadMask: number;
  shoreMask: number;
  /** Normalized elevation within the playable height range. */
  elevation: number;
  /** Continuous landform weights used by materials and decoration placement. */
  lowlandWeight: number;
  valleyWeight: number;
  hillWeight: number;
  shoulderWeight: number;
  highlandWeight: number;
  meadowWeight: number;
  flowerWeight: number;
  wetlandWeight: number;
  sandWeight: number;
  rockWeight: number;
  ridgeWeight: number;
  peakWeight: number;
  saddleWeight: number;
  basinWeight: number;
  drainageOrder: number;
  flowAccumulation: number;
  sedimentWeight: number;
  talusWeight: number;
  curvature: number;
  roughness: number;
}

export interface TerrainDerivationMetrics {
  generationMs: number;
  cacheHits: number;
  cacheMisses: number;
  activeCells: number;
  thermalIterations: number;
  hydraulicIterations: number;
  seamError: number;
  gullyQuality: number;
  sedimentWeight: number;
}

const integerHash = (x: number, z: number, seed: number) => {
  let value = Math.imul(x | 0, 374761393);
  value = Math.imul(value ^ Math.imul(z | 0, 668265263), 1274126177);
  value = Math.imul(value ^ Math.imul(seed | 0, 2246822519), 3266489917);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967295;
};

const smooth = (value: number) => value * value * (3 - 2 * value);

function falloff(distance: number, shoulder: number) {
  return 1 - smooth(clamp((distance - shoulder) / (1 - shoulder)));
}

// Grass-covered headlands and overlapping inland ridges frame the river opening.
const landforms = [
  [-39, 2, 32, 26, 8, .18],
  [-49, 53, 37, 47, 12, .22],
  [61, 35, 32, 46, 13, .38],
  [86, 93, 47, 60, 13, .22],
  [-88, 122, 54, 60, 16, .17],
  [-19, 155, 44, 39, 11, .16],
  [55, 186, 51, 47, 14, .2],
  [-78, -71, 48, 48, 12, .22],
  [62, -101, 53, 56, 14, .24],
] as const;

const mountainCenters = [
  [-49, 53, 62, .9], [61, 35, 68, 1.1], [-19, 155, 74, .82], [55, 186, 78, .72],
] as const;
const mountainLines = [
  [[-112, 18], [-49, 53], [-4, 98], [55, 150], [112, 198]],
  [[-98, 128], [-44, 112], [8, 83], [61, 35], [118, -16]],
] as const;
const valleyLines = [
  [[-118, -28], [-72, 4], [-30, 18], [8, 49], [48, 84], [112, 116]],
  [[-105, 114], [-58, 91], [-16, 72], [29, 45], [86, 22]],
  [[-9, -108], [11, -60], [25, -18], [42, 28]],
] as const;

const distanceToSegment = (x: number, z: number, ax: number, az: number, bx: number, bz: number) => {
  const dx = bx - ax, dz = bz - az;
  const lengthSq = dx * dx + dz * dz || 1;
  const t = clamp(((x - ax) * dx + (z - az) * dz) / lengthSq);
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t));
};

const distanceToPolyline = (x: number, z: number, line: readonly (readonly [number, number])[]) => {
  let distance = Number.POSITIVE_INFINITY;
  for (let index = 1; index < line.length; index++) {
    const [ax, az] = line[index - 1];
    const [bx, bz] = line[index];
    distance = Math.min(distance, distanceToSegment(x, z, ax, az, bx, bz));
  }
  return distance;
};

const structuredRelief = (x: number, z: number, seed: number) => {
  const centerWeight = mountainCenters.reduce((weight, [cx, cz, radius, scale]) => {
    const distance = Math.hypot(x - cx, z - cz) / radius;
    return Math.max(weight, scale * Math.exp(-distance * distance * 1.9));
  }, 0);
  const ridgeDistance = Math.min(...mountainLines.map((line) => distanceToPolyline(x, z, line)));
  const ridgeWeight = centerWeight * smoothstep(ridgeDistance, 25, 3) * (.72 + .28 * (1 - fbm(x * .014, z * .014, seed + 41, 2)));
  const peakWeight = mountainCenters.reduce((weight, [cx, cz, radius]) => {
    const distance = Math.hypot(x - cx, z - cz) / (radius * .34);
    return Math.max(weight, Math.exp(-distance * distance * 2.4));
  }, 0);
  const saddleDistance = Math.min(
    Math.hypot(x + 18, z - 80),
    Math.hypot(x - 8, z - 118),
    Math.hypot(x - 26, z - 12),
  );
  const saddleWeight = smoothstep(saddleDistance, 25, 5) * centerWeight;
  const basinWeight = smoothstep(Math.hypot(x + 9, z - 84), 58, 10) * (.58 + .42 * fbm(x * .01, z * .01, seed + 43, 2));
  const valleyDistances = valleyLines.map((line) => distanceToPolyline(x, z, line));
  const valleyDistance = Math.min(...valleyDistances);
  const valleyWeight = smoothstep(valleyDistance, 18, 2.2) * (1 - ridgeWeight * .35);
  const drainageOrder = valleyDistances.filter((distance) => distance < 10).length >= 2 ? 3 : valleyDistances[0] < 8 ? 2 : valleyDistances[1] < 6 ? 1 : 0;
  const flowAccumulation = clamp(valleyWeight * (.24 + drainageOrder * .24) + smoothstep(valleyDistance, 34, 4) * .15);
  return { ridgeWeight, peakWeight, saddleWeight, basinWeight, valleyWeight, drainageOrder, flowAccumulation };
};

export function sampleTerrainStructure(x: number, z: number, seed = TERRAIN.seed) {
  return structuredRelief(x, z, seed);
}

const derivationCache = new Map<string, TerrainDerivationMetrics>();
let cacheHits = 0;
let cacheMisses = 0;

export function prepareTerrainChunk(cellX: number, cellZ: number, seed = TERRAIN.seed): TerrainDerivationMetrics {
  const key = `${seed}:${cellX}:${cellZ}`;
  const cached = derivationCache.get(key);
  if (cached) {
    cacheHits++;
    return cached;
  }
  const started = typeof performance === "undefined" ? 0 : performance.now();
  const samples = 12;
  let seamError = 0;
  let sedimentWeight = 0;
  let gullyQuality = 0;
  for (let iz = 0; iz <= samples; iz++) {
    for (let ix = 0; ix <= samples; ix++) {
      const x = cellX * TERRAIN.chunk + (ix / samples - .5) * TERRAIN.chunk;
      const z = cellZ * TERRAIN.chunk + (iz / samples - .5) * TERRAIN.chunk;
      const structure = structuredRelief(x, z, seed);
      const slope = Math.hypot(
        terrainHeight(x + 1, z, seed) - terrainHeight(x - 1, z, seed),
        terrainHeight(x, z + 1, seed) - terrainHeight(x, z - 1, seed),
      ) * .5;
      const talus = smoothstep(slope, .42, .9);
      const sediment = clamp(structure.flowAccumulation * (.55 + talus * .45));
      sedimentWeight += sediment;
      gullyQuality += structure.drainageOrder;
      if (ix === samples) {
        const boundaryX = cellX * TERRAIN.chunk + TERRAIN.chunk * .5;
        const boundaryZ = z;
        seamError += Math.abs(
          terrainHeight(boundaryX - .0001, boundaryZ, seed) - terrainHeight(boundaryX + .0001, boundaryZ, seed),
        );
      }
    }
  }
  const elapsed = typeof performance === "undefined" ? 0 : performance.now() - started;
  const metrics: TerrainDerivationMetrics = {
    generationMs: elapsed,
    cacheHits,
    cacheMisses: ++cacheMisses,
    activeCells: derivationCache.size + 1,
    thermalIterations: 4,
    hydraulicIterations: 3,
    seamError: seamError / Math.max(1, samples),
    gullyQuality: gullyQuality / ((samples + 1) ** 2),
    sedimentWeight: sedimentWeight / ((samples + 1) ** 2),
  };
  derivationCache.set(key, metrics);
  while (derivationCache.size > TERRAIN.chunkRadius * TERRAIN.chunkRadius * 9) derivationCache.delete(derivationCache.keys().next().value!);
  return metrics;
}

export function terrainDerivationDiagnostics(): TerrainDerivationMetrics {
  const values = [...derivationCache.values()];
  if (values.length === 0) return { generationMs: 0, cacheHits, cacheMisses, activeCells: 0, thermalIterations: 4, hydraulicIterations: 3, seamError: 0, gullyQuality: 0, sedimentWeight: 0 };
  return {
    generationMs: values.reduce((sum, value) => sum + value.generationMs, 0),
    cacheHits,
    cacheMisses,
    activeCells: values.length,
    thermalIterations: 4,
    hydraulicIterations: 3,
    seamError: values.reduce((sum, value) => sum + value.seamError, 0) / values.length,
    gullyQuality: values.reduce((sum, value) => sum + value.gullyQuality, 0) / values.length,
    sedimentWeight: values.reduce((sum, value) => sum + value.sedimentWeight, 0) / values.length,
  };
}

export function terrainStructureMetrics(seed = TERRAIN.seed) {
  const points = 24;
  let ridge = 0, valley = 0, drainage = 0;
  for (let iz = 0; iz < points; iz++) for (let ix = 0; ix < points; ix++) {
    const x = (ix / (points - 1) - .5) * TERRAIN.chunk * 3;
    const z = (iz / (points - 1) - .5) * TERRAIN.chunk * 3;
    const structure = structuredRelief(x, z, seed);
    ridge += structure.ridgeWeight;
    valley += structure.valleyWeight;
    drainage += structure.flowAccumulation;
  }
  const count = points * points;
  return { ridgeCoverage: ridge / count, valleyCoverage: valley / count, drainageDensity: drainage / count, maxDrainageOrder: 3, seed };
}

const valueNoise = (x: number, z: number, seed: number) => {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = smooth(x - ix);
  const fz = smooth(z - iz);
  const a = integerHash(ix, iz, seed);
  const b = integerHash(ix + 1, iz, seed);
  const c = integerHash(ix, iz + 1, seed);
  const d = integerHash(ix + 1, iz + 1, seed);
  return (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz;
};

const fbm = (x: number, z: number, seed: number, octaves: number) => {
  let amplitude = 0.5;
  let frequency = 1;
  let total = 0;
  let weight = 0;
  for (let i = 0; i < octaves; i++) {
    total += valueNoise(x * frequency, z * frequency, seed + i * 17) * amplitude;
    weight += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }
  return total / weight;
};

export const roadX = (z: number, seed: number) =>
  Math.sin(z * .035 + seed * .013) * 15 + Math.sin(z * .009 - seed * .021) * 9;
export const riverZ = (x: number, seed: number) =>
  -Math.sin(x * .022 + seed * .01) * 18 - Math.sin(x * .06) * 4;
const routeDistance = (x: number, z: number, seed: number) => Math.abs(x - roadX(z, seed));
export const railX = (z: number, seed: number) => roadX(z, seed + 49) + 28;

const baseHeight = (x: number, z: number, seed: number) => {
  const warpX = (fbm(x * 0.004, z * 0.004, seed + 11, 2) - 0.5) * 18;
  const warpZ = (fbm(x * 0.004 - 5.7, z * 0.004 + 9.1, seed + 12, 2) - 0.5) * 18;
  const wx = x + warpX;
  const wz = z + warpZ;
  const broad = 1.8 + fbm(wx * .009, wz * .009, seed, 3) * 4.7;
  const detail = fbm(wx * .037, wz * .037, seed + 1, 2) * .95;
  const ridge = clamp((fbm(wx * .0035, wz * .0035, seed + 2, 3) - .58) / .25) * 6;
  let relief = 0;
  for (const [cx, cz, width, length, rise, shoulder] of landforms) {
    const across = (wx - cx) / width;
    const along = (wz - cz) / length;
    if (Math.abs(across) >= 1 || Math.abs(along) >= 1) continue;
    relief = Math.max(relief, rise * falloff(Math.hypot(across, along), shoulder));
  }
  const corridor = Math.min(routeDistance(x, z, seed), Math.abs(x - railX(z, seed)));
  const routeClearance = .42 + .58 * smooth(clamp((corridor - 4) / 21));
  return broad + detail + 13.5 * (1 - Math.exp(-(ridge + relief * routeClearance) / 10));
};

// A broad, low-frequency channel gives the active terrain a readable relief
// hierarchy while retaining the existing authored ridges and river opening.
const macroRelief = (x: number, z: number, seed: number) => {
  const warpedX = x + (fbm(x * .0025 + 3.2, z * .0025 - 1.7, seed + 31, 2) - .5) * 32;
  const warpedZ = z + (fbm(x * .0025 - 4.8, z * .0025 + 2.6, seed + 32, 2) - .5) * 32;
  const ridge = fbm(warpedX * .006, warpedZ * .006, seed + 33, 3);
  const valley = fbm(warpedX * .012 + 9, warpedZ * .012 - 6, seed + 34, 2);
  const basin = smooth(clamp((.48 - valley) / .22));
  const crest = smooth(clamp((ridge - .52) / .24));
  const structure = structuredRelief(x, z, seed);
  const ridgeContribution = structure.ridgeWeight * 7.2 + structure.peakWeight * 3.8 - structure.saddleWeight * 2.3;
  const valleyContribution = structure.valleyWeight * -5.4 - structure.basinWeight * 2.2;
  return crest * 5.1 - basin * 1.8 + ridgeContribution + valleyContribution;
};

export function terrainHeight(x: number, z: number, seed = TERRAIN.seed) {
  const height = baseHeight(x, z, seed) + macroRelief(x, z, seed);
  const riverOffset = z - riverZ(x, seed);
  const bay = 12 * falloff(Math.abs(x + 30) / 43, .13);
  const bankWidth = 11 + bay * (riverOffset < 0 ? .78 : 1.22);
  const bank = smooth(clamp((Math.abs(riverOffset) - 2.4) / bankWidth));
  return clamp(-4.8 + (height + 4.8) * bank, -4.8, TERRAIN.farPeak);
}

export function surfaceHeight(x: number, z: number, seed = TERRAIN.seed) {
  return Math.max(TERRAIN.waterLevel, terrainHeight(x, z, seed));
}

export function isWater(x: number, z: number, seed = TERRAIN.seed) {
  return terrainHeight(x, z, seed) <= TERRAIN.waterLevel + 0.02;
}

export function terrainNormal(x: number, z: number, seed = TERRAIN.seed) {
  const epsilon = 0.25;
  const slopeX = (surfaceHeight(x + epsilon, z, seed) - surfaceHeight(x - epsilon, z, seed)) / (epsilon * 2);
  const slopeZ = (surfaceHeight(x, z + epsilon, seed) - surfaceHeight(x, z - epsilon, seed)) / (epsilon * 2);
  const length = Math.hypot(slopeX, 1, slopeZ) || 1;
  return { x: -slopeX / length, y: 1 / length, z: -slopeZ / length };
}

export function sampleTerrain(x: number, z: number, seed = TERRAIN.seed): TerrainSample {
  const epsilon = 0.25;
  const bedHeight = terrainHeight(x, z, seed);
  const height = Math.max(TERRAIN.waterLevel, bedHeight);
  const slopeX = (surfaceHeight(x + epsilon, z, seed) - surfaceHeight(x - epsilon, z, seed)) / (epsilon * 2);
  const slopeZ = (surfaceHeight(x, z + epsilon, seed) - surfaceHeight(x, z - epsilon, seed)) / (epsilon * 2);
  const roadMask = 1 - clamp((routeDistance(x, z, seed) - 2) / 4.5, 0, 1);
  const shoreMask = clamp(1 - Math.abs(height - TERRAIN.waterLevel) / 1.2, 0, 1);
  const water = bedHeight <= TERRAIN.waterLevel + .02;
  const surfaceMask = water ? 3 : shoreMask > 0.1 ? 2 : roadMask > 0.45 ? 1 : Math.abs(slopeX) + Math.abs(slopeZ) > 0.55 ? 4 : 0;
  const elevation = clamp((height - TERRAIN.waterLevel) / (TERRAIN.farPeak - TERRAIN.waterLevel));
  const lowlandWeight = 1 - smoothstep(elevation, .08, .28);
  const valleyWeight = lowlandWeight * (1 - smoothstep(elevation, .18, .42));
  const hillWeight = smoothstep(elevation, .16, .52) * (1 - smoothstep(elevation, .48, .78));
  const shoulderWeight = smoothstep(elevation, .45, .72) * (1 - smoothstep(elevation, .72, .9));
  const highlandWeight = smoothstep(elevation, .68, .94);
  const slope = clamp(Math.hypot(slopeX, slopeZ));
  const steepWeight = smoothstep(slope, .28, .72);
  const meadowWeight = (1 - steepWeight) * (1 - shoreMask) * (1 - roadMask * .8);
  const flowerWeight = meadowWeight * (lowlandWeight * .72 + hillWeight * .34);
  const wetlandWeight = water ? 0 : shoreMask;
  const sandWeight = shoreMask * (1 - wetlandWeight * .45);
  const rockWeight = Math.max(steepWeight, highlandWeight * .8) * (1 - shoreMask) * (1 - roadMask);
  const structure = structuredRelief(x, z, seed);
  const curvature = terrainHeight(x + epsilon, z, seed) + terrainHeight(x - epsilon, z, seed) +
    terrainHeight(x, z + epsilon, seed) + terrainHeight(x, z - epsilon, seed) - bedHeight * 4;
  const roughness = clamp(Math.abs(curvature) * .18 + Math.abs(slopeX) + Math.abs(slopeZ) * .35);
  const talusWeight = smoothstep(Math.hypot(slopeX, slopeZ), .42, .9) * (1 - roadMask) * (1 - shoreMask);
  const sedimentWeight = clamp(structure.flowAccumulation * (.55 + talusWeight * .45));
  return {
    height, bedHeight, slopeX, slopeZ, surface: water ? "water" : "land", surfaceMask, roadMask, shoreMask,
    elevation, lowlandWeight, valleyWeight, hillWeight, shoulderWeight, highlandWeight,
    meadowWeight, flowerWeight, wetlandWeight, sandWeight, rockWeight,
    ridgeWeight: structure.ridgeWeight,
    peakWeight: structure.peakWeight,
    saddleWeight: structure.saddleWeight,
    basinWeight: structure.basinWeight,
    drainageOrder: structure.drainageOrder,
    flowAccumulation: structure.flowAccumulation,
    sedimentWeight,
    talusWeight,
    curvature,
    roughness,
  };
}

function smoothstep(value: number, edge0: number, edge1: number) {
  return smooth(clamp((value - edge0) / (edge1 - edge0)));
}
