# Spec Delta

## Purpose

定义玩家和敌人共享的部件命中、生命、禁用、能力退化和维修行为，让飞机损伤持续影响操控、武器、锁定和投弹。

## ADDED Requirements

### Requirement: Shared part damage model

玩家与各层敌人 MUST 使用统一的部件状态处理命中、生命和禁用，实体生命归零时进入对应的毁坏流程。

#### Scenario: Part hit

- **WHEN** 扫掠投射物命中一个有效部件
- **THEN** 该部件减少生命并产生对应的部件损伤结果

#### Scenario: Entity destruction

- **WHEN** 实体剩余生命归零
- **THEN** 对应实体进入毁坏或死亡流程

### Requirement: Damage degrades capabilities

部件禁用 MUST 按部件角色影响飞行包线、推力、升力、武器、锁定或投弹能力。

#### Scenario: Engine disabled

- **WHEN** 一个发动机部件被禁用
- **THEN** 实体的推力或对应方向操控能力降低

#### Scenario: Bomb bay disabled

- **WHEN** 炸弹舱部件被禁用
- **THEN** 玩家不能执行需要该挂点的投弹动作

### Requirement: Disabled parts remain deterministic

部件生命归零后状态 MUST 保持稳定，后续命中处理必须遵循定义的跳过或伤害转移规则。

#### Scenario: Repeated hit on disabled part

- **WHEN** 投射物再次穿过已禁用部件
- **THEN** 命中查询跳过禁用部件，并按路径处理后方可命中的有效部件

### Requirement: Repair follows repair policy

修理包和修理动作 MUST 按确定性优先级恢复部件生命，并保持最大生命和当前构型一致。

#### Scenario: Partial repair

- **WHEN** 玩家拾取小型修理包
- **THEN** 修理额度按固定优先级填充部件缺口，未修复部件保持原有状态

#### Scenario: Repair cannot rebuild structure

- **WHEN** 普通修理作用于已安装的部件
- **THEN** 修理只恢复允许的生命值，不凭空创建或删除构型部件
