# Spec Delta

## MODIFIED Requirements

### Requirement: Pause freezes simulation

暂停和升级弹层期间，战斗时间、敌人、投射物、风场、拾取物、准心稳定度和冷却 MUST 停止推进。升级展示动画可以继续推进表现时间，但不能推进战斗模拟时间。

#### Scenario: Pause and resume

- **WHEN** 玩家暂停战斗并等待一段真实时间后恢复
- **THEN** 世界时间只增加恢复后的模拟时间，不产生追赶跳变

#### Scenario: Upgrade preview freezes combat

- **WHEN** 玩家打开升级面板或切换候选预览
- **THEN** 世界时间、敌人、投射物、风场、拾取物、准心稳定度和冷却保持不变，只有展示动画继续更新

#### Scenario: Upgrade preserves phase

- **WHEN** 玩家在轰炸阶段打开改装并完成一次选择
- **THEN** 世界恢复到轰炸阶段并保留升级前的战斗状态

## ADDED Requirements

### Requirement: Upgrade presentation phase

升级状态 MUST 记录进入升级前的战斗阶段，并在预览、支付、安装动画和退出过程中维持一致的阶段语义。

#### Scenario: Enter from cruise

- **WHEN** 玩家在普通空战阶段打开升级
- **THEN** 升级状态记录普通空战阶段，完成安装后恢复普通空战

#### Scenario: Enter from bombing

- **WHEN** 玩家在轰炸阶段打开升级
- **THEN** 升级状态记录轰炸阶段，完成安装后恢复轰炸阶段和准心上下文

#### Scenario: Installation animation completes

- **WHEN** 玩家确认支付并且安装动画完成
- **THEN** 升级状态退出，正式构型生效，战斗模拟从冻结点继续推进

#### Scenario: Payment rejected

- **WHEN** 玩家因金币不足或候选失效而无法确认
- **THEN** 升级状态继续保持，原战斗阶段和正式构型不变

#### Scenario: Resume without buying

- **WHEN** 玩家在确认前选择「返回战斗」
- **THEN** 模拟从冻结点恢复，保留本局金币、升级次数和候选顺序。玩家可以拾取金币后重新打开同一组候选

