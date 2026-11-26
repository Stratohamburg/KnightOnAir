# battle/encounter-director Specification

## Purpose

定义局内敌人和战场目标如何按时代、阶段、预算、路线和空战行为进入战斗。导演控制波次规模和登场位置，空中敌人通过统一飞行模型形成可读的接近、攻击和脱离节奏。

## Requirements

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

### Requirement: Configured air-combat behavior

空中敌人 profile MUST 定义共享飞行模型所需的速度、加速度、转向响应、攻击速度、攻击窗口、脱离距离、重新切入距离、目标提前量和受损逃逸阈值。导演 MUST 根据 profile 选择追击、拦截、护航、俯冲、横穿或 standoff 行为。

#### Scenario: Air enemy attack cycle

- **WHEN** 空中敌人进入攻击距离和攻击角
- **THEN** 敌人按照 profile 进入 attacking，完成攻击窗口后进入 breaking，拉开距离后重新进入巡航或攻击

#### Scenario: High-speed interceptor

- **WHEN** 截击机或俯冲机进入攻击阶段
- **THEN** 其攻击速度高于巡航速度，并在攻击结束后保持脱离航向，不直接黏在玩家尾部

#### Scenario: Low-speed bomber

- **WHEN** 轰炸机执行路线攻击
- **THEN** 轰炸机沿横穿或 standoff 目标点移动，不使用普通追猎机的直接尾随逻辑

#### Scenario: Tail hunter wave

- **WHEN** 导演生成包含普通追猎机的空中波次
- **THEN** 至少一个追猎机从玩家后方或侧后方的安全屏外位置进入，并保留可读的尾后接近路线
- **AND** 同一波的其他单位使用侧向、截击或支援职责，避免所有单位沿同一条正面航线接近

#### Scenario: Spawn remains safe for rear entry

- **WHEN** 后方或侧后方候选点位于当前视野、越过边界或与现存空中单位过近
- **THEN** 导演拒绝该点并在请求有效期内尝试其他安全入口

### Requirement: Shared flight simulation

导演和 NPC 控制器 MUST 只产生空中控制意图。空中敌人的位置、速度、滚转和航向 MUST 由与玩家相同的飞行积分器推进，导演不得通过每帧重写速度上限绕过飞行模型。

#### Scenario: Enemy uses throttle control

- **WHEN** 敌人需要加速追击或脱离
- **THEN** NPC 改变油门或加力意图，由共享飞行模型产生速度变化

### Requirement: Director and pilot boundary

导演 MUST 只负责空中单位的刷新时机、角色、编组、入口位置和预算。单位生成后，NPC 飞行员 MUST 根据自身角色和实时相对几何持续产生控制意图，导演不得替代每个固定步的追击、射击、脱离或重新切入决策。

#### Scenario: Spawned aircraft owns its behavior

- **WHEN** 导演完成一架空中单位的安全生成
- **THEN** 该单位由自身飞行员策略决定目标点、速度、加力和开火意图，直到离场或被击毁

#### Scenario: Director does not overwrite a maneuver

- **WHEN** 空中 NPC 正在执行尾追、交会、脱离或护航动作
- **THEN** 导演只更新遭遇生命周期和预算，不直接改写 NPC 的位置、速度、航向或当前动作

### Requirement: Separation and formation safety

空中敌人 MUST 在接近同层邻机时使用分离运动。路线车队 MUST 根据前车间隔限制前进。分离运动不得让攻击状态长期失效。

#### Scenario: Air separation

- **WHEN** 两架空中敌人接近到分离半径以内
- **THEN** 分离方向参与运动意图，实体保持可读间隔并继续完成各自攻击状态

### Requirement: Encounter pressure adaptation

导演 MUST 按战斗时间调整敌人组合和波次规模，并在玩家生命偏低时减少普通空中波次请求数。

#### Scenario: Low health pressure

- **WHEN** 玩家生命低于定义阈值
- **THEN** 普通空中波次减少到一个生成请求，并继续受同一预算约束

