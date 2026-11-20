import type { PerspectiveCamera } from "three";
import { RULES } from "../data/config";
import { RAD } from "../services/Random";

export function frameBattleCamera(
  camera: PerspectiveCamera,
  x: number,
  z: number,
  bombingBlend: number,
) {
  const cruise = RULES.camera;
  const bombing = cruise.bombing;
  const pitch = (cruise.pitch + (bombing.pitch - cruise.pitch) * bombingBlend) * RAD;
  const distance = cruise.distance + (bombing.distance - cruise.distance) * bombingBlend;
  const fov = cruise.fov + (bombing.fov - cruise.fov) * bombingBlend;
  if (camera.fov !== fov) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  const aspectScale = camera.aspect < 0.55 ? 1.12 : 1;
  camera.position.set(
    x,
    RULES.flightAltitude + Math.sin(pitch) * distance * aspectScale,
    z - Math.cos(pitch) * distance * aspectScale,
  );
  camera.lookAt(x, RULES.flightAltitude, z);
  camera.updateMatrixWorld();
}
