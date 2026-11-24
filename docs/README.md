# Knight on Air 设计文档索引

这里是《Knight on Air》的设计文档入口。游戏是移动端竖屏网页版，目标是右手单手操作。它使用 3D lowpoly 资源、透视相机和固定俯视角，控制逻辑在 XZ 平面运行，因此拥有 2.5D 的操作清晰度和 3D 的空间临场感。

## 0.4 正式设计与实现

- [当前待办任务](TASKS.md)

1. [战斗设计与方案评审](DESIGN_0_4.md) 给出 21 项反馈的取舍、目标规则、实施顺序和验收条件。
2. [统一战斗架构与实施路线](ARCHITECTURE_0_4.md) 记录当前飞行、伤害、事件和内容库入口，以及 0.4 原始迁移方案。
3. [时代内容、默认装配与存档迁移](content/ERA_CONTENT_0_4.md) 定义四时代内容的分批范围、配置校验和老玩家权益。
4. [修改提案总览](changes/00-overview.md) 保留原始需求、详细推导和参数候选。0.4.0 已接入四时代、17 架基础机体和各时代敌群。真机性能和操作手感按正式设计的设备验收条件记录。
5. [0.4 地形与云实施方案](IMPLEMENTATION_0_4_TERRAIN_CLOUD.md) 记录确定性地形、真实地形块、低模云簇、双 pass 遮挡、Q 版色彩和分批验收步骤。

6. [空战与内容库验收](IMPLEMENTATION.md#当前空战与内容库验收) 记录固定种子出击、共享资源与五分钟满载画质切换结果。

维护行为规则时查阅 [OpenSpec 主规格](../openspec/specs)。扩充动态呈现内容时查阅 [运行时内容库规格](../openspec/specs/rendering/runtime-content-library/spec.md) 与 [仓库指导](../AGENTS.md)。

## 初版设计与 0.3.0 基线

1. [总设计文档](GAME_DESIGN.md)
2. [控制、相机和单手布局](systems/01-control-camera.md)
3. [机体、部件和损坏系统](systems/02-aircraft-body-damage.md)
4. [武器系统](systems/03-weapons.md)
5. [敌人和战场系统](systems/04-enemies-battlefield.md)
6. [升级和构筑系统](systems/05-progression-upgrades.md)
7. [程序化 3D 和 shader 表现](systems/06-procedural-3d.md)
8. [局外 UI 和主界面系统](systems/07-meta-ui.md)
9. [M0–M3 实现与验收记录](IMPLEMENTATION.md)
10. [局内核心玩法与构筑](GAMEPLAY_CORE.md)

## 初版内容目录

- [初版机体](content/INITIAL_AIRFRAMES.md)
- [初版武器](content/INITIAL_WEAPONS.md)
- [初版敌人](content/INITIAL_ENEMIES.md)
- [初版升级部件](content/INITIAL_UPGRADES.md)
- [初版局外 UI 内容](content/OUT_OF_BATTLE_UI.md)

## 文档约定

- 初版系统文档与 `changes/01–16` 保留各自阶段的设计背景。当前实现以 0.4 运行时架构和 OpenSpec 主规格为入口。
- 内容文档描述第一批可进入游戏的数据、行为和数值。
- 所有数值先作为配置，不直接写死在渲染逻辑中。
- `position.x` 和 `position.z` 是战斗平面的坐标，`position.y` 是高度。
- 数值会在真机试玩和遥测数据出现后继续调校。
