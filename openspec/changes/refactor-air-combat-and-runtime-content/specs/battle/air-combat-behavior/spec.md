# battle/air-combat-behavior Delta

## MODIFIED Requirements

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
