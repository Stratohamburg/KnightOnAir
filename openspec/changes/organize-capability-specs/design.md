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

输入 spec 负责触控、键盘、按钮、技能入口、动作优先级和屏蔽规则。具体动作的效果归属对应玩法 spec。加力效果归入飞行模拟，投弹效果归入武器和轰炸，升级效果归入机体改装，技能若形成独立冷却和效果系统再增加独立 capability。

### Split authoritative world data from rendering expression

地形高度、路线位置、水面和坡度属于世界语义。地形块、材质、水面视觉和路线设施属于渲染表现。程序化飞机同样读取配置和部件状态，但由独立 rendering spec 负责轮廓、挂点和损伤表现。这样可以替换渲染实现而不改变模拟规则。

### Treat refit as a first-class in-run capability

局内改装单独拥有候选合法性、安装、统计变化、部件变化、武器挂点和暂停恢复契约。它同时连接 in-run progression、aircraft damage 和 procedural aircraft，但这些连接通过可观察的构型和事件行为表达。

### Keep environment capabilities independent

云和植被继续由现有 `volumetric-cloud-rendering` 与 `wind-driven-vegetation` 变更维护。本变更只建立其周边能力的长期目录，不复制两个环境 delta，也不改变它们的实现状态。

### Use behavior evidence for future archival

每个 capability spec 以现有测试、配置校验、浏览器验收钩子或性能诊断作为验证来源。归档前先更新当前环境变更的任务账本，再把本变更和环境变更分别归档，避免把未完成的性能和设备验收写成已完成能力。

## Risks / Trade-offs

- [Risk] 一个组合根文件会被多个 spec 引用，边界可能被误解为文件所有权。 -> 在每个 spec 中描述状态和行为契约，设计和任务文件中使用符号级映射，不以文件归属作为边界。
- [Risk] 局内改装同时改变模拟、UI 和渲染，单一变更可能涉及多个 spec。 -> 以 `aircraft-refit` 作为主能力，其他 spec 只接收其公开的构型、事件和状态结果。
- [Risk] 历史文档与当前实现存在数值或命名差异。 -> 归档前以当前测试、配置和已验证行为为准，历史文档保留为设计背景。
- [Risk] 质量和性能验收横跨所有渲染能力。 -> 使用独立 `quality-and-performance` spec 维护共享预算，并在云、植被、地形和飞机 spec 中引用其验收约束。

## Migration Plan

1. 保留当前未完成的 `volumetric-clouds-and-wind-vegetation` 变更不动。
2. 核对本变更生成的 17 个 delta spec 与源码、测试和现有文档的行为映射。
3. 先完成环境变更中的云和植被验收，再归档两个环境 capability。
4. 归档本变更，使 17 个 capability 进入长期 `openspec/specs` 目录。
5. 后续需求按照 capability 路径创建变更，跨域需求通过依赖和设计文件明确连接。

回滚时可以移除本变更的规划目录并保留源码和当前环境变更。该整理不改变运行时数据、存档格式或部署产物。
