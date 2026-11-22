# Spec Delta

## Purpose

为移动端飞行场景提供具有层次、遮挡关系和云内空间感的风格化云层表现，同时保持玩家操作信息和现有战斗可读性。

## ADDED Requirements

### Requirement: Layered cloud appearance

云场 MUST 根据云层高度、相机距离和当前画质显示具有不同密度与体积感的云簇。近景云簇 MUST 具备顶部受光、中间调、偏蓝云底和经过侵蚀的边缘轮廓。

#### Scenario: Near cloud presents volume

- **WHEN** 一朵近景云位于相机与地面之间
- **THEN** 画面能同时显示云顶、侧面转折和云底阴影，且轮廓不呈现矩形平面边界

#### Scenario: Far cloud preserves depth cue

- **WHEN** 云簇处于远景或低画质档
- **THEN** 云簇仍保留可识别的团块轮廓和层次色差，远景细节按画质降低

### Requirement: Tiered cloud rendering

云场 MUST 提供与现有画质档位对应的云簇数量、细节和体积采样预算。省电档 MUST 使用低成本云簇表现，标准档 MAY 对有限的近景云启用体积采样，高画质档 MUST 支持更多近景体积采样预算。

#### Scenario: Quality changes cloud budget

- **WHEN** 玩家切换省电、标准或高画质
- **THEN** 云簇数量和近景细节按对应预算变化，切换过程不重建共享几何资源

#### Scenario: High quality reaches configured count

- **WHEN** 当前画质配置要求 10 个云簇
- **THEN** 云场可以显示 10 个确定性云簇，数量不会被内部固定容量截断

### Requirement: World occlusion and player overlay

云层 MUST 参与世界物体的视觉遮挡，并且 MUST 保持玩家飞机、玩家弹道、锁定环、准心和投弹路径的可见性。

#### Scenario: Cloud covers world object

- **WHEN** 云层位于相机与地面单位或敌机之间
- **THEN** 对应世界物体被云的密度和深度关系遮挡，雷达和边缘提示继续工作

#### Scenario: Player remains readable

- **WHEN** 玩家飞机进入云层或位于云层之后
- **THEN** 玩家飞机、玩家弹道和关键瞄准信息仍然清晰可见

### Requirement: Cloud interior response

当相机进入云层密度范围时，云场 MUST 提供强度平滑变化的白蓝色内部雾化，并且内部雾化 MUST 不改变模拟层的碰撞、锁定和命中结果。

#### Scenario: Entering cloud increases veil

- **WHEN** 相机从云层外部移动到云层内部
- **THEN** 白蓝色雾化强度随局部云密度平滑增加，不出现瞬间整屏跳变

#### Scenario: Leaving cloud removes veil

- **WHEN** 相机离开云层密度范围
- **THEN** 内部雾化平滑减弱，世界颜色和玩家覆盖层恢复到云外状态

### Requirement: Deterministic cloud motion

云簇布局、环绕位置、漂移相位和密度种子 MUST 由种子与世界坐标确定。暂停战斗时云的动画时间 MUST 停止，恢复后从暂停位置继续。

#### Scenario: Same seed reproduces field

- **WHEN** 使用相同种子和相同玩家世界坐标创建云场
- **THEN** 云簇数量、层级、相对团块和初始漂移相位完全一致

#### Scenario: Pause freezes cloud animation

- **WHEN** 世界时钟暂停
- **THEN** 云簇位置、密度噪声时间和内部雾化强度保持当前状态
