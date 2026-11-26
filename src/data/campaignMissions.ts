import { STARTER_FRAME_ID, type EraId } from "./aircrafts";
import type { SortieEnvironmentConfig } from "./sortieEnvironment";

export interface MissionPoint { x: number; z: number }

export interface MissionTarget {
  id: string;
  name: string;
  kind: string;
  placement: { at: MissionPoint } | { bearing: number } | { route: string; distance: number };
  motion?: { points: readonly MissionPoint[]; speed: number; loop?: boolean };
  shuttle?: { end: number; speed: number };
  delay?: number;
  friendly?: boolean;
  support?: boolean;
  attacks?: string;
  weaponId?: string;
  health?: number;
  deadline?: { seconds: number } | { routeDistance: number } | { pathEnd: true };
}

export interface MissionStage {
  id: string;
  action: string;
  targets: readonly MissionTarget[];
  goal?: { type: "escort"; target: string; routeDistance?: number; waypoint?: number } |
    { type: "damage"; target: string; fraction: number; redirect?: MissionTarget["motion"] };
  next?: string;
  delay?: number;
  ambient?: boolean;
  sequential?: boolean;
  prompt?: "gun" | "bomb" | "lock";
}

export interface CampaignMission {
  id: string;
  chapter: number;
  order: number;
  name: string;
  era: EraId;
  briefing: string;
  stages: readonly MissionStage[];
  firstStage: string;
  loadout: { frameId?: string; weaponId?: string; temporary?: boolean; exclusive?: boolean };
  environment: SortieEnvironmentConfig;
}

function gunTraining(moving: boolean): CampaignMission {
  const name = moving ? "移动靶" : "固定靶";
  const target = (id: string, at: MissionPoint, direction: number): MissionTarget => ({
    id, name: `系留靶球 · ${name}`, kind: "recon_balloon",
    placement: { at },
    motion: moving ? {
      points: [{ x: at.x + direction * 19, z: at.z }, at],
      speed: 1.85,
      loop: true,
    } : { points: [], speed: 0 },
  });
  return {
    id: moving ? "crosswind-range" : "dawn-meadow",
    chapter: 1,
    order: moving ? 2 : 1,
    name: moving ? "横风靶场" : "黎明草甸",
    era: "pioneer",
    briefing: moving ? "跟随横移靶球，利用屏边方向找回目标。" : "把机头转向系留靶球，观察双联机枪自动开火和命中。",
    firstStage: "practice",
    stages: [{
      id: "practice", action: `击毁${name}`, prompt: "gun", sequential: true,
      targets: [target("balloon-front", { x: 0, z: 25 }, 1), target("balloon-side", { x: -33, z: 47 }, -1)],
    }],
    loadout: { frameId: STARTER_FRAME_ID, weaponId: "ww1_twin_mg" },
    environment: { weather: "clear", period: moving ? "day" : "dawn" },
  };
}

const staticMotion = { points: [], speed: 0 };
const at = (x: number, z: number) => ({ at: { x, z } });
const from = (bearing = 0) => ({ bearing });
const onRoute = (route: string, distance: number) => ({ route, distance });
const road = "road-491", rail = "rail-492", water = "water-491";

function target(id: string, name: string, kind: string, placement: MissionTarget["placement"], extra: Partial<MissionTarget> = {}): MissionTarget {
  return { ...extra, id, name, kind, placement };
}

function stage(id: string, action: string, targets: readonly MissionTarget[], extra: Partial<MissionStage> = {}): MissionStage {
  return { ...extra, id, action, targets };
}

function sortie(order: number, id: string, name: string, briefing: string, stages: readonly MissionStage[],
  weaponId?: string, environment: SortieEnvironmentConfig = { weather: "clear", period: "day" }): CampaignMission {
  const chapter = Math.ceil(order / 5);
  const era = (["pioneer", "ww1", "ww2", "jet"] as const)[chapter - 1];
  return { id, name, chapter, order, era, briefing, stages, firstStage: stages[0].id, environment,
    loadout: { frameId: chapter < 3 ? STARTER_FRAME_ID : chapter === 3 ? "falcon_13" : "stingray_16",
      ...(weaponId ? { weaponId, temporary: true, exclusive: order === 16 } : {}) } };
}

const relay = target("relay", "中继站", "resource", at(-10, 31), { friendly: true, motion: staticMotion, health: 120 });
const scout = target("recon", "侦察机", "scout", at(3, 18), { friendly: true, health: 110,
  motion: { points: [{ x: -7, z: 88 }, { x: 24, z: 160 }], speed: 4.8 } });
const transport = target("transport", "运输船", "landing_ship", onRoute(water, 405), { friendly: true, health: 280 });
const boss = target("gunship", "重型炮艇机", "gunship", from(-.2), { health: 170 });
const evacuation = target("transport-plane", "运输机", "bomber", at(3, 18), { friendly: true, health: 180,
  motion: { points: [{ x: 20, z: 100 }, { x: -9, z: 196 }], speed: 5.5 } });

export const CAMPAIGN_MISSIONS: readonly CampaignMission[] = [
  gunTraining(false), gunTraining(true),
  sortie(3, "meadow-patrol", "草甸巡逻", "观察追猎机还击和脱离，转向后再次接敌。", [
    stage("patrol", "击落追猎机", [target("hunter", "追猎机", "hunter", from(.15))]),
  ]),
  sortie(4, "first-bomb", "第一枚炸弹", "开启轰炸，松杆稳定准心，在补给点进入落点时投放。", [
    stage("bomb", "摧毁固定补给点", [target("depot", "固定补给点", "depot", at(0, 32), { motion: staticMotion, health: 38 })], { prompt: "bomb" }),
  ], "pioneer_light_bomb"),
  sortie(5, "road-supply", "公路补给线", "观察车速与行驶方向，把准心放在行进路线前方。", [
    stage("bomb", "摧毁补给车", [target("truck", "补给车", "resource", onRoute(road, 444), {
      shuttle: { end: 472, speed: 1.35 }, health: 37,
    })]),
  ], "pioneer_light_bomb"),
  sortie(6, "trench-skies", "堑壕天空", "清除正面敌群后，用雷达寻找侧后方的第二波。", [
    stage("front", "清除正面敌群", [target("front-1", "正面敌机", "scout", from(-.15)), target("front-2", "正面敌机", "hunter", from(.2))], { next: "rear" }),
    stage("rear", "清除侧后敌群", [target("rear-1", "侧后敌机", "hunter", from(2.25)), target("rear-2", "侧后敌机", "scout", from(2.65))]),
  ]),
  sortie(7, "train-departure", "列车离站", "在补给列车驶离可交战铁路段之前将其击毁。", [
    stage("rail", "拦截补给列车", [target("train", "补给列车", "supply_train", onRoute(rail, 446),
      { deadline: { routeDistance: 510 }, health: 114 })]),
  ], "ww1_light_bomb"),
  sortie(8, "relay-defense", "守住中继站", "优先拦截飞向中继站的攻击机，守住两波。", [
    stage("first-wave", "保护中继站", [relay, target("raid-1", "掠袭机", "striker", from(-.12), { attacks: relay.id, weaponId: "howitzer" })], { next: "second-wave" }),
    stage("second-wave", "抵挡两路掠袭", [relay, target("raid-2", "左侧掠袭机", "striker", from(.95), { attacks: relay.id, weaponId: "howitzer" }),
      target("raid-3", "右侧掠袭机", "hunter", from(-1.15), { attacks: relay.id, weaponId: "howitzer" })]),
  ]),
  sortie(9, "cross-the-trenches", "越过堑壕", "跟随侦察机穿过两个航点，拦截沿途敌机。", [
    stage("first-leg", "护送侦察机", [scout, target("interceptor-1", "正面拦截机", "hunter", from(.2), { attacks: scout.id })],
      { goal: { type: "escort", target: scout.id, waypoint: 1 }, next: "second-leg" }),
    stage("second-leg", "护送侦察机至终点", [scout, target("interceptor-2", "侧翼拦截机", "hunter", from(-1.1), { attacks: scout.id })],
      { goal: { type: "escort", target: scout.id, waypoint: 2 } }),
  ]),
  sortie(10, "trench-ace", "堑壕王牌", "先击落护卫，再把握王牌切入和脱离的窗口。", [
    stage("guards", "击落护卫", [target("guard-a", "护卫机", "escort", from(-.28)), target("guard-b", "护卫机", "escort", from(.28))], { next: "ace" }),
    stage("ace", "击落堑壕王牌", [target("ace", "堑壕王牌", "fighter_ace", from(.65), { health: 115 })]),
  ]),
  sortie(11, "ironwing-strait", "铁翼海峡", "优先拦截最接近防线的指定轰炸机。", [
    stage("intercept", "拦截轰炸机", [-1, 0, 1].map((side, index) =>
      target(`bomber-${index + 1}`, `轰炸机 ${index + 1}`, "bomber", at(side * 29, 46 + index * 14),
        { delay: index * 3.5, motion: { points: [{ x: side * 7, z: -63 }], speed: 4.5 }, deadline: { pathEnd: true } }))),
  ]),
  sortie(12, "radar-suppression", "关闭雷达", "炸毁两辆标记雷达车，然后切回空战拦截敌机。", [
    stage("radar", "摧毁雷达车", [target("radar-a", "雷达车", "radar_truck", onRoute(road, 441)), target("radar-b", "雷达车", "radar_truck", onRoute(road, 457))], { next: "air" }),
    stage("air", "拦截来袭敌机", [target("pursuit", "来袭敌机", "hunter", from(.45)), target("intercept", "截击机", "interceptor", from(-.55))]),
  ], "ww2_medium_bomb", { weather: "clear", period: "day", weatherTransition: { to: "overcast", trigger: { stage: "air" }, duration: 8 } }),
  sortie(13, "water-passage", "水面通道", "先攻击停泊巡逻艇，再跟踪缓慢航行的登陆舰。", [
    stage("moored", "击沉停泊巡逻艇", [target("boat", "停泊巡逻艇", "patrol_boat", onRoute(water, 434), { motion: staticMotion, health: 135 })], { next: "moving", prompt: "bomb" }),
    stage("moving", "击沉航行登陆舰", [target("ship", "登陆舰", "landing_ship", onRoute(water, 464), { health: 190 })]),
  ], "ww2_torpedo"),
  sortie(14, "strait-escort", "海峡护航", "护送运输船驶过空袭航段，优先拦截带鱼雷的飞机。", [
    stage("air-raid", "保护运输船", [transport, target("raider", "空袭机", "striker", from(-.7), { attacks: transport.id, weaponId: "ww2_rocket_battery" })],
      { goal: { type: "escort", target: transport.id, routeDistance: 424 }, next: "torpedo" }),
    stage("torpedo", "掩护运输船抵达", [transport, target("torpedo", "鱼雷机", "torpedo_bomber", from(.9), { attacks: transport.id, weaponId: "ww2_torpedo" })],
      { goal: { type: "escort", target: transport.id, routeDistance: 457 } }),
  ], undefined, { weather: "drizzle", period: "day" }),
  sortie(15, "strait-showdown", "海峡决战", "重型炮艇机到达半血后会换路线，从新的航向切入。", [
    stage("approach", "压制重型炮艇机", [boss], { goal: { type: "damage", target: boss.id, fraction: .5,
      redirect: { points: [{ x: -32, z: 50 }, { x: 21, z: 29 }], speed: 5.5 } }, next: "showdown" }),
    stage("showdown", "击落重型炮艇机", [boss]),
  ]),
  sortie(16, "emerald-coast", "翡翠海岸", "保持机头指向目标建立锁定，先攻击固定靶，再追踪高速截击机。", [
    stage("lock", "锁定并击毁固定空靶", [target("balloon", "固定空靶", "recon_balloon", at(1, 34), { motion: staticMotion })], { prompt: "lock", next: "interceptor" }),
    stage("interceptor", "锁定并击落截击机", [target("interceptor", "高速截击机", "interceptor", from(.35))], { prompt: "lock" }),
  ], "jet_air_missile"),
  sortie(17, "high-speed-intercept", "高速追击", "用加力抢到高速掠袭机前方，在越线前击落它。", [
    stage("crossing", "拦截高速掠袭机", [target("raider", "高速掠袭机", "jet_bomber", at(-38, 58),
      { health: 130, motion: { points: [{ x: 138, z: 42 }], speed: 10.5 }, deadline: { pathEnd: true } })]),
  ]),
  sortie(18, "air-defense-net", "穿过防空网", "用告警定位地面锁定威胁，摧毁两处导弹车。", [
    stage("battery", "摧毁独立导弹车", [target("sam-a", "导弹车", "missile_truck", at(0, 42), { motion: staticMotion, health: 95 })], { next: "guarded" }),
    stage("guarded", "摧毁有掩护的导弹车", [target("sam-b", "导弹车", "missile_truck", at(-18, 70), { motion: staticMotion, health: 95 }),
      target("cover", "掩护敌机", "hunter", from(.65), { support: true })]),
  ], "gravity_bomb"),
  sortie(19, "coast-evacuation", "海岸撤离", "夜间用航点和雷达保持护送，拦截从正面和侧面来袭的敌机。", [
    stage("runway", "护送运输机", [evacuation, target("front", "正面截击机", "interceptor", from(.1), { attacks: evacuation.id })],
      { goal: { type: "escort", target: evacuation.id, waypoint: 1 }, next: "coast" }),
    stage("coast", "护送运输机至撤离点", [evacuation, target("flank", "侧向掠袭机", "jet_bomber", from(-1.2), { attacks: evacuation.id })],
      { goal: { type: "escort", target: evacuation.id, waypoint: 2 } }),
  ], undefined, { weather: "clear", period: "night" }),
  sortie(20, "coastal-showdown", "海岸决战", "依次摧毁防空节点、拦截高速掠袭机、击落海岸王牌。", [
    stage("defense", "摧毁防空节点", [target("defense", "防空节点", "aa_truck", at(-5, 39), { motion: staticMotion })], { next: "intercept" }),
    stage("intercept", "拦截高速掠袭机", [target("raider", "高速掠袭机", "jet_bomber", from(.6),
      { health: 125, deadline: { seconds: 34 } })], { delay: 4, next: "ace" }),
    stage("ace", "击落海岸王牌", [target("ace", "海岸王牌", "ace", from(-.7))], { delay: 4 }),
  ], "gravity_bomb", { weather: "clear", period: "dusk", periodTransition: { to: "night", trigger: { stage: "intercept" }, duration: 36 } }),
];
export const campaignMissionById = (id: string) => CAMPAIGN_MISSIONS.find((mission) => mission.id === id);
export const nextCampaignMission = (id: string) => {
  const index = CAMPAIGN_MISSIONS.findIndex((mission) => mission.id === id);
  return index < 0 ? undefined : CAMPAIGN_MISSIONS[index + 1];
};

export function missionIsUnlocked(mission: CampaignMission, cleared: readonly string[]) {
  const index = CAMPAIGN_MISSIONS.indexOf(mission);
  return index >= 0 && (index === 0 || cleared.includes(mission.id) || cleared.includes(CAMPAIGN_MISSIONS[index - 1].id));
}
