import { baseLength, sheetSpan, unit } from "./fokkerDr1Sheet";

export type EraId = "pioneer" | "ww1" | "ww2" | "jet";
export type AirframeShape = "plane" | "floatplane" | "flyingBoat" | "airship";
export type AircraftGeometryProfileId = "fokkerDr1" | "spitfire" | "zero" | "vampire" | "ho229";

export interface Airframe {
  era?: EraId;
  missionEra?: EraId;
  shape?: AirframeShape;
  geometryProfile?: AircraftGeometryProfileId;
  wingCount?: number;
  refit?: { wing: number; engine: number; weapon: number; headroom: number; massPenalty: number };
  id: string;
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
  gun: string;
  missile: boolean;
  turret: boolean;
  bomb?: string;
  unlockScore: number;
  unlockText: string;
}
export const AIRFRAMES: Airframe[] = [
  {
    id: "swift_01",
    name: "SWIFT–01",
    role: "轻型截击机",
    description: "轻盈的机身，敏锐的转向。以速度与精准，划开云层。",
    color: "#dfdec4",
    accent: "#ed704b",
    maxSpeed: 13.5,
    cruiseSpeed: 5,
    acceleration: 9.5,
    turnRate: 285,
    energyMax: 85,
    energyDrain: 15,
    energyRecover: 17,
    health: 100,
    length: 4.8,
    wingspan: 6.2,
    footprint: 0.75,
    hardpoints: 6,
    engines: 1,
    mass: 1800,
    wingArea: 17,
    gun: "nose_cannon_pair",
    missile: true,
    turret: false,
    bomb: "gravity_bomb",
    unlockScore: 6000,
    unlockText: "单局积分达到 6,000",
  },
  {
    id: "courier_02",
    name: "COURIER–02",
    role: "平衡攻击机",
    description: "双发动力与稳定炸弹舱，让每一次俯冲都有回响。",
    color: "#91ada5",
    accent: "#efd48b",
    maxSpeed: 10.5,
    cruiseSpeed: 4.2,
    acceleration: 7.5,
    turnRate: 225,
    energyMax: 110,
    energyDrain: 16,
    energyRecover: 13,
    health: 145,
    length: 6.4,
    wingspan: 8.6,
    footprint: 1,
    hardpoints: 10,
    engines: 2,
    mass: 4500,
    wingArea: 30,
    gun: "wing_machinegun_pair",
    missile: false,
    turret: false,
    bomb: "gravity_bomb",
    unlockScore: 6800,
    unlockText: "单局积分达到 6,800",
  },
  {
    id: "mastodon_03",
    name: "MASTODON–03",
    role: "重型武装机",
    description: "四台发动机，宽阔的火力平台。天空中的移动堡垒。",
    color: "#858b7c",
    accent: "#f2b85c",
    maxSpeed: 8.2,
    cruiseSpeed: 3.6,
    acceleration: 4.8,
    turnRate: 145,
    energyMax: 135,
    energyDrain: 21,
    energyRecover: 9,
    health: 230,
    length: 8.8,
    wingspan: 13.4,
    footprint: 1.45,
    hardpoints: 16,
    engines: 4,
    mass: 14500,
    wingArea: 72,
    gun: "heavy_machinegun_quad",
    missile: false,
    turret: true,
    bomb: "heavy_bomb",
    unlockScore: 7600,
    unlockText: "单局积分达到 7,600",
  },
  {
    id: "wasp_04",
    name: "WASP–04",
    role: "轻量侦击机",
    description: "缩小轮廓，放大机动。为敢于贴近危险的飞行员而造。",
    color: "#c6c8a2",
    accent: "#a5e7bc",
    geometryProfile: "vampire",
    maxSpeed: 15.5,
    cruiseSpeed: 5.8,
    acceleration: 11.5,
    turnRate: 305,
    energyMax: 75,
    energyDrain: 14,
    energyRecover: 20,
    health: 75,
    length: 4.1,
    wingspan: 4.9,
    footprint: 0.58,
    hardpoints: 5,
    engines: 1,
    mass: 950,
    wingArea: 11,
    gun: "light_cannon",
    missile: true,
    turret: false,
    bomb: "gravity_bomb",
    unlockScore: 8600,
    unlockText: "单局积分达到 8,600",
  },
];
export const STARTER_FRAME_ID = "heron_09";
export const eraOf = (frame: Airframe): EraId => frame.era ?? "jet";

type EraFrame = Airframe & { era: EraId; wingCount: number; shape: AirframeShape };
function eraFrame(
  id: string, role: string, era: EraId, shape: AirframeShape, color: string,
  geometry: Pick<EraFrame, "mass" | "wingArea" | "wingspan" | "length" | "wingCount" | "engines">,
  flight: Pick<EraFrame, "maxSpeed" | "cruiseSpeed" | "acceleration" | "turnRate" | "energyMax">,
  loadout: Pick<EraFrame, "gun" | "bomb" | "health" | "hardpoints" | "unlockScore"> &
    Partial<Pick<EraFrame, "name" | "description" | "turret" | "refit" | "geometryProfile" | "missionEra">>,
): EraFrame {
  return {
    id, name: id.toUpperCase().replace("_", "–"), role, era, shape, color,
    accent: era === "pioneer" ? "#ffd185" : era === "ww1" ? "#f4ac65" : "#f4d987",
    description: role, footprint: Math.max(.58, geometry.length * .14),
    energyDrain: flight.energyMax * .17, energyRecover: Math.max(8, 20 - geometry.engines * 2),
    missile: false, turret: false,
    unlockText: loadout.unlockScore ? "单局积分达到 " + loadout.unlockScore.toLocaleString("zh-CN") : "初始机体",
    ...geometry, ...flight, ...loadout,
  };
}

AIRFRAMES.push(
  eraFrame("sparrow_05", "盒风筝双翼机", "pioneer", "plane", "#d97a47",
    { mass: 800, wingArea: 14, wingspan: 8.5, length: 5.2, wingCount: 2, engines: 1 },
    { maxSpeed: 5.6, cruiseSpeed: 2.4, acceleration: 4, turnRate: 240, energyMax: 70 },
    { gun: "ww1_sync_mg", bomb: "pioneer_light_bomb", health: 85, hardpoints: 4, unlockScore: 0 }),
  eraFrame("dragonfly_06", "单翼竞速机", "pioneer", "plane", "#58a4a1",
    { mass: 600, wingArea: 9, wingspan: 6.5, length: 4.6, wingCount: 1, engines: 1 },
    { maxSpeed: 7.8, cruiseSpeed: 3.2, acceleration: 6, turnRate: 250, energyMax: 60 },
    { gun: "ww1_sync_mg", health: 60, hardpoints: 3, unlockScore: 250, geometryProfile: "zero" }),
  eraFrame("moth_07", "早期飞艇", "pioneer", "airship", "#c79550",
    { mass: 5000, wingArea: 120, wingspan: 20, length: 22, wingCount: 1, engines: 2 },
    { maxSpeed: 3.2, cruiseSpeed: 2, acceleration: 2, turnRate: 70, energyMax: 180 },
    { gun: "ww1_sync_mg", bomb: "pioneer_light_bomb", health: 260, hardpoints: 8, unlockScore: 700 }),
  eraFrame("kestrel_08", "双翼战斗机", "ww1", "plane", "#b84942",
    { mass: 1500, wingArea: 20, wingspan: 9.5, length: 6.8, wingCount: 2, engines: 1 },
    { maxSpeed: 9.6, cruiseSpeed: 4, acceleration: 6.5, turnRate: 250, energyMax: 90 },
    { gun: "ww1_twin_mg", health: 105, hardpoints: 6, unlockScore: 1100 }),
  eraFrame("heron_09", "三翼格斗机", "ww1", "plane", "#9263a5",
    { mass: 1300, wingArea: 18, wingspan: sheetSpan * unit, length: baseLength, wingCount: 3, engines: 1 },
    { maxSpeed: 8.4, cruiseSpeed: 3.6, acceleration: 7, turnRate: 280, energyMax: 85 },
    { name: "福克 Dr.I", description: "三层短翼与双联同步机枪，擅长低速转向和近距格斗。",
      gun: "ww1_twin_mg", health: 90, hardpoints: 5, unlockScore: 0, geometryProfile: "fokkerDr1", missionEra: "pioneer" }),
  eraFrame("condor_10", "双发轰炸机", "ww1", "plane", "#777f55",
    { mass: 4200, wingArea: 45, wingspan: 15, length: 11, wingCount: 2, engines: 2 },
    { maxSpeed: 7.4, cruiseSpeed: 3, acceleration: 4.2, turnRate: 150, energyMax: 140 },
    { gun: "ww1_twin_mg", bomb: "ww1_light_bomb", turret: true, health: 200, hardpoints: 10, unlockScore: 1700 }),
  eraFrame("pelican_11", "浮筒水上机", "ww1", "floatplane", "#438394",
    { mass: 2600, wingArea: 30, wingspan: 12, length: 9, wingCount: 2, engines: 1 },
    { maxSpeed: 8.2, cruiseSpeed: 3.4, acceleration: 5.5, turnRate: 210, energyMax: 110 },
    { gun: "ww1_sync_mg", bomb: "early_torpedo", health: 130, hardpoints: 7, unlockScore: 2000 }),
  eraFrame("leviathan_12", "大型飞艇", "ww1", "airship", "#9a704b",
    { mass: 9000, wingArea: 150, wingspan: 26, length: 30, wingCount: 1, engines: 4 },
    { maxSpeed: 2.9, cruiseSpeed: 1.8, acceleration: 1.8, turnRate: 55, energyMax: 220 },
    { gun: "aa_autocannon", bomb: "ww1_light_bomb", turret: true, health: 380, hardpoints: 16, unlockScore: 2600,
      refit: { wing: 1.2, engine: 1.25, weapon: 1.15, headroom: 1, massPenalty: .7 } }),
  eraFrame("falcon_13", "单翼战斗机", "ww2", "plane", "#557792",
    { mass: 2600, wingArea: 22, wingspan: 11, length: 8.5, wingCount: 1, engines: 1 },
    { maxSpeed: 13.5, cruiseSpeed: 5, acceleration: 8.5, turnRate: 275, energyMax: 110 },
    { gun: "ww2_autocannon", health: 120, hardpoints: 8, unlockScore: 3100, geometryProfile: "spitfire" }),
  eraFrame("raptor_14", "双发重型战斗机", "ww2", "plane", "#527c72",
    { mass: 4800, wingArea: 32, wingspan: 13, length: 10.5, wingCount: 1, engines: 2 },
    { maxSpeed: 11.6, cruiseSpeed: 4.6, acceleration: 6.5, turnRate: 200, energyMax: 130 },
    { gun: "ww2_heavy_cannon", health: 210, hardpoints: 12, unlockScore: 3600 }),
  eraFrame("albatross_15", "浮筒鱼雷机", "ww2", "floatplane", "#4c95a8",
    { mass: 3400, wingArea: 34, wingspan: 13, length: 10, wingCount: 1, engines: 1 },
    { maxSpeed: 10.2, cruiseSpeed: 4.2, acceleration: 6, turnRate: 205, energyMax: 120 },
    { gun: "ww2_autocannon", bomb: "ww2_torpedo", health: 150, hardpoints: 8, unlockScore: 4200 }),
  eraFrame("stingray_16", "双发飞翼攻击机", "ww2", "plane", "#81929c",
    { mass: 5200, wingArea: 42, wingspan: 15, length: 12, wingCount: 1, engines: 2 },
    { maxSpeed: 8.6, cruiseSpeed: 3.8, acceleration: 4.6, turnRate: 145, energyMax: 140 },
    { gun: "ww2_rocket_battery", health: 260, hardpoints: 10, unlockScore: 4800, geometryProfile: "ho229" }),
  eraFrame("behemoth_17", "四发重型轰炸机", "ww2", "plane", "#6d825d",
    { mass: 9500, wingArea: 85, wingspan: 22, length: 17, wingCount: 1, engines: 4 },
    { maxSpeed: 7.2, cruiseSpeed: 3.4, acceleration: 3.6, turnRate: 110, energyMax: 180 },
    { gun: "heavy_machinegun_quad", bomb: "ww2_medium_bomb", turret: true, health: 340, hardpoints: 18, unlockScore: 5400,
      refit: { wing: 1.15, engine: 1.15, weapon: 1.1, headroom: .95, massPenalty: .75 } }),
);

export const airframeById = (id: string) =>
  AIRFRAMES.find((a) => a.id === id) ?? AIRFRAMES.find((frame) => frame.id === STARTER_FRAME_ID)!;
