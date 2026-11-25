import type { Part, RuntimeWeapon } from "../../simulation/types";
import type { WeaponConfig } from "../../data/weapons";

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

export interface LocalAnchor extends Point3 {
  yaw: number;
}

export interface ActorPose extends Point3 {
  heading: number;
  bank: number;
  vx: number;
  vz: number;
}

export function localToWorld(pose: ActorPose, anchor: LocalAnchor) {
  const rollCos = Math.cos(pose.bank);
  const rollSin = Math.sin(pose.bank);
  const headingCos = Math.cos(pose.heading);
  const headingSin = Math.sin(pose.heading);
  const x = anchor.x * rollCos - anchor.y * rollSin;
  const y = anchor.x * rollSin + anchor.y * rollCos;
  const directionX = Math.sin(anchor.yaw) * rollCos;
  const directionZ = Math.cos(anchor.yaw);
  return {
    x: pose.x + x * headingCos + anchor.z * headingSin,
    y: pose.y + y,
    z: pose.z - x * headingSin + anchor.z * headingCos,
    heading: pose.heading,
    bank: pose.bank,
    direction: {
      x: directionX * headingCos + directionZ * headingSin,
      y: Math.sin(anchor.yaw) * rollSin,
      z: -directionX * headingSin + directionZ * headingCos,
    },
    velocity: { x: pose.vx, y: 0, z: pose.vz },
  };
}

export function partAnchor(part: Pick<Part, "x" | "y" | "z" | "kind">): LocalAnchor {
  return { x: part.x, y: part.y ?? 0, z: part.z, yaw: part.kind === "tailGun" ? Math.PI : 0 };
}

export function engineOutlet(part: Part): LocalAnchor {
  if (part.outletOffset) return { x: part.x + part.outletOffset.x, y: (part.y ?? 0) + part.outletOffset.y,
    z: part.z + part.outletOffset.z, yaw: Math.PI };
  const pusher = part.engineInstallation === "pusher";
  return { ...partAnchor(part), z: part.z + (pusher ? .74 : -.74), yaw: pusher ? 0 : Math.PI };
}

export function mountOffset(part: Part, weapon: WeaponConfig): Point3 {
  if (part.role === "turret") return { x: 0, y: .18, z: .9 };
  if (part.role === "bay") return { x: 0, y: -.22, z: 0 };
  if (part.role === "wing") return { x: 0, y: .06, z: .56 };
  if (part.role === "body") return { x: 0, y: .23, z: .9 };
  return { x: 0, y: 0, z: part.kind === "cannon" ? 1.15 : weapon.category === "area" ? 0 : .825 };
}

export function muzzleAnchor(part: Part, weapon: RuntimeWeapon, heading: number, index: number): LocalAnchor {
  const anchor = partAnchor(part);
  const yaw = weapon.config.category === "turret" ? weapon.heading - heading : weapon.baseAngle;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const offset = (index - (weapon.config.count - 1) * .5) * weapon.barrelSpacing;
  return {
    x: anchor.x + weapon.offset.x + offset * cos + weapon.offset.z * sin,
    y: anchor.y + weapon.offset.y,
    z: anchor.z - offset * sin + weapon.offset.z * cos,
    yaw,
  };
}
