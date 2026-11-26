import { clamp } from "../services/Random";
import { cloudBase, cloudTop } from "./CloudscapeLayout";

export const MAX_CLOUD_CLUSTERS = 4;
export const MAX_CLUSTER_LOBES = 8;
export const MAX_ACTIVE_LOBES = MAX_CLOUD_CLUSTERS * MAX_CLUSTER_LOBES; // 32 lobes total

const SECTOR_SPAN = 180;

export interface ActiveCloudCluster {
  id: string;
  originX: number;
  originZ: number;
  cx: number;
  cy: number;
  cz: number;
  radius: number;
  start: number;
  count: number;
}

export interface ActiveCloudLobe {
  x: number;
  y: number;
  z: number;
  radius: number;
  yScale: number;
  blend: number;
  phase: number;
  crownBias: number;
}

export interface ActiveCloudField {
  clusters: ActiveCloudCluster[];
  lobes: ActiveCloudLobe[];
}

interface LobeBlueprint {
  ox: number;
  oy: number;
  oz: number;
  r: number;
  yScale: number;
  blend: number;
  phase: number;
  bobAmp: number;
  driftAmp: number;
  crownBias: number;
}

interface ClusterBlueprint {
  cx: number;
  cz: number;
  lobes: readonly LobeBlueprint[];
}

// Iconic Daylight Prairie coastal cloud groups around the origin:
// Note top-down coordinate orientation: camera looks toward +Z, so +X is SCREEN LEFT and -X is SCREEN RIGHT.
// - Clear sunny turquoise estuary channel along x ~ -11..+11, z ~ -45..+25
// - Screen-left (+X) multi-tiered cumulus wall with flight-altitude inner cushions + taller outer domes
// - Screen-right (-X) sunlit cumulus ridge visibly flanking the right edge of the 360x640 portrait frame
// - Dramatic northern cloud gateway ahead of the opening
const ORIGIN_CLUSTERS: readonly ClusterBlueprint[] = [
  // Screen-left (+X) wall - southern & central sculpted cumulus bank
  {
    cx: 30,
    cz: -10,
    lobes: [
      { ox: -10, oy: 24, oz: -20, r: 11.8, yScale: .78, blend: 4.4, phase: 0.4, bobAmp: 1.3, driftAmp: 1.2, crownBias: 0.36 },
      { ox: -10, oy: 26, oz: -2, r: 12.2, yScale: .80, blend: 4.5, phase: 1.7, bobAmp: 1.5, driftAmp: 1.4, crownBias: 0.56 },
      { ox: -9, oy: 25, oz: 14, r: 11.5, yScale: .78, blend: 4.2, phase: 0.9, bobAmp: 1.4, driftAmp: 1.3, crownBias: 0.46 },
      { ox: 1, oy: 34, oz: -12, r: 14.2, yScale: .90, blend: 5.0, phase: 2.9, bobAmp: 1.9, driftAmp: 1.4, crownBias: 0.88 },
      { ox: 2, oy: 34, oz: 8, r: 14.5, yScale: .88, blend: 5.0, phase: 5.2, bobAmp: 1.8, driftAmp: 1.3, crownBias: 0.84 },
      { ox: 10, oy: 28, oz: -24, r: 15.0, yScale: .82, blend: 5.4, phase: 4.1, bobAmp: 1.4, driftAmp: 1.2, crownBias: 0.52 },
      { ox: 12, oy: 42, oz: -4, r: 14.0, yScale: .94, blend: 5.2, phase: 3.5, bobAmp: 2.1, driftAmp: 1.3, crownBias: 1.0 },
      { ox: 8, oy: 27, oz: 20, r: 14.0, yScale: .82, blend: 5.0, phase: 2.1, bobAmp: 1.4, driftAmp: 1.2, crownBias: 0.44 },
    ],
  },
  // Screen-left (+X) wall - northern extension & spire
  {
    cx: 32,
    cz: 36,
    lobes: [
      { ox: -10, oy: 25, oz: -10, r: 12.0, yScale: .80, blend: 4.5, phase: 1.1, bobAmp: 1.4, driftAmp: 1.3, crownBias: 0.44 },
      { ox: -6, oy: 36, oz: 2, r: 13.5, yScale: .90, blend: 4.8, phase: 2.5, bobAmp: 1.9, driftAmp: 1.4, crownBias: 0.86 },
      { ox: 6, oy: 32, oz: -8, r: 15.0, yScale: .86, blend: 5.4, phase: 3.9, bobAmp: 1.6, driftAmp: 1.3, crownBias: 0.65 },
      { ox: 10, oy: 43, oz: 10, r: 14.5, yScale: .95, blend: 5.2, phase: 5.0, bobAmp: 2.0, driftAmp: 1.4, crownBias: 0.98 },
      { ox: -11, oy: 31, oz: 16, r: 12.2, yScale: .86, blend: 4.5, phase: 0.6, bobAmp: 1.7, driftAmp: 1.5, crownBias: 0.68 },
      { ox: 2, oy: 28, oz: 22, r: 14.5, yScale: .82, blend: 5.2, phase: 4.4, bobAmp: 1.5, driftAmp: 1.3, crownBias: 0.48 },
    ],
  },
  // Screen-right (-X) sunlit cumulus ridge flanking the right side of the portrait frame
  {
    cx: -32,
    cz: -4,
    lobes: [
      { ox: 10, oy: 24, oz: -22, r: 11.4, yScale: .78, blend: 4.2, phase: 0.8, bobAmp: 1.3, driftAmp: 1.3, crownBias: 0.40 },
      { ox: 10, oy: 27, oz: -4, r: 12.0, yScale: .82, blend: 4.5, phase: 2.2, bobAmp: 1.6, driftAmp: 1.4, crownBias: 0.62 },
      { ox: 10, oy: 25, oz: 14, r: 11.8, yScale: .80, blend: 4.4, phase: 3.7, bobAmp: 1.5, driftAmp: 1.3, crownBias: 0.48 },
      { ox: -3, oy: 35, oz: -10, r: 14.2, yScale: .90, blend: 5.0, phase: 4.9, bobAmp: 1.9, driftAmp: 1.4, crownBias: 0.88 },
      { ox: -6, oy: 34, oz: 4, r: 14.8, yScale: .86, blend: 5.2, phase: 1.5, bobAmp: 1.8, driftAmp: 1.2, crownBias: 0.78 },
      { ox: -2, oy: 41, oz: 10, r: 13.0, yScale: .94, blend: 4.8, phase: 5.6, bobAmp: 2.0, driftAmp: 1.5, crownBias: 0.96 },
      { ox: -8, oy: 27, oz: -26, r: 14.2, yScale: .80, blend: 5.0, phase: 3.1, bobAmp: 1.4, driftAmp: 1.3, crownBias: 0.38 },
      { ox: 6, oy: 29, oz: 28, r: 12.4, yScale: .84, blend: 4.6, phase: 1.9, bobAmp: 1.5, driftAmp: 1.4, crownBias: 0.58 },
    ],
  },
  // Northern cross-bank / cloud gateway separating the next sunny prairie zone
  {
    cx: -2,
    cz: 60,
    lobes: [
      { ox: -20, oy: 28, oz: -4, r: 13.5, yScale: .82, blend: 4.8, phase: 1.3, bobAmp: 1.5, driftAmp: 1.4, crownBias: 0.50 },
      { ox: -7, oy: 36, oz: 4, r: 14.5, yScale: .90, blend: 5.0, phase: 2.8, bobAmp: 1.9, driftAmp: 1.5, crownBias: 0.84 },
      { ox: 10, oy: 42, oz: -2, r: 15.0, yScale: .94, blend: 5.2, phase: 4.2, bobAmp: 2.1, driftAmp: 1.5, crownBias: 1.0 },
      { ox: 22, oy: 33, oz: 6, r: 13.5, yScale: .84, blend: 4.8, phase: 5.4, bobAmp: 1.7, driftAmp: 1.4, crownBias: 0.68 },
      { ox: 2, oy: 28, oz: -10, r: 12.5, yScale: .80, blend: 4.6, phase: 0.3, bobAmp: 1.4, driftAmp: 1.3, crownBias: 0.44 },
      { ox: -14, oy: 39, oz: 12, r: 13.0, yScale: .90, blend: 4.6, phase: 3.6, bobAmp: 1.9, driftAmp: 1.5, crownBias: 0.88 },
    ],
  },
];

// The raster bank is stationary in cloud space. Shape the river-facing shelf,
// a recess near z=8 and two higher crowns independently of the SDF comparison.
function bankLobe(ox: number, oy: number, oz: number, r: number, yScale: number, blend: number): LobeBlueprint {
  return { ox, oy, oz, r, yScale, blend, phase: 0, bobAmp: 0, driftAmp: 0, crownBias: 0 };
}
const RASTER_ORIGIN_CLUSTERS: readonly ClusterBlueprint[] = [
  {
    cx: 30, cz: 0,
    lobes: [
      bankLobe(1, 26, -28, 18, .54, 3.4),
      bankLobe(-6, 24, -15, 14, .44, 3.8),
      bankLobe(-12, 24, -9, 8.8, .46, 2.5),
      // The tallest cap rises behind two overlapping shelves facing the river.
      bankLobe(1, 38, -24, 15, .98, 3.8),
      bankLobe(-7, 38, -17, 10.2, .83, 2.8),
      bankLobe(-12, 32, -15, 7.7, .73, 2.4),
      bankLobe(-9, 38, -22, 6.6, .89, 1.7),
      bankLobe(-3, 45, -29, 8.8, .95, 2.4),
      bankLobe(-1, 49, -24, 5.6, .94, 1.8),
      // Set the foreground shoulder out toward the sun so its lip shades
      // the recessed face between the shoulder and the main crown.
      bankLobe(-6, 42, -37, 9.1, .76, 2.5),
      bankLobe(-10, 38.5, -34, 6.7, .84, 1.7),
      bankLobe(-12, 39, -23.7, 5.3, .88, 1.8),
      bankLobe(-13, 33, -10, 4.5, .77, 1.4),
      bankLobe(10, 32, -6, 15, .66, 4.5),
      bankLobe(13, 26, 13, 16, .53, 4),
      bankLobe(0, 32, 31, 16, .71, 4.6),
      bankLobe(-1, 42, 38, 13.5, .98, 4.1),
      bankLobe(9, 27, 51, 15.5, .55, 4.8),
    ],
  },
  ...ORIGIN_CLUSTERS.slice(2),
];
export const MAX_RASTER_GROUP_LOBES = RASTER_ORIGIN_CLUSTERS[0].lobes.length;
// A raster bank must be complete before its geometry is cached by group id.
// At most one bank has more than eight lobes.
export const MAX_RASTER_LOBES = MAX_RASTER_GROUP_LOBES + (MAX_CLOUD_CLUSTERS - 1) * MAX_CLUSTER_LOBES;

function sectorHash(ix: number, iz: number, salt: number, seed: number) {
  let n = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(salt, 1274126177) ^ Math.imul(seed, 1597334677);
  n = Math.imul(n ^ (n >>> 13), 1103515245);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function buildSectorClusters(sx: number, sz: number, seed: number, raster: boolean): readonly ClusterBlueprint[] {
  if (sx === 0 && sz === 0) return raster ? RASTER_ORIGIN_CLUSTERS : ORIGIN_CLUSTERS;
  const baseX = sx * SECTOR_SPAN;
  const baseZ = sz * SECTOR_SPAN;
  // Generate 2 well-separated grouped cumulus banks per outer sector, leaving wide sunny prairie corridors.
  const out: ClusterBlueprint[] = [];
  for (let g = 0; g < 2; g++) {
    const h0 = sectorHash(sx, sz, g * 19 + 1, seed);
    const h1 = sectorHash(sx, sz, g * 19 + 2, seed);
    const h2 = sectorHash(sx, sz, g * 19 + 3, seed);
    const cx = baseX + (g === 0 ? -48 : 44) + (h0 - .5) * 34;
    const cz = baseZ + (g === 0 ? -36 : 38) + (h1 - .5) * 42;
    const yaw = h2 * Math.PI * 2;
    const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
    const lobes: LobeBlueprint[] = [];
    const count = 6;
    for (let i = 0; i < count; i++) {
      const a = sectorHash(sx, sz, g * 61 + i * 7 + 5, seed);
      const b = sectorHash(sx, sz, g * 61 + i * 7 + 6, seed);
      const c = sectorHash(sx, sz, g * 61 + i * 7 + 7, seed);
      const along = (i / (count - 1) - .5) * 46;
      const across = (a - .5) * 20;
      const ox = along * cosY - across * sinY;
      const oz = along * sinY + across * cosY;
      const isCrown = i === 2 || i === 3;
      const oy = (isCrown ? 38 : 27) + b * 10;
      const r = (isCrown ? 15.2 : 14.0) + c * 3.0;
      lobes.push({
        ox,
        oy,
        oz,
        r,
        yScale: isCrown ? .93 : .83,
        blend: 5.4,
        phase: a * Math.PI * 2,
        bobAmp: isCrown ? 2.1 : 1.5,
        driftAmp: 1.4,
        crownBias: isCrown ? .9 : .45,
      });
    }
    out.push({ cx, cz, lobes });
  }
  return out;
}

export function smoothMin(a: number, b: number, k: number) {
  const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1);
  return b + (a - b) * h - k * h * (1 - h);
}

export function evaluateActiveClouds(
  focusX: number,
  focusZ: number,
  driftX: number,
  driftZ: number,
  selfTime: number,
  selfStrength: number,
  seed: number,
  raster = false,
  coverage = 1,
): ActiveCloudField {
  // Find nearby macro sectors in cloud-advected coordinates (horizontal translation strictly follows drift).
  const fieldX = focusX - driftX;
  const fieldZ = focusZ - driftZ;
  const centerSX = Math.round(fieldX / SECTOR_SPAN);
  const centerSZ = Math.round(fieldZ / SECTOR_SPAN);

  const candidates: { id: string; blueprint: ClusterBlueprint; distSq: number }[] = [];
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const clusters = buildSectorClusters(centerSX + dx, centerSZ + dz, seed, raster);
      for (const [index, blueprint] of clusters.entries()) {
        const worldCX = blueprint.cx + driftX;
        const worldCZ = blueprint.cz + driftZ;
        const ddx = worldCX - focusX;
        const ddz = worldCZ - focusZ;
        const distSq = ddx * ddx + ddz * ddz;
        if (distSq < 185 * 185) {
          candidates.push({ id: `${centerSX + dx}/${centerSZ + dz}/${index}`, blueprint, distSq });
        }
      }
    }
  }

  candidates.sort((a, b) => a.distSq - b.distSq);
  const selected = candidates.slice(0, MAX_CLOUD_CLUSTERS);

  const clusters: ActiveCloudCluster[] = [];
  const lobes: ActiveCloudLobe[] = [];

  for (const { id, blueprint } of selected) {
    const start = lobes.length;
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (const bp of blueprint.lobes) {
      // Continuous slow in-place 3D billowing: bounded zero-mean local shift + slow convective lift/pulse.
      // Never introduces net horizontal drift (macro motion strictly comes from driftX/driftZ).
      const t = selfTime * .85 + bp.phase;
      const t2 = selfTime * .52 + bp.phase * 1.7;
      const localDX = (Math.sin(t) * .65 + Math.cos(t2) * .35) * bp.driftAmp * selfStrength;
      const localDZ = (Math.cos(t * .91) * .65 + Math.sin(t2 * 1.13) * .35) * bp.driftAmp * selfStrength;
      const localDY = Math.sin(t * .78 + bp.crownBias * 2.1) * bp.bobAmp * selfStrength;
      const pulse = 1 + Math.sin(t * .95 + bp.phase * .6) * .075 * selfStrength;

      const x = blueprint.cx + bp.ox + driftX + localDX;
      const y = clamp(bp.oy + localDY, cloudBase + 6, cloudTop - 12);
      const z = blueprint.cz + bp.oz + driftZ + localDZ;
      const radius = bp.r * pulse * Math.sqrt(coverage);

      lobes.push({
        x,
        y,
        z,
        radius,
        yScale: bp.yScale,
        blend: bp.blend,
        phase: bp.phase,
        crownBias: bp.crownBias,
      });

      const pad = radius + bp.blend * .55 + 3.5;
      const padY = radius * bp.yScale + bp.blend * .55 + 3.5;
      if (x - pad < minX) minX = x - pad;
      if (x + pad > maxX) maxX = x + pad;
      if (y - padY < minY) minY = y - padY;
      if (y + padY > maxY) maxY = y + padY;
      if (z - pad < minZ) minZ = z - pad;
      if (z + pad > maxZ) maxZ = z + pad;
    }

    const count = lobes.length - start;
    if (count > 0) {
      const cx = (minX + maxX) * .5;
      const cy = (minY + maxY) * .5;
      const cz = (minZ + maxZ) * .5;
      const radius = Math.hypot(maxX - cx, maxY - cy, maxZ - cz);
      clusters.push({
        id, originX: blueprint.cx + driftX, originZ: blueprint.cz + driftZ,
        cx, cy, cz, radius, start, count,
      });
    }
  }

  return { clusters, lobes };
}

export function evaluateCloudGroupSdf(lobes: readonly ActiveCloudLobe[], x: number, y: number, z: number, start = 0, end = lobes.length) {
  let distance = 1e4;
  for (let i = start; i < end; i++) {
    const lobe = lobes[i];
    const dx = x - lobe.x;
    const dy = (y - lobe.y) / lobe.yScale;
    const dz = z - lobe.z;
    const sd = (Math.sqrt(dx * dx + dy * dy + dz * dz) - lobe.radius) * lobe.yScale;
    distance = i === start ? sd : smoothMin(distance, sd, lobe.blend);
  }
  return distance;
}

export function evaluateCloudSdfCpu(field: ActiveCloudField, x: number, y: number, z: number) {
  let d = 1e4;
  for (const cluster of field.clusters) {
    const cd = Math.hypot(x - cluster.cx, y - cluster.cy, z - cluster.cz) - cluster.radius;
    if (cd > 6) continue;
    const groupD = evaluateCloudGroupSdf(field.lobes, x, y, z, cluster.start, cluster.start + cluster.count);
    if (groupD < d) d = groupD;
  }
  return d;
}

export function sdfToDensity(sdf: number) {
  if (sdf >= 2.2) return 0;
  return clamp((2.2 - sdf) / 6.2, 0, 1);
}
