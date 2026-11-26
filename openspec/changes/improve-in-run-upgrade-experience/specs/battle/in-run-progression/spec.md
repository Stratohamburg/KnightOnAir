# Spec Delta

## MODIFIED Requirements

### Requirement: Upgrade availability

等级提升产生的升级次数 MUST 可以累积，并且升级次数只能由确认成功的合法升级选择消费。

#### Scenario: Preserve pending upgrades

- **WHEN** 玩家获得升级次数但暂时不打开升级界面
- **THEN** 升级次数保持可用，战斗继续运行

#### Scenario: Select without consuming

- **WHEN** 玩家在升级界面选中候选但尚未确认
- **THEN** 升级次数保持不变，战斗保持暂停，展示预览可以继续播放

#### Scenario: Consume one confirmed choice

- **WHEN** 玩家确认一个合法且支付成功的升级选项
- **THEN** 升级次数减少一次并应用对应的局内改装

#### Scenario: Consume one choice

- **WHEN** 玩家确认一个合法升级选项
- **THEN** 升级次数减少一次并应用对应的局内改装

## ADDED Requirements

### Requirement: Upgrade price payment

每个局内升级 MUST 具有独立数值价格，价格从本局金币余额支付并在确认成功时一次性扣除。

#### Scenario: Affordable upgrade payment

- **WHEN** 玩家确认价格不高于本局金币余额的升级
- **THEN** 世界扣除对应金币并记录安装后的剩余余额

#### Scenario: Insufficient coins

- **WHEN** 玩家确认价格高于本局金币余额的升级
- **THEN** 世界拒绝支付和安装，金币、升级次数、正式构型和战斗阶段保持不变

#### Scenario: Coins remain run scoped

- **WHEN** 玩家在一局中支付升级价格后进入结算
- **THEN** 结算读取扣除后的本局金币，并由现有结算流程汇总剩余金币到局外存档

### Requirement: Upgrade progression remains deterministic

升级候选、支付和叠加结果 MUST 在相同出击种子、输入序列、金币余额和确认序列下保持一致。

#### Scenario: Same seed and purchase sequence

- **WHEN** 两次出击使用相同随机种子、相同升级确认顺序和相同金币余额
- **THEN** 两次出击产生相同候选顺序、支付结果、部件数量和最终构型统计

