# Persistence and Meta Progression Delta

## ADDED Requirements

### Requirement: Campaign completion persistence

档案 MUST 按稳定战役关卡 ID 保存通关记录。首次胜利 MUST 解锁顺序中的下一关，已通关关卡 MUST 仍可重玩。重复结算同一出击 MUST 保持通关和解锁结果一致。

出击简报 MUST 显示所选战役关卡的历史最高积分。旧档缺少关卡积分时从零开始，原有全局最高积分继续用于自由巡航展示和机体解锁。

#### Scenario: First clear unlocks the next mission
- **WHEN** 玩家首次胜利完成一关并重新打开游戏
- **THEN** 已完成关卡可重玩，下一关已解锁，连续战役顺序中的更后关卡仍受前置胜利约束
- **AND** 战役最后一关完成后仍可重玩

#### Scenario: Failed, retreated or free patrol results
- **WHEN** 玩家没有取得战役胜利，包括任务失败、坠毁、主动返航或完成自由巡航
- **THEN** 战役关卡解锁状态保持原值，正常出击统计和机体解锁按既有规则结算

#### Scenario: Existing profile without campaign data
- **WHEN** 有效旧档案缺少战役字段
- **THEN** 该档案从第 01 关开始，恢复已有装备、已解锁机体、分数、货币、统计与设置
- **AND** 无效或未知的关卡记录被安全忽略，有效记录仍可读取
