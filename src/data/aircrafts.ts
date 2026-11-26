import { fighterSpan, fighterUnit, spitfireVbSheet, zero21Sheet } from "./pistonFighterSheets";
import { baseLength, sheetLength, sheetSpan, unit, wings } from "./fokkerDr1Sheet";
import { hoLength, hoSpan } from "./ho229V2Sheet";

export type EraId = "pioneer" | "ww1" | "ww2" | "jet";
export type AirframeShape = "plane" | "floatplane" | "flyingBoat" | "airship";
export type AircraftGeometryProfileId = "fokkerDr1" | "ho229V2" | "spitfireVb" | "zero21" | "pioneerReview";

export type ModelPoint = readonly [x: number, y: number, z: number];
export interface PioneerLayout {
  wingZ: number;
  tailZ?: number;
  canardZ?: number;
  engines: readonly ModelPoint[];
  pusher?: boolean;
}

export interface Airframe {
  airflowEffects?: Partial<Record<"wingTip" | "tailTip" | "wingFlow" | "protrusion" | "wake", string>>;
  era?: EraId;
  missionEra?: EraId;
  shape?: AirframeShape;
  geometryProfile?: AircraftGeometryProfileId;
  wingCount?: number;
  pioneerLayout?: PioneerLayout;
  refit?: { wing: number; engine: number; weapon: number; headroom: number; massPenalty: number };
  upgradeStackLimits?: Readonly<Record<string, number>>;
  id: string;
  liveryId?: string;
  name: string;
  role: string;
  description: string;
  color: string;
  accent: string;
  maxSpeed: number;
  cruiseSpeed: number;
  acceleration: number;
  turnRate: number;
  energyMax: number;
  energyDrain: number;
  energyRecover: number;
  health: number;
  length: number;
  wingspan: number;
  footprint: number;
  hardpoints: number;
  engines: number;
  mass: number; // Base mass in kg, including the standard loadout.
  wingArea: number; // Reference lifting area in m².
  /** Local longitudinal and vertical position of the nominal lift resultant. */
  liftCenterY: number;
  liftCenterZ: number;
  gun?: string;
  missile: boolean;
  turret: boolean;
  bomb?: string;
  unlockScore: number;
  unlockText: string;
}
export const STARTER_FRAME_ID = "heron_09";
export const eraOf = (frame: Airframe): EraId => frame.era ?? "jet";

type EraFrame = Airframe & { era: EraId; wingCount: number; shape: AirframeShape };
// Values are local model-space metres. Multi-wing aircraft use the
// area-weighted wing-stack height, while bodies with no meaningful wing stack
// keep the datum at the fuselage centre. The Dr.I value follows its reviewed
// lower, middle and upper wing heights and chords.
const dr1LiftCenterY = wings.reduce((sum, wing) =>
  sum + wing.span * (wing.trailing - wing.leading) * wing.height, 0) /
  wings.reduce((sum, wing) => sum + wing.span * (wing.trailing - wing.leading), 0) * unit;
const dr1LiftCenterZ = wings.reduce((sum, wing) => {
  const chord = wing.trailing - wing.leading;
  const aerodynamicCenter = wing.leading + chord * .25;
  return sum + wing.span * chord * (sheetLength / 2 - aerodynamicCenter);
}, 0) /
  wings.reduce((sum, wing) => sum + wing.span * (wing.trailing - wing.leading), 0) * unit;
function eraFrame(
  id: string, role: string, era: EraId, shape: AirframeShape, color: string,
  geometry: Pick<EraFrame, "mass" | "wingArea" | "wingspan" | "length" | "wingCount" | "engines">,
  flight: Pick<EraFrame, "maxSpeed" | "cruiseSpeed" | "acceleration" | "turnRate" | "energyMax">,
  loadout: Pick<EraFrame, "gun" | "bomb" | "health" | "hardpoints" | "unlockScore"> &
    Partial<Pick<EraFrame, "name" | "description" | "turret" | "refit" | "upgradeStackLimits" | "geometryProfile" | "missionEra" | "accent" | "liftCenterY" | "liftCenterZ" | "pioneerLayout">>,
): EraFrame {
  return {
    id, liveryId: id === "heron_09" ? "dr1-01-olive-checker" : id === "falcon_13" ? "falcon-13-olive" : id === "dragonfly_06" ? "dragonfly-06-jade" : id === "stingray_16" ? "stingray-16-slate" : `legacy:${id}`,
    name: id.toUpperCase().replace("_", "–"), role, era, shape, color,
    accent: era === "pioneer" ? "#ffd185" : era === "ww1" ? "#f4ac65" : "#f4d987",
    description: role, footprint: Math.max(.58, geometry.length * .14),
    liftCenterY: geometry.wingCount > 1 ? .2 : .1,
    liftCenterZ: geometry.length * .08,
    energyDrain: flight.energyMax * .17, energyRecover: Math.max(8, 20 - geometry.engines * 2),
    missile: false, turret: false,
    unlockText: loadout.unlockScore ? "单局积分达到 " + loadout.unlockScore.toLocaleString("zh-CN") : "初始机体",
    ...geometry, ...flight, ...loadout,
  };
}
type EarlyAircraft = Pick<EraFrame, "id" | "name" | "role" | "mass" | "wingArea" | "wingspan" | "length" | "wingCount"> & {
  layout: PioneerLayout;
};

const earlyAircraft: EarlyAircraft[] = [
  { id: "reference_wright_flyer_1903", name: "Wright Flyer", role: "鸭式双翼机",
    mass: 340, wingArea: 47.4, wingspan: 12.29, length: 6.43, wingCount: 2,
    layout: { wingZ: -.22, tailZ: -2.79, canardZ: 2.82, engines: [[-.4, -.62, .05]], pusher: true } },
  { id: "reference_santos_14bis", name: "Santos-Dumont 14-bis", role: "盒翼鸭式机",
    mass: 300, wingArea: 52, wingspan: 11.46, length: 9.6, wingCount: 2,
    layout: { wingZ: -3.56, canardZ: 3.71, engines: [[0, .36, -4.21]], pusher: true } },
  { id: "reference_santos_demoiselle", name: "Santos-Dumont Demoiselle", role: "轻型单翼机",
    mass: 190, wingArea: 10.7, wingspan: 5.49, length: 6.10, wingCount: 1,
    layout: { wingZ: 1.85, tailZ: -1.99, engines: [[0, .43, 2.77]] } },
  { id: "reference_bleriot_xi", name: "Blériot XI", role: "海峡飞行单翼机",
    mass: 300, wingArea: 14, wingspan: 7.79, length: 7.62, wingCount: 1,
    layout: { wingZ: 1.9, tailZ: -2.35, engines: [[0, .03, 2.93]] } },
  { id: "reference_etrich_taube", name: "Etrich Taube", role: "鸟形单翼机",
    mass: 850, wingArea: 32, wingspan: 14.3, length: 9.9, wingCount: 1,
    layout: { wingZ: 2.27, tailZ: -3.4, engines: [[0, .13, 4.32]] } },
  { id: "reference_deperdussin_monocoque", name: "Deperdussin Monocoque", role: "硬壳竞速单翼机",
    mass: 610, wingArea: 9.66, wingspan: 6.4, length: 6.1, wingCount: 1,
    layout: { wingZ: 1.58, tailZ: -2.41, engines: [[0, .04, 2.57]] } },
  { id: "reference_caudron_g3", name: "Caudron G.3", role: "双尾梁半双翼机",
    mass: 730, wingArea: 27, wingspan: 13.4, length: 6.4, wingCount: 2,
    layout: { wingZ: 1.68, tailZ: -2.63, engines: [[0, .45, 3.02]] } },
  { id: "reference_ilya_muromets", name: "Sikorsky Ilya Muromets", role: "四发客运原型机",
    mass: 4650, wingArea: 125, wingspan: 27, length: 19, wingCount: 2,
    layout: { wingZ: 5.72, tailZ: -8.14, engines: [[6.77, -.46, 6.17], [3.18, -.46, 6.17], [-3.18, -.46, 6.17], [-6.77, -.46, 6.17]] } },
  { id: "reference_voisin_iii", name: "Voisin III", role: "推进式双座双翼机",
    mass: 1350, wingArea: 49, wingspan: 14.74, length: 9.5, wingCount: 2,
    layout: { wingZ: 1.52, tailZ: -3.9, engines: [[0, .28, .6]], pusher: true } },
  { id: "reference_farman_mf11", name: "Farman MF.11", role: "推进式双座侦察机",
    mass: 930, wingArea: 57, wingspan: 16.15, length: 9.45, wingCount: 2,
    layout: { wingZ: 1.69, tailZ: -4.38, engines: [[0, .36, .91]], pusher: true } },
];

const earlyFrames = earlyAircraft.map(({ id, name, role, layout, ...dimensions }) =>
  eraFrame(id, role, "pioneer", "plane", "#e8d2a0",
    { ...dimensions, engines: layout.engines.length },
    { maxSpeed: 5.6, cruiseSpeed: 2.4, acceleration: 4, turnRate: 220, energyMax: 70 },
    { name, health: 85, hardpoints: 3, unlockScore: 0, geometryProfile: "pioneerReview",
      pioneerLayout: layout, liftCenterZ: layout.wingZ, gun: "ww1_sync_mg" }),
);

export const AIRFRAMES: Airframe[] = [
  ...earlyFrames,
  eraFrame("heron_09", "三翼格斗机", "ww1", "plane", "#707b57",
    { mass: 1300, wingArea: 18, wingspan: sheetSpan * unit, length: baseLength, wingCount: 3, engines: 1 },
    { maxSpeed: 8.4, cruiseSpeed: 3.6, acceleration: 7, turnRate: 280, energyMax: 85 },
    { name: "福克 Dr.I", description: "三层短翼与双联同步机枪，擅长低速转向和近距格斗。",
      liftCenterY: dr1LiftCenterY, liftCenterZ: dr1LiftCenterZ, gun: "ww1_twin_mg", health: 90, hardpoints: 5, unlockScore: 0, geometryProfile: "fokkerDr1", missionEra: "pioneer",
      upgradeStackLimits: { left_wing_segment: 10, right_wing_segment: 10 } }),
  eraFrame("falcon_13", "单翼战斗机", "ww2", "plane", spitfireVbSheet.assembly.color,
    { mass: 2600, wingArea: 22, wingspan: fighterSpan, length: spitfireVbSheet.assembly.length * fighterUnit, wingCount: 1, engines: 1 },
    { maxSpeed: 13.5, cruiseSpeed: 5, acceleration: 8.5, turnRate: 275, energyMax: 110 },
    { name: spitfireVbSheet.title, geometryProfile: "spitfireVb", accent: spitfireVbSheet.assembly.trim, gun: "ww2_autocannon", health: 120, hardpoints: 8, unlockScore: 3100 }),
  eraFrame("dragonfly_06", "单翼战斗机", "ww2", "plane", zero21Sheet.assembly.color,
    { mass: 2400, wingArea: 22.4, wingspan: fighterSpan, length: zero21Sheet.assembly.length * fighterUnit, wingCount: 1, engines: 1 },
    { maxSpeed: 12.5, cruiseSpeed: 4.8, acceleration: 8, turnRate: 285, energyMax: 100 },
    { name: zero21Sheet.title, geometryProfile: "zero21", accent: zero21Sheet.assembly.trim,
      gun: "ww2_autocannon", health: 95, hardpoints: 6, unlockScore: 250 }),
  eraFrame("stingray_16", "双发飞翼攻击机", "ww2", "plane", "#81929c",
    { mass: 5200, wingArea: 42, wingspan: hoSpan, length: hoLength, wingCount: 1, engines: 2 },
    { maxSpeed: 8.6, cruiseSpeed: 3.8, acceleration: 4.6, turnRate: 145, energyMax: 140 },
    { name: "Ho 229 V2", geometryProfile: "ho229V2", liftCenterY: .08, liftCenterZ: .20, gun: "ww2_autocannon", health: 260, hardpoints: 10, unlockScore: 4800 }),
];

export const airframeById = (id: string) =>
  AIRFRAMES.find((a) => a.id === id) ?? AIRFRAMES.find((frame) => frame.id === STARTER_FRAME_ID)!;
