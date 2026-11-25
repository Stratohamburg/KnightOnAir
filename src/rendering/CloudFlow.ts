import { clamp } from "../services/Random";
import { cloudNoiseSize, sampleBillowNoise, sampleCloudNoise } from "./CloudscapeLayout";

export function cloudVelocity(windX: number, windZ: number, gust: number) {
  // A gust can strengthen an existing vector, including very light winds.
  const scale = .42 * (2.4 + .65 * Math.max(0, gust));
  return { x: windX * scale, z: windZ * scale };
}

export function cloudSelfMorphSpeed(windX: number, windZ: number, gust: number) {
  return .38 + Math.hypot(windX, windZ) * .75 + Math.max(0, gust) * .24;
}

export function smoothCloudFlow(current: number, target: number, delta: number, response = 2.4) {
  return current + (target - current) * (1 - Math.exp(-Math.max(0, delta) * response));
}

const horizontalFrequency = .009;
const verticalFrequency = .012;
const edgeAmplitude = .22;
export const distantVerticalMorph = .45;
export const distantRoofMorph = 3.8;
export const distantCoverageMorph = .1;
export const billowRiseRate = 1.25;
export const billowWarpAmplitude = 2.6;
export const billowFineRiseRate = 2.35;

export function cloudBillowOffset(
  billow: Uint8Array,
  x: number,
  y: number,
  z: number,
  time: number,
  strength: number,
) {
  // Strictly zero-mean local 3D domain warp + convective vertical rise driven by scene time.
  // Never adds net horizontal drift; horizontal translation comes exclusively from WindField drift.
  const rise = time * billowRiseRate;
  const scale = .014 * cloudNoiseSize;
  const sx = x * scale - .5;
  const sy = (y - rise) * scale - .5;
  const sz = z * scale - .5;
  const wx = sampleBillowNoise(billow, sx, sy, sz, 3) - .5;
  const wy = sampleBillowNoise(billow, sx + 11.3, sy + 7.1, sz - 5.7, 3) - .5;
  const wz = sampleBillowNoise(billow, sx - 6.7, sy + 13.7, sz + 9.4, 3) - .5;
  const amp = billowWarpAmplitude * strength;
  const tuft = sampleBillowNoise(
    billow,
    (x + wx * amp) * .026 * cloudNoiseSize - .5,
    (y + wy * amp - time * billowFineRiseRate) * .029 * cloudNoiseSize - .5,
    (z + wz * amp) * .026 * cloudNoiseSize - .5,
    0,
  );
  return {
    dx: wx * amp,
    dy: wy * amp,
    dz: wz * amp,
    tuft,
  };
}

export function cloudMorph(noise: Uint8Array, x: number, y: number, z: number, time: number, strength: number) {
  // GPU linear sampling places each texel center half a texel into its cell.
  const nx = x * horizontalFrequency * cloudNoiseSize - .5;
  const ny = y * verticalFrequency * cloudNoiseSize - .5;
  const nz = z * horizontalFrequency * cloudNoiseSize - .5;
  const broad = sampleCloudNoise(noise, nx, ny, nz, 0);
  const detail = sampleCloudNoise(noise, nx, ny, nz, 1);
  const phase = time * 1.05 + broad * 12;
  return {
    lift: Math.cos(phase) * (1.2 + detail) * strength,
    pulse: (Math.sin(phase) * .7 + Math.sin(time * .61 + detail * 15) * .3) * strength,
  };
}

export function morphWallDensity(density: number, pulse: number) {
  const edge = clamp(density * 10) * (1 - density);
  return clamp(density + edge * pulse * edgeAmplitude);
}

export const cloudFlowGLSL = `
  uniform float selfTime, selfStrength;

  // Fixed 3D noise assigns neighboring lobes different phases. Only the
  // height and local density change here. Wind supplies the horizontal drift.
  vec2 cloudMorph(vec3 at) {
    vec2 noise = texture(detailNoise, at * vec3(${horizontalFrequency}, ${verticalFrequency}, ${horizontalFrequency})).rg;
    float phase = selfTime * 1.05 + noise.r * 12.;
    float lift = cos(phase) * (1.2 + noise.g);
    float pulse = sin(phase) * .7 + sin(selfTime * .61 + noise.g * 15.) * .3;
    return vec2(lift, pulse) * selfStrength;
  }

  float morphWallDensity(float density, float pulse) {
    float edge = clamp(density * 10., 0., 1.) * (1. - density);
    return clamp(density + edge * pulse * ${edgeAmplitude}, 0., 1.);
  }

  // Zero-mean 3D convective warp driven strictly by scene time (no net horizontal drift).
  vec3 billowWarp(sampler3D billowTex, vec3 at) {
    vec3 base = vec3(at.x, at.y - selfTime * ${billowRiseRate}, at.z) * .014;
    float wx = texture(billowTex, base).a - .5;
    float wy = texture(billowTex, base + vec3(.353, .222, -.178)).a - .5;
    float wz = texture(billowTex, base + vec3(-.209, .428, .294)).a - .5;
    return vec3(wx, wy, wz) * (${billowWarpAmplitude} * selfStrength);
  }
`;
