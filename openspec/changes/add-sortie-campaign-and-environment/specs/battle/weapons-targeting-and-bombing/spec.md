# Weapons Targeting and Bombing Delta

## MODIFIED Requirements

### Requirement: Locking and guided fire

配置了锁定时间的制导武器 MUST 按有效挂点、目标层、挂点射界与距离积累锁定，失去条件时按配置衰减。合法发射 MUST 把目标身份交给弹体。玩家航向和飞行输入 MUST 全程由飞行控制处理。普通辅助瞄准只调整武器的初始发射方向。

#### Scenario: Lost lock decay

- **WHEN** 已锁定目标离开有效范围
- **THEN** 锁定进度按定义速率下降，并在再次满足条件时继续积累

#### Scenario: Guided projectile

- **WHEN** 锁定武器完成合法锁定并开火
- **THEN** 投射物记录目标并在生命周期内按制导规则追踪

#### Scenario: Maintain player steering while aiming a guided weapon

- **WHEN** 玩家用飞行输入使目标进入制导武器的射界
- **THEN** 武器积累锁定并在满足开火条件时发射，机体航向仍按玩家飞行输入推进
