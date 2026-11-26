import * as THREE from "three";
import type { Part } from "../../simulation/types";
import { muzzleAnchor } from "./anchors";
import type { AircraftModelContext } from "./aircraftModels";

/** Builds the equipment installed on top of a reference airframe. */
export function buildAircraftFitting(context: AircraftModelContext, part: Part) {
  const { root, material } = context.partRoot(part);
  root.position.set(part.x, part.y ?? 0, part.z);
  const cache = (key: string, make: () => THREE.BufferGeometry) => context.geometry("aircraft:fitting:" + key, make);
  const metal = context.paint("#4a5258");
  const size = part.role === "wing" ? [part.centerline?.segmentLength ?? .85, .11, .8] as const
    : part.role === "gun" || part.role === "turret" ? [.26, .22, .5] as const
    : [.48, .26, .56] as const;
  const housing = context.mesh(cache(size.join(":"), () => new THREE.BoxGeometry(...size)), material, root);
  housing.name = part.kind + "-fitting";
  context.effectSites.surfaces.push({ partId: part.id, mesh: housing });
  if (part.role === "engine") {
    const blade = context.mesh(cache("propeller", () => new THREE.BoxGeometry(.1, 1.45, .035)), metal, root, 0, 0, .34);
    context.registerPropeller(blade, part);
  }
  for (const weapon of context.actor.weapons.filter(weapon => weapon.partId === part.id && weapon.config.category !== "area")) {
    for (let index = 0; index < weapon.config.count; index++) {
      const muzzle = muzzleAnchor(part, weapon, context.actor.heading, index);
      const barrel = context.mesh(cache("barrel", () => new THREE.CylinderGeometry(.04, .055, .46, 8).rotateX(Math.PI / 2)),
        metal, root, muzzle.x - root.position.x - Math.sin(muzzle.yaw) * .23,
        muzzle.y - root.position.y, muzzle.z - root.position.z - Math.cos(muzzle.yaw) * .23);
      barrel.rotation.y = muzzle.yaw;
      context.effectSites.add(part.id, weapon.anchorId + "-casing-" + index, "casing", barrel, [0, -.05, -.17],
        { direction: [0, -1, 0], basis: "configuredFallback" });
    }
  }
}
