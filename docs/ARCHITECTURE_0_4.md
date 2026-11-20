# 0.4 统一战斗架构与实施路线

本文件是 0.4 的跨系统实施规范。它解决三个问题。空中玩家、空中 NPC 和未来空中 PvP 必须经过同一套操纵、飞行物理、命中、部件损毁和武器逻辑。地面和水面单位保留独立的路线与移动模拟。所有战斗实体共用部件、命中、伤害传递、损毁状态、武器失效和事件逻辑。敌人的行为需要可预测、可配置。

当前代码和 01–16 修改文档仍处于迁移前状态。实施以本文件的接口和顺序为准，内容数值以 [0.4 战斗设计与方案评审](DESIGN_0_4.md) 和 [时代内容、默认装配与存档迁移](content/ERA_CONTENT_0_4.md) 为准。

## 当前仍存在的玩家与非玩家分叉

| 区域 | 当前分叉 | 目标收口 |
| --- | --- | --- |
| 空中物理更新 | `World.updatePlayer()` 和空中部分的 `World.updateEnemies()` 分开。玩家使用 `updateFlightTurn`，敌人使用另一套 `turnVelocity`、`speed` 和 `bank` 更新。 | 一个 `integrateAirActor()`。空中控制器只提供目标方向、速度意图和动作请求。 |
| 地面与水面移动 | 地面单位在 `updateEnemies()` 中和空中敌人共用函数，路线、车距和追击条件逐步增加。 | `integrateGroundActor()` 和 `integrateWaterActor()` 保留独立路线与移动规则。它们只接入共享战斗、武器和事件管线。 |
| 飞行模型 | `FlightDynamics.flightEnvelope()` 和 `updateFlightTurn()` 的参数类型是 `Player`。空中敌人没有相同的包线计算。 | `AirMotionState` 和 `ControlDamage` 作为通用输入。空中玩家、空中敌人和空中 PvP 载具调用同一函数。 |
| 命中检测 | `hitPlayer()` 与敌人整体圆检测分开。 | `hitEntity(entity, sweptProjectile)` 对任意 `CombatEntity` 返回最早命中的部件。 |
| 伤害结算 | `damagePlayer()` 与 `damageEnemy()` 分开。玩家和敌人都需要部件总生命。 | `applyPartDamage()` 统一处理命中部件生命、总生命扣减、损毁状态、挂载武器和事件。 |
| 损毁性能 | 玩家有 `partFactor()`，敌人按 `health` 比例降速和改变状态。地面单位也有单独的速度衰减路径。 | `evaluateDamage(parts, config)` 统一输出部件功能和武器状态。空中单位使用其中的飞行控制字段，地面和水面单位使用发动机、轮组和武器字段。 |
| 武器 | 玩家武器挂在 `player.weapons`。敌人开火时临时复制 `WEAPONS.light_cannon` 并覆盖数值。 | 所有武器都是挂载在实体部件上的 `WeaponRuntime`，开火使用相同的冷却、射界、弹道和目标过滤。 |
| 渲染 | 玩家走 `ProceduralAircraft`，敌人走 `Renderer.createEnemy`。 | `ActorRenderer` 按同一 `parts` 状态建组。玩家和敌人只在相机层级、标签和特效预算上有表现差异。 |
| 数据 | 玩家用 `Airframe`，敌人用扁平 `EnemyConfig`。 | 物理和挂载进入共享 `CombatantConfig`。AI、刷新和奖励进入 `NpcProfile`。 |
| 生命周期 | 玩家受升级、轰炸、结算和存档影响。敌人受导演、回收和奖励影响。 | 这些属于控制器、场景导演和局外系统，不进入共享物理和伤害分支。 |

因此当前仍有明显区分。第一个实施目标是消除空中玩家与空中 NPC 的操纵、飞行物理和战斗分叉，并把地面与水面单位接入共享伤害管线。升级、存档、战斗结算、相机跟随和敌人刷新仍然可以保留各自的业务入口。它们通过通用事件和控制接口连接战斗模拟。

## 统一运行时模型

### 运行时实体

```ts
export interface CombatEntity {
  id: string;
  configId: string;
  factionId: string;
  layer: "air" | "ground" | "water";
  position: { x: number; z: number; y: number };
  previous: { x: number; z: number; y: number };
  motion: AirMotionState | GroundMotionState | WaterMotionState;
  health: number;
  maxHealth: number;
  parts: Part[];
  weapons: WeaponRuntime[];
  damage: ControlDamage;
  partRevision: number;
  damageRevision: number;
  controllerId: string;
}

export interface AirMotionState {
  heading: number;
  speed: number;
  vx: number;
  vz: number;
  turnVelocity: number;
  bank: number;
  rollVelocity: number;
}

export interface GroundMotionState {
  heading: number;
  speed: number;
  routeId?: string;
  routeDistance?: number;
  laneOffset?: number;
}

export interface WaterMotionState {
  heading: number;
  speed: number;
  routeId?: string;
  routeDistance?: number;
  laneOffset?: number;
}

export interface ControllerIntent {
  targetHeading?: number;
  targetPoint?: { x: number; z: number };
  throttle: number;
  boost: number;
  fire: boolean;
  bomb: boolean;
  brake: boolean;
}
```

玩家控制器把摇杆和键盘转换成空中 `ControllerIntent`。空中 AI 控制器从行为配置和场景快照生成相同结构。网络控制器将来直接写入相同结构。`integrateAirActor()` 不读取玩家、敌人或网络身份，只读取实体配置、当前部件状态和控制意图。地面和水面控制器生成路线、车道和速度意图，交给各自的移动积分器。

### 每个固定步的顺序

```text
1. 场景快照和控制器生成 ControllerIntent
2. 行为目标、玩家目标或网络目标生成目标点
3. 空中编队和分离修正空中目标点，地面与水面路线系统修正路线意图
4. evaluateDamage 更新所有实体的共享部件功能和伤害结果，空中实体额外消费飞行 ControlDamage
5. 空中实体调用 `integrateAirActor`，地面与水面实体调用各自移动积分器
6. updateWeapons 根据同一挂载和目标过滤发射
7. updateProjectiles 调用 hitEntity 和 applyPartDamage
8. 发布 damage、part_disabled、weapon_disabled、entity_destroyed 等事件
9. 场景导演处理生成、回收、奖励和下一步控制器输入
```

`World.actors` 是模拟的权威集合。迁移期可以保留 `world.player` 和 `world.enemies` 作为按 `controllerId`、`factionId` 或 `layer` 过滤的只读视图。任何新的空中物理逻辑必须写入 `integrateAirActor`。地面和水面移动逻辑写入各自积分器。共享命中、伤害和武器逻辑写入 `actors` 管线。

### 允许存在的身份差异

身份差异只出现在控制来源和局外业务。

| 差异 | 允许的行为 |
| --- | --- |
| 控制来源 | 玩家输入、空中 AI 行为、网络输入生成不同的 `ControllerIntent`。地面和水面控制器生成路线意图。 |
| 目标过滤 | `factionId` 决定可攻击对象。敌我双方使用同一武器目标过滤函数。 |
| 局外系统 | 玩家可以升级、存档、结算和进入轰炸模式。NPC 可以被导演生成、回收和奖励。 |
| 表现层 | 玩家跟随主相机，敌人显示血条、雷达点和边缘指示。两者读取同一部件状态。 |
| 资源能力 | 某个实体可以在配置中没有炸弹舱、雷达或加力部件。能力缺失由 `ControlDamage` 和挂载数据表达。 |

空中物理公式、命中顺序、部件状态、总生命扣减、武器失效、碰撞和弹道不因身份变化。地面与水面的路线和移动公式独立，命中和损毁公式保持共用。

## 敌人配置重设计

当前 `EnemyConfig` 把物理、视觉、攻击、奖励和刷新揉成一张扁平表。它还迫使 `World` 根据 `kind` 写硬编码分支。12 的 v2 虽然补充了字段，仍然把物理实体和 NPC 行为放在同一个配置对象中。0.4 改用两个层次。

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

### 配置校验

加载配置时必须一次性验证：

- 所有 `parts` 的 `partId` 唯一，机身段至少一个，挂载部件存在。
- 所有 `mounts.weaponId` 存在，武器目标层与实体层合法。
- 部件的 `lift`、`thrust`、`damageTransfer` 和质量为有限值。
- 空中载体至少有可用机身段和一组有效升力来源。地面和水面载体必须声明路线能力或静态能力。
- `NpcProfile.combatantId` 存在，行为字段完整，路线行为有路线 ID，护航行为有锚点规则。
- `slotCost` 和 `maxAlive` 不得绕过全局预算。召唤、护航和精英都使用同一生成请求。
- 每个时代的内容只能引用允许时代或已声明的早期复用武器。

加载失败时整条配置进入诊断列表，不能在运行时通过默认 `light_cannon` 或默认敌人行为静默修复。

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
