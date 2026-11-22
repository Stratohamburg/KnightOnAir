# Spec Delta

## Purpose

定义局内敌人和战场目标如何按时代、阶段、预算和路线进入战斗。导演控制波次规模和登场位置，让玩家能逐步遇到不同类型的威胁。

## ADDED Requirements

### Requirement: Budgeted encounter spawning

导演生成敌人时 MUST 遵守普通空中单位、精英空中单位、地面与水面共享的预算，以及全场数量上限。

#### Scenario: Spawn cap

- **WHEN** 当前层级已经达到活动上限
- **THEN** 新的生成请求被延迟或丢弃，活动实体数量不会超过配置上限

#### Scenario: Era pool

- **WHEN** 世界处于某个时代的指定战斗阶段
- **THEN** 生成器只从该时代和阶段允许的敌人池中选择

### Requirement: Off-screen and safe spawning

导演 MUST 在当前视野外寻找满足安全间隔的生成位置，并在生成请求有效期内重试失败的放置。

#### Scenario: Visible spawn rejected

- **WHEN** 候选生成点位于玩家当前视野
- **THEN** 该请求不会直接创建敌人，并在有效期限内尝试其他位置

### Requirement: Configured enemy behavior

敌人行为 MUST 根据 profile 选择追击、拦截、护航、俯冲、巡逻、车队或静态目标行为。

#### Scenario: Air enemy attack window

- **WHEN** 空中敌人进入攻击范围
- **THEN** 敌人按照其行为 profile 进入攻击或脱离流程，并受转向和距离限制

#### Scenario: Routed convoy

- **WHEN** 地面或水面敌人被创建为路线单位
- **THEN** 单位沿允许的路线移动并维持定义的车距或编队关系

### Requirement: Separation and formation safety

空中敌人 MUST 在接近同层邻机时使用分离运动。路线车队 MUST 根据前车间隔限制前进。

#### Scenario: Air separation

- **WHEN** 两架空中敌人接近到分离半径以内
- **THEN** 分离目标参与运动意图，实体不会持续重叠

### Requirement: Encounter pressure adaptation

导演 MUST 按战斗时间调整敌人组合和波次规模，并在玩家生命偏低时减少普通空中波次请求数。

#### Scenario: Low health pressure

- **WHEN** 玩家生命低于定义阈值
- **THEN** 普通空中波次减少到一个生成请求，并继续受同一预算约束
