# Spec Delta

## Purpose

定义局内敌人和战场目标如何按时代、阶段、预算和路线进入战斗，形成可理解且受控的持续压力。

## ADDED Requirements

### Requirement: Budgeted encounter spawning

敌人生成 MUST 遵守空中、地面、水面和全场活动上限，并根据当前战斗阶段和时代选择合法敌人。

#### Scenario: Spawn cap

- **WHEN** 当前层级已经达到活动上限
- **THEN** 新的生成请求被延迟或丢弃，活动实体数量不会超过配置上限

#### Scenario: Era pool

- **WHEN** 世界处于某个时代的指定战斗阶段
- **THEN** 生成器只从该时代和阶段允许的敌人池中选择

### Requirement: Off-screen and safe spawning

敌人 MUST 在玩家视野外并满足安全距离后进入世界，生成失败时必须保留可解释的延迟或重试行为。

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

空中敌人 MUST 维持最小分离距离，地面和水面车队 MUST 维持路线上的安全间隔。

#### Scenario: Air separation

- **WHEN** 两架空中敌人接近到分离半径以内
- **THEN** 分离目标参与运动意图，实体不会持续重叠

### Requirement: Encounter pressure adaptation

导演 MUST 根据战斗时间、玩家生命和精英节奏调整生成频率与组合，同时保留最大预算约束。

#### Scenario: Low health pressure

- **WHEN** 玩家生命低于定义阈值
- **THEN** 追击型压力降低或生成节奏调整，但不会绕过敌人上限
