# Spec Delta

## MODIFIED Requirements

### Requirement: Layered cloud appearance

云场 MUST 以**分组的扎实立体云墙与云团**分隔不同陆地与河口区域，区域之间保持晴朗通透的晴天多云格局，禁止在晴朗空域铺设全图低空云海。默认移动端云墙 MUST 使用确定性平滑融合距离场提取的索引网格，以插值平滑法线、褶皱遮蔽、奶油暖白 / 淡粉金 / 天蓝紫三段色板、背光透射与 Fresnel 柔边呈现立体云形，并随时代色板联动。

#### Scenario: Near cloud presents volume

- **WHEN** 俯视相机接近或飞越视野内的云壁与云团
- **THEN** 云顶菜花球泡、云壁斜坡与褶皱阴影随观察位置和太阳方向实时呈现清晰的三维立体落差（无整片死白过曝），云体核心饱满、边缘利落，同时云墙之外的陆地与河道保持晴朗通透

#### Scenario: Far cloud preserves depth cue

- **WHEN** 相机俯瞰视野前方的分组云带与跨航线云桥
- **THEN** 远端云组保留清晰的团块轮廓、奶油亮顶与冷蓝阴影层次，区域之间的阳光地面依然清晰可辨

#### Scenario: River opening separates the banks

- **WHEN** 玩家从翡翠海岸的河道入口飞向两侧云壁之间
- **THEN** 河道上方保留宽阔晴朗的开口，两侧巨型云墙拔地而起并具有连续的三维体积感与压迫冲击力

#### Scenario: Estuary bank has distinct shoulders and crowns

- **WHEN** 在标准空战机位暂停并观察河口左岸
- **THEN** 沿岸剪影可见低而延伸的云肩、局部缺口及更高的云冠。薄边局部透出地景，厚云后的地景仍受遮挡

#### Scenario: Overlapping crowns cast soft shadows

- **WHEN** 左岸云冠的一瓣挡住了通往后方云瓣的阳光
- **THEN** 前瓣向阳的斜面形成连续的暖白亮部，后瓣被遮挡处和背光坡面形成冷蓝阴影。明暗交界随云瓣转折和遮挡分布，标准战斗机位和侧视近景都能看出前后层次

#### Scenario: Era palette updates cloud atmosphere

- **WHEN** 副本切换至不同时代关卡
- **THEN** 云层的受光高亮色、云底阴影色与柔和边缘色同步切换至该时代对应的晴朗大气色板

### Requirement: Tiered cloud rendering

省电、标准和高画质 MUST 使用同一连续云场。默认网格路径 MUST 以当前世界缓冲的完整分辨率渲染，并按档位调节薄边细节。

#### Scenario: Quality changes cloud budget

- **WHEN** 玩家切换省电、标准或高画质
- **THEN** 网格路径保持原生世界缓冲分辨率、云形布局和遮挡关系，按档位降低薄边侵蚀细节


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

近景云场 MUST 使用玩家和其他载具各自的三维接触点产生局部空腔，沿实际路径留下可回拢的尾流。飞机使用机身及仍在机上的翼尖，地面与水面载具按渲染姿态采样车体或船体。每个接触点 MUST 按所在高度的云密度驱动强度。交互 MUST 作用于当前风漂移后的同一云场。

#### Scenario: Player displaces nearby cloud

- **WHEN** 玩家进入近景云体
- **THEN** 玩家周围的云密度平滑降低，空腔边缘向外推开并呈现立体受光过渡，远处云体保持连续

#### Scenario: Player leaves a directional wake

- **WHEN** 玩家以非零水平速度穿过云体
- **THEN** 玩家后方出现沿速度方向的低密度尾流，尾流宽度和强度随玩家速度平滑变化，停止或暂停时不产生新的随机扰动

#### Scenario: Vehicles disturb the bank independently

- **WHEN** 玩家位于晴空，两辆载具同时接触相隔的云肩，随后一辆离场
- **THEN** 每辆载具都在自身接触点形成切口，双方轨迹独立。离场载具停止切云，旧轨迹随云漂移并在 2.4 秒内衰减。各载具共享 48 段 GPU 尾流预算，预算饱和时轮流选取各自的轨迹段

#### Scenario: Vehicle passes below an elevated bank

- **WHEN** 飞机、列车或船只从云层正下方通过，所有接触点都处于晴空
- **THEN** 该载具的切口数量为零，其在地面的投影与云层重叠时也不引起云面扰动

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

默认网格路径 MUST 将绘制预算集中在可见云组，缓存融合几何并使用硬件深度裁剪。普通云面 MUST 使用固定开销的表面着色。接触处可在有界的局部区间内求解距离场切口。世界深度 MUST 同时用于地形接触软化。路线 A 的解析曲面追踪保留为开发对比。

#### Scenario: Clear sky skips 3D texture sampling

- **WHEN** 视线经过晴朗河口或云组之间的空域
- **THEN** 路线 B 没有覆盖该像素的云网格，也不执行云表面三维噪声采样

#### Scenario: Low step budget avoids slicing artifacts

- **WHEN** 以任一画质飞越近景厚云墙
- **THEN** 融合曲面连续平滑，无水平切层或步进噪点，云与地表、水面及世界物体之间具有正确的深度排序和柔和交界

### Requirement: Rasterized cloud interior and surface wake

路线 B MUST 以各载具在云体局部坐标中的实际接触轨迹驱动有界的云面形变，并在当前接触处与路线 A 共用距离场平滑减法。切口表面的命中位置 MUST 决定深度，减法后场的梯度 MUST 决定切口与云肩交界处的受光。主体与翼尖或车船前后接触点的切口半径上限分别为 2.1 和 1.4 个世界单位，周围云面形变半径为 8。薄云边可透出地景。经过处随云漂移并逐段回拢，暂停冻结形变。相机进入云内时按所在位置的密度驱动薄雾。

#### Scenario: Aircraft crosses the fused cloud surface

- **WHEN** 玩家穿过云墙并离开
- **THEN** 云面沿实际经过处产生有高度范围的凹陷与隆起，离开后缺口短暂保留并逐渐合拢。远离飞行高度的厚云顶保持自然翻涌

#### Scenario: One wing grazes the bank before the fuselage

- **WHEN** 一侧翼尖先进入云边，另一侧翼尖和机心仍在晴空
- **THEN** 固定机位能看到接触侧的云肩后退和重新受光。离开后缺口留在相应的云体位置并合拢，独立云絮实例数为零

#### Scenario: Camera moves inside a cloud

- **WHEN** 相机进入云体后再离开
- **THEN** 云内薄雾随当前密度平滑增强和消退，玩家覆盖层依然可读
