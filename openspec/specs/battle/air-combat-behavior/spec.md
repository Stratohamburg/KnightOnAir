# battle/air-combat-behavior Specification

## Purpose

定义玩家与空中敌人共用的飞行控制模型，以及空中敌人的接近、攻击、脱离和重新切入节奏。空战使用二维战斗平面和三维姿态表现。实体的运动积分、加速度、速度限制、滚转、转向和损伤退化来自同一套模型，差异通过控制意图和数据配置表达。

## Requirements

### Requirement: Shared air control model

玩家、空中敌人和需要重放的空中实体 MUST 使用同一个空中运动积分器、同一套 AirMotionState 和同一种 ControllerIntent 输入。AI MUST 只产生目标航向、油门、加力、刹车和开火意图，不得直接写入敌人的位置、速度或航向。

#### Scenario: Enemy uses player flight control

- **WHEN** 空中敌人需要追击、拦截、护航或脱离
- **THEN** 敌人使用同一套规则解释其机体配置、控制意图和损伤状态，推进加速、巡航、滚转和转向

#### Scenario: AI changes throttle intent

- **WHEN** AI 从巡航阶段进入攻击或脱离阶段
- **THEN** AI 改变油门或加力意图，由共享飞行模型自然产生加速、减速和速度保持

#### Scenario: Damaged enemy flight

- **WHEN** 敌人的机翼、尾翼或发动机受到损伤
- **THEN** 同一套 ControlDamage 修正同时影响玩家和敌人的升力、推力、滚转响应、转向权限和稳定性

#### Scenario: Identical flight inputs

- **WHEN** 玩家、空中 NPC 和回放实体具有相同初始飞行状态、机体配置、损伤、风场和逐步控制意图
- **THEN** 三者在固定步进下得到一致的航向、滚转、位置、速度和加力储备

### Requirement: Air-combat state machine

空中敌人 MUST 使用可观察的有限状态机。状态至少包括 entering、cruising、attacking、breaking 和 fleeing。能进行机动空战的角色还 MUST 支持 defending。状态转换 MUST 由距离、相对速度、目标提前量、攻击角、攻击窗口和生命状态共同决定。

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

### Requirement: Pilot decision loop

空中 NPC MUST 根据相对距离、相对方位、闭合速度、目标航向差、横向偏差、能量状态、受损状态和武器解算结果选择短时飞行动作。NPC MUST 通过状态承诺和进入、离开阈值保持动作连续，不能每个固定步只把目标航向指向玩家预测位置。

#### Scenario: Pilot chooses an approach action

- **WHEN** 敌人尚未进入有效攻击几何，且目标处于可追踪范围
- **THEN** 飞行员根据角色选择尾后接近、交会切入、侧向穿越、护航锚定或路线攻击动作

#### Scenario: Pilot keeps an attack commitment

- **WHEN** 敌人进入有效攻击几何并开始攻击动作
- **THEN** 飞行员在动作承诺时间内保持目标点、速度策略和开火决策，除非目标失去、关键部件损坏或逃逸条件满足

#### Scenario: Pilot reacts to player maneuver

- **WHEN** 玩家改变航向或速度导致闭合速度、攻击角或能量优势发生变化
- **THEN** 飞行员根据新的相对几何选择继续追击、重新占位、脱离、超越或逃逸

### Requirement: Role-based flight envelopes

空中敌人的速度、加速度、转向响应、最大 bank、攻击速度和脱离距离 MUST 由角色数据配置。角色差异 MUST 同时体现在运动和攻击阶段，不能只通过生命或伤害数值表达。

#### Scenario: Agile slow aircraft

- **WHEN** 侦察机或轻型格斗机进入近距离空战
- **THEN** 其速度处于中低区间，转向响应和持续转弯能力高于追猎机或截击机

#### Scenario: High-speed boom-and-zoom aircraft

- **WHEN** 截击机或俯冲攻击机进入攻击阶段
- **THEN** 其攻击速度高于自身巡航速度，转弯半径大于同代轻型格斗机，攻击结束后继续掠过并拉开距离，向玩家暴露可读的反击窗口

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

#### Scenario: Hunter briefly holds the tail

- **WHEN** 追猎机从同向后方接近以同代常用巡航速度直飞的玩家
- **THEN** 它可凭相对速度进入并短暂保持尾后有效射击窗口，窗口结束后主动脱离
- **AND** 玩家通过转弯或加力可以破坏当前射击机会

#### Scenario: Hunter approaches from behind

- **WHEN** 追猎机从玩家后方或侧后方进入，且玩家保持同向巡航
- **THEN** 它选择玩家速度方向后的尾后目标点，逐步缩短距离并保持在 profile 定义的尾后距离带内

#### Scenario: Hunter loses the tail

- **WHEN** 玩家持续转弯使追猎机超过 profile 定义的失位角度或距离阈值
- **THEN** 追猎机进入 breaking，沿横向脱离航向拉开距离，不在同一帧重新指向玩家当前位置
- **AND** 追猎机达到脱离距离后从预测位置重新切入

### Requirement: Tail pursuit role

普通追猎机 MUST 通过后方接近、尾后保持和失位脱离形成连续的空间关系。尾后保持时间、距离带、失位角度和脱离偏移 MUST 由敌人 profile 配置，玩家的转弯或加力 MUST 能够逐步破坏这段关系。

#### Scenario: Tail pursuit creates pressure

- **WHEN** 玩家以同代常用巡航速度直线飞行，追猎机从同向后方接近
- **THEN** 追猎机在有效武器距离内保持尾后位置一段可读时间，并产生至少一次有效攻击窗口

#### Scenario: Hunter closes on normal throttle

- **WHEN** 追猎机从后方接近使用常用普通油门直飞的同代玩家机
- **THEN** 距离超出尾后距离带时，追猎机使用机体包线内的闭合速度接近，在射击距离内根据间隔收油或减速
- **AND** 固定种子验收使用实际出击机体记录间距和首轮开火

#### Scenario: Hunter follows a small correction

- **WHEN** 玩家轻微转向且追猎机仍可恢复尾后射击角
- **THEN** 追猎机继续修正航线，暂时丢失射界时停火，并在超出可恢复条件后脱离

#### Scenario: Tail pursuit becomes a counterattack window

- **WHEN** 玩家持续转向或加力，追猎机失去尾后角度并进入脱离
- **THEN** 追猎机沿横向或超越航线拉开距离，玩家能够在其重新切入前建立反向追击窗口

#### Scenario: Threatened fighter defends

- **WHEN** 玩家在可机动敌机的后半球用可用武器形成射击威胁
- **THEN** 敌机执行一段可读的规避转弯并调整油门，威胁持续时可以反向规避，拉开射界后重新寻找交锋位置

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

