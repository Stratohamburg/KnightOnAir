# battle/aircraft-damage Delta

## MODIFIED Requirements

### Requirement: Shared aircraft damage model

玩家与空中敌人 MUST 使用同一套整机生命和部件状态处理。整机生命是击毁判断的权威来源，部件生命记录局部损坏和能力退化，部件状态不得单独阻断整机受击。

#### Scenario: Aircraft envelope hit

- **WHEN** 扫掠投射物穿过飞机的整机碰撞体
- **THEN** 飞机承受完整的结算伤害，上限为剩余整机生命。命中位置能匹配部件分区时，记录对应部件

#### Scenario: Entity destruction

- **WHEN** 整机剩余生命归零
- **THEN** 实体进入对应的毁坏、坠毁或死亡流程

#### Scenario: Disabled body segment

- **WHEN** 机身部件生命归零但整机仍有生命
- **THEN** 机身进入禁用状态并继续作为视觉和能力状态存在，整机仍可被后续投射物命中

### Requirement: Part attribution is separate from collision truth

整机碰撞体 MUST 覆盖飞机的可见轮廓。部件碰撞体 MUST 只负责命中归因和局部损坏。禁用但仍附着的部件 MUST 保留其外形覆盖和命中归因，已脱落区域 MUST 随当前构型更新。

#### Scenario: Hit disabled right wing

- **WHEN** 右机翼已经禁用，后续投射物再次穿过右机翼区域
- **THEN** 投射物仍然扣除整机生命，并将损伤分配给其他可用部件

#### Scenario: No exact part hit

- **WHEN** 投射物命中整机碰撞体但没有命中明确部件
- **THEN** 系统将伤害平均分配给剩余可用部件，并保留整机命中事件

#### Scenario: Large aircraft wing coverage

- **WHEN** 大翼展飞机被侧面或斜向扫过
- **THEN** 翼根、翼中段和翼尖的多个局部碰撞区域共同覆盖可见机翼

#### Scenario: Detached wing tip

- **WHEN** 可脱落翼尖离开机体，后续弹道只经过翼尖原有的空域
- **THEN** 弹道不会命中母机，其余可见轮廓仍参与命中判定

### Requirement: Full damage and overflow distribution

单次有效伤害 MUST 优先扣除命中部件可承受的量，再将余量等额分配给仍有生命的部件。命中禁用部件或没有明确归因时，全部伤害进入等额分配。任一部件吃不下其份额时，余量继续等额分配，直到用完伤害或整机生命归零。

#### Scenario: Damage exceeds part health

- **WHEN** 投射物伤害高于命中部件当前生命
- **THEN** 部件生命降至零，剩余伤害继续分配给其他可用部件，过量伤害不会丢失

#### Scenario: Repeated hit on disabled part

- **WHEN** 投射物连续命中已禁用的右机翼
- **THEN** 右机翼保持禁用状态，整机生命继续下降，其他可用部件平均承受局部损伤

#### Scenario: Area damage without a precise hit point

- **WHEN** 爆炸、持续区域或接触伤害只提供一个世界坐标
- **THEN** 各来源按自身的范围或触发条件对目标结算一次。存在明确部件归因时优先损伤该部件，其他情况按同一等额分配规则处理

### Requirement: Health consistency

整机当前生命 MUST 等于所有部件剩余生命之和。一次结算 MUST 通过同一分配结果更新部件、整机读数和损伤事件。整机击毁事件在总生命首次归零时发出一次。

#### Scenario: Repeated mixed damage

- **WHEN** 同一实体连续受到机枪、爆炸和持续区域伤害
- **THEN** 整机生命等于分配后的剩余总量，部件状态、能力退化和击毁时机保持确定
