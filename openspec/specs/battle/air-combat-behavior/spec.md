# battle/air-combat-behavior Specification

## Purpose

定义玩家与空中敌人共用的飞行控制模型，以及空中敌人的接近、攻击、脱离和重新切入节奏。空战使用二维战斗平面和三维姿态表现。实体的运动积分、加速度、速度限制、滚转、转向和损伤退化来自同一套模型，差异通过控制意图和数据配置表达。

## Requirements

### Requirement: Shared air control model

玩家、空中敌人和需要重放的空中实体 MUST 使用同一个空中运动积分器、同一套 AirMotionState 和同一种 ControllerIntent 输入。AI MUST 只产生目标航向、油门、加力、刹车和开火意图，不得直接写入敌人的位置、速度或航向。

#### Scenario: Enemy uses player flight control

- **WHEN** 空中敌人需要追击、拦截、护航或脱离
- **THEN** 敌人通过与玩家相同的加速度、极速、巡航速度、滚转响应、最大转向和损伤修正推进运动

#### Scenario: AI changes throttle intent

- **WHEN** AI 从巡航阶段进入攻击或脱离阶段
- **THEN** AI 改变油门或加力意图，由共享飞行模型自然产生加速、减速和速度保持

#### Scenario: Damaged enemy flight

- **WHEN** 敌人的机翼、尾翼或发动机受到损伤
- **THEN** 同一套 ControlDamage 修正同时影响玩家和敌人的升力、推力、滚转响应、转向权限和稳定性

### Requirement: Air-combat state machine

空中敌人 MUST 使用可观察的有限状态机。状态至少包括 entering、cruising、attacking、breaking 和 fleeing。状态转换 MUST 由距离、相对速度、目标提前量、攻击角、攻击窗口和生命状态共同决定。

#### Scenario: Enter attack window

- **WHEN** 敌人进入攻击距离并且预测目标位于可用攻击角
- **THEN** 敌人进入 attacking，使用攻击目标点和定义的攻击速度窗口

#### Scenario: Break after attack

- **WHEN** 攻击窗口结束、敌人超过目标或目标离开有效攻击角
- **THEN** 敌人进入 breaking，沿横向或预设脱离方向拉开距离，不立即重新指向玩家当前位置

#### Scenario: Re-enter combat

- **WHEN** 敌人在 breaking 中达到重新切入距离
- **THEN** 敌人进入 cruising 或 attacking，根据当前目标提前量重新建立攻击路线

#### Scenario: Flee after critical damage

- **WHEN** 敌人生命或关键机动部件低于 profile 定义的逃逸阈值
- **THEN** 敌人进入 fleeing，提高脱离油门并停止不必要的贴身追击

### Requirement: Role-based flight envelopes

空中敌人的速度、加速度、转向响应、最大 bank、攻击速度和脱离距离 MUST 由角色数据配置。角色差异 MUST 同时体现在运动和攻击阶段，不能只通过生命或伤害数值表达。

#### Scenario: Agile slow aircraft

- **WHEN** 侦察机或轻型格斗机进入近距离空战
- **THEN** 其速度处于中低区间，转向响应和持续转弯能力高于追猎机或截击机

#### Scenario: High-speed boom-and-zoom aircraft

- **WHEN** 截击机或俯冲攻击机进入攻击阶段
- **THEN** 其速度或加力高于巡航阶段，转向能力保持受限，并在攻击完成后执行可见的高速脱离

#### Scenario: Slow attack aircraft

- **WHEN** 轰炸机执行横穿或区域攻击
- **THEN** 其速度和转向保持在低区间，航线优先于追逐玩家当前位置

### Requirement: Predictive pursuit and attack geometry

追击和拦截行为 MUST 使用目标短时预测位置。普通追猎机 MUST 支持玩家前方或侧前方切入，不能持续追踪玩家当前位置形成无限尾随。攻击目标点 MUST 与开火提前量使用同一目标预测语义。

#### Scenario: Hunter enters from the side

- **WHEN** 追猎机距离玩家达到切入条件
- **THEN** 它选择玩家速度方向上的提前点，并带有一侧横向偏移，形成侧前方进入路线

#### Scenario: Interceptor passes the target

- **WHEN** 截击机以高于玩家的速度完成攻击窗口
- **THEN** 它继续沿脱离方向飞行并超过玩家，不在同一帧直接掉头追尾

### Requirement: Air separation

空中敌人 MUST 在共享飞行控制模型之前叠加分离目标，避免编队成员重叠。分离目标不得取消当前攻击阶段的速度和脱离意图。

#### Scenario: Close formation members

- **WHEN** 两个空中敌人进入分离半径
- **THEN** 分离方向参与目标航向计算，实体保持可读间隔并继续完成各自攻击状态

### Requirement: Combat behavior observability

敌人的当前状态、攻击窗口、脱离窗口和目标行为 MUST 能被战斗 HUD、遥测和测试读取。attacking 状态 MUST 反映实际攻击阶段，而不是只保留初始化状态。

#### Scenario: HUD reflects attacking enemy

- **WHEN** 敌人处于攻击窗口
- **THEN** HUD 将其标记为追击或攻击威胁，状态结束后及时清除

