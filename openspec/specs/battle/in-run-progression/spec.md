# battle/in-run-progression Specification

## Purpose

定义一局战斗内部的成长和奖励循环，让击毁、轰炸、拾取物和战斗时间持续推动 XP、分数、金币和升级机会。

## Requirements

### Requirement: In-run rewards

战斗 MUST 为敌人击毁、地面目标、金币和修理包提供确定性的局内奖励，并受场上容量和战斗阶段约束。

#### Scenario: Enemy reward

- **WHEN** 玩家击毁一个有效敌人
- **THEN** 世界增加对应 XP 和分数，按奖励配置和场上容量投放金币，并产生击毁事件

#### Scenario: Pickup capacity

- **WHEN** 场上拾取物已经达到容量上限
- **THEN** 新的补给不会无限累积，系统维持定义的场上上限

### Requirement: Experience and level progression

系统 MUST 根据 XP 曲线增加等级并保留超出当前等级阈值的 XP。

#### Scenario: XP overflow

- **WHEN** 一次奖励跨越多个等级阈值
- **THEN** 系统连续增加等级、增加升级次数并保留剩余 XP

### Requirement: Upgrade availability

等级提升产生的升级次数 MUST 可以累积，并且升级次数只能由合法的升级选择消费。

#### Scenario: Preserve pending upgrades

- **WHEN** 玩家获得升级次数但暂时不打开升级界面
- **THEN** 升级次数保持可用，战斗继续运行

#### Scenario: Consume one choice

- **WHEN** 玩家确认一个合法升级选项
- **THEN** 升级次数减少一次并应用对应的局内改装

### Requirement: Run result aggregation

一局结束时，系统 MUST 提供分数、金币、最终等级、击毁数、时间和构型摘要供结算读取。

#### Scenario: Complete sortie result

- **WHEN** 玩家返航或飞机坠毁进入结算
- **THEN** 结算显示本局统计
