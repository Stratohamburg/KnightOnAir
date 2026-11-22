# Spec Delta

## Purpose

为远景地面提供可感知的风吹麦浪效果，并让树木和高植被拥有与游戏风场同步的摆动表现，同时维持地形贴合、确定性布局和移动端渲染预算。

## ADDED Requirements

### Requirement: Distant grass wave

远景草地 MUST 以连续的地表波浪、色带变化和低成本植被轮廓表达风向与风力。草地表现 MUST 优先传达整体起伏，画面无需展示每颗草叶的独立运动。

#### Scenario: Grass reads as a wave

- **WHEN** 玩家从空中观察远处草地
- **THEN** 草地呈现沿风向传播的连续波浪和明暗起伏，远景不会依赖逐颗草叶来传达风动

#### Scenario: Grass avoids blocked surfaces

- **WHEN** 草地实例或波浪遮罩生成在水面、道路或陡坡位置
- **THEN** 对应区域不生成独立草簇，地形、水面和路线轮廓保持清晰

### Requirement: Wind-driven trees

树木和高植被 MUST 使用与现有风场时间、位置采样和阵风状态一致的摆动方向。树木根部 MUST 保持贴地，树冠摆幅 MUST 随高度增加。

#### Scenario: Tree crown bends with wind

- **WHEN** 风场方向或阵风强度发生变化
- **THEN** 树冠沿对应方向平滑摆动，树干底部和根部保持在地形表面

#### Scenario: Trees keep deterministic phase

- **WHEN** 相同种子和相同世界坐标重新生成一块地形
- **THEN** 树木的布局、初始相位、尺度和摆动刚度保持一致

### Requirement: Terrain attachment

风动草地和树木 MUST 使用最终地表高度与允许的地形法线范围进行放置。地形块移动或重建时，植被 MUST 继续贴合相同世界坐标的地形表面。

#### Scenario: Vegetation follows terrain height

- **WHEN** 植被生成在起伏地形或水岸附近
- **THEN** 根部和草地基准位于对应的最终地表高度，不出现明显悬空或埋入

#### Scenario: Chunk rebuild preserves placement

- **WHEN** 玩家移动导致周围地形块重新组织
- **THEN** 相同世界坐标的植被位置、颜色和动画相位保持连续

### Requirement: Quality and pause behavior

植被 MUST 根据画质档位调整波浪细节、独立草簇数量和树木动画复杂度。世界暂停时，草地和树木的动画时间 MUST 停止。

#### Scenario: Quality reduces vegetation cost

- **WHEN** 玩家切换到省电档
- **THEN** 远景草地保留整体波浪感，独立草簇数量、树木摆动细节或更新频率降低

#### Scenario: Pause freezes vegetation

- **WHEN** 世界时钟暂停
- **THEN** 草地波浪和树木摆动停留在当前相位，恢复后从该相位继续

### Requirement: Shared wind semantics

植被视觉风场 MUST 与飞机、弹道和烟雾使用同一套时间和阵风语义。植被动画 MUST 只影响渲染顶点或视觉色带，不改变飞行、碰撞、命中和路线模拟。

#### Scenario: Visual wind matches simulation wind

- **WHEN** 玩家处于稳定风或阵风区域
- **THEN** 草地波浪和树木摆动的主方向与风场采样方向一致

#### Scenario: Vegetation does not alter simulation

- **WHEN** 草地或树木持续播放风动动画
- **THEN** 飞机运动、敌人路线、弹道和命中结果保持原有模拟结果
