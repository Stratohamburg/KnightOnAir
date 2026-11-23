import { clamp, lerp } from "../services/Random";

export const cloudMapSize = 512;
export const cloudMapSpan = 1024;
export const cloudBase = 12;
export const cloudTop = 102;
export const cloudSun = [-0.51, 0.82, -0.26] as const;

const smooth = (start: number, end: number, value: number) => {
  const t = clamp((value - start) / (end - start));
  return t * t * (3 - 2 * t);
};

function hash(x: number, y: number, z: number, seed: number) {
  let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177) ^ Math.imul(seed, 1597334677);
  n = Math.imul(n ^ (n >>> 13), 1103515245);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function billows(x: number, z: number, scale: number, seed: number) {
  const px = x / scale, pz = z / scale;
  const cellX = Math.floor(px), cellZ = Math.floor(pz);
  let height = 0;
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = cellX + dx, cz = cellZ + dz;
      const centerX = cx + .24 + .52 * hash(cx, 0, cz, seed);
      const centerZ = cz + .24 + .52 * hash(cx, 1, cz, seed);
      const radius = .65 + .27 * hash(cx, 2, cz, seed);
      const distanceSquared = ((px - centerX) ** 2 + (pz - centerZ) ** 2) / (radius * radius);
      height = Math.max(height, Math.sqrt(Math.max(0, 1 - distanceSquared)) * (.56 + .44 * hash(cx, 3, cz, seed)));
    }
  }
  return height;
}

// The opening has a tall eastern bank, a low western shelf and a gap over
// the river. The eastern bank crosses the flight line farther north.
function cloudColumn(x: number, z: number, seed: number) {
  const lane = x + 8 * Math.sin(z * .023) - 8 * Math.sin(z * .051);
  const west = -26 + 7 * Math.sin(z * .049 + .36) - 9 * Math.sin(z * .013);
  const east = 30 - 8 * Math.sin(z * .021 + .22) + 7 * Math.cos(z * .026 + 1.4);
  const strip = lane - Math.floor((lane + 79) / 158) * 158;
  const broad = billows(x, z, 17, seed);
  const small = billows(x + 7, z - 12, 7.5, seed + 1);
  const brokenEdge = (broad - .6) * 13 + (small - .6) * 6;
  const eastWall = 1 - smooth(11, 25, Math.abs(strip - east) - brokenEdge);
  const westShelf = 1 - smooth(12, 22, Math.abs(strip - west) - brokenEdge);
  const crossbank = (1 - smooth(7, 20, Math.abs(z - 49 - 11 * Math.sin(x * .058)) - brokenEdge)) *
    (1 - smooth(9, 23, Math.abs(x - 7) - brokenEdge));
  const channel = smooth(3, 11, Math.abs(x + 1 + 3 * Math.sin(z * .07)));
  const nearRiver = 1 - smooth(13, 28, Math.abs(z + 4 - x * .13));
  const eastCoverage = eastWall * lerp(1, .46 + .54 * channel, nearRiver);
  const westCoverage = westShelf * (.78 + .22 * Math.sin(z * .071 + 2.6));
  const bridge = crossbank * .82;
  const ridge = Math.max(eastCoverage, westCoverage, bridge);
  const edge = smooth(.025, .77, ridge);
  const top = 19 + edge * (7 + 18 * broad + 13 * small) +
    eastCoverage ** 1.5 * (6 + 11 * broad) + bridge ** 2 * 71;
  const base = 17 + edge * 7 + westCoverage * 2;
  const cover = ridge * (.72 + .28 * small);
  return { base, top: Math.min(cloudTop - 1, top), cover };
}

export function bakeCloudMap(seed: number) {
  const data = new Uint8Array(cloudMapSize * cloudMapSize * 4);
  const heightRange = cloudTop - cloudBase;
  const scale = cloudMapSpan / cloudMapSize;
  const encode = (value: number) => Math.round(clamp(value) * 255);
  for (let z = 0; z < cloudMapSize; z++) {
    for (let x = 0; x < cloudMapSize; x++) {
      const worldX = (x + .5) * scale - cloudMapSpan * .5;
      const worldZ = (z + .5) * scale - cloudMapSpan * .5;
      const { base, top, cover } = cloudColumn(worldX, worldZ, seed);
      const index = (z * cloudMapSize + x) * 4;
      data[index] = encode((base - cloudBase) / heightRange);
      data[index + 1] = encode((top - cloudBase) / heightRange);
      data[index + 2] = encode(cover);
    }
  }

  const shadeOffsets = [2, 4, 8, 14];
  for (let z = 0; z < cloudMapSize; z++) {
    for (let x = 0; x < cloudMapSize; x++) {
      const index = (z * cloudMapSize + x) * 4;
      let shadow = 0;
      for (const step of shadeOffsets) {
        const sunX = Math.max(0, x - step), sunZ = Math.max(0, z - Math.round(step * .51));
        const fromSun = (sunZ * cloudMapSize + sunX) * 4;
        const rise = (data[fromSun + 1] - data[index + 1]) * heightRange / 255;
        const slope = rise / (step * scale);
        const thickness = (data[fromSun + 1] - data[fromSun]) / 255;
        const occluder = smooth(.03, .52, slope) * smooth(.07, .35, thickness);
        shadow = Math.max(shadow, occluder * data[fromSun + 2] / 255);
      }
      const westTop = data[index - Math.min(x, 1) * 4 + 1];
      const eastTop = data[index + Math.min(cloudMapSize - 1 - x, 1) * 4 + 1];
      const southTop = data[index - Math.min(z, 1) * cloudMapSize * 4 + 1];
      const northTop = data[index + Math.min(cloudMapSize - 1 - z, 1) * cloudMapSize * 4 + 1];
      const dx = (eastTop - westTop) * heightRange / (510 * scale);
      const dz = (northTop - southTop) * heightRange / (510 * scale);
      const light = (cloudSun[1] - dx * cloudSun[0] - dz * cloudSun[2]) / Math.hypot(dx, dz, 1);
      data[index + 3] = encode((.18 + .82 * smooth(-.2, .92, light)) * (1 - shadow * .87));
    }
  }
  return data;
}

export const cloudNoiseSize = 32;

export function bakeCloudNoise(seed: number) {
  const size = cloudNoiseSize;
  const data = new Uint8Array(size ** 3 * 2);
  const period = 5;
  for (let z = 0; z < size; z++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const px = x * period / size, py = y * period / size, pz = z * period / size;
        const ix = Math.floor(px), iy = Math.floor(py), iz = Math.floor(pz);
        let distance = 2;
        let detail = 0;
        for (let dz = -1; dz <= 1; dz++) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const cx = ix + dx, cy = iy + dy, cz = iz + dz;
              const wx = (cx + period) % period, wy = (cy + period) % period, wz = (cz + period) % period;
              const fx = cx + .18 + .64 * hash(wx, wy, wz, seed);
              const fy = cy + .18 + .64 * hash(wx, wy, wz, seed + 1);
              const fz = cz + .18 + .64 * hash(wx, wy, wz, seed + 2);
              const d = (px - fx) ** 2 + (py - fy) ** 2 + (pz - fz) ** 2;
              distance = Math.min(distance, d);
              detail += Math.max(0, 1 - d) ** 3 * hash(wx, wy, wz, seed + 3);
            }
          }
        }
        const index = ((z * size + y) * size + x) * 2;
        data[index] = Math.round(clamp(1 - Math.sqrt(distance) * .85) * 255);
        data[index + 1] = Math.round(clamp(detail) * 255);
      }
    }
  }
  return data;
}

// Coordinates are in texel space with integer values at the texel centers.
export function sampleCloudNoise(data: Uint8Array, x: number, y: number, z: number, channel: 0 | 1) {
  const size = cloudNoiseSize;
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const ax = (ix % size + size) % size, bx = (ax + 1) % size;
  const ay = (iy % size + size) % size, by = (ay + 1) % size;
  const az = (iz % size + size) % size, bz = (az + 1) % size;
  const slice = (sliceY: number) => {
    const rowA = (az * size + sliceY) * size;
    const rowB = (bz * size + sliceY) * size;
    const a = lerp(data[(rowA + ax) * 2 + channel], data[(rowA + bx) * 2 + channel], x - ix);
    const b = lerp(data[(rowB + ax) * 2 + channel], data[(rowB + bx) * 2 + channel], x - ix);
    return lerp(a, b, z - iz);
  };
  return lerp(slice(ay), slice(by), y - iy) / 255;
}

export function sampleCloudColumn(data: Uint8Array, x: number, z: number) {
  const px = (x / cloudMapSpan + .5) * cloudMapSize - .5;
  const pz = (z / cloudMapSpan + .5) * cloudMapSize - .5;
  if (px < 0 || pz < 0 || px >= cloudMapSize - 1 || pz >= cloudMapSize - 1) return undefined;
  const ix = Math.floor(px), iz = Math.floor(pz);
  const start = (iz * cloudMapSize + ix) * 4, row = cloudMapSize * 4;
  const sample = (channel: number) => {
    const i = start + channel;
    return lerp(lerp(data[i], data[i + 4], px - ix), lerp(data[i + row], data[i + row + 4], px - ix), pz - iz) / 255;
  };
  return {
    base: cloudBase + sample(0) * (cloudTop - cloudBase),
    top: cloudBase + sample(1) * (cloudTop - cloudBase),
    coverage: sample(2),
  };
}

export function estimateCloudDensity(
  data: Uint8Array, x: number, y: number, z: number, roofOffset = 0, coverageOffset = 0,
) {
  if (y <= cloudBase || y >= cloudTop) return 0;
  const column = sampleCloudColumn(data, x, z);
  if (!column) return 0;
  const { base, top, coverage } = column;
  return smooth(.25, .58, coverage + coverageOffset) * smooth(base - 2, base + 7, y) *
    (1 - smooth(top - 10, top + 2, y - roofOffset));
}
