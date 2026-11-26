// One unit is one pixel of the Goebel plan. Station zero is the nose.
// Observer side ordinates are registered at (144,1087), 656 px per length.
export const fb5Unit = .06;
export const fb5Length = 197;
export const fb5HalfSpan = 124.5;
export const fb5Z = (station: number) => (fb5Length / 2 - station) * fb5Unit;
export const fb5Frame = {
  id: "vampire-fb5", geometryProfile: "vampireFb5", name: "de Havilland Vampire FB.5",
  role: "单座喷气战斗轰炸机", era: "jet", shape: "plane", color: "#99a5a0", accent: "#667772",
  length: fb5Length * fb5Unit, wingspan: 2 * fb5HalfSpan * fb5Unit, liftCenterY: 0, liftCenterZ: 0,
} as const;

// [station, lateral radius, upper height, lower height]. The aft pod is
// exposed between the booms. Width follows the belly drawing at common stations.
export type Fb5Section = readonly [number, number, number, number];
export const fb5Pod: readonly Fb5Section[] = [
  [0,.5,-3.5,-6], [2,2.9,-.7,-9], [5,5.1,1.3,-10.9], [12,8.1,4.4,-12.7],
  [18,10,6.4,-13.6], [32,12.5,9.4,-14.7], [47,13.6,11.8,-15.4],
  [56,14,14.1,-15.5], [69,14.1,13.8,-15.4], [82,13.6,12.8,-15.1],
  [97,11.8,10.9,-13.6], [110,9.4,7.2,-11.6], [119,7.5,3.4,-9.4], [128,4.7,-.3,-6.2],
];
export const fb5Canopy: readonly Fb5Section[] = [
  [18,.8,7,6.3], [23,3,11.2,6.9], [30,5,16.5,7.8], [34,5.6,18.2,8.5],
  [41,5.8,18,9.6], [48,5,16.9,11.2], [53,3.2,15.2,12.6], [56,.6,14.3,14],
];
export const fb5BoomX = 31;
export const fb5Boom: readonly Fb5Section[] = [
  [56,.5,1.1,-.1], [64,1.7,2.9,-1.7], [78,2.8,4.7,-2.9], [97,3.3,6.1,-3.3],
  [115,3.2,7.4,-2.1], [144,2.9,8.8,.9], [170,2.6,10.8,3.2],
  [188,2.3,12.4,5.4], [195,1.6,12.4,7.2], [197,.35,11.3,9.3],
];
export const fb5Fin: readonly Fb5Section[] = [
  [174,.45,15.4,15.2], [178,.8,20,15], [183,.9,26.2,14.5], [188,.98,30.1,14],
  [190,.96,30.4,13.7], [193,.82,28.5,13.4], [195.5,.65,24.3,13], [197,.35,16.2,12.8],
];
// The side view exposes a rounded tailplane root ahead of the fin.
export const fb5TailFairing: readonly Fb5Section[] = [
  [167.4,.25,13,12.5], [169,1.5,14.7,11.9], [174,2.6,15.6,10.1],
  [183,2.5,14.9,10.2], [191,2.1,14.1,10.7], [197,.35,13.2,11.5],
];
// [span, leading station, trailing station, top, bottom]. The inboard
// section ahead of station 55 belongs to the intake housing.
export const fb5Wing = [
  [11.5,58,117,4.6,-5.8], [16,54,116,4.8,-5.1], [28,51,111,4.3,-3.4],
  [32,51.5,110,4.1,-2.9], [63,58,102,4.2,-.9], [96,64.4,95,4.9,1.6],
  [120,69,90.5,5.4,3.5], [123.6,70.5,89,5.4,4.2], [124.5,74,86,5.4,4.6],
] as const;
export const fb5Probes = [
  {side: -1, span: 109.8, station: 80, top: 3.1, bottom: -6.1},
  {side: 1, span: 120.2, station: 81, top: 4.6, bottom: -7, endSpan: 121.7},
] as const;
