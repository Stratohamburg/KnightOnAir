# 改动 07 · 大块云与遮挡

> 状态：提案（本文件只描述改动，不改现有实现/测试/基线文档；本轮 01–09 全部未实施）
> 决策依据：[00-overview](00-overview.md) 的 **D7 云与遮挡**、D8 Q 版色板、D10 性能与质量档、D11 测试原则
> 依赖：[06 地面与地形](06-ground-routes-and-terrain.md) 的 `terrainHeight(x, z)` 与"贴地飞行"；[05 雷达与锁定反馈](05-radar-alert-and-target-feedback.md) 的雷达/边缘指示；[08 Q 版色板](08-q-art-and-era-progression.md) 的颜色 token
> 用户原话："云雾系统缺少那种大块云朵的感觉，云可以遮挡地面和敌机，不会遮挡玩家自身。"

## 1. 问题与现状

### 1.1 现在的云是什么

- `Renderer` 在构造时创建一张 `PlaneGeometry(23, 16)`，`rotateX(-π/2)` 放平，复制 14 份共享同一个几何体和 `cloudMaterial()`；位置由 `new Random(491)` 决定 `x/z ∈ [-55,55]`、`y ∈ [6,11]`、随机 y 轴旋转（`src/rendering/Renderer.ts:97-111`）。
- 每帧按画质档显示其中 `QUALITIES[q].clouds` 张（低/标准/高 = 5/9/14，`src/data/config.ts:21-32`），位置用 `%100` 取模环绕到玩家周围（`src/rendering/Renderer.ts:526-537`），漂移速度仅 0.23 / 0.3 单位/秒。
- `cloudMaterial()` 是 uv 噪波 + 软边的透明 `ShaderMaterial`：`transparent: true`、`depthWrite: false`、`opacity 0.22`（`src/rendering/ShaderMaterials.ts:59-71`）。也就是说**云从不写深度、从不当遮挡物**，只是叠在画面上的一层半透明贴片。
- 相机在玩家后上方：pitch 62°、距离 39，相机高度 `3 + sin(62°)×39 ≈ 37.4`（`src/rendering/Renderer.ts:496-510`、`src/data/config.ts:19`）；玩家机体 y = 4（`src/rendering/ProceduralAircraft.ts:387`），敌机 y = 4、地面单位 y = -0.1（`src/rendering/Renderer.ts:597`），弹道 y = 4（`src/simulation/World.ts:820`、`:67`）。因此云层 y = 6–11 恰好位于**相机与地面/玩家/敌机之间**，位置本来是对的。

### 1.2 为什么读起来是"贴片"而不是"云"

1. **形状**：14 张四边形平面，平放且只有一层（靠 shared geometry 复制），轮廓永远是矩形裁出的 fbm 噪波，没有团块剪影，也没有三五种不同体量的云型。
2. **体积**：只有水平面，没有侧面。62° 俯视下看不到"云墙/云底"的侧轮廓，多层重叠时也没有前后视差，观感是"地面薄雾贴花"。
3. **光照**：材质只按 uv 噪波混合灰绿与米白两种平色（`src/rendering/ShaderMaterials.ts:64-66`），没有受光面/背光面/底部反弹光/边缘光，也不随太阳方向变化，和场景里飞机的硬光不匹配。
4. **深度**：`depthWrite: false`（`src/rendering/ShaderMaterials.ts:68`）+ 统一 0.22 透明度，云之间互不遮挡、云也遮不住任何东西，只做颜色混合。
5. **遮挡**：没有任何遮挡关系，于是云既不挡地面也不挡敌机，唯一效果是压低画面整体对比度；玩家"在云里"仍然能看清全部地面目标和弹道，天气对玩法信息毫无影响。

### 1.3 缺少遮挡的代价

- 天气没有玩法/视觉意义：云不改变"看见什么"，就不产生"穿云/利用云层接近/被云后敌机偷袭"的空间记忆。
- 大块云无法成立：一块"云"如果永远半透明、永远不挡任何东西，看起来就只能是特效层，而不是世界里的物体。
- 与 Q 版方向冲突：08 要求低模、鲜艳、有体积的玩具感世界，而现在是低饱和灰绿贴片（D8）。
- 现有锁定环/目标环是场景内 Mesh（`src/rendering/Renderer.ts:157-195`），云虽然不挡它们（`renderOrder` 4/5/6），但也因此暴露了"UI 浮在雾上、雾不参与空间"的问题。

### 1.4 需要升级的基线描述

实施合并回 `docs/systems/` 时，下列基线表述需要按本文件更新（本轮不动基线文档，依据 [00-overview](00-overview.md) §7）：

| 基线位置 | 原表述 | 07 的处理 |
| --- | --- | --- |
| `docs/systems/04-enemies-battlefield.md:101-107` | "云层是透明 billboard 或低密度体积片，不阻挡重要 UI" | **保留**"不阻挡 UI"，并升级为"云真实遮挡世界物体（含地面/敌机），但不遮挡玩家与关键战斗 UI" |
| `docs/systems/04-enemies-battlefield.md:104` | "玩家和敌人顶部轮廓增加边缘光，保证在云层前后都能识别" | 玩家由覆盖层保证可见，敌人保留 rim 但不再作为唯一手段：被挡时依赖雷达/边缘/锁定环（§3.4.5） |
| `docs/systems/04-enemies-battlefield.md:105` | "锁定目标在云层中保留颜色环和方向标记" | 落到**覆盖层**：锁定环/目标环始终可见（§3.4.5） |
| `docs/systems/04-enemies-battlefield.md:106` | "轰炸落点显示在地面上方的小型投影层" | 落点准心/落点提示移到**覆盖层**，云不挡瞄准 |
| `docs/systems/04-enemies-battlefield.md:107` | "云层不改变碰撞，只改变颜色、雾度和局部对比度" | **保留**"不改变碰撞/锁定"，删除"不遮挡"：本轮升级为真实深度遮挡 |
| `docs/systems/06-procedural-3d.md:103-108` | cloud shader 四条规划（低频噪波/时间偏移/按距离降透明层/保留轮廓） | 映射为：噪波→边缘与抖动淡出；时间偏移→真实位置漂移；按距离→画质档 + 近远淡出；保留轮廓→fresnel 边 + 覆盖层（§3.3） |
| `docs/systems/06-procedural-3d.md:126-133` | "低端设备关闭部分透明层""使用单一主方向光" | 低画质退回公告板云；云着色继续使用场景现有单一主方向光等效方向（`src/rendering/Renderer.ts:84-87`） |

## 2. 目标体验

- **大块**：一架飞机从云旁掠过时，应该是"整块云从画面一侧推出、被甩到身后"，而不是十几片白斑慢速平移；单块云在屏幕上能占 1/6–1/3 画面，有清晰的圆润顶面和偏蓝的背光面。
- **有厚度**：从 62° 俯视能同时看到云顶受光、侧面转折、云底暗部；三层云的漂移速度不同，产生近快远慢的视差。
- **会挡**：云在相机与地面之间时地面被压暗/遮住；云在相机与敌机之间时敌机消失；玩家撞进/穿过云时视野短暂发白，但**自己的飞机始终清晰可操作**，锁定环和落点提示始终在。
- **可读**：敌机被挡住不等于信息丢失——雷达光点、边缘指示、锁定环、开火告警照旧（05）；这是"能看见锁定环但看不见敌机"的取舍，而不是把敌机位置直接画在云上。
- **稳定**：三档画质观感一致，只降数量/柔边精度；不出现穿云糊脸、云边界跳变、掉帧（D10）。

## 3. 目标设计

> 本节是 D7 的细化，不改变 D7 的任一条：每簇 6–9 个低模团块、簇半径 12–22、三层高度 `terrain + 14/28/42`（高度层权威值见 10 §3.5）、画质 4/7/10 簇、云三角形 < 25k、主场景 + 玩家覆盖层、云不改碰撞/锁定。所有数值"基线可调"。

### 3.1 云簇结构

- **几何模板（共享，禁止每帧 new）**：`IcosahedronGeometry(1, 0)`（20 三角形，圆润主体，约占 65%）与 `BoxGeometry(1, 1, 1)`（12 三角形，棱角块，约 35%，给 Q 版加硬边）；两者都 `toNonIndexed()` + `computeVertexNormals()` 得到平面法线（与 `wingGeometry` 的做法一致，`src/rendering/ProceduralAircraft.ts:69-70`）。
- **每簇 6–9 块（puff）**：1 块主团（占簇半径 0.38–0.46）+ 2–3 块中团（0.28–0.34）+ 3–5 块小团（0.18–0.26）；puff 半径 = 0.18–0.46 × 簇半径（约 1.6–7.4 单位），垂直缩放 0.55–0.7，各自随机 y 轴旋转与 ±4% 明度种子。整簇**不做每帧旋转**，只整体平移。
- **簇半径 12–22**（高空视野下从 9–16 放大，见 10 §3.5），俯视为椭圆（长椭圆簇型 x/z 拉伸 1.4–1.8），底部略平：puff 中心 y 限制在 `[0.15R, 0.7R]`，形成积云的平底。
- **三种簇型**（避免 14 片"同一个云"的重复感）：团块型（60%，L0 主力）、长条型（25%，L2 远景剪影）、双峰型（15%，两主团 + 中缝）。
- **淡边壳**：每个 puff 额外一层同几何、scale 1.16–1.22 的壳，只做 fresnel/噪波柔边，不参与遮挡（§3.4.4）。
- **数量**：低/标准/高 = 4/7/10 簇（D7）；`QUALITIES.clouds` 的语义从"平面数量"改为"云簇数量"，唯一消费点 `src/rendering/Renderer.ts:527` 同步修改。
- **密度预期**：160×160 窗口内 7 簇，意味着 45 单位视野内平均约 1.5–2.5 簇，玩法节奏是"间歇穿云"而非"满屏白云"；单簇观感靠半径上限与簇型保证，不靠继续加数量（数量遵守 D7）。

```ts
// src/rendering/CloudField.ts（新增，纯数据/纯函数，不依赖 three，便于单测）
export interface CloudPuff {
  x: number; y: number; z: number;        // 簇内相对坐标
  radius: number; kind: "ico" | "box";
  rotation: number; tint: number;          // 0..1 明度种子
}
export interface CloudCluster {
  id: number; layer: 0 | 1 | 2;
  baseX: number; baseZ: number;            // 世界锚点（不随玩家移动，只做环绕计算）
  radius: number;                          // 9..16
  driftX: number; driftZ: number;          // u/s
  puffs: CloudPuff[];                      // 6..9
  shadowScale: number;
}
export function buildCloudField(seed: number, clusters: number): CloudCluster[];
export function wrapOffset(base: number, player: number, window: number): number;
export function clusterFade(cluster: CloudCluster, playerX: number, playerZ: number,
  camX: number, camY: number, camZ: number): number;   // 0..1，见 §3.2
export function cloudCoverBetween(ax: number, ay: number, az: number,
  bx: number, by: number, bz: number, clusters: CloudCluster[]): boolean; // CPU 近似，见 §3.4.5
```

### 3.2 三层、环绕、漂移、淡出

| 层 | 基准高度（相对 `terrainHeight`） | 簇半径 | 垂直缩放 | 漂移 | 用途 |
| --- | --- | --- | --- | --- | --- |
| L0 | +14 | 12–20 | 0.55 | 0.8 u/s | 主遮挡层：在玩家（`terrain+20`）下方，负责遮挡地面与低空目标，形成“脚下云海” |
| L1 | +28 | 13–21 | 0.60 | 1.1 u/s | 中景填充层：在玩家上方、相机下方，负责遮挡敌机/远景，制造双层视差 |
| L2 | +42 | 15–22 | 0.65 | 1.4 u/s | 远景剪影层：高空云顶，大块云投影到地面形成大暗斑 |

- **地形采样**：每簇高度 = `terrainHeight(x,z) + layerHeight`（06 接口，D6；水面区域用 06 的 `surfaceHeight = max(terrainHeight, 水位)` 采样）。按 06 的约定（`06-ground-routes-and-terrain.md` §3.8），每簇生成时采样簇心地面高度并保证 `max(terrainHeight + layerHeight, 地面 + 8)`，避免云埋进山体；07 再补"簇心 + 四向 6 单位共 5 点取最大值"作为额外保险（每簇仅 5 次采样、只在换位时算）。06 未落地前由 `Renderer` 注入 `() => 0` 适配器，保证 07 可先合入。
- **环绕**：160×160（D7）。世界坐标 = `wrapOffset(baseX, playerX, 160) + driftX * time`，Z 同理；只更新实例矩阵（≤90 个），不重建几何、不 new 对象（D10）。
- **三重淡出（抖动 discard，保住深度写入）**：
  - 近相机：相机到簇中心 12→18 淡出，避免镜头穿云糊屏；
  - 玩家净空：玩家 XZ 到簇中心 5→11 淡出，避免"整屏白"，同时保留 11 单位外的挡敌机能力（把净空再放大会明显削弱 L0 的遮挡价值）；
  - 环绕边界：玩家到簇中心 62→80 淡出，确保 80 边界外的取模跳变不可见。
- **远景雾化**：叠加场景现有 `Fog("#a8b7a5", 40, 115)`（`src/rendering/Renderer.ts:88`）；08 改雾色/清屏色后云自动跟随，不写死颜色。云在 80 处已完成淡出，早于 `fog.far` 115 与 `camera.far` 180（`src/data/config.ts:19`），不会在远裁剪面处"整块消失"；若 06 调整 `camera.far`，保持 `far > 80` 即可。

### 3.3 云材质、颜色、假投影与过曝

- **核心材质**：不透明（`transparent: false`、`depthWrite: true`、`depthTest: true`），flat 法线 + 三段 toon 着色，输出前手动 `#include <tonemapping_fragment>` / `#include <colorspace_fragment>`（与现有材质一致，`src/rendering/ShaderMaterials.ts:32-33`）；雾用 three 内建 `fog` chunk（`fog: true` + `UniformsLib.fog`），让远云融进场景雾而不是独立变灰。
- **每实例明度种子**：vertex shader 里 `hash(instanceMatrix[3].xz)` 取簇内位置哈希，避免维护 `instanceColor` 属性。
- **颜色（对齐 08 色板；08 的 `palette.ts`（`08-q-art-and-era-progression.md` §4）落地后改为引用 token，不再保留本节字面值）**：

| 用途 | 过渡值 | 与 08 色板的关系 |
| --- | --- | --- |
| 顶部受光 | 奶油白 `#FFF6E5` | 直接使用 08 主色"奶油白"（`08-...md:83`） |
| 中间调 | `#F3EBDD` | 奶油白到天蓝阴影的插值中段 |
| 背光/阴影面 | 天蓝 `#B7D2EA`，深部 `#9DBEDC` | 08 天空蓝 `#8FD3FF` 的**去饱和/提亮**版：阴影面不用高饱和蓝，避免云被染成蓝块 |
| 云底反弹 | 日落粉橙 `#FFC39A` × 0.12–0.16 | 08 暖橙 `#FF7A59` 提亮去饱和，只在朝下法线出现 |
| fresnel 边 | 白 × 0.14–0.20（顶边）、`#FFB38A` × 0.08（低角度） | 与 08 的"厚边光"规则一致，也与飞机现有 rim 手法一致（`src/rendering/ShaderMaterials.ts:28-29`） |
| 内部颗粒 | ±4% 明度 + 低频 fbm 噪波（复用 `src/rendering/ShaderMaterials.ts:2-6` 的 noise/fbm） | 避免大片平色，符合 08"低模面 + 噪波材质" |

- **假投影**：每簇 1 张地面软影（思路同现有玩家/敌机阴影，`src/rendering/Renderer.ts:258-267`、`:538-544`），位置 = 簇中心 + 太阳偏移 `(+2.5, +1.0)`（与现有阴影 `+1.4/+0.5` 同向），`y = terrainHeight + 0.06`，缩放 ≈ 1.6R × 1.2R，透明度 0.12–0.18；仅在 `QUALITIES[q].shadows` 档开启，1 个 `InstancedMesh`（≤10 实例、1 次 draw call）。
- **过曝控制**：云着色输出上限 clamp 到线性 ≤ 1.0；fresnel/底光用普通混合，不开 additive；在 ACES + exposure 1.25（`src/rendering/Renderer.ts:71-73`）下高光落在 0.90–0.96，避免死白。

### 3.4 遮挡与渲染方案（重点）

#### 3.4.1 对象归属：主场景 / 覆盖层 / DOM

| 对象 | 渲染位置 | 云是否遮挡 | 依据 |
| --- | --- | --- | --- |
| 地形、地面单位、地面建筑、金币/维修拾取 | 主场景 | **是** | 世界物体 |
| 空中敌机（含机体、敌机阴影） | 主场景 | **是** | 世界物体 |
| 敌方弹道、敌方导弹、地面火力 | 主场景 | **是** | 世界物体 |
| 玩家飞机（含全部部件、螺旋桨、尾焰、受损冒烟） | **覆盖层** | 否 | 需求：不遮挡玩家自身 |
| 玩家弹道/导弹 | **覆盖层** | 否 | 需求：玩家弹道可读 |
| 锁定环、目标环、锁定扇形 | **覆盖层** | 否 | D7："目标 UI"；04:105 |
| 轰炸准心、投弹轨迹线、落点提示 | **覆盖层** | 否 | 04:106；云中也能瞄准 |
| 世界特效（爆炸、命中火花、敌人起火） | 主场景 | 是 | 世界物体；被挡时用 05 的 DOM 命中/击毁反馈补偿 |
| HUD、雷达、边缘指示、击毁信息 | DOM | 否 | 05 的 DOM 层本来就在 canvas 之上 |
| 敌机/地面目标名牌 | DOM | 按遮挡隐藏/淡出 | 否则"看得见血条看不见飞机"，见 §3.4.5 |

#### 3.4.2 渲染循环（推荐方案）

```ts
// src/rendering/Renderer.ts：构造时 this.renderer.autoClear = false;
// render() 末尾替换现有的 this.renderer.render(this.scene, this.camera)（:548）
this.renderer.clear();                                  // 1. 每帧只清一次颜色/深度
this.renderer.render(this.scene, this.camera);          // 2. 主场景：地形、云、敌机、敌弹、地面目标
this.renderer.clearDepth();                             // 3. 关键：只清深度，保留颜色
this.renderer.render(this.overlayScene, this.camera);   // 4. 覆盖层：玩家、玩家弹道、锁定/落点 UI
```

- `overlayScene` 是新的 `THREE.Scene`，与主场景**共用同一个 `PerspectiveCamera` 实例**、同一个 `Fog` 实例和同一个尺寸/像素比，因此不需要复制相机矩阵，也不会出现两套投影不一致。
- 覆盖层自带一组无阴影的 `HemisphereLight` + `DirectionalLight` 克隆：当前玩家材质是自发光 ShaderMaterial（`src/rendering/ShaderMaterials.ts:7-36`）不需要灯，但 03/08 若给机体引入 `MeshStandardMaterial` 部件，覆盖层必须有灯，否则部件会变黑。
- 对象迁移只在初始化/`setPlayer` 时发生：`aircraft.group` 从主场景移到 `overlayScene`（`src/rendering/Renderer.ts:299-317`）；`lockFan` / `targetRing` / `crosshair` / `bombPath` 同理（`:157-195`、`:196-213`）；玩家受损冒烟的 12 张 Mesh 也随玩家进覆盖层（`updateSmoke()`，`:755-782`），否则会出现"飞机可见、自机烟被云切掉"的穿帮；**禁止把玩家对象放回主场景**。
- 子弹池按队伍拆分：`playerBulletMeshes`（进覆盖层）与 `enemyBulletMeshes`（留主场景），共享现有几何体与三份材质（`src/rendering/Renderer.ts:112-125`）；每个 Mesh 只属于一个场景，不复制、不每帧 reparent。总分绘制调用量基本不变，只是分布到两个 pass。
- `hideBattle()`（`src/rendering/Renderer.ts:783-797`）与 `dispose()`（`:818-829`）必须同时处理两个场景；`dispose()` 现在只遍历 `this.scene`，漏掉覆盖层会泄漏几何体/材质。

#### 3.4.3 该方案的影响与处理

| 维度 | 影响 | 处理 |
| --- | --- | --- |
| 深度 | `clearDepth()` 后覆盖层不再与主场景深度比较 | 覆盖层内部仍有完整深度：机体自遮挡、玩家弹道前后关系正确；云永远压不住玩家（这是需求，不是 bug） |
| 雾 | 清深度不影响材质雾（雾在 shader 里按视距计算） | `overlayScene.fog = this.scene.fog`；当前 `aircraftMaterial` 不含雾（`src/rendering/ShaderMaterials.ts:7-36`），且玩家距相机约 38 < `fog.near` 40，本就几乎不吃雾，两 pass 观感一致 |
| 抗锯齿 | 同一 canvas、同一 MSAA 缓冲，无额外 resolve | 保持 `antialias: true`（`src/rendering/Renderer.ts:66-70`）；云核心是几何边，alpha test 边缘可加 `alphaToCoverage` 降锯齿 |
| 色调映射/色彩空间 | renderer 级设置，两 pass 相同 | 自定义 shader 必须手动 include tonemapping/colorspace，沿用现有模式 |
| 透明排序 | 每个场景独立排序，覆盖层整体画在主场景之后 | 覆盖层 UI 依赖既有 `renderOrder`（4/5/6，`src/rendering/Renderer.ts:161`、`:181`、`:194`）；锁定环/落点永远压在最上层，符合"不挡 UI" |
| 性能 | 多一次 `clearDepth()` + 一次 `render()` 调用；draw call 总量近似不变 | 覆盖层对象少（1 机体 + ≤140 弹 + 4 个 UI）；移动端实测增量按 +0.2–0.4 ms/帧 设预算；云改不透明后主场景少了 9 张云平面的大面积透明叠加 |
| 调试统计 | `renderer.info` 不再天然覆盖两 pass | 构造时 `this.renderer.info.autoReset = false`，每帧开头 `this.renderer.info.reset()`，`diagnostics`（`src/rendering/Renderer.ts:809-817`）才同时包含两个 pass |

#### 3.4.4 云材质深度策略

- **核心云块必须真正写深度**：不透明 + `depthWrite: true` 是最省事、排序最正确的做法，云和地形/敌机共用同一条深度管线，天然正确遮挡。
- **外围薄云/淡边壳**：`transparent: true, depthWrite: false, depthTest: true`，只柔化轮廓，不制造遮挡；每层合并成 1 个 `InstancedMesh`（不是每块云一个透明 Mesh），把透明排序对象数量压到常数。
- **禁止**把核心做成 `transparent: true + depthWrite: true`：会进透明队列并因排序产生穿插错误，而它本来就应该是不透明的。
- **低画质公告板**：每簇 1 张始终面向相机的四边形（复制 `camera.quaternion`，思路同现有特效，`src/rendering/Renderer.ts:667`），`transparent: false` + `alphaTest 0.5` + fbm 剪影，**仍然写深度**，因此低画质也满足"云遮挡地面/敌机"；只有柔边精度下降。
- 云不参与模拟：不改 `hitPlayer`/`updateProjectiles`（`src/simulation/World.ts:841-902`、`:903`+）、不改 `targetFor`（`:679-710`）、不改飞行/风场；渲染层只是多了一个不透明遮挡物。
- **draw call 预算**：核心 3 层各 1 个 `InstancedMesh`（3）+ 淡边壳按层合并（3）+ 公告板档（1）+ 假投影（1）≤ 8 次，低于现状"14 张平面 = 14 次"；切档只改 `count`，不重建几何体；进入透明排序的对象从 9 张云降到 ≤5 个，排序开销也更低。

#### 3.4.5 敌机被云挡住时的信息补偿

- **05 的雷达盘、边缘指示、开火告警、击毁反馈都是 DOM**，不受 3D 深度影响；D5 的 `enemy_fire` 事件保证敌机在云后开火也有一条"雷达闪 + 告警音 + 方向脉冲"的提示链。
- **锁定环/目标环/锁定扇形在覆盖层**：故意保留"看不见敌机但能看见锁定环"。这是设计取舍——只对**已锁定目标**暴露位置，不提供全图透视；锁定丢失时环随之消失（`mainLock` 逻辑不变）。
- **名牌遮挡门控**：`updateLabels()`（`src/app/GameApp.ts:354-386`，约 11 Hz 刷新，`:736-740`）目前无条件给每架敌机画 DOM 名牌；若敌机被云挡住而名牌还在，遮挡就白做了。用 `Renderer.cloudCoverBetween(camera.position, enemyPos)` 做 CPU 近似判断（≤10 簇球体 × ≤14 敌机，每帧 140 次以内），被遮挡时给 `.enemy-label` 加淡出类（0.15 s 过渡）；锁定目标的名牌与锁定环保留（属于目标 UI 白名单）。05 已把"敌方名牌是否降噪"列为待确认（`05-radar-alert-and-target-feedback.md:374`）并明确不依赖名牌（`:208`），07 的淡出可直接叠加。
- **地面目标同理**：`groundMarkers`（`src/rendering/Renderer.ts:599-603`）与 DOM 轰炸提示在主场景会被短暂挡住，但准心/落点提示在覆盖层，保证"云里也能瞄准"。是否允许云中盲投是取舍，见 §8。
- **玩家弹道在覆盖层**意味着弹道可以"透云"提前暴露云后敌机位置；命中火花/爆炸在主场景可能被挡，由 05 的 DOM 命中标记补偿。这条信息不对称是有意的：玩家自己的攻击反馈优先于遮挡强度。

#### 3.4.6 备选方案与风险

| 方案 | 优点 | 问题 | 结论 |
| --- | --- | --- | --- |
| **A. 主场景 + 覆盖层（推荐）** | 精确满足"挡世界不挡玩家"；玩家弹道/锁定 UI 可读；无 GPU readback；同一相机 | 多一次 render；对象归属要严格维护 | **采用** |
| B. 玩家材质 `depthTest: false` | 改动最小 | 机体内部绘制顺序错乱；近处云/敌机永远被玩家压住、丢纵深；只解决机体、不解决弹道/UI；03 部件脱落会穿帮 | 不采用 |
| C. stencil 门控 | 语义精确 | 需额外 stencil 设置与材质改写，移动端复杂度/带宽不划算，效果等同 A | 不采用（后备） |
| D. 单场景 + layers + 双相机 | 不用搬对象 | 要同步两个相机矩阵/灯光 layer，且"哪些对象在覆盖层"更难断言；与 D7 的"覆盖层场景"文字不同构 | 作为 A 的实现备选 |
| E. 保持现状只加阴影/边缘光 | 零风险 | 不满足"云遮挡地面和敌机" | 否 |
| F. 体积云/raymarch | 观感最好 | D7 明确禁止，移动端预算不可行 | 否 |

**风险与对策**：最大的风险是"新加的 UI/弹道忘了进覆盖层，于是被云挡"——用 §6 的 dev hook + 覆盖层白名单断言兜住；其次是 03 的部件脱落件归属（挂机体的部件跟随覆盖层永远可见，脱落后应转主场景），需与 03 作者对齐时机。

### 3.5 与玩法、其他系统的关系

- **不改碰撞/锁定/物理/导演**：云只是渲染层遮挡物，模拟层零改动（`src/simulation/World.ts` 不需要新增云概念），因此手感、锁定、命中、刷新节奏完全不变。
- **默认不加"云内效果"**：不做云内降低敌方命中/降低锁定/降低玩家锁敌等隐性规则（会破坏可预期性，且需要模拟层确定性接口）。若要做，先走 §8 的确认流程再单开文档。
- **接口**：
  - `Renderer.cloudCoverBetween(from, to)`：CPU 近似遮挡查询，只给 DOM 名牌/调试用，**不用于玩法判定**；
  - `Renderer.cloudBandAt(y)`：返回目标所在的云层带（-1/0/1/2），供 02 生成提示、05 雷达分区做视觉分层（可选）；
  - 06 的 `terrainHeight(x, z)`：云层基准高度与假投影落点；
  - 03：挂机体部件随覆盖层可见，脱落件转主场景；08：颜色 token（`src/rendering/palette.ts`）、雾色/清屏色、簇型圆润度。
- **02 生成**：屏幕外刷新若正好在云后，交给 05 的边缘指示兜底，不额外处理；**05 雷达**：云本身不画在雷达上（雷达是抽象盘），但可按 `cloudBandAt` 给光点做带宽分层（可选）。

## 4. 改动清单（文件级）

| 文件 | 改动 | 关键符号 / 位置 |
| --- | --- | --- |
| `src/data/config.ts` | `QUALITIES.clouds` 语义改为云簇数量（4/7/10），新增 `cloudMode`（`billboards`/`puffs`）与 `CLOUD_TUNING`（层次/半径/puff/漂移/淡出/预算） | `QUALITIES` `src/data/config.ts:21-32` |
| `src/rendering/CloudField.ts`（新增） | 纯数据云场：确定性布局、簇/团块描述、环绕、淡出权重、CPU 遮挡近似；不依赖 three | `buildCloudField` / `wrapOffset` / `clusterFade` / `cloudCoverBetween` |
| `src/rendering/CloudMaterials.ts`（新增） | 4 个材质工厂：核心不透明 toon、淡边 fresnel、低画质公告板、假投影；复用既有 noise/fbm | `cloudCoreMaterial` / `cloudFringeMaterial` / `cloudBillboardMaterial` / `cloudShadowMaterial` |
| `src/rendering/CloudSystem.ts`（新增） | 共享几何模板、按层 `InstancedMesh`（预分配高配容量，切档只改 `count`）、每帧环绕/漂移/矩阵更新、假投影池、`dispose` | `CloudSystem.update` / `applyQuality` |
| `src/rendering/Renderer.ts` | 新增 `overlayScene` 与双 pass 渲染（`autoClear=false` / `clear` / `clearDepth`）；玩家、锁定环、目标环、准心、投弹轨迹迁入覆盖层；子弹池拆分；移除旧 `clouds`/`cloudMat` 更新循环；`diagnostics` 扩展；`dispose` 覆盖两场景；dev hook | `render()` `:474-579`、`updateBattle()` `:580-754`、`setPlayer()` `:299-317`、`hideBattle()` `:783-797`、`dispose()` `:818-829`、旧云 `:97-111`/`:526-537` |
| `src/rendering/ShaderMaterials.ts` | 移除旧 `cloudMaterial()`（实施时同步删 `Renderer` 的 import，`src/rendering/Renderer.ts:15`） | `src/rendering/ShaderMaterials.ts:59-71` |
| `src/app/GameApp.ts` | `updateLabels` 增加遮挡门控（敌机名牌淡出）；DEV 下暴露 `window.__koa = { renderer, world }`；`quality-readout` 可加云统计 | `:354-386`、`:736-740`、`:337-340`、`:74-88` |
| `src/style.css` | `.enemy-label` 增加 opacity 过渡（配合遮挡淡出） | `src/style.css:857-887` |
| `tests/cloud-field.test.ts`（新增） | 云场结构/确定性/淡出/CPU 遮挡/三角预算的纯函数测试 | — |
| `docs/systems/04-enemies-battlefield.md:101-107`、`docs/systems/06-procedural-3d.md:103-108` | 实施合并时按 §1.4 更新基线（本轮不改） | — |

## 5. 实现任务拆分

| 任务 | 内容 | 依赖 | 写入范围 |
| --- | --- | --- | --- |
| T1 配置与云场 | `CLOUD_TUNING` + `QUALITIES` 语义修改；`CloudField.ts` 全部纯函数；`tests/cloud-field.test.ts` | — | `src/data/config.ts`、`src/rendering/CloudField.ts`、`tests/cloud-field.test.ts` |
| T2 覆盖层渲染管线 | `overlayScene`、`autoClear=false` + 双 pass、对象迁移、子弹池拆分、灯光/雾、`dispose`、`info.autoReset` | — | `src/rendering/Renderer.ts`（先于 T3 合入，避免同文件冲突） |
| T3 云几何与实例化 | `CloudMaterials.ts` + `CloudSystem.ts`：模板几何、3 层 InstancedMesh、淡边壳、公告板档、假投影；替换旧平面云接线 | T1、T2 | `src/rendering/CloudMaterials.ts`、`src/rendering/CloudSystem.ts`、`src/rendering/Renderer.ts`（接线小改） |
| T4 遮挡验证与名牌 | `cloudCoverBetween` 接入 `GameApp.updateLabels`；名牌淡出；锁定目标白名单；验证"敌机被挡/名牌消失/雷达仍在" | T2、T3 | `src/app/GameApp.ts`、`src/style.css` |
| T5 画质档与预算 | 4/7/10 簇、低画质公告板、切档不重建（`count` 切换）、三角预算与 draw call 统计 | T1、T3 | `src/data/config.ts`、`src/rendering/CloudSystem.ts` |
| T6 视觉打磨 | toon 三色阶、fresnel 淡边、底光、抖动淡出、过曝、雾色/08 色板对齐、假投影调参 | T3 | `src/rendering/CloudMaterials.ts`、`src/rendering/CloudSystem.ts` |
| T7 验收钩子 | DEV 下 `window.__koa`、`renderer.diagnostics.overlay`、`?cloudTest=1` 固定场景、覆盖层白名单断言、截图/像素验证脚本 | T2–T6 | `src/rendering/Renderer.ts`、`src/app/GameApp.ts` |

建议落地顺序：T2 → T1 → T3 → T4 → T5 → T6 → T7。T1/T2 可并行（不同文件）；T3 之后 Renderer 只做接线小改，T5–T7 集中改 `CloudSystem`/`CloudMaterials`，避免与 T2 抢 `Renderer.ts`。

## 6. 验收标准

### 6.1 自动化可测（`npm run test` / `npm run check`）

| 项 | 方法 | 阈值 |
| --- | --- | --- |
| 云簇结构 | `buildCloudField` 断言每簇 puff 数、簇半径、层高 | 6–9 块；半径 12–22；层高 14/28/42（±0.5） |
| 画质档 | 低/标准/高各构建一次 | 簇数 4/7/10（D7） |
| 确定性 | 同 seed 深比较；玩家平移 160 后 `wrapOffset` 结果一致 | 完全相等 / 误差 ≤ 1e-9 |
| 三角预算 | `簇数 × puff 数 × 模板三角 + 淡边壳 + 假投影` | 标准档 < 25 000（预估 2.1k–3.2k，给 08 留余量）；高 < 25 000 |
| 淡出 | 近相机/玩家净空/边界三档距离扫描 | 单调、端点 0/1、无负值 |
| CPU 遮挡 | 相机-目标连线穿云/不穿云/目标在云后三种构造 | 与解析结果一致 |
| 覆盖层白名单 | DEV hook 断言：`overlayScene` 顶层对象 ∈ 白名单、主场景不含玩家、UI 对象数 = 4 | 任一不符即失败 |
| 云 draw call | DEV 下 `diagnostics` 对比开关云前后的 `calls` 差值 | ≤ 8（标准档） |
| 现有测试 | 三份测试文件 | 全部通过（模拟层未改，见 §7） |

### 6.2 截图 / 浏览器验收（DevTools，竖屏 360×640 逻辑分辨率）

1. 正常战斗 10 s 截图：至少一块云有受光顶面、天蓝背光、圆润轮廓，与旧"14 片贴片"截图肉眼可分。
2. `?cloudTest=1`（DEV 固定一簇在相机与玩家连线之间、drift = 0）：云挡住地面/敌机；玩家机体完整可见；锁定环和落点提示仍在云上。
3. 同场景 `?cloudTest=1&overlay=off`：玩家被云遮住 → 与第 2 张的玩家包围盒区域像素差 ≥ 95%（Photoshop 差值或 `magick compare`）。
4. 锁定环穿云可见；被挡敌机名牌消失；05 雷达/边缘指示仍指向该敌机；开火告警音仍触发。
5. 三档画质截图：数量/柔边差异正确；低画质公告板云**仍遮挡**地面/敌机。
6. 连续直线飞行 30 s：云在 160 边界换位时无可见 pop；穿云瞬间无整屏白、玩家始终清晰。

**像素级验证步骤（玩家在云后仍可见）**：
1. T7 的 dev hook 暴露 `window.__koa.renderer`，并提供 `readPlayerPixel()`（`import.meta.env.DEV` 才挂载，内部 `gl.readPixels`）。
2. 用 `?cloudTest=1` 固定场景并暂停世界模拟（`world.clock.timeScale = 0`），保证截图可复现。
3. `renderer.project(player.x, 4, player.z)` 得到玩家屏幕坐标 (px, py)；读取 (px, py) 及 ±2 px 均值，与玩家主色（`player.frame.color`）欧氏距离 < 阈值（如 0.15）判定"玩家可见"。
4. 关闭覆盖层 pass（dev flag）后重读同一点，必须变成云色 → 证明云确实盖在该像素上。
5. 再读屏幕上远离玩家的一点（如 px+120, py-60），三档画质下均应为云色 → 证明覆盖层只画白名单对象，没有把整个画面替换掉。
6. 打开覆盖层再读 (px, py)，恢复为玩家色；记录该帧 `fps`/`diagnostics.calls`。

### 6.3 真机验收

- 中端机标准档目标 60 FPS、低端机不低于 30 FPS（D10）；自适应分辨率逻辑（`src/rendering/Renderer.ts:549-578`）保持工作。
- 大块云观感：体积感、明暗面、三层视差、云影；颜色符合 08 色板且不过曝。
- 战斗可用性：云后敌机确实不可见，但玩家仍能靠雷达/边缘/锁定环做判断；不会出现"满屏全白看不见敌人"的持续状态。
- 画质菜单切档不卡顿（不重建云几何体）、连续 5 分钟无内存增长（覆盖层/云 `dispose` 正确）。

## 7. 测试与兼容

- **现有测试**：三份测试只覆盖模拟层与输入（`tests/simulation.test.ts`、`tests/controls.test.ts`、`tests/flight-dynamics.test.ts`），没有任何云/遮挡断言；本文件不改 `World`/`FlightDynamics`/输入，因此**现有用例不需要修改**。按 D11 的"每份文档列出受影响测试"：直接受影响用例为空，新增渲染纯逻辑测试替代。
- **新增测试**：`tests/cloud-field.test.ts` 只依赖纯函数模块，不引入 WebGL/canvas/DOM（当前环境没有 jsdom/Playwright，`Renderer` 无法在 vitest 中实例化）；渲染结构用 DEV dev hook 做人工/脚本断言，不引入新的 e2e 框架。
- **渲染结构兼容**：`Renderer` 对外的 `render()` / `project()` / `setQuality()` / `setPlayer()` / `canvas` / `fps` 保持签名不变（调用方 `src/app/GameApp.ts:74-88`、`:720-744`）；`diagnostics` 只增字段不改旧字段；`QUALITIES.clouds` 语义变更的唯一消费点是 `src/rendering/Renderer.ts:527`，改档位时同步修改；不涉及存档字段（D9）。
- **接口依赖**：06 的 `terrainHeight`（07 用适配器兜底，可先合入）；05 的雷达/边缘/锁定反馈（信息补偿的主要承担方，05 已明确"被云挡住的敌人仍显示雷达光点与边缘指示"）；03 的部件脱落归属（挂机体部件随覆盖层可见，脱落件转主场景）；08 的颜色 token（`src/rendering/palette.ts`，07 先用 §3.3 过渡值）。落地顺序见 00-overview Wave 3。
- **性能**：不新增 render target、不做实时阴影/体积云；云使用共享几何 + `InstancedMesh`、预分配容量、切档只改 `count`（D10"不得每帧 new 几何体或材质"）；预算见 §6.1 与 00-overview D10（绘制调用 < 150、三角形 < 150k、云 < 25k）。
- **基线文档**：`docs/systems/04-enemies-battlefield.md:101-107` 与 `docs/systems/06-procedural-3d.md:103-108` 的旧表述在实施合并时更新（§1.4），本轮不修改任何基线文档。

## 8. 待确认与备选

1. **云内玩法效果**：是否要"云内降低敌方命中/降低锁定/降低玩家锁敌"？**默认不做**（云不改碰撞/锁定是 D7 硬约束）；若要做，必须先更新 00-overview 决策并单独补模拟层确定性接口与测试。
2. **拾取物是否永远可见**：金币/维修目前留在主场景，会被云短暂挡住；靠磁吸半径 5.2（`src/data/config.ts:17`）与玩家净空淡出补偿。是否需要把拾取物也提到覆盖层？
3. **敌机名牌**：被云挡住时彻底隐藏（推荐，0.15 s 淡出）还是保持半透明？若 05 最终移除空中敌机名牌，则本条自动消失。
4. **云中盲投**：准心/落点提示放覆盖层后，玩家可以在云里瞄准不可见的地面目标；接受还是要求云中降低投弹精度（后者会变成玩法规则）？
5. **低画质公告板是否写深度**：建议写（保证"云遮挡"三档一致）；若极低端机 alphaTest + 深度写入有带宽问题，可退化为纯视觉云，但会削弱需求，需要拍板。
6. **地形与云底**：06 地形起伏会让 L0 云底切入山体；本方案用"中心 + 四向采样取最大"缓解（成本极低，建议做）。远景山体（D6 提到 18）会穿出云层，视觉上是否接受？高度层与相机口径见 10。
7. **06/08 接口最终形态**：`terrainHeight` 是否按计划落地；08 色板 token 名与雾色最终值；07 的过渡色值是否作为 fallback 保留。
8. **玩家弹道"透云"**：覆盖层会让玩家弹道提前暴露云后敌机位置（信息补偿 vs 遮挡强度），接受该不对称。
9. **03 脱落件归属**：机体部件随覆盖层永远可见，脱落后转主场景（世界碎片）的切换时机与 03 对齐。
10. **云层是否参与 05 雷达分区**：可选视觉分层（`cloudBandAt`），不是玩法规则。
