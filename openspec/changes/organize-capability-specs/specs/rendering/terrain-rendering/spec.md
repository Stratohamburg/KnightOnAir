# Spec Delta

## Purpose

定义确定性地表在三维场景中的分块、材质、水面、路线设施和远景表现，保证视觉地形与模拟地表保持空间一致。

## ADDED Requirements

### Requirement: Streaming terrain chunks

渲染器 MUST 根据玩家位置维护周围地形块，并在玩家跨越块边界时平滑重建或复用地形资源。

#### Scenario: Move across chunk boundary

- **WHEN** 玩家移动到相邻地形块
- **THEN** 周围地形继续覆盖可见区域，且相同世界坐标的地表没有明显跳变

### Requirement: Surface-attached rendering

地面网格、水面、道路设施、植被基准、云影和地面特效 MUST 使用同一最终地表高度和路线数据。

#### Scenario: Ground object attachment

- **WHEN** 地面单位或路线设施位于起伏地形
- **THEN** 物体根部贴合对应地表，不出现明显悬空或穿入

### Requirement: Surface material expression

渲染器 MUST 根据草地、道路、沙地、水面、岸线和岩石遮罩显示对应颜色、光照和雾化层次。

#### Scenario: Water and shore

- **WHEN** 视野包含河道和岸线
- **THEN** 水面、浅滩和陆地具有可辨识的颜色和边界

### Requirement: Route environment props

铁路、道路、桥面和路线设施 MUST 使用确定性布局，并与对应路线方向一致。

#### Scenario: Railway crossing water

- **WHEN** 铁路路线穿过水面
- **THEN** 渲染器显示与路线方向一致的桥面和铁路设施
