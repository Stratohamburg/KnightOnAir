# 0.4 架构迁移计划（历史归档）

> **归档说明**：本文保留从 0.3.0 规划配置 v3 与跨系统统一战斗管线时的原始接口草案与 Phase 0–7 迁移计划。当前运行时架构与配置校验契约请查阅 [运行时架构](../../ARCHITECTURE.md)。

## 敌人配置重设计

原先的 `EnemyConfig` 把物理、视觉、攻击、奖励和刷新揉成一张扁平表。它还迫使 `World` 根据 `kind` 写硬编码分支。12 的 v2 虽然补充了字段，仍然把物理实体和 NPC 行为放在同一个配置对象中。0.4 改用两个层次。

### 共享载体配置 `CombatantConfig`

这部分描述所有可战斗载体，包括玩家机体、NPC 敌人和 PvP 载具。

```ts
export interface CombatantConfig {
  id: string;
  era: EraId;
  layer: "air" | "ground" | "water";
  tags: string[];
  frame: MotionConfig;
  parts: PartRecipe[];
  mounts: MountRecipe[];
  capabilities: {
    bombing: boolean;
    lock: boolean;
    boost: boolean;
    routeKinds: ("road" | "rail" | "water")[];
  };
  visual: {
    modelKey: string;
    eraSkin: EraId;
    color: string;
    accent: string;
    scale: number;
  };
}

type MotionConfig =
  | {
      model: "air";
      mass: number;
      length: number;
      wingspan: number;
      wingArea: number;
      maxSpeed: number;
      cruiseSpeed: number;
      acceleration: number;
      turnRate: number;
      energyMax: number;
      energyRecover: number;
    }
  | {
      model: "ground" | "water";
      mass: number;
      length: number;
      radius: number;
      maxSpeed: number;
      acceleration: number;
      turnRate: number;
      routeKinds: ("road" | "rail" | "water")[];
    };

export interface MountRecipe {
  id: string;
  partId: string;
  weaponId: string;
  count: number;
  arc: number;
  baseAngle: number;
  targetLayers: ("air" | "ground" | "water")[];
}
```

### NPC 行为配置 `NpcProfile`

这部分只描述 AI 的目标策略、路线、编队、生成和奖励。它不重复质量、速度、生命或部件字段。

```ts
export interface NpcProfile {
  id: string;
  combatantId: string;
  behavior: {
    kind: "chase" | "patrol" | "intercept" | "escort" | "crossing" | "strafe" | "dive" | "standoff" | "convoy" | "static" | "flee";
    targetPolicy: "player" | "route" | "intercept" | "escort" | "groundTarget" | "none";
    preferredRange: [number, number];
    engageRadius: number;
    disengageRange: number;
    leadTime: number;
    breakChance: number;
    patrolRoute?: string;
    escortAnchorTag?: string;
  };
  spawn: {
    phases: ("intro" | "skirmish" | "pressure" | "mixed")[];
    weight: number;
    maxAlive: number;
    slotCost: number;
    formation?: "line" | "v" | "orbit" | "escort" | "crossing";
  };
  rewards: { xp: number; coins: number; score: number; drops?: string[] };
}
```

### 配置拆分示例

```ts
const swift: CombatantConfig = {
  id: "swift_01",
  era: "jet",
  layer: "air",
  tags: ["fighter", "singleEngine"],
  frame: { /* 质量、速度和操控 */ },
  parts: [ /* body、wing、engine、tail、gun、bay */ ],
  mounts: [ /* nose cannon、lock missile、bomb bay */ ],
  capabilities: { bombing: true, lock: true, boost: true, routeKinds: [] },
  visual: { modelKey: "swift", eraSkin: "jet", color: "token", accent: "token", scale: 1 },
};

const interceptor: NpcProfile = {
  id: "jet_interceptor",
  combatantId: "swift_01",
  behavior: {
    kind: "intercept",
    targetPolicy: "intercept",
    preferredRange: [14, 18],
    engageRadius: 40,
    disengageRange: 70,
    leadTime: 1.2,
    breakChance: 0.55,
  },
  spawn: { phases: ["skirmish", "pressure"], weight: 2, maxAlive: 3, slotCost: 1, formation: "line" },
  rewards: { xp: 32, coins: 4, score: 128 },
};
```

同一个 `CombatantConfig` 可以被玩家、AI 和 PvP 使用。`NpcProfile` 可以让同一架载体成为追击机、巡逻机或拦截机，而不复制一份物理数据。不同敌人需要不同机体时，只增加新的 `CombatantConfig`，不再增加 `World` 中按 `kind` 分支的物理逻辑。

## 实施顺序

这次变更需要先改模拟边界，再迁移数据和表现。直接先补敌人表会把旧分叉固化到新字段里。

### Phase 0 · 契约冻结与基线

目标是固定现有可玩行为，建立迁移护栏。

- 为当前三套测试增加固定种子、固定步长和实体快照。
- 新增 `CombatEntity`、分层运动状态、`ControllerIntent`、事件和配置校验的类型草案。
- 记录 0.3.0 四架机体的速度、转弯、武器、投弹和存档基线。
- 这一步不新增时代内容，不改变平衡。

### Phase 1 · 共享运行时和空中物理

目标是让玩家和一个测试空中敌人先走同一套空中运动更新，同时保留地面与水面的移动积分器。

- 将 `FlightDynamics` 从 `Player` 类型改为通用空中运动输入。
- 新增 `actors` 权威集合和分层积分器。空中使用 `integrateAirActor()`，地面与水面使用各自路线积分器。
- 把玩家输入转换为 `ControllerIntent`。
- 把当前一个 `hunter` 转换为测试用 AI 控制器，先使用 `chase`。
- 通过对照测试保证完好状态下速度、转弯和固定步长结果不变。

### Phase 2 · 共享部件、命中和损毁

目标是让玩家、空中敌人和地面/水面测试实体同时使用同一套部件、命中、伤害和事件管线。

- 新建 `parts.ts`、`DamageModel.ts`、`HitTest.ts` 和 `CombatDamage.ts`。
- 迁移玩家基础部件和升级部件。
- 迁移 `hunter`、`bomber`、`elite` 三种敌人的部件。
- 删除 `hitPlayer`、整体敌人圆命中、`damagePlayer` 和 `damageEnemy` 的独立结算路径。
- 验证同一部件、同一弹道和同一伤害输入对玩家与敌人产生相同结果。

### Phase 3 · 控制器、行为和避让

目标是让行为可预测，且行为只负责产生意图。

- 新增 `PlayerController`、`NpcController` 和未来的 `NetworkController` 接口。
- 将 `chase`、`patrol`、`intercept`、`escort`、`dive`、`standoff` 和 `convoy` 实现为目标点策略。
- 接入 `Separation`、编队槽位、路线车距和近身配额。
- 空中控制器输出都进入同一个 `integrateAirActor()`。地面和水面控制器进入各自的路线积分器。
- 用固定种子记录每类行为的目标点、距离、速度和状态转移。

### Phase 4 · 配置 v3 迁移

目标是把旧数据搬到共享载体配置和 NPC 行为配置。

- 先迁移现有四架玩家机体为 `CombatantConfig`。
- 再迁移现有敌人的物理、部件和挂载。
- 最后迁移敌人行为、刷新、路线和奖励。
- 每迁移一种敌人，删除一个对应的 `kind` 物理分支。
- 建立配置加载诊断，禁止未知武器、未知部件和未知行为静默回退。

### Phase 5 · 武器、表现和 UI

- 所有武器改为挂载部件上的 `WeaponRuntime`。
- 玩家和敌人的弹道都走同一池、同一目标过滤、同一命中和爆炸结算。
- `ActorRenderer` 读取统一部件状态。玩家、NPC 和将来的 PvP 载具只配置表现层策略。
- 雷达、边缘提示、击毁信息和部件反馈消费统一事件。

### Phase 6 · PvP 接口和内容扩充

- 接入 `NetworkController` 的输入缓冲和时间戳，不改变物理函数签名。
- 以 `factionId` 和目标过滤表达队伍关系。
- 先做本地双实体回放测试，再考虑网络同步和预测。
- 通过配置校验后分阶段加入萌芽期、一战、二战和初代喷气内容。

### Phase 7 · 平衡、性能和真机验收

- 重新测量部件损毁后的 TTK、行为完成率、生成密度和玩家可读性。
- 以标准档 360×640、满额实体和云层作为基准场景。
- 检查 30/60/120 FPS 的确定性、对象池和渲染预算。
- 最后再确定解锁分数、时代奖励和高级敌人组合。

## 阶段退出条件

| 阶段 | 必须通过的条件 |
| --- | --- |
| Phase 1 | 玩家和测试空中敌人使用相同空中运动函数，完好状态回归 0.3.0。地面与水面仍通过各自积分器运行。 |
| Phase 2 | 同一 `Part[]` 和同一命中输入产生相同部件状态、总生命扣减和 `ControlDamage`。 |
| Phase 3 | `chase`、`patrol`、`intercept` 三类行为在固定种子下目标可解释，空中敌人不重叠，分离不改变物理结果。 |
| Phase 4 | 所有启用配置通过 schema 校验，运行时不再按敌人 ID 写战斗或移动分支。空中和地面/水面只按 `layer` 选择各自积分器。 |
| Phase 5 | 玩家、NPC 和测试 PvP 载具共享弹道、命中、损毁和事件消费。 |
| Phase 6 | 网络控制器只提供输入和时间信息，模拟层不读取玩家身份。 |
| Phase 7 | 自动化、真机和性能验收全部完成后，才进入时代内容扩充。 |
