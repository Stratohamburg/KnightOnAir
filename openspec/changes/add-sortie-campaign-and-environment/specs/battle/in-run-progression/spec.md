# In-Run Progression Delta

## MODIFIED Requirements

### Requirement: Run result aggregation

一局结束时，系统 MUST 提供分数、金币、最终等级、击毁数、时间和构型摘要供结算读取。战役 MUST 额外提供关卡身份、已完成阶段和唯一终局原因。

#### Scenario: Complete sortie result
- **WHEN** 玩家返航、飞机坠毁、战役胜利或任务失败进入结算
- **THEN** 结算显示本局统计
- **AND** 战役同时呈现任务结果，局内收益按已有规则结算
