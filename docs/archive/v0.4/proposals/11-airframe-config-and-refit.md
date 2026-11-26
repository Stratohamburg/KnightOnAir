# 11 · 机体配置扩展与重装适配（含利维坦流）

> 状态：提案（**未实施**，只描述配置与字段；不改现有实现/基线文档）
> 基线：0.3.0（`5b22187`）；现有 4 架机体、23 个升级、11 个武器。
> 关系：[08 Q 版与时代线](08-q-art-and-era-progression.md) 负责时代/外观/17 架 roster；本文负责**机体的数据 schema、字段扩展、现有 4 架完整配置、重装适配度（利维坦流）与升级字段**；[03 部件](03-parts-and-damage-degradation.md)、[09 投弹包线](09-bombing-envelope-and-aero-turn.md)、[10 高度/镜头](10-altitude-layers-and-bombing-camera.md)、[01 升级池](01-air-pickups-and-upgrade-pool.md) 消费本文字段。
> 修正：**不新增“利维坦改造链”专属升级**；利维坦是玩家持续叠机翼/发动机/武器自然形成的重装流派，机体差异用本文的 `refit` 字段表达。
> **分时代完整配置**：13（萌芽期）、14（一战）、15（二战）、16（初代喷气）按本文 schema 把每个时代的机体完整填了一遍；本文给 schema 与 4 架现有/6 架候选，13–16 给全量取值。

## 1. 现状与缺口

### 1.1 现有 `Airframe` 是“首版扁平配置”

```ts
// src/data/aircrafts.ts:1-29（节选）
interface Airframe {
  id, name, role, description, color, accent,
  maxSpeed, cruiseSpeed, acceleration, turnRate,
  energyMax, energyDrain, energyRecover,
  health, length, wingspan, footprint, hardpoints,
  engines, mass, wingArea,
  gun, missile, turret, bomb,
  unlockScore, unlockText
}
```

缺口：

- **没有时代/构型**：`era / wingCount / propellerCount / floats / airship ...` 全部不存在（08 已要求补，但没有统一字段与取值表）。
- **没有“怎么装武器”**：`gun: string` 只能表达默认主武器，不能表达挂点位置、可接受武器类别、单侧/双侧、炮塔/炸弹舱；M2/M3 的挂点逻辑目前硬编码在 `World` 与 `ProceduralAircraft`。
- **没有部件配方**：`World` 构造时按 `frame.engines/gun/turret` 手写部件，升级再追加；没有一张“机体基础部件表”可数据化。
- **没有重装适配度**：翼展/质量只间接影响 `flightEnvelope`；无法显式表达“这架飞机适合叠翼/叠发动机（收益大）、那架不适合（收益小）”，也无法在 UI 上提示。
- **没有校验**：字段无范围、无枚举、无重复 id 检查；新增 17 架机体只能复制粘贴。

### 1.2 现有升级配置与“利维坦流”不匹配

现有 23 个升级里已有 `left_engine / right_engine / dual_engine / giant_wing / left_gun / right_gun / rocket / napalm / ammo / cooler ...`，其中发动机/翼/武器增件已经是通用部件。玩家持续选择这些部件，本来就会变大、变重、变慢——**这已经是利维坦流的雏形**，缺的是：

1. 机体侧没有“重装收益/代价”的显式数据（现在全靠 `flightEnvelope` 隐式推导）；
2. 升级侧没有 family/叠层上限/挂点消耗字段，导致候选池只能按 `max` 与 `conflicts` 粗略控制；
3. UI 没有“适合重装/不适合”的提示，玩家无法预判某架机体堆翼/堆发动机的回报。

## 2. 目标与原则

- **数据驱动**：所有机体差异尽量进 `src/data/airframes.ts`（或拆分的 `airframeConfig.ts`），渲染/模拟只读数据；新增一架机体 = 新增一条配置，不改逻辑。
- **利维坦流是涌现结果**：不新增专属升级链、不加隐藏系统；玩家叠通用 `wing/engine/weapon` 部件，质量、翼展、惯量、发动机数自然增长；机体用 `refit` 字段调“收益/代价”。
- **向后兼容**：现有 4 架机体/23 个升级的数值不变；新字段提供默认值与推导规则，旧数据可缺省（迁移期）。
- **可校验**：所有枚举/范围/唯一性可被 node 单测（与现有 `npm test` 同体系）。

## 3. 目标设计：`Airframe` v2 schema

```ts
// src/data/airframes.ts
type EraId = "pioneer" | "ww1" | "ww2" | "jet";
type AirframeRole =
  | "starter" | "interceptor" | "fighter" | "heavyFighter" | "attack"
  | "bomber" | "heavyBomber" | "seaplane" | "flyingBoat" | "airship";
type EngineLayout = "nose" | "tractor" | "pusher" | "nacelle" | "jet";
type LandingGear = "wheel" | "tailwheel" | "ski" | "float" | "boatHull" | "none";
type MountKind = "nose" | "wingL" | "wingR" | "top" | "bottom" | "tail" | "sideL" | "sideR";
type WeaponCategory = "directional" | "turret" | "area" | "lock";

interface WeaponMountSpec {
  id: string;                 // "nose_main" / "wingL_inner" ...
  kind: MountKind;
  x: number; z: number;       // 机体本地坐标（+Z 机头）
  size: "small" | "medium" | "large";
  accepts: WeaponCategory[];  // 可装类别
  maxSlots: number;           // 该挂点最多几件
}

interface RefitProfile {
  wingGain: number;           // 0.5–1.3，叠机翼类升级的收益倍率
  engineGain: number;         // 0.5–1.3，叠发动机类升级的收益倍率
  weaponGain: number;         // 0.5–1.3，叠武器类的收益倍率
  headroom: number;           // 0–1，结构余量：越高越适合重装
  massPenalty: number;        // 0.6–1.5，额外质量/惯性惩罚倍率（越低越适合）
  maxWingDecks: number;       // 额外翼层上限（0–2；不含基础翼）
  maxExtraEngines: number;    // 额外发动机上限（0–3）
  maxExtraHardpoints: number; // 额外挂点上限（0–12）
  leviathanPotential: 1|2|3|4|5; // UI 标签：5=极适合重装
  note: string;               // 机库/升级面板提示文案
}

interface Airframe {
  // 身份（原字段保留）
  id: string; name: string; role: AirframeRole; description: string;
  era: EraId; starter: boolean; unlockScore: number; unlockText: string;
  tags: string[];             // "dogfight" | "bomber" | "float" | "heavy" ...
  // 飞行（原字段保留）
  maxSpeed; cruiseSpeed; acceleration; turnRate;
  energyMax; energyDrain; energyRecover;
  health; mass; wingArea; length; wingspan; footprint; hardpoints;
  // 构型（新）
  wingCount: 1|2|3; engineCount: number; propellerCount: number;
  cockpitCount: 1|2;
  isFloatplane: boolean; isFlyingBoat: boolean; isAirship: boolean;
  isHeavyFighter: boolean; isLargeBomber: boolean;
  engineLayout: EngineLayout; landingGear: LandingGear;
  // 武器挂点（新：替代 gun/missile/turret/bomb 字符串）
  mounts: WeaponMountSpec[];
  defaultLoadout: { mountId: string; weaponId: string; count?: number }[];
  bombBay?: { mountId: string; accepts: ("gravity_bomb"|"heavy_bomb"|"napalm_bomb"|"torpedo")[] };
  // 基础部件配方（新：03 的 PartRecipe；World 构造用）
  baseParts: PartRecipe[];
  // 重装适配（新：本文核心）
  refit: RefitProfile;
  // 视觉/相机（08 的字段，本文定 schema）
  chibiScale: number; skin: "wood_canvas"|"painted_metal"|"bare_metal";
  palette: { main: string; secondary: string; accent: string; neutral: string };
  modelKey: string;           // 08 AircraftBuilder 的构型 key
  cameraScale?: number;       // 1.0；大型机可到 1.15
}
```

**字段规则**：

- `mounts` 是**唯一挂点事实来源**；`hardpoints` 保留为总挂点预算（用于候选池过滤），两者校验一致：`sum(maxSlots) ≤ hardpoints`。
- `baseParts` 只描述机体自身部件（core/wing/engine/nose/tail/bay/turret）；升级部件由 01/03 的 `PartRecipe` 追加，二者不重复。
- `refit` 不直接改 `stats`，只影响**升级回收率/惩罚**与 UI 标签；实际手感仍由 03 的 `flightEnvelope` 计算。
- 旧字段 `gun/missile/turret/bomb` 在迁移期保留为 `defaultLoadout` 的快捷方式；新代码只读 `mounts + defaultLoadout`。

### 3.2 改动清单（文件级）

| 文件 | 改动 |
| --- | --- |
| `src/data/airframes.ts`（或拆 `airframeConfig.ts`） | 新增 `Airframe` v2 字段、4 架现有完整配置、17 架 roster 补齐、6 架候选 |
| `src/data/upgrades.ts` | 新增 `family/refitCost/stack/refitWeight` 字段；现有 23 个升级归类 |
| `src/simulation/World.ts` | 用 `mounts/defaultLoadout/baseParts` 替代 `gun/missile/turret/bomb` 硬编码 |
| `src/simulation/FlightDynamics.ts` | 只读质量/翼展/翼载，`refit` 不进入公式（保持 03 物理口径） |
| `src/rendering/ProceduralAircraft.ts` | 按 `modelKey/baseParts` 构建，不按 `frame.id` 特判 |
| `src/app/GameApp.ts` / 机库 UI | 显示重装适配星级/标签与 `refit.note` |
| `tests/airframe-config.test.ts` | schema/唯一性/挂点预算/refit 顺序断言 |

## 4. 现有 4 架机体完整扩展配置

### 4.1 飞行/身份（数值不变）

| 字段 | SWIFT-01 | COURIER-02 | MASTODON-03 | WASP-04 |
| --- | ---: | ---: | ---: | ---: |
| era / role | jet / interceptor | jet / attack | jet / heavyBomber | jet / interceptor |
| starter | true（08 重排后为 false，改 sparrow） | false | false | false |
| wingCount / engineCount | 1 / 1 | 1 / 2 | 1 / 4 | 1 / 1 |
| propellerCount / cockpitCount | 0 / 1 | 0 / 1 | 0 / 1 | 0 / 1 |
| engineLayout / gear | jet / wheel | jet / wheel | jet / wheel | jet / wheel |
| mass / wingArea / span / length | 1800 / 17 / 6.2 / 4.8 | 4500 / 30 / 8.6 / 6.4 | 14500 / 72 / 13.4 / 8.8 | 950 / 11 / 4.9 / 4.1 |
| maxSpeed / cruise / accel / turn | 13.5 / 5 / 9.5 / 285 | 10.5 / 4.2 / 7.5 / 225 | 8.2 / 3.6 / 4.8 / 145 | 15.5 / 5.8 / 11.5 / 305 |
| health / energy / hardpoints | 100 / 85 / 6 | 145 / 110 / 10 | 230 / 135 / 16 | 75 / 75 / 5 |

### 4.2 挂点与默认武器（新字段）

| 机体 | mounts（id/kind/size） | defaultLoadout | bombBay |
| --- | --- | --- | --- |
| SWIFT-01 | `nose_main`(nose,medium)、`wingL_main`/`wingR_main`(wing,small)、`bottom_bay`(bottom,large) | nose: `nose_cannon_pair`；bottom: `gravity_bomb` | bottom_bay，accepts 三种炸弹 |
| COURIER-02 | `nose_main`(medium)、`wingL_mid`/`wingR_mid`(medium)、`wingL_tip`/`wingR_tip`(small)、`bottom_bay` | 双翼: `wing_machinegun_pair`；bottom: `gravity_bomb` | 有 |
| MASTODON-03 | `nose_main`(large)、两侧各 2 个(medium/small)、`top_turret`(turret)、`bottom_bay_x2`(large) | 四联重机枪 + `top_turret` + `heavy_bomb` | 双弹舱 |
| WASP-04 | `nose_main`(small)、`wingL_tip`/`wingR_tip`(small)、`bottom_bay` | `light_cannon` + `gravity_bomb` | 有 |

### 4.3 重装适配（利维坦流，本文核心）

| 机体 | wingGain | engineGain | weaponGain | headroom | massPenalty | maxWingDecks | maxExtraEngines | maxExtraHardpoints | leviathanPotential |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| SWIFT-01 | 0.90 | 1.00 | 0.95 | 0.55 | 1.10 | 0 | 1 | 4 | 3 |
| COURIER-02 | 1.05 | 1.05 | 1.00 | 0.70 | 0.90 | 1 | 1 | 6 | 4 |
| MASTODON-03 | 1.15 | 1.12 | 1.10 | 0.90 | 0.75 | 2 | 2 | 8 | 5 |
| WASP-04 | 0.75 | 0.85 | 0.80 | 0.40 | 1.25 | 0 | 0 | 2 | 1 |

语义：

- **MASTODON / 重型轰炸机**：叠机翼/发动机收益最高、质量惩罚最低，是“利维坦流”的天然机体；在 4 架里唯一 `potential 5`。
- **COURIER**：中型，能堆出中型利维坦，但收益与惩罚均衡。
- **SWIFT**：只能小规模混装（加 1 台发动机/少量挂点），堆多了会变钝。
- **WASP**：最不适合重装；叠 1–2 件就开始明显变重，适合轻型/高速流派。

> 这些字段只影响升级**回收率**与 UI 提示，不直接乘在 `flightEnvelope` 上；真实手感仍来自质量/翼展/惯量/翼载（03 的 A1–A15 保证）。

## 5. 08 roster 的字段补齐规则（17 架 + 扩展候选）

08 定义了 17 架，但没给全部字段。按本文 schema，角色到 `refit` 的默认映射如下（具体机体可覆盖）：

| role | headroom | wingGain | engineGain | weaponGain | massPenalty | maxWingDecks | maxExtraEngines | potential |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| starter | 0.45 | 0.85 | 0.85 | 0.85 | 1.15 | 0 | 1 | 2 |
| interceptor | 0.50 | 0.85 | 0.95 | 0.90 | 1.15 | 0 | 1 | 2 |
| fighter | 0.60 | 1.00 | 1.00 | 1.00 | 1.00 | 1 | 1 | 3 |
| attack | 0.65 | 1.00 | 1.00 | 1.00 | 1.00 | 1 | 1 | 3 |
| heavyFighter | 0.72 | 1.08 | 1.08 | 1.05 | 0.90 | 1 | 2 | 4 |
| bomber | 0.85 | 1.10 | 1.10 | 1.05 | 0.85 | 1 | 2 | 4 |
| heavyBomber | 0.95 | 1.15 | 1.15 | 1.10 | 0.75 | 2 | 3 | 5 |
| seaplane | 0.60 | 0.95 | 0.95 | 0.95 | 1.05 | 1 | 1 | 3 |
| flyingBoat | 0.78 | 1.05 | 1.08 | 1.05 | 0.92 | 1 | 2 | 4 |
| airship | 1.00 | 1.20 | 1.25 | 1.15 | 0.70 | 0 | 3 | 5 |

- 17 架完整数据按 08 §3.4.3 的 role 套此表；个别机体（如 Wasp 的轻量定位）可手工覆盖成更低 `headroom`。
- **扩展候选（二期，需 08 评审是否扩大 roster）**：

| id | 名称 | era/role | wing/engine/prop | 关键定位 | refit 特征 |
| --- | --- | --- | --- | --- | --- |
| `atlas_18` | ATLAS-18 四发重型轰炸机（一战） | ww1 / heavyBomber | 2 / 4 / 4 | 一战“利维坦”原型，4 发+多炮塔 | potential 5，headroom 0.95 |
| `vulture_19` | VULTURE-19 鱼雷轰炸机（二战） | ww2 / attack | 1 / 2 / 2 | 对舰/对地，低空 | potential 3，headroom 0.62 |
| `tempest_20` | TEMPEST-20 双发重战（二战） | ww2 / heavyFighter | 1 / 2 / 2 | 重火力、可堆炮塔 | potential 4，headroom 0.72 |
| `comet_21` | COMET-21 夜间截击机（喷气） | jet / interceptor | 1 / 2 / 0 | 雷达/导弹平台 | potential 3，headroom 0.55 |
| `manta_22` | MANTA-22 喷气飞行艇 | jet / flyingBoat | 1 / 2 / 0 | 水上/远程 | potential 4，headroom 0.78 |
| `zephyr_23` | ZEPHYR-23 竞速机（萌芽期） | pioneer / interceptor | 1 / 1 / 1 | 高速轻机，不适合重装 | potential 1，headroom 0.38 |

> 新增候选只补数据，不自动进一期 roster；是否纳入由 08 的内容期决定。

## 6. 升级 schema 扩展（供 01 使用）

现有 `Upgrade` 字段：`id/name/rarity/tag/description/benefit/cost/preview/add/multiply/parts/weapons/conflicts/requires/max/repair`。扩展：

```ts
type UpgradeFamily = "wing" | "engine" | "weapon" | "structure" | "utility";
interface UpgradeV2 {
  // 现有字段保留
  ...
  family: UpgradeFamily;         // 用于 refitGain 与候选池分类
  refitCost: number;             // 该升级消耗的“重装预算”（0–3）
  stack: { max: number; diminishing: number; }; // 同类叠层上限/收益衰减
  eraHint?: EraId[];             // 时代倾向（不硬限制）
  requiresAny?: string[];        // 任一前置即可
  conflictsFamily?: UpgradeFamily[]; // 与哪类流派互斥
  visualPart?: { kind: string; deck: "wing"|"engine"|"turret"|"bay"|"armor" };
  refitWeight: number;           // 候选权重：机体 headroom 越高该升权重越高
}
```

- **不新增利维坦专属升级**；`family: "wing"/"engine"/"weapon"` 的通用升级就是利维坦流的组件。现有 `giant_wing / left_engine / right_engine / dual_engine / left_gun / right_gun / rocket / napalm` 等全部归入对应 family。
- **叠层收益**：`effectiveGain = baseGain × refit.wingGain × (1 - usedSlots/maxSlots)^0.5`（家族同理）；`effectiveMassPenalty = addedMass × refit.massPenalty`。
- **挂点/预算**：`refitCost` 与 `mounts.maxSlots` 共同限制堆叠；候选池仍由 01 的合法池保证 ≥3。
- **新增通用升级示例（二期）**：

| id | family | 作用 | refitCost | max |
| --- | --- | --- | ---: | ---: |
| `upper_wing_deck` | wing | 增加一层上翼（wingDeck），+升力/挂点 | 2 | 2 |
| `engine_bank` | engine | 两侧各加 1 台发动机 | 2 | 2 |
| `heavy_hardpoint` | weapon | 增加 2 个中型挂点 | 1 | 3 |
| `turret_pod` | weapon | 增加 1 个侧/背炮塔 | 1 | 2 |
| `structural_brace` | structure | +生命、降低重装质量惩罚 10% | 1 | 2 |
| `fuel_tank` | utility | +能量/航程，质量↑ | 1 | 3 |

## 7. 校验与验收

- **数据校验**：id 唯一；`wingCount∈{1,2,3}`、`engineCount≥1`、`mount.kind/size/accepts` 合法；`sum(maxSlots) ≤ hardpoints`；`refit` 各字段在范围内；`leviathanPotential` 与 headroom 大致一致（差 ≤1）。
- **现有 4 架数值不变**：`maxSpeed/health/mass/...` 与 0.3.0 完全一致；新字段只增加表达力。
- **重装适配**：构造“同一升级组”分别装在 4 架上，`effectiveGain` 顺序满足 Mastodon > Courier > Swift > Wasp；`effectiveMassPenalty` 顺序相反。
- **升级池**：新增 `family/stack` 字段后，三选一仍满员且不重复（01 的 A 断言）。
- **渲染/结构**：`modelKey`/`baseParts` 能重建现有 4 架的外观与命中区（03 A1），不依赖硬编码 `frame.id`。

## 8. 实施任务

| # | 任务 | 依赖 | 完成标志 |
| --- | --- | --- | --- |
| T1 | schema + 4 架完整配置 + 迁移默认值 | — | `npm run check` 通过；现有 4 架数值/外观不变 |
| T2 | `mounts/defaultLoadout/baseParts` 替换 `gun/missile/turret/bomb` 硬编码 | T1、03 | 现有武器/挂点/部件装配与 0.3.0 等价 |
| T3 | `refit` 字段接入升级收益/权重/UI 标签 | T1、01 | 4 架重装收益顺序断言通过 |
| T4 | 17 架 roster 按 role 表补齐（08 数据） | T1、08 | 数据校验通过；无手写特判 |
| T5 | 二期扩展候选 6 架 + 新通用升级 | T1–T4 | 评审后进数据表，不影响一期平衡 |

## 9. 待确认

| # | 问题 | 推荐 | 备选 |
| --- | --- | --- | --- |
| 1 | `refit` 是否显式乘在 `stats` 上 | **不乘**，只调升级收益/UI | 直接乘会与 03 的物理模型重复，难调 |
| 2 | 是否把 6 架扩展候选纳入一期 roster | **二期** | 一期扩到 23 架会拉长测试/平衡周期 |
| 3 | `mounts` 是否完全替代旧 `gun/missile/...` | 迁移期双轨，稳定后删旧字段 | 直接删会让 23 个升级/测试同批迁移，风险大 |
| 4 | 是否显示“利维坦潜力”星级 | 显示在机库详情（5 星） | 仅在升级面板提示文字，避免信息过载 |
