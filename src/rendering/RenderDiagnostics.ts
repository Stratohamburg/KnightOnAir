import type { Vector3 } from "three";

export interface CloudDiagnostics {
  enabled: boolean;
  mode: "sdf" | "mesh";
  resolution: [number, number];
  samples: number;
  groups: number;
  triangles: number;
  wisps: number;
  wakeSegments: number;
  cpuMs: number;
  cloudPassCpuMs: number;
  rayMarchCpuMs: number;
  cameraDensity: number;
  playerDensity: number;
  windDirection: [number, number];
  windSpeed: number;
  drift: [number, number];
  morphTime: number;
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
