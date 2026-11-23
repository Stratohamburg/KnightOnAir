# 局内变形构筑增量规格

## ADDED Requirements

### Requirement: Fleet of mounts benefits from common rate cards

普通整机射速卡 MUST 以同一倍率提高机上每一个自动开火挂点的发射频率，包括原装和后续安装的挂点。

#### Scenario: Six firing stations benefit from one common card

- **WHEN** 一架重型机以合法的局内升级组出六个健康的独立炮位，并选取一张标明倍率 M 的普通射速卡
- **THEN** 在相同目标条件下，六个炮位各自的发射冷却间隔均变为原值除以 M，固定步进允许一个模拟步的时间误差，六个炮位仍从各自位置开火

#### Scenario: Add mounts before or after rate cards

- **WHEN** 玩家用相同合法卡组先加炮位后提速，或先提速后加炮位
- **THEN** 两种顺序的各炮位最终有效射速一致；多张普通射速卡的倍率逐张相乘，每张只结算一次

#### Scenario: Damaged or reloading weapons

- **WHEN** 玩家在有禁用枪位、待锁定武器或投弹舱的飞机上选取射速卡
- **THEN** 禁用枪位按原损伤状态停火，待锁定武器仍须完成锁定，投弹舱沿用单独的装填属性；卡面明确强化自动开火与适用炮位数

### Requirement: Quality and quantity have observable effects

每张强化卡 MUST 标注提质或提量，并为改装后的机体产生与实际收益一致、可从模型或动作辨认的视觉变化。

#### Scenario: Improve an existing part

- **WHEN** 玩家安装同座双联、整机伤害、发动机功率、持续加力或快速冷却卡
- **THEN** 卡面显示对应范围和本机前后值；双联显示原枪座上的两个发射点，整机伤害显示强化弹着，动力与冷却分别显示动力部件动作与加力消耗或恢复节奏

#### Scenario: Repeat an eligible quality card

- **WHEN** 玩家再次合法选取同一张提质卡
- **THEN** 改装后的机体能体现本层相对上层的差异，例如更密的射击节奏或更快的储备恢复，卡面数值与最终模拟构型一致

#### Scenario: Extend a single wing

- **WHEN** 机体安装左翼延长机枪段，并在允许重复时继续向同侧扩建
- **THEN** 每次只在左翼外端增加一节可见翼面和独立枪位，右翼端点保持原位；枪口、受击区域和损伤效果位于对应的新翼段

#### Scenario: Extend the rear fuselage

- **WHEN** 玩家选取左舷尾段侧射舱
- **THEN** 尾翼前出现新机身段、尾翼后移，侧窗炮口对左侧斜后方有效目标开火；再次合法选取右舷配套舱时，两侧枪位可独立工作

### Requirement: Fly a late-game assembled aircraft

玩家 MUST 能通过正式局内升级连续叠加结构牌与整机提质牌，并驾驶由此形成的非对称多炮位机体与敌机交战。

#### Scenario: A six-station asymmetric gunship in battle

- **WHEN** MASTODON 从原装左右翼主武器和机背炮塔起步，在一局中先后安装两节左外翼机枪段、一座左舷尾段侧射舱及普通整机射速卡
- **THEN** 正常空战镜头可辨两节外翼和加长尾舱，飞机能转向并与真实敌机交火；六个独立炮位在各自射界有目标时按改装后的节奏工作，外翼枪位被打坏后其他完好炮位继续作战
