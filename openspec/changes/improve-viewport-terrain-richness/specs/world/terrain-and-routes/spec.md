# Spec Delta

## ADDED Requirements

### Requirement: Viewport relief hierarchy

地形采样 MUST 在可流式地形范围内提供连续的山脉、丘陵、山谷和低地高度层级，并保持相邻世界坐标之间的高度连续。

#### Scenario: Relief appears within the active terrain

- **WHEN** 使用固定种子采样玩家周围的活动地形范围
- **THEN** 采样结果包含可辨认的高地、坡面和低地变化，且不依赖视口外的地形对象

#### Scenario: Relief remains continuous across chunks

- **WHEN** 在相邻地形块的共同边界重复采样高度和法线
- **THEN** 两个地形块返回一致的高度和连续的坡面方向

### Requirement: Deterministic elevation bands

系统 MUST 根据最终地表高度和地貌状态提供确定性的海拔分层或连续权重，供材质、植被和地面景物使用。

#### Scenario: Elevation classification repeats

- **WHEN** 使用相同种子和世界坐标重复查询海拔分层
- **THEN** 分层或权重完全一致，且不受玩家位置、画质档位和渲染时间影响

#### Scenario: Water and shore keep precedence

- **WHEN** 查询低于水面的河床、浅滩或水岸坐标
- **THEN** 水面和岸线状态优先于海拔分层，最终地表高度仍遵循统一水位规则

### Requirement: Structured relief and drainage

地形采样 MUST 由可复现的山脉、脊线、峰顶、鞍部、谷地和层级排水结构共同表达宏观地貌。低频噪波可以补充自然偏移，但不能单独决定主要山脉和谷网关系。

#### Scenario: Ridge and valley relationship

- **WHEN** 在固定种子下采样包含高地、脊线和谷地的活动范围
- **THEN** 结果显示连续的山脊走向、谷地低线和坡面过渡，谷地与河道共享确定性空间关系

#### Scenario: Drainage hierarchy remains repeatable

- **WHEN** 重复生成同一活动范围的主谷、支谷和沟壑
- **THEN** 排水等级、谷线位置、汇流区域和相关权重保持一致，并跨地形块连续

### Requirement: Bounded terrain derivation

地形派生数据 MUST 在地形块生成或缓存阶段以有界成本计算，并为坡度、曲率、流量、沉积和侵蚀权重提供稳定查询。运行时每帧不得依赖持续变化的侵蚀状态修改基础地表高度。

#### Scenario: Cached erosion data

- **WHEN** 系统创建或复用一个固定种子的地形块
- **THEN** 热侵蚀和有限液压侵蚀的派生结果在有界时间内生成或读取缓存，后续高度查询保持确定性

#### Scenario: Surface queries stay stable during flight

- **WHEN** 飞行、暂停、恢复、轰炸落点和地面路线同时查询同一位置
- **THEN** 基础高度、法线和路线高程不会因为运行时侵蚀迭代发生变化
