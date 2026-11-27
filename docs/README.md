# Knight on Air 文档总索引

这里是《Knight on Air · 云端骑士》的设计与工程文档入口。

仓库文档按**职责与时效**严格分为四层，避免将历史设计误认为现行规则：

1. **行为契约真源（What it must do）** → [OpenSpec 主规格](../openspec/specs)
2. **现行设计与技术指南（Why & How）** → 本目录根文档与 [机型档案](aircraft-profiles/README.md)
3. **当前待办与活跃变更（What's next）** → [待办清单](TASKS.md) · [OpenSpec 活跃变更](../openspec/changes)
4. **历史基线与评审存档（Archive）** → [历史归档](archive/README.md)

## 现行核心文档

| 文档 | 职责 | 主要读者 |
| --- | --- | --- |
| [玩法与构筑设计](GAMEPLAY_DESIGN.md) | 产品定位、核心循环、[空战体验与判断标准](GAMEPLAY_DESIGN.md#空战体验)、副本编排、敌人成长曲线、提质/提量构筑与模块骨架 | 策划 / 全部 |
| [运行时架构](ARCHITECTURE.md) | 模拟/渲染/内容库边界、共享战斗管线、实体/配置模型与配置校验契约 | 工程 / AI 协作 |
| [渲染与视觉指南](RENDERING_GUIDE.md) | 俯视角《光·遇》云野视觉原则、移动端性能红线、连续体积云、风动植被、地形块与双 Pass 遮挡 | 渲染 / 美术 |
| [时代内容与配置规范](CONTENT_CATALOG.md) | 四时代可玩范围、配置读取与校验规则、存档 v2 约定与二期候选索引 | 内容 / 策划 |
| [界面信息架构与菜单规范](UI_NAVIGATION_SPEC.md) | 局外页面职责、一级/二级菜单、按钮文案、调试展台隔离与菜单变更同步清单 | 产品 / UI / 工程 |
| [验收基准与测试指南](VERIFICATION.md) | 最新空战满载与体积云/植被性能基准、固定种子与 `?environmentTest` 复现命令、浏览器验收步骤 | 测试 / 性能 |
| [当前待办任务](TASKS.md) | 局内体验修正、移动真机发布验收、四时代平衡与待定范围设计 | 全部 |
| [程序化地形研究](PROCEDURAL_TERRAIN_RESEARCH.md) | 山脉骨架、排水网络、侵蚀方法以及 GAN / 扩散模型的离线评估边界 | 地形 / 渲染 / 研究 |
| [局内经济与成长机制调查](IN_RUN_ECONOMY_RESEARCH.md) | 《土豆兄弟》与同类游戏的局内经济、成长和可借鉴机制 | 策划 / 全部 |
| [局内成长机制深度解析](IN_RUN_PROGRESS_DEEP_DIVE.md) | XP、金币、商店消费、波次节奏、精英宝箱和局内外货币分层 | 策划 / 全部 |
| [土豆兄弟式局内流程升级计划](IN_RUN_PROGRESSION_PLAN.md) | 按波次解锁、金币改装、波末商店、精英奖励和实现验收 | 策划 / 工程 |

## 专题资产目录

- [真实机型三视图档案](aircraft-profiles/README.md)：三视图还原流程、历史偏差修正记录、原型准入标准，以及已建档原型（Dr.I、Spitfire Mk Vb、A6M2 二一型、Meteor F.3、Ho 229 V2）。

## 规范真源与开发约束

- [调试台主规格](../openspec/specs/app/debug-workbench/spec.md)定义原型与特效页签、从库读取配置的规则，以及特效和整机预览的验收场景。

- **仓库开发与 AI 协作约束**：[AGENTS.md](../AGENTS.md)
- **功能行为规则与验收场景**：[openspec/specs/](../openspec/specs)
- **动态 3D / 特效 / 2D 内容库规格与 Skill**：[运行时内容库规格](../openspec/specs/rendering/runtime-content-library/spec.md) · [runtime-content-library Skill](../.agents/skills/runtime-content-library/SKILL.md)
- **三视图低模飞机流水线规格与 Skill**：[程序化飞机规格](../openspec/specs/rendering/procedural-aircraft/spec.md) · [aircraft-reference-pipeline Skill](../.agents/skills/aircraft-reference-pipeline/SKILL.md)
- **界面信息架构与菜单规格及 Skill**：[菜单主规格](../openspec/specs/app/navigation-and-menu-architecture/spec.md) · [UI Navigation System Skill](../.agents/skills/ui-navigation-system/SKILL.md)

## 历史归档（非现行真源）

以下目录仅保留早期版本设计背景、决策取舍与原始提案，**不得替代现行文档与 OpenSpec 主规格**：

- [历史归档总览](archive/README.md)
- `v0.3` 初版基线：[初版 GDD](archive/v0.3/GAME_DESIGN.md)、[系统分文档 01–07](archive/v0.3/systems/01-control-camera.md)、[初版内容表](archive/v0.3/content/INITIAL_AIRFRAMES.md)、[M0–M3 交付记录](archive/v0.3/m0-m3-implementation.md)
- `v0.4` 方向调整与迁移：[0.4 方案评审](archive/v0.4/design-review.md)、[0.4 架构迁移计划](archive/v0.4/migration-plan.md)、[0.4 早期地形与云方案](archive/v0.4/terrain-cloud-plan.md)、[0.4 修改提案 00–16](archive/v0.4/proposals/00-overview.md)

## 通用坐标与写作约定

- `position.x`、`position.z` 是空战主平面坐标，`position.y` 是世界高度；模型本地 `+Z` 指向机头，固定相机朝向 `+Z`（屏幕向右对应世界 `-X`）。
- 影响手感、平衡与外观的数值统一落在配置数据文件，不硬编码在渲染逻辑中。
- 行为契约变更先更新 [OpenSpec](../openspec/specs)，再同步本目录中的高层设计、渲染原则或验收基准。
