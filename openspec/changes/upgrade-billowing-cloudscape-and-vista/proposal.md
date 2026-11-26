# Proposal

## Why

本游戏为 360×640 移动端固定俯视角（`52°`）空战，视线范围有限且看不到远处天空与地平线。第一版视觉标杆对标《光·遇》云野（Daylight Prairie）的晴天多云体验——核心在于**一组一组扎实饱满、拔地而起的立体翻涌云墙将不同晴朗陆地/河口区域分隔开**，区域间通透可见阳光草地与碧水。需要针对俯视角与移动端性能红线重构体积云与视野内地景表现，把全部渲染预算集中在视野内可见区域（视野内 100 分、视野外 0 分），实现高帧率、强立体翻涌感与高冲击力的云野体验。

## What Changes

- 坚持“分组云墙分隔晴朗区域”的晴天多云格局，禁止全图铺底低空云海或近中景阴天雾，保持云组之间陆地、河道与水面 100% 晴朗通透。
- 为俯视角强化云顶与云壁斜坡的 3D 菜花雕塑体积感与扎实饱满边缘，并以《光·遇》云野晴天色板（奶油暖白受光顶 + 清澈浅天蓝/淡薰衣草蓝褶皱阴影 + 清晰冷蓝地面云影）拉出高对比立体冲击力。
- 明确云层动态规则：**整体宏观移动严格依赖模拟风场 `WindField`**（不脱离风场自行随机移动）；在此基础上，云体随场景时钟进行确定性的**持续缓慢三维原地翻涌形变**（向上鼓泡、边缘翻卷融合，并允许有界零均值的轻微局部偏移），暂停时全部冻结；玩家穿云在当前风漂移后的同一密度场内形成低密度空腔、边缘受光隆起与柔和尾流。
- 实施俯视角移动端极限性能优化：光线步进严格先做 2D 覆盖/包围盒早退（晴空 0 次 3D 纹理采样），命中云体后单步控制在 2–3 次 3D 采样内（1 次上升翻涌雕刻 + 1 次太阳方向导数自阴影，禁止嵌套完整太阳循环与多点空域域扭曲），地面云影走轻量宏观积分，并引入确定性 IGN 像素抖动与平滑深度感知上采样消除切片锯齿。
- 保持固定俯视巡航镜头（`pitch: 52°`, `fov: 48°`, `distance: 66`）的云墙贴脸冲击感与屏幕操控精度，不为屏幕外不可见的天空地平线牺牲视野内观感与帧率。
- 精简并优化视野内地景：去近景雾纱、突出晴天云野明媚丝绒草地与金色风吹麦浪、清晰天空反射水面，以及低面数柔和球簇绘本树冠（控制全场景三角面回归低开销基线）。

## Capabilities

### New Capabilities

<!-- 无新增独立能力，全部通过修订既有能力规格表达。 -->

### Modified Capabilities

- `rendering/volumetric-cloud-rendering`: 定义俯视角晴天多云的分组巨型云墙结构、三维原地翻涌与有界轻微局部偏移、风场整体移动约束、单步太阳导数自阴影与空域零 3D 采样性能约束、无切片采样及玩家穿云光雾融合。
- `rendering/terrain-rendering`: 定义俯视角视野内晴天通透地表表现（禁止近中景阴天低谷雾）、明媚丝绒草浪、清透冷蓝云影与闪光水面。
- `rendering/wind-driven-vegetation`: 升级树木树冠为低面数柔和蓬松绘本球簇与连续受光过渡，同时保持既有风场摆动、贴地与低三角面预算。

## Impact

- 规则文档：`docs/RENDERING_GUIDE.md`、`docs/README.md`（已落地俯视角云野视觉原则与性能红线）。
- 渲染与配置代码：`src/rendering/Cloudscape.ts`、`src/rendering/CloudscapeLayout.ts`、`src/rendering/CloudFlow.ts`、`src/rendering/ShaderMaterials.ts`、`src/rendering/VegetationField.ts`、`src/rendering/Renderer.ts`、`src/content/3d/AircraftFactory.ts`、`src/data/config.ts`、`src/data/eras.ts`。
- 测试与验收：`tests/cloudscape.test.ts`、`tests/controls.test.ts`、`tests/vegetation.test.ts` 及 `src/rendering/EnvironmentAcceptance.ts`。
- 不修改 `src/simulation` 的固定步进飞行、地形高度采样、路线与命中判定规则，不引入外部贴图或模型。

## 路线 B 后续

默认移动端采用融合网格、顶点三维翻涌和有限航迹段驱动的局部云肩形变，以原生分辨率呈现连续云墙。沿用既有云场布局、风场和玩家覆盖层。
