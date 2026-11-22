import { clamp, lerp } from "../services/Random";
import { cloudBase, cloudNoiseSize, cloudSun, cloudTop } from "./CloudscapeLayout";

export const cloudWall = {
  min: [2, cloudBase, -70],
  max: [78, cloudTop, 50],
  size: [64, 72, 96],
  edgeFade: [7, 14],
  detailDistance: [88, 144],
  maxOpticalDepth: 8,
} as const;

// Lower shelf, the main spires, and smaller lobes facing the river opening.
// The upper and lower lips leave a gap in the wall beside the river.
const lobes = [
  [43, 29, -10, 25, 12, 57],
  [38, 41, -48, 21, 18, 22],
  [31, 49, -29, 17, 21, 16],
  [40, 43, -5, 20, 19, 19],
  [35, 52, 15, 18, 22, 17],
  [45, 41, 37, 23, 21, 24],
  [53, 51, -31, 19, 23, 19],
  [57, 46, 11, 20, 18, 26],
  [19, 40, -46, 11, 10, 11],
  [16, 50, -31, 10, 10, 12],
  [17, 27, -29, 11, 6, 10],
  [22, 60, -16, 11, 15, 11],
  [18, 35, -11, 11, 8, 10],
  [16, 44, 0, 9, 8, 9],
  [22, 61, 13, 12, 12, 12],
  [24, 36, 31, 11, 8, 12],
] as const;

const [width, height, depth] = cloudWall.size;
const [minX, minY, minZ] = cloudWall.min;
const [maxX, maxY, maxZ] = cloudWall.max;
const dx = (maxX - minX) / width;
const dy = (maxY - minY) / height;
const dz = (maxZ - minZ) / depth;
const indexAt = (x: number, y: number, z: number) => (z * height + y) * width + x;

const smooth01 = (t: number) => {
  t = clamp(t);
  return t * t * (3 - 2 * t);
};

const bilinear = (a: number, b: number, c: number, d: number, x: number, z: number) =>
  lerp(lerp(a, b, x), lerp(c, d, x), z);

function edgeNoise(data: Uint8Array, x: number, y: number, z: number, channel: number) {
  const size = cloudNoiseSize;
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const ax = (ix % size + size) % size, bx = (ax + 1) % size;
  const ay = (iy % size + size) % size, by = (ay + 1) % size;
  const az = (iz % size + size) % size, bz = (az + 1) % size;
  const slice = (sliceY: number) => {
    const rowA = (az * size + sliceY) * size;
    const rowB = (bz * size + sliceY) * size;
    return bilinear(
      data[(rowA + ax) * 2 + channel], data[(rowA + bx) * 2 + channel],
      data[(rowB + ax) * 2 + channel], data[(rowB + bx) * 2 + channel],
      x - ix, z - iz,
    );
  };
  return lerp(slice(ay), slice(by), y - iy) / 255;
}

function stampLobes() {
  const field = new Float32Array(width * height * depth).fill(-8);
  const join = 2;
  for (const [cx, cy, cz, rx, ry, rz] of lobes) {
    const distanceScale = Math.min(rx, ry, rz);
    const padding = 1 + 6 / distanceScale;
    const firstX = Math.max(0, Math.floor((cx - rx * padding - minX) / dx));
    const firstY = Math.max(0, Math.floor((cy - ry * padding - minY) / dy));
    const firstZ = Math.max(0, Math.floor((cz - rz * padding - minZ) / dz));
    const lastX = Math.min(width, Math.ceil((cx + rx * padding - minX) / dx));
    const lastY = Math.min(height, Math.ceil((cy + ry * padding - minY) / dy));
    const lastZ = Math.min(depth, Math.ceil((cz + rz * padding - minZ) / dz));
    for (let z = firstZ; z < lastZ; z++) {
      const z2 = ((minZ + (z + .5) * dz - cz) / rz) ** 2;
      for (let y = firstY; y < lastY; y++) {
        const yz2 = z2 + ((minY + (y + .5) * dy - cy) / ry) ** 2;
        for (let x = firstX; x < lastX; x++) {
          const index = indexAt(x, y, z);
          const distance = (1 - Math.sqrt(yz2 + ((minX + (x + .5) * dx - cx) / rx) ** 2)) * distanceScale;
          const current = field[index];
          const overlap = Math.max(0, join - Math.abs(current - distance));
          field[index] = Math.max(current, distance) + overlap ** 2 / (4 * join);
        }
      }
    }
  }
  return field;
}

function bakeSunlight(data: Uint8Array) {
  // The sun is above the cloud. Each horizontal slice integrates one
  // additional segment, looking back into the already integrated slice.
  const [sunX, sunY, sunZ] = cloudSun;
  const shiftX = sunX / sunY * dy / dx;
  const shiftZ = sunZ / sunY * dy / dz;
  const offsetX = Math.floor(shiftX), offsetZ = Math.floor(shiftZ);
  const fractionX = shiftX - offsetX, fractionZ = shiftZ - offsetZ;
  const extinctionStep = .205 * dy * Math.hypot(...cloudSun) / sunY;
  let upper = new Float32Array(width * depth);
  let slice = new Float32Array(width * depth);
  const incident = (x: number, z: number, y: number) => {
    if (x < 0 || z < 0 || x >= width || z >= depth || y >= height) return 0;
    return upper[z * width + x] + data[indexAt(x, y, z) * 2] / 255 * extinctionStep * .5;
  };
  for (let y = height - 1; y >= 0; y--) {
    for (let z = 0; z < depth; z++) {
      for (let x = 0; x < width; x++) {
        const ix = x + offsetX, iz = z + offsetZ, above = y + 1;
        const incoming = bilinear(
          incident(ix, iz, above), incident(ix + 1, iz, above),
          incident(ix, iz + 1, above), incident(ix + 1, iz + 1, above),
          fractionX, fractionZ,
        );
        const index = indexAt(x, y, z) * 2;
        const opticalDepth = incoming + data[index] / 255 * extinctionStep * .5;
        slice[z * width + x] = opticalDepth;
        data[index + 1] = Math.round(clamp(opticalDepth / cloudWall.maxOpticalDepth) * 255);
      }
    }
    [upper, slice] = [slice, upper];
  }
}

export function bakeCloudWall(noise: Uint8Array) {
  const field = stampLobes();
  const data = new Uint8Array(field.length * 2);
  for (let z = 0; z < depth; z++) {
    const wz = minZ + (z + .5) * dz;
    for (let y = 0; y < height; y++) {
      const wy = minY + (y + .5) * dy;
      for (let x = 0; x < width; x++) {
        const index = indexAt(x, y, z);
        const distance = field[index];
        if (distance <= -3.5) continue;
        const wx = minX + (x + .5) * dx;
        const broad = edgeNoise(noise, wx * .8, wy, wz * .8, 0);
        const fine = edgeNoise(noise, wx * 2.3, wy * 2.5, wz * 2.3, 1);
        const perturbation = (broad - .56) * 4.5 + (fine - .47) * 1.6;
        const density = smooth01((distance + perturbation + 1.18) / 3.7) * (.64 + .35 * broad);
        data[index * 2] = Math.round(density * 255);
      }
    }
  }
  bakeSunlight(data);
  return data;
}

export function cloudWallWeight(x: number, z: number, distance: number) {
  const [fadeX, fadeZ] = cloudWall.edgeFade;
  const [near, far] = cloudWall.detailDistance;
  return smooth01(Math.min(x - minX, maxX - x) / fadeX) *
    smooth01(Math.min(z - minZ, maxZ - z) / fadeZ) *
    (1 - smooth01((distance - near) / (far - near)));
}

export function sampleCloudWall(data: Uint8Array, x: number, y: number, z: number, channel: 0 | 1 = 0) {
  const px = clamp((x - minX) / dx - .5, 0, width - 1);
  const py = clamp((y - minY) / dy - .5, 0, height - 1);
  const pz = clamp((z - minZ) / dz - .5, 0, depth - 1);
  const ax = Math.floor(px), bx = Math.min(ax + 1, width - 1);
  const ay = Math.floor(py), by = Math.min(ay + 1, height - 1);
  const az = Math.floor(pz), bz = Math.min(az + 1, depth - 1);
  const slice = (sliceY: number) => bilinear(
    data[indexAt(ax, sliceY, az) * 2 + channel], data[indexAt(bx, sliceY, az) * 2 + channel],
    data[indexAt(ax, sliceY, bz) * 2 + channel], data[indexAt(bx, sliceY, bz) * 2 + channel],
    px - ax, pz - az,
  );
  return lerp(slice(ay), slice(by), py - ay) / 255;
}
