import { Box3, Vector3, type PerspectiveCamera } from "three";
import { RULES } from "../data/config";
import { clamp, damp, RAD } from "../services/Random";

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

export class UpgradeCamera {
  private readonly focus = new Vector3();
  private readonly target = new Vector3();
  private readonly right = new Vector3();
  private readonly up = new Vector3();
  private readonly forward = new Vector3();
  private distance = 0;
  private amount = 0;

  reset() {
    this.amount = 0;
  }

  update(
    camera: PerspectiveCamera, x: number, z: number, dt: number,
    bounds?: { aircraft: Box3; affected: Box3 }, shake = 0,
  ) {
    if (!bounds && this.amount === 0) return;
    this.forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
    this.up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    this.right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    const center = new Vector3(x, RULES.flightAltitude, z);
    const baseDistance = camera.position.distanceTo(center);
    const halfFov = Math.tan(camera.fov * RAD / 2);
    if (bounds && !bounds.aircraft.isEmpty()) {
      const { aircraft, affected } = bounds;
      aircraft.getCenter(this.target);
      const size = aircraft.getSize(new Vector3());
      if (!affected.isEmpty()) {
        const part = affected.getCenter(new Vector3());
        const edge = part.distanceTo(this.target);
        this.target.lerp(part, clamp(edge / (4.5 * Math.max(.7, camera.aspect)), .22, .86));
      }
      const focusRadius = affected.isEmpty() ? 0 : affected.getSize(new Vector3()).length() * .5;
      const fitWidth = (size.x * .5) / (halfFov * camera.aspect * 1.15);
      const fitHeight = (size.y + size.z * Math.abs(this.up.z)) * .5 / (halfFov * .5);
      const fitPart = focusRadius / (halfFov * Math.min(camera.aspect, .7) * .72);
      const desired = Math.max(baseDistance * .48, Math.min(baseDistance * .95, Math.max(fitWidth, fitHeight)), fitPart);
      this.target.addScaledVector(this.up, -.34 * halfFov * desired);
      if (this.amount === 0) {
        this.focus.copy(this.target);
        this.distance = desired;
      } else {
        this.focus.lerp(this.target, 1 - Math.exp(-7 * dt));
        this.distance = damp(this.distance, desired, 7, dt);
      }
    }
    this.amount = damp(this.amount, bounds ? 1 : 0, 6.5, dt);
    if (!bounds && this.amount < .002) this.amount = 0;
    camera.position.lerp(this.target.copy(this.focus).addScaledVector(this.forward, -this.distance), this.amount);
    camera.position.addScaledVector(this.right, shake);
    camera.updateMatrixWorld();
  }
}
