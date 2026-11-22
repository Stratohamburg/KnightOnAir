# rendering/terrain-rendering Specification

## Purpose

定义确定性地表在三维场景中的分块、材质、水面、路线设施和远景表现，保证视觉地形与模拟地表保持空间一致。

## Requirements

### Requirement: Streaming terrain chunks

渲染器 MUST 根据玩家位置维护周围地形块，并在玩家跨越块边界时平滑重建或复用地形资源。

#### Scenario: Move across chunk boundary

- **WHEN** 玩家移动到相邻地形块
- **THEN** 周围地形继续覆盖可见区域，且相同世界坐标的地表没有明显跳变

### Requirement: Surface-attached rendering

陆地网格、水面和道路设施 MUST 依据地形与路线查询呈现河床、水位及路线高程。

#### Scenario: Ground object attachment

- **WHEN** 铁路或公路设施位于起伏地形
- **THEN** 设施沿对应路线高程布置，与周围地表连续衔接

### Requirement: Surface material expression

渲染器 MUST 根据草地、道路、沙地、水面、岸线和岩石遮罩显示对应颜色、光照和雾化层次。

#### Scenario: Water and shore

- **WHEN** 视野包含河道和岸线
- **THEN** 水面、浅滩和陆地具有可辨识的颜色和边界

### Requirement: Wind-coupled water surface

水面波纹 MUST 使用与飞机、云、草、树和烟雾相同的风场时间、方向、速度和阵风语义。水面波纹 MUST 只影响水面材质的视觉采样，不改变水位、河床查询、路线高程、碰撞或飞行模拟。

#### Scenario: Water follows wind direction

- **WHEN** 风场方向发生变化
- **THEN** 水面波纹的传播轴平滑转向相同的风向

#### Scenario: Wind speed changes ripple motion

- **WHEN** 稳定风或阵风的速度发生变化
- **THEN** 水面波纹相位速度平滑变化，水面仍保持原有水位和岸线边界

#### Scenario: Pause freezes water ripples

- **WHEN** 世界时钟暂停
- **THEN** 水面波纹停留在当前相位，恢复后从该相位继续

### Requirement: Route environment props

铁路、道路、桥面和路线设施 MUST 使用确定性布局，并与对应路线方向一致。

#### Scenario: Railway crossing water

- **WHEN** 铁路路线穿过水面
- **THEN** 渲染器显示与路线方向一致的桥面和铁路设施
