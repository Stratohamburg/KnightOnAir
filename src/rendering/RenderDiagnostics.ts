import type { Vector3 } from "three";

export interface CloudDiagnostics {
  enabled: boolean;
  resolution: [number, number];
  samples: number;
  cpuMs: number;
  rayMarchCpuMs: number;
  cameraDensity: number;
  windDirection: [number, number];
  windSpeed: number;
}

export const cloudDiagnostics = new WeakMap<object, CloudDiagnostics>();

export interface EnvironmentFixture {
  camera?: Vector3;
  lookAt?: Vector3;
  clouds: boolean;
  cloudShadows?: boolean;
}

export const environmentFixture = new WeakMap<object, EnvironmentFixture>();
export const environmentState = new WeakMap<object, {
  sceneTime: number;
  windTime: number;
  gust: number;
  direction: [number, number];
  trees: number;
  tufts: number;
}>();
