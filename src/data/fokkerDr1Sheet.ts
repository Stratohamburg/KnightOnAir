// Review drawing units follow the plan panel in Fokker_Dr.I_dwg.jpg.
// Stations run aft from the propeller. Height is positive above the shaft.
export const bodyRadius = 21;
const diameter = 2 * bodyRadius;
export const wings = [
  { id: "lower", label: "下翼", span: 250, leading: 50, trailing: 98, height: -bodyRadius, ink: "#376481" },
  { id: "middle", label: "中翼", span: 272, leading: 36, trailing: 87, height: bodyRadius, ink: "#35816d" },
  { id: "upper", label: "上翼", span: 315, leading: 25, trailing: 76, height: bodyRadius + diameter, ink: "#ad5038" },
] as const;

// At the same longitudinal stations, read half-width from plan and deck/belly from elevation.
export const hull = [
  { s: 8, w: 18, deck: 18, belly: -18 },
  { s: 18, w: bodyRadius, deck: bodyRadius, belly: -bodyRadius },
  { s: 73, w: 20, deck: bodyRadius, belly: -bodyRadius },
  { s: 94, w: 17, deck: 15, belly: -18 },
  { s: 112, w: 16, deck: 20, belly: -17 },
  { s: 180, w: 10, deck: 15, belly: -6 },
  { s: 225, w: 3, deck: 10, belly: 3 },
];

// One model unit conversion on all three drawing axes. The shaft datum is
// halfway between the propeller and the aft extremity of the rudder.
export const sheetLength = 253;
export const sheetSpan = wings[2].span;
export const baseLength = 6;
export const unit = baseLength / sheetLength;
export const stationZ = (station: number) => (sheetLength / 2 - station) * unit;

export type Point = readonly [number, number];
export type Wing = typeof wings[number];

// Each row traces the right half of the accepted outline from the root.
// The extra shoulder on the upper wing is its projecting aileron.
export function wingOutline(w: Wing): Point[] {
  const tip = w.span / 2;
  const nose = w.leading;
  const aft = w.trailing;
  if (w.id === "upper") {
    const shoulder = tip - 11;
    return [[0, nose], [shoulder - 4, nose], [shoulder - 1, nose + 1], [shoulder, nose + 5],
      [shoulder, 55], [tip - 3, 55], [tip - 1, 56], [tip, 59], [tip, 83],
      [tip - 1, 86], [tip - 4, 87], [65, 87], [49, aft], [0, aft]];
  }
  return [[0, nose], [tip - 4, nose], [tip - 1, nose + 1], [tip, nose + 4],
    [tip, aft - 4], [tip - 1, aft - 1], [tip - 4, aft], [0, aft]];
}

// Digitized from the main rib detail (source x ≈ 439..858). Offsets are
// fractions of the main chord above the lower tangent, shared by all three ribs.
export const rib: readonly (readonly [fraction: number, upper: number, lower: number])[] = [
  [0, .039, .039], [.008, .055, .025], [.025, .073, .013], [.06, .094, .004],
  [.11, .114, 0], [.20, .132, .007], [.28, .138, .014], [.40, .131, .017],
  [.60, .100, .014], [.80, .058, .009], [1, .004, .002],
];

export const aileronHinge = { innerX: 49, station: 73, hornStation: 55 };
export const elevatorHinge = { station: 225, outerX: 43 };
export const rudderPivot = { station: 225, foot: 7 };
export const hullBays = [
  { id: "cowling", label: "发动机整流罩", start: 8, end: 18 },
  { id: "forward", label: "翼根承力前段", start: 18, end: 85 },
  { id: "cockpit", label: "座舱段", start: 85, end: 112 },
  { id: "aft", label: "渐收后机身", start: 112, end: 175 },
  { id: "tailpost", label: "尾翼连接段", start: 175, end: 225 },
] as const;

export function hullAt(station: number) {
  const upper = hull.findIndex(p => p.s >= station);
  const b = hull[upper], a = hull[Math.max(0, upper - 1)];
  const t = b.s === a.s ? 0 : (station - a.s) / (b.s - a.s);
  return { w: a.w + (b.w-a.w)*t, deck: a.deck + (b.deck-a.deck)*t, belly: a.belly + (b.belly-a.belly)*t };
}

// Contours are read clockwise from each half-wing's root. The projecting
// horn moves with the aileron. The small clearance makes the joint legible.
export function wingPanels(w: Wing): { id: "fixed" | "aileron"; outline: Point[] }[] {
  const full = wingOutline(w);
  if (w.id !== "upper") return [{ id: "fixed", outline: full }];
  const { innerX, station } = aileronHinge;
  const shoulder = w.span / 2 - 11;
  const fixed: Point[] = [...full.slice(0, 4), [shoulder, station - .45],
    [innerX - .45, station - .45], [innerX - .45, w.trailing], [0, w.trailing]];
  const moving: Point[] = [[innerX + .45, station + .45], [shoulder + .45, station + .45],
    [shoulder + .45, aileronHinge.hornStation], ...full.slice(5, 12), [innerX + .45, w.trailing]];
  return [{ id: "fixed", outline: fixed }, { id: "aileron", outline: moving }];
}

export const tailplaneHalf: Point[] = [[0,175],[12,181],[30,194],[51,211],[57,221],
  [58,230],[57,237],[55,242],[45,244],[22,244],[12,241],[5,235],[0,228]];
// The elevator horns extend forward of the central transverse hinge.
export const stabilizerHalf: Point[] = [...tailplaneHalf.slice(0,3), [43,204.5],
  [43,elevatorHinge.station-.45], [0,elevatorHinge.station-.45]];
export const elevatorHalf: Point[] = [[0,elevatorHinge.station+.45], [43.7,elevatorHinge.station+.45],
  [43.7,205.1], ...tailplaneHalf.slice(3)];

// Station and height in the side drawing.
export const finOutline: Point[] = [[218,7],[214,17],[214,25],[216,32],[221,39],
  [228,41],[236,41],[245,38],[251,32],[253,23],[251,16],[245,10],[232,6]];

export function mirroredOutline(half: readonly Point[]): Point[] {
  return [...half, ...half.slice(1, -1).reverse().map(([x, s]): Point => [-x, s])];
}

export function clipOutline(outline: readonly Point[], axis: 0 | 1, limit: number, keepAbove: boolean): Point[] {
  const clipped: Point[] = [];
  if (!outline.length) return clipped;
  let previous = outline[outline.length - 1];
  for (const point of outline) {
    const d0 = previous[axis] - limit, d1 = point[axis] - limit;
    if (d0 * d1 < 0) {
      const t = d0 / (d0 - d1);
      clipped.push([previous[0] + t * (point[0] - previous[0]), previous[1] + t * (point[1] - previous[1])]);
    }
    if (keepAbove ? d1 >= 0 : d1 <= 0) clipped.push(point);
    previous = point;
  }
  return clipped;
}

// Assembly divisions in plate units. The upper tip owns the complete aileron.
export function wingBays(wing: Wing) {
  const rootEnd = wing.id === "upper" ? 38 : bodyRadius;
  const tipStart = wing.id === "upper" ? aileronHinge.innerX - 1 : 109;
  return [
    { role: "root", start: 0, end: rootEnd },
    { role: "main", start: rootEnd, end: tipStart },
    { role: "tip", start: tipStart, end: wing.span / 2 },
  ] as const;
}

export const wingSegments = wings.flatMap((wing, layer) => ([-1, 1] as const).flatMap(side => {
  const hand = side < 0 ? "left" : "right";
  const prefix = hand + "_wing" + (layer ? "_" + wing.id : "");
  return wingBays(wing).map(bay => ({
    ...bay, wing, side, layer, lineId: hand + "-wing-" + layer,
    id: prefix + (bay.role === "root" ? "" : "_" + bay.role),
    parentId: bay.role === "root" ? "center_body" : bay.role === "main" ? prefix : prefix + "_main",
  }));
}));

export function bayOutline(outline: readonly Point[], start: number, end: number) {
  return clipOutline(clipOutline(outline, 0, start, true), 0, end, false);
}
