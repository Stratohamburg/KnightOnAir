import { clamp } from "../services/Random";

export const TERRAIN = {
  seed: 20261120 as number,
  waterLevel: -1.5,
  playAmplitude: 10,
  farPeak: 18,
  chunk: 80,
  nearSegments: 24,
  farSegments: 10,
  ring: 3,
} as const;

export interface TerrainSample {
  height: number;
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

const baseHeight = (x: number, z: number, seed: number) => {
  const warpX = (fbm(x * 0.004, z * 0.004, seed + 11, 2) - 0.5) * 18;
  const warpZ = (fbm(x * 0.004 - 5.7, z * 0.004 + 9.1, seed + 12, 2) - 0.5) * 18;
  const wx = x + warpX;
  const wz = z + warpZ;
  const broad = fbm(wx * 0.012, wz * 0.012, seed, 4) * 9.2;
  const detail = fbm(wx * 0.045, wz * 0.045, seed + 1, 2) * 0.8;
  const ridge = clamp((fbm(wx * 0.0035, wz * 0.0035, seed + 2, 3) - 0.58) / 0.18, 0, 1);
  return Math.min(TERRAIN.farPeak, broad + detail + ridge * 8);
};

export function terrainHeight(x: number, z: number, seed = TERRAIN.seed) {
  let height = baseHeight(x, z, seed);
  const river = Math.abs(z - riverZ(x, seed));
  const riverMask = 1 - clamp((river - 2) / 5, 0, 1);
  height += (-3 - height) * riverMask;
  const road = (1 - riverMask) * (1 - clamp((routeDistance(x, z, seed) - 2) / 4.5, 0, 1));
  const roadBase = baseHeight(x, z, seed);
  height = height * (1 - road * 0.8) + roadBase * road * 0.8;
  return clamp(height, -3.5, TERRAIN.farPeak);
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
  const height = surfaceHeight(x, z, seed);
  const slopeX = (surfaceHeight(x + epsilon, z, seed) - surfaceHeight(x - epsilon, z, seed)) / (epsilon * 2);
  const slopeZ = (surfaceHeight(x, z + epsilon, seed) - surfaceHeight(x, z - epsilon, seed)) / (epsilon * 2);
  const roadMask = 1 - clamp((routeDistance(x, z, seed) - 2) / 4.5, 0, 1);
  const shoreMask = clamp(1 - Math.abs(height - TERRAIN.waterLevel) / 1.2, 0, 1);
  const water = isWater(x, z, seed);
  const surfaceMask = water ? 3 : shoreMask > 0.1 ? 2 : roadMask > 0.45 ? 1 : Math.abs(slopeX) + Math.abs(slopeZ) > 0.55 ? 4 : 0;
  return { height, slopeX, slopeZ, surface: water ? "water" : "land", surfaceMask, roadMask, shoreMask };
}
