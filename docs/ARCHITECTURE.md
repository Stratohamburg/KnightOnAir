# 运行时架构

本文档记录《Knight on Air》现行的模拟、呈现、事件、内容库边界与配置校验契约。从 0.3.0 迁移到 0.4 统一管线的历史接口草案与 Phase 0–7 计划已归档至 [0.4 架构迁移计划](archive/v0.4/migration-plan.md)。

## 总体分层原则

- **纯数据固定步模拟（`src/simulation`）**：玩家操控、空中 NPC、地面/水面路线单位与回放输入都通过 `1/60` 秒固定步推进。模拟层严禁持有 Three.js 对象或 DOM 节点。
- **呈现与内容库边界（`src/content` / `src/rendering` / `src/app`）**：所有 3D 几何与材质、战斗特效批次、2D HUD 节点均在呈现层按 ID 查找并复用；跨层仅通过只读状态快照和公开战斗事件交互。

```text
玩家输入 / 空中 AI / 回放输入
        ↓
  ControllerIntent（目标航向 / 油门 / 加力 / 刹车 / 开火意图）
        ↓
  空中编队与分离（Separation）
        ↓
  ControlDamage 包线 + integrateAirActor
        ├── 地面 / 水面路线与独立移动积分器
        └── 共享局部挂点、相对运动扫掠、整机伤害分配与事件快照
```

## 当前运行时架构

| 范围 | 实现与维护入口 |
| --- | --- |
| 玩家、空中 NPC 与回放 | `World.frame` 以 1/60 秒推进模拟。玩家输入、`npcIntent` 和 `NetworkController` 都提供 `ControllerIntent`。`integrateAirActor` 统一处理油门、刹车、加力耗尽与回充、风场、滚转和损伤。 |
| 空战行为与地面路线 | `CombatantConfig` 定义载体与运动包线。`NpcProfile.airAttack` 定义攻击角、攻击窗口、脱离与重新切入和逃逸门槛。空中 NPC 的分离修正目标航向。地面与水面继续使用路线、车距和各层移动规则。 |
| 构型与挂点 | `Part` 描述部件，`RuntimeWeapon` 通过 `partId`、`anchorId` 和局部偏移绑定挂点。改装更新构型与命中轮廓，`localToWorld` 按机体位置、航向和滚转计算枪口、炮塔与发动机出口的世界姿态。 |
| 扫掠与伤害 | `HitTest` 用弹体和目标的相对运动计算最早世界接触点，部件归因可空。`DamageModel` 先扣归因部件可承受的量，余量等额分配，整机生命由部件生命求和。禁用部件保留轮廓，可脱落部件移除覆盖。 |
| 事件与反馈 | `GameApp` 每个渲染帧调用一次 `World.consumeEvents()`，把同一批事件交给渲染、HUD 和音频。开火、命中、禁用、脱落与击毁事件携带发生时的世界位置、方向、姿态和速度，接收方可在实体离场后继续使用快照。 |
| 内容与资源 | `src/content/3d` 提供机库与战斗共用的机体工厂、挂点和 `ContentCatalog` 资源租用；`src/content/fx` 管理武器特效、烟雾和碎屑批次；`src/content/2d` 负责战斗视图、雷达、名牌和可复用 DOM 组件。 |

## 核心代码入口

- **模拟与控制**：[主世界与导演](../src/simulation/World.ts) · [共享飞行动力学](../src/simulation/FlightDynamics.ts) · [NPC 与回放控制](../src/simulation/Controllers.ts) · [命中检测](../src/simulation/HitTest.ts) · [部件伤害](../src/simulation/DamageModel.ts) · [确定性风场](../src/simulation/WindField.ts) · [状态与事件类型](../src/simulation/types.ts)
- **输入与应用壳层**：[虚拟摇杆](../src/input/VirtualStick.ts) · [应用与会话管理](../src/app/GameApp.ts)
- **内容库与渲染**：[3D 共享目录](../src/content/3d/ContentCatalog.ts) · [机体工厂](../src/content/3d/AircraftFactory.ts) · [局部锚点](../src/content/3d/anchors.ts) · [场景对象工厂](../src/content/3d/SceneObjects.ts) · [战斗特效](../src/content/fx/CombatEffects.ts) · [战斗 HUD](../src/content/2d/CombatHud.ts) · [主渲染器](../src/rendering/Renderer.ts)

## 配置模型与校验契约

战斗载体与 AI 行为拆分为两层数据，避免 `World` 按敌人 `kind` 硬编码物理分支：

- **共享载体配置（`CombatantConfig`）**：描述所有可战斗载体（玩家机体、NPC 敌人与回放/PvP 载具）的时代、目标层、运动包线、部件配方、武器挂点、能力标记与视觉标识。
- **NPC 行为配置（`NpcProfile`）**：仅描述 AI 的目标策略、空战攻击窗口、路线、编队、生成阶段/预算权重与奖励，不重复质量、速度或部件字段。

加载配置时必须一次性完成校验，失败条目直接进入诊断列表，**禁止运行时静默回退到默认武器或默认敌人行为**：

- 所有 `parts` 的 `partId` 唯一，机身段至少一个，挂载部件存在。
- 所有 `mounts.weaponId` 存在，武器目标层与实体层合法。
- 部件的 `lift`、`thrust`、`damageTransfer` 和质量为有限值。
- 空中载体至少有可用机身段和一组有效升力来源；地面和水面载体必须声明路线能力或静态能力。
- `NpcProfile.combatantId` 存在，行为字段完整，路线行为有路线 ID，护航行为有锚点规则。
- `slotCost` 和 `maxAlive` 不得绕过全局预算；开场、波次、召唤、护航和精英共用同一生成请求。
- 每个时代的内容只能引用允许时代或已声明的早期复用武器。

## 关联规格与验证入口

- 行为契约：[空战行为规格](../openspec/specs/battle/air-combat-behavior/spec.md) · [机体伤害规格](../openspec/specs/battle/aircraft-damage/spec.md) · [运行时内容库规格](../openspec/specs/rendering/runtime-content-library/spec.md) · [仓库开发约束](../AGENTS.md)
- 配置与校验实现：[combatants.ts](../src/data/combatants.ts) · [时代内容与配置规范](CONTENT_CATALOG.md)
- 集成与性能基准：[验收基准与测试指南](VERIFICATION.md)
