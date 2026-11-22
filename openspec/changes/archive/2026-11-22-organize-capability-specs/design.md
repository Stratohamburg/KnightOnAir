# Design

## Context

See `proposal.md` for the motivation and capability inventory. 当前系统已经有两套独立状态机。应用层维护局外、出击过渡、战斗和结算页面，模拟层维护普通战斗、轰炸、升级、暂停、死亡和结算阶段。`GameApp`、`World` 和 `Renderer` 是组合根，分别协调 UI、模拟和渲染能力。

当前长期 spec 目录为空。现有系统文档按历史修改主题组织，部分主题跨越输入、相机、局内玩法、内容配置和渲染多个边界。新的目录需要保留这些行为之间的关系，同时让后续变更可以只修改一个能力边界。

## Goals / Non-Goals

**Goals:**

- 按用户可感知行为和稳定状态所有权建立 capability 边界。
- 将输入、相机、局内会话、局内成长、局内改装、局内损伤和局内反馈分别描述。
- 将局外机库和局外持久状态与局内临时状态分开描述。
- 将模拟层的地形语义和渲染层的地形表现分开描述。
- 保留当前云和植被变更的独立 delta spec，避免重复定义。
- 让每个 spec 都能关联现有测试、浏览器验收或配置校验。

**Non-Goals:**

- 不修改运行时代码、测试代码或产品文档。
- 不在本变更中归档 `volumetric-clouds-and-wind-vegetation`。
- 不拆分 `Random`、`ObjectPool`、`Telemetry`、图标和音频振荡器等通用支撑为独立 capability。
- 不把 `World.ts`、`Renderer.ts` 或 `GameApp.ts` 当作单独的行为 spec。

## Decisions

### Capability paths follow product domains

spec 路径使用 `app`、`battle`、`world` 和 `rendering` 四个领域。领域下面继续按独立行为拆分。输入和相机分开，因为输入产生语义动作，相机消费页面和战斗状态并产生视角反馈。局内会话、局内成长和局内改装分开，因为它们分别拥有阶段、资源进度和构型变更的不同不变量。

历史文档可以继续保留为背景材料。长期 spec 以稳定行为为准，多个历史文档中的同一行为归入同一个 capability。

### Separate application and world lifecycles

应用页面状态和战斗世界状态使用不同的 spec。应用 spec 负责页面导航、弹层、出击过渡和结算返回。战斗 spec 负责模拟阶段、暂停、升级、死亡和世界时间。应用层通过会话边界创建或销毁 World，局外存档只接收结算结果。

### Keep input semantic and gameplay effects separate

输入 spec 负责触控、键盘、现有战斗按钮、动作优先级和屏蔽规则。加力效果由局内会话的飞行规则维护，投弹效果由武器与轰炸维护，升级效果由局内机体改装维护。后续引入主动技能时，触发与输入门控沿用输入边界，冷却、消耗与效果由对应玩法能力定义。

### Split authoritative world data from rendering expression

地形高度、路线位置、水面和坡度属于世界语义。地形块、材质、水面视觉和路线设施属于渲染表现。程序化飞机同样读取配置和部件状态，但由独立 rendering spec 负责轮廓、挂点和损伤表现。这样可以替换渲染实现而不改变模拟规则。

### Treat refit as a first-class in-run capability

局内改装单独拥有候选合法性、安装、统计变化、部件变化、武器挂点和暂停恢复契约。它同时连接 in-run progression、aircraft damage 和 procedural aircraft，但这些连接通过可观察的构型和事件行为表达。

### Keep environment capabilities independent

云和植被继续由现有 `volumetric-cloud-rendering` 与 `wind-driven-vegetation` 变更维护。本变更只建立其周边能力的长期目录，不复制两个环境 delta，也不改变它们的实现状态。

### Use behavior evidence for future archival

行为基线取自当前源码与测试。历史设计用于追踪需求来源。主动技能通用入口、事件驱动镜头震动、暂停时冻结镜头构图和炸弹舱损坏专属文案属于当前实现之外的设计项。相机目前按模式过渡，暂停轰炸时 `isBombing` 为 false，渲染仍会向巡航构图插值。结算和机库预览的证据以手工流程和对应实现为主。

## Evidence

测试文件相对于 `tests/`，文档路径相对于仓库根。

| 能力 | 证据 |
| --- | --- |
| `app/shell-routing` | `GameApp` 的出击、弹层、结算、失焦处理。见 `docs/IMPLEMENTATION.md` 浏览器验收步骤 1、6、7。 |
| `app/out-of-battle-hangar` | `GameApp.showMeta`、`browse`、`startBattle`。见 `docs/IMPLEMENTATION.md` 步骤 1–3 及预览未解锁机体记录。 |
| `app/persistence-and-meta-progression` | `simulation.test.ts` 的解锁与异常存档，`config-v3.test.ts` 的 v1 重置和 v2 写入。 |
| `battle/session-lifecycle` | `simulation.test.ts` 的固定步、暂停恢复和死亡结算，`flight-dynamics.test.ts` 的滚转与包线。 |
| `battle/input-and-action-binding` | `controls.test.ts` 的触控、键盘、摇杆取消、油门和加力，`GameApp.onClick` 与 `onKey` 的按钮和快捷键派发。 |
| `battle/camera-and-view-feedback` | `controls.test.ts` 的固定方向与多宽高比居中测试，`Renderer.render` 的出击、轰炸和坠毁构图。 |
| `battle/in-run-progression` | `simulation.test.ts` 的经验溢出，`baseline-0_4.test.ts` 的补给容量，`World.finishEnemy` 与 `updatePickups` 的奖励时点。 |
| `battle/aircraft-refit` | `simulation.test.ts` 的合法候选、挂点和非对称构型，`baseline-0_4.test.ts` 的兜底候选、保留损伤和弹舱改装。 |
| `battle/aircraft-damage` | `baseline-0_4.test.ts` 的生命汇总、跳过禁用部件和维修优先级，`simulation.test.ts` 的动力与武器挂点退化。 |
| `battle/weapons-targeting-and-bombing` | `simulation.test.ts` 的锁定衰减、扫掠碰撞和固定落点，`baseline-0_4.test.ts` 的目标层与弹舱限制。 |
| `battle/encounter-director` | `baseline-0_4.test.ts` 的屏外放置重试、时代上限、共享地表预算和同路线车距。 |
| `battle/battle-hud-and-event-feedback` | `CombatHud.consume`、`CombatHud.update`、`GameApp.updateHud` 和 `updateLabels`。见 `docs/IMPLEMENTATION.md` 的投弹、升级和战斗界面验收。 |
| `world/terrain-and-routes` | `terrain-chunks.test.ts` 的水位与河床，`baseline-0_4.test.ts` 的路线移动，`Terrain` 和 `Routes` 的坐标查询。 |
| `world/combat-content-and-eras` | `config-v3.test.ts` 的配置完整性与挂载，`baseline-0_4.test.ts` 的时代变体。 |
| `rendering/procedural-aircraft` | `controls.test.ts` 使用程序化模型检验机头投影。见 `docs/IMPLEMENTATION_0_4_TERRAIN_CLOUD.md` 的四时代构型与出击记录。 |
| `rendering/terrain-rendering` | `terrain-chunks.test.ts` 的分块和水网格拼接，`?environmentTest=1` 的 `terrain` 场景。 |
| `rendering/quality-and-performance` | `cloudscape.test.ts` 的画质档位采样上限，`vegetation.test.ts` 的实例预算，`EnvironmentAcceptance.report()` 的帧统计和资源统计。 |
| `volumetric-cloud-rendering` | `cloudscape.test.ts` 的可重复布局、河道云口、密度、投影与风流，`cloudscape` 浏览器验收场景。 |
| `wind-driven-vegetation` | `vegetation.test.ts` 的确定性布置、贴地、风采样和草簇预算，`grass` 与 `tree` 浏览器验收场景。 |

2026-11-22 的云和植被验收已确认，环境变更任务为 20/20。仓库记录的 360×640 Chrome 基准使用 RTX 2060 和 ANGLE D3D11，标准档在满额场景中的峰值为 92 次绘制和 52,058 个三角形，帧间隔 P95 为 16.8 ms。实体手机持续帧率待实测。当前这轮复核运行了 8 个测试文件的 86 项用例以及生产构建。浏览器数据见 `docs/IMPLEMENTATION_0_4_TERRAIN_CLOUD.md` 的浏览器验收小节。

## Historical change mapping

| `docs/changes` 主题 | 主 spec | 关联 spec |
| --- | --- | --- |
| 01 空中拾取与升级池 | `battle/in-run-progression` | `battle/aircraft-refit`、`battle/aircraft-damage` |
| 02 敌人生成与分离 | `battle/encounter-director` | `world/combat-content-and-eras`、`battle/battle-hud-and-event-feedback` |
| 03 部件与损坏退化 | `battle/aircraft-damage` | `battle/session-lifecycle`、`battle/weapons-targeting-and-bombing`、`rendering/procedural-aircraft` |
| 04 油门分区与加力 | `battle/input-and-action-binding` | `battle/session-lifecycle`、`battle/battle-hud-and-event-feedback` |
| 05 雷达告警与目标反馈 | `battle/battle-hud-and-event-feedback` | `battle/encounter-director`、`battle/camera-and-view-feedback` |
| 06 地面路线与地形 | `world/terrain-and-routes` | `rendering/terrain-rendering`、`battle/encounter-director` |
| 07 云块与遮挡 | `volumetric-cloud-rendering` | `battle/battle-hud-and-event-feedback`、`rendering/quality-and-performance` |
| 08 Q 版美术与时代进程 | `world/combat-content-and-eras` | `rendering/procedural-aircraft`、`app/out-of-battle-hangar`、`app/persistence-and-meta-progression` |
| 09 投弹包线与气动转弯 | `battle/weapons-targeting-and-bombing` | `battle/session-lifecycle`、`battle/aircraft-damage` |
| 10 高度分层与轰炸镜头 | `battle/camera-and-view-feedback` | `battle/weapons-targeting-and-bombing`、`world/terrain-and-routes` |
| 11 机体配置与改装 | `battle/aircraft-refit` | `world/combat-content-and-eras`、`rendering/procedural-aircraft` |
| 12 敌人与武器配置 | `world/combat-content-and-eras` | `battle/weapons-targeting-and-bombing`、`battle/encounter-director` |
| 13 萌芽期配置 | `world/combat-content-and-eras` | `battle/encounter-director`、`app/out-of-battle-hangar` |
| 14 一战配置 | `world/combat-content-and-eras` | `battle/encounter-director`、`rendering/procedural-aircraft` |
| 15 二战配置 | `world/combat-content-and-eras` | `battle/encounter-director`、`rendering/procedural-aircraft` |
| 16 初代喷气配置 | `world/combat-content-and-eras` | `battle/encounter-director`、`battle/weapons-targeting-and-bombing` |

## Risks / Trade-offs

- [Risk] 一个组合根文件会被多个 spec 引用，边界可能被误解为文件所有权。 -> 在每个 spec 中描述状态和行为契约，设计和任务文件中使用符号级映射，不以文件归属作为边界。
- [Risk] 局内改装同时改变模拟、UI 和渲染，单一变更可能涉及多个 spec。 -> 以 `aircraft-refit` 作为主能力，其他 spec 只接收其公开的构型、事件和状态结果。
- [Risk] 历史文档与当前实现存在数值或命名差异。 -> 归档前以当前测试、配置和已验证行为为准，历史文档保留为设计背景。
- [Risk] 质量和性能验收横跨所有渲染能力。 -> 使用独立 `quality-and-performance` spec 维护共享预算，并在云、植被、地形和飞机 spec 中引用其验收约束。

## Migration Plan

1. 核对 17 个 delta spec 的行为与证据。
2. 按已验收的环境实现核对两个环境 delta，保留它们原有的能力路径。
3. 分别同步两组规范并归档变更，核对长期清单中的 19 个能力。

回滚时可以移除本变更的规划目录并保留源码和当前环境变更。该整理不改变运行时数据、存档格式或部署产物。
