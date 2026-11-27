# Spec Delta

## ADDED Requirements

### Requirement: Elevation-aware vegetation distribution

植被和地面装饰 MUST 根据最终地表高度、坡度、水岸状态和地貌权重选择类型、密度、尺度与颜色。

#### Scenario: Lowland vegetation

- **WHEN** 生成低地草甸、河谷或湿地范围的景物
- **THEN** 系统优先布置草簇、花甸植物、芦苇或低矮灌木，并避开水面、道路和不允许的坡度

#### Scenario: Highland vegetation

- **WHEN** 生成丘陵、高坡或裸岩范围的景物
- **THEN** 植被密度逐步降低，灌木和岩石比例增加，根部与接触面保持贴合地表

### Requirement: Viewport-focused scenic density

视口内的植物、岩石和房屋周边景物 MUST 使用确定性高密度布局，视口外的装饰数量 MUST 随距离和画质档位降低。

#### Scenario: Viewport receives priority detail

- **WHEN** 玩家处于标准或高画质并观察当前战斗视口
- **THEN** 近中景具有连续的植物群、花簇、灌木和岩石参照，远离视口的区域不占用同等装饰预算

#### Scenario: Quality reduces offscreen cost

- **WHEN** 玩家切换到省电档或景物离开当前视口
- **THEN** 系统减少独立景物数量和动画细节，同时保留地貌色块、主要植被轮廓和地面可读性

### Requirement: Ground wind separation

风动 MUST 主要作用于植物顶点、树冠和水面采样，地形基础颜色和地貌边界 MUST 保持空间锚定。

#### Scenario: Wind moves vegetation without ground waves

- **WHEN** 风向或阵风强度发生变化
- **THEN** 草簇、树冠和水面按共享风场变化，地面山脊、草甸和丘陵颜色不形成连续移动波纹
