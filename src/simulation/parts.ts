import { bayOutline, sheetSpan, stationZ, unit, wingOutline, wingSegments } from "../data/fokkerDr1Sheet";
import type { Part, PartRole, Slot } from "./types";
import type { CenterlineMount } from "./CenterlineLayout";
import { applyCenterlineLayout, lineExtension, type AircraftTopology } from "./CenterlineLayout";
import { aircraftGeometryProfile, FUSELAGE_SECTIONS, mainWing, wingSection, WING_TIP_START } from "../content/3d/airframeShape";

export interface PartRecipe {
  role?: PartRole;
  side?: -1 | 0 | 1;
  kind?: string;
  slot?: Slot;
  x?: number;
  y?: number;
  z?: number;
  radius?: number;
  health?: number;
  healthShare?: number;
  lift?: number;
  thrust?: number;
  weaponIds?: string[];
  damageTransfer?: number;
  weight?: number;
  detachable?: boolean;
  parentId?: string;
  connection?: { side: -1 | 0 | 1; x: number; z: number };
  centerline?: CenterlineMount;
  engineInstallation?: "tractor" | "pusher";
}

export const inferRole = (kind = "body", slot: Slot = "center"): PartRole =>
  kind === "bombBay" ? "bay" :
    kind === "winglet" || kind === "wing" ? "wing" :
      kind === "engine" ? "engine" :
        kind === "tail" ? "tail" :
          kind === "radar" ? "radar" :
            kind === "turret" ? "turret" :
              ["gun", "cannon", "rocket", "ammo", "tailGun"].includes(kind)
                ? "gun"
                : slot === "center" ? "body" : "gun";

export function partFromRecipe(
  id: string,
  recipe: PartRecipe,
  fallback: { health: number; x?: number; z?: number; radius?: number } = { health: 1 },
): Part {
  const kind = recipe.kind ?? recipe.role ?? "body";
  const role = recipe.role ?? inferRole(kind, recipe.slot ?? "center");
  const slot = recipe.slot ?? (role === "wing" ? (recipe.side === -1 ? "leftWing" : "rightWing") : "center");
  const side = recipe.side ?? (slot === "leftWing" ? -1 : slot === "rightWing" ? 1 : 0);
  const health = recipe.health ?? fallback.health * (recipe.healthShare ?? 1);
  const height = { engine: -.13, turret: .6, gun: .02, bay: -.38, radar: .3, wing: .12 };
  return {
    id,
    kind,
    role,
    side,
    slot,
    x: recipe.x ?? fallback.x ?? 0,
    y: recipe.y ?? (height as Partial<Record<PartRole, number>>)[role] ?? 0,
    z: recipe.z ?? fallback.z ?? 0,
    radius: recipe.radius ?? fallback.radius ?? 0.5,
    health,
    maxHealth: health,
    destroyed: false,
    disabled: false,
    state: "intact",
    lift: recipe.lift ?? (role === "wing" ? 1 : 0),
    thrust: recipe.thrust ?? (role === "engine" ? 1 : 0),
    weaponIds: recipe.weaponIds ?? [],
    damageTransfer: recipe.damageTransfer ?? (role === "engine" ? 0.35 : role === "wing" ? 0.5 : 1),
    visual: { kind: role, scale: 1, detachable: recipe.detachable ?? ["wing", "float", "engine", "tail"].includes(role) },
    weight: recipe.weight ?? 5,
    addedMass: (recipe.weight ?? 5) * 10,
    detachSeed: id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0),
    parentId: recipe.parentId,
    connection: recipe.connection,
    centerline: recipe.centerline,
    engineInstallation: recipe.engineInstallation,
  };
}

export function refreshPartLayout(parts: Part[], wingspan: number, length: number, topology?: AircraftTopology) {
  for (const part of parts) {
    if (part.role === "wing" || part.kind === "wing" || part.kind === "winglet") {
      part.x = (part.side ?? (part.slot === "leftWing" ? -1 : 1)) * wingspan * 0.23;
      part.radius = Math.max(part.radius, wingspan * 0.16);
    }
    if (part.slot === "nose") part.z = length * 0.31;
    if (part.slot === "tail") part.z = -length * 0.34;
  }
  if (topology) applyCenterlineLayout(topology, parts);
}

export function refreshAirframeSilhouette(parts: Part[], wingspan: number, length: number, width: number, tiers: number, wingLength = length, sideWingspans?: { left: number; right: number }, frameId?: string) {
  const geometry = aircraftGeometryProfile(frameId);
  for (const part of parts) {
    if (part.id === "center_body") {
      const sections = geometry?.fuselage.sections ?? FUSELAGE_SECTIONS;
      const bodyWidth = geometry?.id === "fokkerDr1" ? geometry.fuselage.width : width;
      part.silhouette = sections.slice(1).map(([end, endWidth], index) => {
        const [start, startWidth] = sections[index];
        return [
          { x: -startWidth * bodyWidth, y: 0, z: start * length },
          { x: startWidth * bodyWidth, y: 0, z: start * length },
          { x: endWidth * bodyWidth, y: 0, z: end * length },
          { x: -endWidth * bodyWidth, y: 0, z: end * length },
        ];
      });
    }
    if (geometry?.id === "fokkerDr1" && part.role === "wing") {
      const segment = wingSegments.find(candidate => candidate.id === part.id);
      if (segment) {
        const span = (segment.side < 0 ? sideWingspans?.left : sideWingspans?.right) ?? wingspan;
        const offset = segment.role === "tip" ? lineExtension(parts, segment.lineId) : 0;
        part.silhouette = [bayOutline(wingOutline(segment.wing), segment.start, segment.end)
          .map(([x,s]) => ({ x: segment.side * (x * span / sheetSpan + offset),
            y: segment.wing.height * unit, z: stationZ(s) }))];
        continue;
      }
      const mount = part.centerline;
      if (mount?.segmentRole === "insert" && mount.segmentLength) {
        const terminal = wingSegments.find(candidate => candidate.lineId === mount.lineId && candidate.role === "tip");
        if (terminal) {
          const side = terminal.side;
          const half = mount.segmentLength / 2;
          const { height, leading, trailing } = terminal.wing;
          part.silhouette = [[[-half,leading],[half,leading],[half,trailing],[-half,trailing]]
            .map(([x,s]) => ({x: part.x + side*x, y: height * unit, z: stationZ(s)}))];
          continue;
        }
      }
    }
    if (/^(left|right)_wing(_tip)?$/.test(part.id)) {
      const side = part.side ?? 1;
      const sideSpan = side < 0 ? sideWingspans?.left ?? wingspan : sideWingspans?.right ?? wingspan;
      const tip = part.id.endsWith("_tip");
      const hasTip = parts.some(({ id }) => id === `${part.id}_tip`);
      const profile = geometry?.wing;
      const from = tip ? WING_TIP_START : 0;
      const to = hasTip ? WING_TIP_START : 1;
      const layerCount = Math.max(tiers, profile?.layers?.length ?? 0);
      part.silhouette = [];
      for (let tier = 0; tier < layerCount; tier++) {
        const layer = profile?.layers?.[tier];
        const base = mainWing(sideSpan * (layer?.spanScale ?? profile?.spanScale ?? 1), wingLength, side);
        if (geometry?.layout === "flyingWing") base.rootX = 0;
        else if (layer?.rootOffset !== undefined) base.rootX = side * layer.rootOffset;
        const fallbackY = tier === 0 ? -.02 : tier * (profile?.tierGap ?? .8) - .02;
        const fallbackZ = tier === 0 ? profile?.rootZ ?? base.z : (profile?.rootZ ?? .12) - tier * .12;
        part.silhouette.push(wingSection({
          ...base,
          y: layer?.y ?? fallbackY,
          z: layer?.z ?? fallbackZ,
          chord: wingLength * (layer?.chord ?? profile?.chord ?? .37) * (tier === 0 ? 1 : .9),
          tipChord: wingLength * (layer?.tipChord ?? profile?.tipChord ?? .16) * (tier === 0 ? 1 : .9),
          sweep: wingLength * (layer?.sweep ?? profile?.sweep ?? .13),
          planform: layer?.planform ?? profile?.planform ?? base.planform,
          profile: layer?.profile ?? profile?.profile ?? part.centerline?.profile,
        }, from, to));
      }
      if (tip) {
        const corners = part.silhouette[0];
        part.x = (corners[0].x + corners[1].x) * .5;
        part.y = corners[0].y;
        part.z = corners.reduce((total, point) => total + point.z, 0) / corners.length;
      }
    } else if (part.role === "wing" && part.centerline?.segmentRole === "insert") {
      const side = part.side ?? (part.slot === "leftWing" ? -1 : 1);
      const span = part.centerline.segmentLength ?? .7;
      part.silhouette = [wingSection({
        rootX: part.x - side * span * .5,
        y: part.y ?? .12,
        z: part.z,
        span: side * span,
        chord: wingLength * .16,
        sweep: wingLength * .06,
        profile: part.centerline?.profile,
      })];
    }
  }
}
