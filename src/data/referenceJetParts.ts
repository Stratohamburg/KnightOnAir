import type { CombatPartRecipe } from "./combatants";
import { meteorBody, meteorF3Frame, meteorInboardWing, meteorNacelle, meteorOutboardWing, meteorTailplane, meteorUnit, meteorZ } from "./meteorF3ModelSheet";
import { fb5Boom, fb5BoomX, fb5Frame, fb5Pod, fb5Tailplane, fb5Unit, fb5Wing, fb5Z } from "./vampireFb5Sheet";

type Row = { x: number; y: number; fore: number; aft: number };

function strips(rows: readonly Row[]): CombatPartRecipe["silhouette"] {
  return rows.slice(1).map((row, index) => {
    const previous = rows[index];
    return [
      { x: previous.x, y: previous.y, z: previous.fore },
      { x: row.x, y: row.y, z: row.fore },
      { x: row.x, y: row.y, z: row.aft },
      { x: previous.x, y: previous.y, z: previous.aft },
    ];
  });
}

function shell(rows: readonly { x: number; y: number; z: number; width: number }[]): CombatPartRecipe["silhouette"] {
  return rows.slice(1).map((row, index) => {
    const previous = rows[index];
    return [
      { x: previous.x - previous.width, y: previous.y, z: previous.z },
      { x: previous.x + previous.width, y: previous.y, z: previous.z },
      { x: row.x + row.width, y: row.y, z: row.z },
      { x: row.x - row.width, y: row.y, z: row.z },
    ];
  });
}

function meteorParts(): CombatPartRecipe[] {
  const [front, engineX] = meteorNacelle[0];
  const [outlet, outletX, outletY] = meteorNacelle.at(-1)!;
  const surface = (rows: typeof meteorInboardWing, side: number) => strips(rows.map(({ span, fore, aft, high, low }) => ({
    x: side * span * meteorUnit, y: (high + low) * .5 * meteorUnit, fore: meteorZ(fore), aft: meteorZ(aft),
  })))!;
  const parts: CombatPartRecipe[] = [
    { id: "center_body", role: "body", slot: "center", side: 0, health: 50, damageTransfer: 1, detachable: false,
      silhouette: shell(meteorBody.map(({ station, width, high, low }) => ({
        x: 0, y: (high + low) * .5 * meteorUnit, z: meteorZ(station), width: width * meteorUnit,
      }))) },
    { id: "tail", role: "tail", slot: "tail", side: 0, health: 10, damageTransfer: 1, detachable: true,
      x: 0, y: 42 * meteorUnit, z: meteorZ(276), parentId: "center_body",
      silhouette: [...surface(meteorTailplane, -1), ...surface(meteorTailplane, 1)] },
  ];
  for (const [side, wing, engine, slot] of [
    [-1, "left_wing", "engine_0", "leftWing"], [1, "right_wing", "engine_1", "rightWing"],
  ] as const) {
    parts.push(
      { id: wing, role: "wing", side, slot, x: side * 76 * meteorUnit, y: 0, z: meteorZ(117), parentId: "center_body",
        health: 12, lift: 1, damageTransfer: .5, detachable: true,
        silhouette: [...surface(meteorInboardWing, side), ...surface(meteorOutboardWing, side)] },
      { id: engine, role: "engine", side, slot, x: side * engineX * meteorUnit, y: 0, z: meteorZ(front), parentId: wing,
        health: 8, thrust: 1, damageTransfer: .35, detachable: true,
        outletOffset: { x: side * (outletX - engineX) * meteorUnit, y: outletY * meteorUnit, z: meteorZ(outlet) - meteorZ(front) },
        silhouette: shell(meteorNacelle.map(([station, x, y, width]) => ({
          x: side * x * meteorUnit, y: y * meteorUnit, z: meteorZ(station), width: width * meteorUnit,
        }))) },
    );
  }
  return parts;
}

function vampireParts(): CombatPartRecipe[] {
  const [outlet, , high, low] = fb5Pod.at(-1)!;
  const podShape = (rows: typeof fb5Pod, x: number) => shell(rows.map(([station, width, top, bottom]) => ({
    x, y: (top + bottom) * .5 * fb5Unit, z: fb5Z(station), width: width * fb5Unit,
  })));
  const surface = (rows: readonly (readonly [number, number, number, number, number])[], side = 1) =>
    strips(rows.map(([span, fore, aft, top, bottom]) => ({
      x: side * span * fb5Unit, y: (top + bottom) * .5 * fb5Unit, fore: fb5Z(fore), aft: fb5Z(aft),
    })));
  const parts: CombatPartRecipe[] = [
    { id: "center_body", role: "body", slot: "center", side: 0, health: 46, damageTransfer: 1, detachable: false,
      silhouette: podShape(fb5Pod.filter(([station]) => station <= 97), 0) },
    { id: "engine_0", role: "engine", slot: "center", side: 0, parentId: "center_body", y: 0, z: fb5Z(97),
      health: 14, thrust: 1, damageTransfer: .35, detachable: true,
      outletOffset: { x: 0, y: (high + low) * .5 * fb5Unit, z: fb5Z(outlet) - fb5Z(97) },
      silhouette: podShape(fb5Pod.filter(([station]) => station >= 97), 0) },
    { id: "tail", role: "tail", slot: "tail", side: 0, parentId: "center_body", y: 13 * fb5Unit, z: fb5Z(183),
      health: 6, damageTransfer: 1, detachable: true, silhouette: surface(fb5Tailplane) },
  ];
  for (const [side, wing, boom, slot] of [
    [-1, "left_wing", "left_boom", "leftWing"], [1, "right_wing", "right_boom", "rightWing"],
  ] as const) {
    const x = side * fb5BoomX * fb5Unit;
    parts.push(
      { id: wing, role: "wing", side, slot, parentId: "center_body", x, z: fb5Z(72),
        health: 13, lift: 1, damageTransfer: .5, detachable: true,
        silhouette: surface(fb5Wing, side) },
      { id: boom, role: "tail", side, slot, parentId: wing, x, z: fb5Z(100), health: 4, damageTransfer: 1, detachable: true,
        silhouette: podShape(fb5Boom, x) },
    );
  }
  return parts;
}

export const REFERENCE_JETS = {
  [meteorF3Frame.id]: { frame: meteorF3Frame, parts: meteorParts(), mass: 4800, wingArea: 34.7 },
  [fb5Frame.id]: { frame: fb5Frame, parts: vampireParts(), mass: 3800, wingArea: 24.3 },
};

export function referenceJetById(id: string) {
  return Object.hasOwn(REFERENCE_JETS, id) ? REFERENCE_JETS[id as keyof typeof REFERENCE_JETS] : undefined;
}
