// Marek Ryś, Horten Ho 9 V2 (2001). All paths use the original 1200 × 777
// drawing pixels so the independent measurements and the overlay stay together.
export const ho229Drawing = {
  src: new URL("../assets/reference/ho229-v2/three-view.gif", import.meta.url).href,
  source: "https://www.airwar.ru/image/idop/fww2/go229/go229-2.gif",
  width: 1200,
  height: 777,
};

type Panel = {
  title: string;
  bounds: string;
  crop: string;
  datum: string;
  skin: string;
  cockpit: string;
  engines: string;
  enginePosition: string;
  hiddenEngine?: string;
  structure: string;
  controls?: string;
  gear?: string;
};

export const hoEngines = [
  { column: 554, lipRow: 296, outletRow: 555, slotEndRow: 611 },
  { column: 654, lipRow: 298, outletRow: 557, slotEndRow: 611 },
] as const;
// Side and plan share a longitudinal scale, with their noses at x=43 and row 237.
const sideStation = (planRow: number) => 43 + planRow - 237;
const sideOutletX = sideStation(hoEngines[0].outletRow);
const lipTop = { x: 101, y: 209 };
const lipBottom = { x: 117, y: 245 };
const sideIntakeX = 98;
const housingTop = 202;
// Review-model dimensions. One nominal millimetre corresponds to one source drawing unit.
export const hoPlateEngineMm = { diameter: 35, outletCover: 1 } as const;
const outletTop = housingTop + hoPlateEngineMm.outletCover;
const outletOcclusion = 211;
// Anchor the upper edge to the lip and outlet. Measure diameter perpendicular to this line.
const sideEngineSlope = (outletTop - lipTop.y) / (sideOutletX - lipTop.x);
const axisScale = Math.hypot(1, sideEngineSlope);
const bodyDiameter = hoPlateEngineMm.diameter;
const ductRadius = bodyDiameter * axisScale / 2;
const outletCenter = outletTop + ductRadius;
const sideNacelleAft = `Q329 190 ${sideOutletX} ${housingTop} V${outletOcclusion}`;
export const hoSideOutletLeader = `M${sideOutletX} ${(outletTop + outletOcclusion) / 2}L379 184H392`;

const sideAxisY = (x: number) => outletCenter + (x - sideOutletX) * sideEngineSlope;

// Approximate the concealed body beneath the nacelle, between the intake duct and tailpipe.
const bodyFrontX = 155;
const bodyRearX = 330;
export const hoSideEngineBody = {
  x: bodyFrontX,
  centerY: sideAxisY(bodyFrontX),
  length: (bodyRearX - bodyFrontX) * axisScale,
  diameter: bodyDiameter,
  angle: Math.atan(sideEngineSlope) * 180 / Math.PI,
};

// All three lines follow one straight axis. Start each edge where it meets the curved lip.
function sideEngineLine(offset: number, lipX: number) {
  const lipY = sideAxisY(lipX) + offset;
  return `M${lipX} ${lipY} L${sideOutletX} ${outletCenter + offset}`;
}

function frontDuct(centerX: number) {
  const ductRadius = 15; // Independently traced inner ring in the front drawing.
  return `M${centerX - ductRadius} 80 a${ductRadius} ${ductRadius} 0 1 0 ${2 * ductRadius} 0
    a${ductRadius} ${ductRadius} 0 1 0 ${-2 * ductRadius} 0`;
}

export const ho229Views: Record<"plan" | "front" | "side", Panel> = {
  plan: {
    title: "俯视 · 中央翼段与后缘舵面",
    bounds: "10 225 1180 547",
    crop: "10,625 78,552 484,315 574,251 603,231 630,250 695,289 735,326 1130,566 1190,628 1190,770 10,770",
    datum: "M605 228L601 765",
    skin: `M605 237 L627 253 Q636 287 649 294 Q662 303 681 291 L713 315 L1105 562
      Q1156 594 1172 634 Q1185 670 1175 686 Q1168 697 1147 691
      L1009 654 L1009 659 L902 629 L902 624 L818 601 Q762 593 712 626
      Q665 653 630 708 Q613 733 601 760 Q570 695 537 660 Q517 640 494 625
      Q442 592 386 599 L302 621 L302 626 L194 653 L194 648 L56 684
      Q32 691 25 677 Q17 660 30 626 Q45 588 88 562 L495 313 L526 290
      Q548 303 560 291 Q570 282 577 255 Z`,
    cockpit: "M581 285 Q587 260 603 258 Q618 257 626 283 L627 343 Q627 410 605 455 Q585 441 578 364 L578 306 Z M581 286 Q601 311 626 284 M581 331 Q603 350 626 329",
    engines: `M521 502 Q517 446 532 411 Q551 378 567 404 Q591 444 585 507 L578 553
      Q558 558 533 555 Z
      M620 502 Q617 451 635 408 Q653 378 670 408 Q692 451 685 508 L675 556
      Q654 560 627 555 Z`,
    enginePosition: hoEngines.map(e => `M${e.column} ${e.lipRow}V${e.outletRow}`).join(" "),
    hiddenEngine: hoEngines.map(e => `M${e.column - bodyDiameter / 2} ${e.lipRow}V${e.outletRow}
      M${e.column + bodyDiameter / 2} ${e.lipRow}V${e.outletRow}`).join(" "),
    structure: `M495 313L494 625 M713 315L712 626 M30 626L494 375 M712 376L1172 633
      M538 555 Q547 602 558 611 Q568 612 572 555 M634 556 Q635 602 646 611 Q658 609 667 556`,
    controls: `M302 577L386 571L386 599L302 621Z M302 590L302 626L194 653L194 648L55 684
      Q19 694 23 661Z M819 574L902 581L902 624L819 601Z M903 595L1179 669
      Q1178 702 1147 691L1009 654L1009 659L902 629Z`,
  },
  front: {
    title: "正视 · 双进气口与起落架",
    bounds: "12 8 1182 222",
    crop: "12,8 1194,8 1194,101 738,101 738,200 636,200 636,229 576,229 576,200 477,200 477,100 12,100",
    datum: "M605 12V225",
    skin: `M25 55 Q34 50 66 51 L371 56 Q447 57 497 49 L538 41 Q552 32 564 38
      L588 33 Q603 2 621 32 L644 39 Q659 33 671 43 L713 50 Q775 60 842 59
      L1153 58 Q1177 58 1182 62 Q1180 66 1151 68 L713 93 Q670 101 627 102
      L584 101 Q535 99 497 92 L49 60 Q27 59 25 55 Z`,
    cockpit: "M583 47Q590 19 603 19Q619 18 627 48Q605 55 583 47Z",
    engines: `M526 81C526 59 560 50 573 72C585 95 555 101 536 94Q526 91 526 81Z M633 82C636 58 666 51 678 73C689 94 661 102 641 94Q632 91 633 82Z ${frontDuct(555)} ${frontDuct(656)}`,
    structure: "M497 49V92 M713 50V93",
    enginePosition: "M550 80H560 M555 75V85 M651 80H661 M656 75V85",
    gear: `M498 93L495 134Q484 137 483 151L482 181Q483 190 495 190Q504 190 504 180V144L505 96Z
      M710 94L714 135Q724 137 726 150L727 182Q726 192 715 192Q706 192 705 182L701 141L702 96Z
      M584 101Q604 93 624 101V171H584Z M595 172V210Q595 221 605 221Q615 221 615 210V172Z
      M505 144L552 111L583 112 M701 144L656 111L626 113`,
  },
  side: {
    title: "侧视 · 机头朝左",
    bounds: "34 162 543 220",
    crop: "34,162 280,162 367,194 505,201 507,231 573,244 573,253 415,281 415,373 34,381",
    datum: "M39 222H563",
    skin: `M43 221 Q44 212 64 202 Q84 176 108 173 Q135 168 164 172
      Q211 176 281 190 ${sideNacelleAft} Q400 208 467 207
      Q495 206 498 212 Q496 216 459 229 Q504 240 566 248
      Q453 260 384 259 Q320 264 249 260 Q161 260 101 247 Q44 239 43 224Z`,
    cockpit: "M65 203Q84 177 108 173Q141 166 181 174Q227 180 279 190Q163 187 65 203Z M91 198L108 174 M137 193L146 171",
    engines: `M62 228Q67 217 ${lipTop.x} ${lipTop.y}Q97 225 100 231L${lipBottom.x} ${lipBottom.y}Q77 240 62 233Z
      M202 195 Q241 190 281 190 ${sideNacelleAft}
      L326 213 Q261 192 202 195Z`,
    structure: "M179 247Q295 221 425 211 M180 247Q249 251 317 250L438 223",
    enginePosition: sideEngineLine(0, sideIntakeX),
    hiddenEngine: `${sideEngineLine(-ductRadius, lipTop.x)} ${sideEngineLine(ductRadius, lipBottom.x)} V${outletOcclusion}`,
    gear: `M104 248L96 285L96 324L107 325L136 349L143 344L109 315L107 286L117 251Z
      M111 296L221 267L221 273L109 303 M107 343a32 32 0 1 0 64 0a32 32 0 1 0 -64 0
      M363 252L387 250V293H363Z M346 317a31 28 0 1 0 62 0a31 28 0 1 0 -62 0`,
  },
};

// Span stations sampled from the approved quadratic plan outline. Heights are
// above the intake axis; the canopy and the nacelle crowns are separate skins.
// [drawing x, leading row, trailing row, upper height, lower height]
export type HoRib = readonly [number, number, number, number, number];
export const hoRibs: readonly HoRib[] = [
  [22, 661.6, 661.6, 25, 25],
  [24, 645.3, 674.6, 25.4, 24.6],
  [28, 631.5, 681.3, 26.3, 23.7],
  [34, 617.1, 685.1, 27.6, 22.4],
  [44, 600.8, 686.3, 28.3, 21.2],
  [56, 586.8, 684, 28.7, 20],
  [72, 572.8, 679.8, 28.9, 18.6],
  [88, 562, 675.7, 28.6, 17.5],
  [193.9, 497.2, 648, 26.9, 10.2],
  [194, 497.1, 653, 26.9, 10.2],
  [194.1, 497.1, 653, 26.9, 10.2],
  [302, 431.1, 626, 25.1, 2.8],
  [302.1, 431, 621, 25.1, 2.7],
  [386, 379.7, 599, 24.9, -3.2],
  [412, 363.8, 597.9, 26.3, -5.3],
  [439, 347.3, 601.5, 27.9, -7.5],
  [468, 329.5, 611.1, 29.5, -9.9],
  [494, 313.6, 625, 31, -12],
  [514, 298.9, 639.4, 34.1, -14.5],
  [526, 290, 649.6, 36, -16],
  [538, 295.5, 661.1, 37.8, -17.8],
  [548, 296.7, 672.6, 39.3, -19.3],
  [555, 294.7, 681.5, 40, -20.2],
  [561, 290, 689.8, 40, -20.6],
  [570, 275.9, 703.3, 40, -21.4],
  [577, 255, 714.7, 40, -21.9],
  [586, 249.2, 730.5, 39.7, -22.3],
  [595, 243.4, 747.7, 39.4, -22.6],
  [601, 239.6, 760, 39.1, -22.9],
  [605, 237, 751.3, 39, -23],
  [615, 244.3, 732.2, 39.4, -22.6],
  [627, 253, 712.5, 40, -22],
  [637, 280.2, 697.5, 40, -21.4],
  [648, 293.4, 682.6, 40, -20.6],
  [657, 297.4, 671.8, 39.9, -19.9],
  [669, 296.7, 659, 38.4, -18.4],
  [681, 291, 648, 37, -17],
  [696, 302.2, 636.3, 33.7, -15.1],
  [713, 315, 625.3, 30, -13],
  [740, 332, 610.9, 28.1, -11.5],
  [766, 348.4, 602.7, 26.3, -10.1],
  [790, 363.5, 599.6, 24.6, -8.8],
  [819, 381.8, 601.3, 22.6, -7.2],
  [901.9, 434, 624, 21.2, -2.5],
  [902, 434.1, 629, 21.2, -2.5],
  [1008.9, 501.4, 659, 21.5, 3.7],
  [1009, 501.5, 659, 21.5, 3.7],
  [1009.1, 501.6, 654, 21.5, 3.7],
  [1105, 562, 679.7, 21.8, 9.2],
  [1126, 576.7, 685.4, 21.9, 10.4],
  [1147, 595.7, 691, 22, 11.7],
  [1160, 611.8, 693.1, 21.3, 13],
  [1170, 629.3, 690.8, 20.4, 14.4],
  [1175, 643.1, 686, 19.6, 15.6],
  [1179.3, 668, 668, 18, 18],
];
export const hoSpan = 15;
export const hoUnit = hoSpan / (hoRibs[hoRibs.length - 1][0] - hoRibs[0][0]);
export const hoLength = 523 * hoUnit;
export const hoX = (column: number) => (column - 603) * hoUnit;
export const hoZ = (row: number) => (498.5 - row) * hoUnit;

export function hoLeadingRow(column: number) {
  const end = hoRibs.findIndex(r => r[0] >= column);
  if (end < 0) return hoRibs[hoRibs.length - 1][1];
  if (end === 0) return hoRibs[0][1];
  const a = hoRibs[end - 1], b = hoRibs[end];
  return a[1] + (b[1] - a[1]) * (column - a[0]) / (b[0] - a[0]);
}

export const hoPanelLimits: Record<string, readonly [number, number]> = {
  center_body: [494, 713],
  left_wing: [302, 494],
  right_wing: [713, 902],
  left_wing_tip: [hoRibs[0][0], 302],
  right_wing_tip: [902, hoRibs[hoRibs.length - 1][0]],
};

// Shared low-poly installation dimensions in drawing units, including refits.
const sideDatumY = 233.5;
const bodyMidX = (bodyFrontX + bodyRearX) / 2;
export const hoEngineSize = {
  inletRadius: 21,
  bodyRadius: bodyDiameter / 2,
  bodyLength: hoSideEngineBody.length,
  bodyForwardOfOutlet: sideOutletX - bodyMidX,
  bodyHeight: sideDatumY - sideAxisY(bodyMidX),
  outletHeight: sideDatumY - outletCenter,
  shoulderAboveOutlet: outletCenter - outletOcclusion,
  axisSlope: sideEngineSlope,
  // Side drawing x, plan half-width and side crown y sampled on the dorsal housing.
  coverSections: [[202, 2, 195], [216, 16, 193.5], [242, 26, 191.5], [281, 32, 190],
    [313, 32, 192], [340, 28, 196], [sideOutletX, 22, housingTop]].map(([x, halfWidth, crown]) =>
    ({ forward: sideOutletX - x, halfWidth, crownAboveOutlet: outletCenter - crown })),
};

export function hoEngineMount(engine: typeof hoEngines[number], shiftZ = 0) {
  const outletZ = hoZ(engine.outletRow) + shiftZ;
  return {
    y: hoEngineSize.bodyHeight * hoUnit,
    z: outletZ + hoEngineSize.bodyForwardOfOutlet * hoUnit,
    outletOffset: { x: 0, y: (hoEngineSize.outletHeight - hoEngineSize.bodyHeight) * hoUnit,
      z: -hoEngineSize.bodyForwardOfOutlet * hoUnit },
  };
}
export const hoGear = [
  { column: 603, row: 333, height: -109, radius: 32, width: 20, socketRow: 303 },
  { column: 493, row: 571, height: -83, radius: 28, width: 19, socketRow: 567 },
  { column: 715, row: 571, height: -85, radius: 28, width: 19, socketRow: 567 },
] as const;
export const ho229ReviewAnnotations = {
  outletLabel: { x: 396, y: 188 },
  engineBaySeams: "M494 314V625 M713 315V625",
  cannonBaySeams: "M302 431V626 M902 434V629",
} as const;

