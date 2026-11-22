# Spec Delta

## Purpose

定义数据驱动武器从挂点、目标选择、锁定、开火、投射物运动到命中的完整行为，并覆盖轰炸模式的稳定、包线、冷却和地面落点。

## ADDED Requirements

### Requirement: Mount-aware weapon behavior

武器 MUST 从有效挂点发射，并受挂点部件状态、目标层、射程、扇形和冷却约束。

#### Scenario: Disabled mount

- **WHEN** 武器所属部件被禁用
- **THEN** 该武器不能继续发射，其他有效挂点仍可按规则工作

#### Scenario: Target layer filtering

- **WHEN** 武器目标层不包含当前目标层
- **THEN** 武器不会对该目标产生命中或锁定

### Requirement: Locking and guided fire

具有锁定能力的武器 MUST 按目标角度、距离和锁定时间积累锁定，并在失去条件时按规则衰减。

#### Scenario: Lost lock decay

- **WHEN** 已锁定目标离开有效范围
- **THEN** 锁定进度按定义速率下降，并在再次满足条件时继续积累

#### Scenario: Guided projectile

- **WHEN** 锁定武器完成合法锁定并开火
- **THEN** 投射物记录目标并在生命周期内按制导规则追踪

### Requirement: Swept projectile collision

投射物 MUST 使用连续路径或等效扫掠检测处理高速运动，避免单帧穿透有效目标。

#### Scenario: Fast projectile crossing

- **WHEN** 投射物在一个模拟步内跨过敌人碰撞区域
- **THEN** 系统仍然检测到命中并应用部件伤害

### Requirement: Bombing envelope

轰炸 MUST 只允许稳定度、目标前向位置、投弹冷却、炸弹舱状态和目标层全部满足时执行。

#### Scenario: Invalid bomb aim

- **WHEN** 地面落点位于飞机后方或超出前向微调锥
- **THEN** 投弹按钮保持不可用且不会生成炸弹

#### Scenario: Stable bomb drop

- **WHEN** 玩家进入轰炸模式并达到稳定门槛、目标位于有效包线且冷却结束
- **THEN** 系统生成具有固定落点的炸弹并开始冷却

### Requirement: Terrain-aware bomb result

炸弹下落、落点、范围伤害和火焰区域 MUST 使用最终地表高度，并且落点在投放后保持不变。

#### Scenario: Fixed landing point

- **WHEN** 玩家投放炸弹后继续移动飞机
- **THEN** 炸弹仍然落向投放时锁定的地面位置
