import type { Vector3 } from "three";

export interface CloudDiagnostics {
  clusters: number;
  volumes: number;
  mode: "puffs" | "shell" | "volume";
  cpuMs: number;
  rayMarchCpuMs: number;
  veil: number;
}

export const cloudDiagnostics = new WeakMap<object, CloudDiagnostics>();

export interface EnvironmentFixture {
  camera?: Vector3;
  lookAt?: Vector3;
  cloud?: Vector3 | false;
  volumes: boolean;
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
