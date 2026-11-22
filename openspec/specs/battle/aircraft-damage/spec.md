# battle/aircraft-damage Specification

## Purpose

定义玩家和敌人共享的整机受击、部件归因、部件损坏、能力退化、维修和击毁行为。飞机使用整机碰撞体承受生命伤害，部件碰撞体只用于判断损坏位置和能力影响。

## Requirements

### Requirement: Shared aircraft damage model

玩家与空中敌人 MUST 使用同一套整机生命和部件状态处理。整机生命是击毁判断的权威来源，部件生命记录局部损坏和能力退化，部件状态不得单独阻断整机受击。

#### Scenario: Aircraft envelope hit

- **WHEN** 扫掠投射物穿过飞机的整机碰撞体
- **THEN** 飞机承受完整投射物伤害，并根据命中位置记录一个部件归因

#### Scenario: Entity destruction

- **WHEN** 整机剩余生命归零
- **THEN** 实体进入对应的毁坏、坠毁或死亡流程

#### Scenario: Disabled body segment

- **WHEN** 机身部件生命归零但整机仍有生命
- **THEN** 机身进入禁用状态并继续作为视觉和能力状态存在，整机仍可被后续投射物命中

### Requirement: Part attribution is separate from collision truth

整机碰撞体 MUST 覆盖飞机的可见轮廓。部件碰撞体 MUST 只负责命中归因和局部损坏。部件被禁用后，命中查询 MUST 允许投射物穿过该区域并继续以整机碰撞体命中，不能因为排除一个部件而让剩余生命失去命中路径。

#### Scenario: Hit disabled right wing

- **WHEN** 右机翼已经禁用，后续投射物再次穿过右机翼区域
- **THEN** 投射物仍然扣除整机生命，并将损伤分配给其他可用部件

#### Scenario: No exact part hit

- **WHEN** 投射物命中整机碰撞体但没有命中明确部件
- **THEN** 系统将伤害平均分配给剩余可用部件，并保留整机命中事件

#### Scenario: Large aircraft wing coverage

- **WHEN** 大翼展飞机被侧面或斜向扫过
- **THEN** 翼根、翼中段和翼尖的多个局部碰撞区域共同覆盖可见机翼

### Requirement: Full damage and overflow distribution

每次命中的完整伤害 MUST 先从整机生命扣除。命中部件承担局部损坏，部件无法承受的过量伤害 MUST 按确定性规则转移到剩余可用部件。命中已禁用部件时，完整伤害 MUST 直接分配给剩余可用部件。

#### Scenario: Damage exceeds part health

- **WHEN** 投射物伤害高于命中部件当前生命
- **THEN** 部件生命降至零，剩余伤害继续分配给其他可用部件，过量伤害不会丢失

#### Scenario: Repeated hit on disabled part

- **WHEN** 投射物连续命中已禁用的右机翼
- **THEN** 右机翼保持禁用状态，整机生命继续下降，其他可用部件平均承受局部损伤

#### Scenario: Area damage without a precise hit point

- **WHEN** 爆炸、持续区域或接触伤害只提供一个世界坐标
- **THEN** 系统通过整机碰撞体和最近局部位置得到部件归因，再按同一套整机伤害和部件分配规则处理

### Requirement: Health consistency

整机生命和部件生命 MUST 在一次伤害分配后保持一致。系统 MUST 选择一个权威生命来源，并通过同一套分配结果更新整机生命、部件生命、部件状态和损伤事件，不得使用互相独立的重复扣血路径。

#### Scenario: Repeated mixed damage

- **WHEN** 同一实体连续受到机枪、爆炸和持续区域伤害
- **THEN** 整机生命等于分配后的剩余总量，部件状态、能力退化和击毁时机保持确定

### Requirement: Capability degradation from parts

部件禁用 MUST 按部件角色影响飞行包线、推力、升力、武器、锁定或投弹能力。能力退化 MUST 通过共享 ControlDamage 作用于玩家和空中敌人。

#### Scenario: Engine disabled

- **WHEN** 一个发动机部件被禁用
- **THEN** 实体的推力或对应方向动力降低，并由共享飞行模型反映到加速度和极速

#### Scenario: Wing disabled

- **WHEN** 一侧机翼部件被禁用
- **THEN** 左右升力、滚转权限和转向权限产生可控的不对称变化，实体仍然保持可操作状态

#### Scenario: Weapon mount disabled

- **WHEN** 武器所属部件被禁用
- **THEN** 该挂点武器停止发射，其他有效挂点继续工作

### Requirement: Deterministic part states

部件 MUST 使用 intact、damaged、critical、disabled 和 destroyed 状态。部件状态转换、局部生命分配、整机生命和能力修正 MUST 在相同输入下保持确定性。

#### Scenario: Part reaches zero health

- **WHEN** 部件生命降至零
- **THEN** 部件进入 disabled，可脱落部件按配置进入 destroyed，并发出一次部件状态事件

#### Scenario: Repair preserves configuration

- **WHEN** 玩家拾取修理包
- **THEN** 修理额度按确定性优先级恢复部件生命，不能创建新部件，也不能恢复已经脱落的结构

### Requirement: Aircraft destruction feedback

整机击毁 MUST 触发与实体层级匹配的坠毁、爆炸、碎屑和奖励流程。部件禁用和整机击毁 MUST 使用不同的反馈强度。

#### Scenario: Aircraft destroyed

- **WHEN** 整机生命归零
- **THEN** 实体进入毁坏流程并生成爆炸、持续烟雾和具有方向差异的碎屑

