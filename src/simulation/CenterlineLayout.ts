import { stationZ, wingBays, wings } from "../data/fokkerDr1Sheet";
import { hoTopology } from "./Ho229Layout";
import { hoZ } from "../data/ho229V2Sheet";
import type { Airframe } from "../data/aircrafts";
import type { Point3 } from "../content/3d/anchors";
import type { Part, PartRole, Slot } from "./types";
import { aircraftGeometryProfile } from "../content/3d/airframeShape";

export type CenterlineKind = "fuselage" | "wing" | "tail" | "engine" | "connector" | "pod";
export type CenterlineProfile = "straight" | "up" | "down" | "gull" | "inverted-gull";
export type CenterlineRelation = "branch" | "parallel" | "vertical" | "longitudinal";
export type CenterlineMountLayer = "structure" | "engine" | "weapon" | "payload" | "cooling";

export interface CenterlineNode {
  id: string;
  station: number;
  section?: { width: number; height: number };
}

export interface CenterlineDefinition {
  /** Normalized inboard seam of the terminal bay. */
  tipStart?: number;
  id: string;
  kind: CenterlineKind;
  side: -1 | 0 | 1;
  layer: number;
  origin: Point3;
  direction: Point3;
  length: number;
  profile: CenterlineProfile;
  nodes: CenterlineNode[];
  relation?: CenterlineRelation;
  parentId?: string;
  engine?: { installation: "tractor" | "pusher"; propellerStation: number; clearance: number };
}

export interface CenterlineConnection {
  id: string;
  from: string;
  to: string;
  relation: CenterlineRelation;
  offset?: Point3;
}

export interface AircraftTopology {
  version: 1;
  centerlines: CenterlineDefinition[];
  connections: CenterlineConnection[];
}

export interface CenterlineMount {
  lineId: string;
  nodeId?: string;
  station?: number;
  layer?: CenterlineMountLayer;
  offset?: Point3;
  segmentLength?: number;
  segmentRole?: "root" | "tip" | "insert" | "mount";
  insertion?: "tip-before" | "root-before" | "station";
  axis?: "tractor" | "pusher";
  clearance?: number;
  profile?: CenterlineProfile;
}

export interface ResolvedPlacement extends Point3 {
  lineId: string;
  station: number;
  layer: CenterlineMountLayer;
  parentId?: string;
}

export interface ResolvedCenterlineLayout {
  topology: AircraftTopology;
  placements: Map<string, ResolvedPlacement>;
  bounds: { min: Point3; max: Point3 };
  wingspan: number;
  length: number;
  massOffset: number;
}

const zero = { x: 0, y: 0, z: 0 } satisfies Point3;

function add(a: Point3, b: Point3): Point3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function scale(a: Point3, amount: number): Point3 {
  return { x: a.x * amount, y: a.y * amount, z: a.z * amount };
}

function normalize(value: Point3): Point3 {
  const length = Math.hypot(value.x, value.y, value.z) || 1;
  return scale(value, 1 / length);
}

function profileOffset(line: CenterlineDefinition, station: number): Point3 {
  if (line.kind !== "wing") return zero;
  const t = line.length > 0 ? Math.max(0, Math.min(1, station / line.length)) : 0;
  const bend = line.profile === "up" ? t * t * .7 :
    line.profile === "down" ? -t * t * .7 :
      line.profile === "gull" ? (t < .42 ? t * .9 : .38 - (t - .42) * .35) :
        line.profile === "inverted-gull" ? (t < .42 ? -t * .9 : -.38 + (t - .42) * .35) : 0;
  return { x: 0, y: bend, z: 0 };
}

function pointOnLine(line: CenterlineDefinition, station: number): Point3 {
  const direction = normalize(line.direction);
  return add(add(line.origin, scale(direction, station)), profileOffset(line, station));
}

function partMount(part: Part): CenterlineMount | undefined {
  return part.centerline;
}

export function lineExtension(parts: readonly Part[], lineId: string) {
  return parts.reduce((sum, part) => {
    const mount = partMount(part);
    return mount?.lineId === lineId && mount.segmentRole === "insert"
      ? sum + (mount.segmentLength ?? 0)
      : sum;
  }, 0);
}

export function resolveCenterlineLayout(topology: AircraftTopology, parts: readonly Part[]): ResolvedCenterlineLayout {
  const placements = new Map<string, ResolvedPlacement>();
  const bounds = { min: { x: Infinity, y: Infinity, z: Infinity }, max: { x: -Infinity, y: -Infinity, z: -Infinity } };
  let wingspan = 0;
  let length = 0;
  let massOffset = 0;
  for (const line of topology.centerlines) {
    const extension = lineExtension(parts, line.id);
    const effectiveLength = line.length + extension;
    const end = pointOnLine({ ...line, length: effectiveLength }, effectiveLength);
    if (line.kind === "wing") wingspan = Math.max(wingspan, Math.abs(end.x) * 2);
    if (line.kind === "fuselage" || line.kind === "tail") {
      const start = pointOnLine({ ...line, length: effectiveLength }, 0);
      length = Math.max(length, Math.abs(start.z), Math.abs(end.z));
    }
    const lineParts = parts.filter((part) => partMount(part)?.lineId === line.id);
    for (const part of lineParts) {
      const mount = partMount(part)!;
      let station = mount.station ?? 0;
      if (mount.nodeId) station = line.nodes.find((node) => node.id === mount.nodeId)?.station ?? station;
      if (mount.segmentRole === "tip") station += extension;
      if (mount.segmentRole === "insert" && mount.insertion === "tip-before") {
        const prior = lineParts
          .filter((candidate) => {
            const candidateMount = partMount(candidate);
            return candidateMount?.segmentRole === "insert" && (candidateMount.station ?? 0) < station;
          })
          .reduce((sum, candidate) => sum + (partMount(candidate)?.segmentLength ?? 0), 0);
        station = Math.max(0, line.length * (line.tipStart ?? 1) + prior + (mount.segmentLength ?? 0) * .5);
      }
      const base = pointOnLine({ ...line, length: effectiveLength }, station);
      const offset = mount.offset ?? zero;
      const point = add(base, offset);
      const placement: ResolvedPlacement = {
        ...point,
        lineId: line.id,
        station,
        layer: mount.layer ?? layerForPart(part),
        parentId: part.parentId,
      };
      placements.set(part.id, placement);
      if (line.tipStart !== undefined || !(mount.segmentRole === "tip" && part.silhouette?.length)) {
        part.x = point.x;
        part.y = point.y;
        part.z = point.z;
      }
      if (line.kind === "wing") wingspan = Math.max(wingspan, Math.abs(point.x) * 2);
      if (line.kind === "fuselage" || line.kind === "tail") length = Math.max(length, Math.abs(point.z) * 2);
      bounds.min.x = Math.min(bounds.min.x, point.x - part.radius);
      bounds.min.y = Math.min(bounds.min.y, point.y - part.radius);
      bounds.min.z = Math.min(bounds.min.z, point.z - part.radius);
      bounds.max.x = Math.max(bounds.max.x, point.x + part.radius);
      bounds.max.y = Math.max(bounds.max.y, point.y + part.radius);
      bounds.max.z = Math.max(bounds.max.z, point.z + part.radius);
      massOffset += part.addedMass;
    }
  }
  const tailExtension = lineExtension(parts, "tail");
  const fuselage = topology.centerlines.find((line) => line.id === "fuselage");
  if (fuselage) length = Math.max(length, fuselage.length + tailExtension);
  if (!Number.isFinite(bounds.min.x)) {
    bounds.min = { ...zero };
    bounds.max = { ...zero };
  }
  return { topology, placements, bounds, wingspan, length, massOffset };
}

export function applyCenterlineLayout(topology: AircraftTopology, parts: Part[]) {
  return resolveCenterlineLayout(topology, parts);
}

export function layerForPart(part: Pick<Part, "role" | "kind">): CenterlineMountLayer {
  if (part.role === "engine") return "engine";
  if (part.role === "gun" || part.role === "turret") return "weapon";
  if (part.role === "bay") return "payload";
  if (part.kind === "cooler") return "cooling";
  return "structure";
}

export function defaultTopology(frame: Airframe): AircraftTopology {
  if (frame.geometryProfile === "ho229V2") return hoTopology();
  const centerlines: CenterlineDefinition[] = [];
  const connections: CenterlineConnection[] = [];
  const geometry = aircraftGeometryProfile(frame.geometryProfile);
  const fuselageNodes = [
    { id: "nose", station: frame.length * .31, section: { width: .22, height: .2 } },
    { id: "cockpit", station: frame.length * .11, section: { width: .75, height: .72 } },
    { id: "wing-root", station: 0, section: { width: 1, height: 1 } },
    { id: "tail", station: -frame.length * .34, section: { width: .46, height: .55 } },
  ];
  centerlines.push({
    id: "fuselage",
    kind: "fuselage",
    side: 0,
    layer: 0,
    origin: { x: 0, y: 0, z: 0 },
    direction: { x: 0, y: 0, z: 1 },
    length: frame.length,
    profile: "straight",
    nodes: fuselageNodes,
  });
  const profile = geometry?.wing.profile ?? "straight";
  const wingLayers = Math.max(1, frame.wingCount ?? 1);
  for (const side of [-1, 1] as const) {
    for (let layer = 0; layer < wingLayers; layer++) {
      const layerProfile = geometry?.wing.layers?.[layer];
      const id = `${side < 0 ? "left" : "right"}-wing-${layer}`;
      const layerY = layerProfile?.y ?? (layer * (geometry?.wing.tierGap ?? .8) - .02);
      const layerZ = layerProfile?.z ?? ((frame.pioneerLayout?.wingZ ?? geometry?.wing.rootZ ?? -.1) - layer * .12);
      const rootOffset = layerProfile?.rootOffset ?? frame.wingspan * .06;
      const spanScale = layerProfile?.spanScale ?? geometry?.wing.spanScale ?? 1;
      const rootSpan = Math.max(.1, frame.wingspan * .5 - rootOffset);
      const bays = geometry?.id === "fokkerDr1" ? wingBays(wings[layer]) : undefined;
      centerlines.push({
        id,
        kind: "wing",
        side,
        layer,
        origin: {
          x: geometry?.layout === "flyingWing" ? 0 : side * rootOffset,
          y: layerY,
          z: layerZ,
        },
        direction: { x: side, y: 0, z: 0 },
        // The line starts at the fuselage seam. Keeping the root offset out of
        // the length makes the centerline endpoint agree with the silhouette
        // edge and keeps the three Dr.I layers independently measurable.
        length: rootSpan * spanScale,
        profile: layerProfile?.profile ?? profile,
        tipStart: bays && bays[2].start / bays[2].end,
        nodes: bays ? bays.map(bay => ({
          id: bay.role, station: rootSpan * spanScale * (bay.start + bay.end) / (2 * bays[2].end),
        })) : [
          { id: "root", station: 0, section: { width: frame.length * .19, height: .12 } },
          { id: "tip", station: frame.wingspan * .44, section: { width: frame.length * .13, height: .07 } },
        ],
        relation: layer ? "vertical" : "branch",
        parentId: "fuselage",
      });
      connections.push({ id: `${id}:root`, from: "fuselage", to: id, relation: layer ? "vertical" : "branch", offset: { x: geometry?.layout === "flyingWing" ? 0 : side * rootOffset, y: layerY, z: layerZ } });
    }
  }
  if (geometry?.tail.kind !== "none") {
    centerlines.push({
      id: "tail",
      kind: "tail",
      side: 0,
      layer: 0,
      origin: { x: 0, y: 0, z: geometry?.tail.z !== undefined ? frame.length * geometry.tail.z : -frame.length * .34 },
      direction: { x: 0, y: 0, z: -1 },
      length: frame.length * .22,
      profile: "straight",
      nodes: [{ id: "root", station: 0 }, { id: "tip", station: frame.length * .22 }],
      relation: "branch",
      parentId: "fuselage",
    });
  }
  if (geometry?.layout === "twinBoom") {
    for (const side of [-1, 1] as const) {
      const id = `${side < 0 ? "left" : "right"}-tail-boom`;
      centerlines.push({
        id,
        kind: "tail",
        side,
        layer: 0,
        origin: { x: side * frame.wingspan * .22, y: 0, z: -frame.length * .2 },
        direction: { x: 0, y: 0, z: -1 },
        length: frame.length * .32,
        profile: "straight",
        nodes: [{ id: "root", station: 0 }, { id: "tip", station: frame.length * .32 }],
        relation: "parallel",
        parentId: "fuselage",
      });
      connections.push({ id: `${id}:bridge`, from: "fuselage", to: id, relation: "parallel", offset: { x: side * frame.wingspan * .22, y: 0, z: -frame.length * .2 } });
    }
  }
  return { version: 1, centerlines, connections };
}

export function mountForPart(
  part: { id: string; kind?: string; role: PartRole; slot: Slot; side?: -1 | 0 | 1; x?: number; y?: number; z?: number },
  frame: Airframe,
  options: Partial<CenterlineMount> = {},
): CenterlineMount {
  const side = part.side ?? (part.slot === "leftWing" ? -1 : part.slot === "rightWing" ? 1 : 0);
  const wingRootFactor = aircraftGeometryProfile(frame.geometryProfile)?.layout === "flyingWing" ? .17 : .23;
  const wingId = `${side < 0 ? "left" : "right"}-wing-0`;
  const lineId = options.lineId ?? (part.slot === "leftWing" || part.slot === "rightWing" ? wingId : part.slot === "tail" ? "tail" : "fuselage");
  const station = options.station ?? (part.slot === "nose" ? frame.length * .31 : part.slot === "tail" ? 0 : part.slot === "bottom" ? 0 : part.slot === "top" ? frame.length * .08 : part.slot === "leftWing" || part.slot === "rightWing" ? frame.wingspan * .17 : 0);
  const base = part.slot === "tail"
    ? { x: 0, y: 0, z: -frame.length * .34 }
    : part.slot === "nose"
      ? { x: 0, y: 0, z: frame.length * .31 }
      : part.slot === "leftWing" || part.slot === "rightWing"
        ? { x: side * frame.wingspan * wingRootFactor, y: -.02, z: frame.pioneerLayout?.wingZ ?? -.1 }
        : { x: 0, y: 0, z: 0 };
  const offset = options.offset ?? (
    part.x !== undefined || part.y !== undefined || part.z !== undefined
      ? { x: (part.x ?? base.x) - base.x, y: (part.y ?? base.y) - base.y, z: (part.z ?? base.z) - base.z }
      : undefined
  );
  return { ...options, lineId, station, layer: options.layer ?? layerForPart({ role: part.role, kind: part.kind ?? part.role }),
    offset, profile: options.profile ?? (frame.geometryProfile === "fokkerDr1" ? "inverted-gull" : "straight") };
}

export function mountForUpgrade(
  id: string,
  part: Pick<Part, "slot" | "side" | "kind" | "role">,
  frame: Airframe,
  existing: readonly Part[],
  structureLength?: number,
): CenterlineMount {
  const side = part.side ?? (part.slot === "leftWing" ? -1 : part.slot === "rightWing" ? 1 : 0);
  if (frame.geometryProfile === "ho229V2" && part.slot === "tail") {
    return { lineId: "fuselage", station: hoZ(650), segmentRole: "mount", layer: layerForPart(part) };
  }
  if (frame.geometryProfile === "fokkerDr1" && !id.endsWith("wing_segment")) {
    const location = {
      left_engine: { x: -2, y: -.25, z: stationZ(45) },
      right_engine: { x: 2, y: -.25, z: stationZ(45) },
      radiator: { x: 0, y: -.12, z: stationZ(68) },
      cooling_loop: { x: 0, y: .34, z: stationZ(150) },
      ammo: { x: 0, y: .43, z: stationZ(76) },
      heavy_armor: { x: 0, y: .05, z: stationZ(104) },
      bomb_bay: { x: 0, y: -.46, z: stationZ(102) },
    }[id];
    if (location) return {
      lineId: "fuselage", station: location.z,
      offset: { x: location.x, y: location.y, z: 0 },
      layer: layerForPart(part), segmentRole: "mount",
    };
  }
  const lineId = part.slot === "leftWing" || part.slot === "rightWing" ? `${side < 0 ? "left" : "right"}-wing-0` : part.slot === "tail" ? "tail" : "fuselage";
  const count = existing.filter((candidate) => candidate.centerline?.lineId === lineId && candidate.centerline.segmentRole === "insert").length;
  const insertion = id.endsWith("wing_segment") ? "tip-before" : "station";
  const station = id.endsWith("wing_segment") ? frame.wingspan * .46 + count * (structureLength ?? 0) : id === "tail_side_bay" ? count * (structureLength ?? 0) : id === "serial_bomb_bay" ? -.2 - count * (structureLength ?? 0) : part.slot === "tail" ? 0 : part.slot === "nose" ? frame.length * .31 : 0;
  return {
    lineId,
    station,
    layer: layerForPart(part),
    segmentLength: structureLength,
    segmentRole: structureLength === undefined ? "mount" : "insert",
    insertion,
  };
}

export function mountForSlot(slot: Slot, role: PartRole, side: -1 | 0 | 1, frame: Airframe) {
  return mountForPart({ id: "", kind: role, role, slot, side, x: 0, z: 0 }, frame);
}
