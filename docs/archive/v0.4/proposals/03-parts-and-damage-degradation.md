# 03 · 部件机制与损毁性能衰减

> 状态：提案（**未实施**，不改现有实现与基线文档）。
> 对应总览需求 #5「敌人也有部件机制」、#6「部件被打掉后性能衰减」（右翼示例原话在下面 §0、§2 引用）。
> 基线：提交 `5b22187` / 0.3.0；行号仅作快速索引，实施以符号名为准。
> 共享约束：遵守 `00-overview.md` 的 D1（统一部件模型）、D2（损毁控制包线，数值硬约束）、D3（敌人上限）、D5（事件总线）、D9（存档）、D10（性能）、D11（测试）。
> 与 01（血瓶/修复包）、02（刷新与避让）、04（加力）、05（告警与击毁反馈）、08（Q 版美术）只约定接口，不重复定义其规则。
> 本文只写这一个文档，不修改源码、测试与其他文档。

## 0. 与 00-overview 的一致性

**D1 统一部件模型**：本文把 `Part` 扩展为玩家与敌人共用的运行时部件，敌人缺省三件套（core + 左右翼），命中统一为“线段扫掠 vs 部件圆”，核心生命归零即击毁，非核心按 `damageTransfer` 分流。差异只在**细化**：补充 `kind/slot/state/hitCircles/damageTransfer` 等字段，`PartRecipe` 增加 `healthShare/lift/thrust/weaponIds/visual`。

**D2 损毁衰减模型**：本文的 `ControlDamage` 字段与 D2 完全一致，数值基线逐项对齐并给出推导：

| D2 硬约束（右翼全毁） | 本文基线值 | 位置 |
| --- | --- | --- |
| 向左滚转权限 ≈15% | `rollAuthorityLeft = 0.15` | §3.4.2 |
| 左转能力 ≈正常的 35% | `turnAuthorityLeft = 0.352`（`0.15^0.55`） | §3.4.3 |
| 向右滚转权限保留 ≈90% | `rollAuthorityRight = 0.90` | §3.4.2 |
| 滚转振荡 0.2–0.3 rad、1.5–2 Hz | 幅值 `0.27 rad`、`1.95 Hz` | §3.4.5 |
| 向缺失翼侧的升力偏置与缓慢偏航漂移 | 目标右倾 `0.08 rad`、右偏 `0.03 rad/s` | §3.4.5 |
| 极速/升力损失 | `engineFactor = 0.94`、`liftAvg = 0.60` | §3.4.2、§3.5.4 |
| 左翼全毁镜像 | 全部左右互换 | §3.4.6 |
| 发动机按左右推力份额形成偏航/滚转偏置 | `thrustBias` 进入 §3.4.4/§3.4.5 | §3.4 |
| 尾翼放大 instability、回正变慢 | `yawStability`、`response ×`、yaw wobble | §3.4.4、§3.5.3 |
| 机头/武器只影响火力与锁定 | `weaponFactor / lockFactor`，不进飞行包线 | §3.4.4 |
| 炸弹舱禁止投弹 | `bombFactor = 0` 时 `canBomb = false` | §3.4.4 |
| 任意组合保留“能跛行返航” | 滚转权限总和 ≥0.25、振荡 ≤0.35 rad、无尾旋 | §3.4.7 |

### 0.1 单一战斗实体管线（强制约束）

所有实体使用同一套运行时战斗接口。`Player`、空中 `Enemy`、地面单位和水面单位都实现 `CombatEntity` 所需的部件、核心生命、局部坐标、武器挂载和部件修订号。空中实体额外消费 `AirMotionState` 与 `ControlDamage`，地面和水面使用各自移动状态。实现中不得保留“玩家一套命中/损毁、敌人另一套命中/损毁”的平行路径。

```ts
interface CombatEntity {
  id: number | string;
  x: number; z: number; heading: number;
  health: number; maxHealth: number;
  parts: Part[];
  damageTransfer: number;
  damage: ControlDamage;
  partRevision: number;
  damageRevision: number;
}

function hitEntity(entity: CombatEntity, projectile: Projectile): HitPart | undefined;
function applyPartDamage(entity: CombatEntity, part: Part, amount: number, hit: HitContext): void;
function evaluateDamage(entity: CombatEntity): ControlDamage;
```

- `hitEntity` 统一完成 broadphase、世界线段到实体局部坐标的转换、部件圆命中、最早交点和穿透顺序。玩家子弹命中敌人、敌方弹道命中玩家、碰撞和爆炸都调用同一命中/伤害入口。
- `applyPartDamage` 统一处理部件生命、核心伤害传递、`disabled/destroyed` 状态、挂载武器失效、`partRevision` 和 `part_destroyed` 事件。玩家和敌人的数值配置可以不同，计算步骤和状态转换不得按 owner 类型分叉。
- `evaluateDamage` 统一从部件健康度计算共享伤害结果。空中实体消费其中的升力、推力、滚转权限、航向稳定、武器、锁定和投弹能力，玩家与空中敌人都进入同一个飞行更新。地面和水面实体不参与升力、滚转或尾翼飞行衰减，只消费发动机、轮组、武器、锁定和核心伤害结果，由各自移动模型映射为速度、路线和火力状态。
- `CombatEntity` 的 `layer/capabilities` 只决定可用的物理通道。地面和水面不会使用默认升力值，也不会接入空中飞行包线。这个映射属于配置，不得复制一套敌人伤害算法。
- 结算方差只允许存在于奖励、掉落、AI 目标选择和表现提示。命中检测、部件损毁、性能衰减、武器失效和核心归零的逻辑保持唯一。

**细化但不冲突的四处**（评审认可后写回总览备注）：

1. `engineFactor` 在 03 后由 `ControlDamage` 聚合，公式形状仍是 `0.5 + 0.5 × 推力项`，供 04 §3.3 的“加力倍率乘在损伤后的极速上”直接使用（§3.5.4）。
2. 敌人 `health/maxHealth` 继续表示**核心生命**，部件生命是额外结构值（与玩家“core 满血 + 翼 30”一致），因此旧 HUD/`Enemy` 字段零迁移；总 TTK 因打部件而略增，见 §3.6.5。
3. 地面单位在 `EnemyConfig.parts` 里**显式配置** core + 武器/机动部件，避免把“翼”语义套在车辆上；若未配置仍按 D1 生成三件套兜底（see §3.2.5）。
4. **投弹模式最大滚转角**由 09/D12 主定义（按机型 + 损伤动态计算，14–36°，单机示意 Wasp 34.7°/Swift 27.8°/Courier 19.6°/Mastodon 16.9°）；03 只在 `updateFlightTurn` 增加 `bankLimit` 参数与 clamp 语义（§3.5.1–3.5.2），不重复定义数值，损伤只会收紧、不会放宽投弹包线。

## 1. 问题与现状

### 1.1 玩家侧：只有一个“对称标量”

- `Part`（`src/simulation/types.ts:14-26`）只有 `id/kind/slot/x/z/radius/health/maxHealth/destroyed/weight/addedMass`，没有 `role/side/lift/thrust/weaponIds`，也不区分左右（`slot` 只是字符串标签）。
- `World` 构造按机型生成 core、左右翼、nose、tail、bay、每台发动机（`World.ts:163-203`），安装升级再追加部件（`World.ts:1173-1211`）。所有部件都参与命中，但只有核心生命进入死亡判定。
- `partFactor(kind)`（`World.ts:332-341`）把**同类部件按剩余生命归并成一个 0..1 标量**，`updatePlayer` 只取两个数：

```ts
// World.ts:396-397（现状）
const engineFactor = 0.5 + this.partFactor("engine") * 0.5;
const wingFactor = 0.65 + this.partFactor("wing") * 0.35;
```

  “右翼全毁”与“双翼各损一半”在 `wingFactor` 上可能得到相近的汇总值，但玩家完全无法从中感知“哪一侧没了”。左右差异只剩升级带来的两个标量 `stats.leftTurn / stats.rightTurn`（`types.ts:60-61`，来源 `upgrades.ts:44-50, 64-69, 111-113`），在 `World.ts:404-409` 乘在转向指令上——它表达的是“升级偏重”，不是“翼没了”。
- `FlightDynamics.flightEnvelope`（`FlightDynamics.ts:8-40`）用对称 `wingFactor` 改 `maxBank/response`；`updateFlightTurn`（`FlightDynamics.ts:42-73`）是纯协调转弯：由误差算 `desiredTurn`，由 `desiredTurn` 反推 `targetBank`，没有左右权限、没有偏置、没有振荡、没有偏航漂移。
- 结论：当前模型只能表达“机动变差了一点”，**不能表达“丢了一侧机翼”**。用户原话要求的三件事——只能向左滚一点点、向左很难拐弯、向右转很不稳定——一件都做不出来。

### 1.2 `destroyed` 语义与规则不一致

`damagePlayer`（`World.ts:922-967`）取命中点最近的部件扣血，但只有 `["winglet","gun","wing"]` 会在生命归零时置 `destroyed = true`（`World.ts:943-946`）；engine / tail / nose / bay 生命到 0 后 `destroyed` 仍为 `false`。而 `hitPlayer`（`World.ts:903-921`）用 `!part.destroyed` 过滤命中部件——于是“已失效的发动机/尾翼/机头”仍然能继续挡子弹；`ProceduralAircraft.ts:350-351` 只用 `destroyed` 决定显隐，断翼以外的失效部件永远“看起来完好”。

更关键的是：tail 部件当前**没有任何玩法后果**；bay 只影响投弹冷却（`World.ts:1357-1362`）；nose 只影响其挂载的武器（`World.ts:717-720`）；engine 的失效只通过对称 `engineFactor` 表达。这与 `docs/systems/02-aircraft-body-damage.md:126-137、165-188` 承诺的“分区后果”不一致。

### 1.3 敌人侧：单条血量圆，打哪都一样

- `Enemy`（`types.ts:84-110`）只有 `health/maxHealth/radius` 三个空间/生命字段；`spawnEnemy`（`World.ts:512-544`）直接从 `ENEMIES[kind].health` 初始化，没有部件。
- 玩家子弹只对一个整体圆做扫掠判定（`World.ts:876-899`），命中后 `damageEnemy` 直接扣总血（`World.ts:968-999`）；爆炸同样只对每个敌人扣一次血（`World.ts:1000-1030`）。`Renderer.createEnemy`（`Renderer.ts:339-444`）用一坨简单几何体拼敌机，没有部件分组/脱落/断口。
- 因此：打机翼、打发动机、打核心**完全等价**；敌人的“目标价值”只剩血条长度，缺少“先卸掉它的转弯能力/火力，再收掉核心”的战术选择；HUD（`GameApp.ts:354-385`，血条在 362 行）也只能显示整条血量。
- 这与 `docs/content/INITIAL_ENEMIES.md:280-295`（“首版至少给以下敌人实现局部部件”）和 `docs/systems/04-enemies-battlefield.md:79-80、156-162` 的设计承诺相冲突。

### 1.4 现状总结

| 反馈/缺口 | 现状根因 | 本文对应 |
| --- | --- | --- |
| 右翼没了却只是“转向参数小一点” | `partFactor` 归并 + 对称 `wingFactor` | §3.4 左右分离包线 |
| 左滚/左转/右转不稳无法表达 | 无方向权限、无振荡、无偏航偏置 | §3.2.3、§3.4.5 |
| 打掉尾翼/机头/炸弹舱没感觉 | 这些部件无玩法后果；`destroyed` 不一致 | §3.2.3、§3.4.4 |
| 敌人打哪都一样 | 单血量圆 | §3.2、§3.3、§3.6 |
| 部件脱落反馈缺失 | Renderer 只按整机拼模型 | §3.7 |
| 文档说“左右不对称”但代码没有 | `docs/systems/02:110-122` 的 `lateralBias` 从未实现 | §3.2 权重/份额模型 |

## 2. 目标体验

**一句话验收**：右翼脱落后 1 秒内，玩家能通过视觉（断口、冒烟、滚转抖动）+ 操控（左滚无力、左转很钝、右转“一会儿大一会儿小”）理解“我只剩一只翅膀”，并仍能把飞机改平、跛行返航；打敌人时，瞄翼可以卸掉它的转弯和火力，瞄核心可以更快击毁。

- **玩家侧**：部件是“看得见、摸得着”的损失。丢失右翼后：只能向左滚一点点（约 15% 滚转权限）；向左很难拐弯（转向指令约 35%）；向右滚转权限还在（约 90%），但叠加 0.2–0.3 rad、1.5–2 Hz 的振荡，表现为“滚转一会大一会儿小”；同时有轻微右倾和向右的缓慢偏航；极速下降约 6%。左翼缺失完全镜像。
- **敌人侧**：所有敌人都有核心与可破坏部件。打掉轰炸机一侧发动机 → 它变慢并向右偏；打掉追猎机机翼 → 它转不动、开始逃；打掉精英炮塔 → 对应方向停火；打掉核心 → 击毁。玩家能形成“先致残、再击杀”的优先级。
- **可读性**：部分伤害用平滑曲线，避免“50% 血突然断崖”；真正归零的那一下允许阶跃，但必须有脱落动画/音效/事件提示补足。任何组合都保留“能飞回去”的包线，不进入不可恢复尾旋。
- **性能**：全部在模拟层完成，不依赖 Three.js；敌人上限按 D3（空中 8、地面 6、精英 1、活动 ≤14）；标准档 360×640 / 中端机 60 FPS 目标不变（D10）。

## 3. 目标设计

### 3.1 坐标、符号约定与“右翼缺失”推导（实施前必读）

**坐标**沿用 `docs/systems/02-aircraft-body-damage.md:14-24`：`+X = 右`、`-X = 左`、`+Z = 前`、`-Z = 后`、`+Y = 上`。`heading = 0` 朝 `+Z`；`vx = sin(heading) × speed`、`vz = cos(heading) × speed`（`World.ts:441-442`）。因此 **heading 增大 = 俯视顺时针 = 向右转**。

**bank 符号**（本文的强制约定，与现有实现一致）：

- `bank > 0`：左倾、左滚、向左转；
- `bank < 0`：右倾、右滚、向右转；
- 证据：`FlightDynamics.ts:56-60` 用 `targetBank = -atan2(speed × desiredTurn, g)`，右转时 `desiredTurn > 0` 得到负 bank；测试 `tests/flight-dynamics.test.ts:60-69` 断言 `side = 1`（右转）时 `sign(bank) === -1`。视觉上 `group.rotation.set(0, heading, bank)`（`ProceduralAircraft.ts:386`）绕 `+Z` 正转会把 `+X`（右翼）抬起，也是左倾。
- **实施陷阱**：`rollAuthorityLeft` 指“向**左**滚转的能力”，不是“左翼提供的权限”；`turnAuthorityRight` 指“向**右**转的能力”。两者不要混用。

**右翼缺失的力矩推导**（用于防止实施时方向搞反）：

1. 右翼缺失后，右侧升力只剩机身的兜底份额 `liftRight = 0.20`，左侧 `liftLeft = 1.00`（§3.4.1）。
2. 左翼在局部 `-x₀` 处产生 `+Y` 升力 `L_L`，右翼在 `+x₀` 处产生 `L_R`。绕 `+Z` 的力矩 `M_z = r_x·F_y = (-x₀)L_L + (+x₀)L_R = x₀(L_R - L_L) < 0`。
3. `M_z < 0` 使 `bank` 减小，即**飞机向右（缺失翼侧）滚转**。这就是“向缺失翼侧的升力偏置”的方向：右翼缺失 → 目标 bank 向负方向偏 `0.08 rad`。
4. 要向**左**滚（增大 bank），只能靠左翼副翼上偏产生正力矩，而右翼副翼已随翼脱落；它还要先抵消上面的负力矩。这就是左滚权限只剩 15% 的来源。
5. 偏航同理：左翼升力/阻力更大，机头被拉向右侧，`heading` 缓慢增大（右偏 `0.03 rad/s`）。
6. 左翼缺失：上述全部符号取反（`liftBias` 变负、bank 偏置为正、偏航向左）。

**代码符号映射清单**：

| 量 | 正值含义 | 实施 | 典型符号 |
| --- | --- | --- | --- |
| `liftBias = (liftLeft - liftRight)/2` | 左升力更大 → 自然右滚 | `rollAuthorityLeft = rollBase - GAIN × liftBias` | 右翼缺失 → `+0.40` |
| `rollBias`（目标 bank 偏置） | 向右倾（bank 减） | `targetBank -= rollBias` | 右翼缺失 → `-0.08 rad` |
| `yawDrift` | heading 增大（右偏） | `heading += yawDrift × dt` | 右翼缺失 → `+0.03 rad/s` |
| 滚转需求 `need = targetBank - bank` | `need > 0` = 需要左滚 | `auth = need > 0 ? rollAuthorityLeft : rollAuthorityRight` | — |

### 3.2 统一部件模型

#### 3.2.1 类型定义（`src/simulation/types.ts`）

D1 的字段是该结构的**下限**；下面 `// +` 为本文补充、用于命中/衰减/表现：

```ts
export type PartRole =
  | "core" | "wing" | "engine" | "tail" | "gun" | "bay"
  | "turret" | "float" | "radar";
export type PartDamageState =
  "intact" | "damaged" | "critical" | "disabled" | "destroyed";

export interface Part {
  // D1 必需
  id: string;
  role: PartRole;
  side: -1 | 0 | 1;
  x: number; z: number; radius: number;
  health: number; maxHealth: number;
  destroyed: boolean;
  lift: number; thrust: number;          // 该部件提供的升力/推力份额（满血标称值）
  weaponIds: string[];                    // 挂载的武器 id，和为 0 表示无火力
  visual: { kind: string; scale: number; detachable: boolean };
  // + 兼容/实现补充
  kind: string;                           // 旧字段，迁移期保留：wing/winglet/gun/...
  slot: Slot;                             // 旧字段，迁移期保留
  state: PartDamageState;
  disabled: boolean;                      // state === "disabled" 的便捷位
  damageTransfer: number;                 // 0..1，非核心部件把多少伤害转给核心
  hitCircles?: { x: number; z: number; r: number }[]; // 大翼展多圆；缺省用 x/z/radius
  weight: number; addedMass: number;      // 沿用旧质量字段
  detachSeed: number;                     // 渲染脱落相位，avoid 同帧同姿态
}
```

`Player`（`types.ts:27-49`）与 `Enemy`（`types.ts:84-110`）新增 `damage: ControlDamage`、`partRevision: number`（任何部件生命/状态变化时 +1，用于懒重算）与 `damageRevision: number`。`ControlDamage` 放 `types.ts` 导出，`DamageModel` 再 re-export，避免循环依赖。

#### 3.2.2 共享 `PartRecipe`（`src/data/parts.ts` 新建）

```ts
export interface PartRecipe {
  role: PartRole;
  side?: -1 | 0 | 1;
  kind?: string; slot?: Slot;             // 旧升级数据可省略，由 role 推断
  x?: number; z?: number; radius?: number; // 本地坐标；敌人 recipe 用相对 e.radius 的比例
  health?: number;                         // 绝对值：玩家升级/基础部件
  healthShare?: number;                    // 占总生命比例：敌人 recipe（二选一）
  lift?: number; thrust?: number;          // 满血份额，缺省按 role 推断
  weaponIds?: string[];
  damageTransfer?: number;
  visual?: { kind: string; scale: number; detachable: boolean };
  weight?: number;
}
```

- 玩家基础部件与升级部件统一走 `createPlayerParts(frame)` / `partFromRecipe(recipe, ctx)`（`src/simulation/parts.ts` 新建）。
- 敌人走 `createEnemyParts(config)`：`c.parts?.length` 时按 recipe 生成，否则生成 D1 默认三件套。
- 旧数据迁移：`upgrades.ts:2-9` 的 `PartRecipe` 改为从 `data/parts.ts` re-export；升级条目的 `kind/slot/health` 不动，由 `inferRole(kind, slot)` 补全 role/side/lift/thrust/visual，**无需逐条改 23 个升级数据**。

#### 3.2.3 角色、份额与权重约定

| role | side 用法 | lift 默认 | thrust 默认 | damageTransfer 基线（按部件配置） | 典型 detachable |
| --- | --- | --- | --- | --- | --- |
| `core` | 0 | 0（机身升力由 floor 表达） | 0 | 核心本体 | 否 |
| `wing` | -1 / +1 | 1.0（翼根）/ 0.8（巨型外翼）/ 0.3（翼尖） | 0 | 1.0 / 0.5 | 是 |
| `float` | -1 / +1 | 1.0 | 0 | 1.0 / 0.5 | 是 |
| `engine` | -1 / 0 / +1 | 0 | 1.0/台（side 0 的双侧各分 0.5） | 1.0 / 0.35 | 玩家否（disabled）；敌人是 |
| `tail` | 0 | 0 | 0 | 1.0 / 0.2 | 玩家否；精英是 |
| `gun` / `turret` | -1 / 0 / +1 | 0 | 0 | 1.0 / 0.15 | 玩家否；敌人部分可 |
| `bay` | 0 | 0 | 0 | 1.0 / 0.2 | 否 |
| `radar` | 0 | 0 | 0 | 1.0 / 0.1 | 否 |

- 每侧升力份额：`wingEff_s = Σ(role ∈wing/float, side=s) lift_i × hc_i ÷ Σ lift_i`；`lift_s = 0.20 + 0.80 × wingEff_s`。该公式只对空中实体生效。地面和水面实体不计算 `lift_s`，由各自移动模型消费轮组、发动机、船体或舵机状态。
- 每侧推力份额：`thrust_s = Σ thrust_i × sideShare_i × hc_i ÷ Σ thrust_i × sideShare_i`，`side = 0` 的发动机把 `thrust_i` 各分 0.5 给左右；没有发动机部件的敌人两侧都取 1（“引擎可选精细化”）。
- 玩家部件权重 `weight/addedMass` 只影响 `flightEnvelope` 的惯量/翼载，不参与左右偏置（偏置由份额与健康度决定）。
- **大型多翼/多发（08 §3.4.7 利维坦流）**：新增翼层用 `role="wing"` + `visual.kind="wingDeck"` 表达，位置/半径由工厂按当前翼展扩展并生成 2–3 个 `hitCircles`；新增发动机短舱用 `role="engine"`、炮塔用 `role="turret"`；它们自动进入 `lift/thrust/weaponIds` 份额与 `flightEnvelope` 的质量/惯量计算，从而自然降低 `response` 并收紧 09 的投弹包线，不需要为利维坦写专属规则。

#### 3.2.4 玩家基础构型（保持 0.3.0 数值，`World.ts:163-203` 抽到工厂）

| 部件 | role/side | 生命 | lift | thrust | 可脱落 | 备注 |
| --- | --- | ---: | ---: | ---: | --- | --- |
| core | core/0 | `frame.health` | 0 | 0 | 否 | 生命与 `player.health` 双向同步 |
| left_wing / right_wing | wing/−1、+1 | 30 | 1.0 | 0 | 是 | 位置/半径沿用 `0.23×wingspan`、`0.16×wingspan` |
| nose | gun/0 | 24 | 0 | 0 | 否 | 机头炮绑定 `weaponIds` |
| tail | tail/0 | 28 | 0 | 0 | 否 | 生命归零 = 方向舵失效 |
| bay | bay/0 | 30 | 0 | 0 | 否 | 生命归零 = 禁止投弹 |
| engine_i | engine/… | 30/台 | 0 | 1.0/台 | 否 | 位置沿用 `World.ts:187-203`，继承 `frame.engines` |
| top_turret（部分机型） | turret/0 | 30 | 0 | 0 | 否 | `frame.turret` 时生成 |

升级部件通过 recipe 追加（发动机 28 HP、火炮 18 HP、巨型翼 45 HP、炸弹舱 24 HP 等，见 `upgrades.ts:28-33、98、112、139、153、166、197、214、228、242、255、268、282、295、307、319、344、358`），生命独立，不因升级重置；修复包只恢复生命，不重装、不重置上限。

#### 3.2.5 敌人默认三件套与可选精细化

```ts
// 缺省生成（air）——满足 D1“所有敌人都有部件”
core:  { role: "core", x: 0,        z: 0, radius: 0.55r, healthShare: 1.0, visual: { kind: "core", scale: 1, detachable: false } }
left:  { role: "wing", side: -1, x: -0.62r, z: 0, radius: 0.45r, healthShare: 0.20, lift: 1, damageTransfer: 0.50,
         visual: { kind: "wing", scale: 1, detachable: true } }
right: { role: "wing", side: +1, x: +0.62r, z: 0, radius: 0.45r, healthShare: 0.20, lift: 1, damageTransfer: 0.50,
         visual: { kind: "wing", scale: 1, detachable: true } }
```

- `r = config.radius`；坐标与半径按比例缩放，`healthShare × config.health` 为部件生命。核心生命仍等于 `config.health`，所以 `Enemy.health/maxHealth` 语义不变。
- 精细化示例（轰炸机）：core + 2×wing + 2×engine（`healthShare 0.15`、thrust 1、detachable）+ tail（0.12、yawStability 载体）+ bay（0.15、bombFactor 载体）；精英：core + 2×侧舷吊舱（wing）+ 2×引擎 + 尾舵 + 2×炮塔。
- 地面单位：`layer === "ground"` 的敌人**显式配置** `parts`（core + gun/bay/engine），不生成“翼”；若旧数据未配置，仍按 D1 三件套兜底，但 `side` 部件在视觉上映射为轮组/侧甲，仅做伤害分担与武器/移动失效。
- 坐标约定与玩家一致：`+Z` 前、`+X` 右；渲染只读 `Part`，不自行推断损坏。

#### 3.2.6 旧数据迁移规则

1. `kind`/`slot` 全部保留为兼容字段；`role = inferRole(kind, slot)`、`side = inferSide(slot)` 在工厂里补齐。映射：wing/winglet→wing；engine→engine；gun/cannon/tailGun→gun；tail→tail；bombBay→bay；turret→turret；radar→radar；armor/frame/cooler/ammo/reactor/其他→core（结构件，不产生功能）。
2. `visual.kind` 缺省 = `kind`，`visual.detachable` 按 role 默认表（§3.2.3）；`ProceduralAircraft`/`Renderer` 从按 `part.id` 写死改为按 `role/side/visual.kind` 分支。
3. 敌人 `EnemyConfig.parts?` 可选；旧配置零改动即可编译（自动三件套）。
4. `stats.leftTurn/rightTurn` 保留（升级带来的“偏重”乘数），与损毁的方向权限**乘算**：`最终左转权限 = 损毁 turnAuthorityLeft × stats.leftTurn`。
5. `Player.revision` 仍只用于升级重建几何；新增 `partRevision` 只用于 DamageModel 懒重算，二者不要混用。
6. 存档无变化（D9）：部件只在局内运行时存在，不写入 `SaveData`。

### 3.3 命中判定、伤害分流与死亡

#### 3.3.1 线段扫掠 vs 部件圆

沿用玩家 `hitPlayer`（`World.ts:903-921`）的局部变换思路，抽成共用 helper：

```ts
// 世界线段 -> 实体局部：与 hitPlayer 相同的旋转（只考虑 heading，不考虑 bank，保持 0.3.0 判定）
function localSegment(e: { x; z; heading }, from, to) {
  const sin = Math.sin(e.heading), cos = Math.cos(e.heading);
  const ax = (from.x - e.x) * cos - (from.z - e.z) * sin;
  const az = (from.x - e.x) * sin + (from.z - e.z) * cos;
  const bx = (to.x - e.x) * cos - (to.z - e.z) * sin;
  const bz = (to.x - e.x) * sin + (to.z - e.z) * cos;
  return { ax, az, bx, bz };
}

// 返回最早交点的部件；t 为线段参数 [0,1]
function hitPart(parts: Part[], seg): { part: Part; t: number } | undefined {
  for (const part of parts) {
    if (part.destroyed) continue;                       // destroyed 不再参与命中
    const circles = part.hitCircles ?? [{ x: part.x, z: part.z, r: part.radius }];
    for (const c of circles) {
      const d = segmentDistance(c.x, c.z, seg.ax, seg.az, seg.bx, seg.bz);
      if (d <= c.r + PROJECTILE_RADIUS) {
        const t = projectT(c.x, c.z, seg);              // 最近点参数，用于取最早命中
        candidate = earliest(candidate, { part, t });
      }
    }
  }
  return candidate;
}
function hitEntity(entity: CombatEntity, v: Projectile) {
  return hitPart(entity.parts, localSegment(entity, v.prev, v));
}
```

- **优先级**：穿透/爆炸前先做实体包围圆 broadphase（`distance(e, seg) > e.radius + maxPartRadius` 直接跳过）；部件按**最早交点 t** 命中（子弹从哪一侧先碰到哪块），`t` 相同则 core 优先，再按 `part.id` 字典序，保证确定性。
- **多圆**：大翼展部件（玩家 `giant_wing`、轰炸机/精英翼、飞艇吊舱）用 `hitCircles`（根/中/尖 2–3 个圆）；普通翼仍单圆，命中面积与 0.3.0 一致，避免难度漂移。
- `updateProjectiles` 对玩家和敌人都调用 `hitEntity`，再把返回的 `{ part, t }` 传给同一个 `applyPartDamage`。碰撞、持续伤害等无扫掠来源也调用同一函数，只是命中部件由伤害点最近部件解析。
- `hitIds` 的语义是“本弹已命中过的实体 id”，同一实体内由 `pierce` 决定能否再穿到下一块部件（§3.3.3）。

#### 3.3.2 伤害分流

```ts
function applyPartDamage(owner, part: Part, amount: number, opts) {
  if (part.role === "core") { core.health -= amount; syncHealth(owner); return; }
  part.health = max(0, part.health - amount);
  const transfer = owner.damageTransfer * part.damageTransfer;
  core.health = max(0, core.health - amount * transfer);
  if (part.health === 0) {
    part.state = part.visual.detachable ? "destroyed" : "disabled";
    part.destroyed = part.state === "destroyed";
    emit("part_destroyed", { owner, partId: part.id, role: part.role, side: part.side });
  } else {
    part.state = stateFor(part);                          // damaged/critical
  }
  owner.partRevision++;
}
```

- `damageTransfer` 是部件配方上的数据。玩家可由机体/升级提供 `entity.damageTransfer` 修正，敌人可由防御配置提供同名修正，但两者都调用同一个乘法步骤。首轮基线仍为玩家核心传递系数 0.7，敌人翼 0.5、引擎 0.35、尾 0.2、武器 0.15、舱 0.2。
- 实现禁止出现 `owner.kind === "player"` 与 `owner.kind === "enemy"` 的两套伤害分支。若需要重甲或装甲差异，使用 `CombatEntity.damageTransfer` 或 `Part.damageTransfer` 输入同一函数。
- `stateFor(part)` 阈值沿用 02：`intact > 70%`、`damaged 40–70%`、`critical 1–40%`、`disabled 0%（不可脱落）`、`destroyed 0%（可脱落/被炸断）`。
- **玩家核心**：`player.health` 与 core 部件每步同步（现有 `World.ts:387-391、950-954` 保留），死亡判定仍是 `player.health <= 0`；玩家可脱落部件的 `destroyed` 不会再自动重装（01 的修复包也明确不重装）。
- **敌人核心**：core 生命 = `Enemy.health`；归零走现有击毁分支（`World.ts:974-998`：kills/score/xp/掉落/精英补给），HUD 血条与 `GameApp.updateLabels` 不需要改字段。

#### 3.3.3 穿透、爆炸与持续伤害

- **穿透**：`pierce > 0` 时同一次弹道可穿过同一敌人最多 `1 + pierce` 块不同部件（同一部件只命中一次）；命中第一块后继续沿原方向判定余下部件；跨敌人仍沿用现有 `hitIds` 逻辑（`World.ts:876-899`）。
- **爆炸**：`explode`（`World.ts:1000-1030`）改为对范围内每块部件各结算一次伤害：`damage × max(0.3, 1 - d_part / (radius × 1.42))`，`d_part` 是爆炸点到部件圆的距离；同一次爆炸最多把 **2 块可脱落部件**打成 `destroyed`（其余只到 disabled/0 血），保证画面可读与 D10 特效预算；核心照样吃传递伤害。
- **持续伤害（燃烧/火焰区）**：`burn`/`fires`（`World.ts:552-555、1332-1338`）默认只打核心，保证 DoT 可预期、不随机拆部件；导弹/火箭的 `explosion` 走上面的多部件结算。
- **反弹**：`bounce` 保留现有“按命中点反射”逻辑，反射法线使用被命中部件位置（`World.ts:892-896` 改为部件坐标）。
- **装甲穿透（armorBreak）**：继续乘 1.25，只作用于核心与命中部件，不额外放大传递系数。

#### 3.3.4 命中优先级与性能预算

- 敌人上限按 D3：空中 ≤8、地面 ≤6、活动 ≤14；空中 ≤8 时 O(实体 × 部件) 完全可接受。按最坏情形估算：140 发弹 × 14 实体 broadphase + 只有通过 broadphase 的实体做 ≤8 部件圆判定；每帧约 2k 次 `segmentDistance`，远低于预算。
- 玩家：7–30 个部件，命中判定 O(parts)（与现状相同量级）。
- DamageModel 只在 `partRevision !== damageRevision` 时重算（受伤/升级/修复时），振荡/偏置数值在两次命中之间恒定；每步最多重算玩家 + 被击中的敌人，正常帧 0 次。
- 命中判定与 DamageModel 内不分配数组/对象（复用 scratch、返回实体缓存的 `damage`），避免 GC。

### 3.4 损毁衰减模型（`src/simulation/DamageModel.ts` 新建）

#### 3.4.1 健康曲线与每侧升力

```ts
const hc = (part: Part) => part.health <= 0 ? 0 : PARTIAL_FLOOR + (1 - PARTIAL_FLOOR) * smoothstep(part.health / part.maxHealth);
// smoothstep(h) = h*h*(3 - 2*h)，PARTIAL_FLOOR = 0.35
const wingEff = side => clamp(Σ lift_i * hc_i / Σ lift_i, 0, 1);   // 该侧 wing/float 部件
const lift_s  = 0.20 + 0.80 * wingEff_s;                            // 每侧升力 0..1
const liftAvg = (liftLeft + liftRight) / 2;
const liftBias = (liftLeft - liftRight) / 2;                        // 正 = 左升力大 = 自然右滚
```

- 选 `smoothstep` 而非线性：0–50% 的伤害衰减前慢后快、50% 处刚好一半，不会有敏感阈值；`PARTIAL_FLOOR = 0.35` 表示结构受损但未脱落时仍保留最低限度的升力/操纵面。
- **允许阶跃的地方只有“归零/脱落”那一下**：`hc = 0`，靠脱落动画、冒烟、音效与 `part_destroyed` 事件补偿可读性。部分伤害（50% 血）不会断崖。

#### 3.4.2 左右滚转权限

```ts
const rollBase = AILERON_RESIDUAL + (1 - AILERON_RESIDUAL) * (wingEffLeft + wingEffRight) / 2;
// AILERON_RESIDUAL = 0.05（只剩残存调整片/机身贡献）
let rollAuthorityLeft  = clamp(rollBase - LIFT_BIAS_ROLL_GAIN * liftBias, MIN_ROLL_EACH, 1);
let rollAuthorityRight = clamp(rollBase + LIFT_BIAS_ROLL_GAIN * liftBias, MIN_ROLL_EACH, 1);
// LIFT_BIAS_ROLL_GAIN = 0.9375 = 15/16，MIN_ROLL_EACH = 0.05
```

校准代入（右翼全毁：`wingEffRight = 0`、`liftRight = 0.20`）：

```text
rollBase = 0.05 + 0.95 × (1 + 0)/2 = 0.525
liftBias = (1.00 - 0.20)/2 = 0.40
rollAuthorityLeft  = 0.525 - 0.9375 × 0.40 = 0.15   ← D2“向左滚转 ≈15%”
rollAuthorityRight = 0.525 + 0.9375 × 0.40 = 0.90   ← D2“向右滚转 ≈90%”
```

**地板保护**：若 `rollAuthorityLeft + rollAuthorityRight < 0.25`，按比例放大到总和 0.25（两翼全毁 → 0.125 / 0.125），保证任何组合都还能改出滚转（§3.4.7）。

#### 3.4.3 左右转向能力

```ts
const TURN_AUTHORITY_EXP = 0.55;
turnAuthorityLeft  = rollAuthorityLeft  ** TURN_AUTHORITY_EXP;
turnAuthorityRight = rollAuthorityRight ** TURN_AUTHORITY_EXP;
```

- `0.15^0.55 = 0.352` → **左转能力 ≈ 正常的 35%**（D2）；`0.90^0.55 = 0.944` → 右转指令约 94%，但受升力包线、振荡与偏置影响，实际可用右转明显低于 94%（§3.5）。
- 转向权限只约束“转向指令上限”，不再额外乘总升力因子（否则单侧翼毁会跌到 21%，与 D2 的 35% 冲突）。升力损失通过 `maxBank/response` 体现（§3.5.1）。
- 最终乘算：`turnLimit = stats.turnRate × RAD × (轰炸 ? 0.65 : 1) × stats.dirTurn × turnAuthority_dir`；`stats.leftTurn/rightTurn` 继续叠加（升级带来的偏重）。

#### 3.4.4 推力、尾翼、火力、锁定与炸弹舱

```ts
thrust_s  = Σ (thrust_i × sideShare_i × hc_i) / Σ (thrust_i × sideShare_i);  // 0..1
W_s       = Σ thrust_i × sideShare_i;                                        // 标称权重
thrustFactor = (thrustLeft × W_L + thrustRight × W_R) / (W_L + W_R);
thrustBias   = (thrustLeft × W_L - thrustRight × W_R) / (W_L + W_R);        // 正 = 左推力大 = 右偏/横滚

tailEff      = 有 tail 部件 ? Σ hc_i / count : 1;
yawStability = 0.20 + 0.80 * tailEff;                                        // 尾翼全毁 = 0.20
noseEff      = 有 side===0 的 gun/radar 部件 ? Σ hc_i / count : 1;   // 只算机头设备，翼炮不影响锁定
lockFactor   = 0.40 + 0.60 * noseEff;                                        // 机头/雷达全毁 = 0.40（锁定慢 2.5×）
bombFactor   = 有 bay 部件 ? Σ hc_i / count : 1;                             // 炸弹舱全毁 = 0（禁止投弹）
weaponFactor = Σ mountWeight_i × hc_i / Σ mountWeight_i;                     // 0 = 全部火力失效
```

- `engineFactor`（供 04 使用，World 速度/加速度一致口径）：
  `engineFactor = (0.5 + 0.5 × thrustFactor) × (0.85 + 0.15 × liftAvg)`；完好 = 1；Swift 单发全毁 = 0.50；Courier 单侧发动机全毁 = 0.75；右翼全毁 = 0.94。
- `canBomb`（`World.ts:318-325`）条件 `partFactor("bombBay") > 0` 改为 `bombFactor > 0`；投弹冷却中的 `(1 - partFactor("bombBay")) × 2`（`World.ts:1357-1362`）改为 `(1 - bombFactor) × 2`。
- `lockFactor` 接入 `World.updateWeapons` 的锁定速度（`World.ts:742-750`）：`dt / (max(0.35, lockTime + stats.lockTime) / lockFactor)`；`weaponFactor` 只用于 HUD/总结算，单件武器失效仍由 `RuntimeWeapon.partId` 对应部件 `health <= 0` 决定（`World.ts:714-720`），二者不重复扣伤害。
- 尾翼不参与 `engineFactor`（不做极速惩罚）；它只放大 instability、拖慢回正、增加航向摆动（§3.4.5）。

#### 3.4.5 不稳定性、滚转振荡、升力/推力偏置与偏航漂移

```ts
coreRatio = core.health / core.maxHealth;
instability = clamp(
  0.65 * (2 * abs(liftBias))            // 左右升力失衡
+ 0.45 * (1 - (wingEffLeft + wingEffRight) / 2)  // 翼面缺失总量
+ 0.50 * (1 - yawStability)             // 尾翼
+ 0.35 * abs(thrustBias)                // 推力失衡
+ 0.60 * (1 - liftAvg)                  // 总升力损失
+ 0.25 * (1 - coreRatio),               // 核心带伤
  0, INSTABILITY_MAX /* 0.90 */);

oscDirWeight = 向受损侧滚转 ? 1.0 : 无输入 ? 0.6 : 0.7;
oscAmp   = min(ROLL_OSC_MAX /* 0.35 */, ROLL_OSC_GAIN /* 0.30 */ * instability) * oscDirWeight;
oscFreq  = 1.50 + 0.50 * instability;   // 1.50–1.95 Hz
oscPhase = hash(partStates) + entity.id; // 确定性，同种子可复现
rollOsc  = oscAmp * sin(2π * oscFreq * time + oscPhase);  // 加在 targetBank 上

rollBias = clamp(0.20 * abs(liftBias) + 0.10 * abs(thrustBias), 0, 0.10); // rad
yawDrift = clamp(0.075 * abs(liftBias) + 0.05 * abs(thrustBias), 0, 0.08)
         * (1 + 0.5 * (1 - yawStability));                                 // rad/s
```

- **方向与带符号值**：`rollBiasSigned = -sign(liftBias + 0.5 × thrustBias) × rollBias`（右翼缺失 → `-0.08 rad`，即目标右倾）；`yawDriftSigned` 同号取正（右翼缺失 → `+0.03 rad/s`，约 1.7°/s）。两者都**不接管玩家输入**，只作为持续偏置，允许玩家用摇杆修正。
- **`oscDirWeight`**：向受损侧滚转（右翼缺失时右滚）= 1.0；无滚转输入 = 0.6；向完好侧滚转（左滚）= 0.7。右翼全毁的右滚振荡 = `0.30 × 0.90 × 1.0 = 0.27 rad`（D2 的 0.2–0.3 rad），频率 `1.50 + 0.50 × 0.90 = 1.95 Hz`（D2 的 1.5–2 Hz）。
- **分级可读**：对称的 50% 机翼损伤：`wingEff = 0.675`、`liftAvg = 0.74`、`roll = 0.691`、`turn = 0.816`、`instability = 0.302`、`oscAmp = 0.091 rad`——明显变钝但不抖；只有脱落才进入大幅振荡。
- 单侧发动机全毁（Courier，两侧各 1 台）：`thrustBias = 0.5`、`engineFactor = 0.75`、`instability = 0.175`、`oscAmp = 0.053 rad`、`rollBias = 0.05 rad`、`yawDrift = 0.025 rad/s`（约 1.4°/s）——推力偏置为主，振荡为辅。

#### 3.4.6 基线数值总表（全部“基线可调”）

| 情形 | liftL / liftR | rollL / rollR | turnL / turnR | thrustL / thrustR | yawStab | instability | osc 幅值 | osc 频率 | rollBias | yawDrift | engineFactor |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 完好 | 1.00 / 1.00 | 1.00 / 1.00 | 1.00 / 1.00 | 1.00 / 1.00 | 1.00 | 0 | 0 | — | 0 | 0 | 1.00 |
| **右翼全毁** | **1.00 / 0.20** | **0.15 / 0.90** | **0.352 / 0.944** | 1.00 / 1.00 | 1.00 | **0.90** | **0.27 rad** | **1.95 Hz** | **0.08 rad 右** | **0.03 rad/s 右** | **0.94** |
| 左翼全毁 | 0.20 / 1.00 | 0.90 / 0.15 | 0.944 / 0.352 | 1.00 / 1.00 | 1.00 | 0.90 | 0.27 rad | 1.95 Hz | 0.08 rad 左 | 0.03 rad/s 左 | 0.94 |
| 双翼全毁 | 0.20 / 0.20 | 0.125 / 0.125（总和地板） | 0.319 / 0.319 | 1.00 / 1.00 | 1.00 | 0.90 | 0.27 rad | 1.95 Hz | 0 | 0 | 0.88 |
| 双翼各 50% | 0.74 / 0.74 | 0.691 / 0.691 | 0.816 / 0.816 | 1.00 / 1.00 | 1.00 | 0.302 | 0.091 | 1.65 Hz | 0 | 0 | 0.961 |
| 右发全毁（Courier） | 1.00 / 1.00 | 1.00 / 1.00 | 1.00 / 1.00 | 1.00 / 0.00 | 1.00 | 0.175 | 0.053 | 1.59 Hz | 0.05 rad 右 | 0.025 rad/s 右 | 0.75 |
| 尾翼全毁 | 1.00 / 1.00 | 1.00 / 1.00 | 1.00 / 1.00 | 1.00 / 1.00 | **0.20** | 0.40 | 0.12 | 1.70 Hz | 0 | 0（wobble 主导） | 1.00 |
| 机头/雷达全毁 | 不变 | 不变 | 不变 | 不变 | 1.00 | 0 | 0 | — | 0 | 0 | 1.00（火力/锁定受影响） |
| 炸弹舱全毁 | 不变 | 不变 | 不变 | 不变 | 1.00 | 0 | 0 | — | 0 | 0 | 1.00（禁止投弹） |

> 表中“滚转权限”= 玩家向该方向滚转时使用的权限，不是“该侧机翼提供的权限”；这是 §3.1 符号约定的一部分。

**机翼部分损坏曲线**（两侧同时、对称受伤；`hc` 经 smoothstep + floor）：

| 机翼生命 | `hc` | 每侧 lift | roll（每向） | turn（每向） | instability | osc 幅值 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 100% | 1.000 | 1.000 | 1.000 | 1.000 | 0 | 0 |
| 75% | 0.898 | 0.919 | 0.904 | 0.946 | 0.095 | 0.028 |
| 50% | 0.675 | 0.740 | 0.691 | 0.816 | 0.302 | 0.091 |
| 25% | 0.452 | 0.561 | 0.479 | 0.667 | 0.510 | 0.153 |
| 1% | ≈0.350 | 0.480 | 0.383 | 0.588 | 0.604 | 0.181 |
| 0%（脱落） | 0（阶跃） | 0.200 | 0.150（单侧） | 0.352（单侧） | 0.90 | 0.270 |

#### 3.4.7 组合保护：任何组合都能跛行返航

1. **滚转权限总和下限 0.25**：低于时按比例放大（保持左右比例），两翼全毁 = 0.125/0.125。
2. **振荡上限**：`oscAmp ≤ 0.35 rad`，`oscFreq ∈ [1.50, 1.95] Hz`，不随伤害继续增长（`INSTABILITY_MAX = 0.90`）。
3. **偏置上限**：`|rollBias| ≤ 0.10 rad`、`|yawDrift| ≤ 0.08 rad/s`，避免长时间无输入被自动带偏。
4. **滚转响应下限**：`ω = response × sqrt(max(auth, 0.05))`，即使 5% 权限也保留可恢复的一阶响应；`bank` 硬限 ±87.5°（沿用现状），`rollVelocity` 按 `ω` 限幅。
5. **偏航摆动只表达、不积累**：`yawWobble` 是零均值正弦（§3.5.3），不产生净航向漂移；净漂移只来自 `yawDrift` 且有上限。
6. **无尾旋状态**：本作不引入俯仰/尾旋物理；`bank/turnVelocity` 全部有界，10 秒无输入必然收敛到小角速度（测试 A6/A11）。

#### 3.4.8 接口伪代码

```ts
// 与 D2 完全一致的输出结构（类型放 types.ts，DamageModel re-export）
export interface ControlDamage {
  liftLeft: number; liftRight: number;                       // 0..1
  rollAuthorityLeft: number; rollAuthorityRight: number;     // 0..1，“向该方向滚转的能力”
  thrustLeft: number; thrustRight: number;                   // 0..1，相对该侧标称推力
  yawStability: number;                                      // 0..1，尾翼/方向舵
  instability: number;                                       // 0..1，滚转振荡强度
  weaponFactor: number; lockFactor: number; bombFactor: number;
}
export interface DamageFrame {
  layer: "air" | "ground" | "water";
  coreHealthRatio: number;                                   // 核心带伤进入 instability
}

type AirMotionConfig = Extract<CombatantConfig["frame"], { model: "air" }>;

// `layer !== "air"` 时，升力、滚转、尾翼和投弹字段返回中性值或不参与移动结算，
// 调用方只消费发动机、轮组/船体、武器、锁定和核心相关结果。

// src/data/damageTuning.ts（新建，集中全部系数）
export const DAMAGE = {
  PARTIAL_FLOOR: 0.35, LIFT_FLOOR: 0.20, AILERON_RESIDUAL: 0.05,
  LIFT_BIAS_ROLL_GAIN: 0.9375, TURN_AUTHORITY_EXP: 0.55,
  MIN_ROLL_EACH: 0.05, MIN_ROLL_SUM: 0.25,
  INSTABILITY_WING_ASYM: 0.65, INSTABILITY_WING_LOSS: 0.45, INSTABILITY_TAIL: 0.50,
  INSTABILITY_THRUST: 0.35, INSTABILITY_LIFT_LOSS: 0.60, INSTABILITY_CORE: 0.25,
  INSTABILITY_MAX: 0.90, ROLL_OSC_GAIN: 0.30, ROLL_OSC_MAX: 0.35,
  ROLL_OSC_FREQ_BASE: 1.50, ROLL_OSC_FREQ_GAIN: 0.50,
  ROLL_BIAS_LIFT: 0.20, ROLL_BIAS_THRUST: 0.10, ROLL_BIAS_MAX: 0.10,
  YAW_DRIFT_LIFT: 0.075, YAW_DRIFT_THRUST: 0.05, YAW_DRIFT_MAX: 0.08,
  YAW_WOBBLE_RATE: 0.12, ROLL_RESPONSE_TAIL: 0.70, ROLL_DAMPING_TAIL: 0.30,
} as const;

// src/simulation/DamageModel.ts
export function evaluateDamage(parts: Part[], frame: DamageFrame): ControlDamage;
export function turnAuthority(c: ControlDamage, dir: -1 | 1): number;   // dir: +1 右转、-1 左转
export function engineFactor(c: ControlDamage): number;                // 供 04 与 World 共用
export function rollBiasSigned(c: ControlDamage): number;              // 右倾为负
export function yawDriftSigned(c: ControlDamage): number;              // 右偏为正
export function oscAmp(c: ControlDamage, dir: -1 | 1): number;         // 含方向权重
export function oscFreq(c: ControlDamage): number;

// 懒重算（World 内）
function refreshDamage(entity) {
  if (entity.partRevision === entity.damageRevision) return entity.damage;
  entity.damage = evaluateDamage(entity.parts, entity.frame);
  entity.damageRevision = entity.partRevision;
  return entity.damage;
}
```

### 3.5 飞行模型接入（`src/simulation/FlightDynamics.ts` 改造）

#### 3.5.1 包线（`flightEnvelope`，`FlightDynamics.ts:8-40`）

- 签名改为 `flightEnvelope(p: AirMotionConfig, damage: ControlDamage)`；`wingFactor` 参数由 `liftAvg` 替代，`specificThrust = s.acceleration × engineFactor(damage)`。仅 `layer === "air"` 的实体调用该函数。
- `maxLoad` 公式保持，`response` 额外乘 `(0.70 + 0.30 × yawStability)`（尾翼损毁回正变慢）；`maxBank` 仍按 `acos(1/maxLoad)` 且 ≤87.5°。
- 完好时 `liftAvg = 1、engineFactor = 1`，输出与 0.3.0 完全一致（现有银行角测试基线不变）。
- **轰炸模式 bankLimit（与 09/D12 的接口）**：`flightEnvelope` 本身不感知轰炸模式；由 `World.updatePlayer` 把 `isBombing ? bombingBankLimit(p, damage) : Infinity` 传给 `updateFlightTurn`（动态值由 09 §3.3 按机型 + 损伤计算），后者取 `effectiveMaxBank = min(envelope.maxBank, bankLimit)` 并在 targetBank 与 bank 上双重 clamp。损伤后的 `maxBank` 更低时自然更严（只收紧）；退出轰炸模式后传 `Infinity`，立即恢复完整包线。

#### 3.5.2 非对称滚转（`updateFlightTurn`，`FlightDynamics.ts:42-73`）

```ts
export function updateFlightTurn(p, error, dt, damage, elapsed, bankLimit = Infinity, bombing = false) {
  const env = flightEnvelope(p, damage);
  const maxBank = Math.min(env.maxBank, bankLimit);       // 09 投弹包线传入动态值
  const dir = error >= 0 ? +1 : -1;                       // +1 右转（heading 增大，bank 为负）
  const turnAuth = dir > 0 ? turnAuthority(damage, +1) : turnAuthority(damage, -1);
  const turnLimit = p.stats.turnRate * RAD * (bombing ? 0.65 : 1)
                  * (dir > 0 ? p.stats.rightTurn : p.stats.leftTurn) * turnAuth;

  const desiredTurn = clamp(error * 4.5 - p.turnVelocity * 0.45, -turnLimit, turnLimit);
  let targetBank = clamp(-Math.atan2(p.speed * desiredTurn, FLIGHT_GRAVITY), -maxBank, maxBank);
  targetBank += rollBiasSigned(damage);                   // 右翼缺失 → 目标右倾（负值）
  targetBank += oscAmp(damage, dir) * Math.sin(2π * oscFreq(damage) * elapsed + phase); // 振荡
  targetBank = clamp(targetBank, -maxBank, maxBank);      // 偏置/振荡后仍不得越过 bankLimit

  const need = targetBank - p.bank;
  const rollAuth = need > 0 ? damage.rollAuthorityLeft : damage.rollAuthorityRight; // need>0 = 左滚
  const responseScale = bombing ? BOMBING.rollResponseFactor : 1;   // 09：投弹模式 ×0.75
  const omega = env.response * responseScale * Math.sqrt(Math.max(0.05, rollAuth));
  const damp = 2 * omega;
  p.rollVelocity += (need * omega * omega - damp * p.rollVelocity) * dt;
  p.rollVelocity = clamp(p.rollVelocity, -omega * 0.45, omega * 0.45);
  p.bank = clamp(p.bank + p.rollVelocity * dt, -maxBank, maxBank);
  // 贴限保护：bank 顶到限值时清掉继续向外的滚转速度，避免“顶墙”抖动/回弹
  if (p.bank === maxBank && p.rollVelocity > 0) p.rollVelocity = 0;
  if (p.bank === -maxBank && p.rollVelocity < 0) p.rollVelocity = 0;
  p.turnVelocity = clamp(-FLIGHT_GRAVITY * Math.tan(p.bank) / Math.max(1, p.speed),
                         -turnLimit, turnLimit);
  return p.turnVelocity * dt;
}
```

- 完好（`auth = 1`、bias/osc = 0、`bankLimit = Infinity`）时等价于现状；测试 `tests/flight-dynamics.test.ts:60-92` 的符号/回正断言不需要改。
- **轰炸模式**（09/D12）：`bankLimit = bombingBankLimit(p, damage)`（按机型 + 损伤动态，基线 14–36°；重型机更小、受损后更小）。所有非核心部件的滚转/振荡仍生效但被限制在 `bankLimit` 内；`bankLimit` 小于 `env.maxBank` 时以 `bankLimit` 为准（不能借轰炸模式放大机动）；`bombing=true` 时 `turnLimit` 仍由 04 的轰炸 ×0.65 与损伤权限决定，bank 限幅自然降低协调转弯的角速度。
- **左右权限在“需要滚转的方向”上取**：这是“右翼缺失只能向左滚一点点”的关键；不要按“当前 bank 方向”取权限。
- 振荡加在 `targetBank`（可读、可测）而不是直接扰动 `rollVelocity`；二阶滚转动力学自然产生“滚转一会大一会儿小”。

#### 3.5.3 偏航漂移、尾翼摆动与恢复

在 `World.updatePlayer` 里于 `heading += delta` 之后追加（`World.ts:418` 附近）：

```ts
p.heading = angleDelta(p.heading + delta
  + yawDriftSigned(damage) * dt                                   // 净漂移，有上限
  + YAW_WOBBLE_RATE * (1 - damage.yawStability) * Math.sin(2π * 0.85 * t) * dt, 0);
```

- 尾翼全毁：`yawStability = 0.20` → 回正响应 ×0.76、航向摆动约 ±0.11 rad/s（±0.02 rad 幅值）、`yawDrift` 的尾翼因子 ×1.4；配合 `instability` 提升，表现为“甩尾、回正慢”。
- `yawWobble` 零均值，不改变长期航向；避免“尾翼没了视角一直旋转”的不适。

#### 3.5.4 `World.updatePlayer` 的接入顺序（与 04 的契约）

```ts
const damage = refreshDamage(p);
const engineFactor = engineFactor(damage);          // 03 重新定义，形状仍为 0.5+0.5×推力项
// 04 的加力：maxSpeed × engineFactor × boost 倍率；推力 × engineFactor
const bankLimit = this.isBombing ? bombingBankLimit(p, damage) : Infinity; // 09：按机型+损伤动态
const delta = updateFlightTurn(p, error, dt, damage, this.clock.elapsed, bankLimit, this.isBombing);
p.heading = angleDelta(p.heading + delta + yawDriftSigned(damage) * dt + yawWobble, 0);
p.speed += s.acceleration * engineFactor * throttle * dt;   // 04 在 throttle 上加 boost 项
p.speed = clamp(p.speed, p.frame.cruiseSpeed, max(p.frame.cruiseSpeed, s.maxSpeed * engineFactor));
```

- 04 的公式不变，只把 `World.ts:396` 的 `engineFactor` 取值来源换成 `engineFactor(damage)`；加力倍率固定乘在其上，不得绕过损伤。
- `bankLimit` 只约束滚转角，不限制方向输入；斜杆仍按正常映射，超出部分由滚转阻尼吸收。退出轰炸模式（`toggleBombing`）后下一帧传 `Infinity`，无缝恢复完整包线（`p.bank` 保持当前值，不瞬移）。
- 移除 `World.ts:397` 的 `wingFactor` 与 `World.ts:404-409` 中乘 `wingFactor` 的部分；转向权限改由 `updateFlightTurn` 内部处理。
- 转向损耗 `p.speed -= |delta| * 0.35`（`World.ts:434`）保留；风场/边界的软推不改。

#### 3.5.5 空中敌人共用

空中敌人 AI 用同一 `evaluateDamage`（§3.6.3），`e.bank` 仍按 `-atan2(speed × turnVelocity, g)` 计算（`World.ts:609-621`），只在 `targetBank` 上叠加 `rollBias/osc`，不引入第二套符号。地面和水面敌人不调用 `flightEnvelope` 或 `updateFlightTurn`，它们把同一份部件损毁结果交给路线与移动积分器。

### 3.6 敌人部件、AI 与反馈

#### 3.6.1 敌人数值表（空中；H = `config.health`，核心生命保持 H）

| 敌人 | 默认/精细 | 核心 | 左右翼各 | 引擎各 | 尾翼 | 武器/舱位 | 翼传递 | 可脱落 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| scout 侦察机 | 默认三件套 | 1.0H（40） | 0.20H（8） | —（视觉并入核心） | — | — | 0.50 | 翼 |
| hunter 追猎机 | 默认三件套 | 1.0H（65） | 0.18H（12） | — | — | — | 0.50 | 翼 |
| bomber 轰炸机 | 精细 | 1.0H（130） | 0.25H（32） | 0.15H（20）×2 | 0.12H（16） | bay 0.15H（20） | 0.50 / 引擎 0.35 / 尾 0.20 / 舱 0.20 | 翼、引擎、尾 |
| escort 护卫无人机 | 默认三件套 | 1.0H（45） | 0.20H（9） | — | — | — | 0.50 | 翼 |
| striker 俯冲攻击机 | 精细 | 1.0H（80） | 0.22H（18） | 0.18H（14）×2 | — | — | 0.50 / 引擎 0.35 | 翼、引擎 |
| elite 精英空艇 | 精细 | 1.0H（650） | 0.12H（78，侧舷吊舱） | 0.10H（65）×2 | 0.06H（39，尾舵） | turret 0.08H（52）×2 | 0.50 / 0.35 / 0.20 / 0.15 | 全部可脱落 |

地面单位（`layer === "ground"`，显式 parts；`aa`/`emplacement` 由 06 从 `ENEMIES` 删除，不再定义部件；下表仅保留 06 的移动单位与静态建筑）：

| 敌人 | 核心 | 武器位 | 机动位 | 传递 |
| --- | ---: | ---: | ---: | --- |
| missile_truck 导弹车 | 1.0H（120） | bay/导弹舱 0.35H（42） | engine/轮组 0.25H（30） | 0.20 |
| resource 资源车 | 1.0H（100） | — | engine/轮组 0.25H（25） | 0.15 |
| aa_truck 移动防空车（06 新增） | 1.0H（110） | gun/炮塔 0.35H（38） | engine/轮组 0.25H（28） | 0.15 |
| armored_train 装甲列车（06 新增） | 1.0H（400，3 节） | gun/炮塔 0.30H（120，每节） | engine/车体 0.25H（100，每节） | 0.15 |
| depot 燃料设施（静态建筑） | 1.0H（240） | 可选储罐 0.30H（72） | — | 0.10 |

#### 3.6.2 部件损毁后的实体行为

下表的升力、滚转、尾翼和飞行坡度效果只适用于空中实体。地面和水面实体沿用同一部件命中、核心传递和武器失效流程，再由轮组、发动机、船体或舵机部件把 `engineFactor`、`weaponFactor` 和核心状态映射为路线速度、转向能力和火力状态。

| 部件 | 效果 | AI/表现 |
| --- | --- | --- |
| 单侧翼脱落 | 该侧 `lift` 缺失 → `liftBias`、转向权限按 §3.4 计算；速度 `engineFactor × liftAvg` 下降 | 转向变钝；若核心 <50% 或再掉一翼 → `fleeing`；脱离动作更大、冒烟 |
| 双翼脱落 | 滚转/转向权限压到地板；持续失稳 | 必定 `fleeing`，无法追击；冒黑烟 |
| 单侧引擎脱落 | `thrust_s` 下降 → `thrustBias` 偏航/横滚，速度下降 | 向对侧偏航/拉烟；转弯半径变大 |
| 尾翼脱落 | `yawStability` 下降 → instability 提升、回正变慢、航向摆动 | 蛇形飞行、射击角更难对准 |
| 武器/炮塔脱落 | 该 `weaponIds` 停止开火；`weaponFactor` 下降 | 对应侧炮口熄灭/冒烟；精英每轮弹幕数量按存活炮塔比例下降 |
| 雷达/机头脱落 | `lockFactor` 下降、锁定/开火间隔变长 | 瞄准灯闪烁变慢、射击更不准 |
| 炸弹舱脱落 | `bombFactor = 0`，不再投弹 | 舱门不开、腹部冒烟 |
| 核心归零 | 现有击毁流程不变 | 爆炸/碎片/掉落不变；`part_destroyed` 与 `enemy_destroyed` 事件由 05 消费 |

#### 3.6.3 `updateEnemies` 改造点

- 转向（`World.ts:589-601`）：`desiredTurn` 的限幅改为
  `limit = c.turnRate × RAD × turnAuthority(damage, sign(turnError))`；追击/脱离的 `target` 不变。
- 速度（`World.ts:602-607`）：`targetSpeed *= engineFactor(damage)`，再乘既有 `slow/flee/dive` 因子。
- 横滚（`World.ts:609-621`）：目标 bank 叠加 `rollBiasSigned` 与 `oscAmp × sin(...)`，限幅用 `flightEnvelope` 的 `maxBank`（按 `liftAvg` 计算）。
- 航向（`World.ts:601`）：追加 `yawDriftSigned × dt` 与尾翼 wobble。
- 开火（`World.ts:628-673`）：只有 `weaponFactor > 0.05` 才能进入 `warning`；`warning` 期间武器被击毁则取消本次开火；`fireInterval` 乘以 `(1 + 0.6 × (1 - weaponFactor))`；精英的 `count = 12 × 存活炮塔比例`。
- 逃跑（`World.ts:560-570`）：`e.health < c.health × 0.2` 改为 `e.health < e.maxHealth × 0.25 || 已掉一翼`（两翼全掉必然逃）；`scout` 的召唤仍受 02 的上限约束。
- 地面和水面单位：仍由同一个 `evaluateDamage` 输出共享武器、核心和机动部件结果。它们不生成升力、滚转或尾翼飞行衰减。轮组、发动机、船体或舵机失效映射为路线速度和转向衰减，武器失效映射为停火，不新增地面或水面专用伤害分支。

#### 3.6.4 与 02、05 的对接

- **02 刷新/避让**：部件不改变敌人数量与上限；但 02 的导演输入 `playerPartDamage`（`docs/systems/04-enemies-battlefield.md:125-136`）应读取 `1 - min(liftLeft, liftRight)` 或“失去的部件价值”，用于降低追击权重。敌人逃逸/回收距离（现 `distance < 85`，`World.ts:675-677`）由 02 统一，本文不改。
- **05 事件总线**：本文需要 `part_destroyed`（D5 已列）。建议 payload：

```ts
interface PartDestroyedEvent {
  type: "part_destroyed";
  id: number; time: number;          // 由 05 的事件队列包装层补齐
  owner: "player" | "enemy";
  ownerId: number;                   // 玩家固定 0；敌人 e.id
  ownerKind: string;                 // 玩家：机体 id/名称；敌人：ENEMIES[kind] 的 kind
  partId: string; role: PartRole; side: -1 | 0 | 1;
  label: string;                     // 由 03 按 role/side 生成：如 "右翼"/"左侧发动机"/"尾翼"
  x: number; z: number;              // 世界坐标，供 05 的击毁信息条/边缘提示
  detachable: boolean;
}
```

- 该 payload 与 05 §3.1 的 `part_destroyed` 完全一致（05 负责 `id/time` 与队列；`label` 在 03 生成，避免 05 再维护一份 role→文案映射）。
- 05 消费“部件击毁”做信息条（“右翼脱落”）、命中标记与音效；03 只负责在 `applyPartDamage` 归零时发事件，不直接画 UI。
- 击毁积分：部件首次脱落可加 `round(ENEMIES[kind].xp × 0.15)` 的小额积分（可调），让“先卸部件”有即时正反馈；核心击毁积分不变。

#### 3.6.5 TTK 与目标价值校准

- 核心生命保持 `config.health` → **只打核心的 TTK 与 0.3.0 完全一致**，旧平衡与测试不被破坏。
- 打部件会额外消耗“附加结构生命”：默认三件套（翼 0.20H×2、传递 0.5）下，持续打翼再收核心的总伤害约 `1.2H`（轰炸机含引擎/尾翼等最多约 1.4H）；这是“用 TTK 换功能性致残”的刻意设计，不是数值 bug。若平衡验收认为过慢，在 Wave 4 统一调 `config.health × 0.95` 或降低翼生命（§8-6）。
- 目标价值：打翼=降机动/逼逃，打引擎=降速度/逼偏航，打炮塔=降火力，打核心=最快击毁；HUD 与 05 的反馈按此优先级提示。

### 3.7 表现：渲染、HUD、音效

#### 3.7.1 玩家（`src/rendering/ProceduralAircraft.ts`）

- `rebuild`（`ProceduralAircraft.ts:99-344`）按 `part.role/side/visual.kind` 建组，不再写死 `part.id`；`this.parts` 已经是 `Map<partId, Group>`（`:77`），保留。
- `update`（`:345-389`）的 `root.visible = !part.destroyed`（`:350-351`）改为一个**脱落状态机**（渲染层字段，不进模拟层）：

```text
intact/damaged/critical → 显示，材质 damageAmount = 1 - health/maxHealth，热值随 hitFlash
disabled               → 显示但熄火/黑烟（尾焰隐藏、炮塔停转）
destroyed 的瞬间        → 启动 detach：0.7–0.9s 内沿 -Y 下坠 + 自转 + 缩小，随后隐藏
```
- 断口/冒烟：`Renderer.updateSmoke`（`Renderer.ts:755-782`）改为遍历“所有实体（玩家 + 敌人）的 damaged 部件”，按 `state` 选颜色（damaged 灰烟、critical 黑烟、engine 橙火）；低画质只保留 3 个。
- 断口用预定义的低面数碎片几何体（与 `docs/systems/06-procedural-3d.md:117-124` 的受损部件管线一致）；脱落件同时向 `World.effects` 池推一条 `kind = "debris"`（`types.ts:155` 已有该枚举），复用现有特效池，不新建池。

#### 3.7.2 敌人（`src/rendering/Renderer.ts`）

- `this.enemies` 的值从 `Group` 改为 `{ root: Group; parts: Map<string, Group>; detach: … }`；`createEnemy`（`Renderer.ts:339-444`）按 `e.parts` 拆组：
  - `fuselageGeometry` → core 组；左右 `wingGeometry` → left/right wing 组；`BoxGeometry` 发动机 → engine 组（没有 engine 部件的敌人并入 wing/core 组，保持轮廓）；尾翼 → tail 组；炮塔/炮管 → turret/gun 组。
- `updateBattle`（`Renderer.ts:580-624`）每帧读 `e.parts`：`destroyed` 的组移出可见（或播放 0.7s 下坠）；`disabled` 的引擎组熄火；尾翼组损坏时给整机加轻微 `rotation.z` 摆动（只读表现，不写回模拟）。
- `warningLines` 由 05 删除，03 不新增任何瞄准线。
- 特效预算（D10）：同时 ≤8 组脱落动画；标准档爆炸/烟雾粒子沿用 `RULES.maxEffects`（`config.ts`），低画质减半。

#### 3.7.3 HUD 与音效

- `GameApp.updateLabels`（`:354-385`）继续用 `e.health/e.maxHealth` 显示**核心**血条；精英额外在血条右侧显示“翼损/炮毁”小图标（来自 `part_destroyed` 事件，DOM 上限每敌 1 个），普通敌人不加，避免信息噪声。
- 玩家可选的部件示意图（顶视剪影，7 个点按状态着色）列为 **P2 可选**：标准档用一张 Canvas 叠加在血条旁；若真机信息密度过高可关闭。首版以“烟雾/脱落 + 音效 + 操控”为主反馈。
- 音效：03 需要“部件脱落/断翼”金属撕裂音与“发动机熄火”提示音。`GameAudio.play` 的联合类型由 01/04/05 共同扩展（01 已在 §7 注明取并集），03 建议新增 `part`（撕裂）与 `engine_down`（熄火）两个 tone；玩家部件脱落额外 45ms 振动（`Audio.ts` 现有 `navigator.vibrate` 分支）。05 落地后由事件总线触发，03 只提供 `part_destroyed` 事件。
- 08 兼容：Q 版外观走同一份 `PartRecipe.visual` 与 `role/side`，08 调整比例时只改 recipe（翼展 ×1.15、座舱 ×1.3 等）与程序化几何，`DamageModel/命中判定` 不感知美术参数；08 新增的 `float/radar` role 已列入 `PartRole`。08 改模型后必须调用统一工厂重算 `x/z/radius/hitCircles`，保证“看起来打哪就命中哪”。

### 3.8 升级与维修交互

- **升级部件独立生命**：沿用现状（`World.installUpgrade` 的 `partFromRecipe` 生成 `health/maxHealth`，`World.ts:1173-1211`）；新增 role/lift/thrust/weaponIds/damageTransfer。例：`right_engine` 的右侧发动机 `thrust = 1`、`left_gun` 的 gun 部件挂 `light_cannon`；`giant_wing` 的外翼部件 `lift = 0.8` 并扩大命中圆；`bomb_bay` 的 bay 部件提供 `bombFactor`；`heavy_armor` 的 armor 部件 role = core（结构件）并继续降低 `stats.damageTransfer`。
- **重装/修复**：`World.repair`（`World.ts:1242-1255`）按 01 定稿语义拆分：
  - `healCore(amount)`：**只回核心**，同步 core 部件；血瓶走这里（01 §3.3）。
  - `repair(coreRatio, partRatio)`：精英“部件修复包”调用；核心 + 比例、**所有 `destroyed === false` 的部件**回一部分生命（含 disabled），**永不重装 `destroyed` 部件**（删除 `World.ts:1252` 的 `part.destroyed = false` 与 1184 行重复安装逻辑）。
  - 没有维修升级（01 删除 `repair` 条目与 `u.repair` 安装分支）；“重装类升级”本轮不引入，留给 05/后续评估。
- **升级不影响已损部件语义**：安装/升级本身不重置部件生命（现有代码 `existing.health = ... + recipe.health*0.3` 只对同一升级的重复安装生效，保留）；`modular_frame` 的 `maxHealth *= 1.1`（`World.ts:1236-1239`）仍对全部部件生效，需同时钳制 `health ≤ maxHealth`。
- **部件损坏与升级池**：`docs/systems/05` 的“被摧毁部件可以出现重装选项”不在本轮范围；03 只保证源码里不再有“维修升级”路径、修复包不重装，永久损毁成立。
- **`Player.revision`**：只用于几何重建；修复/治疗只改生命，不 `revision++`（01 已要求），渲染层的材质 damage 值每帧从 `part.health` 读取，不需要重建。

## 4. 改动清单（文件级）

| 文件 | 改动 | 读者 |
| --- | --- | --- |
| `src/simulation/types.ts` | 新增 `PartRole/PartDamageState/ControlDamage`；`Part/Player/Enemy` 扩展字段；`Enemy` 加 `parts/damage/partRevision/damageRevision` | 模拟 |
| `src/simulation/DamageModel.ts` **新建** | `evaluateDamage`、方向权限/engineFactor/偏置/振荡 helper、纯函数零分配 | 模拟 |
| `src/simulation/parts.ts` **新建** | `createPlayerParts`、`createEnemyParts`、`partFromRecipe`、`inferRole`、`refreshPartLayout`、`stateFor` | 模拟/渲染 |
| `src/data/parts.ts` **新建** | 共享 `PartRecipe`、`PlayerBaseRecipe`、默认敌人 recipe、role 推断表 | 内容 |
| `src/data/damageTuning.ts` **新建** | §3.4 全部系数（D2 要求集中配置） | 模拟/策划 |
| `src/data/enemies.ts` | `EnemyConfig.parts?: PartRecipe[]`；轰炸机/俯冲/精英/地面单位补 recipe | 内容 |
| `src/data/upgrades.ts` | `PartRecipe` 改为 re-export；条目保持 `kind/slot/health` 不变（工厂补 role/lift/thrust） | 内容 |
| `src/simulation/FlightDynamics.ts` | `flightEnvelope(p, damage)`、`updateFlightTurn(..., bankLimit)` 非对称滚转/振荡/偏置与轰炸模式滚转 clamp；保留旧完好行为 | 模拟 |
| `src/simulation/World.ts` | 构造部件改工厂；所有实体统一调用 `hitEntity/applyPartDamage`；统一 `explode/pierce/DoT`；空中玩家与空中敌人消费 `ControlDamage`，地面/水面消费共享伤害结果并交给各自移动模型；`canBomb/dropBomb` 用 `bombFactor`；删 `partFactor`；`repair` 拆分 | 模拟 |
| `src/rendering/ProceduralAircraft.ts` | 按 role/side 建组、脱落状态机、按部件材质/尾焰/烟雾 | 渲染 |
| `src/rendering/Renderer.ts` | 敌人按部件建组/更新/脱落；烟雾覆盖双方；不新增瞄准线（05 删除 warningLines） | 渲染 |
| `src/app/GameApp.ts` | 敌人标签保留核心血条；精英部件图标；玩家低血量/部件损失提示复用 05 事件 | UI |
| `src/services/Audio.ts` | 新增 `part/engine_down` 音色（联合类型与 01/04/05 合并） | 音频 |
| `tests/damage-model.test.ts` **新建** | 纯函数基线（A3/A7/A8/A9/A10/A11） | 测试 |
| `tests/flight-dynamics.test.ts`、`tests/simulation.test.ts` | 按 §7.1 更新 | 测试 |

## 5. 实现任务拆分

| # | 任务 | 写作用域（相对仓库根） | 依赖 | 验收 |
| --- | --- | --- | --- | --- |
| T1 | 部件类型与工厂：`types/parts/data` 迁移，玩家/敌人部件可生成，旧 `kind/slot` 兼容 | `src/simulation/types.ts`、`src/simulation/parts.ts`、`src/data/parts.ts` | — | 现有 23 个升级仍可安装；敌人全部有 parts |
| T2 | `DamageModel` + 调参表：全部公式、基线表、地板保护；纯函数单测 | `src/simulation/DamageModel.ts`、`src/data/damageTuning.ts`、`tests/damage-model.test.ts` | T1 | A3/A7/A8/A9/A10/A11 |
| T3 | 统一命中与伤害分流：`hitEntity`、`applyPartDamage`、部件/核心、穿透/爆炸/DoT、`part_destroyed` 事件 | `src/simulation/World.ts`（命中/伤害/explode 段） | T1、T2 | A1/A2/A12、TTK |
| T4 | 飞行接入：`flightEnvelope/updateFlightTurn` 非对称、`updatePlayer` 顺序、`engineFactor` 与 04 契约、**`bankLimit` 投弹滚转 clamp（接 09 的动态包线）** | `src/simulation/FlightDynamics.ts`、`World.ts`（updatePlayer） | T2 | A4/A5/A6/A15 |
| T5 | 敌人 AI 与数值：部件 recipe、行为分类目标点、统一限速/转向/开火/逃跑、地面单位映射 | `src/data/enemies.ts`、`src/simulation/World.ts`（enemy AI） | T1、T3、12 | A12、A13、A16；02 上限不回归 |
| T6 | 玩家表现：ProceduralAircraft role 化、脱落动画、按部件烟/火 | `src/rendering/ProceduralAircraft.ts`、`Renderer.ts`（玩家段） | T1、T3 | 右翼脱落动画 0.9s；无 Three.js 依赖进模拟层 |
| T7 | 敌人表现 + HUD/音效：部件分组、脱落、精英图标、`part` 音效 | `src/rendering/Renderer.ts`、`src/app/GameApp.ts`、`src/services/Audio.ts` | T3、T5 | D10 预算；05 事件消费 |
| T8 | 维修/升级收口：`healCore/repair` 按 01、删除 `u.repair` 安装分支、`installUpgrade` 新字段、`partRevision` | `src/simulation/World.ts`、`src/data/upgrades.ts` | T1、01 | 修复包不重装；0.3.0 升级测试更新 |
| T9 | 测试与文档收口：更新受影响测试、全量回归、把本文合并回 02/05 基线 | `tests/*`、`docs/`（合并阶段） | T2–T8 | §7；`npm test` 全绿（实施时） |

**顺序**：T1 → T2 →（T3、T4 可并行）→ T5 →（T6、T7 可并行）→ T8 → T9。T1/T2/T3 是硬依赖；T6/T7 只读 `Part` 状态，不阻塞模拟层。

## 6. 验收标准

### 6.1 自动化断言（固定种子/确定性）

- **A1 部件存在性**：任意 `AIRFRAMES` 玩家均有 core + 左右翼 + tail + bay；任意空中 `ENEMIES` 至少有 core + 左右翼三件；地面/水面 `ENEMIES` 至少有 core 与其武器或机动部件；`hitEntity` 瞄部件命中对应 role，瞄中心命中 core。
- **A2 分流与状态**：同一 `applyPartDamage` 对玩家和敌人执行，命中翼后按 `owner.damageTransfer × part.damageTransfer` 向核心传递；`health === 0` 且 `detachable` → `state === "destroyed"` 并从 `hitPart` 排除；不可脱落 → `disabled` 仍可被命中；爆炸一次至少命中 2 块部件；pierce 1 命中同一实体 2 块部件。
- **A3 右翼全毁基线**：`evaluateDamage` 返回 `liftRight = 0.20±0.01`、`liftLeft = 1.00`、`rollAuthorityLeft = 0.15±0.01`、`rollAuthorityRight = 0.90±0.01`、`turnAuthorityLeft = 0.352±0.02`、`turnAuthorityRight = 0.944±0.02`、`instability = 0.90`、`oscAmp = 0.27±0.02 rad`、`oscFreq = 1.95±0.05 Hz`、`rollBias = 0.08±0.01 rad 右`、`yawDrift = 0.03±0.005 rad/s 右`、`engineFactor = 0.94±0.01`。
- **A4 左转难**：右翼全毁后按住左转输入 3s：`max |turnVelocity| ≤ 0.45 × 完好左转指令上限`；`bank > 0` 但峰值 `bank ≤ 0.95 × 完好转弯峰值`；左转累计航向变化明显小于完好。
- **A5 右转不稳**：按住右转 3s：`bank < -0.5 rad`；稳态后 1.5s 内 bank 去趋势峰峰值 ∈ [0.15, 0.80] rad（振荡可见但不失控）；右转累计航向变化 ≥ 左转的 1.3 倍。
- **A6 可回正/不失控**：右翼全毁后松杆 6s：`|bank| ≤ 0.25 rad`（均值）、`|rollVelocity| ≤ 0.2`、`|turnVelocity| ≤ 0.3 × 完好上限`、速度 ≥ `cruiseSpeed`、全部状态有限；15s 内 `|bank| ≤ 87.5°`。
- **A7 左翼镜像**：左翼全毁后 A3–A6 的左右数值完全互换（误差 <1e-6）；
- **A8 发动机**：Courier 右发全毁 → `thrustLeft = 1、thrustRight = 0、thrustFactor = 0.5、engineFactor = 0.75±0.01`；`yawDrift > 0`（右偏）；Swift 单发全毁 → `engineFactor = 0.50±0.01`，全油门 2s 后速度 ≤ `maxSpeed × 0.75`（保持现有测试口径）。
- **A9 尾翼**：尾翼全毁 → `yawStability = 0.20±0.01`、`instability ≥ 0.40`、`flightEnvelope.response ≤ 0.8 × 完好`；从 0.8 rad 倾斜回正到 0.2 rad 的时间比完好长 ≥20%。
- **A10 火力/锁定/炸弹舱**：机头炮部件全毁 → `weaponFactor = 0`、该武器不再生成弹道；雷达/机头全毁 → 有效锁定速度 ×0.4；炸弹舱全毁 → 轰炸模式下 `canBomb === false` 且 `dropBomb()` 返回 false。
- **A11 组合保护**：把所有非核心部件设为 0 血：`rollAuthorityLeft + rollAuthorityRight ≥ 0.25`、`oscAmp ≤ 0.35`、`yawDrift ≤ 0.08`；继续模拟 10s 无输入，无 NaN、无 bank 越界、无不可恢复状态。
- **A12 敌人部件反馈**：打掉轰炸机一侧翼 → `turnAuthority` 下降、目标速度下降、若核心 <50% 进入 `fleeing`；打掉精英一座炮塔 → 下一轮弹幕数减少且该侧不再开火；打掉火力全部部件 → 不再进入 `warning`；核心归零 → `kills+1`、分数/掉落与 0.3.0 一致。
- **A13 TTK**：核心直击的击杀所需伤害与 0.3.0 相同（`config.health` 不变）；持续打翼路线总伤害 ≤1.5H；不允许出现核心以外部件导致“打不死”的状态。
- **A14 确定性与性能**：同种子在 30/60/120 FPS 下 `DamageModel` 输出与部件状态一致；8 空中 + 6 地面 + 140 弹的最坏帧，命中判定 + DamageModel 合计 <0.3ms/帧（Node 基准，取 600 帧平均）。
- **A15 投弹滚转上限接口**：`updateFlightTurn(..., bankLimit = 09 计算的动态值, bombing=true)` 时，任意机体满侧向输入 2s 的 `|bank| ≤ min(envelope.maxBank, bankLimit) + 1°`；`bankLimit = Infinity、bombing=false` 时输出与 0.3.0 基线一致；右翼全毁 + 投弹时上限只会更小（取 `min(maxBank, 09 的动态值)`），不会因损伤反而放宽。
- **A16 行为与战斗管线唯一性**：空中 `chase`、`intercept`、`escort`、`dive`、`standoff` 与地面/水面 `patrol`、`convoy` 的目标点或路线意图符合配置。空中行为进入同一个分离、`evaluateDamage`、飞行转向、速度和开火函数，地面/水面行为进入各自移动积分器。对同一 `Part[]` 和同一命中输入，玩家、空中敌人、地面实体和水面实体调用 `hitEntity/applyPartDamage` 得到相同的部件状态、核心传递和共享伤害结果，差异只能来自配置输入、运动层和奖励处理。地面实体不要求输出空中飞行包线。

### 6.2 真机/视觉验收

1. 右翼被打掉：断翼下坠动画、断口冒烟；HUD/事件提示“右翼脱落”；操控符合 A4–A6；声音有撕裂/振动。
2. 左滚明显慢、左转迟钝；右转时画面 bank 可见“忽大忽小”的抖动，但不会翻滚失控。
3. 敌人：打掉轰炸机一侧发动机后能看到对应侧熄火/冒烟、机身右偏；打掉精英炮塔后该侧停火；核心爆炸反馈沿用 05。
4. 低画质档：所有部件脱落动画 ≤8、烟雾 ≤3、无掉帧；360×640 下部件图示/图标不遮挡血条与摇杆。
5. 与 08 的 Q 版外观配合：加大机翼/座舱后，命中区仍与视觉对齐（打翼尖命中翼）。

### 6.3 性能与预算（D10）

- 活动敌人 ≤14（8 空中 + 6 地面）；每敌 ≤8 部件；绘制调用 <150、三角形 <150k；脱落特效同时 ≤8；低画质按比例减半。
- 模拟层不依赖 Three.js；`DamageModel` 零分配/懒重算；渲染层不每帧 `new` 几何体/材质（复用现有材质缓存与对象池）。

## 7. 测试与兼容

### 7.1 受影响的现有测试

| 测试 | 现状 | 需要修改 |
| --- | --- | --- |
| `tests/flight-dynamics.test.ts:46-59` | `flightEnvelope(p)`、`flightEnvelope(p, 0.5)` 模拟发动机损伤 | 改为 `flightEnvelope(p, damage)`；`0.5` 用 `{ thrustLeft: 0.5, thrustRight: 0.5 }` 的 `ControlDamage` 构造；断言不变 |
| `tests/flight-dynamics.test.ts:60-74、75-92` | bank 符号、回正、反转 | 完好状态行为不变，无需改；新增 `describe("asymmetric damage")` 覆盖 A3–A7 |
| `tests/flight-dynamics.test.ts:93-113` | 敌人转向惯性、`≤ c.turnRate×RAD` | 完好敌人限幅仍成立；补“翼毁后转向限幅更小”的用例 |
| `tests/simulation.test.ts:127-142` | 高速弹扫掠击毁 hunter | 瞄中心的弹命中 core；应继续通过（可补“瞄翼命中 wing”） |
| `tests/simulation.test.ts:163-182` | 发动机失效降速、机头炮失效 | `damagePlayer(50, engine.x, engine.z)` 仍走最近部件；Swift 单发全毁 `engineFactor = 0.5` 继续满足 `≤ maxSpeed×0.75`；机头部件 0 血继续禁火；补充“引擎 disabled 但仍显示/可命中”的断言 |
| `tests/simulation.test.ts:221-245` | 左右升级差异 `leftTurn > rightTurn` | `stats.leftTurn/rightTurn` 保留，继续通过；补 `part.role/side/lift/thrust` 断言 |
| `tests/simulation.test.ts:246-257` | 安装 `repair` 重装 `right_wing` | **必须改**：01 删除维修升级；改为 `healCore()` 只回核心 + 精英修复包（`repair`）不重装 `destroyed` 的断言 |
| `tests/simulation.test.ts:298-348` | 五分钟耐久/池上限 | 部件与事件会增加对象；确认 `RULES.maxEffects`、敌人上限、`peak <250`、遥测 ≤500 仍成立；必要时调整断言到 D10 预算 |
| `tests/controls.test.ts` | 输入映射 | 不受影响 |

### 7.2 新增测试

- `tests/damage-model.test.ts`：A3/A7/A8/A9/A10/A11/A14；构造 `Part[]` 直接断言 `ControlDamage`。
- `tests/flight-dynamics.test.ts` 扩：A4/A5/A6（固定种子、固定 1/60 步长）与 A15（`bankLimit` 下不改 0.3.0 完好基线）。
- `tests/simulation.test.ts` 扩：A1/A2/A12/A13，以及“敌人 `part_destroyed` 事件/`partRevision` 懒重算”用例。
- 视觉验收用截图/真机步骤（§6.2），不强行自动化 WebGL。

### 7.3 兼容与接口

- **存档**：无变化（D9）；`SaveData` 不新增字段，局内部件不持久化，结算只读最高分/金币/解锁。
- **04 加力**：`engineFactor` 形状不变（§3.5.4），加力倍率仍乘在损伤后的极速/推力上；04 的 A7 回归需在 03 落地后重跑（预期通过）。
- **09 投弹滚转上限**：09/D12 定义动态 `bombingBankLimit` 公式与前向目标；04 定义 45% 油门/HUD 文案；03 提供 `FlightDynamics.updateFlightTurn(..., bankLimit)` 接口与 clamp 语义（§3.5.1–3.5.2、A15），不重复实现；`bankLimit=Infinity` 时 03 的行为与 0.3.0 一致。
- **01 血瓶/修复包**：`healCore` 只碰核心；`repair` 只救未脱落部件；`Part.destroyed` 是永久损毁的唯一语义；与 01 的 `repairKit`（不重装）一致；本任务的“精英维修可修复部件（保留现状）”按 01 口径解释为**保留精英修复包通道、修复未脱落部件**，重装剥离（见 §8-2）。
- **05 事件**：03 只发 `part_destroyed`（§3.6.4），05 决定提示/声音/边缘指示；在 05 事件队列落地前，用现有 `Telemetry.record` 记录 `part_damaged/part_destroyed` 作为过渡，避免两套系统长期并存。
- **02 刷新**：不改数量/避让；敌人部件不改变 `World.enemies` 生命周期；导演可接 `playerPartDamage` 输入（02 实现）。
- **08 美术**：role/visual 协议是唯一接口；Q 版比例参数只改 recipe/程序化几何，命中区由工厂统一重算（§3.7.3）。
- **08 利维坦流**：wingDeck/额外发动机/炮塔全部走 §3.2.3 的角色表；新增部件会改变质量、惯量与受弹面，必须回归 03 的 A11/A13（组合保护/TTK）与 09 的投弹坡度收紧。
- **旧数值基线文档**：`docs/systems/02` 的“机翼受损转向 −12%”、`docs/content/INITIAL_AIRFRAMES.md:59-63、110-116、163-168` 的对称损伤描述在本轮后由 §3.4 曲线替代；按总览 §9 在全部 01–09 实施后合并回基线文档时统一更新，避免提前改基线文档。

### 7.4 性能与确定性

- 模拟层零 Three.js 依赖；`DamageModel` 懒重算；命中检测只做 XZ 平面（与现状一致，bank 不参与碰撞），无每帧分配。
- 所有振荡相位来自确定性哈希 + `clock.elapsed`，不用 `Math.random/Date.now`；同种子可复现（D11）。
- 渲染层对象池/实例化沿用现有实现（`ObjectPool`、`RULES.maxEffects`），脱落件不新建池。

## 8. 待确认与备选

| # | 问题 | 推荐 | 备选/影响 |
| --- | --- | --- | --- |
| 1 | 地面单位的“部件”语义 | 显式 `parts`（core + 炮位/轮组），不用“翼” | 严格按 D1 给所有敌人三件套：车辆左右各挂一个“侧部”部件，语义别扭但实现最简单 |
| 2 | 精英修复包是否重装脱落部件？ | 按 01：**不重装**；保留修复未脱落部件 | 若评审坚持任务原话“保留现状”含重装：需撤销 01 的 `repairKit` 不重装规则，并接受“永久损毁”设计被削弱；本文不采用 |
| 3 | 振荡注入点 | 加在 `targetBank`（可读、可测、自然滞后） | 直接扰动 `rollVelocity`：更“颠簸”但难做 A5 的幅值断言；扰动 `bank`：无物理滞后感 |
| 4 | 哪些部件可脱落 | 玩家：翼可脱落，engine/tail/gun/bay 为 disabled（保留轮廓）；敌人：翼/引擎可脱落，精英尾舵/炮塔可选 | 玩家尾翼也可脱落：表现更狠，但“尾翼消失”需要额外美术断口；本轮默认否 |
| 5 | 玩家部件 HUD 示意 | 首版不做（P2 可选），靠烟雾/脱落/音效/事件 | 顶视剪影 + 7 点状态：信息清楚但标准档界面更挤；真机测试后再定 |
| 6 | 敌人部件额外 HP 导致 TTK 变长 | 接受（核心路线不变，打部件路线约 1.2–1.4H），Wave 4 再调 | 同步下调敌人 `config.health` 5–10%：会牵动 02/05 的平衡与掉落，不推荐在第一轮做 |
| 7 | `stats.leftTurn/rightTurn` 与损毁权限的乘算 | 乘算（升级偏重 × 损伤权限） | 加算：易出现 >1 或 <0，不推荐 |
| 8 | 08 改比例后命中区重算 | 统一工厂 `refreshPartLayout` 重算，单测“视觉翼尖可命中” | 手工维护数值：08 每改一次比例都要同步，易漂移 |

**与 00-overview 的偏差说明**：D1/D2 的字段与数值全部满足，无冲突；以下三处是实施细化，已在 §0 记录并需要评审确认——(a) `Part` 字段在 D1 下限外补充 `state/disabled/hitCircles/damageTransfer` 等；(b) 敌人 `health` 继续表示核心生命、部件为附加结构，TTK 目标为“核心路线不变、部件路线略长”；(c) 转向指令不再乘总升力因子，升力损失改由 `maxBank/response` 表达，以保证 D2 的“左转约 35%”。

**实现前必须确认的符号**：§3.1 的 bank 符号表与 §3.4.2 的代入计算是实施时的唯一口径；若发现任何测试断言与 `bank > 0 = 左倾` 相反，先改测试注释/命名，不要改本文公式。
