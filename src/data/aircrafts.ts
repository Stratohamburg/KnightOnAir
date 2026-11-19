export interface Airframe {
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
  gun: string;
  missile: boolean;
  turret: boolean;
  bomb: string;
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
    gun: "nose_cannon_pair",
    missile: true,
    turret: false,
    bomb: "gravity_bomb",
    unlockScore: 0,
    unlockText: "初始机体",
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
    gun: "wing_machinegun_pair",
    missile: false,
    turret: false,
    bomb: "gravity_bomb",
    unlockScore: 500,
    unlockText: "单局积分达到 500",
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
    gun: "heavy_machinegun_quad",
    missile: false,
    turret: true,
    bomb: "heavy_bomb",
    unlockScore: 2000,
    unlockText: "单局积分达到 2,000",
  },
  {
    id: "wasp_04",
    name: "WASP–04",
    role: "轻量侦击机",
    description: "缩小轮廓，放大机动。为敢于贴近危险的飞行员而造。",
    color: "#c6c8a2",
    accent: "#a5e7bc",
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
    gun: "light_cannon",
    missile: true,
    turret: false,
    bomb: "gravity_bomb",
    unlockScore: 4000,
    unlockText: "单局积分达到 4,000",
  },
];
export const airframeById = (id: string) =>
  AIRFRAMES.find((a) => a.id === id) ?? AIRFRAMES[0];
