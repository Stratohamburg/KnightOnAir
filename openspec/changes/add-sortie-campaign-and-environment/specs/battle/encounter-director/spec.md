# Encounter Director Delta

## ADDED Requirements

### Requirement: Required campaign encounters

战役导演 MUST 按当前关卡的阶段、触发条件和指定方向编排必需目标与支援敌群。必需目标 MUST 在相同种子和战斗条件下可复现，安全生成及数量上限继续生效。

#### Scenario: Reserve capacity for a required target
- **WHEN** 关卡编排的必需目标等待入场，附近有机会遭遇或支援敌群
- **THEN** 导演限制普通遭遇使用任务所需的容量，并在满足安全间隔和数量上限的候选位置安排入场
- **AND** 必需目标在等待期间保留待入场状态，普通生成请求的过期规则不使该任务失去可完成性

#### Scenario: Training target is placed before engagement
- **WHEN** 玩家进入预设固定靶或移动靶教学阶段
- **THEN** 已编排的靶标在安全预布置位置出现，当前阶段维持配置的低压力遭遇
- **AND** 第二个靶可按阶段顺序出现，导演仍遵守安全距离和实体上限

#### Scenario: Safe entrance for the next wave
- **WHEN** 第 06 关第一批敌机被清除
- **THEN** 第二批从编排的相对方向进入，等待安全放置时仍可在 HUD 提示入场方向
