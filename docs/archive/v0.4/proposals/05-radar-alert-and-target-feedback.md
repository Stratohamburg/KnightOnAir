# 05 · 雷达告警、边缘指示与击毁反馈

> 状态：提案（**未实施**，本文档不修改源码、测试与基线文档）
> 基线版本：0.3.0（提交 `5b22187`）；行号以该提交为准，实施时以符号名为主
> 需求映射：00-overview 第 8 项「不画敌人瞄准线；开火时雷达样式告警」（P0）、第 12 项「边缘镜头指向敌机、摧毁目标反馈」（P1，依赖 02/03）
> 约束决策：**D5（本文核心）**，并遵守 D3、D9、D10、D11；与 00-overview 无冲突
> 影响文件：`src/simulation/types.ts`、`src/simulation/World.ts`、`src/app/GameApp.ts`、`src/rendering/Renderer.ts`、`src/style.css`、`src/ui/icons.ts`、`tests/*`

## 1. 问题与现状

### 1.1 敌方瞄准线：数量、信息与语义三重问题

现在的敌人预警全部是**世界空间连线 + 地面落点圈**，没有任何屏幕空间告警：

- `Renderer` 为每个敌人各准备一条 `warningLines: THREE.Line`，池大小 `RULES.maxEnemies + RULES.maxGround = 38`（`src/rendering/Renderer.ts:41`、`:224-243`；池基于 `src/data/config.ts:7-8`）。
- `updateBattle` 里只要 `e.warning > 0`，就从敌人画到 `aimX/aimZ`（`src/rendering/Renderer.ts:605-613`）；地面敌人同时显示 `groundMarkers` 圈（`:599-604`）。
- `World` 在开火前留 0.7s（地面 0.8s，导弹车 1.3s）的 `warning` 计时，开火瞬间清 0（`src/simulation/World.ts:636-645`），`aimX/aimZ` 是玩家预测位置 `p.x + p.vx * 0.35`（`:639-640`）。

问题有三层：

1. **线太多**：一批敌人同时蓄力时会画出多条线 + 多个落点圈，再叠加玩家锁定扇形 `lockFan`、目标环 `targetRing`、锁定/瞄准文字标签与敌人名牌；D3 上限收紧后同屏仍有最多 14 个活动敌人，线状元素是画面最噪的一层。
2. **提前泄露精确落点**：连线精确指向 0.35s 后的预测落点，等于把「该往哪躲」直接画在屏幕上，回避动作退化成看线挪杆；也让敌人威胁从「压力」变成「谜底」。
3. **与玩家辅助混淆**：玩家自己的锁定扇形/目标环是蓝绿色（`src/rendering/Renderer.ts:170-195`），敌方线是暖橙色（`:232-239`），但形状语义都是「线/扇形/环」，单手小屏下玩家会把所有线读成「我被锁了」；同时线状激光也不符合 08 的低模年代感。

### 1.2 预警信息碎片化

- 敌人攻击预警只靠名牌下一行 7px 文字「攻击预警」（`src/app/GameApp.ts:362`，样式 `src/style.css:881-887`），没有方向、距离、数量，且被名牌/血条挤在屏幕内。
- 屏幕外威胁只有一个**固定位置**的竖排小字 `edge-warning`（右边缘、`top: 30%`、文字「‹/› 空中目标接近」，`src/app/GameApp.ts:376-384`；`src/style.css:903-911`）。它只取 `enemies.find(...)` 的第一个命中项（无排序），不区分优先级、不显示方位/距离/类型；威胁在左侧时也只能读到一个 `‹`。
- 结果：玩家知道「有东西要打我」，但不知道「谁、在哪、多远、还有多久」。

### 1.3 击毁反馈不足

- `damageEnemy` 击毁时加分、加经验、掉金币、生成 explosion effect（`src/simulation/World.ts:968-999`），但玩家侧只有底部 8px 计数「击毁 N / 金币 M」（`src/app/GameApp.ts:282`）。
- 命中只有世界空间火花（`src/simulation/World.ts:972-973`），**无命中标记**；**无击毁信息条/击杀流水**；无屏幕震动（相机固定参数见 `src/rendering/Renderer.ts:496-517`）；连击只是在状态栏里换数字（`src/app/GameApp.ts:283`）。
- 部件被打掉只改 `part.destroyed`（`src/simulation/World.ts:943-946`）与冒烟（`src/rendering/Renderer.ts:755-782`），没有任何文字/音效提示；精英击毁用通用播报 `World.message`（`:996`），和升级、投弹播报抢同一个 `battle-announcement` 位置。

### 1.4 与基线文档的冲突（实施后需同步）

| 基线文档 | 现有描述 | 05 落地后的口径 |
| --- | --- | --- |
| `docs/systems/04-enemies-battlefield.md:15`、`:72` | 「地面防空炮的红色预警线」「通过瞄准线影响航线」 | 删除瞄准线；改为雷达扇区 + 屏幕方向脉冲 |
| `docs/content/INITIAL_ENEMIES.md:182` | 「先用红色瞄准线追踪玩家」 | 改述为雷达告警 + 边缘指示 |
| `docs/GAME_DESIGN.md:425` | 「预警圈、激光指示或弹道虚线」 | 只保留雷达/边缘提示；地面落点圈见 §8 待确认 |

## 2. 目标体验

一句话：**不知道线在哪，但永远知道威胁从哪来。**

1. **不开火就没有敌方线**：屏幕上不再出现任何敌人画的连线；敌人的蓄力只存在于模拟内部，不再被画出来。
2. **告警走雷达语言**：左下角常驻小雷达盘，玩家居中、范围 60 单位；敌人是光点。谁开火，对应方位的扇区就闪一下，同时屏幕对应边缘泛一道方向脉冲，配短促告警音与轻振动。
3. **屏幕外有箭头**：最多 4 个安全区边缘箭头指向屏幕外空中目标，带方位、距离、类型；正在开火的优先，进入屏幕内 0.15s 内淡出。
4. **击毁看得见**：命中标记 → 击杀信息条（类型 + 分数 + 掉落）→ 解体/爆炸/碎片 → 短促震动 → 音效/连击；部件击毁单独播报（如「右翼脱落」），与 03 的部件视觉同一事件源。
5. **不干扰操作**：雷达与箭头不进入操控区、不遮挡摇杆/按钮，全部 `pointer-events: none`；全部表现可被 reduce-motion 与音效开关降级。

设计原则：**事件驱动（表现层不读敌人内部状态）→ 屏幕空间表达（不画世界线）→ 有上限、可节流、可降级。**

## 3. 目标设计

### 3.1 事件总线（D5 落地）

**原则**：`World` 是唯一事实来源，新增只读事件队列 `events: WorldEvent[]`；表现层（`GameApp`）只消费事件，不再读 `e.warning`、`e.aimX/e.aimZ` 做提示。事件**不参与模拟判定、不消耗随机数**（保证 D11 的确定性测试不受影响），也不写入存档（D9）。

```ts
// src/simulation/types.ts —— 新增（PartRole 来自 03/D1，未合并前用 string 占位）
export type WorldEvent =
  | { type: "enemy_fire"; id: number; time: number; enemyId: number; kind: string;
      layer: "air" | "ground"; x: number; z: number; heading: number;
      aimX: number; aimZ: number; count: number; threat: "bullet" | "flak" | "missile" }
  | { type: "missile_lock_warning"; id: number; time: number; enemyId: number;
      x: number; z: number; heading: number; life: number }
  | { type: "enemy_hit"; id: number; time: number; enemyId: number; kind: string;
      layer: "air" | "ground"; x: number; z: number; damage: number; killed: boolean }
  | { type: "enemy_destroyed"; id: number; time: number; enemyId: number; kind: string;
      layer: "air" | "ground"; x: number; z: number; score: number; coins: number;
      combo: number; cause: "bullet" | "missile" | "bomb" | "fire" | "ram" }
  | { type: "part_destroyed"; id: number; time: number; owner: "player" | "enemy";
      ownerId: number; ownerKind: string; partId: string; role: string; side: -1 | 0 | 1;
      label: string; x: number; z: number; detachable: boolean }
  | { type: "player_hit"; id: number; time: number; amount: number; x: number; z: number;
      source: string; partId: string; healthRatio: number }
  | { type: "ground_attack"; id: number; time: number; enemyId: number; kind: string;
      x: number; z: number; aimX: number; aimZ: number; count: number }
  | { type: "pickup"; id: number; time: number; kind: "coin" | "repair";
      value: number; xp: number; x: number; z: number };

export type ThreatAlert = "firing" | "chasing" | "other";
export interface ThreatView { // 只读表现 DTO，由 World 复用预分配对象填充
  id: number; kind: string; layer: "air" | "ground"; elite: boolean;
  x: number; z: number; bearing: number; headingRel: number; dist: number;
  alert: ThreatAlert;
}
```

事件表（基线可调）：

| 事件 | 触发点（0.3.0 代码位置） | 关键字段 | 主要消费 |
| --- | --- | --- | --- |
| `enemy_fire` | 开火瞬间，`World.ts:645-671` | `enemyId/kind/layer/heading/aimX/aimZ/count/threat` | 雷达扇区闪烁、方向脉冲、告警音、振动 |
| `missile_lock_warning` | 追踪弹发射，`World.ts:662-665`（`homing > 0`） | `enemyId/heading/life` | 导弹专属雷达标记、低频告警音 |
| `enemy_hit` | `damageEnemy` 入口，`World.ts:968-973` | `enemyId/layer/damage/killed` | 命中标记（killed 决定大/小标记） |
| `enemy_destroyed` | `World.ts:974-998`（核心生命归零） | `kind/layer/score/coins/combo/cause` | 击毁信息条、震动、音效、解体/爆炸编排 |
| `part_destroyed` | 部件生命归零，玩家 `World.ts:943-946`；敌人由 03 新增等价处 | `owner/ownerId/ownerKind/partId/role/side/label/x/z/detachable`（03 §3.6.4 为权威 payload） | 部件提示（「右翼脱落」）、03 脱落视觉联动 |
| `player_hit` | `damagePlayer`，`World.ts:922-967` | `amount/source/partId/healthRatio` | 方向受击脉冲、震动、音效 |
| `ground_attack` | 地面敌人开火，`World.ts:645-671`（`layer === "ground"` 分支） | `enemyId/kind/aimX/aimZ/count` | 雷达方形光点闪烁、地面方向脉冲 |
| `pickup` | 拾取生效，`World.ts:1052-1061` | `kind/value/xp` | 轻提示（与 01 共享，05 只做可选反馈） |

说明：

- 事件名以 D5 为准：需求描述里的 `missile_warning` 即本表的 `missile_lock_warning`，实施时只保留 D5 命名。`enemy_hit`、`pickup` 是 D5「至少包括」之外的扩展，均有明确消费方。
- **导演/生成扩展事件（02 使用）**：`wave_started`、`elite_incoming`、`enemy_spawn`、`enemy_recalled`、`spawn_dropped`、`elite_deferred` 并入同一 `World.events` 队列；本表只定“表现消费的事件”，02 负责产生时机与字段，`elite_incoming` 用于雷达/边缘指示的预提示。06 的地面开火统一使用本表的 `ground_attack`，不存在 `ground_fire` 别名。
- 世界时间 `time` 取 `this.elapsed`；`id` 为 World 内单调自增（不进存档）。
- **队列生命周期**：每渲染帧清空一次，位置在 `World.frame()` 入口（`src/simulation/World.ts:342`），即一帧内最多 8 个固定步（`RULES.maxSteps`）产生的事件都保留到本帧结束；队列上限 64 条（超出丢最旧），避免极端爆炸链导致数组增长。`timeScale === 0`（暂停/升级）时 `frame()` 提前返回，**不产生也不累积**事件。
- **只读约定**：`readonly events` 由 World 单方写入；`GameApp` 只读，不 splice。表现层需要的持续状态（信息条、震动、箭头池）由自己维护生命周期，事件只作为「触发」。
- **位置/优先级数据**走 `World.threats(): readonly ThreatView[]`（预分配、每步原地更新，不每帧 new）。它只含表现所需字段（方位、距离、警报等级），不含 `warning/aimX/aimZ`；原因：`warning/aimX/aimZ` 是模拟私有量且会被 02/03 改动，表现层直接读会把 HUD 与内部实现绑死、也无法单测。这是 D5「不直接读敌人内部状态」的落地方式，也让 02 改刷新、03 改部件时 HUD 无需改代码。
- 警报等级在模拟侧判定，保证可测：`firing` = 最近 2.0s 内开过火（`fireUntil = elapsed + 2`）或有追踪弹在飞；`chasing` = `state === "attacking"` 且 `dist < 35`；其余 `other`。

消费流程（伪代码，`GameApp.loop` 内，现循环见 `src/app/GameApp.ts:732-741`）：

```ts
this.world.frame(dt, this.stick.read(dt));
this.combatHud.consume(this.world.events);        // 即时反馈：音效/振动/扇区闪烁/信息条队列
this.renderer?.render(this.world, dt, { display: false });
this.combatHud.update(this.world.threats(), (x, z) => this.renderer!.project(x, 4, z), dt);
if (this.hudTimer > 0.09) { this.updateHud(); this.hudTimer = 0; }
```

`Renderer` 不再消费事件（它只负责 3D 场景；信息条、雷达、箭头、震动都是 DOM，由 `GameApp` 持有）。这样事件只有单一消费者，避免「谁先读谁清空」的歧义。

### 3.2 雷达告警

**布局**：常驻小雷达盘放在**战斗区左下角**——竖屏单手时右手拇指在下方操控区，左下是离拇指最远的战斗区角落，且不压住摇杆上沿的升级/轰炸按钮路径。新增一个只覆盖战斗区的 DOM 层：

| 元素 | 位置 / 尺寸（基线可调） | 说明 |
| --- | --- | --- |
| `.combat-hud` 层 | `position:absolute; inset:0; bottom: var(--deck)`；`z-index:2`、`pointer-events:none` | 与 `.in-battle .world-labels` 同边界（`style.css:925-927`），`--deck = clamp(218px, 32.5dvh, 300px)`（`:12`），天然不进入操控区（`:1067`）；插入在 `.ui-layer` 之前，若与顶部 HUD 叠压则把 `.battle-top`/`.control-deck` 提到 `z-index:3` |
| 雷达盘 | 直径 `clamp(64px, 20vw, 92px)`（360 宽 → 72px）；`left: calc(12px + env(safe-area-inset-left))`；`bottom: 10px`（控制区已含底部安全区，战斗区底边即 `--deck` 上沿） | 圆形深色半透明底 + 3 圈刻度（20/40/60 单位）+ 十字线 + 玩家居中标记 |
| 扫描线 | 60° 楔形，3.2s/圈；低画质与 reduce-motion 下静止 | CSS 变换驱动，不占 JS 帧 |
| 底部信息行 | `.battle-status` 让位到雷达右侧：`left: calc(12px + clamp(64px,20vw,92px) + 12px)`，`bottom: 12px`（`style.css:1052-1066` 调整） | 现「击毁/金币 · 连击 · 风」继续复用，8px 字号 |
| 击毁信息条 | `right: calc(12px + env(safe-area-inset-right))`；`top: calc(64px + env(safe-area-inset-top))`；宽 150px，最多 3 行 | 右上角、暂停键下方；不与安全区箭头（top ≥ 124px）重叠 |

```text
┌─ 战斗区（scene-host 高 = 100% − deck，style.css:912-914）──────────┐
│ [机体/能量]              [计时·得分]                    [暂停]      │
│ [XP 条]                                                           │
│              [播报 battle-announcement]                           │
│   ┌ 安全区矩形（边缘箭头上限 4）────────────────────┐             │
│   │                                                │             │
│   └────────────────────────────────────────────────┘             │
│ ┌雷达┐  击毁 3 · 金币 12   连击 ×1.2   ↗ 微风                     │
└─┴────┴───────────────────────────────────────────────────────────┘
│ 控制区（--deck，摇杆/升级/轰炸/投弹）                              │
```

**坐标与范围**：
- 玩家在盘中心；范围 `RADAR_RANGE = 60`（D5）；敌人相对玩家的方位角 `bearing = atan2(ex - px, ez - pz) - player.heading`（0 = 正前 = 盘上方），距离 `dist`。
- 映射 `f = min(1, dist / 60)`、`r = (size/2 - 6) * f`、`px = sin(bearing) * r`、`py = -cos(bearing) * r`；`dist > 60` 的接触钳在盘沿并降透明度（提示「在范围外」）。D3 的刷新距离 34–46 落在 `f = 0.57–0.77`，新接触会从盘沿内侧出现。
- 光点形状与颜色**双编码**（色弱可读）：空中 = 4px 三角箭头（朝向 `headingRel`），地面 = 4px 方块，导弹/精英 = 菱形 + 外环；常规色 `#e8e9d9`（奶油白），威胁/开火 `#ef8864`（珊瑚橙），精英 `#f5d887`，玩家中心 `#c8e5c1`（青绿）。开火时的扇区用**加粗描边 + 形状脉冲**而不只靠颜色区分。

**开火瞬间的四段告警**（`enemy_fire` / `ground_attack` / `missile_lock_warning`）：

1. **扇区闪烁**：以 `bearing` 为中心画 26° 楔形，红色告警（取 D8 珊瑚橙 `#ef8864`，严格按 D5 字面时用 `#e25b45`），0.45s 由 0.55 透明度衰减到 0；同方位 250ms 内多次开火合并为一次更强闪烁。
2. **方向脉冲**：屏幕对应方向的安全区边缘出现一道 0.3s 的红色渐变光带（同上色值）（上/下/左/右各一个固定 DOM，取最大强度，不叠加）；来自屏幕外的地面火力同样有脉冲，但不占箭头名额（§3.3）。
3. **音效**：新增 `alert` 音色（与拾取/命中区分），同屏多威胁时音高上移一级；全局 250ms 去重、单敌人 600ms 去重。
4. **振动**：`navigator.vibrate(18)`；仅当威胁距离 < 35 且朝玩家开火，全局 500ms 去重；受现有「触觉反馈」开关控制（`src/app/GameApp.ts:645-648`、`src/services/Audio.ts:3`）。

**不遮挡原则**：整层 `pointer-events:none`；盘底距操控区上沿仅 10px，但层级在 `--deck` 之上；暂停/升级弹层（`.overlay-layer`，`z-index:5`）覆盖时不更新雷达（循环本身停止调用）。雷达 `role="img"`，`aria-label` 以 ≤1Hz 更新「雷达：N 个接触」；光点本身 `aria-hidden`。

### 3.3 边缘指示

**规则**：

| 项 | 规则（基线可调） |
| --- | --- |
| 对象 | **仅离屏空中目标**（`layer === "air"`）；地面目标只走雷达 + 方向脉冲，不占箭头 |
| 数量 | 最多 4 个 DOM 箭头（D5）；`dist ≤ 80`，离屏判定用 `Renderer.project`（`src/rendering/Renderer.ts:798-808`） |
| 优先级 | `firing` > `chasing` > `other`；同级按距离升序、精英优先；超出 4 个时丢弃最低优先级（不排队） |
| 方位 | 从屏幕中心向目标方向做射线，与**安全区矩形**求交得到锚点；箭头旋转指向目标 |
| 内容 | 箭头 + 类型图标（空中 `plane`、精英 `shield`、地面 `bomb`/`crate`，复用 `src/ui/icons.ts:1-28`）+ 距离文字（`Math.round(dist) + "m"`，世界单位≈米） |
| 出现/消失 | 从屏内到屏外：0.12s 淡入；从屏外进入屏内：保留 0.15s 后淡出移除（要求 0.15s；期间回到屏外则取消移除） |
| 堆叠 | 先按「同边 + 方位差 < 8° + 同类」合并为 `×N`；再沿边做贪心最小间距 30px 排布；该边放不下时尝试相邻边，仍放不下则丢弃最低优先级 |
| 背面目标 | `project` 对相机后方目标会翻转，方向用 `relBearing = atan2(dx, dz) - player.heading` 兜底（上 = 玩家机头方向），避免箭头指反 |

**安全区矩形**（`.combat-hud` 层内的可视约束，基线可调，需在 360×640 与 390×844 各验收一次）：

```text
left   = 14px + env(safe-area-inset-left)
right  = 14px + env(safe-area-inset-right)
top    = 124px + env(safe-area-inset-top)          // 让开 battle-top / XP 条 / 播报
bottom = 18px + clamp(64px, 20vw, 92px)             // 让开雷达与底部信息行；360 宽时 = 90px
```

竖屏 360×640 时战斗区高约 422px，安全区约 332×208px，4 个箭头足够排开；`--deck` 变化（`style.css:12`）不影响该矩形，因为箭头层与雷达层都相对战斗区定位。

**镜头偏移结论**：**不做 yaw/俯仰偏移**。01 的相机固定朝向是「上 = 前」操作直觉的基线（`docs/systems/01-control-camera.md:102-128`；`RULES.camera.yaw = 0`，`src/data/config.ts:19`），边缘箭头 + 雷达已经能回答「威胁在哪」。若真机验收仍觉得屏幕外威胁「没感觉」，最多做一次 **≤3% 屏宽的横向 look-ahead 平移**（不是旋转，0.35s 起、0.4s 回正，并入 01 相机 damp 的 lookTarget），默认关闭；D5 的 **8% 屏**是硬上限，本文档不申请接近该上限的方案。

**堆叠伪代码**（抽成纯函数便于单测）：

```ts
const candidates = threats
  .filter((t) => t.layer === "air" && !onScreen(t))
  .sort((a, b) => rank(b) - rank(a) || a.dist - b.dist);
const merged = mergeSameBearing(candidates, 8 * DEG);       // ×N 合并
const picked = merged.slice(0, 4);
const anchors = layoutAlongRect(picked, safeRect, 30);      // 贪心排布 + 溢出降级
```

**与 02 / 07 的关系**：
- **02（D3）**：刷新必须发生在屏幕外 34–46；`ThreatView` 直接给世界坐标，箭头与雷达在同一帧就能显示新接触（≤1 帧延迟），满足 D3「进入视野前给出边缘指示/雷达提示」。若 02 以后把刷新距离调大，雷达钳沿显示、箭头照常工作，05 不依赖刷新参数。
- **07（D7）**：云只遮挡 3D 场景。雷达/箭头/信息条都是 DOM，位于 canvas 之上（`.scene-host` `z-index:-3`，`src/style.css:106-111`；`.world-labels` `z-index:1`，`:850-855`），**被云挡住的敌人仍显示雷达光点与边缘指示**。D7 需要把 `lockFan/targetRing` 这类玩家目标 UI 移入「玩家 + 弹道 + 目标 UI」覆盖渲染层，这一点 07 负责；05 的 HUD 不受深度清空影响。若 07 决定云中目标的名牌降透明度，05 不依赖名牌。

### 3.4 击毁与部件反馈

**事件 → 表现映射**：

| 事件 | 表现（基线可调） | 上限/节流 |
| --- | --- | --- |
| `enemy_hit` | **命中标记**：4 条短辐条，`#fff1c9`，出现在目标投影位置（钳在安全区内）；killed 时放大为击毁爆点，160ms | 80ms 内多次命中合并为一个标记并提升 1 档强度（最多 3 档）；离屏不显示 |
| `enemy_destroyed` | **击毁信息条**（击杀流水）：`追猎机 ×2 · +200 · 金币 6`；精英单独样式；地面目标用 `bomb` 图标；**屏幕震动**；`kill` 音效；解体编排 | 同屏最多 3 条、0.8s 内同类型合并、每条 2.2s、DOM 池 6；震动全局 250ms 间隔、取最大值不叠加 |
| `part_destroyed` | 玩家部件：中央偏下播报「右翼脱落」（1.6s，最多排队 2 条）+ 25ms 振动；敌人部件：目标处浮字「右翼脱落」+ 并入击杀流水后缀（若同帧击毁） | 玩家提示同类 600ms 合并；敌人浮字 500ms 节流、同屏 1 条 |
| `player_hit` | 对应方向边缘橙色受伤脉冲（0.25s）+ 震动（幅度 5px/0.18s，`amount ≥ 5`）+ 现有 `hit` 音效 | 与击毁震动同帧合并取最大；低血量继续复用现有 `.low-health` 暗角（`src/style.css:1389`） |
| `missile_lock_warning` | 雷达上菱形标记 + 追踪弹专属低频告警音；屏幕外时叠加方向脉冲 | 单发导弹只告警一次 |
| `pickup` | 可选轻提示（与 01 共用），05 只保留音效钩子 | 不在本文档范围 |

**目标解体与爆炸**：
- 05 负责「编排」：`enemy_destroyed` 时由 World 生成主爆炸（已有 `World.ts:979-998`），05 追加 2–4 个 `Effect` 碎片（`Effect.kind` 已声明 `"debris"`，`src/simulation/types.ts:155` 但目前未使用）与 1 个烟柱（`"smoke"`，1.8s，随风漂移）；地面目标追加 0.12s / 0.28s 两次延迟二次爆炸 + 1 条烟柱。
- 03 负责「几何」：机翼/尾翼/发动机等可脱落部件的 3D 脱落与机体系解体网格；05 只消费 `part_destroyed` 做文字/音效，不复制 03 的性能衰减与脱落逻辑。
- 地面目标（含 `depot` 连锁爆炸，`World.ts:998`）沿用已有 `explode` 半径，05 只补爆炸链的**时间错位**与烟雾，不改伤害数值。
- 预算：标准画质同时存在的击毁特效碎片 ≤8（D10「部件脱落特效同时 ≤8」），低画质减半；全部走现有 `RULES.maxEffects = 80` 池（`src/data/config.ts:11`），不新建几何体。

**屏幕震动**：用 CSS 类加在 `.scene-host` 上（`transform` 关键帧），由 `GameApp` 在事件时添加、定时移除；不新增 Renderer 相机接口。

| 触发 | 幅度/时长 | 备注 |
| --- | --- | --- |
| 普通空中击毁 | 2px / 0.12s | 250ms 间隔 |
| 精英/大型击毁 | 5px / 0.22s | 同一帧多杀取最大 |
| 地面目标/连锁爆炸 | 4px / 0.18s | 距离 > 40 不震 |
| 玩家受击（`amount ≥ 5`） | 5px / 0.18s | 最大总幅度 6px |
| 玩家部件击毁 | 3px / 0.15s | 与受击同帧合并 |

**音效**：扩展 `GameAudio.play` 的联合类型（`src/services/Audio.ts:15`）新增 `"alert" | "kill" | "part"`；音色表 `:27-34` 增三组；沿用「音效」设置开关与 `voices > 8` 并发保护（`:18-22`）。命中/击毁/部件分别映射不同音高，避免听觉疲劳。

**连击提示**：不改连击数值逻辑（`combo` 上限 3、5s 超时、受击清零，见 `src/data/config.ts:18`、`src/simulation/World.ts:959-960`、`:1058-1059`）。`enemy_destroyed` 携带 `combo`，信息条显示 `×1.4`；底部连击文字在每次击杀时做一次 200ms 缩放脉冲，`combo ≥ 2.0` 变珊瑚橙。

**精英文案迁移**：删除 `World.message("精英击毁 · 维修补给已投放")`（`src/simulation/World.ts:996`），精英击毁统一由信息条呈现（含「维修补给」后缀），`battle-announcement` 只留给升级、装填、投弹等玩家行动反馈，减少同一位置争抢。

## 4. 改动清单（文件级）

### 4.1 删除 / 保留

| 位置 | 现状 | 处理 |
| --- | --- | --- |
| `src/rendering/Renderer.ts:41` | `warningLines: THREE.Line[]` 字段 | **删除** |
| `src/rendering/Renderer.ts:225-243` | 每条警告线的 `BufferGeometry + LineBasicMaterial` 创建 | **删除**（同循环里的 `groundMarkers` 创建保留） |
| `src/rendering/Renderer.ts:605-613` | `e.warning > 0` 时把线从敌人画到 `aimX/aimZ` | **删除** |
| `src/rendering/Renderer.ts:621-622` | 隐藏剩余警告线 | **删除** |
| `src/rendering/Renderer.ts:787` | `hideBattle()` 里重置警告线 | **删除** |
| `src/rendering/Renderer.ts:601` | `marker.visible = world.isBombing \|\| e.warning > 0` | **改为仅 `world.isBombing`**（落点圈只作玩家轰炸辅助） |
| `src/app/GameApp.ts:362` | 名牌下「攻击预警」文字 | **删除** |
| `src/app/GameApp.ts:376-384` | 固定 `edge-warning` 竖排文字 | **删除**，由 §3.3 边缘指示替代 |
| `src/style.css:903-911` | `.edge-warning` 样式 | **删除** |
| `src/style.css:881-887` | `.enemy-label b`（只被攻击预警告用） | **删除** |
| `src/simulation/types.ts:101-103` | `Enemy.warning/aimX/aimZ` | **保留**（开火节奏与弹道方向仍需要，只是表现层不再读取） |
| `src/rendering/Renderer.ts:39-40,163-195,686-715` | 玩家 `lockFan` / `targetRing` | **保留**（玩家辅助，不是敌方瞄准线） |
| `src/app/GameApp.ts:364-375` | `lock-label` / `aim-label` | **保留** |
| `src/rendering/Renderer.ts:157-162,681-685,728-742` | 轰炸准心 / 弹道路径 | **保留** |

### 4.2 新增

- `src/simulation/types.ts`：`WorldEvent`、`ThreatAlert`、`ThreatView`（§3.1）。
- `src/simulation/World.ts`：`events` 队列 + 上限 64 + `frame()` 入口清空；`emit()` 私有方法；`threats` 复用池与每步更新；在 §3.1 表中 8 处埋事件；精英播报迁移。
- `src/ui/CombatHud.ts`（新文件，约 300 行）：雷达盘、边缘指示、信息条、命中标记、方向脉冲、震动类的 DOM 池与生命周期；纯逻辑拆到 `src/ui/combatHints.ts`（`radarPoint` / `edgeAnchors` / `killFeedReducer` / `mergeSameBearing`），便于 node 环境单测。
- `src/app/GameApp.ts`：`startBattle()` 创建 `CombatHud`（`GameApp.ts:237-261`）；循环里 consume/update（§3.1）；`updateLabels()` 移除预警逻辑。
- `src/style.css`：`.combat-hud`、`.radar-*`、`.edge-indicator`、`.kill-feed`、`.hit-marker`、`.damage-pulse`、`.screen-shake`、`.combo-pulse` 及 reduce-motion/低画质分支；`.battle-status` 让位（以现有 2100+ 行的响应式断点为准各补一条）。
- `src/ui/icons.ts`：新增 `radar`、`alert`、`hit` 三个图标；类型图标复用 `plane/shield/bomb/target`。
- `src/data/config.ts`：`RULES.radarRange = 60`、`RULES.alertFireWindow = 2.0`、`RULES.edgeMax = 4`、震动词表；`QUALITIES`（`:22-39`）增加 `hud: { sweep, arrows, feedMax, shake }` 字段。
- `tests/combat-events.test.ts`、`tests/combat-hints.test.ts`（§7.1）。

### 4.3 旧表现 → 新表现迁移表

| 旧表现 | 新表现 |
| --- | --- |
| 敌人→落点的橙色连线 | 雷达对应方位扇区闪烁 + 屏幕方向脉冲（无连线） |
| 名牌下「攻击预警」文字 | 雷达光点脉冲 + 光点形状/描边变化 |
| 右边缘固定「‹/› 空中目标接近」 | 最多 4 个安全区边缘箭头（方位/距离/类型/优先级） |
| 只有屏幕内威胁可见 | 屏幕外空中目标从刷新起即可见（雷达 + 箭头） |
| 击毁仅计数 +1 | 信息条（类型/分数/掉落/连击）+ 命中标记 + 震动 + 音效 |
| 部件损毁只有冒烟 | 文字播报（「右翼脱落」）+ 03 的脱落视觉 + 音效 |
| 精英击毁抢 `battle-announcement` | 精英信息条独立展示，播报位留给玩家行动 |
| 地面预警落点圈 | 雷达方形光点 + 方向脉冲（落点圈是否回归见 §8） |

## 5. 实现任务拆分

Wave 1（可并行，对应 00-overview 实施顺序）：T1/T2 先落地。

| 任务 | 内容 | 文件 | 依赖 | 验收 |
| --- | --- | --- | --- | --- |
| T1 事件总线 | 类型、队列、8 个埋点、清空时机、上限；`ThreatView` 池 | `types.ts`、`World.ts` | — | 单测：每类事件字段正确；暂停无事件；确定性一致 |
| T2 删除旧表现 | 删 `warningLines`/攻击预警/固定边缘文字/落点圈预警分支；静态断言 | `Renderer.ts`、`GameApp.ts`、`style.css` | — | 源码断言 + 真机确认屏幕上无敌方线 |
| T3 雷达盘 | 布局/尺寸/安全区/坐标映射/光点/扫描线；低画质与 reduce-motion 分支 | `CombatHud.ts`、`style.css`、`config.ts`、`icons.ts` | T1 | 单测坐标映射；360×640 截图 |
| T4 开火告警 | 扇区闪烁/方向脉冲/`alert` 音效/振动/去重 | `CombatHud.ts`、`Audio.ts`、`World.ts` | T1、T3 | `enemy_fire`→四类反馈各触发一次 |
| T5 边缘指示 | 离屏判定、优先级、方位、距离/图标、堆叠、0.15s 淡出 | `CombatHud.ts`、`combatHints.ts`、`style.css` | T1 | 单测：数量 ≤4、方位、优先级、合并规则 |
| T6 击毁反馈 | 命中标记、信息条合并/上限、震动、音效、连击脉冲 | `CombatHud.ts`、`Audio.ts`、`World.ts` | T1 | 单测队列；真机节奏 |
| T7 部件反馈 | `part_destroyed` 提示；与 03 事件字段对齐；精英播报迁移 | `GameApp.ts`、`CombatHud.ts`、`World.ts` | T1、03 | 03 合入后联调 |
| T8 性能/可访问性/验收 | DOM 上限、节流、reduce-motion、音效关闭、真机回归、基线文档更新 | 全部 | T1–T7 | §6 全部通过 |

实现顺序建议：**T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8**；T2 可与 T1 同行，先删线能让真机立刻验证「无瞄准线」这一 P0 需求。

## 6. 验收标准

### 6.1 自动化（node 环境，固定种子）

- **事件产生**：`advance` 到敌人开火，`world.events` 含 `enemy_fire`，字段含 `enemyId/heading/aimX/aimZ/count/threat`；导弹车开火额外产生 `missile_lock_warning`；地面单位开火产生 `ground_attack`。
- **事件消费/生命周期**：`frame()` 后取一次事件，下一帧无事件时队列清空；暂停（`timeScale = 0`）期间不产生事件；队列长度 ≤64。
- **确定性**：同一 seed 两个 World、同一输入运行 20s，事件类型与字段序列完全一致（事件不消耗随机数）。
- **击毁/部件**：`damageEnemy` 致死产生 `enemy_destroyed`（score/coins/combo/cause 正确）；`damagePlayer` 打爆右翼产生 `part_destroyed`（`owner:"player"`、`label:"右翼"`、`detachable` 与 03 一致）；受击产生 `player_hit`。
- **无瞄准线（静态断言）**：读取源码文本断言 `src/rendering/Renderer.ts` 不含 `warningLines`、不再读取 `aimX/aimZ`；`src/app/GameApp.ts` 不含「攻击预警」「edge-warning」；`src/style.css` 不含 `.edge-warning`。
- **边缘指示（纯函数）**：`edgeAnchors` 对合成威胁列表返回 ≤4 项、只含空中、按 `firing > chasing > other` 排序、方位角与安全区锚点正确、同边 30px 间距、`8°` 内同类合并为 `×N`。
- **雷达坐标（纯函数）**：`radarPoint` 对 heading=0 时正前/正后/正左/正右的四方向、距离 60 的钳沿、旋转玩家航向后的相对方位全部正确。
- **信息条（纯函数）**：`killFeedReducer` 0.8s 内同类合并、同屏 ≤3、顺序新→旧、超出丢弃最旧。
- **性能护栏**：模拟 300s 时 `world.events.length` 始终受控、无泄漏；DOM 相关纯函数不分配每帧数组（可做调用次数断言）。

### 6.2 真机 / 视觉验收（360×640 与 390×844 各一次）

- 击杀若干敌人：**屏幕上不出现任何敌方连线/落点圈**；玩家锁定扇形、目标环、轰炸准心仍正常。
- 敌人开火瞬间：0.3s 内可感知「雷达扇区闪烁 + 屏幕方向脉冲 + 告警音 + 振动」；连续开火不刺耳、不连续震。
- 屏幕外目标：最多 4 个边缘箭头，方位正确（把机头转向箭头方向，目标应从该边进入屏幕）、距离文字变化平滑、进屏后 0.15s 淡出。
- 雷达与箭头不压住摇杆、升级/轰炸/投弹按钮；雷达盘在 360 宽下仍能区分光点形状。
- 击毁：命中标记、信息条「类型 + 分数 + 掉落」可读；精英信息条与普通区分；同屏 3 杀以上不刷屏；震动短促不眩晕。
- 部件：击毁右翼时出现「右翼脱落」提示，且 03 的脱落视觉/操控衰减同时生效。
- 无障碍：开启「减少动态效果」后无扫描线/无震动/无缩放脉冲；关闭「音效」后仅剩视觉告警；灰度截图下仍能靠形状区分空中/地面/开火状态。

### 6.3 性能预算（D10）

- 新增 DOM 节点上限：雷达 1 + 光点 16 + 扇区 1 + 箭头 4 + 信息条 3（池 6）+ 命中标记 2（池）+ 方向脉冲 4 + 部件提示 2 ≈ **≤ 40**；全部池化复用，禁止每帧 `innerHTML` 重建。
- 更新频率：雷达/信息条文字走现有 90ms HUD 节流（`src/app/GameApp.ts:736-739`）；边缘箭头每帧更新但写样式前比较阈值（位移 >0.5px 才写）；扫描线、脉冲由 CSS 合成层驱动。
- 标准画质新增 CPU <1ms/帧、0 新增 draw call（纯 DOM）；低画质仍保 30 FPS、标准档 60 FPS 目标不变。

## 7. 测试与兼容

### 7.1 现有测试的改动

- `tests/simulation.test.ts`：现有断言都是行为/数值，事件是纯旁路，**不应改变任何结果**；需要新增 `world.events` 断言（事件表逐类）。暂停测试（`:54-99`）不序列化 `events`，保持原样；「冻结」语义扩展为「暂停期间事件队列为空」。
- 五分钟耐力测试（`:298-349`）：`peak` 不包含事件；建议补 `expect(w.events.length).toBeLessThanOrEqual(64)` 防泄漏。
- 新增 `tests/combat-events.test.ts`（模拟侧，固定种子）与 `tests/combat-hints.test.ts`（纯函数 + 源码静态断言）。测试环境按现有 node 约定（无 jsdom，参考 `tests/controls.test.ts` 的伪 DOM），DOM 相关只测纯函数。
- 不新增对 Three.js `Renderer` 的构造依赖；静态断言用 `node:fs` 读源码文本。

### 7.2 跨文档接口

| 文档 | 接口约定 |
| --- | --- |
| 02（D3） | 刷新距离 34–46、屏外生成；`ThreatView` 只依赖世界坐标，箭头/雷达在刷新的同一帧可见；活动敌人 ≤14 决定雷达光点池 16 |
| 03（D1/D2） | `part_destroyed` 的 `owner/partId/role/side/label/detachable` 直接映射 03 的 `Part`；03 负责脱落几何/性能衰减，05 只做文字+音效；击毁碎片预算与 03 共用 ≤8 |
| 07（D7） | DOM HUD 不受云深度影响；云中敌人仍显示雷达/边缘指示；`lockFan/targetRing` 需由 07 移入玩家覆盖渲染层（05 不依赖） |
| 01（D9） | 事件不进存档；`pickup` 事件供 01 复用，05 不改变拾取规则 |
| 04 | 无接口；注意加力能量提示音与告警音不要撞频（音色表区分） |
| 06 | 地面单位改为固定路线后 `ground_attack` 事件不变；固定炮台移除后地面告警来源减少（符合 D5） |
| 08 | 颜色采用珊瑚橙/青绿/奶油白/天空蓝；形状+颜色双编码 |

### 7.3 存档与基线文档

- 不新增存档字段（D9）；若后续把「屏幕震动」做成独立开关，随 D9 的 `SaveData.version = 2` 一起加，不单独升版本。
- 实施完成后按 00-overview §9 合并：更新 `docs/systems/04-enemies-battlefield.md`（预警/瞄准线描述）、`docs/systems/01-control-camera.md:128`（边缘预警→边缘指示）、`docs/systems/03-weapons.md:165-170`（命中反馈）、`docs/content/INITIAL_ENEMIES.md`（红色瞄准线）与 `docs/IMPLEMENTATION.md` 验证记录。

## 8. 待确认与备选

| # | 问题 | 默认方案 | 备选/影响 | 需确认 |
| --- | --- | --- | --- | --- |
| 1 | 是否保留地面落点圈 | **删除**预警落点圈，统一雷达 + 方向脉冲（本文档采用） | 若保留：仅炮击类、最多 2 个、只画圆不画线、预警后段才淡入；需同步修改 `docs/systems/04-enemies-battlefield.md` | 策划/用户 |
| 2 | 雷达是否可开关 | 常驻；低画质自动简化（2 圈、无扫描线），不做设置项 | 设置项「显示雷达盘」需新增存档字段，建议随 D9 v2 做 | 策划 |
| 3 | 镜头偏移 | **不做** yaw/俯仰；必要时 ≤3% 屏宽横向 look-ahead，默认关闭 | D5 允许 ≤8%；超过 3% 可能破坏「上=前」直觉与单手操作，需单独真机评估 | 用户 |
| 4 | 命中伤害飘字 | v1 不做（竖屏信息密度已高） | 可只对精英/暴击显示 | 策划 |
| 5 | 边缘箭头是否包含地面目标 | 不包含（地面走雷达 + 方向脉冲） | 若地面火力成为主要死因，可给地面保留 1 个箭头名额 | 策划（依赖 06） |
| 6 | 屏幕震动独立开关 | 复用现有「触觉反馈」与系统 reduce-motion | 独立「屏幕震动」开关更精细，但需存档字段 | 用户 |
| 7 | 屏幕阅读器播报 | 不做（雷达 `role=img` + 静态标签，箭头装饰性隐藏） | 可选低频 live region（间隔 ≥2s），默认关闭 | 无障碍/用户 |
| 8 | 敌方名牌是否降噪 | 保留身份/血条；建议血条只对锁定目标与精英显示 | 与 03 部件显示联动，2026 迭代再定 | 策划 |
| 9 | 告警音独立音量 | 复用「音效」总开关 | 单独音量滑块需设置界面扩展 | 用户 |
| 10 | 事件命名 | 采用 D5 的 `missile_lock_warning` | 需求文本中的 `missile_warning` 视为同一事件，不并存两套 | 文档负责人 |

**潜在风险**：D3 把同屏敌人压到 ≤14 后，雷达与 4 个箭头的信息量是否仍然够用，需要在 02/03 合入后做一次真机联调；若 03 的击毁特效与 05 的碎片叠加导致低端机掉帧，优先降 05 的碎片（低画质减半），03 的部件几何保留。
