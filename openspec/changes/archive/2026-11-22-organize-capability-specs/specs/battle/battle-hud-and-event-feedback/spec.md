# Spec Delta

## Purpose

定义局内 HUD 和战斗反馈如何展示玩家状态、敌人威胁、锁定、击毁、部件损伤和可用动作，让模拟事件转换为可读的战斗信息。

## ADDED Requirements

### Requirement: Player status HUD

HUD MUST 展示生命、加力储备、XP、等级、时间、分数、战斗阶段和可用升级次数，并与世界状态同步。

#### Scenario: Health changes

- **WHEN** 玩家受到伤害或获得修理
- **THEN** 生命数值和进度条在下一次 HUD 更新中反映新的状态

#### Scenario: Upgrade count

- **WHEN** 玩家获得或消费升级次数
- **THEN** 升级按钮状态和数量标记同步变化

### Requirement: Threat awareness

HUD MUST 通过雷达、边缘指示和开火告警表达屏幕外威胁，不依赖持续瞄准线。

#### Scenario: Off-screen attacker

- **WHEN** 空中敌人位于屏幕外且距离在边缘提示范围内
- **THEN** 雷达和边缘提示显示其相对方位，并按威胁优先级选择有限数量的提示

#### Scenario: Enemy fire event

- **WHEN** 世界产生敌人开火、地面攻击或导弹锁定预警事件
- **THEN** HUD 显示短促的战斗告警

### Requirement: Combat event consumption

HUD MUST 通过公开战斗事件消费击毁、部件损坏、拾取和告警，不直接修改模拟状态。

#### Scenario: Enemy destroyed

- **WHEN** 世界发出敌人击毁事件
- **THEN** HUD 显示目标类型和分数，反馈列表只保留最近三项

#### Scenario: Part disabled

- **WHEN** 世界发出部件禁用事件
- **THEN** HUD 显示对应部件损坏提示，且不会重复消费同一事件

### Requirement: Action availability feedback

HUD MUST 显示升级可用次数，以及投弹的准备、装填和可投放状态。

#### Scenario: Bomb reload indicator

- **WHEN** 玩家在轰炸模式中等待炸弹装填
- **THEN** 投弹按钮显示装填剩余时间和进度

### Requirement: Combat cues through cloud cover

战斗 HUD MUST 保留雷达和符合条件的屏幕边缘提示。世界名牌的可见度随云遮挡变化。

#### Scenario: Cloud covers an enemy

- **WHEN** 云遮挡敌机与相机之间的视线
- **THEN** 敌机名牌淡出，雷达仍报告该接触目标
