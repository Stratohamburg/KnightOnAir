import { hoEngines, hoEngineMount, hoEngineSize, hoLength, hoPanelLimits, hoRibs, hoSpan, hoUnit, hoX, hoZ, type HoRib } from "../data/ho229V2Sheet";
import type { Part } from "./types";
import type { AircraftTopology } from "./CenterlineLayout";

export function hoTopology(): AircraftTopology {
  const topology: AircraftTopology = { version: 1, connections: [], centerlines: [{
    id: "fuselage", kind: "fuselage", side: 0, layer: 0, length: hoLength,
    origin: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: 1 }, profile: "straight",
    nodes: [{ id: "nose", station: hoZ(237) }, { id: "cockpit", station: hoZ(342) },
      { id: "wing-root", station: hoZ(469) }, { id: "tail", station: hoZ(760) }],
  }] };
  for (const side of [-1, 1] as const) {
    const hand = side < 0 ? "left" : "right";
    const [a, b] = hoPanelLimits[hand + "_wing"];
    const root = side < 0 ? b : a;
    const [c, d] = hoPanelLimits[hand + "_wing_tip"];
    const length = Math.abs((side < 0 ? c : d) - root) * hoUnit;
    const seam = (b - a) * hoUnit;
    const id = hand + "-wing-0";
    const origin = { x: hoX(root), y: 9 * hoUnit, z: hoZ(469) };
    topology.centerlines.push({ id, kind: "wing", side, layer: 0, length, origin,
      direction: { x: side, y: 0, z: 0 }, profile: "straight", relation: "branch", parentId: "fuselage",
      tipStart: seam / length, nodes: [{ id: "root", station: seam / 2 }, { id: "tip", station: (seam + length) / 2 }] });
    topology.connections.push({ id: id + ":root", from: "fuselage", to: id, relation: "branch", offset: origin });
  }
  return topology;
}

// x, fore and aft are placed in the actor's local space. The source section
// retains its drawing coordinates for the hinge, thickness and intake lip.
export interface HoSection { rib: HoRib; x: number; fore: number; aft: number }

/** Sample the actual section at a cut through a placed panel, including both skins. */
export function hoSectionAt(rows: readonly HoSection[], x: number): HoSection {
  const index = rows.findIndex(r => r.x >= x);
  if (index < 0) return rows[rows.length - 1];
  const b = rows[index];
  if (index === 0 || b.x === x) return b;
  const a = rows[index - 1], t = (x - a.x) / (b.x - a.x);
  const mix = (v: number, w: number) => v + t * (w - v);
  const rib: HoRib = [mix(a.rib[0], b.rib[0]), mix(a.rib[1], b.rib[1]), mix(a.rib[2], b.rib[2]),
    mix(a.rib[3], b.rib[3]), mix(a.rib[4], b.rib[4])];
  return { rib, x, fore: mix(a.fore, b.fore), aft: mix(a.aft, b.aft) };
}

export function hoPlacedPanels(parts: readonly Part[], baseSpan: number) {
  const panels = new Map<string, HoSection[]>();
  const place = (rib: HoRib, x = hoX(rib[0]), dz = 0): HoSection =>
    ({ rib, x, fore: hoZ(rib[1]) + dz, aft: hoZ(rib[2]) + dz });
  const section = (id: string) => {
    const [left, right] = hoPanelLimits[id];
    return hoRibs.filter(([x]) => x >= left && x <= right);
  };
  const center = section("center_body").map(r => place(r));
  panels.set("center_body", center);
  for (const side of [-1, 1]) {
    const hand = side < 0 ? "left" : "right";
    const main = hand + "_wing";
    const root = side < 0 ? 494 : 713;
    const terminal = section(main + "_tip");
    const tipX = terminal[side < 0 ? 0 : terminal.length - 1][0];
    const nativeWidth = Math.abs(hoX(tipX) - hoX(root));
    const stretch = 1 + (baseSpan - hoSpan) * .5 / nativeWidth;
    const xAt = (x: number) => hoX(root) + (x - root) * hoUnit * stretch;
    const mainRibs = section(main);
    const tipRib = terminal[side < 0 ? terminal.length - 1 : 0];
    const rootRib = mainRibs[side < 0 ? mainRibs.length - 1 : 0];
    const sweep = (tipRib[1] - rootRib[1]) * hoUnit / Math.abs(xAt(tipRib[0]) - xAt(root));
    const inserts = parts.filter(p => p.centerline?.lineId === hand + "-wing-0" && p.centerline.segmentRole === "insert");
    const engineBays = inserts.filter(p => p.centerline!.insertion === "root-before");
    const rootWidth = engineBays.reduce((w, p) => w + p.centerline!.segmentLength!, 0);
    // Carry the outer wing along its measured leading-edge sweep. Round the
    // trailing shoulder between the last engine and the outer wing's aft turn.
    const shoulder = side < 0 ? 412 : 790;
    const displaced = mainRibs.map(r => place(r, xAt(r[0]) + side * rootWidth, -sweep * rootWidth));
    const rootSection = place(rootRib);
    const station = hoEngines[side < 0 ? 0 : 1];
    const source = hoX(station.column);
    const sourceFore = hoSectionAt(center, source).fore;
    // Keep a strip of skin aft of the slot on each swept engine carrier.
    const slotEndAtRoot = hoZ(station.slotEndRow) + rootSection.fore - sourceFore;
    const extraChord = Math.max(0, rootSection.aft - slotEndAtRoot + hoEngineSize.inletRadius * hoUnit);
    const firstMid = (engineBays[0]?.centerline?.segmentLength ?? 0) / 2;
    const neighbor = center[side < 0 ? 1 : center.length - 2];
    const innerTangent = (rootSection.aft - neighbor.aft) / Math.abs(rootSection.x - neighbor.x);
    const lastWidth = engineBays.at(-1)?.centerline?.segmentLength ?? 0;
    const turnStart = rootWidth - lastWidth / 2;
    const turnEnd = rootWidth + Math.abs(xAt(shoulder) - xAt(root));
    const turnAft = hoSectionAt(displaced, xAt(shoulder) + side * rootWidth).aft;
    const fairShoulder = (s: HoSection): HoSection => {
      const d = Math.abs(s.x - rootSection.x);
      if (!rootWidth || d >= turnEnd) return s;
      if (d <= firstMid) {
        const t = d / firstMid;
        return { ...s, aft: s.aft + (innerTangent + sweep) * d * (1 - t) ** 2 - extraChord * t * t * (3 - 2 * t) };
      }
      if (d <= turnStart) return { ...s, aft: s.aft - extraChord };
      const length = turnEnd - turnStart, t = (d - turnStart) / length;
      const startAft = rootSection.aft - sweep * turnStart - extraChord;
      const aft = startAft + (turnAft - startAft) * t * t * (3 - 2 * t) - sweep * length * t * (1 - t) ** 2;
      return { ...s, aft };
    };
    panels.set(main, displaced.map(fairShoulder));
    let edge = xAt(root);
    for (const bay of engineBays) {
      const next = edge + side * bay.centerline!.segmentLength!;
      const mid = (edge + next) / 2;
      const inner = (hoEngineSize.inletRadius + 3) * hoUnit;
      const sweptRoot = (x: number) => place(rootRib, x, -sweep * Math.abs(x - rootSection.x));
      const mountShift = sweptRoot(mid).fore - sourceFore;
      const columns = new Set([edge, next, mid - inner, mid, mid + inner]);
      for (const row of center) {
        if (Math.abs(row.x - source) < inner) columns.add(mid + row.x - source);
      }
      panels.set(bay.id, [...columns].sort((a, b) => a - b).map(x => {
        const base = fairShoulder(sweptRoot(x));
        if (x === edge || x === next) return base;
        const dx = x - mid;
        const copied = hoSectionAt(center, source + Math.max(-inner, Math.min(inner, dx)));
        const seam = sweptRoot(dx < 0 ? Math.min(edge, next) : Math.max(edge, next));
        const blend = Math.max(0, (Math.abs(dx) - inner) / (Math.abs(seam.x - mid) - inner));
        const mix = (v: number, w: number) => v + (w - v) * blend;
        return { ...base, fore: mix(copied.fore + mountShift, seam.fore), rib: [base.rib[0], mix(copied.rib[1], seam.rib[1]),
          base.rib[2], mix(copied.rib[3], seam.rib[3]), mix(copied.rib[4], seam.rib[4])] };
      }));
      edge = next;
    }
    const tipSeam = xAt(tipRib[0]) + side * rootWidth;
    let extension = 0;
    const tipEnd = () => place(tipRib, tipSeam + side * extension, -sweep * (rootWidth + extension));
    for (const bay of inserts.filter(p => p.centerline!.insertion !== "root-before")) {
      const inner = tipEnd();
      extension += bay.centerline!.segmentLength ?? 0;
      const outer = tipEnd();
      panels.set(bay.id, side < 0 ? [outer, inner] : [inner, outer]);
    }
    panels.set(main + "_tip", terminal.map(r => place(r, xAt(r[0]) + side * (rootWidth + extension), -sweep * (rootWidth + extension))));
  }
  return panels;
}

export function applyHoPanelLayout(parts: Part[], baseSpan: number) {
  const panels = hoPlacedPanels(parts, baseSpan);
  for (const part of parts) {
    const sections = panels.get(part.id);
    if (!sections) continue;
    const front = (s: HoSection) => ({ x: s.x, y: (s.rib[3] + s.rib[4]) * .5 * hoUnit, z: s.fore });
    const back = (s: HoSection) => ({ ...front(s), z: s.aft });
    part.silhouette = sections.slice(1).map((s, i) =>
      [front(sections[i]), front(s), back(s), back(sections[i])]);
    if (part.id === "center_body") continue;
    const first = sections[0], last = sections[sections.length - 1];
    part.x = (first.x + last.x) * .5;
    part.y = (front(first).y + front(last).y) * .5;
    part.z = (first.fore + first.aft + last.fore + last.aft) * .25;
  }
  for (const part of parts) {
    if (!part.parentId || !["cannon", "engine"].includes(part.kind)) continue;
    const bay = panels.get(part.parentId);
    if (!bay || part.parentId === "center_body") continue;
    const section = hoSectionAt(bay, (bay[0].x + bay[bay.length - 1].x) * .5);
    const { fore: front, rib } = section;
    part.x = section.x;
    part.y = (rib[3] + rib[4]) * .5 * hoUnit;
    if (part.kind === "engine") {
      const engine = hoEngines[part.slot === "leftWing" ? 0 : 1];
      const mountShift = front - hoSectionAt(panels.get("center_body")!, hoX(engine.column)).fore;
      Object.assign(part, hoEngineMount(engine, mountShift));
    } else {
      // mountOffset places the muzzle 1.15 forward of the cannon's part anchor.
      part.z = front + .33 - 1.15;
    }
  }
}
