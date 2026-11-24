import { bayOutline, clipOutline, elevatorHalf, finOutline, hull, hullAt, hullBays, mirroredOutline, rib, rudderPivot, stabilizerHalf, stationZ, unit, wingPanels, wingSegments, type Point, type Wing } from "../../data/fokkerDr1Sheet";
import * as THREE from "three";
import type { Airframe } from "../../data/aircrafts";
import type { Part, Player, Enemy } from "../../simulation/types";
import { aircraftGeometryProfile, type AircraftGeometryProfile } from "./airframeShape";
import { muzzleAnchor, partAnchor } from "./anchors";

export interface AircraftModelContext {
  actor: Player | Enemy;
  frame: Airframe;
  stats: { length: number; wingspan: number };
  profile: AircraftGeometryProfile;
  group: THREE.Group;
  handledParts: Set<string>;
  partRoot(part: Part): { root: THREE.Group; material: THREE.ShaderMaterial };
  geometry<T extends THREE.BufferGeometry>(key: string, create: () => T): T;
  paint(color: string, accent?: boolean): THREE.ShaderMaterial;
  mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D, x?: number, y?: number, z?: number): THREE.Mesh;
  registerPropeller(mesh: THREE.Mesh, part: Part): void;
}

export type AircraftModelBuilder = (context: AircraftModelContext) => void;

function plateGeometry(points: THREE.Vector2[], depth: number) {
  return new THREE.ExtrudeGeometry(new THREE.Shape(points), {
    depth, bevelEnabled: false, steps: 1,
  });
}

// Cut the plan into chordwise bands at the measured rib ordinates. Each band
// has a cambered top and bottom. Only the perimeter needs a closing wall.
function wingSkin(outline: Point[], wing: Wing, lateralScale: number) {
  const chord = wing.trailing - wing.leading;
  const vertices: number[] = [];
  const indices: number[] = [];
  const faces = THREE.ShapeUtils.triangulateShape(outline.map(([x,s]) => new THREE.Vector2(x,s)), []);
  const bands = rib.map(([f, top, bottom]) => ({ s: wing.leading + f*chord, top, bottom }));
  bands.push({s: Math.max(wing.trailing, ...outline.map(p => p[1])) + 1, top: .003, bottom: .001});
  const mirrored = lateralScale < 0;
  const triangle = (a: number, b: number, c: number) => indices.push(a, mirrored ? c : b, mirrored ? b : c);
  for (let i = 1; i < bands.length; i++) {
    const a = bands[i-1], b = bands[i];
    const pair = ([x,s]: Point) => {
      const t = (s-a.s)/(b.s-a.s);
      const top = THREE.MathUtils.lerp(a.top, b.top, t)*chord*unit;
      const bottom = THREE.MathUtils.lerp(a.bottom, b.bottom, t)*chord*unit;
      const index = vertices.length / 3;
      vertices.push(x*lateralScale, top, stationZ(s), x*lateralScale, bottom, stationZ(s));
      return index;
    };
    for (const face of faces) {
      const strip = clipOutline(clipOutline(face.map(j => outline[j]), 1, a.s, true), 1, b.s, false);
      const row = strip.map(pair);
      for (let j = 2; j < row.length; j++) {
        triangle(row[0], row[j-1], row[j]);
        triangle(row[0]+1, row[j]+1, row[j-1]+1);
      }
    }
    for (let j = 0; j < outline.length; j++) {
      const start = outline[j], end = outline[(j+1) % outline.length];
      const ds = end[1] - start[1];
      if (ds === 0 && (start[1] < a.s || start[1] >= b.s)) continue;
      const t0 = ds ? (a.s-start[1])/ds : 0;
      const t1 = ds ? (b.s-start[1])/ds : 1;
      const from = Math.max(0, Math.min(t0,t1)), to = Math.min(1, Math.max(t0,t1));
      if (from >= to) continue;
      const edge = (t: number): Point => [THREE.MathUtils.lerp(start[0],end[0],t), start[1]+t*ds];
      const left = pair(edge(from)), right = pair(edge(to));
      triangle(left,right+1,right);
      triangle(left,left+1,right+1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function hullGeometry(start: number, end: number) {
  const vertices: number[] = [];
  const indices: number[] = [];
  const segments = 24;
  const stations = [...new Set([...hull.map(p => p.s), start, end, 85, 88, 91, 97, 103, 106, 109])].filter(s => s >= start && s <= end).sort((a,b) => a-b);
  const stride = segments + 1;
  for (const station of stations) {
    const { w: width, deck, belly } = hullAt(station);
    const cockpitWidth = 10 * Math.sqrt(Math.max(0, 1 - ((station - 97) / 12) ** 2));
    const cut = Math.asin(cockpitWidth / width);
    for (let i = 0; i <= segments; i++) {
      const angle = Math.PI / 2 + cut + (2 * Math.PI - 2 * cut) * i / segments;
      vertices.push(unit * width * Math.cos(angle),
        unit * (deck + belly + (deck - belly) * Math.sin(angle)) / 2, stationZ(station));
    }
  }
  const last = (stations.length - 1) * stride;
  for (let i = 0; i < segments; i++) {
    for (let ring = 0; ring < last; ring += stride) {
      const a = ring + i, b = a + 1;
      indices.push(a, a + stride, b, b, a + stride, b + stride);
    }
    if (i > 0 && i < segments - 1) {
      if (start === hull[0].s) indices.push(0, i, i+1);
      if (end === hull[hull.length-1].s) indices.push(last, last+i+1, last+i);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function cylinderBetween(
  context: AircraftModelContext,
  parent: THREE.Object3D,
  material: THREE.Material,
  key: string,
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
) {
  const delta = end.clone().sub(start);
  const length = delta.length();
  const geometry = context.geometry(key + ":" + length.toFixed(3) + ":" + radius.toFixed(3), () => new THREE.CylinderGeometry(radius, radius * 1.1, length, 6));
  const mesh = context.mesh(geometry, material, parent, (start.x + end.x) / 2, (start.y + end.y) / 2, (start.z + end.z) / 2);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  return mesh;
}

function partById(context: AircraftModelContext, id: string) {
  return context.actor.parts.find((part) => part.id === id);
}

function mark(context: AircraftModelContext, ...ids: string[]) {
  ids.forEach((id) => context.handledParts.add(id));
}

export function buildFokkerDr1Model(context: AircraftModelContext) {
  const { frame } = context;
  const trim = context.paint(frame.accent, true);
  const metal = context.paint("#46535a");
  const wood = context.paint("#8f5b3e");
  const glass = context.paint("#1a2b2c");
  const centerPart = partById(context, "center_body");
  const tailPart = partById(context, "tail");
  const gearPart = partById(context, "landing_gear");
  const enginePart = partById(context, "engine_0");
  const nosePart = partById(context, "nose");
  const leftWing = partById(context, "left_wing");
  const rightWing = partById(context, "right_wing");
  if (!centerPart || !tailPart || !gearPart || !enginePart || !leftWing || !rightWing) return;

  const center = context.partRoot(centerPart);
  const cached = (key: string, create: () => THREE.BufferGeometry) =>
    context.geometry("aircraft:dr1:sheet:" + key, create);
  const shell = new THREE.Group();
  shell.name = "dr1-hull";
  center.root.add(shell);
  const tinted = (color: string, weight: number) => context.paint("#" +
    new THREE.Color(frame.color).lerp(new THREE.Color(color), weight).getHexString());
  const bayMaterials = { cowling: metal, forward: tinted("#414047", .32), cockpit: center.material,
    aft: tinted("#d3bfac", .22), tailpost: center.material };
  for (const bay of hullBays) {
    const geometry = cached("hull:" + bay.id, () => hullGeometry(bay.start, bay.end));
    context.mesh(geometry, bayMaterials[bay.id], shell).name = "dr1-hull-" + bay.id;
  }
  const controlFabric = tinted("#d3ad84", .38);
  const cockpit = context.mesh(cached("cockpit", () => new THREE.SphereGeometry(1, 16, 8)),
    glass, center.root, 0, 8 * unit, stationZ(97));
  cockpit.scale.set(11 * unit, 3 * unit, 13 * unit);
  mark(context, "center_body");

  for (const part of context.actor.parts) {
    if (part.role !== "wing") continue;
    const segment = wingSegments.find(candidate => candidate.id === part.id);
    const section = part.silhouette?.[0];
    if (!section?.length) continue;
    if (!segment) {
      if (part.centerline?.segmentRole !== "insert") continue;
      const terminal = wingSegments.find(candidate => candidate.lineId === part.centerline?.lineId && candidate.role === "tip");
      if (!terminal) continue;
      const {root, material} = context.partRoot(part);
      const width = part.centerline.segmentLength!;
      const wing = terminal.wing;
      const outline: Point[] = [[0,wing.leading],[width/unit,wing.leading],[width/unit,wing.trailing],[0,wing.trailing]];
      const geometry = cached(["extension", wing.id, width, terminal.side].join(":"),
        () => wingSkin(outline, wing, terminal.side*unit));
      context.mesh(geometry, material, root, part.x-terminal.side*width/2, wing.height*unit)
        .name = "dr1-wing-extension";
      const weapon = context.actor.weapons.find(candidate => candidate.partId === part.id);
      if (weapon) {
        const muzzle = muzzleAnchor(part, weapon, context.actor.heading, 0);
        context.mesh(cached("wing-gun-cradle", () => new THREE.BoxGeometry(.22, .13, .4)),
          material, root, muzzle.x, muzzle.y - .08, muzzle.z - .37);
        const barrel = context.mesh(cached("wing-gun", () => new THREE.CylinderGeometry(.024, .032, .48, 8)),
          metal, root, muzzle.x, muzzle.y, muzzle.z - .24);
        barrel.name = "dr1-wing-gun";
        barrel.rotation.x = Math.PI / 2;
      }
      mark(context, part.id);
      continue;
    }

    const { wing, side } = segment;
    const bounds = section.map(p => Math.abs(p.x));
    const inner = Math.min(...bounds);
    const scale = (Math.max(...bounds) - inner) / (segment.end - segment.start);
    const {root, material} = context.partRoot(part);
    const group = new THREE.Group();
    group.name = "dr1-wing-" + wing.id;
    group.position.set(side*(inner-segment.start*scale), wing.height*unit, 0);
    root.add(group);
    for (const panel of wingPanels(wing)) {
      const outline = bayOutline(panel.outline, segment.start, segment.end);
      if (outline.length < 3) continue;
      const key = [segment.id, panel.id, scale].join(":");
      const geometry = cached(key, () => wingSkin(outline, wing, side * scale));
      // Tint the part's own finish so highlight and damage still affect every fixed bay.
      if (panel.id === "fixed" && segment.role !== "main")
        material.uniforms.baseColor.value.multiplyScalar(segment.role === "root" ? .75 : .91);
      context.mesh(geometry, panel.id === "fixed" ? material : controlFabric, group).name =
        panel.id === "aileron" ? "dr1-aileron-" + (side < 0 ? "left" : "right") : "dr1-wing-" + segment.role;
    }
    mark(context, part.id);
  }

  const point = (x: number, h: number, s: number) => new THREE.Vector3(x * unit, h * unit, stationZ(s));
  for (const side of [-1, 1]) {
    cylinderBetween(context, center.root, wood, "dr1-interplane",
      point(side * 109, -21, 74), point(side * 109, 63, 50), 1.3 * unit);
    for (const s of [37, 65]) {
      cylinderBetween(context, center.root, trim, "dr1-cabane",
        point(side * 14, 15, s + 6), point(side * 38, 63, s), unit);
    }
  }

  const tail = context.partRoot(tailPart);
  tail.root.position.z = tailPart.z;
  const tailplane = new THREE.Group();
  tailplane.name = "dr1-tailplane";
  tail.root.add(tailplane);
  const tailSkin = (outline: readonly Point[]) => plateGeometry(outline.map(([x,s]) =>
    new THREE.Vector2(x * unit, (s - 175) * unit)), 1.6 * unit).rotateX(-Math.PI / 2);
  context.mesh(cached("stabilizer", () => tailSkin(mirroredOutline(stabilizerHalf))),
    tail.material, tailplane, 0, 5.2 * unit).name = "dr1-stabilizer";
  for (const side of [-1, 1]) {
    const elevator = cached("elevator:" + side, () => tailSkin(elevatorHalf.map(([x,s]) => [side*x,s])));
    context.mesh(elevator, controlFabric, tailplane, 0, 5.2 * unit).name =
      "dr1-elevator-" + (side < 0 ? "left" : "right");
  }
  const fin = cached("fin", () => plateGeometry(finOutline.map(([s,h]) =>
    new THREE.Vector2((s - 175) * unit, h * unit)), 1.6 * unit).rotateY(Math.PI / 2));
  const rudder = new THREE.Group();
  rudder.name = "dr1-rudder";
  rudder.position.set(0, rudderPivot.foot * unit, (175 - rudderPivot.station) * unit);
  tail.root.add(rudder);
  context.mesh(fin, controlFabric, rudder, -.8 * unit, -rudder.position.y, -rudder.position.z).name = "dr1-fin";
  cylinderBetween(context, tail.root, metal, "dr1-rudder-pin",
    rudder.position.clone().add(new THREE.Vector3(0,-3*unit,0)),
    rudder.position.clone().add(new THREE.Vector3(0,5*unit,0)), 1.6*unit);
  mark(context, tailPart.id);

  const gear = context.partRoot(gearPart);
  const axle = point(0, -55, 42);
  gear.root.position.copy(axle);
  for (const side of [-1, 1]) {
    const wheelCenter = point(side * 34, -55, 42).sub(axle);
    for (const s of [17, 78]) {
      cylinderBetween(context, gear.root, trim, "dr1-gear-leg",
        point(side * 15, -15, s).sub(axle), wheelCenter, 1.2 * unit);
    }
    const wheel = context.mesh(cached("wheel", () =>
      new THREE.CylinderGeometry(13 * unit, 13 * unit, 4 * unit, 20)),
      metal, gear.root, wheelCenter.x);
    wheel.rotation.z = Math.PI / 2;
  }
  cylinderBetween(context, gear.root, metal, "dr1-axle",
    point(-34, -55, 42).sub(axle), point(34, -55, 42).sub(axle), 1.5 * unit);
  mark(context, gearPart.id);

  const engine = context.partRoot(enginePart);
  engine.root.position.set(enginePart.x, enginePart.y ?? 0, enginePart.z);
  const engineOffset = (s: number) => stationZ(s) - stationZ(12);
  const ring = cached("cowl-rim", () => new THREE.TorusGeometry(17 * unit, unit, 6, 24));
  context.mesh(ring, trim, engine.root, 0, 0, engineOffset(8));
  const cylinder = cached("radial-cylinder", () => new THREE.CylinderGeometry(2 * unit, 2.5 * unit, 10 * unit, 8));
  for (let i = 0; i < 9; i++) {
    const angle = 2 * Math.PI * i / 9;
    const piston = context.mesh(cylinder, metal, engine.root, 10 * unit * Math.cos(angle),
      10 * unit * Math.sin(angle), engineOffset(6));
    piston.rotation.z = angle - Math.PI / 2;
  }
  const hub = context.mesh(cached("hub", () =>
    new THREE.CylinderGeometry(3 * unit, 3 * unit, 8 * unit, 12)),
    metal, engine.root, 0, 0, engineOffset(4));
  hub.rotation.x = Math.PI / 2;
  const blade = cached("propeller", () => {
    const outline = [[0,58],[2,55],[3,42],[2,13],[1,3],[3,-36],[2,-54],[0,-58],
      [-2,-55],[-3,-42],[-2,-13],[-1,-3],[-3,36],[-2,54]];
    return plateGeometry(outline.map(([x,y]) => new THREE.Vector2(x * unit,y * unit)), unit);
  });
  const propeller = context.mesh(blade, wood, engine.root, 0, 0, engineOffset(0));
  propeller.rotation.z = -.66;
  context.registerPropeller(propeller, enginePart);
  mark(context, enginePart.id);

  if (nosePart) {
    const nose = context.partRoot(nosePart);
    nose.root.position.set(nosePart.x, nosePart.y ?? 0, nosePart.z);
    const weapon = context.actor.weapons.find(candidate => candidate.partId === nosePart.id);
    for (let i = 0; weapon && i < weapon.config.count; i++) {
      const muzzle = muzzleAnchor(nosePart, weapon, context.actor.heading, i);
      const barrel = context.mesh(cached("nose-gun", () => new THREE.CylinderGeometry(.025, .025, .7, 6)),
        metal, nose.root, muzzle.x - nosePart.x, muzzle.y - (nosePart.y ?? 0), muzzle.z - nosePart.z - .35);
      barrel.rotation.x = Math.PI / 2;
    }
    mark(context, "nose");
  }

  for (const part of context.actor.parts) {
    if (context.handledParts.has(part.id) ||
        !["cooler", "ammo", "armor", "bombBay", "engine"].includes(part.kind)) continue;
    const anchor = partAnchor(part);
    const { root, material } = context.partRoot(part);
    root.position.set(anchor.x, anchor.y, anchor.z);
    const box = (key: string, w: number, h: number, d: number, finish: THREE.Material, x = 0, y = 0, z = 0) =>
      context.mesh(cached(key, () => new THREE.BoxGeometry(w, h, d)), finish, root, x, y, z);
    if (part.kind === "cooler") {
      if (part.slot === "tail") {
        box("return-duct", .28, .13, .46, material);
        for (const x of [-.09, 0, .09]) box("return-fin", .025, .10, .34, metal, x, .09);
      } else {
        for (const side of [-1, 1]) {
          box("radiator", .15, .29, .56, material, side * .47);
          for (let i = 0; i < 5; i++)
            box("radiator-louver", .04, .22, .032, metal, side * .55, 0, (i - 2) * .086);
        }
      }
    } else if (part.kind === "ammo") {
      box("ammo-case", .42, .16, .35, metal);
      for (const x of [-.14, .14]) box("ammo-strap", .04, .18, .36, trim, x);
    } else if (part.kind === "armor") {
      for (const side of [-1, 1]) {
        const plate = box("armor-panel", .13, .58, .57, material, side * .36);
        plate.rotation.y = side * -.09;
        for (const z of [-.21, .21])
          box("armor-rivet", .028, .065, .065, metal, side * .43, .18, z);
      }
    } else if (part.kind === "bombBay") {
      box("bomb-rack", .50, .13, .70, material);
      for (const x of [-.15, .15]) box("bomb-rack-rail", .09, .13, .76, metal, x, -.09);
    } else if (part.kind === "engine") {
      const nacelle = context.mesh(cached("auxiliary-engine", () => new THREE.CylinderGeometry(.22, .28, .68, 10)),
        material, root);
      nacelle.rotation.x = Math.PI / 2;
      box("auxiliary-engine-bracket", .16, .24, .42, metal, 0, -.24, -.22);
      const auxiliaryProp = context.mesh(blade, wood, root, 0, 0, .39);
      auxiliaryProp.scale.set(.54, .54, .75);
      context.registerPropeller(auxiliaryProp, part);
    }
    mark(context, part.id);
  }
}

export const AIRCRAFT_MODEL_BUILDERS: Record<string, AircraftModelBuilder> = {
  fokkerDr1: buildFokkerDr1Model,
};

export function aircraftModelBuilder(id?: string) {
  return id ? AIRCRAFT_MODEL_BUILDERS[id] : undefined;
}

export function aircraftModelProfile(id?: string) {
  return id ? aircraftGeometryProfile(id) : undefined;
}
