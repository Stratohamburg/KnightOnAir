# Spec Delta

## Purpose

定义模拟和渲染共同使用的确定性地表、地形法线、水面、道路河流遮罩和地面路线，保证地面战斗、轰炸和环境物体拥有一致的空间依据。

## ADDED Requirements

### Requirement: Deterministic terrain sampling

相同种子和世界坐标 MUST 产生相同的最终地表高度、法线、水面状态、道路遮罩和坡度。

#### Scenario: Repeat terrain sample

- **WHEN** 系统使用相同种子重复查询同一世界坐标
- **THEN** 所有地形采样结果完全一致

### Requirement: Final surface height

系统 MUST 提供统一的最终地表高度，供地面单位、植被、云影、炸弹和特效使用。

#### Scenario: Water surface

- **WHEN** 地形高度低于水面高度
- **THEN** 最终地表高度返回水面高度，并标记对应水面状态

#### Scenario: Bomb landing query

- **WHEN** 炸弹计算落点
- **THEN** 落点使用同一最终地表高度，不依赖渲染网格的局部状态

### Requirement: Routed surface movement

道路、铁路和水路 MUST 提供确定性的位置、方向和距离查询，路线单位按路线规则移动。

#### Scenario: Route position

- **WHEN** 系统按路线和距离查询地面单位位置
- **THEN** 返回的位置、方向和高度与该路线定义一致

#### Scenario: Route spacing

- **WHEN** 多个单位沿同一条路线移动
- **THEN** 单位保持定义的安全车距并沿路线前进

### Requirement: Terrain compatibility masks

地形采样 MUST 提供水面、道路、岸线和坡度等遮罩，供战斗单位和植被判断可放置区域。

#### Scenario: Blocked vegetation location

- **WHEN** 候选位置位于水面、道路或超过坡度阈值的区域
- **THEN** 依赖这些遮罩的植被系统拒绝该位置
