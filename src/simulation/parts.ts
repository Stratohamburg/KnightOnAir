import type { Part, PartRole, Slot } from "./types";
import { FUSELAGE_SECTIONS, mainWing, wingSection, WING_TIP_START } from "../content/3d/airframeShape";

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
  };
}

export function refreshPartLayout(parts: Part[], wingspan: number, length: number) {
  for (const part of parts) {
    if (part.role === "wing" || part.kind === "wing" || part.kind === "winglet") {
      part.x = (part.side ?? (part.slot === "leftWing" ? -1 : 1)) * wingspan * 0.23;
      part.radius = Math.max(part.radius, wingspan * 0.16);
    }
    if (part.slot === "nose") part.z = length * 0.31;
    if (part.slot === "tail") part.z = -length * 0.34;
  }
}

export function refreshAirframeSilhouette(parts: Part[], wingspan: number, length: number, width: number, tiers: number, wingLength = length) {
  for (const part of parts) {
    if (part.id === "center_body") {
      part.silhouette = FUSELAGE_SECTIONS.slice(1).map(([end, endWidth], index) => {
        const [start, startWidth] = FUSELAGE_SECTIONS[index];
        return [
          { x: -startWidth * width, y: 0, z: start * length },
          { x: startWidth * width, y: 0, z: start * length },
          { x: endWidth * width, y: 0, z: end * length },
          { x: -endWidth * width, y: 0, z: end * length },
        ];
      });
    }
    if (/^(left|right)_wing(_tip)?$/.test(part.id)) {
      const side = part.side ?? 1;
      const tip = part.id.endsWith("_tip");
      const hasTip = parts.some(({ id }) => id === `${part.id}_tip`);
      const from = tip ? WING_TIP_START : 0;
      const to = hasTip ? WING_TIP_START : 1;
      part.silhouette = [wingSection(mainWing(wingspan, wingLength, side), from, to)];
      for (let tier = 1; tier < tiers; tier++) {
        part.silhouette.push(wingSection({
          rootX: side * .3, y: tier * .8 - .02, z: .12 - tier * .12,
          span: side * wingspan * .46, chord: wingLength * .34, sweep: wingLength * .12,
        }, from, to));
      }
      if (tip) {
        const corners = part.silhouette[0];
        part.x = (corners[0].x + corners[1].x) * .5;
        part.y = corners[0].y;
        part.z = corners.reduce((total, point) => total + point.z, 0) / corners.length;
      }
    }
  }
}
