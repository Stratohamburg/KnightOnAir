import * as THREE from "three";
import { hoEngines, hoEngineSize, hoGear, hoLeadingRow, hoSpan, hoUnit, hoX, hoZ } from "../../data/ho229V2Sheet";
import { hoPlacedPanels, hoSectionAt, type HoSection } from "../../simulation/Ho229Layout";
import { lineExtension } from "../../simulation/CenterlineLayout";
import { engineOutlet, muzzleAnchor } from "./anchors";
import type { Part } from "../../simulation/types";
import type { AircraftModelContext } from "./aircraftModels";

const lerp = THREE.MathUtils.lerp;
type Point = [number, number, number];

// Join equal-size rings. The shared vertices keep the highlight continuous
// within each skin; end caps have separate vertices and flat end normals.
function loft(rings: Point[][], capAft = true) {
  const sides = rings[0].length;
  const points = rings.flat();
  const indices: number[] = [];
  const tri = (a: number, b: number, c: number) => indices.push(a, b, c);
  for (let r = 1; r < rings.length; r++) {
    for (let j = 0; j < sides; j++) {
      const a = (r - 1) * sides + j, b = (r - 1) * sides + (j + 1) % sides;
      tri(a, a + sides, b);
      tri(b, a + sides, b + sides);
    }
  }
  for (const end of capAft ? [0, rings.length - 1] : [0]) {
    const offset = points.length;
    points.push(...rings[end]);
    for (let j = 1; j < sides - 1; j++)
      tri(offset, offset + (end ? j + 1 : j), offset + (end ? j : j + 1));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(points.flat(), 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

type Hinge = readonly [number, number, number, number];
// Endpoints of each hinge on the plan plate, ordered by drawing column.
const hinges: Hinge[] = [[22, 661, 302, 590], [302, 577, 386, 571],
  [819, 574, 902, 581], [902, 595, 1179.3, 669]];
const chordRows = [0, .035, .12, .29, .52, .72, 1];
const topSkin = [.44, .73, .93, 1, .84, .59, .31];
const lowerSkin = [.44, .21, .06, 0, .07, .19, .31];
function skinHeight(t: number, values: number[]) {
  let i = 1;
  while (i < chordRows.length - 1 && t > chordRows[i]) i++;
  return lerp(values[i - 1], values[i], (t - chordRows[i - 1]) / (chordRows[i] - chordRows[i - 1]));
}

interface EnginePocket {
  x: number; y: number; z: number;
  halfWidth: number; run: number; radius: number;
  inletZ: number; inletY: number; inletRadius: number;
  station: typeof hoEngines[number];
}

function enginePocket(part: Part): EnginePocket {
  const outlet = engineOutlet(part);
  const station = hoEngines[part.slot === "leftWing" ? 0 : 1];
  const length = (station.outletRow - station.lipRow) * hoUnit;
  return { ...outlet, station, halfWidth: 21 * hoUnit,
    radius: hoEngineSize.bodyRadius * hoUnit,
    run: (station.slotEndRow - station.outletRow) * hoUnit,
    inletZ: outlet.z + length, inletY: outlet.y + length * hoEngineSize.axisSlope, inletRadius: hoEngineSize.inletRadius * hoUnit };
}

function wingVolume(rows: HoSection[], hinge?: Hinge, moving = false, pockets: EnginePocket[] = []) {
  // Add lateral cuts at the slot shoulders and inner walls. The deck and
  // belly still share the same measured leading and trailing edges.
  const columns = new Set(rows.map(r => r.x));
  for (const p of pockets) {
    for (const f of [-1.5, -1, -.9, -.72, -.4, 0, .4, .72, .9, 1, 1.5]) {
      const x = p.x + f * p.halfWidth;
      if (x > rows[0].x && x < rows.at(-1)!.x) columns.add(x);
    }
  }
  const rings = [...columns].sort((a, b) => a - b).map(column => {
    const { rib: [col, nose, tail, high, low], x, fore, aft } = hoSectionAt(rows, column);
    let split = 1;
    if (hinge && tail > nose) {
      const [x0, s0, x1, s1] = hinge;
      split = THREE.MathUtils.clamp((lerp(s0, s1, (col - x0) / (x1 - x0)) - nose) / (tail - nose), 0, 1);
    }
    // Set the center skin back under each lip so the dark throat stays open.
    let start = fore;
    for (const p of pockets) {
      const dx = (x - p.x) / (p.inletRadius + 3 * hoUnit);
      if (Math.abs(dx) < 1) start -= .18 * Math.sqrt(1 - dx * dx);
    }
    const fractions = moving ? [split, lerp(split, 1, .5), 1] :
      chordRows.map(t => t * split);
    const spine = Math.max(0, 1 - Math.abs(col - 603) / 50);
    const point = (t: number, skin: number[]): Point => {
      const centerCamber = spine * (9 * Math.max(0, 1 - t / .12) - 10 * Math.max(0, (t - .72) / .28));
      return [x, (lerp(low, high, skinHeight(t, skin)) + centerCamber) * hoUnit, lerp(start, aft, t)];
    };
    let deck = fractions.map(t => point(t, topSkin));
    let belly = fractions.slice().reverse().map(t => point(t, lowerSkin));
    if (pockets.length) {
      const p = pockets.reduce((a, b) => Math.abs(x - a.x) < Math.abs(x - b.x) ? a : b);
      const lateral = Math.abs(x - p.x) / p.halfWidth;
      const dx = Math.min(1, lateral);
      const depthWeight = 1 - THREE.MathUtils.smoothstep(dx, .72, 1);
      // The channel sits below the lower lip. Its floor follows the rear
      // wing skin down as the measured trailing edge tapers away.
      const wall = p.z + .085;
      const tWall = THREE.MathUtils.clamp((start - wall) / (start - aft), 0, 1);
      const tExit = THREE.MathUtils.clamp((start - p.z) / (start - aft), 0, 1);
      const tEnd = Math.min(1, tWall + (p.run + .085) * Math.sqrt(1 - dx * dx) / (start - aft));
      const bed = (t: number) => {
        const v = point(t, topSkin);
        if (t < tWall) return v;
        // Blend the lined recess into the rear wing without a cross-wall
        // across the lowered outlet. The skin stays below the lower rim.
        const clearance = tEnd > tWall ? 4 - 3 * THREE.MathUtils.smoothstep(t, tWall, tEnd) : 1;
        const ceiling = p.y - p.radius - clearance * hoUnit;
        v[1] = lerp(v[1], Math.min(v[1], ceiling), depthWeight);
        const shoulder = (1 - THREE.MathUtils.smoothstep(Math.abs(lateral - 1), 0, .3)) *
          (1 - THREE.MathUtils.smoothstep(Math.abs(v[2] - p.z), 0, p.run));
        v[1] = lerp(v[1], p.y + hoEngineSize.shoulderAboveOutlet * hoUnit, shoulder);
        return v;
      };
      const samples = fractions.map(t => ({ t, lip: false }));
      samples.push({ t: tWall, lip: true }, { t: tWall, lip: false },
        { t: tExit, lip: false }, { t: lerp(tWall, tEnd, .5), lip: false }, { t: tEnd, lip: false });
      samples.sort((a, b) => a.t - b.t || Number(b.lip) - Number(a.lip));
      deck = samples.map(s => s.lip ? point(s.t, topSkin) : bed(s.t));
      belly = fractions.slice().reverse().map(t => {
        const v = point(t, lowerSkin);
        if (t >= tWall) v[1] = Math.min(v[1], bed(t)[1] - (1 - t) * hoUnit);
        return v;
      });
    }
    return [...deck, ...belly];
  });
  const g = loft(rings);
  if (pockets.length) {
    // Material groups use the actual recessed upper faces, including their walls.
    const skin: number[] = [], liner: number[] = [];
    const indices = g.index!, stride = rings[0].length, upper = chordRows.length + 5;
    const pos = g.getAttribute("position");
    for (let i = 0; i < indices.count; i += 3) {
      const a = indices.getX(i), b = indices.getX(i + 1), c = indices.getX(i + 2);
      const x = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3;
      const z = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3;
      const onDeck = a < rings.length * stride && [a, b, c].every(v => v % stride < upper);
      const inSlot = onDeck && pockets.some(p => {
        const dx = (x - p.x) / p.halfWidth;
        const t = (p.z + .085 - z) / (p.run + .085);
        return t >= -1e-5 && dx * dx + t * t < 1;
      });
      (inSlot ? liner : skin).push(a, b, c);
    }
    g.setIndex([...skin, ...liner]);
    g.addGroup(0, skin.length, 0);
    g.addGroup(skin.length, liner.length, 1);
  }
  return g;
}

// Fore-to-aft sections in plate units: plan row, half-width, deck, belly.
type HullRow = readonly [number, number, number, number];
function pod(column: number, rows: readonly HullRow[]) {
  return loft(rows.map(([row, width, deck, belly]) =>
    Array.from({ length: 16 }, (_, i): Point => {
      const a = i * Math.PI / 8;
      return [hoX(column + width * Math.cos(a)),
        (belly + (deck - belly) * (.5 + .5 * Math.sin(a))) * hoUnit, hoZ(row)];
    })));
}

function buildHoPanel(context: AircraftModelContext, parent: THREE.Object3D,
  material: THREE.Material, id: string, rows: HoSection[], pockets: EnginePocket[]) {
  const key = `ho229:${id}:${rows.map(r => [r.x, r.fore, r.aft, ...r.rib]).join("/")}:${pockets.map(p =>
    [p.x, p.y, p.z, p.run, p.halfWidth, p.inletZ, p.inletRadius]).join("/")}`;
  for (let i = 0; i < rows.length - 1;) {
    const hingeAt = (n: number) => {
      const mid = (rows[n].rib[0] + rows[n + 1].rib[0]) * .5;
      return hinges.find(([a, , b]) => a < mid && mid < b);
    };
    const hinge = hingeAt(i);
    let end = i + 1;
    while (end < rows.length - 1 && hingeAt(end) === hinge) end++;
    const band = rows.slice(i, end + 1);
    const skin = context.geometry(key + ":skin:" + i, () => wingVolume(band, hinge, false, pockets));
    const shell = context.mesh(skin, material, parent);
    shell.name = "ho229-wing-skin";
    if (pockets.length) shell.material = [material, context.paint("#4e6264")];
    if (hinge) {
      const control = context.geometry(key + ":control:" + i, () => wingVolume(band, hinge, true));
      context.mesh(control, context.paint("#73868b"), parent).name = "ho229-elevon";
    }
    i = end;
  }
}

export function buildHo229Model(context: AircraftModelContext) {
  const { actor } = context;
  const baseSpan = "stats" in actor ? actor.stats.wingspan - lineExtension(actor.parts, "left-wing-0") -
    lineExtension(actor.parts, "right-wing-0") : hoSpan;
  const panels = hoPlacedPanels(actor.parts, baseSpan);
  const engines = new Map<string, EnginePocket>();
  const slots = new Map<string, EnginePocket[]>();
  for (const part of actor.parts) {
    if (part.kind !== "engine" || !part.parentId) continue;
    const host = panels.get(part.parentId);
    if (!host) continue;
    const pocket = enginePocket(part);
    engines.set(part.id, pocket);
    const installed = slots.get(part.parentId) ?? [];
    installed.push(pocket);
    slots.set(part.parentId, installed);
  }
  const metal = context.paint("#5a6769"), dark = context.paint("#20282c");
  const glass = context.paint("#395765"), rubber = context.paint("#343a3d");
  const cache = (key: string, create: () => THREE.BufferGeometry) => context.geometry("ho229:" + key, create);
  for (const part of actor.parts) {
    const { root, material } = context.partRoot(part);
    root.position.set(part.x, part.y ?? 0, part.z);
    const sheet = new THREE.Group();
    sheet.position.copy(root.position).multiplyScalar(-1);
    root.add(sheet);
    const rows = panels.get(part.id);
    if (rows) buildHoPanel(context, sheet, material, part.id, rows, slots.get(part.id) ?? []);
    const engine = engines.get(part.id);
    if (part.id === "center_body") {
      const canopy: HullRow[] = [[258, 2, 29, 10], [277, 17, 42, 14], [297, 23, 55, 18],
        [327, 25, 61, 21], [346, 25, 61, 20], [380, 23, 56, 18],
        [418, 15, 48, 17], [455, 2, 39, 17]];
      context.mesh(cache("canopy", () => pod(603, canopy)), glass, sheet).name = "ho229-canopy";
      for (const [name, row, width, deck, belly] of [["windscreen", 297, 23, 55, 18], ["arch", 346, 25, 61, 20]] as const)
        context.mesh(cache(name, () => pod(603, [[row - 1.5, width + .5, deck + .5, belly],
          [row + 1.5, width + .5, deck + .5, belly]])), metal, sheet);
    } else if (engine) {
      const e = engine;
      // Shallow intake lip follows the leading edge. The engine is enclosed
      // between this lip and the separate outlet in the dorsal pocket.
      const r = e.inletRadius;
      const inletDepth = (offsetX: number) => hoZ(hoLeadingRow(e.station.column + offsetX / hoUnit)) - hoZ(e.station.lipRow);
      const inletKey = "inlet:" + e.station.column;
      const followLip = (g: THREE.BufferGeometry, axis: "y" | "z") => {
        const p = g.getAttribute("position");
        for (let i = 0; i < p.count; i++) {
          const dz = inletDepth(p.getX(i));
          if (axis === "y") p.setY(i, p.getY(i) + dz);
          else p.setZ(i, p.getZ(i) + dz);
        }
        g.computeVertexNormals();
        return g;
      };
      const lip = cache(inletKey, () => followLip(new THREE.LatheGeometry(
        [[r + .035, -.16], [r, 0], [r - .027, .01], [r - .05, -.015], [r - .075, -.10]]
          .map(([radius, z]) => new THREE.Vector2(radius, z)), 24), "y"));
      const intake = context.mesh(lip, material, sheet, e.x, e.inletY, e.inletZ);
      intake.rotation.x = Math.PI / 2;
      // Front lip width follows the plan notch. Its side opening spans the approved cylinder diameter.
      intake.scale.z = e.radius / r;
      intake.name = "ho229-intake";
      const intakeThroat = context.mesh(cache(inletKey + ":throat", () => followLip(new THREE.CircleGeometry(r - .064, 24), "z")),
        dark, sheet, e.x, e.inletY, e.inletZ - .096);
      intakeThroat.scale.y = intake.scale.z;

      const body = context.mesh(cache("engine-cylinder", () => new THREE.CylinderGeometry(
        e.radius, e.radius, hoEngineSize.bodyLength * hoUnit, 24)), metal, root);
      body.rotation.x = Math.PI / 2 - Math.atan(hoEngineSize.axisSlope);
      body.name = "ho229-engine-body";

      const cover = cache("aft-engine-cover", () => {
        const rings = hoEngineSize.coverSections.map(({ forward, halfWidth, crownAboveOutlet }) =>
          Array.from({ length: 24 }, (_, i): Point => {
            const angle = i * Math.PI / 12;
            const belly = -hoEngineSize.bodyRadius;
            return [halfWidth * Math.cos(angle) * hoUnit,
              lerp(belly, crownAboveOutlet, .5 + .5 * Math.sin(angle)) * hoUnit, forward * hoUnit];
          }));
        // Close the shoulder around the rim, leaving its circular opening clear.
        rings.push(Array.from({ length: 24 }, (_, i): Point =>
          [e.radius * Math.cos(i * Math.PI / 12), e.radius * Math.sin(i * Math.PI / 12), 0]));
        return loft(rings, false);
      });
      context.mesh(cover, material, sheet, e.x, e.y, e.z).name = "ho229-engine-cover";
      const rim = context.mesh(cache("buried-outlet-rim", () => new THREE.LatheGeometry(
        [[1, -.078], [1, 0], [.84, 0], [.79, -.043]].map(([radius, z]) => new THREE.Vector2(radius, z)), 24)),
        metal, sheet, e.x, e.y, e.z);
      rim.rotation.x = -Math.PI / 2;
      rim.scale.set(e.radius, 1, e.radius);
      rim.name = "ho229-nozzle";
      const throat = context.mesh(cache("buried-outlet-throat", () => new THREE.CircleGeometry(1, 24)),
        dark, sheet, e.x, e.y, e.z + .042);
      throat.rotation.y = Math.PI;
      throat.scale.set(e.radius * .82, e.radius * .82, 1);
    } else if (part.id === "landing_gear") {
      const strut = (name: string, a: THREE.Vector3, b: THREE.Vector3, radius: number) => {
        const v = b.clone().sub(a);
        const bar = context.mesh(cache(name, () => new THREE.CylinderGeometry(radius, radius, v.length(), 8)), metal, sheet);
        bar.position.copy(a).lerp(b, .5);
        bar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize());
      };
      for (const [i, gear] of hoGear.entries()) {
        const x = hoX(gear.column), y = gear.height * hoUnit, z = hoZ(gear.row);
        const axle = new THREE.Vector3(x, y, z);
        const knee = new THREE.Vector3(x, y + 19 * hoUnit, hoZ(gear.socketRow));
        const top = new THREE.Vector3(x, -6 * hoUnit, hoZ(gear.socketRow + 3));
        strut("leg-" + i, top, knee, 3.6 * hoUnit);
        strut("fork-" + i, knee, axle, 4 * hoUnit);
        const braceUpper = i === 0 ? new THREE.Vector3(0, -30 * hoUnit, hoZ(415)) :
          new THREE.Vector3(x * .48, -31 * hoUnit, top.z - .18);
        strut("brace-" + i, braceUpper, knee.clone().lerp(top, .23), 2.4 * hoUnit);
        const fairing = cache("gear-door-" + i, () => i === 0
          ? pod(603, [[301, 16, -18, -87], [305, 20, -18, -91], [310, 17, -18, -88]])
          : pod(gear.column + (i === 1 ? 6 : -6), [[556, 2, -14, -55], [564, 4, -15, -60], [583, 3, -15, -59]]));
        context.mesh(fairing, material, sheet).name = "ho229-gear-door";
        const wheel = context.mesh(cache("tire-" + gear.radius, () => new THREE.CylinderGeometry(
          gear.radius * hoUnit, gear.radius * hoUnit, gear.width * hoUnit, 20)), rubber, sheet, x, y, z);
        wheel.rotation.z = Math.PI / 2;
        wheel.name = "ho229-wheel";
        const hub = context.mesh(cache("hub-" + gear.radius, () => new THREE.CylinderGeometry(
          gear.radius * hoUnit * .46, gear.radius * hoUnit * .46, (gear.width + 1.6) * hoUnit, 12)), metal, sheet, x, y, z);
        hub.rotation.z = Math.PI / 2;
      }
    } else if (part.kind === "cannon") {
      const weapon = actor.weapons.find(w => w.partId === part.id);
      for (let i = 0; weapon && i < weapon.config.count; i++) {
        const muzzle = muzzleAnchor(part, weapon, actor.heading, i);
        const barrel = context.mesh(cache("cannon-barrel", () => new THREE.LatheGeometry(
          [[.084, -.55], [.084, -.28], [.055, -.24], [.055, -.12], [.068, -.10], [.068, 0], [.035, 0], [.035, -.045]]
            .map(([r, z]) => new THREE.Vector2(r, z)), 12)), metal, root,
          muzzle.x - part.x, muzzle.y - (part.y ?? 0), muzzle.z - part.z);
        barrel.rotation.x = Math.PI / 2;
        barrel.name = "ho229-cannon";
      }
    } else if (!rows) {
      // Add-on equipment uses the refit's own local anchor and part state.
      if (part.role === "wing") {
        const side = part.side || 1;
        const fitting: HoSection[] = [
          { rib: [0, 0, 1, 10, -8], x: -.5, fore: .48, aft: -.43 },
          { rib: [1, 0, 1, 6, -4], x: .5, fore: .48 - side * .45, aft: -.43 - side * .16 },
        ];
        context.mesh(cache("wing-fitting:" + side, () => wingVolume(fitting)), material, root);
      } else {
        const gun = part.role === "gun" || part.role === "turret";
        const size = gun ? [.24, .19, .76] : [.48, .24, .56];
        context.mesh(cache("fitting:" + part.kind, () => new THREE.BoxGeometry(...size)), material, root);
      }
    }
  }
}
