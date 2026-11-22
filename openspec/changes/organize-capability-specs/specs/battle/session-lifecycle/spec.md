# Spec Delta

## Purpose

定义一局战斗从开始、巡航、轰炸、暂停、升级、死亡到结算的运行生命周期，保证模拟时间和玩家可见阶段保持一致。

## ADDED Requirements

### Requirement: Fixed-step battle progression

战斗模拟 MUST 使用稳定的固定步进，并且渲染帧率变化不能改变同一输入序列下的战斗结果。

#### Scenario: Different render rates

- **WHEN** 相同种子和输入分别以 30、60 和 120 帧渲染运行相同时间
- **THEN** 玩家位置、能量和世界时间保持在允许误差内一致

### Requirement: Battle phase transitions

战斗 MUST 支持普通战斗、轰炸、升级、暂停、死亡和结算阶段，并且每个阶段只能通过定义的动作进入或退出。

#### Scenario: Enter bombing mode

- **WHEN** 玩家在普通战斗中切换轰炸模式
- **THEN** 世界进入轰炸阶段并使用轰炸规则更新玩家和准心

#### Scenario: Death reaches result

- **WHEN** 玩家生命归零
- **THEN** 世界先进入死亡阶段，经过固定死亡时长后进入结算并停止战斗时间

### Requirement: Pause freezes simulation

暂停和升级弹层期间，战斗时间、敌人、投射物、风场、拾取物、准心稳定度和冷却 MUST 停止推进。

#### Scenario: Pause and resume

- **WHEN** 玩家暂停战斗并等待一段真实时间后恢复
- **THEN** 世界时间只增加恢复后的模拟时间，不产生追赶跳变

#### Scenario: Upgrade preserves phase

- **WHEN** 玩家在轰炸阶段打开升级并完成一次选择
- **THEN** 世界恢复到轰炸阶段并保留升级前的战斗状态

### Requirement: Result state is terminal for the run

进入结算后，世界 MUST 停止产生新的敌人、投射物、拾取物和伤害。

#### Scenario: Result does not continue combat

- **WHEN** 世界处于结算状态并持续调用帧更新
- **THEN** 战斗实体和世界时间保持不变
