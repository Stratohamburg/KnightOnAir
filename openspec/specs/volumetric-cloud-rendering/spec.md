# volumetric-cloud-rendering Specification

## Purpose

为移动端飞行场景提供具有层次、遮挡关系和云内空间感的风格化云层表现，同时保持玩家操作信息和现有战斗可读性。

## Requirements

### Requirement: Layered cloud appearance

云场 MUST 在世界坐标中呈现具有连续密度变化的云壁、云脊和远景云带，并保留顶部受光、侧面明暗和偏冷云底形成的体积层次。

#### Scenario: Near cloud presents volume

- **WHEN** 相机接近近景云壁
- **THEN** 云顶、侧面和云底的明暗随观察位置变化，云边缘呈现自然的密度过渡

#### Scenario: Far cloud preserves depth cue

- **WHEN** 相机远离近景云壁
- **THEN** 近景细节平滑减弱，远景云带保留可辨识的轮廓和明暗

#### Scenario: River opening separates the banks

- **WHEN** 玩家从翡翠海岸的河道入口飞向两侧云壁之间
- **THEN** 河道上方保留可辨识的开口，两侧云壁仍具连续的体积感

### Requirement: Tiered cloud rendering

省电、标准和高画质 MUST 使用同一连续云场，并按档位应用有界的云缓冲分辨率、视线采样和细节预算。

#### Scenario: Quality changes cloud budget

- **WHEN** 玩家切换省电、标准或高画质
- **THEN** 云缓冲每轴分辨率分别为世界缓冲的 40%、50% 和 65%，视线采样上限分别为 12、18 和 24 步，云形布局与遮挡语义保持一致

### Requirement: Surface cloud shadows

云场 MUST 在地表和水面呈现与云覆盖和漂移一致的软影。

#### Scenario: Cloud shadow moves with coverage

- **WHEN** 云层覆盖经过可见地表或水面
- **THEN** 软影随云形推进，地表与水面各自保留原有几何高度

### Requirement: World occlusion and player overlay

云层 MUST 参与世界物体的视觉遮挡，并且 MUST 保持玩家飞机、玩家弹道、锁定环、准心和投弹路径的可见性。

#### Scenario: Cloud covers world object

- **WHEN** 云层位于相机与地面单位或敌机之间
- **THEN** 对应世界物体被云的密度和深度关系遮挡，雷达和边缘提示继续工作

#### Scenario: Player remains readable

- **WHEN** 玩家飞机进入云层或位于云层之后
- **THEN** 玩家飞机、玩家弹道和关键瞄准信息仍然清晰可见

### Requirement: Cloud interior response

云内雾化 MUST 来自穿过云场时的透射率变化，碰撞、锁定和命中继续依据模拟规则判定。

#### Scenario: Entering cloud increases veil

- **WHEN** 相机从云层外部移动到云层内部
- **THEN** 周围场景的透射率随视线穿过的云密度平滑下降

#### Scenario: Leaving cloud removes veil

- **WHEN** 相机离开云层密度范围
- **THEN** 内部雾化平滑减弱，世界颜色和玩家覆盖层恢复到云外状态

### Requirement: Player cloud interaction

近景云场 MUST 使用玩家的世界位置和水平速度产生局部、连续的体积交互。玩家机体周围 MUST 形成带垂直范围的低密度空腔，机体后方 MUST 形成沿玩家速度方向延伸的柔和尾流。交互 MUST 作用于当前风漂移后的同一密度场，并且不得改变云墙的全局噪声坐标或生成独立的随机位移。

#### Scenario: Player displaces nearby cloud

- **WHEN** 玩家进入近景云体
- **THEN** 玩家周围的云密度平滑降低，空腔边缘向外推开并随玩家高度衰减，远处云体保持连续

#### Scenario: Player leaves a directional wake

- **WHEN** 玩家以非零水平速度穿过云体
- **THEN** 玩家后方出现沿速度方向的低密度尾流，尾流宽度和强度随玩家速度平滑变化，停止或暂停时不产生新的随机扰动

### Requirement: Autonomous cloud morphing

云场 MUST 在没有风或风速很低时继续进行低频、确定性的内部形变。内部形变 MUST 通过连续空间噪声改变云瓣覆盖、边缘侵蚀和局部密度，形成缓慢的鼓起、收缩、融合和边缘呼吸。云瓣的垂直高度相位 MUST 保留体积起伏。内部形变 MUST 使用场景时钟，并且 MUST 与云的水平风向平移分开控制。

#### Scenario: Calm cloud keeps breathing

- **WHEN** 模拟风速接近零且世界时钟继续运行
- **THEN** 相邻云瓣可分别鼓起和收缩，边缘密度与高度缓慢变化，云场的水平位移在零风速下保持固定

#### Scenario: Wind accelerates cloud morphing

- **WHEN** 风速或阵风增加
- **THEN** 云的内部形变频率和幅度平滑增加，云的整体推进方向仍与风向一致

#### Scenario: Same seed keeps morphing deterministic

- **WHEN** 使用相同种子、相同世界坐标和相同场景时间创建云场
- **THEN** 覆盖、边缘侵蚀、垂直形变和自阴影结果一致

#### Scenario: Pause freezes autonomous morphing

- **WHEN** 世界时钟暂停
- **THEN** 云的自发形变相位、风向平移距离、内部雾化和云影保持当前值，恢复后从该状态继续

### Requirement: Deterministic cloud motion

云场布局 MUST 由种子与世界坐标确定，云的流动 MUST 随模拟风向、风速和阵风变化，并以场景时钟推进。

#### Scenario: Same seed reproduces field

- **WHEN** 使用相同种子在相同世界坐标采样初始云场
- **THEN** 云层高度、覆盖和受光结果一致

#### Scenario: Clouds respond to wind

- **WHEN** 模拟风向、风速或阵风发生变化
- **THEN** 云形推进使用对应的风向与强度，云影和遮挡判断跟随同一流动状态

#### Scenario: Turning wind preserves accumulated displacement

- **WHEN** 云场已随风移动一段距离，随后风向转为正交或反向
- **THEN** 下一步位移从当前世界位置沿新的风速向量推进，已经累积的位移保持原值

#### Scenario: No wind source keeps cloud drift stationary

- **WHEN** 渲染没有接入风场的预览，或者采样点的风速向量为零
- **THEN** 云场保持当前的水平位移，局部形变继续随场景时钟推进

#### Scenario: Pause freezes cloud animation

- **WHEN** 世界时钟暂停
- **THEN** 云的漂移距离与动画相位保持当前值，恢复后从该状态继续
