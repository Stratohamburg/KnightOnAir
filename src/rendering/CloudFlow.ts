import { clamp } from "../services/Random";
import { cloudNoiseSize, sampleCloudNoise } from "./CloudscapeLayout";

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
`;
