# 02 · 敌人数量上限与空中避让

> 状态：提案（未实施），只描述改动，不改实现/测试/基线文档。基线 0.3.0（`5b22187`），行号仅作索引、实施以符号名为准。
> 依据：`docs/changes/00-overview.md` D3/D5/D10/D11、`docs/systems/04-enemies-battlefield.md`、`docs/content/INITIAL_ENEMIES.md`；关联 [00](00-overview.md) D3、[03](03-parts-and-damage-degradation.md)、[05](05-radar-alert-and-target-feedback.md)、[06](06-ground-routes-and-terrain.md)。
> 数值为**基线可调**；与 D3 冲突以 D3 为准。

## 1. 问题与现状

### 1.1 复核结论（0.3.0 实际代码）

| 问题 | 代码定位 | 当前值 | 后果 |
| --- | --- | --- | --- |
| 只有总量闸门，无分层上限 | `src/data/config.ts:7-8`（`RULES.maxEnemies=24`、`maxGround=14`）；`World.spawnEnemy` `src/simulation/World.ts:512-544`，闸门在 `:513` | 仅判断 `enemies.length >= maxEnemies + maxGround`（38） | 空/地/精英互相挤占名额；超限静默 `return`，波次不可预期 |
| 空中上限随时间抬高、每波过多、节奏无呼吸 | `World.updateDirector` `src/simulation/World.ts:446-511`，条件 `:454-456`、数量 `:464-467`、间隔 `:475` | `airCount < min(14, 4 + floor(t/25))`（250s 后 14）；每波 `2 + min(2, floor(t/70))`（140s 后 4 架）；间隔 8–12s、拥挤 ×1.5 | 与地面 14 叠加可达 38 个活动实体，越挤越刷 |
| 精英无上限且可被静默吞掉 | 同文件 `:55`、`:493-502` | `eliteAt=90` 到点直接生成并 `eliteAt += 90` | 无“精英同时 1”；被 38 总量拦住时“大型信号”照发而精英没出现 |
| 召唤绕过一切上限 | 同文件 `:571-577`（生成在 `:575`） | `scout` 存活 8s 后 `spawnEnemy("hunter", e.x+5, e.z+14)` | 无视分层预算；生成点紧贴 scout，天然重叠 |
| 生成点按玩家航向而非屏幕方位 | 同文件 `:468-474`、`:229-231`、`:495-500` | 航向 ±1.1rad、距离 30/33；开场 (±3, 25/31)；精英正前方 32 | 相机 yaw 固定（`src/rendering/Renderer.ts:497-510`），生成扇区会扫到屏幕前向；无屏幕外硬校验 |
| 无敌人间避让 | `World.updateEnemies` `src/simulation/World.ts:545-678` | 所有单位 `target = atan2(p-e)`（`:559`），仅对玩家碰撞 `d < e.radius + 0.7`（`:626-627`） | 空中单位同格穿插（统一 `y=4`，`Renderer.ts:597`；模型 scale 1.95–3.4，`:440`），视觉糊成一团、爆炸/扫射重复命中 |
| 回收不可读 | 同文件 `:675-677` | `distance < 85 && age < 65` 直接过滤 | 无线索消失；预算释放时机不可测 |
| 现有测试只覆盖总量 | `tests/simulation.test.ts:331-332`（≤38）、`:340`（峰值 <250）；转向惯性 `tests/flight-dynamics.test.ts:93-113` | 无分层上限/间距/生成距离/召唤越界断言 | 无法防回归 |

**相机参考系复核**（按 `RULES.camera`（`src/data/config.ts:19`）+ `Renderer.ts:497-510`，机体高度 y=4）：竖屏 aspect 0.5625 下屏幕前向可见约 27–30 单位，`d=30` 正前方点 NDC y≈1.10（仅 0.10 余量）；平板 aspect 0.75 下 `d=30`、偏角 30° 已进入视口。所以“恰好刷在屏幕外”不是代码保证；且生成角按玩家航向算（玩家横飞时扇区可覆盖屏幕前向 ±27°），与 D3 不一致。反向验证：**屏幕方位 |b|≥55°、距离 34–46** 在 aspect 0.45–0.8、y=4–16 的网格上 NDC 单轴最小值仍为 1.64（>1.15 边距），即侧/后向生成环是解析安全的。

### 1.2 为什么“多”不等于“有压力”

1. **数量替代了职责、上限互相吞噬**：每 8–12 秒 2–4 架全朝玩家直冲，没有编队与主次目标，玩家只需绕圈，与 `docs/systems/04-enemies-battlefield.md` 的分层目标相反；地面填满 38 总量后由地面决定空战节奏，精英被吞时只有提示没有敌人，信任成本极高。
2. **堆叠破坏可读性与反馈**：同速同目标会收敛到同一条轨迹，轮廓重叠后看不清攻击预警；`World.damageEnemy`（`:968-999`）与 `explode`（`:1000-1030`）按实体逐个结算，重叠单位等于加倍收益，奖励“不躲等堆”。
3. **突然出现**：生成扇区以玩家航向为基准而相机 yaw 固定，部分点贴着屏幕上沿；精英正前方 32 生成违反 `INITIAL_ENEMIES.md` 的生成规则。

### 1.3 可验收需求

- **R1**：任意时刻空中 ≤8（含精英）、地面 ≤6、精英 ≤1、活动总数 ≤14。
- **R2**：所有生成入口（波次、scout 召唤、精英、护航、开场）都受 R1 约束，不得绕过。
- **R3**：上限按阶段抬高但不是无级增长；**R4**：生成点距玩家 34–46，且解析上位于视口外，不在玩家视野内/头顶瞬间出现。
- **R5**：任意两架非豁免空中敌人不重叠、不“挤成一团”；同车道地面车辆按车距排队（与 06 对接）。
- **R6**：屏幕内可见空中 ≤6、可见总数 ≤9（标准档）。
- **R7**：导演按阶段出波、有呼吸窗口；精英事件有预告且整组进入。

## 2. 目标体验

- **压力靠“读”不靠“数”、有呼吸**：最多 8 架空中单位，但编队/职责/进入方位区分明确，1–2 秒内能认出“这是 V 字切入”“这是护航轰炸机”；两波之间 ≥9 秒，精英前 2 秒“大型信号”、击毁后额外 4 秒不刷波。
- **不凭空出现、不叠罗汉**：只从屏幕侧/后侧环进入，先由 05 边缘指示/雷达提示再进视野；任意两机不互相穿插，编队间距 ≥10。
- **地面是车队**：同路线车辆首尾相接、车距 ≥4，不贴脸追玩家（06 落地后）。
- 量化目标（标准档）：活动峰值 ≤14（现状 38）；同屏可见 ≤9；空中非豁免对 p05 ≥4；3 架同 9 半径圆 = 0 次；生成点可见比例 = 0。

## 3. 目标设计

### 3.1 数量上限与分层预算

**硬上限**（与 D3 完全一致，不随画质/分数变化）：`ENEMY_LIMITS = { air: 8, elite: 1, ground: 6, active: 14 }`（`src/data/config.ts`）。**口径**：精英占空中名额（非精英空中 ≤7 + 精英 ≤1 = 8）；因为 8+6=14 = `active`，精英另计会出现 8+1+6=15>14 的矛盾。`active` 为冗余断言，由 `air + ground` 自然满足。

**`slotCost` 口径（可选，二期）**：若启用 `slotCost`（08 大型机建议 2），预算按 `Σ slotCost` 计算，实体数仍受“空中 ≤8”限制；对应断言改为“空中实体 ≤8 **且** slot 占用 ≤8”。一期所有 kind 默认 `slotCost=1`，不改变现有 A1–A5 断言；是否启用由 08 二期内容定。

**时间预算曲线**（硬上限内抬升，可调）：

| 时间段 | 空中预算（含精英） | 地面预算 | 活动预算 | 说明 |
| --- | ---: | ---: | ---: | --- |
| 0–30s | 4 | 3 | 7 | 开场 2 架 + 2 波教学 |
| 30–90s | 6 | 4 | 10 | 第一次要求绕行 |
| 90–180s | 8 | 6 | 14 | 88s 精英预告，90s 首次精英 |
| 180s+ | 8 | 6 | 14 | 混合编队，单波上限 3 |

```ts
export const airBudgetAt = (t: number) => Math.min(8, t < 30 ? 4 : t < 90 ? 6 : 8);
export const groundBudgetAt = (t: number) => Math.min(6, t < 30 ? 3 : t < 90 ? 4 : 6);
```

**统一入口**：`World.requestSpawn(req) → SpawnBudget`，`source ∈ {opening, wave, summon, elite, elite_escort}`。玩法路径禁止直接调用 `spawnEnemy`；它保留为测试/调试夹具（不受预算约束，需注释说明）。所有请求受 R1 约束，**召唤/增援不例外**。

```ts
// src/simulation/SpawnBudget.ts
export type SpawnSource = "opening" | "wave" | "summon" | "elite" | "elite_escort";
export interface SpawnRequest { kind: string; x: number; z: number; source: SpawnSource;
  formationId?: number; slotIndex?: number; entrySide?: -1 | 1; ttl: number; }   // 进队者保留编队槽位
export type SpawnResult = "spawned" | "queued" | "rejected";
export class SpawnBudget {
  request(world: World, req: SpawnRequest): SpawnResult;   // 先查上限，再查生成点
  tick(world: World, dt: number): void;                    // 队列漏出，≤1 条/0.8s
  snapshot(enemies: Enemy[]): { air: number; ground: number; elite: number; total: number; pending: number };
}
```

**待生成队列（不丢弃）**：上限 **6** 条；普通 TTL **12s**、召唤 TTL **6s**；过期记 `spawn_dropped{reason,kind}`。每 0.8s 最多放行 1 条，放行仍走同一预算与生成点校验；若时机已不合法（玩家移动导致原点入屏）重新选点，失败保留至 TTL。优先序：`elite_escort > elite > summon > wave > opening`，同级按入队时间。

**回收规则**（离场可读、预算当帧释放）：

| 单位 | 回收距离 | 回收年龄 | 备注 |
| --- | ---: | ---: | --- |
| 空中 | 95 | 60s | XZ 平面距离 |
| 地面 | 90 | 75s | 对齐 D6“离开玩家 90 单位后回收” |
| 精英 | 95 | 150s | 不提前回收，保证 90s 周期完整 |

回收前 **0.8s** 淡出（渲染层读 `enemy_recalled`）；不计击杀/掉落；写 `telemetry.record("enemy_recalled", {kind, reason, t})`；替换 `World.ts:675-677` 的 `distance < 85 && age < 65`。

**召唤与精英细则**：scout 每架只召唤一次（沿用 `Enemy.called`），请求 **2 架 hunter**（基线 2、可调 1=现状），占空中名额、满员入队 TTL 6s。精英事件**整组预留 3 个空中名额**（elite 1 + escort 2），仅当 `airCount + 3 ≤ airBudgetAt(t)` 且精英数为 0 时才播报“大型信号”，2 秒后在侧向 40–46 生成；否则每 5s 重试并记 `elite_deferred`，**不播报**；精英存活时不再进入下一轮。轰炸模式（`world.isBombing`）期间暂停新波次释放（已有敌人继续），退出后 1.5s 宽限，精英播报/释放同样跳过轰炸时段；升级/暂停由 `timeScale=0` 自然冻结。

### 3.2 导演重构：从随机抽类型到阶段状态机

`updateDirector`（`World.ts:446-511`）替换为 `src/simulation/EnemyDirector.ts`，World 只留一行委托；导演**只产生 `SpawnRequest`，不直接生成**。

```ts
export type DirectorPhase = "intro" | "skirmish" | "pressure" | "mixed";
export interface DirectorInput { elapsed: number; healthRatio: number; kills15s: number; damageDealt15s: number;
  activeAir: number; activeGround: number; activeElite: number; playerX: number; playerZ: number; playerHeading: number; viewportAspect: number; isBombing: boolean; }
export interface DirectorState { phase: DirectorPhase; waveIndex: number; nextAirWaveAt: number; nextGroundWaveAt: number;
  nextEliteAt: number; eliteAnnounced: boolean; eliteDeferred: number; entrySide: -1 | 1; recentTags: WaveTag[]; pending: SpawnRequest[]; lowHealth: boolean; }
export interface WavePlan { id: number; tag: WaveTag; formation: FormationKind; members: { kind: string; slot: number }[];
  entrySide: -1 | 1; bearingDeg: [number, number]; spawnDist: [number, number]; releaseAt: number[]; }
```

输入：存活时间、生命比例、最近 15s 击杀数、最近 15s 玩家伤害（`World.damageDealt` 新增累计）、活动空/地/精英数、玩家位置与航向、`viewportAspect`（GameApp 在 resize 时写入）、`isBombing`。

| 阶段 | 时间 | 波次间隔 | 单波规模 | 编队池 | 地面池（06 前/后） | 精英 |
| --- | --- | --- | ---: | --- | --- | --- |
| `intro` | 0–30s | 11s | 1–2 | line | resource / resource | — |
| `skirmish` | 30–90s | 10–12s | 1–2 | line、v | resource、aa、emplacement / resource | — |
| `pressure` | 90–180s | 9–11s | 2（120s 起 2–3） | v、orbit、crossing | aa、missile_truck、resource、depot / missile_truck、resource | 90s 首次，每 90s |
| `mixed` | 180s+ | 9–13s | 2–3 | 全部五种 | 全部 / missile_truck、resource | 每 90s + 护航 2 |

> 表中“06 前”列是 02 作为 Wave 1 先落地时的**过渡池**（保留现状的 `aa`/`emplacement`/`depot`）；06 落地后按 D6 从 `ENEMIES` 删除 `aa`/`emplacement`、地面全部改为移动单位，“06 后”列生效。02 的预算与上限断言不依赖具体 kind，因此两阶段可独立验收。

| tag | 成员 | 编队 | 条件 | weight | 备注 |
| --- | --- | --- | --- | ---: | --- |
| `scout_line` | scout×1 + hunter×1 | line | 全期 | 3 | 教学/侦察 |
| `hunter_v` | hunter×2 | v | 全期 | 3 | 主力追击 |
| `striker_pair` | striker×1 + hunter×1 | crossing | 30s+ | 2 | 俯冲威胁 |
| `bomber_escort` | bomber×1 + escort×1 | escort | 60s+ | 2 | 高价值目标 |
| `crossing` | hunter×2 | crossing | 30s+ | 2 | 侧向穿越 |
| `resource_run`（地） | resource×1 | line | 全期 | 2 | 金币路线 |
| `vehicle_patrol`（地） | missile_truck×1 | line | 30s+ | 2 | 地面火力 |
| `elite_guard` | elite + escort×2 | orbit | 90s+ | 事件 | 整组预留 3 名额 |

**权重修正**（乘法，钳制 ≥0.05）：生命 <35% 时 `scout_line/hunter_v/striker_pair ×0.4`、`resource_run ×1.6`、下一波间隔 ×1.5（D3）；输出过高（`damageDealt15s > 120`）时 `bomber_escort ×1.35`、`crossing ×1.2`；上一 tag ×0.25、最近 3 个 tag 内 ×0.6；>60s 不轰炸时地面高价值 ×1.3。选择用 `world.random`（`src/services/Random.ts:24-36`）一次加权轮盘，保证同 seed 同时间线（D11）。

**呼吸窗口**：`nextAirWaveAt = elapsed + interval`，间隔取阶段区间；低生命 ×1.5、精英击毁 +4s、一波全灭 +2s；轰炸期间持续后延（每次 +1.5s），退出后恢复正常。左右 `entrySide ∈ {-1,+1}` 交替，同一 tag 不连续同侧 >2 次。导演每步：推进阶段 → 收集输入 → 到点产出 `WavePlan` → 逐成员 `requestSpawn()`（错峰 0.35s）→ 未落地成员保留 `formationId/slotIndex` 入队；编队少于 2 人时解散，剩余转单机。

### 3.3 生成点与屏幕外约束

**参考系修正**：相机 yaw 固定指向世界 +Z（`Renderer.ts:497-510` 只按玩家位置平移，不随 `player.heading` 旋转），玩家可任意航向（`World.updatePlayer` `src/simulation/World.ts:398-418`）。因此“屏幕方位”按**相机前向（+Z）**定义，**不按玩家航向**（修正 `World.ts:468`）。

| 进入方式 | 屏幕方位（相对 +Z，度） | 用途 |
| --- | --- | --- |
| 左侧 | −125 … −55 | 常规波次（左右交替） |
| 右侧 | +55 … +125 | 常规波次 |
| 后侧 | \|b\| 125 … 155 | 穿越、精英护航、包抄 |
| 正前 | \|b\| < 55 | **禁止** |

**硬校验**（`isSpawnLegal`，最多重试 8 次，失败用确定性兜底：后侧 ±150°、距离 46）：

1. 与玩家 XZ 距离 ∈ [34, 46]（D3）。
2. `isOutsideView(probe, point, 1.15)`：按 `RULES.camera` 解析相机（与 Renderer 同源），NDC 至少一轴超出 ±1.15；已验证 `|b|≥55°`、`d∈[34,46]`、aspect 0.45–0.8、y=4–16 时最坏单轴 1.64。
3. 与任意现存敌人距离 ≥ **10**，且不在玩家航向前方 40° 且距离 <42 的锥内（禁止重叠/迎面撞上刚生成的目标）。

```ts
// src/simulation/ViewportProbe.ts
export function battleCameraProbe(anchor: { x: number; z: number }, aspect: number): CameraProbe;
export function toNdc(probe: CameraProbe, x: number, y: number, z: number, aspect: number): { x: number; y: number; depth: number };
export function isOutsideView(probe: CameraProbe, x: number, y: number, z: number, aspect: number, margin?: number): boolean;

function chooseSpawnPoint(world: World, req: SpawnRequest) {
  for (let i = 0; i < SPAWN.attempts; i++) {
    const side = req.entrySide ?? world.director.state.entrySide;       // ±1 交替
    const bearing = side * rand(55, 125) * RAD;                        // 后侧波次 125–155
    const dist = rand(34, 46);
    const x = world.player.x + Math.sin(bearing) * dist, z = world.player.z + Math.cos(bearing) * dist;
    if (isSpawnLegal(world, x, z)) return { x, z };                    // 距离/视口/间距/前锥
  }
  return fallbackRear(world, req.entrySide ?? 1);                      // 解析保证屏幕外
}
```

开场 2 架（替换 `World.ts:229-231` 的固定坐标）：`opening` 请求分别从左右两侧 36/40 进入，约 2s 后才可能进入视野，配合 05 边缘提示完成“第一次遭遇”。

### 3.4 编队与空中避让

编队沿用 `docs/systems/04-enemies-battlefield.md` 的五种，只负责**进入段槽位**；进入完成 6s 内槽位权重衰减到 0，分离接管，避免互相打架。

| 编队 | 槽位（相对锚点） | 最小成员间距 | 说明 |
| --- | --- | ---: | --- |
| line | (−10,0)、(0,0)、(10,0) | 10 | 机炮扫射 |
| v | (0,0)、(±9,−6) | 10.8 | 侧向切入 |
| orbit | 环半径 11 均布 2–3 名 | 19 | 展示炮塔/散射 |
| escort | 长机居中，护航环半径 8 两侧对称 | 16（护航间） | 护航-长机对豁免分离 |
| crossing | 平行车道横向错开 10 | 10 | 一侧进、另一侧出 |

**分离力模型**（`src/simulation/Separation.ts`；`separationRadius = 7` 按半径缩放，D3）：

```ts
const SEP = { baseRadius: 7, radiusScaleSum: 3.6, weight: 0.65, hardWeight: 0.9,
  hardFactor: 0.6, falloffPower: 2, maxTurnBonus: 0.25, sideStick: 1.2, headOnRange: 12, headOnWeight: 0.35, minSpeedFactor: 0.85, overtakeBoost: 1.15 };
const separationRadius = (a: Enemy, b: Enemy) =>
  clamp(SEP.baseRadius * (a.radius + b.radius) / SEP.radiusScaleSum, 5.5, 12); // 5.5–12

export function separationForce(e: Enemy, all: readonly Enemy[]) {
  let fx = 0, fz = 0, hard = 0;
  for (const o of all) {
    if (o === e || o.layer !== "air" || o.health <= 0 || isFormationExempt(e, o)) continue; // 护航-长机豁免
    const dx = e.x - o.x, dz = e.z - o.z, d = Math.hypot(dx, dz) || 1e-4, R = separationRadius(e, o);
    if (d >= R) continue;
    const falloff = (R - d) / R, w = Math.pow(falloff, SEP.falloffPower);
    fx += (dx / d) * w; fz += (dz / d) * w;
    if (d < R * SEP.hardFactor && (e.vx - o.vx) * dx + (e.vz - o.vz) * dz > 0)
      hard = Math.max(hard, falloff);
  }
  const mag = Math.hypot(fx, fz);
  return { x: mag ? fx / mag : 0, z: mag ? fz / mag : 0, level: Math.min(1, mag), hard };
}

// 转向混合：避让 > 追击 > 攻击（复用现有 World.ts:589-601 的转向与阻尼）
const chase = Math.atan2(p.x - e.x, p.z - e.z);            // 含 breaking/fleeing/bomber 等状态偏移
const sep = separationForce(e, world.enemies);
const blend = sep.hard > 0 ? SEP.hardWeight : SEP.weight * sep.level;
const target = blendAngle(chase, Math.atan2(sep.x, sep.z), blend) + headOnOffset(e, d);
const desiredTurn = clamp(angleDelta(target, e.heading) * 2.2,
  -c.turnRate * RAD * (1 + sep.hard * SEP.maxTurnBonus),
  +c.turnRate * RAD * (1 + sep.hard * SEP.maxTurnBonus));
```

**优先级规则（避让 > 追击 > 攻击）**：① `hard > 0`：混合权重 0.9、转向权限 +25%、**不开始新的攻击前摇**（`warning===0` 门控加 `hard < 0.6`；已开始的 warning 继续结算，避免吞子弹）；速度上被后方逼近时 ×1.15 让开、被慢机挡在前方时 ×0.85，但不低于 0.85 倍配置速度（防“空中刹车”）。② 无硬避让时按 0.65×level 混合；现有状态机偏移角先作用于追击角再混合。③ **对头让行**：`d < 12` 且接近时按确定性侧向（叉积符号，共线用 `e.id % 2`）偏 0.35 权重，`avoidSide` 保持 1.2s 防抖。④ **近身配额**：距玩家 <15 的空中单位 ≤4，名额满时其余在 `standoffRadius = 20` 外围绕/离场（目标角加 0.9rad 侧偏），避免全部糊在玩家头顶。⑤ **头顶不打转**：单机 `d < 12` 连续 attacking >2.5s 时强制 1.5s `breaking` 离场（复用 `:566` 的 breaking 偏移）再进入。

**编队与分离配合**：同编队成员在 `entering` 状态按槽位飞行，槽位间距 ≥10 > 分离半径 7，不会对抗；6s 后槽位权重衰减、分离接管。护航-长机对仅在环绕时豁免分离（环绕半径 8 与精英半径 4.1 + 分离半径 11.1 冲突）；精英死亡后豁免解除，护航按现有 `:579-586` 逻辑离场。

### 3.5 地面车道与车距排队（与 06 接口）

- 已接 06：`RouteSystem.sample(routeId, s) → {x,z,heading}`；`Enemy` 增 `routeId/routeDist/laneOffset`。前车 = 同路线同车道前方 40 内最近者；`gap = 车道距离`，目标车距 **6**、最小 **4**，`speedFactor = clamp((gap-4)/4, 0, 1)`；不超车、不跨车道。地面生成距任意地面单位 ≥12，每波 1 组（06 落地后资源车队 2–3 辆算 1 组；仍受地面 ≤6 与 D3 的 10–14s 节拍约束；06 之前为单台过渡）。
- 06 未落地（02 属 Wave 1）：临时车道回退——以当前朝向为车道，前车 = 35 内、±25° 扇区内最近地面单位，同样按 gap 限速并做半宽 4 的侧向让位；06 落地后只替换前车来源，不改预算与断言。地面池内容归 06（06 会把 `aa`、`emplacement` 从生成池删除）；02 只负责数量、间隔、车距、回收距离（90，对齐 D6）。

### 3.6 数值基线表（全部可调）

| 类别 | 参数 | 基线 | 说明 |
| --- | --- | ---: | --- |
| 上限 | air / elite / ground / active | 8 / 1 / 6 / 14 | 与 D3 一致，不随画质变化 |
| 预算曲线 | 空中 / 地面 | 4,6,8 / 3,4,6 | 0–30 / 30–90 / 90+ |
| 节奏 | 空中波次间隔 / 单波规模 | 9–13s / 1–2（120s 后 2–3） | 低生命 ×1.5；精英击毁 +4s |
| 节奏 | 地面波次间隔 / 成员错峰 | 10–14s、每波 1 组（06 后车队 2–3 辆）/ 0.35s | 受预算裁剪，余量入队 |
| 生成 | 距离 / 侧向 / 后侧方位 | 34–46 / 55–125° / 125–155° | 相对相机前向（+Z） |
| 生成 | 视口边距 / 与现敌距离 / 开场距离 | 1.15 NDC / 10 / 36、40 | 硬校验；scout / hunter |
| 队列 | 上限 / TTL / 漏出 | 6 / 12s（召唤 6s）/ 0.8s | 不静默丢弃 |
| 回收 | 空中 / 地面 / 精英 | 95、60s / 90、75s / 150s | 淡出 0.8s，当帧释放预算 |
| 分离 | 半径（缩放）/ 混合 / 硬避让 | 7（5.5–12）/ 0.65 / 0.9 | 硬避让 d<0.6R 且接近 |
| 分离 | 权限放大 / 侧向保持 / 近身配额 | +25% / 1.2s / 4 架（<15，绕飞 20） | 防抖与防头顶打转 |
| 编队 / 地面 | 槽位间距 / 护航环绕；目标、最小车距 | ≥10 / 8；6 / 4 | 护航-长机豁免分离；06 路线车道 |
| 事件 | 精英预告 / 重试 / scout 召唤数 | 2s / 5s / 2 | 播报必兑现；召唤可调 1=现状 |

### 3.7 事件与表现（D5/05 接口）

- 02 只产生**数据**，表现由 05 消费；D5 的 `WorldEvent[]` 落地前先写 `Telemetry.record`，同一调用点，落地后改为 push 事件。
- 事件：`wave_started{tag,count,entrySide}`、`elite_incoming{bearing,eta}`、`enemy_spawn{kind,layer,source,dist,bearing}`（测试用）、`enemy_recalled{kind,reason}`、`spawn_dropped{reason,kind}`、`elite_deferred{t}`。
- 精英播报沿用 `World.message("大型信号接近 · 精英空艇", 2.1)`（`World.ts:493-494`），但**仅在整组预算确认成功时**调用；护航 2 架同帧请求。02 不绘制边缘箭头/雷达盘（05 负责）；05 落地后可删 02 的临时 `Renderer.ts:224` 预警线预分配与 `GameApp.ts:377-384` 的“空中目标接近”。

## 4. 改动清单（文件级）

| 文件 | 位置/符号 | 改动 |
| --- | --- | --- |
| `src/data/config.ts` | `RULES.maxEnemies/maxGround`（:7-8） | 替换为 `ENEMY_LIMITS`、`SPAWN`、`SEPARATION`、`GROUND_QUEUE`；保留 `RULES.camera`（:19）供解析相机复用 |
| `src/data/enemies.ts` | `EnemyConfig`（:1-15）、`ENEMIES`（:16-204） | 新增 `spawnRole`（pursuit/harass/heavy/support/value/static）与可选 `slotCost`（默认 1；08 大型轰炸机建议 2） |
| `src/simulation/types.ts` | `Enemy`（:84-110） | 新增 `formationId/slotIndex/avoidSide/avoidSideTimer/standoffTimer/routeId/routeDist/laneOffset` 与导演/波次/预算类型 |
| `src/simulation/SpawnBudget.ts` | 新文件 | 上限、时间曲线、队列与漏出、`snapshot()` |
| `src/simulation/EnemyDirector.ts` | 新文件 | 阶段状态机、模板与权重、呼吸窗口、精英调度 |
| `src/simulation/Separation.ts` | 新文件 | 分离半径/力/混合、对头让行、近身配额、`groundQueue`、统计指标 |
| `src/simulation/ViewportProbe.ts` | 新文件 | 与 Renderer 同源的解析相机、`toNdc/isOutsideView`；Renderer 改为复用 |
| `src/simulation/World.ts` | `updateDirector`（:446-511）、`spawnEnemy`（:512-544） | 委托 `EnemyDirector` 并删除内联生成；`spawnEnemy` 保留为低层夹具（测试/调试），新增 `requestSpawn` 为唯一玩法入口，`:513` 总量闸门由预算替代 |
| 〃 | `updateEnemies`（:545-678） | 转向混入分离（`:559-601`）、攻击门控（`:632-636`）、scout 召唤改 `requestSpawn`（`:571-577`）、回收替换（`:675-677`）、近身配额/头顶不打转；索引用循环替代 `[...this.enemies]`（:547）与 `filter`（:675）以减少每帧分配 |
| 〃 | 开场（:229-231）、字段（:52-55）、`message`（:1400-1403） | 开场改 36/40 侧向 `opening` 请求；计时器迁入 `DirectorState`；`eliteAt` 改 `nextEliteAt/eliteDeferred`；新增 `damageDealt`、`viewportAspect/setViewportAspect` |
| `src/rendering/Renderer.ts` | 相机（:497-510）、预警线（:224） | 相机计算抽成 `battleCameraProbe`；预警线预分配 38 → 14（05 删除后可去掉） |
| `src/app/GameApp.ts` | resize（:97-99）、标签（:359）、边缘提示（:377-384） | resize 写 `world.viewportAspect`；标签上限按 `ENEMY_LIMITS.active`；临时边缘提示对齐 `SPAWN` 并标注“05 替换” |
| `tests/simulation.test.ts`（:298-349 耐久）、新 `tests/enemy-spawn.test.ts` | 现有断言 ≤38（`:331-332`）、峰值 <250（`:340`） | 按 7.1 调整耐久断言；新文件承载 A1–A15 |

## 5. 实现任务拆分

| # | 任务 | 依赖 | 写入范围 | 估时 | 完成判据 |
| --- | --- | --- | --- | ---: | --- |
| T1 | 数据与类型：常量、`spawnRole/slotCost`、`Enemy` 新字段、导演类型 | — | `config.ts`、`enemies.ts`、`types.ts` | 0.5d | `tsc --noEmit` 通过 |
| T2 | `SpawnBudget`：上限、曲线、队列、漏出、快照 | T1 | 新文件 | 1d | queued/dropped/TTL/优先序单测 |
| T3 | `ViewportProbe` + `chooseSpawnPoint` + 4 条生成校验 | T1 | 新文件 | 0.5d | 网格测试生成点全部屏幕外；兜底可达 |
| T4 | `EnemyDirector`：阶段机、模板、权重、呼吸、精英整组 | T2 T3 | 新文件 | 1.5d | 5min 阶段时间线正确、播报必兑现 |
| T5 | World 接线：唯一入口、开场、回收、配额、轰炸暂停、事件 | T2 T4 | `World.ts` | 1d | A1–A8 通过 |
| T6 | `Separation`：力场、优先序、对头让行、编队豁免、头顶不打转 | T1 | 新文件 + `updateEnemies` | 1d | A9/A10 通过；六类转向惯性不变 |
| T7 | `groundQueue`：临时车道 + 06 接口桩 | T1 | 新文件 | 0.5d | A11 通过；06 接口评审通过 |
| T8 | 表现/事件接线 + Renderer/GameApp 适配 | T4 T5 | `Renderer.ts`、`GameApp.ts` | 0.5d | 真机可见预告；无控制台错误 |
| T9 | 新增/修改测试、性能采样 | T5 T6 T7 | `tests/` | 1d | `npm test` 全绿；帧时间不高于基线 |

顺序：T1 → T2/T3 并行 → T4 → T5/T6（T5 先落 World 骨架，T6 再接 `updateEnemies`，避免同文件交叉编辑）→ T7 → T8 → T9；约 7.5 人日。

## 6. 验收标准

### 6.1 自动化断言（固定种子，`tests/enemy-spawn.test.ts`）

| # | 断言 | 阈值 |
| --- | --- | --- |
| A1–A3 | 任意帧空中实体（含精英）≤8 且 slot 占用 ≤8、地面 ≤6、精英 ≤1 | 0 违例 |
| A4 | 任意帧活动总数 ≤14（替换 `simulation.test.ts:331-332` 的 ≤38） | 0 违例 |
| A5 | 0–30s 空中 ≤4/地面 ≤3；30–90s ≤6/≤4 | 0 违例 |
| A6 | scout 8s 后只召唤一次、最多 2 架且不越预算 | 0 越界 |
| A7 | 播报后 2s 内必出现精英；延后时不播报；存活期间无第二艘 | 0 违例 |
| A8 | 所有生成点距玩家 ∈[34,46]、`isOutsideView(1.15)`、与现敌 ≥10 | 0 违例 |
| A9 | 空中非豁免对：无帧 `d < 0.75*(ra+rb)`；p05 ≥4；`clump3`（3 架同 9 圆）= 0 | 0 帧/0 次 |
| A10 | 距玩家 <15 的空中单位 ≤4 | 0 帧 |
| A11 | 同车道地面车距 ≥4（调度后），无重叠 | 0 帧 |
| A12 | 同屏可见空中 ≤6、总数 ≤9（`ViewportProbe`，aspect 0.5625 与 0.75） | 0 帧 |
| A13 | 同 seed 两次 120s 的 `enemy_spawn` 序列完全一致 | 完全一致 |
| A14 | 轰炸模式期间无 `wave` 来源生成；退出后 1.5s 内也不生成 | 0 违例 |
| A15 | `npm test` 全绿（含按 7.1 调整的耐久测试） | 全绿 |

### 6.2 真机/截图验收

1. 360×640 与 430×932 各一，标准档为准、低配档复跑；连打 3 局，每局 ≥3 分钟。
2. 同屏密度：t≈15/60/120/240 截图，可见敌机 ≤6 且轮廓可分辨，任意两架目视不穿插（编队间距至少一个机身长）。
3. 无凭空出现：不出现敌机在视野中央/上方凭空出现；新敌只从侧边进入，进入前有 05 边缘/雷达提示。
4. 精英事件与编队可读：连续 3 次“大型信号”均在 2s 后从侧向出现、无“有提示无敌人”；line/V/escort 进入后 1–2s 内可辨认，护航环绕精英不穿模、护航空隙可辨。
5. 地面车队：轰炸视角下同路线车辆首尾排队、车距 ≥4（06 落地后）；两波之间（≥9s）可完成一次升级选择/轰炸准备而不被打断。
6. 性能与记录：标准档 FPS 不低于 0.3.0 同场景（`#quality-readout`），draw calls <150；低配档数量上限不变、仅表现物减少；失败项记录截图与 `spawn_dropped/elite_deferred/enemy_recalled` 计数作为调参依据。

## 7. 测试与兼容

### 7.1 现有测试的改动

| 测试 | 现状 | 改动 |
| --- | --- | --- |
| `tests/simulation.test.ts:298-349` 五分钟耐久 | 断言 `enemies.length <= maxEnemies+maxGround`（≤38，:331-332）、峰值 <250（:340） | 改为 A1–A4 + A8/A9/A10/A12 统计断言；`peak < 250` 保留，新增 `peakActive <= 14`；复核 `kills > 0`、`level > 1`（敌人变少但金币/经验路线不变） |
| `tests/simulation.test.ts:19-23` `fresh()` 与直接 `spawnEnemy`（:106/:117/:131/:149/:177） | `{director:false}` + 低层生成 | **保持不变**：`spawnEnemy` 明确为无预算夹具，关闭导演时仍可构造任意场景 |
| `tests/flight-dynamics.test.ts:93-113` 六类敌人转向惯性 | 单敌、无邻居，期望转向受限 | 预期无需修改：无邻居时分离力为 0；`turnVelocity <= turnRate` 仍成立（硬避让才放大权限）。如因新字段失败只改夹具，不放松断言 |
| `tests/controls.test.ts`（HUD/摇杆）；`docs/IMPLEMENTATION.md:43`（39 项） | 无影响；测试计数 | 实施时随测试数量更新（本次不改文档） |

### 7.2 性能影响（D10）

- 活动实体峰值 38 → 14（−63%）；分离每步最多 `C(8,2)=28` 对额外计算，可忽略；导演 O(1)、队列 ≤6。
- 去掉每帧分配：`[...this.enemies]`（`World.ts:547`）、`filter`（`:675`）改索引循环 + 原地压缩，避免 GC 抖动。
- 预警线预分配 38 → 14（`Renderer.ts:224`，05 删除后去掉）；标签 `slice(0,30)` → 14（`GameApp.ts:359`）。
- 低配档只削减阴影/标签/粒子，不削减活动敌人数：硬上限是玩法上限，D10 的“按比例减半”按表现预算执行（见第 8 节 Q5）。

### 7.3 与其他文档的接口

- **03 部件**：03 在 `spawnEnemy` 的实体构造处（`World.ts:515-541`）加 `parts`，不改预算；分离半径用 `e.radius` 现算，部件损毁若改变半径自动适配。
- **05 雷达/边缘指示**：消费 `wave_started/elite_incoming` 与生成方向；05 删除 `Renderer.warningLines`（`:224`、`:606-622`）后 02 不再依赖。
- **06 地面路线**：`RouteSystem.sample/assignRoute`、`routeDist/laneOffset` 由 06 提供；02 的 `groundQueue` 在 06 前用临时车道回退；回收距离 90 对齐 D6；地面生成池归 06。
- **07 云 / 08 时代**：屏幕外判定基于相机几何、不读云；08 新机型通过 `radius/slotCost` 适配（大型轰炸机建议 `slotCost=2`，由 08 定）。

## 8. 待确认与备选

| # | 问题 | 推荐 | 理由 |
| --- | --- | --- | --- |
| Q1 | 精英是否计入“空中 8” | **计入**（非精英空中 ≤7） | 否则 8+1+6=15 与 active≤14 冲突；同时保证两条硬上限都可断言 |
| Q2 | 开场 2 架是否走 34–46 屏幕外 | **走**（36/40，约 1–1.5s 后进视野） | 与 D3 一致；配合 05 边缘提示，代价可接受 |
| Q3 | 轰炸模式是否暂停波次释放 | **暂停**（退出后 1.5s 宽限） | 稳定准心是必需时间，不应被新波次打断；D3 未规定，属 02 细化 |
| Q4 | scout 召唤数 1 还是 2 | **基线 2**（可调 1=现状） | `INITIAL_ENEMIES` 写“一组追猎机”；由预算与队列兜底 |
| Q5 | 低画质是否削减活动敌人数 | **不削减** | 保证难度与测试一致；D10 的减半只作用于表现预算 |
| Q6 | 08 大型轰炸机是否占 2 个空中名额 | 预留 `slotCost` 默认 1；一期不启用，二期大型机启用 2 并按 slot 预算断言 | 避免大机型稀释“8 架”的视觉密度预期，同时不破坏一期 A1 |

**难度上限随分数提高的例外**：**建议不设**。D3 的 8/6/1/14 是玩法上限，难度改由编队类型、波次规模（≤3）、精英频率在硬上限内调节；若后期需要，只允许提高“预算曲线到达上限的时间点”，不允许突破硬上限（否则 A1–A4 的“永不超限”断言失效）。

**备选方案**：若真机 8/6 显得太空，**不提高硬上限**，用“编队密度 + 精英护航 + 地面协同”提升威胁（备选 B：2 架 V 编队替代 3 架散兵）；若太挤，把波次规模上限调回 2、间隔拉到 13–15s，仍不放松 A1–A12 断言。
