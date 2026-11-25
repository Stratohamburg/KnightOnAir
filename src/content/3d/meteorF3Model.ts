import {
  meteorBody, meteorBodySection, meteorCanopy, meteorF3Frame, meteorFin, meteorInboardWing,
  meteorInlet, meteorNacelle, meteorOutboardWing, meteorOutlet, meteorTailplane, meteorTailSection,
  meteorUnit, meteorWingSection, meteorZ,
} from "../../data/meteorF3ModelSheet";
import { partFromRecipe } from "../../simulation/parts";
import type { AircraftModelContext } from "./aircraftModels";
import type { ReferenceAircraft } from "./AircraftFactory";
import { partAnchor } from "./anchors";

import { loft, type Vertex } from "./sectionLoft";
const vertex = (x: number, y: number, station: number): Vertex => [x * meteorUnit, y * meteorUnit, meteorZ(station)];

type WingRow = (typeof meteorInboardWing)[number];
type ChordSection = readonly (readonly [number, number, number])[];
function liftingSurface(rows: readonly WingRow[], section: ChordSection) {
  return loft(rows.map(({ span, fore, aft, high, low }) => {
    const at = (chord: number, height: number) => vertex(span, low + (high - low) * height, fore + (aft - fore) * chord);
    const upper = section.map(([chord, top]) => at(chord, top));
    const lower = section.slice(1).reverse().map(([chord, , bottom]) => at(chord, bottom));
    return [...upper, ...lower];
  // Both skins terminate at the same points. Separate normals keep the sharp
  // trailing edge from averaging the lighting of the upper and lower skins.
  }), true, true, section.length - 1);
}

const [frontStation, engineX] = meteorNacelle[0];
const [outletStation, outletX, outletY, outletRadius] = meteorNacelle[meteorNacelle.length - 1];

// Nacelle vertices are local to the inlet anchor. A measured circle is used in
// both axes at every station. Mirroring preserves the section and lip geometry.
function engineRing(station: number, centerX: number, height: number, radius: number) {
  return Array.from({ length: 24 }, (_, i): Vertex => {
    const angle = i * Math.PI / 12;
    return [
      (centerX - engineX + radius * Math.cos(angle)) * meteorUnit,
      (height + radius * Math.sin(angle)) * meteorUnit,
      (frontStation - station) * meteorUnit,
    ];
  });
}

export function buildMeteorF3Model(context: AircraftModelContext) {
  const { actor, geometry, mesh, paint, partRoot } = context;
  const paintGlass = paint("#30434a");
  const metal = paint(context.frame.accent);
  const dark = paint("#202a2d");
  const body = actor.parts.find(part => part.id === "center_body")!;
  const bodyRoot = partRoot(body);
  mesh(geometry("meteor-f3:fuselage", () => loft(meteorBody.map(({ station, width, high, low }) =>
    meteorBodySection.map(([x, y]) => vertex(width * x, low + (high - low) * y, station))))), bodyRoot.material, bodyRoot.root).name = "meteor-f3-fuselage";
  mesh(geometry("meteor-f3:canopy", () => loft(meteorCanopy.map(({ station, width, high, low }) =>
    Array.from({ length: 13 }, (_, i) => {
      const angle = i * Math.PI / 12;
      return vertex(width * Math.cos(angle), low + (high - low) * Math.sin(angle), station);
    })))), paintGlass, bodyRoot.root).name = "meteor-f3-canopy";

  const wingPanels = [
    geometry("meteor-f3:inner-wing", () => liftingSurface(meteorInboardWing, meteorWingSection)),
    geometry("meteor-f3:outer-wing", () => liftingSurface(meteorOutboardWing, meteorWingSection)),
  ];
  const tail = partRoot(actor.parts.find(part => part.id === "tail")!);
  const stabilizer = geometry("meteor-f3:stabilizer", () => liftingSurface(meteorTailplane, meteorTailSection));
  mesh(stabilizer, tail.material, tail.root).name = "meteor-f3-right-stabilizer";
  const leftTail = mesh(stabilizer, tail.material, tail.root);
  leftTail.name = "meteor-f3-left-stabilizer";
  leftTail.scale.x = -1;
  mesh(geometry("meteor-f3:fin", () => loft(meteorFin.map(({ station, width, high, low }) =>
    Array.from({ length: 16 }, (_, i) => {
      const angle = i * Math.PI / 8;
      const h = .5 + .5 * Math.sin(angle);
      const taper = 1 - .7 * h;
      return vertex(width * Math.cos(angle) * taper, low + (high - low) * h, station);
    })))), tail.material, tail.root).name = "meteor-f3-fin";

  const [, , inletY, inletRadius] = meteorNacelle[0];
  const nacelle = geometry("meteor-f3:nacelle", () => loft(meteorNacelle.map(([station, x, y, radius]) => engineRing(station, x, y, radius)), false, false));
  const lip = geometry("meteor-f3:inlet-lip", () => loft([
    engineRing(frontStation, engineX, inletY, meteorInlet.radius),
    engineRing(frontStation, engineX, inletY, inletRadius),
  ], false, false));
  const inlet = geometry("meteor-f3:inlet-shadow", () => loft([
    engineRing(frontStation + meteorInlet.depth, engineX, inletY, meteorInlet.radius),
    engineRing(frontStation, engineX, inletY, meteorInlet.radius),
  ], true, false));
  const outletLip = geometry("meteor-f3:outlet-lip", () => loft([
    engineRing(outletStation, outletX, outletY, outletRadius),
    engineRing(outletStation, outletX, outletY, meteorOutlet.radius),
  ], false, false));
  const outlet = geometry("meteor-f3:outlet-shadow", () => loft([
    engineRing(outletStation, outletX, outletY, meteorOutlet.radius),
    engineRing(outletStation - meteorOutlet.depth, outletX, outletY, meteorOutlet.radius),
  ], false, true));

  for (const [side, wingId, engineId] of [[-1, "left_wing", "engine_0"], [1, "right_wing", "engine_1"]] as const) {
    const wing = partRoot(actor.parts.find(part => part.id === wingId)!);
    wing.root.scale.x = side;
    mesh(wingPanels[0], wing.material, wing.root).name = "meteor-f3-inner-wing";
    mesh(wingPanels[1], wing.material, wing.root).name = "meteor-f3-outer-wing";

    const enginePart = actor.parts.find(part => part.id === engineId)!;
    const engine = partRoot(enginePart);
    const anchor = partAnchor(enginePart);
    engine.root.position.set(anchor.x, anchor.y, anchor.z);
    engine.root.scale.x = side;
    mesh(nacelle, engine.material, engine.root).name = "meteor-f3-short-nacelle";
    mesh(lip, metal, engine.root).name = "meteor-f3-inlet-lip";
    mesh(inlet, dark, engine.root).name = "meteor-f3-inlet";
    mesh(outletLip, metal, engine.root).name = "meteor-f3-outlet-lip";
    mesh(outlet, dark, engine.root).name = "meteor-f3-outlet";
  }
}

export function createMeteorF3Preview(): ReferenceAircraft {
  const parts = [partFromRecipe("center_body", { role: "body" })];
  for (const [side, wingId, engineId, slot] of [
    [-1, "left_wing", "engine_0", "leftWing"], [1, "right_wing", "engine_1", "rightWing"],
  ] as const) {
    parts.push(partFromRecipe(wingId, { role: "wing", side, slot, x: side * 76 * meteorUnit, y: 0, z: meteorZ(117), parentId: "center_body" }));
    parts.push(partFromRecipe(engineId, {
      role: "engine", side, slot, x: side * engineX * meteorUnit, y: 0, z: meteorZ(frontStation), parentId: wingId,
      outletOffset: { x: side * (outletX - engineX) * meteorUnit, y: outletY * meteorUnit, z: meteorZ(outletStation) - meteorZ(frontStation) },
    }));
  }
  parts.push(partFromRecipe("tail", { role: "tail", slot: "tail", x: 0, y: 42 * meteorUnit, z: meteorZ(276), parentId: "center_body" }));
  return {
    frame: meteorF3Frame, parts, weapons: [],
    x: 0, z: 0, prevX: 0, prevZ: 0, vx: 0, vz: 0, heading: 0, bank: 0, speed: 0, energy: 0,
    stats: { length: meteorF3Frame.length, wingspan: meteorF3Frame.wingspan, maxSpeed: 1 },
  };
}
