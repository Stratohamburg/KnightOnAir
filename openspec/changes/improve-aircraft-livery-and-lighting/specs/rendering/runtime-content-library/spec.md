# Spec Delta

## ADDED Requirements

### Requirement: Livery content IDs and validation

飞机涂装 MUST 通过稳定内容 ID和纯数据描述接入 3D 内容库，配置不得保存 Three.js 材质、纹理或运行时状态。未知涂装 ID、缺少必要颜色字段或无兼容默认映射时，配置校验 MUST 报告机型和缺失项。

#### Scenario: Valid livery resolves through the content library

- **WHEN** 机体配置引用已登记的涂装 ID
- **THEN** 机体工厂取得对应的主色、次色、饰边和图案参数，并在机库与战斗实例中复用同一套静态内容

#### Scenario: Invalid livery is reported before generation

- **WHEN** 机体配置引用未知涂装 ID且没有兼容默认映射
- **THEN** 配置校验报告包含机型 ID和涂装 ID，正式机体生成保持未完成状态并提供可读错误

### Requirement: Shared livery resources with isolated instance state

涂装的基础材质、几何和程序化图案参数 MUST 按内容 ID缓存并通过租约共享。损伤、发热、部件高亮、云内包裹、姿态相关状态 MUST 保存在实例材质或实例属性中，不得修改其他飞机的涂装表现。

#### Scenario: Same livery keeps independent damage state

- **WHEN** 两架飞机使用同一涂装并且其中一架受到损伤或高亮
- **THEN** 两架飞机共享静态涂装资源，但只有受影响的实例显示对应的损伤、发热或高亮状态

#### Scenario: Aircraft removal releases livery leases

- **WHEN** 机库切换机体、战斗结束或 NPC 离开场景
- **THEN** 该实例释放自身涂装材质和动态节点租约，仍在使用的同 ID涂装资源继续有效，重复进出场不会导致资源数量持续增长

### Requirement: Shared environment-lighting contract

飞机材质 MUST 能接收内容库外部提供的只读环境受光状态，包括太阳方向、时代色板、云影采样和云内包裹强度。环境受光状态的更新不得创建新的材质或纹理，并且玩家、敌人和 NPC 批处理 MUST 使用同一语义。

#### Scenario: Lighting updates without material churn

- **WHEN** 世界时间、云影位置或飞机所在位置变化
- **THEN** 现有飞机实例更新受光参数并保持涂装资源数量有界，不在每帧创建新的材质或纹理

#### Scenario: Batch preserves per-piece livery

- **WHEN** NPC 批处理合并多个带不同涂装分区的部件
- **THEN** 合并后的实例属性保留每个部件的涂装颜色和图案选择，同时共享环境受光参数
