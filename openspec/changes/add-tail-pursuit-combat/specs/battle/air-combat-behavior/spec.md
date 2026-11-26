# Spec Delta

## MODIFIED Requirements

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

### Requirement: Predictive pursuit and attack geometry

追击和拦截行为 MUST 使用目标短时预测位置。普通追猎机 MUST 支持玩家前方或侧前方切入，也 MUST 支持从同向后方接近并在尾后距离带内保持有效攻击几何。攻击目标点 MUST 与开火提前量使用同一目标预测语义。

#### Scenario: Hunter enters from the side

- **WHEN** 追猎机距离玩家达到切入条件
- **THEN** 它选择玩家速度方向上的提前点，并带有一侧横向偏移，形成侧前方进入路线

#### Scenario: Interceptor passes the target

- **WHEN** 截击机以高于玩家的速度完成攻击窗口
- **THEN** 它继续沿脱离方向飞行并超过玩家，不在同一帧直接掉头追尾

#### Scenario: Hunter approaches from behind

- **WHEN** 追猎机从玩家后方或侧后方进入，且玩家保持同向巡航
- **THEN** 它选择玩家速度方向后的尾后目标点，逐步缩短距离并保持在 profile 定义的尾后距离带内

#### Scenario: Hunter briefly holds the tail

- **WHEN** 追猎机从同向后方接近以同代常用巡航速度直飞的玩家
- **THEN** 它可凭相对速度进入并短暂保持尾后有效射击窗口，窗口结束后主动脱离
- **AND** 玩家通过持续转弯或加力可以逐步破坏当前射击机会

#### Scenario: Hunter loses the tail

- **WHEN** 玩家持续转弯使追猎机超过 profile 定义的失位角度或距离阈值
- **THEN** 追猎机进入 breaking，沿横向脱离航向拉开距离，不在同一帧重新指向玩家当前位置
- **AND** 追猎机达到脱离距离后从预测位置重新切入

### Requirement: Role-based flight envelopes

空中敌人的速度、加速度、转向响应、最大 bank、攻击速度和脱离距离 MUST 由角色数据配置。普通追猎机 MUST 具备建立尾后关系所需的接近速度和转向响应，截击机和俯冲攻击机 MUST 保留高速攻击后超越目标的差异。

#### Scenario: Agile slow aircraft

- **WHEN** 侦察机或轻型格斗机进入近距离空战
- **THEN** 其速度处于中低区间，转向响应和持续转弯能力高于追猎机或截击机

#### Scenario: Tail hunter envelope

- **WHEN** 普通追猎机进入尾后保持阶段
- **THEN** 它能够在玩家常用巡航速度附近匹配速度，并在玩家未持续规避时保持尾后距离

#### Scenario: High-speed boom-and-zoom aircraft

- **WHEN** 截击机或俯冲攻击机进入攻击阶段
- **THEN** 其攻击速度高于自身巡航速度，转弯半径大于普通追猎机，攻击结束后继续掠过并拉开距离

#### Scenario: Slow attack aircraft

- **WHEN** 轰炸机执行横穿或区域攻击
- **THEN** 其速度和转向保持在低区间，航线优先于追逐玩家当前位置
