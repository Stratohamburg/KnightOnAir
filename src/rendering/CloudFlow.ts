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
export const distantVerticalMorph = .65;
export const distantRoofMorph = 4.8;
export const distantCoverageMorph = .13;
export const billowRiseRate = 2.6;
export const billowLocalShiftAmplitude = 1.95;

export function localBillowShift(x: number, y: number, z: number, time: number, strength: number) {
  // Zero-texture analytic local oscillation: gives clouds continuous slow deformation
  // and subtle bounded local shift in place without ever adding net horizontal drift.
  const amp = billowLocalShiftAmplitude * strength;
  const t = time * 1.15;
  const dx = (Math.sin(z * .055 + t) * .62 + Math.cos(y * .068 - t * .77) * .38) * amp;
  const dy = (Math.cos(x * .061 + z * .048 + t * .92) * .65 + Math.sin(y * .054 + t * .63) * .35) * amp * .85;
  const dz = (Math.cos(x * .057 - t * .86) * .62 + Math.sin(y * .065 + t * .71) * .38) * amp;
  return { dx, dy, dz };
}

export function cloudBillowOffset(
  billow: Uint8Array,
  x: number,
  y: number,
  z: number,
  time: number,
  strength: number,
) {
  const { dx, dy, dz } = localBillowShift(x, y, z, time, strength);
  const tuft = sampleBillowNoise(
    billow,
    (x + dx) * .031 * cloudNoiseSize - .5,
    (y + dy - time * billowRiseRate) * .034 * cloudNoiseSize - .5,
    (z + dz) * .031 * cloudNoiseSize - .5,
    0,
  );
  return { dx, dy, dz, tuft };
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

  // Zero-texture analytic local billowing shift: continuous slow deformation and subtle
  // bounded local movement while keeping macro horizontal motion strictly wind-driven.
  vec3 localBillowShift(vec3 at) {
    float amp = ${billowLocalShiftAmplitude} * selfStrength;
    float t = selfTime * 1.15;
    float dx = (sin(at.z * .055 + t) * .62 + cos(at.y * .068 - t * .77) * .38) * amp;
    float dy = (cos(at.x * .061 + at.z * .048 + t * .92) * .65 + sin(at.y * .054 + t * .63) * .35) * amp * .85;
    float dz = (cos(at.x * .057 - t * .86) * .62 + sin(at.y * .065 + t * .71) * .38) * amp;
    return vec3(dx, dy, dz);
  }

  // Analytic lobe phase pulse (zero extra 3D texture tap in empty sky).
  vec2 analyticMorph(vec3 at) {
    float phase = selfTime * 1.25 + sin(at.x * .046) * 2.3 + cos(at.z * .049) * 2.3 + sin(at.y * .062) * 1.6;
    float lift = cos(phase) * 1.85;
    float pulse = sin(phase) * .72 + sin(selfTime * .78 + (at.x - at.z) * .052) * .28;
    return vec2(lift, pulse) * selfStrength;
  }

  float morphWallDensity(float density, float pulse) {
    float edge = clamp(density * 10., 0., 1.) * (1. - density);
    return clamp(density + edge * pulse * ${edgeAmplitude}, 0., 1.);
  }
`;
