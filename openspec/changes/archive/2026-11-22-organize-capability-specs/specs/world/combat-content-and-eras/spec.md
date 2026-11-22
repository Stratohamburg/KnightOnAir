# Spec Delta

## Purpose

定义玩家机体、敌人载体、NPC 行为 profile、时代内容和配置引用的稳定数据契约，保证新增内容可以通过配置进入模拟、渲染和局外页面。

## ADDED Requirements

### Requirement: Valid combatant configuration

每个可运行的战斗载体 MUST 拥有合法层级、部件、运动参数、能力、视觉配置和战斗配置。

#### Scenario: Air combatant integrity

- **WHEN** 系统加载一个空中战斗载体
- **THEN** 配置包含至少一个有效升力来源、部件和可用运动参数

#### Scenario: Surface combatant integrity

- **WHEN** 系统加载一个地面或水面战斗载体
- **THEN** 配置包含兼容的路线能力和有效的地面运动参数

### Requirement: Profile references resolve

每个 NPC profile MUST 引用存在的战斗载体、合法的行为类型、生成预算和奖励配置。

#### Scenario: Unknown combatant reference

- **WHEN** profile 引用不存在的战斗载体
- **THEN** 配置校验报告该错误并阻止进入可运行战斗内容

### Requirement: Era content selection

时代 MUST 定义标签、任务、颜色、敌人池、阶段和层级上限，生成和局外展示必须使用同一时代上下文。

#### Scenario: Era enemy pool

- **WHEN** 世界进入指定时代
- **THEN** 敌人生成池、颜色和任务标签来自该时代配置

### Requirement: Content compatibility

配置校验 MUST 报告不存在的引用、非法数值和缺失的必要能力。战斗启动前须通过配置校验。

#### Scenario: Invalid weapon mount

- **WHEN** 机体挂点引用不存在或时代不兼容的武器
- **THEN** 配置校验报告该挂点错误并阻止该配置作为可运行内容
