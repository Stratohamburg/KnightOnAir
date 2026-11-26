import { BufferGeometry, Float32BufferAttribute, Vector3 } from "three";
import { triTable } from "three/addons/objects/MarchingCubes.js";
import { evaluateCloudGroupSdf, type ActiveCloudLobe } from "../../rendering/CloudLobes";
import { cloudSun } from "../../rendering/CloudscapeLayout";
import { RULES } from "../../data/config";
import { clamp, lerp } from "../../services/Random";

// The Three.js table is one flat typed array at runtime.
const triangles = triTable as unknown as Int32Array;
const edges = [
  [0, 1], [1, 2], [3, 2], [0, 3], [4, 5], [5, 6],
  [7, 6], [4, 7], [0, 4], [1, 5], [2, 6], [3, 7],
] as const;
const sun = new Vector3(cloudSun[0] * 1.55, cloudSun[1] * .52, cloudSun[2] * 1.55).normalize();
const step = 2;
const pitch = RULES.camera.pitch * Math.PI / 180;
export const cloudViewRay = new Vector3(0, -Math.sin(pitch), Math.cos(pitch));
const sunProbeEdges = [0, 2, 5, 9, 15, 23, 34, 48];

/** Polygonize one smooth union in cloud-local space. Grid edges share vertex indices. */
export function buildCloudGeometry(lobes: readonly ActiveCloudLobe[]) {
  const min = new Vector3(Infinity, Infinity, Infinity);
  const max = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const lobe of lobes) {
    const padding = lobe.blend + step;
    const horizontal = lobe.radius + padding;
    const vertical = lobe.radius * lobe.yScale + padding;
    min.min(new Vector3(lobe.x - horizontal, lobe.y - vertical, lobe.z - horizontal));
    max.max(new Vector3(lobe.x + horizontal, lobe.y + vertical, lobe.z + horizontal));
  }
  if (!lobes.length) return new BufferGeometry();
  const nx = Math.ceil((max.x - min.x) / step) + 1;
  const ny = Math.ceil((max.y - min.y) / step) + 1;
  const nz = Math.ceil((max.z - min.z) / step) + 1;
  const slice = nx * ny;
  const offsets = [0, 1, nx + 1, nx, slice, slice + 1, slice + nx + 1, slice + nx];
  const samples = new Float32Array(slice * nz);
  const vertices = new Int32Array(samples.length * 3).fill(-1);
  const sdf = (x: number, y: number, z: number) => evaluateCloudGroupSdf(lobes, x, y, z);
  for (let z = 0; z < nz; z++) {
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        samples[z * slice + y * nx + x] = sdf(min.x + x * step, min.y + y * step, min.z + z * step);
      }
    }
  }

  const positions: number[] = [];
  const normals: number[] = [];
  const lighting: number[] = [];
  const indices: number[] = [];
  const normal = new Vector3();
  // Integrate sunlight through the same grid used to extract the surface.
  // Interpolate fractional grid coordinates so shadows cross cell boundaries smoothly.
  function solarTransmission(x: number, y: number, z: number) {
    let opticalDepth = 0;
    for (let i = 1; i < sunProbeEdges.length; i++) {
      const span = sunProbeEdges[i] - sunProbeEdges[i - 1];
      const distance = sunProbeEdges[i] - span * .5;
      const gx = (x + sun.x * distance - min.x) / step;
      const gy = (y + sun.y * distance - min.y) / step;
      const gz = (z + sun.z * distance - min.z) / step;
      const ix = Math.floor(gx), iy = Math.floor(gy), iz = Math.floor(gz);
      if (ix < 0 || iy < 0 || iz < 0 || ix + 1 >= nx || iy + 1 >= ny || iz + 1 >= nz) break;
      const base = iz * slice + iy * nx + ix;
      const fx = gx - ix, fy = gy - iy, fz = gz - iz;
      const next = base + slice;
      const nearRow = lerp(samples[base], samples[base + 1], fx);
      const nearUpper = lerp(samples[base + nx], samples[base + nx + 1], fx);
      const farRow = lerp(samples[next], samples[next + 1], fx);
      const farUpper = lerp(samples[next + nx], samples[next + nx + 1], fx);
      const distanceField = lerp(lerp(nearRow, nearUpper, fy), lerp(farRow, farUpper, fy), fz);
      const density = clamp((1.8 - distanceField) / 4.5, 0, 1);
      opticalDepth += density * span * .14;
    }
    return Math.exp(-opticalDepth);
  }
  function vertex(cell: number, edge: number) {
    const [start, end] = edges[edge];
    const a = cell + offsets[start];
    const b = cell + offsets[end];
    const stride = b - a;
    const slot = a * 3 + (stride === 1 ? 0 : stride === nx ? 1 : 2);
    if (vertices[slot] !== -1) return vertices[slot];
    const t = samples[a] / (samples[a] - samples[b]);
    const x = min.x + (a % nx + (stride === 1 ? t : 0)) * step;
    const y = min.y + (Math.floor(a / nx) % ny + (stride === nx ? t : 0)) * step;
    const z = min.z + (Math.floor(a / slice) + (stride === slice ? t : 0)) * step;
    const epsilon = .14;
    normal.set(
      sdf(x + epsilon, y, z) - sdf(x - epsilon, y, z),
      sdf(x, y + epsilon, z) - sdf(x, y - epsilon, z),
      sdf(x, y, z + epsilon) - sdf(x, y, z - epsilon),
    ).normalize();
    const ambient = clamp(sdf(x + normal.x * 5, y + normal.y * 5, z + normal.z * 5) / 3.8, .36, 1);
    const shadow = solarTransmission(x, y, z);
    // Estimate how much core sits behind this patch. A thin tongue reaches
    // open air on its far side before a crown does.
    let column = 0, behind = 0;
    for (const depth of [3, 8, 15]) {
      column += clamp(-sdf(x - normal.x * depth, y - normal.y * depth, z - normal.z * depth) / 3, 0, 1);
      behind += clamp(-sdf(x, y + cloudViewRay.y * depth, z + cloudViewRay.z * depth) / 2, 0, 1);
    }
    vertices[slot] = positions.length / 3;
    positions.push(x, y, z);
    normals.push(normal.x, normal.y, normal.z);
    lighting.push(ambient, shadow, column / 3, behind / 3);
    return vertices[slot];
  }

  for (let z = 0; z < nz - 1; z++) {
    for (let y = 0; y < ny - 1; y++) {
      for (let x = 0; x < nx - 1; x++) {
        const cell = z * slice + y * nx + x;
        let mask = 0;
        for (let corner = 0; corner < 8; corner++) {
          if (samples[cell + offsets[corner]] < 0) mask |= 1 << corner;
        }
        for (let i = mask * 16; triangles[i] !== -1; i += 3) {
          // The distance field is negative inside. Wind faces toward its outward gradient.
          indices.push(vertex(cell, triangles[i]), vertex(cell, triangles[i + 2]), vertex(cell, triangles[i + 1]));
        }
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setAttribute("cloudLighting", new Float32BufferAttribute(lighting, 4));
  geometry.computeBoundingSphere();
  // Reserve space for wind-independent surface animation and the local aircraft push.
  geometry.boundingSphere!.radius += 10;
  return geometry;
}
