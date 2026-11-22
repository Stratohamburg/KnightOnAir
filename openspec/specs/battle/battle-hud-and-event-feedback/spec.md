# battle/battle-hud-and-event-feedback Specification

## Purpose

定义局内 HUD、战斗事件、威胁状态和命中反馈如何把模拟状态转换为可读信息。视觉反馈以局部命中特效、烟雾、火花、碎屑、音效和状态提示为主，不依赖显眼的机体受击闪白。

## Requirements

### Requirement: Player status HUD

HUD MUST 展示生命、加力储备、XP、等级、时间、分数、战斗阶段和可用升级次数，并与世界状态同步。

#### Scenario: Health changes

- **WHEN** 玩家受到伤害或获得修理
- **THEN** 生命数值和进度条在下一次 HUD 更新中反映新的状态

#### Scenario: Upgrade count

- **WHEN** 玩家获得或消费升级次数
- **THEN** 升级按钮状态和数量标记同步变化

### Requirement: Threat awareness

HUD MUST 通过雷达、边缘指示、攻击状态和开火告警表达屏幕外威胁，不依赖持续瞄准线。

#### Scenario: Off-screen attacker

- **WHEN** 空中敌人位于屏幕外且距离在边缘提示范围内
- **THEN** 雷达和边缘提示显示其相对方位，并按威胁优先级选择有限数量的提示

#### Scenario: Enemy attack state

- **WHEN** 空中敌人进入 attacking 或 breaking
- **THEN** HUD 显示与状态匹配的威胁提示，状态结束后清除或更新该提示

#### Scenario: Enemy fire event

- **WHEN** 世界产生敌人开火、地面攻击或导弹锁定预警事件
- **THEN** HUD 显示短促的战斗告警

### Requirement: Combat event consumption

HUD 和音频系统 MUST 通过公开战斗事件消费击毁、部件损伤、部件禁用、命中、拾取和告警，不直接修改模拟状态。

#### Scenario: Enemy hit

- **WHEN** 世界发出敌人命中事件
- **THEN** 场景播放与伤害类型匹配的局部命中特效和音频确认，HUD 不显示整机闪白

#### Scenario: Part disabled

- **WHEN** 世界发出部件禁用事件
- **THEN** HUD 显示对应部件损坏提示，音频播放短促的部件状态变化提示，且不会重复消费同一事件

#### Scenario: Enemy destroyed

- **WHEN** 世界发出敌人击毁事件
- **THEN** HUD 显示目标类型和分数，场景播放强于普通命中的爆炸、烟雾和碎屑反馈，反馈列表只保留最近三项

### Requirement: Impact feedback readability

战斗反馈 MUST 让玩家在移动端视口中分辨开火来源、命中位置、伤害强度和部件损坏阶段。命中烟雾 MUST 在命中位置停留一小段时间并逐渐消失。

#### Scenario: Repeated machine-gun hits

- **WHEN** 同一目标连续受到机枪命中
- **THEN** 命中火花和短烟按节奏出现，音效使用合并或节流处理，不遮挡目标轮廓

#### Scenario: Heavy impact

- **WHEN** 目标受到机炮、火箭或导弹的高伤害命中
- **THEN** 命中特效增加碎屑、冲击环、火焰或更长的烟雾持续时间

### Requirement: Action availability feedback

HUD MUST 显示升级可用次数，以及投弹的准备、装填和可投放状态。

#### Scenario: Bomb reload indicator

- **WHEN** 玩家在轰炸模式中等待炸弹装填
- **THEN** 投弹按钮显示装填剩余时间和进度

### Requirement: Combat cues through cloud cover

战斗 HUD MUST 保留雷达和符合条件的屏幕边缘提示。世界名牌的可见度随云遮挡变化，命中和命中烟雾的世界位置继续由模拟事件提供。

#### Scenario: Cloud covers an enemy

- **WHEN** 云遮挡敌机与相机之间的视线
- **THEN** 敌机名牌淡出，雷达仍报告该接触目标，命中事件仍在世界坐标生成反馈

