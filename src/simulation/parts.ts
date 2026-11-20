import type { Part, PartRole, Slot } from "./types";

export interface PartRecipe {
  role?: PartRole;
  side?: -1 | 0 | 1;
  kind?: string;
  slot?: Slot;
  x?: number;
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
  return {
    id,
    kind,
    role,
    side,
    slot,
    x: recipe.x ?? fallback.x ?? 0,
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
