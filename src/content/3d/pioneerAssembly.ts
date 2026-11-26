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
export const wingId = (side: number) => (side > 0 ? "left_wing" : "right_wing");

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
  private skinGroups = new Set<string>();
  private counts = new Map<string, number>();
  private sheets = new Map<string, THREE.Group>();
  constructor(private ctx: AircraftModelContext) {}

  private sheet(part: string) {
    const owner = this.ctx.actor.parts.find(candidate => candidate.id === part)!;
    const { root, material } = this.ctx.partRoot(owner);
    let sheet = this.sheets.get(part);
    if (!sheet) {
      root.position.set(owner.x, owner.y ?? 0, owner.z);
      sheet = new THREE.Group();
      // Sheet x is positive to starboard, which points toward scene -X.
      sheet.scale.x = -1;
      sheet.position.copy(root.position).negate();
      root.add(sheet);
      this.sheets.set(part, sheet);
    }
    return { owner, material, sheet };
  }

  private mark(part: string, group: string, kind: "wingTip" | "tailTip" | "wingFlow" | "protrusion", p: Point3, end?: Point3, halfSpan?: Point3) {
    const { sheet } = this.sheet(part);
    const key = [part, group, kind].join("/");
    const index = this.counts.get(key) ?? 0;
    this.counts.set(key, index + 1);
    this.ctx.effectSites.add(part, group + "-" + kind + "-" + index, kind, sheet, p,
      end ? { end, halfSpan } : {});
  }

  private add(part: string, group: string, finish: string, shape: () => THREE.BufferGeometry) {
    const key = [part, group, finish].join("/");
    let batch = this.batches.get(key);
    if (!batch) this.batches.set(key, (batch = { part, group, finish, shapes: [] }));
    batch.shapes.push(shape);
  }
  finish() {
    for (const [key, { part, finish, group, shapes }] of this.batches) {
      const { owner, sheet, material } = this.sheet(part);
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
      const mesh = this.ctx.mesh(
        geometry,
        finish === linen ? material : this.ctx.partPaint(owner, finish),
        sheet,
      );
      mesh.name = group;
      if (this.skinGroups.has(key) || ["crankcase", "engine-block", "hull", "engine"].includes(group))
        this.ctx.effectSites.surfaces.push({ partId: part, mesh });
    }
  }
  rod(part: string, a: Point3, b: Point3, radius = 0.037, finish = wood, group = "struts") {
    if (group === "outer-post") this.mark(part, group, "protrusion", a[1] > b[1] ? a : b);
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
  protrusion(part: string, name: string, point: Point3) {
    this.mark(part, name, "protrusion", point);
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
    this.skinGroups.add([part, group, linen].join("/"));
    const [span, fore, aft, height] = ribs.reduce((outer, rib) => rib[0] > outer[0] ? rib : outer);
    const tip: Point3 = [side*span, height-(fore-aft)*incidence, aft];
    this.mark(part, group, part === "tail" || part === "nose" ? "tailTip" : group === "outer-cell-aileron" ? "protrusion" : "wingTip", tip);
    const atSpan = (fraction: number) => {
      const x = ribs[0][0] + (span-ribs[0][0])*fraction;
      const end = ribs.findIndex(rib => rib[0] >= x);
      const a = ribs[Math.max(0,end-1)], b = ribs[end];
      const t = (x-a[0]) / (b[0]-a[0] || 1);
      const fore = THREE.MathUtils.lerp(a[1],b[1],t), aft = THREE.MathUtils.lerp(a[2],b[2],t);
      const y = THREE.MathUtils.lerp(a[3],b[3],t);
      return {front:new THREE.Vector3(side*x,y,fore), rear:new THREE.Vector3(side*x,y-(fore-aft)*incidence,aft)};
    };
    const inner = atSpan(.18), outer = atSpan(.82);
    const halfSpan = outer.rear.clone().sub(inner.rear).multiplyScalar(.5);
    this.mark(part,group,"wingFlow",inner.front.lerp(outer.front,.5).toArray(),
      inner.rear.lerp(outer.rear,.5).toArray(),halfSpan.toArray());
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
    this.skinGroups.add([part, group, linen].join("/"));
    const [z, y] = outline.reduce((top, p) => p[1] > top[1] || (p[1] === top[1] && p[0] < top[0]) ? p : top);
    this.mark(part, group, "protrusion", [x, y, z]);
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
    const { owner, sheet } = this.sheet(part);
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
      sheet,
      ...hub,
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
        this.mark(part, "interplane-post", "protrusion", b);
        if (prev) {
          this.wire(part, prev[0], b);
          this.wire(part, prev[1], a);
        }
        prev = [a, b];
      }
    }
  }
}
