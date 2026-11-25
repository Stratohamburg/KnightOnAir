import { meteorF3Id, meteorF3ReviewContours } from "./meteorF3Sheet";

type Point = readonly [number, number];
type View = keyof typeof meteorF3ReviewContours;

function outline(view: View, name: string) {
  return meteorF3ReviewContours[view].find(edge => edge.name === name)!;
}

// Intersect a measured polyline with an orthographic station. At an edge
// parallel to the cut, retain both endpoints rather than averaging them away.
function cut(points: readonly Point[], at: number, axis: 0 | 1, closed = false) {
  const other = axis === 0 ? 1 : 0;
  const path = closed ? [...points, points[0]] : points;
  const hits: number[] = [];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    if (at < Math.min(a[axis], b[axis]) || at > Math.max(a[axis], b[axis])) continue;
    if (a[axis] === b[axis]) hits.push(a[other], b[other]);
    else hits.push(a[other] + (b[other] - a[other]) * (at - a[axis]) / (b[axis] - a[axis]));
  }
  return [Math.min(...hits), Math.max(...hits)] as const;
}

export const meteorUnit = .04;
export const meteorLength = 301 * meteorUnit;
export const meteorSpan = 311 * meteorUnit;
export const meteorZ = (station: number) => (150.5 - station) * meteorUnit;

export const meteorF3Frame = {
  id: meteorF3Id, geometryProfile: "meteorF3", era: "ww2", shape: "plane",
  name: "Gloster Meteor F.3", role: "双发喷气机", color: "#9ca8aa", accent: "#bec6c5",
  length: meteorLength, wingspan: meteorSpan, liftCenterY: .08, liftCenterZ: .35,
} as const;

const bodyPlan = outline("plan", "机身外轮廓可见段").points;
const bodyDeck = outline("side", "机身上缘").points;
const foreBelly = outline("side", "机身下缘可见段").points;
const aftBelly = outline("side", "短舱后方机身下缘").points;
// Only the belly interval behind the nacelle is occluded in side view. The
// continuation stays inside that silhouette and meets the first exposed point.
const bodyBelly: Point[] = [...foreBelly, [105, 9.7], [143, 5.6], ...aftBelly, [278, -17]];
export const meteorBody = [0, 3, 10, 18, 32, 56, 76, 84, 110, 140, 162, 179.2, 198, 216, 241, 253, 263].map(station => ({
  station,
  width: cut(bodyPlan, station, 1)[1],
  high: -cut(bodyDeck, station, 0)[0],
  low: -cut(bodyBelly, station, 0)[1],
})).concat([
  { station: 269, width: 4.4, high: 24.7, low: 14 },
  { station: 278, width: 2.3, high: 22.8, low: 17 },
]);

// Front outline determines the fuselage cross-section family. Maintain the
// broad lower shoulder and radiused crown in each station's measured envelope.
const bodyFront = outline("front", "中央机身").points;
const bodyFrontWidth = Math.max(...bodyFront.map(([x]) => x));
const bodyFrontTop = Math.min(...bodyFront.map(([, y]) => y));
const bodyFrontBottom = Math.max(...bodyFront.map(([, y]) => y));
export const meteorBodySection = bodyFront.map(([x, y]): Point => [
  x / bodyFrontWidth, (bodyFrontBottom - y) / (bodyFrontBottom - bodyFrontTop),
]);

const canopyPlan = outline("plan", "座舱罩").points;
const canopySide = outline("side", "座舱罩").points;
export const meteorCanopy = [37, 42, 46, 50, 57, 58.4, 66, 70, 79, 81, 85, 88.5].map(station => {
  const high = -cut(canopySide, station, 0)[0];
  return {
    station, high,
    width: cut(canopyPlan, station, 1, true)[1],
    low: Math.min(-cut(bodyDeck, station, 0)[0], high) - .25,
  };
});

type WingRow = { span: number; fore: number; aft: number; high: number; low: number };
const wingPlanOuter = outline("plan", "右外翼").points;
const wingFrontOuter = outline("front", "右主翼外段").points;
const wingFrontOuterSpans = wingFrontOuter.map(([span]) => span);
const wingPlanFore: Point[] = [[13.5, 81.5], ...outline("plan", "右内翼可见边").points.slice().reverse(), [66.5, 83]];
const wingPlanAft = outline("plan", "右内翼后缘与翼根过渡").points;
const wingFrontInner = outline("front", "右主翼内段").points;

const wingInboard: WingRow[] = [13.5, 17.5, 20.5, 25.5, 32.5, 35.5, 41.5, 44.5].map(span => {
  const clamped = Math.min(41.5, Math.max(16, span));
  const [top, bottom] = cut(wingFrontInner, clamped, 0, true);
  return { span, fore: cut(wingPlanFore, span, 0)[0], aft: cut(wingPlanAft, span, 0)[1], high: -top, low: -bottom };
});
const wingOutboard: WingRow[] = [...new Set(wingPlanOuter.map(([span]) => span))].sort((a, b) => a - b).map(span => {
  const [fore, aft] = cut(wingPlanOuter, span, 0, true);
  const frontSpan = Math.max(Math.min(...wingFrontOuterSpans), Math.min(span, Math.max(...wingFrontOuterSpans)));
  const [top, bottom] = cut(wingFrontOuter, frontSpan, 0, true);
  return { span, fore, aft, high: -top, low: -bottom };
});

export const meteorInboardWing = [...wingInboard, { span: 54, fore: 83, aft: 161, high: 4.7, low: -2.6 }];
export const meteorOutboardWing = [
  { span: 60, fore: 83, aft: 160, high: 5.5, low: -2.1 },
  ...wingOutboard,
];

// [normalized chord station, upper height, lower height] sampled from the
// side-view superposition of the wing. Front projection sets spanwise height.
export const meteorWingSection = [
  [0, .29, .29], [.052, .60, .11], [.20, .86, 0], [.30, 1, 0],
  [.47, 1, 0], [.60, .90, .05], [.70, .72, .07], [.84, .50, .10], [1, .23, .23],
] as const;

// Short-nacelle exterior sections. Circular radii reconcile the registered
// plan width and side height while the lip is fixed by the front projection.
// Row format is [station, half spacing, center height, radius].
export const meteorNacelle = [
  [73, 54.9, 0, 13.55], [75, 54.95, .1, 14], [81, 55.6, .6, 13.15],
  [88, 56.6, .8, 13.6], [101, 57.2, 1, 14.35], [115, 57.2, 1.5, 14],
  [131, 56.9, 1.4, 12.4], [145, 56, .8, 10.1], [156, 55.6, .3, 7.7],
  [164, 56.1, .4, 5.45], [169, 56.35, 1, 3.9], [173, 56.375, 1.55, 3.25],
] as const;
export const meteorInlet = { radius: 7.55, depth: 5.5 };
export const meteorOutlet = { radius: 2.4, depth: 3.5 };

const tailPlan = outline("plan", "右水平尾翼").points;
const tailFront = outline("front", "水平尾翼").points;
export const meteorTailplane = [0, 1, 11, 26, 32, 40, 49, 51, 55, 56].map(span => {
  const [fore, aft] = cut(tailPlan, Math.max(span, 1), 0, true);
  const [top, bottom] = cut(tailFront, Math.min(span, 53.5), 0, true);
  return { span, fore, aft, high: -top, low: -bottom };
});
export const meteorTailSection = [
  [0, .39, .39], [.15, .68, .20], [.38, 1, 0], [.66, .81, 0], [.9, .58, .24], [1, .45, .45],
] as const;

const finSide = outline("side", "垂尾与方向舵可见边").points;
const finPlan = outline("plan", "垂尾在俯视中的可见轮廓").points;
export const meteorFin = [253, 256, 263.4, 269, 276.2, 281.2, 285.1, 290, 294, 297, 299.9, 300.9].map(station => {
  const [top, bottom] = cut(finSide, station, 0, true);
  const width = station <= 300 ? cut(finPlan, station, 1, true)[1] : .12;
  return { station, width, high: -top, low: -bottom };
});
