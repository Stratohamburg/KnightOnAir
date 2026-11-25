# Spec Delta

## MODIFIED Requirements

### Requirement: Layered cloud appearance

云场 MUST 在整个可飞世界坐标中呈现无缝的三维立体云层结构，包括低空绵密云海、中/高空立体积云壁与云脊以及河道上方的可辨识开口，不再将三维体积层次限制在局部静态小区域。云层着色 MUST 通过实时方向光自阴影、多散射近似、粉末明暗与双瓣银边散射，呈现明亮受光云顶、通透柔和的偏冷云底与地表环境反弹光，并随当前时代大气色板联动。

#### Scenario: Near cloud presents volume

- **WHEN** 相机接近或飞越世界任意位置的云壁、云塔或低空云海
- **THEN** 云顶、翻涌侧面和云底的明暗随观察位置与太阳方向实时变化，云边缘呈现自然的三维菜花状轮廓和密度过渡，不因离开特定坐标框而退化为扁平层片

#### Scenario: Far cloud preserves depth cue

- **WHEN** 相机远离近景云壁望向地平线方向
- **THEN** 近景高频细节平滑减弱，远景云海与高耸云带保留可辨识的立体轮廓、受光层次与大气透视过渡

#### Scenario: River opening separates the banks

- **WHEN** 玩家从翡翠海岸的河道入口飞向两侧云壁之间
- **THEN** 河道上方保留可辨识的开口，两侧云壁与低空云海仍具连续的三维体积感

#### Scenario: Era palette updates cloud atmosphere

- **WHEN** 副本切换至不同时代关卡
- **THEN** 云层的受光高亮色、云底阴影色与远景大气混合色同步切换至该时代对应的氛围色板

### Requirement: Autonomous cloud morphing

云场 MUST 在没有风或风速很低时继续进行确定性的三维对流翻涌（Billowing）。翻涌动画 MUST 通过多倍频三维噪声的垂直对流平流与坐标扰动同时驱动云瓣鼓起、边缘翻卷、局部收缩与融合，并实时影响云体的方向光自阴影，而非仅原地正弦微幅起伏。翻涌动画 MUST 使用场景时钟，并且 MUST 与云的水平风向平移分开控制。

#### Scenario: Calm cloud keeps breathing

- **WHEN** 模拟风速接近零且世界时钟继续运行
- **THEN** 云团表面和顶部持续呈现立体的向上鼓泡与菜花状边缘翻卷，相邻云瓣独立起伏与融合，云场的水平风向位移在零风速下保持固定

#### Scenario: Wind accelerates cloud morphing

- **WHEN** 风速或阵风增加
- **THEN** 云的垂直对流与表面翻涌频率和幅度平滑增加，云的整体推进方向仍与风向一致

#### Scenario: Same seed keeps morphing deterministic

- **WHEN** 使用相同种子、相同世界坐标和相同场景时间创建云场
- **THEN** 覆盖、三维翻涌侵蚀、垂直抬升和实时自阴影结果一致

#### Scenario: Pause freezes autonomous morphing

- **WHEN** 世界时钟暂停
- **THEN** 云的三维翻涌相位、风向平移距离、内部雾化和云影保持当前值，恢复后从该状态继续

### Requirement: Player cloud interaction

近景云场 MUST 使用玩家的世界位置和水平速度产生局部、连续的体积交互。玩家机体周围 MUST 形成带垂直范围的低密度空腔，空腔边缘 MUST 随周围翻涌云体产生柔和的挤压隆起与受光变化；机体后方 MUST 形成沿玩家速度方向延伸的柔和尾流。交互 MUST 作用于当前风漂移后的同一密度场，并且不得改变云场的全局噪声坐标或生成独立的随机位移。

#### Scenario: Player displaces nearby cloud

- **WHEN** 玩家进入近景云体
- **THEN** 玩家周围的云密度平滑降低，空腔边缘向外推开并呈现立体受光过渡，远处云体保持连续

#### Scenario: Player leaves a directional wake

- **WHEN** 玩家以非零水平速度穿过云体
- **THEN** 玩家后方出现沿速度方向的低密度尾流，尾流宽度和强度随玩家速度平滑变化，停止或暂停时不产生新的随机扰动

### Requirement: World occlusion and player overlay

云层 MUST 参与世界物体的视觉遮挡，并且 MUST 保持玩家飞机、玩家弹道、锁定环、准心和投弹路径的可见性。玩家进入云层内部时，机体表现 MUST 叠加受限强度的云雾环境光融合反馈，以消除穿云贴纸感且不降低操作可读性。

#### Scenario: Cloud covers world object

- **WHEN** 云层位于相机与地面单位或敌机之间
- **THEN** 对应世界物体被云的密度和深度关系遮挡，雷达和边缘提示继续工作

#### Scenario: Player remains readable

- **WHEN** 玩家飞机进入云层或位于云层之后
- **THEN** 玩家飞机、玩家弹道和关键瞄准信息仍然清晰可见，同时玩家机身呈现随局部云密度平滑变化的柔和光雾融合

## ADDED Requirements

### Requirement: Banding-free volumetric sampling

体积云光线步进与低分辨率云缓冲合成 MUST 采用确定性的每像素起点抖动和平滑深度感知上采样，以在移动端步数预算内消除水平切层感与轮廓锯齿，并在世界时钟暂停时保持画面静止稳定。

#### Scenario: Low step budget avoids slicing artifacts

- **WHEN** 渲染器以省电、标准或高画质的步数上限斜穿厚云层
- **THEN** 画面不出现明显的等距水平切片条纹，同时云边缘与地形、水面和世界物体交界处保持干净过渡
