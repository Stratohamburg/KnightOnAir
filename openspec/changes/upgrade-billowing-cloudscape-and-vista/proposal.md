# Proposal

## Why

当前副本的云层虽然已具备连续密度场，但高精度三维体积云仅覆盖世界坐标中极小的固定区域，离开后退化为 2.5D 高度图云；同时云体缺乏垂直对流翻涌与实时多散射自阴影，且偏陡的巡航镜头俯角压扁了云海与地景的纵深层次。为了让副本呈现接近《光·遇》式的三维立体翻涌云海与开阔绘本地景体验，需要在移动端渲染预算内重构云场的三维动态翻涌、散射光照、巡航纵深构图及地景大气氛围。

## What Changes

- 将连续体积云场升级为全地图无缝的三维翻涌云场，包含低空云海、中/高空立体积云脊与河道开口，移除高精度 3D 体积被固定在局部小盒子的视觉割裂感。
- 为云场增加确定性的垂直对流抬升、多倍频菜花状表面翻涌（Billowing）和坐标扰动，使无风和有风状态下云团均呈现立体的鼓泡、翻卷与舒展，而非仅原地正弦呼吸或刚性平移。
- 重构云层体积光照为实时方向光多散射、粉末效应、双瓣银边散射与时代色板联动，替换暗沉单次衰减与静态烘焙阴影，并引入每像素起点抖动与平滑深度感知上采样以消除低步数切片与锯齿。
- 优化玩家穿云的体积交互与机身融合反馈，使空腔边缘呈现实时翻涌受光变化，同时保持 `overlayScene` 对玩家机体、弹道与瞄准信息的可读性保障。
- 调整巡航相机构图（放缓俯角并延展远裁面与天空地平线可见比例）并保留轰炸高俯角切换反差，保持现有屏幕前方输入语义与玩家居中规则。
- 增强副本的《光·遇》式地景氛围与时代色板联动：升级地表丝绒光影与风吹草浪色带、引入高度雾与太阳方向大气散射、升级树冠为柔和蓬松绘本受光，并在标准与高画质下将云层、天空、地表与水面统一接入时代大气色板。

## Capabilities

### New Capabilities

<!-- 无新增独立能力，全部通过扩展既有能力规格表达。 -->

### Modified Capabilities

- `volumetric-cloud-rendering`: 将三维体积翻涌、全地图双层云海结构、实时多散射与自阴影、无切片采样以及时代大气色板同步纳入体积云渲染需求。
- `battle/camera-and-view-feedback`: 扩展巡航镜头构图要求，使巡航视角展现开阔的云海、天空地平线与远景纵深，同时保持轰炸高俯角切换、玩家居中与屏幕方向一致。
- `rendering/terrain-rendering`: 扩展地表与水面的高度雾、太阳方向大气散射、丝绒化风吹草浪与时代色板联动表现。
- `wind-driven-vegetation`: 升级树木树冠的柔和蓬松体积受光表现，同时保持既有风场摆动、贴地与画质分档规则。

## Impact

- 渲染与配置代码：`src/rendering/Cloudscape.ts`、`src/rendering/CloudscapeLayout.ts`、`src/rendering/CloudFlow.ts`、`src/rendering/CloudWall.ts`、`src/rendering/ShaderMaterials.ts`、`src/rendering/VegetationField.ts`、`src/rendering/BattleCamera.ts`、`src/rendering/Renderer.ts`、`src/data/config.ts`、`src/data/eras.ts`。
- 诊断与验收：`src/rendering/EnvironmentAcceptance.ts` 及现有单元测试 `tests/cloudscape.test.ts`、`tests/controls.test.ts`、`tests/vegetation.test.ts`。
- 不修改 `src/simulation` 的固定步进飞行、地形高度采样、路线与命中判定规则，不引入外部纹理或模型文件，保持标准档 360×640 视口低于 150 次绘制和 150,000 个三角形预算。
