# world/combat-content-and-eras Specification

## Purpose

定义玩家机体、敌人载体、NPC 行为 profile、空战运动配置、时代内容和配置引用的数据契约，保证新增内容可以通过配置进入统一模拟、渲染和局外页面。

## Requirements

### Requirement: Valid combatant configuration

每个可运行的战斗载体 MUST 拥有合法层级、部件、运动参数、能力、视觉配置和战斗配置。

#### Scenario: Air combatant integrity

- **WHEN** 系统加载一个空中战斗载体
- **THEN** 配置包含至少一个有效升力来源、质量、翼展、翼面积、极速、巡航速度、加速度、转向响应和可用部件

#### Scenario: Surface combatant integrity

- **WHEN** 系统加载一个地面或水面战斗载体
- **THEN** 配置包含兼容的路线能力和有效的地面运动参数

### Requirement: Shared air-control profile

空中敌人和玩家 MUST 使用同一套飞行控制字段和积分器。NPC profile 可以定义控制意图的阶段参数，但不得定义独立的瞬移、直接位置推进或独立物理分支。

#### Scenario: Enemy movement profile

- **WHEN** 系统加载一个空中敌人 profile
- **THEN** profile 包含巡航速度、攻击速度、加速度、转向响应、攻击窗口、脱离距离、重新切入距离和目标提前量

#### Scenario: Role differentiation

- **WHEN** 系统加载侦察机、追猎机、截击机、轰炸机或俯冲机
- **THEN** 每种角色通过速度、转向、攻击阶段和脱离阶段形成可辨识的运动差异

### Requirement: Profile references resolve

每个 NPC profile MUST 引用存在的战斗载体、合法的行为类型、生成预算和奖励配置。

#### Scenario: Unknown combatant reference

- **WHEN** profile 引用不存在的战斗载体
- **THEN** 配置校验报告该错误并阻止进入可运行战斗内容

### Requirement: Part and anchor references resolve

每个部件、武器挂点、发动机出口和损伤效果锚点 MUST 引用存在的部件或局部锚点。挂点必须包含局部三维位置和必要的局部旋转。

#### Scenario: Invalid local anchor

- **WHEN** 武器或效果引用不存在的局部锚点
- **THEN** 配置校验报告该错误并阻止该战斗载体进入运行时

### Requirement: Era content selection

玩家名录 MUST 只收录有可用专属三维装配器的机型，并沿用校验台的历史时代分组。已有可用校验模型的早期机型可以沿用该模型出击，校验台继续显示其几何近似与待核对项。

#### Scenario: Reference aircraft enter the playable roster

- **WHEN** 玩家在机库预览、装备或驾驶一架已接入的机型
- **THEN** 游戏使用校验台同一机型的专属基础装配器，战斗部件、挂点和解锁条件来自该机型配置

#### Scenario: A mission era has no playable aircraft of its own

- **WHEN** 某个关卡时代没有可装备机型
- **THEN** 该时代不出现在装备筛选中，关卡仍按已有规则使用指定或已装备的机型

时代 MUST 定义标签、任务、颜色、敌人池、阶段和层级上限，生成和局外展示必须使用同一时代上下文。

#### Scenario: Era enemy pool

- **WHEN** 世界进入指定时代
- **THEN** 敌人生成池、运动 profile、颜色和任务标签来自该时代配置

### Requirement: Content compatibility

配置校验 MUST 报告不存在的引用、非法数值、缺失的必要能力和不完整的空战行为参数。战斗启动前须通过配置校验。

#### Scenario: Invalid weapon mount

- **WHEN** 机体挂点引用不存在或时代不兼容的武器
- **THEN** 配置校验报告该挂点错误并阻止该配置作为可运行内容

#### Scenario: Invalid air behavior profile

- **WHEN** 空中敌人缺少攻击窗口、脱离距离或重新切入距离
- **THEN** 配置校验报告 profile 不完整并阻止该敌人进入生成池

