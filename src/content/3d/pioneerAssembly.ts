import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { AircraftModelContext } from "./aircraftModels";

export type Point3 = [x: number, y: number, z: number];
// Half-span station, leading edge, trailing edge and leading-edge height, in metres.
export type Rib = [x: number, leading: number, trailing: number, y: number];
export type HullRing = [z: number, halfWidth: number, bottom: number, deck: number];
export const linen = "#e8d2a0",
  wood = "#91673f",
  cable = "#42484b",
  iron = "#59616a";
export const sides = [-1, 1] as const;
export const wingId = (side: number) => (side < 0 ? "left_wing" : "right_wing");

function loft(rings: Point3[][]) {
  const vertices = rings.flat();
  const faces: number[] = [];
  const count = rings[0].length;
  const end = vertices.length - count;
  for (let j = 1; j < count - 1; j++) faces.push(0, j + 1, j, end, end + j, end + j + 1);
  for (let i = 0; i < end; i++) {
    const next = i % count === count - 1 ? i - count + 1 : i + 1;
    faces.push(i, next, i + count, next, next + count, i + count);
  }
  // Mirroring half wings or changing the loft axis reverses the winding.
  let volume = 0;
  for (let i = 0; i < faces.length; i += 3) {
    const [a, b, c] = faces.slice(i, i + 3).map((index) => vertices[index]);
    volume +=
      a[0] * (b[1] * c[2] - b[2] * c[1]) + a[1] * (b[2] * c[0] - b[0] * c[2]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
  }
  if (volume < 0) faces.reverse();
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      faces.flatMap((index) => vertices[index]),
      3,
    ),
  );
  g.computeVertexNormals();
  return g;
}

type Batch = { part: string; finish: string; group: string; shapes: (() => THREE.BufferGeometry)[] };
export class PioneerAssembly {
  private batches = new Map<string, Batch>();
  constructor(private ctx: AircraftModelContext) {}

  private add(part: string, group: string, finish: string, shape: () => THREE.BufferGeometry) {
    const key = [part, group, finish].join("/");
    let batch = this.batches.get(key);
    if (!batch) this.batches.set(key, (batch = { part, group, finish, shapes: [] }));
    batch.shapes.push(shape);
  }
  finish() {
    // Sheet x is positive to starboard. In a right-handed Three.js scene
    // with nose +Z and up +Y, starboard points toward scene -X.
    const center = this.ctx.actor.parts.find((part) => part.id === "center_body")!;
    this.ctx.partRoot(center).root.parent!.scale.x = -1;
    for (const [key, { part, finish, group, shapes }] of this.batches) {
      const owner = this.ctx.actor.parts.find((p) => p.id === part)!;
      const { root, material } = this.ctx.partRoot(owner);
      root.position.set(owner.x, owner.y ?? 0, owner.z);
      const geometry = this.ctx.geometry(this.ctx.frame.id + "/" + key, () => {
        const pieces = shapes.map((create) => {
          let piece = create();
          if (piece.index) {
            const flat = piece.toNonIndexed();
            piece.dispose();
            piece = flat;
          }
          piece.deleteAttribute("uv");
          return piece;
        });
        const merged = mergeGeometries(pieces)!;
        pieces.forEach((piece) => piece.dispose());
        return merged;
      });
      this.ctx.mesh(
        geometry,
        finish === linen ? material : this.ctx.partPaint(owner, finish),
        root,
        -owner.x,
        -(owner.y ?? 0),
        -owner.z,
      ).name = group;
    }
  }
  rod(part: string, a: Point3, b: Point3, radius = 0.037, finish = wood, group = "struts") {
    this.add(part, group, finish, () => {
      const start = new THREE.Vector3(...a),
        end = new THREE.Vector3(...b);
      const direction = end.clone().sub(start);
      const g = new THREE.CylinderGeometry(radius, radius, direction.length(), 6);
      g.applyQuaternion(
        new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()),
      );
      return g.translate(...start.lerp(end, 0.5).toArray());
    });
  }
  wire(part: string, a: Point3, b: Point3, r = 0.014) {
    this.rod(part, a, b, r, cable, "rigging");
  }
  box(part: string, center: Point3, size: Point3, finish = wood, group = "frame") {
    this.add(part, group, finish, () => new THREE.BoxGeometry(...size).translate(...center));
  }
  ball(part: string, center: Point3, radii: Point3, finish: string, group: string) {
    this.add(part, group, finish, () => new THREE.SphereGeometry(1, 14, 10).scale(...radii).translate(...center));
  }
  wing(
    part: string,
    side: number,
    ribs: Rib[],
    group = "wing-cover",
    camber = 0.045,
    incidence = 0.045,
    thickness = 0.023,
  ) {
    const profile = [
      [0, 0],
      [0.12, 0.63],
      [0.346, 1],
      [0.68, 0.63],
      [1, 0],
      [0.99, -0.1],
      [0.68, 0.63],
      [0.346, 1],
      [0.12, 0.63],
      [0, 0],
    ];
    this.add(part, group, linen, () =>
      loft(
        ribs.map(([x, front, back, y]) =>
          profile.map(([f, h], i) => {
            const chord = front - back;
            return [
              side * x,
              y +
                chord *
                  (h * camber - incidence * f - (i > 4 ? thickness * (0.25 + 0.75 * Math.sin(Math.PI * f)) : 0)),
              front - f * chord,
            ];
          }),
        ),
      ),
    );
  }
  fin(part: string, x: number, outline: [z: number, y: number][], group = "rudder", depth = 0.04) {
    this.add(part, group, linen, () =>
      loft(sides.map((side) => outline.map(([z, y]) => [x + (side * depth) / 2, y, z]))),
    );
  }
  // Open deck intervals leave a real cockpit well between the coamings.
  hull(part: string, rings: HullRing[], finish: string, rounded: boolean, wells: number[] = []) {
    this.add(part, "hull", finish, () => {
      const profiles = rings.map(([z, w, b, t]) => {
        const section = rounded
          ? [
              [-0.6, 0.92],
              [-0.95, 0.67],
              [-1, 0.43],
              [-0.77, 0.13],
              [-0.3, 0],
              [0.3, 0],
              [0.77, 0.13],
              [1, 0.43],
              [0.95, 0.67],
              [0.6, 0.92],
              [0, 1],
            ]
          : [
              [-0.86, 1],
              [-1, 0.8],
              [-0.91, 0.12],
              [-0.65, 0],
              [0.65, 0],
              [0.91, 0.12],
              [1, 0.8],
              [0.86, 1],
              [0, 1],
            ];
        return section.map(([x, h]): Point3 => [x * w, b + (t - b) * h, z]);
      });
      // At cockpit stations the deck folds inward to a recessed floor.
      const sections: Point3[][] = [];
      for (let i = 0; i < profiles.length; i++) {
        const ring = profiles[i];
        const rim = rounded ? 0.6 : 0.86;
        const [z, w, b, t] = rings[i];
        const deck = (open: boolean): Point3[] => [
          ...ring.slice(0, -1),
          [w * rim * 0.91, open ? b + (t - b) * 0.3 : t, z],
          [-w * rim * 0.91, open ? b + (t - b) * 0.3 : t, z],
        ];
        if (i > 0) sections.push(deck(wells.includes(i - 1)));
        if (i === 0 || (i + 1 < profiles.length && wells.includes(i) !== wells.includes(i - 1)))
          sections.push(deck(wells.includes(i)));
      }
      return loft(sections);
    });
  }
  wheel(part: string, center: Point3, r: number) {
    const [x, y, z] = center;
    this.add(part, "rims", cable, () =>
      new THREE.TorusGeometry(r * 0.91, r * 0.09, 6, 20).rotateY(Math.PI / 2).translate(x, y, z),
    );
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * i) / 4;
      this.rod(
        part,
        center,
        [x, y + r * 0.91 * Math.cos(angle), z + r * 0.91 * Math.sin(angle)],
        Math.max(0.009, r * 0.037),
        iron,
        "spokes",
      );
    }
  }
  gear(part: string, x: number, y: number, z: number, r: number, fore: Point3, aft: Point3) {
    for (const s of sides) {
      const hub: Point3 = [s * x, y, z];
      this.wheel(part, hub, r);
      for (const [w, h, d] of [fore, aft]) this.rod(part, [s * w, h, d], hub);
    }
    this.rod(part, [-x, y, z], [x, y, z], 0.032, iron, "axle");
  }
  prop(part: string, hub: Point3, r: number, angle = 0.55, direction = 1) {
    const owner = this.ctx.actor.parts.find((p) => p.id === part)!;
    const { root } = this.ctx.partRoot(owner);
    root.position.set(owner.x, owner.y ?? 0, owner.z);
    const geometry = this.ctx.geometry("pioneer/propeller", () =>
      loft(
        [
          [-1, 0.014, -0.014],
          [-0.88, 0.058, -0.02],
          [-0.53, 0.075, -0.016],
          [-0.12, 0.035, 0],
          [0.12, 0.035, 0],
          [0.53, 0.075, 0.016],
          [0.88, 0.058, 0.02],
          [1, 0.014, 0.014],
        ].map(([y, w, x]) => [
          [x - w, y, -0.011],
          [x + w, y, -0.005],
          [x + w, y, 0.012],
          [x - w, y, 0.009],
        ]),
      ),
    );
    const blade = this.ctx.mesh(
      geometry,
      this.ctx.partPaint(owner, wood),
      root,
      hub[0] - owner.x,
      hub[1] - (owner.y ?? 0),
      hub[2] - owner.z,
    );
    blade.name = "propeller";
    blade.scale.setScalar(r);
    blade.rotation.z = angle;
    this.ctx.registerPropeller(blade, owner, direction);
    this.ball(part, hub, [r * 0.095, r * 0.095, r * 0.09], iron, "hub");
  }
  stays(
    side: number,
    stations: [lowerX: number, upperX: number][],
    bottom: number,
    top: number,
    front: number,
    rear: number,
    stagger = 0,
  ) {
    const part = wingId(side);
    for (const z of [front, rear]) {
      let prev: [Point3, Point3] | undefined;
      for (const [low, high] of stations) {
        const a: Point3 = [side * low, bottom, z],
          b: Point3 = [side * high, top, z + stagger];
        this.rod(part, a, b);
        if (prev) {
          this.wire(part, prev[0], b);
          this.wire(part, prev[1], a);
        }
        prev = [a, b];
      }
    }
  }
}
