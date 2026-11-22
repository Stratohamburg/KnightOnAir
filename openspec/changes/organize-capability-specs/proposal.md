# Proposal

## Why

项目已经形成局外机库、局内战斗、固定步模拟、配置驱动内容、程序化渲染和环境表现等多组稳定能力，但当前 `openspec/specs` 为空，现有行为主要分散在源码、测试、系统文档和历史变更文档中。输入、相机、局内改装、局内战斗、局外机库和持久化拥有不同的状态所有权与验收方式，需要建立更细的长期 capability 边界，降低后续变更之间的耦合。

## What Changes

- 建立按 `app`、`battle`、`world`、`rendering` 组织的长期 capability spec。
- 将应用页面状态与局内世界状态分开描述。
- 将输入动作绑定、相机与视角反馈、战斗 HUD 与事件反馈分别描述。
- 将局内会话生命周期、局内成长、局内机体改装、机体损伤、武器与轰炸、敌人导演分别描述。
- 将局外机库、局外持久状态、地形路线、战斗内容与时代配置分别描述。
- 将程序化飞机、地形渲染和质量性能预算分别描述，云渲染与风动植被沿用现有独立变更。
- 将每个 capability 的职责、状态边界、现有实现映射和验收重点固化为 spec-driven delta specs。
- 保留当前 `volumetric-clouds-and-wind-vegetation` 变更的范围和文件，不在本变更中归档或修改它。

## Capabilities

### New Capabilities

- `app/shell-routing`: 应用页面状态、弹层和跨页面流程。
- `app/out-of-battle-hangar`: 局外出击页、装备页、机体预览和出击准备。
- `app/persistence-and-meta-progression`: 局外存档、解锁、装备、设置和长期统计。
- `battle/session-lifecycle`: 一局战斗的阶段、时钟、暂停、死亡和结算。
- `battle/input-and-action-binding`: 摇杆、键盘、按钮、技能动作和输入门控。
- `battle/camera-and-view-feedback`: 局内不同状态的视角、镜头过渡和视角反馈。
- `battle/in-run-progression`: 局内 XP、等级、分数、金币、拾取物和升级次数。
- `battle/aircraft-refit`: 局内三选一升级、部件安装、构型变化和战斗恢复。
- `battle/aircraft-damage`: 共享部件损伤、操控退化、武器失效和维修。
- `battle/weapons-targeting-and-bombing`: 武器、锁定、投射物、制导、轰炸包线和落点。
- `battle/encounter-director`: 敌人生成、行为、上限、分离、路线战斗和战斗节奏。
- `battle/battle-hud-and-event-feedback`: HUD、雷达、边缘提示、告警、击毁反馈和事件消费。
- `world/terrain-and-routes`: 确定性地形、地表查询、水面和地面路线语义。
- `world/combat-content-and-eras`: 机体、敌人、NPC profile、时代和配置完整性。
- `rendering/procedural-aircraft`: 玩家与敌人程序化飞机、部件构型和损伤表现。
- `rendering/terrain-rendering`: 地形块、水面、路线设施、远景山体和地形材质。
- `rendering/quality-and-performance`: 质量档位、动态分辨率、资源预算、诊断和设备验收。

### Modified Capabilities

当前 `openspec/specs` 没有已登记的长期 capability，因此本变更不修改已有持久化 spec。当前进行中的 `volumetric-clouds-and-wind-vegetation` 变更继续独立维护其两个 delta spec。

## Impact

- 主要影响 OpenSpec 规划资产，不修改运行时代码、测试代码或产品文档。
- 新 spec 会映射现有 `src/app`、`src/battle`、`src/simulation`、`src/rendering`、`src/ui`、`src/data` 和 `src/services` 中的行为。
- `World.ts`、`Renderer.ts` 和 `GameApp.ts` 作为组合根，允许被多个 capability spec 引用。
- 现有测试和构建命令作为各 capability 的验证依据。
- 后续归档这些 delta specs 时，长期 spec 将获得稳定的能力目录结构。
