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

export function terrainHeight(x: number, z: number, seed = TERRAIN.seed) {
  const height = baseHeight(x, z, seed);
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
  return { height, bedHeight, slopeX, slopeZ, surface: water ? "water" : "land", surfaceMask, roadMask, shoreMask };
}
