# Spec Delta

## MODIFIED Requirements

### Requirement: Layered cloud appearance

云场 MUST 以**分组的扎实立体云墙与云团**分隔不同陆地与河口区域，区域之间保持晴朗通透的晴天多云格局，禁止在晴朗空域铺设全图低空云海。云层 MUST 针对固定俯视角强化云顶与云壁斜坡的三维菜花状轮廓和饱满边缘，通过太阳方向导数自阴影、多散射近似、粉末明暗与预计算宏观遮蔽，呈现对标《光·遇》云野的奶油暖白受光云顶与清澈浅天蓝/淡薰衣草蓝背光褶皱，并随当前时代色板联动。

#### Scenario: Near cloud presents volume

- **WHEN** 俯视相机接近或飞越视野内的云壁与云团
- **THEN** 云顶菜花球泡、云壁斜坡与褶皱阴影随观察位置和太阳方向实时呈现清晰的三维立体落差，云体核心饱满、边缘利落，同时云墙之外的陆地与河道保持晴朗通透

#### Scenario: Far cloud preserves depth cue

- **WHEN** 相机俯瞰视野前方的分组云带与跨航线云桥
- **THEN** 远端云组保留清晰的团块轮廓、奶油亮顶与冷蓝阴影层次，区域之间的阳光地面依然清晰可辨

#### Scenario: River opening separates the banks

- **WHEN** 玩家从翡翠海岸的河道入口飞向两侧云壁之间
- **THEN** 河道上方保留宽阔晴朗的开口，两侧巨型云墙拔地而起并具有连续的三维体积感与压迫冲击力

#### Scenario: Era palette updates cloud atmosphere

- **WHEN** 副本切换至不同时代关卡
- **THEN** 云层的受光高亮色、云底阴影色与柔和边缘色同步切换至该时代对应的晴朗大气色板

### Requirement: Autonomous cloud morphing

云场 MUST 在没有风或风速很低时继续进行确定性的**原地三维翻涌形变（Billowing）**。翻涌动画 MUST 使用场景时钟驱动，允许云瓣持续缓慢地向上鼓起、舒展、边缘翻卷融合以及有界、零均值的轻微局部偏移，使云朵呈现自然鲜活的动态；同时云组与云墙的整体宏观水平移动 MUST 严格依赖模拟风场 `WindField`，不得脱离风场自行随机位移。

#### Scenario: Calm cloud keeps breathing

- **WHEN** 模拟风速接近零且世界时钟继续运行
- **THEN** 云团表面与云顶持续缓慢地进行三维鼓泡、边缘翻卷与轻微局部微移，但整组云墙的宏观世界位移在零风速下保持固定

#### Scenario: Wind accelerates cloud morphing

- **WHEN** 风速或阵风增加
- **THEN** 云的整体宏观位置沿风向平滑推进，同时局部三维翻涌的频率和幅度平滑增加

#### Scenario: Same seed keeps morphing deterministic

- **WHEN** 使用相同种子、相同世界坐标和相同场景时间创建云场
- **THEN** 云组位置、三维翻涌形态、轻微局部偏移和自阴影结果一致

#### Scenario: Pause freezes autonomous morphing

- **WHEN** 世界时钟暂停
- **THEN** 云的宏观风漂移、原地三维翻涌相位、局部微移、内部雾化和云影保持当前值，恢复后从该状态继续

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

### Requirement: Viewport-focused volumetric performance and banding-free sampling

体积云光线步进 MUST 针对固定俯视角的有限视野做空域裁剪与早退优化：晴朗无云区域 MUST 通过 2D 宏观覆盖/包围盒检查立即跳过而不执行 3D 纹理采样；命中云体后的单步光照 MUST 采用轻量太阳方向导数采样与预计算遮蔽融合，不得嵌套执行多步完整密度场循环；云缓冲采样与合成 MUST 采用确定性每像素起点抖动与平滑深度感知上采样，以在移动端步数预算内消除水平切层与轮廓锯齿，并在世界时钟暂停时保持画面静止稳定。

#### Scenario: Clear sky skips 3D texture sampling

- **WHEN** 光线步进经过分组云墙之间的晴朗空域
- **THEN** 着色器依据 2D 宏观覆盖与云墙边界直接跳过该步，不触发 3D 体积噪声采样

#### Scenario: Low step budget avoids slicing artifacts

- **WHEN** 渲染器以省电、标准或高画质的步数上限穿过厚云墙
- **THEN** 画面不出现明显的等距水平切片条纹，同时云边缘与地形、水面和世界物体交界处保持干净过渡且帧率平稳
