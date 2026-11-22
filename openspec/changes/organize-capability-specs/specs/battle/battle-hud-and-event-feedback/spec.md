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

- **WHEN** 敌人位于屏幕外且距离在告警范围内
- **THEN** 雷达和边缘提示显示其相对方位，并按威胁优先级选择有限数量的提示

#### Scenario: Enemy fire event

- **WHEN** 世界产生敌人开火、地面攻击或导弹锁定预警事件
- **THEN** HUD 显示短促的方向或状态告警，并触发对应反馈

### Requirement: Combat event consumption

HUD MUST 通过公开战斗事件消费击毁、部件损坏、拾取和告警，不直接修改模拟状态。

#### Scenario: Enemy destroyed

- **WHEN** 世界发出敌人击毁事件
- **THEN** HUD 显示目标类型和奖励信息，并在生命周期结束后移除反馈

#### Scenario: Part disabled

- **WHEN** 世界发出部件禁用事件
- **THEN** HUD 显示对应部件损坏提示，且不会重复消费同一事件

### Requirement: Action availability feedback

轰炸、升级、暂停和技能按钮 MUST 反映当前可用、冷却、资源不足和损伤禁用状态。

#### Scenario: Bomb unavailable

- **WHEN** 玩家未达到稳定度或炸弹舱已损坏
- **THEN** 投弹按钮显示不可用原因并拒绝触发

### Requirement: Critical overlay readability

玩家飞机、玩家投射物、锁定环、准心和投弹路径 MUST 在云层、地面目标和普通世界物体之后保持可读。

#### Scenario: Cloud encounter

- **WHEN** 玩家进入云层或云位于玩家之后
- **THEN** 关键玩家覆盖信息继续显示，世界遮挡不会覆盖这些元素
