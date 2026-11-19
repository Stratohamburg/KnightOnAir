# 01 · 空中血瓶与升级池调整

> 状态：提案（**未实施**，不改现有实现与基线文档）。
> 对应总览需求 #1「空中随机刷新血瓶」、#2「去掉升级中的维修选项」。
> 基线：提交 `5b22187` / 0.3.0；行号仅作快速索引，实施以符号名为准。
> 共享约束：遵守 `00-overview.md` 的 D1（部件模型统一）、D4（双区油门）、D9（存档兼容）、D11（测试原则）；与 03/04/05 只约定接口语义。
> 本文不新增存档字段，不修改源码以外的其他文档。

## 1. 问题与现状

### 1.1 当前恢复链路

- 拾取物只有金币与一个 `repair: boolean`（`src/simulation/types.ts:138-146`，字段在 145 行）；`spawnPickup`（`World.ts:1031-1034`）写入 `life: 28`，金币与维修共用一个对象池（`World.ts:88-96`）。
- 金币来源：开局 6 枚（`World.ts:232-233`）、导演每 7 秒 5 连发（`World.ts:503-510`）、敌人击毁掉落（`World.ts:987-993`）。
- 精英击毁才投放维修补给（`World.ts:994-997`，提示文案在 996），拾取时 `repair(0.35)`（`World.ts:1057`）。
- `repair()`（`World.ts:1242-1255`）恢复核心 + 所有部件生命，并**把已脱落部件重装**（1252 行 `part.destroyed = false`）。
- 维修升级「应急维修组件」：`src/data/upgrades.ts:321-333`（`repair: true`，`max: 999`）；字段声明在 `upgrades.ts:26`；安装时 `repair(0.4)`（`World.ts:1234`）。
- 权重：低血量（<45%）维修权重 ×5（`World.ts:1118-1119`）；巨型翼后「动力/轰炸/维修」tag 权重 ×2（`World.ts:1122-1126`）。
- UI 比较有维修专属分支（`src/app/GameApp.ts:414-415`）；渲染层有独立 `repairs` InstancedMesh（`Renderer.ts:138-147`，绘制分支 650-660）。
- 测试对维修的直接依赖：`tests/simulation.test.ts:246-257`（安装 `repair` 后 20 → 60 生命并重装 `right_wing`）。

### 1.2 为什么这套方案不可取

1. **续航由抽卡决定，而不是由航线决定。** 末期候选池只剩三个可重复项时维修约占 1/3（`tests/simulation.test.ts:213-220` 已证明末期只剩 `repair / ammo / cooler`）；血量低于 45% 时权重变成 25 : 5 : 5，约 71% 的卡面是维修。玩家越危险，越只能拿“回血按钮”，构筑决策被挤掉。
2. **一次选择等于一次完全重置。** 40% 核心 + 40% 部件，且被毁部件额外 +30% 生命并重装（`World.ts:1242-1255`）。代价只是一次升级机会和 0.35–0.6 秒安装动画，换来的却是把 03 规划的“部件损伤永久化、性能衰减”一次性抹平，装甲、结构、护航类升级的价值被直接否定。
3. **精英掉落的风险/收益倒置。** 精英 650 生命、90 秒周期（`World.ts:493-501`）；最需要补给的残血玩家往往打不动，而“维修补给”掉在精英位置、只有 28 秒寿命（`World.ts:1031-1034`），经常看不到或赶不到。
4. **不可读。** 维修既不是空间改装、也不改变飞机轮廓，和升级系统“看得见的构筑”这一目标脱节；它只是数值补丁。

### 1.3 移除后必须补上的压力

维修移除后，`destroyed` 部件在整个航次里不可恢复（03 的损毁衰减会放大这一点）。本文件的补偿渠道是：

- **核心续航**：随机刷新的小/大血瓶，只回核心生命，按可预期节奏投放，不占升级位。
- **部件损耗**：保留精英修复包，但改为“只修复未脱落部件、永不重装”的部件维修包。
- **构筑责任**：耐久交给结构类升级（如 `heavy_armor`、`tail_armor`、本文件新增的 `armor_belt`），而不是一张回血卡。
- **未来回装**：若 03 评审或系统文档 05（升级系统）认为需要回装渠道，应由一个明确的“重装类升级”承担；本文件不引入重装。

## 2. 目标体验

- **看得见**：珊瑚色十字血瓶在空域中发光、漂浮、可远距离辨认；低血量时刷新变快，形成“被追杀—找到补给—拉回战局”的节奏。
- **飞得到**：血瓶刷在玩家前方或侧前方 12–28 单位，弱磁吸 + 略大拾取半径，手机单手也能吃到；吃不到是航线选择问题，不是运气问题。
- **选得值**：升级三选一永远只出构筑项；维修只剩地图资源，不再是一张“治疗卡”。
- **摔得起**：部件打掉就是打掉，但核心可以通过补给续命；玩家理解“保核心、保部件”的取舍，而不是等下一次维修抽卡。

## 3. 目标设计

### 3.1 拾取物类型与数据模型

新增数据文件 `src/data/pickups.ts`，用枚举替代布尔字段：

| `PickupKind` | 用途 | 场上数量 | 刷新来源 |
| --- | --- | ---: | --- |
| `coin` | 金币 + 经验 + 连击 | 不限（池 56） | 开局/导演/击毁掉落 |
| `healthSmall` | 小血瓶：核心生命 | 小 + 大合计 ≤3 | 随机补给 |
| `healthLarge` | 大血瓶：核心生命 | 小 + 大合计 ≤3 | 随机补给（低血量概率提高） |
| `repairKit` | 精英部件修复包（不重装） | ≤2 | 仅精英击毁 |

`Pickup` 改为 `{ active, x, z, kind: PickupKind, value, xp, life }`，删除 `repair: boolean`；`Effect.kind`（`types.ts:155`）新增 `"heal"` 用于拾取表现。数值集中在新文件，`RULES.maxPickups`（`src/data/config.ts:10`）继续作为池容量，不新增池。

### 3.2 血瓶刷新规则

- **独立节奏**：新增 `updatePickupSupply(dt)`，由 `step()` 调用；把现有金币 7 秒 5 连发（`World.ts:503-510`）一并搬入，避免与 02 的导演重构互相冲突。
- **开关**：`World` 构造参数新增 `supply?: boolean`，默认 `director !== false`；现有 `{ director: false }` 测试世界行为不变，新测试用 `{ director: false, supply: true }` 获得确定性补给。
- **首次**：开局后 8–12 秒刷第一个血瓶，让玩家在第一次掉血前后就能看到补给。
- **间隔**：基础 `random.range(18, 26)` 秒；`<45%` 生命 ×0.55（约 10–14 秒）；`<25%` ×0.35（约 6.3–9.1 秒，下限 6 秒）；保底：`<25%` 且场上暂无血瓶时，计时器压到 ≤4 秒。
- **上限**：小 + 大血瓶同时最多 3 个；到达上限时 2 秒后重试，而不是重置整个间隔。
- **方位与距离**：相对当前航向 `heading + random.range(-2.2, 2.2)` 弧度；小血瓶 12–22 单位、大血瓶 18–28 单位。距离下限保证不会贴在玩家身上刷新。
- **大小概率**：25% 大血瓶；生命低于 50% 时提高到 40%。
- **寿命**：26 秒；沿用现有 >70 距离回收（`World.ts:1042`）；最后 3 秒 2Hz 闪烁提示即将消失。
- **记录**：每次生成写 `telemetry.record(elapsed, "health_pickup_spawn", { kind, distance })`，用于平衡统计（D11）。

### 3.3 拾取、治疗与满血转换

- **弱磁吸**：血瓶磁吸半径 3.6、拾取半径 2.0；金币保持 5.2 / 1.6（`RULES.magnetRadius`、`RULES.pickupRadius`，`config.ts:16-17`）。磁吸公式沿用 `updatePickups`（`World.ts:1047-1051`），只把半径改为按 `kind` 从数据表读取。
- **只回核心**：治疗量 = `stats.health × healRatio`，`min(缺失生命, 治疗量)` 后加到 `player.health`，同步 `core` 部件的 `health/maxHealth`；**不修改任何其他 `Part` 的 `health` 或 `destroyed`**。治疗与修复都不触发 `player.revision++`（生命变化不影响几何，避免 Renderer 重建，参见 `ProceduralAircraft.ts:342-347`）。
- **满血转换**：拾取瞬间核心满血则转金币（小 +2、大 +5），积分按金币值 ×10 计入，不消耗在治疗上；不增加经验，避免“满血刷瓶”刷经验。
- **部分受伤**：实际治疗时给经验（小 15 / 大 35），不增加金币、不加连击；连击逻辑仍只归金币分支（`World.ts:1054-1059`）。
- **提示**：治疗 `医疗补给 · +N 机体生命`；满血 `生命已满 · 转入 N 金币`；拾取播放 `heal` 音效并置 `World.healPulse = 0.35`（给 HUD 闪一下血条）。

### 3.4 精英修复包（保留并改造）

**结论：保留精英掉落，但从“维修补给”改为“部件修复包”（`repairKit`），永不重装。** 理由：精英是高价值目标，保留其独特掉落符合 `docs/systems/04-enemies-battlefield.md:160` 与 D9“运行时拾取物”的定位；但重装部件必须消失，否则 03 的永久损毁无法成立。

- 拾取调用 `repair(coreRatio = 0.30, partRatio = 0.25)`：核心 +30%，所有 `destroyed === false` 的非核心部件恢复 25% 自身最大生命；`destroyed === true` 的部件一律跳过（核心由 `healCore` 单独处理，不在部件循环里二次加成）。
- 文案改为 `精英击毁 · 部件修复包已投放`；拾取提示 `部件修复包 · 修复核心与受损部件（不重装脱落件）`。若 05 落地后把精英播报迁移到击杀信息条，这段文案作为信息条副标题复用，不另起播报位。
- 视觉沿用现有绿色八面体（`Renderer.ts:138-142`），在 03 统一部件表现后仍可读；场上 ≤2；寿命 28 秒。
- 这是“血瓶只回核心”的唯一例外：修复包可以恢复**未脱落**部件（含生命 0 的 disabled 部件），但同样不重装。

### 3.5 移除维修升级与升级池兜底

| 项目 | 处理 |
| --- | --- |
| `Upgrade.repair` 字段（`upgrades.ts:26`） | **删除**：全仓库不再有该字段，防止未来误加 |
| 「应急维修组件」条目（`upgrades.ts:321-333`） | **删除** |
| `upgradeWeight` 低血量 ×5（`World.ts:1118-1119`） | **删除** |
| `upgradeWeight` 的「维修」tag 加权（`World.ts:1122-1126`） | tag 数组改为 `["动力", "轰炸"]` |
| `installUpgrade` 的 `if (u.repair) this.repair(0.4)`（`World.ts:1234`） | **删除** |
| 重复安装复用分支的 `existing.destroyed = false`（`World.ts:1184`） | **删除**：可重复升级重装时只补 30% 挂点生命，不复活已脱落挂点，与“不重装”原则一致 |
| `GameApp.upgradeComparison` 维修分支（`GameApp.ts:414-415`） | **删除**；新升级由通用 `add/multiply` 比较自动生成 |
| `repair()`（`World.ts:1242-1255`） | **保留并拆分**为 `healCore(amount)` + `repair(coreRatio, partRatio)`；删除 `part.destroyed = false` 重装逻辑与不必要的 `revision++` |
| `spawnPickup` 的 `repair` 参数（`World.ts:1031-1034`） | 改为 `spawnPickup(kind, x, z, override)`；所有调用点改为显式 kind |
| 渲染 `repairs`（`Renderer.ts:34,138-147,650-660,792`） | 重命名 `repairKits`，并新增血瓶实例网格（见 §3.8） |

**候选池兜底（必须有 3 个合法项）**：删除维修后，`max: 999` 的可重复项只剩 `ammo`、`cooler` 两项，末期三选一会缺员（现有 `tests/simulation.test.ts:213-220` 会失败）。因此**新增第三项可重复通用升级**：

```ts
{
  id: "armor_belt", name: "快拆装甲带", rarity: "common", tag: "结构",
  description: "可快速更换的机身装甲带，持续提高结构强度。",
  benefit: "生命上限 +12", cost: "转向 −1%",
  preview: "center",
  add: { health: 12 }, multiply: { turnRate: 0.99 },
  parts: [{ kind: "armor", slot: "center", health: 20 }],
  max: 999,
}
```

它没有 `weapons` 与 `conflicts`，在 `openUpgrades` 的过滤条件（`World.ts:1083-1092`）下**始终合法**，因此任何等级、任意构型下候选池都至少 3 项；三项都不重复（`slice(0,3)` 基于同一次排序）。它不是回血卡：不回核心、不修复/重装部件，只提高生命上限，属于结构构筑项。若评审不接受新增内容，见 §8 备选。

> **利维坦流（08 §3.4.7）**：不是专属升级链。玩家持续叠通用机翼/发动机/武器部件，会自然形成多翼多发的重型平台；`UPGRADES` 需要允许同类部件按挂点/`max` 持续叠加，并继续满足本节“任意等级候选 ≥3 且不重复”的兜底。机体对重装的收益/代价由 11 的 `Airframe.refit` 字段表达，不在升级池里单开一条线。

### 3.6 数值基线表（全部“基线可调”）

| 参数 | 基线值 | 配置位置 |
| --- | ---: | --- |
| 血瓶场上上限（小 + 大） | 3 | `data/pickups.ts` `HEALTH_SUPPLY.fieldCap` |
| 首次刷新延迟 | 8–12 秒 | `HEALTH_SUPPLY.firstDelay` |
| 基础刷新间隔 | 18–26 秒 | `HEALTH_SUPPLY.interval` |
| 低血量（<45%）间隔系数 | ×0.55 | `HEALTH_SUPPLY.lowFactor` |
| 危险血量（<25%）间隔系数 / 下限 | ×0.35 / 6 秒 | `criticalFactor` / `minInterval` |
| 危险血量保底计时 | ≤4 秒 | `pityDelay` |
| 满场上限重试 | 2 秒 | `capRetry` |
| 小/大血瓶治疗量（占核心上限） | 15% / 35% | `PICKUP.healthSmall.healRatio` 等 |
| 刷新方位（相对航向） | ±2.2 rad | `HEALTH_SUPPLY.bearingMax` |
| 刷新距离（小 / 大） | 12–22 / 18–28 | `HEALTH_SUPPLY.smallDistance/largeDistance` |
| 大血瓶概率（常态 / <50% 生命） | 25% / 40% | `largeChance` / `largeChanceLow` |
| 血瓶寿命 | 26 秒（最后 3 秒闪烁） | `PICKUP.*.life` |
| 血瓶拾取半径 / 磁吸半径 | 2.0 / 3.6 | `PICKUP.*.pickupRadius/magnetRadius` |
| 满血转换金币（小 / 大） | +2 / +5 | `PICKUP.*.coinValue` |
| 血瓶经验（小 / 大，仅实际治疗时） | 15 / 35 | `PICKUP.*.xp` |
| 精英修复包：核心 / 未脱落部件 | +30% / +25% | `PICKUP.repairKit` |
| 精英修复包经验 / 寿命 / 场上上限 | 100 / 28 秒 / 2 | `PICKUP.repairKit` |
| 修复包重装已脱落部件 | **否** | 逻辑约束，不做配置 |
| 对象池容量 | 56（不变） | `RULES.maxPickups`（`config.ts:10`） |

治疗量随核心上限缩放，四架机体计算值：小血瓶 11/15/22/35，大血瓶 26/35/51/81（Wasp 75 / Swift 100 / Courier 145 / Mastodon 230）。基线期望：每瓶平均 `0.75×15% + 0.25×35% = 20%` 核心上限，基础节奏约 2.7 瓶/分钟；全部拾取的理论上限约 54% 核心/分钟，实际受航线与 26 秒寿命折损，设计目标是不高于旧维修抽卡、但不再占用升级位。**以上全部为基线值，可调；调整时同步更新 §7 的测试断言。**

### 3.7 接口与伪代码

```ts
// src/simulation/types.ts（替换 138-146）
export type PickupKind = "coin" | "healthSmall" | "healthLarge" | "repairKit";
export interface Pickup {
  active: boolean; x: number; z: number;
  kind: PickupKind; value: number; xp: number; life: number;
}
// Effect.kind 追加 "heal"（types.ts:155）

// src/data/pickups.ts（新增）
export interface PickupSpec {
  healRatio: number; coinValue: number; xp: number; life: number;
  magnetRadius: number; pickupRadius: number; partHealRatio?: number;
}
export const PICKUP: Record<PickupKind, PickupSpec> = {
  coin:        { healRatio: 0,    coinValue: 1, xp: 9,   life: 28, magnetRadius: 5.2, pickupRadius: 1.6 },
  healthSmall: { healRatio: 0.15, coinValue: 2, xp: 15,  life: 26, magnetRadius: 3.6, pickupRadius: 2.0 },
  healthLarge: { healRatio: 0.35, coinValue: 5, xp: 35,  life: 26, magnetRadius: 3.6, pickupRadius: 2.0 },
  repairKit:   { healRatio: 0.30, coinValue: 0, xp: 100, life: 28, magnetRadius: 5.2, pickupRadius: 2.0,
                 partHealRatio: 0.25 },
};
export const HEALTH_SUPPLY = { firstDelay: [8, 12], interval: [18, 26], low: 0.45, lowFactor: 0.55,
  critical: 0.25, criticalFactor: 0.35, minInterval: 6, pityDelay: 4, capRetry: 2, fieldCap: 3,
  bearingMax: 2.2, smallDistance: [12, 22], largeDistance: [18, 28], largeChance: 0.25,
  largeChanceLow: 0.4, lowChanceThreshold: 0.5 } as const;

// World：生成（新增，供 updatePickupSupply 调用；public 便于测试）
spawnHealthPickup(kind: "healthSmall" | "healthLarge") {
  const p = this.player;
  const bearing = p.heading + this.random.range(-HEALTH_SUPPLY.bearingMax, HEALTH_SUPPLY.bearingMax);
  const [min, max] = kind === "healthLarge" ? HEALTH_SUPPLY.largeDistance : HEALTH_SUPPLY.smallDistance;
  const d = this.random.range(min, max);
  this.spawnPickup(kind, p.x + Math.sin(bearing) * d, p.z + Math.cos(bearing) * d);
  this.telemetry.record(this.elapsed, "health_pickup_spawn", { kind, distance: d });
}

// World：拾取分支（替换 updatePickups 1052-1061 的命中处理）
const spec = PICKUP[c.kind];
if (d < spec.magnetRadius) { /* 现有吸附公式，半径改用 spec.magnetRadius */ }
if (d < spec.pickupRadius) {
  c.active = false;
  if (c.kind === "coin") this.collectCoin(c);              // 原 1054-1060 逻辑不变
  else if (c.kind === "repairKit") this.collectRepairKit(c);
  else this.collectHealth(c);
}

// World：治疗与修复（拆分原 repair()；维修升级删除后仅补给调用）
private healCore(amount: number) {
  const p = this.player;
  p.health = Math.min(p.stats.health, p.health + amount);
  const core = p.parts.find((part) => part.id === "core");
  if (core) { core.maxHealth = p.stats.health; core.health = p.health; }
}
private repair(coreRatio: number, partRatio: number) {
  this.healCore(this.player.stats.health * coreRatio);
  for (const part of this.player.parts) {
    if (part.destroyed || part.id === "core") continue;       // 永不重装；核心不重复加成
    part.health = Math.min(part.maxHealth, part.health + part.maxHealth * partRatio);
  }
}
```

`collectHealth` 的核心判断：`missing = stats.health - health`；`missing <= 0` 走满血转金币（加金币与积分、播 `coin` 音效、不查经验）；否则 `healCore(min(missing, stats.health * spec.healRatio))`、`awardXp(spec.xp)`、`healPulse = 0.35`、`effect(..., "heal")`、`message(...)`、`telemetry.record(..., "pickup_health", { kind, amount })`。

### 3.8 视觉、音效与提示

- **造型**：低模瓶 = 8 边圆柱瓶身 + 瓶颈 + 瓶盖，正面/背面各一块薄盒十字；小瓶珊瑚红 `#f2705e`，大瓶深珊瑚 `#e4503f`、瓶盖金色 `#f6d778`，十字奶油白 `#ffe9d2` 自发光。新增两枚 InstancedMesh（瓶身、十字）+ `instanceColor` 区分大小；血瓶不再复用金币网格，现有 `repairs` 网格改名给修复包；血瓶全部失效时 `count = 0`。
- **浮沉与旋转**：`y = 4 + sin(time * 1.6 + x * 0.7) * 0.18`，绕 Y 轴 0.8 rad/s（金币为 2 rad/s，慢一倍便于读十字）；小瓶 scale 1.0、大瓶 1.35；最后 3 秒按 2Hz 缩放闪烁。
- **音效**：`GameAudio.play` 增加 `"heal"`（音色 `[520, 880, 0.22]`，正弦，`Audio.ts:15-34`）；血瓶播放 `heal`，满血转换沿用 `coin`；轻振动 15ms 仅在实际治疗时触发。
- **HUD**：`GameApp.updateHud` 读取 `world.healPulse`，给 `.health-block` 加 0.35 秒 `healing` CSS 动画（珊瑚色描边 + 血条提亮）；现有 `<30%` 的 `.low-health` 暗角（`GameApp.ts:344`）不变。
- **不新增边缘箭头**：血瓶不进入 05 的威胁边缘指示队列，避免与敌机告警混淆；低血量引导依赖场内发光、HUD 闪烁与 26 秒寿命闪烁。
- **帮助页**：`GameApp.ts:477` 增加一句“珊瑚色补给恢复机体生命；绿色维修包修复受损部件，不重装已脱落部件”。

### 3.9 与 05 事件总线对接

05 已定义只读 `World.events`（见 `docs/changes/05-radar-alert-and-target-feedback.md` §3.1），其中已有 `pickup` 事件（`kind: "coin" | "repair"`，埋点 `World.ts:1052-1061`，重构后移到 `collectPickup`），并注明「与 01 共享、05 不改变拾取规则」。本文件沿用该事件，**不新增事件名**，只做以下扩展：

| 项目 | 约定 |
| --- | --- |
| 事件 | 复用 05 的 `pickup`；`kind` 由 `"coin" \| "repair"` 扩为 `PickupKind`（`coin / healthSmall / healthLarge / repairKit`，05 的 `"repair"` 即本文件的 `repairKit`） |
| 追加字段 | `heal?: number`（实际治疗量）、`full?: boolean`（满血转金币）、`coins?: number`（转换所得金币） |
| 发出时机 | 拾取结算完成后；事件不参与判定、不消耗随机数，符合 05 的只读约定 |
| 消费 | `health*` 且未满血 → `heal` 音效 + HUD 闪烁 + 治疗提示；满血 → `coin` 音效 + 满血提示；`repairKit` → `heal` 音效 + 修复包提示；金币仍由现有逻辑消费 |
| 不阻塞 | 01 与 05 同为 Wave 1：01 先在 `World` 加 `healPulse`（0.35 秒，模式同 `lockPulse`，`World.ts:125`），`GameApp` 先读它；05 落地后删除 `healPulse/lastHeal`，只消费 `pickup` 事件 |

若 05 评审决定保留 `kind: "coin" | "repair"` 不扩展，则 01 实施时必须同步改 05 的事件类型（两份文档都已声明该共享关系），不允许出现两套拾取事件。

## 4. 改动清单（文件级）

| 文件 | 改动 | 关键符号 / 行 |
| --- | --- | --- |
| `src/data/pickups.ts` | 新增：`PickupSpec`、`PICKUP`、`HEALTH_SUPPLY` | 全文件 |
| `src/simulation/types.ts` | `Pickup` 改 kind 结构；新增 `PickupKind`；`Effect.kind` 加 `"heal"`；与 05 合并扩展 `WorldEvent.pickup` 的 kind/字段 | 138-146、155；05 的 `WorldEvent` 定义 |
| `src/simulation/World.ts` | 池初始化、构造选项 `supply`、`updatePickupSupply`、`spawnHealthPickup`、typed `spawnPickup`、`collectPickup/collectHealth/collectRepairKit`、`healCore`、拆分 `repair`、`healPulse`、导演金币块迁移、精英掉落改 `repairKit`、删维修权重/安装分支、删重复安装的 `existing.destroyed = false`（1184） | 54-56、88-96、133-137、232-233、371-372、446-511、987-997、1031-1063、1116-1136、1174-1187、1234、1242-1255 |
| `src/data/upgrades.ts` | 删 `repair?` 字段与维修条目；新增 `armor_belt` | 26、321-333、末尾 |
| `src/app/GameApp.ts` | 删维修比较分支；新增 `lastHeal` 与音效/HUD 闪烁；帮助页补一句 | 245-246、344-350、414-415、477 |
| `src/rendering/Renderer.ts` | `repairs` → `repairKits`；新增血瓶瓶身/十字实例网格与逐帧更新/清零；`"heal"` 特效颜色 | 33-34、126-147、640-660、672-678、791-792 |
| `src/services/Audio.ts` | `heal` 音色与振动 | 15、27-34、51-52 |
| `src/style.css` | `.health-block.healing` 动画 | 938 附近 |
| 基线文档（实施后同步） | `docs/systems/05:46,98,142`、`docs/content/INITIAL_UPGRADES.md:19,418-419`、`docs/systems/02:211-219`、`docs/IMPLEMENTATION.md:38,59` | 本文件不改 |

## 5. 实现任务拆分

| # | 任务 | 规模 | 依赖 |
| --- | --- | --- | --- |
| T1 | 数据层：`data/pickups.ts`；`types.ts` 的 `PickupKind/Pickup/Effect`；`upgrades.ts` 删维修、加 `armor_belt` | S | — |
| T2 | 模拟层血瓶：`supply` 选项、`updatePickupSupply`、`spawnHealthPickup`、typed `spawnPickup`、`collectHealth`、`healCore`、`healPulse`、telemetry | M | T1 |
| T3 | 模拟层维修清理：权重/tag/安装分支删除、`repair` 拆分去重装、精英改 `repairKit`、删重复安装 `destroyed=false` | S | T1 |
| T4 | 渲染：血瓶双 InstancedMesh、`repairKits` 改名、`heal` 特效、寿命闪烁、清零 | S | T1, T2 |
| T5 | UI/音频：`upgradeComparison` 清理、HUD 闪烁、`heal` 音效、帮助文案 | S | T2 |
| T6 | 测试改写与新增（§7） | M | T2-T5 |
| T7 | 平衡与真机：按表调间隔/治疗；确认低血量节奏、弱磁吸手感、draw call 增量；截图归档 | L | T6 |

T4 与 T5 可在 T2 完成后并行；T7 至少覆盖 4 架机体各一局 3 分钟。

## 6. 验收标准

**自动断言（固定种子）**

- `UPGRADES` 中不存在 `id === "repair"`，也不存在 `repair` 字段；任意等级、任意种子 `openUpgrades()` 的 `choices` 都不含维修。
- 任意状态下 `choices.length === 3` 且 id 不重复；安装完所有唯一升级后仍为 3 项，且 id ∈ `{ammo, cooler, armor_belt}`。
- 120 秒不拾取时血瓶生成数在 4–8 个；任意帧活动血瓶 ≤3；生成距离 12–28、相对方位 ≤±2.2 rad。
- 同种子、持续清空场上血瓶（模拟全部拾取）时，低血量（<25%）60 秒的生成数 ≥ 满血 60 秒的 1.5 倍；场上无血瓶时 ≤4 秒内出现保底瓶。
- 满血拾取：金币 +2/+5、经验不变、生命不变、拾取物失活；部分受伤：治疗量 = `min(缺失, 上限×15%/35%)`，不溢出。
- 血瓶不改变核心以外任何部件的 `health/destroyed`（核心仅作 `player.health` 镜像同步）；精英修复包只恢复未脱落部件，`destroyed` 保持 `true`。
- 寿命 26 秒回收；血量低于磁吸阈值不移动、进入拾取半径被吃掉。
- 全部测试与 `npm run build`（严格 TS）通过；无新增每帧对象分配（复用池与实例网格）。

**真机 / 截图**

- 360×640 与 430×932：珊瑚十字血瓶在天空/地面/云背景下可辨认；低血量时刷新加快、HUD 闪烁与 `heal` 音效清晰。
- 升级面板三张卡无维修卡、无空位；`armor_belt` 比较行显示“生命 N → N+12”。
- 标准档渲染绘制调用增量 ≤3（血瓶瓶身、十字、修复包改名不增），低端机 30 FPS 不退化（D10）。

## 7. 测试与兼容

**需要改写的现有测试（`tests/simulation.test.ts`）**

| 位置 | 现状 | 改法 |
| --- | --- | --- |
| 246-257 | 安装 `repair` 升级验证 20→60 并重装 `right_wing` | 删除；替换为“精英修复包修复未脱落部件、不重装”与“血瓶只回核心”两个用例 |
| 213-220 | 末期候选全为 `max===999` | 期望值改为 3 项且 id ∈ `{ammo, cooler, armor_belt}`，并断言不含维修 |
| 198-212 | 三选一合法池 | 追加“20 个种子 × 开局/中期/末期均无维修”断言 |
| 298-349 | 五分钟耐久 | 保持 `peak < 250`；追加“拾取的升级不含 repair”“血瓶生成/拾取 telemetry 有记录” |
| `tests/controls.test.ts`、`tests/flight-dynamics.test.ts` | 无 pickup/维修引用（已核对） | 不改 |

**新增测试（建议放 `tests/simulation.test.ts` 或新 `tests/pickups.test.ts`）**

1. 升级池永不含维修（`UPGRADES` 数据断言 + `openUpgrades` 多种子断言）。
2. 三选一满员与末期兜底（见上表）。
3. 血瓶生成节奏：同种子、每帧清空场上血瓶（模拟拾取）时，满血 vs <25% 的 60 秒生成计数（期望后者 ≥1.5 倍）；保底 ≤4 秒。
4. 场上上限与寿命：连续 120 秒（不拾取）活动血瓶始终 ≤3，超时失活。
5. 生成位置：距离 12–28、相对方位 ±2.2 rad。
6. 满血转换与部分治疗 clamp；经验只在治疗时增加。
7. 血瓶不修复部件；精英修复包修复未脱落部件但不重装。
8. 弱磁吸：4.0 距离血瓶不动、2.5 距离被吸；金币 4.0 仍被吸。
9. 确定性：同种子在 30/60/120 FPS 下血瓶种类/位置/顺序一致（复用现有确定性测试模式，`tests/simulation.test.ts:41-53`）。

**存档与兼容（D9）**：`SaveData` 无字段变化，`version` 不升级；`player.upgrades` 是局内运行时数组，旧存档不包含升级 id，删除 `repair` 不影响读取与迁移。局外金币来自 `world.coins`，满血转换会增加金币，属预期内的少量经济变化，结算页无需改字段。

**与其他文档的接口**

- **03 部件损毁**：`repair()` 的“不重装”建立在 `Part.destroyed` 语义上；03 统一 `PartRole/PartDamageState` 后，修复包只处理非 `destroyed` 部件（含 disabled），血瓶仍只碰核心。部件重装留给 03 或系统文档 05（升级系统）评估的显式重装升级。
- **04 双区油门**：无直接耦合；但 D4 改变普通油门能耗后战斗时长与受伤分布会变，血瓶间隔需在 T7 重新校对。
- **05 事件/提示**：见 §3.9，复用并扩展 05 的 `pickup` 事件；01 用 `healPulse` 过渡，05 落地后切事件消费，不重复维护两套提示。
- **04/05 音频合并**：`GameAudio.play` 的联合类型会被 01（`heal`）、04（`boost_*`）、05（`alert/kill/part`）同时扩展，合并时取并集并各加音色；`Audio.ts:15`、`:27-34` 行号会漂移，实施按符号名定位。
- **02 导演**：血瓶计时独立于敌人导演，02 重构 `updateDirector` 时不要合并这段逻辑。

## 8. 待确认与备选

| # | 问题 | 推荐 | 备选与影响 |
| --- | --- | --- | --- |
| 1 | 精英维修补给保留还是完全移除？ | 保留为“部件修复包”，只修未脱落部件（§3.4） | 改为大型血瓶：最简单但部件损耗永久化压力过大；完全移除：需 03 另给补偿渠道 |
| 2 | 血瓶是否修复部件？ | 只回核心；修复包是唯一例外且不重装 | 大血瓶额外修复未脱落部件 10%：会削弱 03 的损毁压力，仅在真机测试“部件永久化过重”时启用 |
| 3 | 是否自动磁吸？ | 弱磁吸 3.6（金币 5.2），兼顾单手可拾取与航线选择 | 无磁吸 + 拾取半径 2.4：更强调飞行路线，但 360×640 单手可能挫败；与金币同 5.2：过于宽松 |
| 4 | 三选一兜底需要新增 `armor_belt` 吗？ | 需要，否则末期只有 2 项，违反 00-overview 验收“三选一满员” | 允许候选 <3 时显示 2 项（不推荐，破坏 `docs/systems/05` 的三不重复约定）；或把有限升级改 `max:999`（不推荐，数值膨胀） |
| 5 | 低血量保底刷新是否过强？ | 保留保底但只限 <25%，由 T7 真机确认 | 若过强，去掉保底只保留间隔加速，可调 `pityDelay` 或直接关闭 |
| 6 | 血瓶是否给经验？ | 实际治疗时给，满血转换不给 | 拾取即给：会鼓励满血刷瓶；完全不给：补给对成长无正反馈 |

**与 00-overview 的偏差说明**：新增 `armor_belt` 是需求 #2 的必要配套（维持“三选一满员”验收），不在总览需求映射中，已在 §3.5 与 §8 标注待评审确认；其余设计（D1 部件语义、D4 无耦合、D9 无存档变化、D11 测试要求）均与共享决策一致，无冲突。
