export const meteorF3Id = "meteor_18";

export const meteorF3ReviewDatums = {
  front: "M0 -65V29",
  side: "M0 0H301",
  plan: "M0 0V301",
} as const;

export const meteorF3Drawing = {
  src: "https://www.the-blueprints.com/blueprints-depot-restricted/ww2planes/ww2-gloster/gloster_g_41d_meteor_f_3-05197.jpg",
  source: "https://www.the-blueprints.com/blueprints/ww2planes/ww2-gloster/5197/view/gloster_g41d_meteor_f3/",
  width: 500,
  height: 374,
};

type Point = readonly [number, number];
type Contour = { name: string; points: readonly Point[]; closed?: boolean };
type Projection = {
  title: string;
  bounds: readonly [number, number, number, number];
  // SVG affine transform from source pixels to registered drawing units.
  sourceTransform: readonly [number, number, number, number, number, number];
  sourceCrop: readonly Point[];
  contour: readonly Contour[];
};

// One drawing unit is one pixel of the plan panel. Each chain follows the
// visible source edge in order. Coordinates are in the original 500 × 374 image.
export const meteorF3Views = {
  front: {
    title: "正视 · 双进气口与翼线",
    bounds: [-166, -68, 332, 111],
    sourceTransform: [1.00256, .02587, -.02587, 1.00256, -333.07892, -96.87946],
    sourceCrop: [[173, 19], [493, 19], [493, 126], [173, 126]],
    contour: [
      { name: "左主翼外段", points: [[267, 84], [259, 84], [245, 83], [211, 83.5], [190, 82.5], [184, 82.5], [178, 83.5], [185, 85], [212, 88], [241, 89.5], [259, 91], [269, 91.5]] },
      { name: "左主翼内段", points: [[292, 84.5], [320.5, 84.5], [320.5, 94], [304, 94.5], [292, 93.5]] },
      { name: "右主翼内段", points: [[351, 83.5], [377, 83], [377.5, 91.5], [363, 93], [352, 93]] },
      { name: "右主翼外段", points: [[402, 82], [413, 81], [435, 80], [465, 78], [484, 75.5], [488, 76], [481, 79], [453, 83], [424, 86.5], [411, 88.5], [403, 89]] },
      { name: "中央机身", closed: true, points: [[321, 76], [324, 69], [330, 66], [340, 67], [346, 72], [350.5, 81], [351.5, 89], [349, 94.5], [342, 97], [330, 97], [324, 95.5], [321, 91]] },
      { name: "座舱罩", points: [[323, 72], [325, 65], [329, 59], [334, 56.5], [339, 57.5], [344, 62], [347, 70]] },
      { name: "左进气唇口", closed: true, points: [[266.5, 88.5], [268, 82.5], [272.5, 78], [277, 76], [283.5, 76], [289, 79.5], [292.5, 84.5], [295, 90], [291.5, 96.5], [286.5, 101], [281.5, 103.5], [275, 103.5], [270, 100], [267, 94]] },
      { name: "左进气开口", closed: true, points: [[272.5, 89.5], [274, 84.5], [277.5, 82.5], [282.5, 82], [286, 85], [288, 90], [285.5, 95], [281, 97], [276.5, 96.5], [273.5, 94]] },
      { name: "右进气唇口", closed: true, points: [[377.5, 86], [379, 80], [383, 75], [388, 73.5], [394, 74], [399, 77], [402.5, 82], [403.5, 88.5], [401, 94], [397, 98], [391, 100.5], [385.5, 99], [380.5, 95], [378, 90]] },
      { name: "右进气开口", closed: true, points: [[382.5, 86], [384, 81], [389, 79], [394.5, 80], [397, 84], [397, 89.5], [394, 93], [388.5, 94], [384, 91]] },
      { name: "水平尾翼", closed: true, points: [[279, 45.5], [330, 43.5], [341, 43], [387.5, 42], [385, 44.5], [342, 46], [331, 47], [280, 47.5]] },
      { name: "垂尾露出线", points: [[332, 56.5], [332.5, 48], [332.5, 26], [334, 25], [335, 33], [335, 42]] },
    ],
  },
  side: {
    title: "侧视 · 机身与短舱的前后站位",
    bounds: [-10, -68, 322, 111],
    sourceTransform: [.9901, 0, 0, .9901, -181.19, -331.68],
    sourceCrop: [[176, 325], [213, 312], [234, 302], [315, 300], [321, 290], [427, 289], [456, 269], [494, 269], [494, 374], [176, 374]],
    contour: [
      { name: "机身上缘", points: [[183, 335], [186, 330], [192, 327], [201, 323], [215, 319], [223, 317.5], [268, 309.5], [325, 309.5], [398, 309.5], [435, 309.5], [455, 310], [464, 312]] },
      { name: "机身下缘可见段", points: [[183, 335], [187, 339], [197, 342.5], [216, 345], [240, 346], [259.5, 345.5]] },
      { name: "短舱后方机身下缘", points: [[364, 334.5], [383, 333], [412, 328.5], [439, 324], [453, 321.5]] },
      { name: "座舱罩", points: [[219, 318.5], [225, 314], [233, 308], [242, 305], [250, 306.5], [263, 309], [272.5, 310]] },
      { name: "短舱外轮廓可见段", points: [[330, 325.5], [340, 328], [347, 330], [354, 330], [357, 330], [363.5, 331], [364, 335], [356, 336], [354, 339], [346, 341], [328, 345], [308, 348], [292, 350], [275, 349.5], [262, 347], [253, 344], [249, 341], [248, 325], [254, 321.5], [269, 319], [288, 318], [307, 317.5], [322, 317]] },
      { name: "主翼叠合轮廓", closed: true, points: [[269, 337], [273, 332], [285, 328], [292, 326], [305, 326], [315, 327.5], [323, 330], [334, 333.5], [346, 337.5], [331, 339.5], [308, 341], [284, 341], [273, 339.5]] },
      { name: "垂尾与方向舵可见边", points: [[438, 309], [444, 297], [449, 290], [453, 284.5], [457, 280], [462, 275], [467, 272], [471, 272], [476, 274], [480, 277.5], [483, 282], [486, 289], [487, 296], [486, 307], [483, 314], [477, 319], [470, 322], [461, 326], [453, 329], [448, 330], [443, 328], [438, 325.5]] },
      { name: "高置水平尾翼", closed: true, points: [[438, 291.5], [446, 290.5], [464, 289.5], [480, 290.5], [488, 292], [485, 294], [469, 295], [451, 295], [440, 294]] },
    ],
  },
  plan: {
    title: "俯视 · 翼面、短舱与尾翼",
    bounds: [-166, -10, 332, 322],
    sourceTransform: [0, 1, 1, 0, -215.5, -12],
    sourceCrop: [[5, 51], [171, 51], [171, 127], [225, 127], [225, 151], [318, 151], [318, 276], [189, 280], [180, 308], [173, 374], [5, 374]],
    contour: [
      { name: "机身外轮廓可见段", points: [[275, 211], [265, 210], [253, 208], [228, 205.5], [198, 204], [174, 202], [143, 201], [99, 201], [68, 201.5], [44, 203.5], [34, 206.5], [22, 209.5], [15, 213], [12, 216], [12, 218], [15, 221], [22, 224], [34, 228], [44, 230], [68, 232], [99, 232.5], [139, 232], [173, 231], [193, 229.5], [224, 228], [250, 225], [269, 223], [275, 222]] },
      { name: "座舱罩", closed: true, points: [[49, 212], [58, 209.5], [69, 207.5], [82, 208], [93, 211], [100, 215], [102, 216.5], [99, 220], [91, 223], [81, 225], [68, 225.5], [57, 224], [49, 222]] },
      { name: "左外翼", points: [[95, 149], [98, 132], [103, 110], [107, 90], [111, 72], [113, 65], [118, 60], [123, 59], [130, 59], [136, 61], [142, 65], [146, 72], [151, 85], [155, 98.5], [160, 115], [164, 129], [167, 139], [172, 152]] },
      { name: "右外翼", points: [[96, 283], [99, 301], [103, 320], [107, 340], [111, 355], [113, 363], [117, 368], [123, 370], [130, 370], [136, 368], [141, 364], [145, 358], [151, 342], [156, 327], [163, 308], [169, 289], [173, 280]] },
      { name: "左内翼可见边", points: [[95, 171], [94, 180], [93.5, 200]] },
      { name: "左内翼后缘与翼根过渡", points: [[176, 165.5], [174.5, 174], [174.5, 183], [176.5, 190], [179, 195], [183, 198], [190, 202]] },
      { name: "右内翼可见边", points: [[94, 232], [94, 245], [95, 262]] },
      { name: "右内翼后缘与翼根过渡", points: [[175, 265], [174, 259], [174.5, 250], [176.5, 240], [179, 236], [184, 232], [190, 229]] },
      { name: "左短舱", closed: true, points: [[89, 154.5], [92.5, 151], [100, 148.5], [113, 147], [127, 147], [144, 149], [158, 151.5], [174, 155], [181, 157.5], [185, 157.5], [185, 164], [181, 164], [176, 165.5], [164, 168.5], [148, 170.5], [131, 172], [113, 172], [100, 171.5], [92.5, 169.5], [89, 166.5]] },
      { name: "右短舱", closed: true, points: [[89, 267], [92.5, 264], [100, 261.5], [114, 260.5], [128, 260.5], [144, 262], [162, 265], [176, 268.5], [181, 270], [185, 270], [185, 277], [181, 277], [176, 278.5], [164, 281], [147, 283], [130, 284], [114, 284.5], [100, 283.5], [92.5, 281], [89, 278]] },
      { name: "左水平尾翼", points: [[273, 215], [277, 205], [282, 190], [286, 176], [290, 165], [296, 160], [302, 161], [308, 167], [311, 175], [313, 184], [313, 215]] },
      { name: "右水平尾翼", points: [[273, 219], [277, 231], [283, 250], [287, 266], [291, 271], [296, 272], [302, 269], [307, 264], [310, 256], [312, 248], [313, 219]] },
      { name: "垂尾在俯视中的可见轮廓", closed: true, points: [[264, 217], [268, 214.5], [281, 213.5], [302, 214], [312, 216], [310, 218.5], [302, 219], [280, 220], [268, 219.5]] },
    ],
  },
} as const satisfies Record<"front" | "side" | "plan", Projection>;

export type MeteorF3View = keyof typeof meteorF3Views;

export function meteorF3RegisteredPoint(view: MeteorF3View, [x, y]: Point): Point {
  const [a, b, c, d, e, f] = meteorF3Views[view].sourceTransform;
  return [a * x + c * y + e, b * x + d * y + f];
}

// These raw source points are read independently. Centers and end-plane midpoints
// are derived from the visible boundaries on each side of the original drawing.
const frontIntake = [[280.25, 89.5], [389.75, 86.5]] as const;
const planInlet = [[89, 160.5], [89, 272.5]] as const;
const planOutlet = [[185, 160.75], [185, 273.5]] as const;
const planWingtip = [[126.5, 59], [126.5, 370]] as const;
const planTailTip = [[296, 160], [296, 272]] as const;

type PairedLandmark = { name: string; points: readonly [Point, Point] };
export const meteorF3SymmetryTolerance = 5;
export const meteorF3PairedLandmarks: Record<"front" | "plan", readonly PairedLandmark[]> = {
  front: [
    { name: "翼尖", points: [[178, 83.5], [488, 76]] },
    { name: "进气开口中心", points: frontIntake },
    { name: "进气唇口中心", points: [[280.75, 89.75], [390.5, 87]] },
    { name: "平尾翼尖", points: [[279, 45.5], [387.5, 42]] },
  ],
  plan: [
    { name: "主翼翼尖", points: planWingtip },
    { name: "外翼前缘（站位 95）", points: [[107, 90], [107, 340]] },
    { name: "外翼后缘（站位 139）", points: [[151, 85], [151, 342]] },
    { name: "短舱前端", points: planInlet },
    { name: "短舱后端", points: planOutlet },
    { name: "平尾翼尖", points: planTailTip },
  ],
};

function reflect([x, y]: Point): Point {
  return [-x, y];
}

function symmetricLeft(view: "front" | "plan", [left, right]: readonly [Point, Point]): Point {
  const [lx, ly] = meteorF3RegisteredPoint(view, left);
  const [rx, ry] = meteorF3RegisteredPoint(view, right);
  return [(lx - rx) / 2, (ly + ry) / 2];
}

function registerContour(view: MeteorF3View, name: string): Contour {
  const edge = meteorF3Views[view].contour.find(contour => contour.name === name)!;
  return { ...edge, points: edge.points.map(point => meteorF3RegisteredPoint(view, point)) };
}

function pairedContours(left: Contour, rightName: string): Contour[] {
  return [left, { ...left, name: rightName, points: left.points.map(reflect) }];
}

function centeredContour(name: string, half: readonly Point[], closed = false): Contour {
  const mirrored = half.filter(([x]) => x !== 0).map(reflect).reverse();
  return { name, points: [...half, ...mirrored], closed };
}

const correctedFrontIntake = symmetricLeft("front", frontIntake);
const correctedPlanInlet = symmetricLeft("plan", planInlet);
const correctedPlanOutlet = symmetricLeft("plan", planOutlet);
const correctedPlanWingtip = symmetricLeft("plan", planWingtip);
const frontWingtip = symmetricLeft("front", [[178, 83.5], [488, 76]]);

function fitOuterWing(view: "front" | "plan", name: string, rawTip: Point, fittedTip: Point): Contour {
  const edge = registerContour(view, name);
  const [rootX] = edge.points[0];
  const [tipX, tipY] = meteorF3RegisteredPoint(view, rawTip);
  const points = edge.points.map(([x, y]): Point => {
    const spanFraction = (x - rootX) / (tipX - rootX);
    return [x + (fittedTip[0] - tipX) * spanFraction, y + (fittedTip[1] - tipY) * spanFraction];
  });
  return { ...edge, points };
}

// Use the more detailed left intake and short-nacelle outlines, positioned
// from the independently read left/right centers and ends.
function fitFrontIntake(name: string): Contour {
  const edge = registerContour("front", name);
  const [rawX, rawY] = meteorF3RegisteredPoint("front", frontIntake[0]);
  const [x, y] = correctedFrontIntake;
  return { ...edge, points: edge.points.map(([px, py]) => [px + x - rawX, py + y - rawY]) };
}

const leftPlanNacelle = registerContour("plan", "左短舱");
const inletOffset = correctedPlanInlet[0] - meteorF3RegisteredPoint("plan", planInlet[0])[0];
const outletOffset = correctedPlanOutlet[0] - meteorF3RegisteredPoint("plan", planOutlet[0])[0];
const planNacellePoints = leftPlanNacelle.points.map(([x, station]): Point => {
  const lengthFraction = (station - correctedPlanInlet[1]) / (correctedPlanOutlet[1] - correctedPlanInlet[1]);
  return [x + inletOffset + (outletOffset - inletOffset) * lengthFraction, station];
});

const leftInnerFront = meteorF3Views.front.contour[1].points;
const rightInnerFront = meteorF3Views.front.contour[2].points;
// Pair the exposed upper and lower edges. The left source also draws a
// termination at the body overlap, so the common wing path is left open there.
const frontInnerWing: Contour = {
  name: "左主翼内段",
  points: [1, 0, 4, 3, 2].map((leftIndex, rightIndex) =>
    symmetricLeft("front", [leftInnerFront[leftIndex], rightInnerFront[rightIndex]])),
};

const frontBody = registerContour("front", "中央机身").points;
const frontCanopy = registerContour("front", "座舱罩").points;
const frontTail = registerContour("front", "水平尾翼").points;
const frontFin = registerContour("front", "垂尾露出线").points;
const planBody = registerContour("plan", "机身外轮廓可见段").points;
const planCanopy = registerContour("plan", "座舱罩").points;
const planFin = registerContour("plan", "垂尾在俯视中的可见轮廓").points;
const planTail = registerContour("plan", "左水平尾翼");
const correctedPlanTailTip = symmetricLeft("plan", planTailTip);
const planTailOffset = correctedPlanTailTip[0] - meteorF3RegisteredPoint("plan", planTailTip[0])[0];

// Center the visible nose, canopy and tail on the registered body datum.
// The opposite side of each visible trace is generated from the same half.
export const meteorF3ReviewContours: Record<MeteorF3View, readonly Contour[]> = {
  front: [
    ...pairedContours(fitOuterWing("front", "左主翼外段", [178, 83.5], frontWingtip), "右主翼外段"),
    ...pairedContours(frontInnerWing, "右主翼内段"),
    centeredContour("中央机身", [[0, -21.7], ...[2, 1, 0, 11, 10, 9].map((index): Point => {
      const [x, y] = frontBody[index];
      return [x * 1.12, y];
    }), [0, 9.1]], true),
    centeredContour("座舱罩", [...frontCanopy.slice(0, 3), [0, frontCanopy[3][1]]]),
    ...pairedContours(fitFrontIntake("左进气唇口"), "右进气唇口"),
    ...pairedContours(fitFrontIntake("左进气开口"), "右进气开口"),
    centeredContour("水平尾翼", [[0, -44.8], frontTail[1], frontTail[0], frontTail[7], frontTail[6], [0, -41.4]], true),
    centeredContour("垂尾露出线", [...frontFin.slice(0, 3), [0, frontFin[3][1]]]),
  ],
  side: meteorF3Views.side.contour.map(({ name }) => registerContour("side", name)),
  plan: [
    centeredContour("机身外轮廓可见段", [...planBody.slice(0, 13).map(([x, y]): Point => [x - 1.25, y]), [0, 0]]),
    centeredContour("座舱罩", [[0, 37], ...planCanopy.slice(0, 6).map(([x, y]): Point => [x - 1, y]), [0, 90]], true),
    ...pairedContours(fitOuterWing("plan", "左外翼", planWingtip[0], correctedPlanWingtip), "右外翼"),
    ...pairedContours(registerContour("plan", "左内翼可见边"), "右内翼可见边"),
    ...pairedContours(registerContour("plan", "左内翼后缘与翼根过渡"), "右内翼后缘与翼根过渡"),
    ...pairedContours({ ...leftPlanNacelle, points: planNacellePoints }, "右短舱"),
    ...pairedContours({ ...planTail, points: planTail.points.map(([x, y]) => [x + planTailOffset, y]) }, "右水平尾翼"),
    centeredContour("垂尾在俯视中的可见轮廓", [[0, 252], ...planFin.slice(1, 4).map(([x, y]): Point => [x - 1.25, y]), [0, 300]], true),
  ],
};

type Locator<View extends MeteorF3View> = {
  contour: (typeof meteorF3Views)[View]["contour"][number]["name"];
  label: string;
  labelAt: Point;
  engine?: boolean;
  marks?: readonly { name: string; point: Point }[];
};

export const meteorF3Locators: { [View in MeteorF3View]: readonly Locator<View>[] } = {
  front: [
    { contour: "左进气唇口", label: "左进气口", labelAt: [-91, -19], engine: true, marks: [{ name: "左进气开口中心", point: correctedFrontIntake }] },
    { contour: "右进气唇口", label: "右进气口", labelAt: [52, -19], engine: true, marks: [{ name: "右进气开口中心", point: reflect(correctedFrontIntake) }] },
    { contour: "座舱罩", label: "座舱罩", labelAt: [17, -25] },
    { contour: "水平尾翼", label: "平尾", labelAt: [-86, -42] },
  ],
  side: [
    { contour: "座舱罩", label: "座舱罩", labelAt: [35, -36] },
    { contour: "短舱外轮廓可见段", label: "短舱 · 64–179", labelAt: [64, 30], engine: true, marks: [
      { name: "短舱可见前端", point: meteorF3RegisteredPoint("side", [248, 325]) },
      { name: "短舱可见后端", point: meteorF3RegisteredPoint("side", [364, 335]) },
    ] },
    { contour: "垂尾与方向舵可见边", label: "垂尾", labelAt: [224, -52] },
    { contour: "高置水平尾翼", label: "平尾", labelAt: [224, -38] },
  ],
  plan: [
    { contour: "座舱罩", label: "座舱罩", labelAt: [14, 43] },
    { contour: "左短舱", label: "左短舱", labelAt: [-72, 71], engine: true, marks: [
      { name: "左短舱前端", point: correctedPlanInlet }, { name: "左短舱后端", point: correctedPlanOutlet },
    ] },
    { contour: "右短舱", label: "右短舱", labelAt: [41, 71], engine: true, marks: [
      { name: "右短舱前端", point: reflect(correctedPlanInlet) }, { name: "右短舱后端", point: reflect(correctedPlanOutlet) },
    ] },
    { contour: "左外翼", label: "左外翼", labelAt: [-155, 77], marks: [{ name: "左主翼翼尖", point: correctedPlanWingtip }] },
    { contour: "右外翼", label: "右外翼", labelAt: [116, 77], marks: [{ name: "右主翼翼尖", point: reflect(correctedPlanWingtip) }] },
    { contour: "左水平尾翼", label: "左平尾", labelAt: [-66, 254], marks: [{ name: "左平尾翼尖", point: correctedPlanTailTip }] },
    { contour: "右水平尾翼", label: "右平尾", labelAt: [30, 254], marks: [{ name: "右平尾翼尖", point: reflect(correctedPlanTailTip) }] },
  ],
};

