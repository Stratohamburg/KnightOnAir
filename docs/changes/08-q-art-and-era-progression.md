# 08 · Q 版 lowpoly 与时代线（萌芽期 → 一战 → 二战 → 初代喷气）
> 状态：提案（**未实施**，只描述改动，不改源码/测试/基线文档）。基线：`package.json` 0.3.0（提交 `5b22187`），行号以该提交为准，实施以符号名为主。
> 共享决策：**D8（主决策）**、D1（部件）、D6（地面/水面）、D7（云遮挡）、D9（存档）、D10（性能）、D11（测试）。依赖文档：[03 部件](03-parts-and-damage-degradation.md)、[06 地面/地形](06-ground-routes-and-terrain.md)、[07 云遮挡](07-cloud-block-and-occlusion.md)，接口见 §3.3.3、§7.4。
> 用户口径（已确认）：Q 版 lowpoly + 鲜艳活力；时间线**从航空萌芽期开始**：萌芽期 → 一战 → 二战 → 初代喷气；现有 Swift/Courier/Mastodon/Wasp 属于**初代喷气时代**；构型必须支持**大型轰炸机、水上飞机（浮筒/飞行艇）、重型战斗机（双发）**以及双翼/三翼/单翼。
> 本文档是唯一改动产物；不改任何源码、测试和其他文档（基线文档合并见 00-overview §9）。
## 1. 问题与现状
### 1.1 为什么现在“不够 Q 版”
| 维度 | 现状（代码/数据证据） | 为什么不够 Q 版 |
| --- | --- | --- |
| 比例 | `Airframe.length/wingspan` 直接进模拟（`src/data/aircrafts.ts:1-29`，Swift 4.8/6.2）；机身由 6 个硬截面 × 8 边生成（`src/rendering/ProceduralAircraft.ts:7-36` `fuselageGeometry`）；座舱球半径 0.45 再压成 (0.68,0.75,1.65)（`:127-135`） | 是“写实飞机等比缩小”，不是玩具比例：机身太长、翼展不够宽、头部不抢焦点 |
| 轮廓 | 机翼统一 `wingGeometry`（`:37-73`，厚度 0.12，直角翼尖）；无螺旋桨、起落架、浮筒；四架喷气机剪影接近 | 轮廓读不出机型，只能靠大小和颜色区分 |
| 上色 | 主色 `#dfdec4`/`#91ada5`/`#858b7c`/`#c6c8a2`（`src/data/aircrafts.ts:36,65,94,123`），实测饱和度仅约 6%–30%、明度 52%–82%；强调色几乎不生效——`ShaderMaterials.ts:31` 只加 `accent*.035` | 违反 D8：主色须 S≥65%、L 75–95%，且**禁止继续以灰绿/灰黄为主** |
| 场景色 | 清屏 `#a6b6a6`、半球光 `#f5edd2`/`#526b61`、雾 `#a8b7a5`（`src/rendering/Renderer.ts:74,84-88`）；地形草色 `vec3(.16,.25,.12)`（`ShaderMaterials.ts:44`） | 整幅画面偏灰绿，把玩具感再次去饱和 |
| 细节密度 | 每个部件一次 `this.mesh(...)` + 单独 `aircraftMaterial(f.color)`（`ProceduralAircraft.ts:113-341`，材质在 `:118`） | 细节是“细杆+小方块”，无圆角/厚边光；材质数随部件线性增长，直接推高 draw call |
| 描边/光照 | 边光偏绿 `vec3(.68,.86,.78)`（`ShaderMaterials.ts:29`），亮度项 `(.52+light*.55)` 压暗（`:27`） | 边光不立体、物体发闷；Q 版需要的“厚边光+明快平涂”不存在 |
| UI 气质 | `src/style.css:1-21`：`--cream #e8e9d9`、`--muted #a0afa5`、`--mint #c8e5c1`、`--orange #ef8864`、背景 `#101e22`；标题 Georgia/宋体（`:226-227`）；全文件约 196 个色值几乎全是低饱和 | UI 是“沉稳文艺写实”，与“鲜艳活力玩具”和世界色板都不统一 |

结论：不是换贴图能解决的，**比例、轮廓、配色、光照、UI 五层要一起改**；Q 版最低要求是“把模型当玩具重做比例”，而不是给现有模型调色。

### 1.2 为什么时代混搭不可取
- **起点错位**：`AIRFRAMES` 第一架 Swift 是喷气机且 `unlockScore: 0`（`src/data/aircrafts.ts:57`），新玩家第一眼是“未来”；`docs/content/INITIAL_AIRFRAMES.md:22-257` 的四架定位也全部建立在喷气时代。
- **没有时代辨识物**：代码没有螺旋桨、双翼支柱、张线、浮筒、气囊、敞篷座舱等构型（`ProceduralAircraft.rebuild` 只按 `part.id/kind` 分支，`:113-341`）；敌方“精英空艇”只是 3.4 倍缩放的同款机身（`Renderer.createEnemy`，`src/rendering/Renderer.ts:363-370,440`），不是飞艇。
- **演进感无法表达**：四架机体共享同一套机身/机翼配方，没有“木布双翼 → 金属单翼 → 喷气”的可读跃迁，长线内容缺少天然章节。
- **数据与测试被索引锁死**：`tests/flight-dynamics.test.ts:33-45` 用 `AIRFRAMES` 下标断言倾角，`tests/simulation.test.ts:299-348` 对 `AIRFRAMES` 全量跑 5 分钟耐力——每加一架都要重调/重跑。

### 1.3 为什么必须把构型参数化
现有至少四处“按机型特判”：`ProceduralAircraft.ts:123`（`engines === 4` 改机身宽）、`World.ts:187-203`（按 `frame.engines` 造发动机）、`World.ts:204-226`（按 `gun`/`turret` 字符串决定挂点）、`World.ts:227`（`frame.id === "wasp_04"` 直接改锁定时间）。若保留特判，四时代 × 17 架会膨胀成几十个分支，且渲染与模拟耦合。目标是“构型=一份数据配方”（`era/wingCount/engineCount/propellerCount/isFloatplane/...`），渲染按配方组装，模拟只消费既有 `stats/parts` 语义（§3.5.2）。

## 2. 目标体验
一句话：**把“低饱和写实飞机”换成一盒会飞的彩色玩具，用轮廓、颜色、时代三种信息，让玩家 3 秒内读懂“我是谁、敌人是谁、我处在航空史的哪一章”。**

1. **时代可读**：任意一局/任意机库卡片，不看文字也能通过“双翼/三翼/单翼、螺旋桨数量、木布/金属、浮筒/气囊”判断时代，四时代截图的色温与轮廓词汇不同。
2. **角色可读**：同代内战斗机/重型战斗机/轰炸机/水上飞机剪影差异 ≥3 项（翼数、短舱数、机头形状、浮筒/船体、炮塔）。
3. **敌我可读**：冷色（青绿/天空蓝/奶油白）属于玩家，暖色（落日红/暖橙）属于敌人；低饱和与灰度截图下仍可区分（兼容色弱）。
4. **玩具感**：D8 比例、圆角、厚边光、平涂高饱和；像桌游模型，但不牺牲速度与空间感。
5. **性能与手感不退化**：进 D10 预算（标准档三角形 <150k、draw call <150、云 <25k），低画质减半；Q 版只改表现层，碰撞/命中/飞行包线与现有四架数值不变。

## 3. 目标设计
### 3.1 Q 版比例规范（严格遵循 D8）
所有系数都是**渲染系数**，只在 `src/rendering/` 使用，不进入 `World/stats`。

| 项 | 系数（D8 基线） | 应用方式 | 说明 |
| --- | --- | --- | --- |
| 机身长度 | **×0.85** | `visualLength = frame.length * 0.85` | 缩短纵向，让机翼/头部占比上升 |
| 翼展 | **×1.15** | `visualSpan = frame.wingspan * 1.15` | 与缩短机身联动，宽长比约升到 1.35 倍 |
| 座舱/头部 | **×1.3** | 座舱球、机头整流罩、飞行员头盔统一放大 | “大头”是第一识别点；敞篷座舱要看得见头 |
| 螺旋桨直径 | **×1.25** | `propDiameter = base * 1.25` | 只对 `propellerCount > 0`；推动画不贴图 |
| 起落架/浮筒 | **×1.35**（D8“放大”的细化值） | 轮径、轮距、浮筒长度/直径、支柱长度 | “玩具脚”必须夸张 |
| 圆角 | **×1.6**（细化） | `FuselageSection.cornerRadius *= 1.6`；翼尖加 `rounded` 两段倒角 | 保持 flat shading，圆角是几何倒角不是平滑法线 |
| 机翼厚度 | ×1.15（细化） | `wing thickness *= 1.15` | 低模下更“厚实玩具” |
| 整机视觉缩放 | `chibiScale: 0.9–1.15` | `frame.chibiScale`，大机取 0.9–1.0、小机 1.05–1.15 | 压缩大型机视觉体积，避免占满竖屏 |

派生比例目标（美术检查/断言用，基线可调）：视觉翼展/视觉机身长 ≥1.5（喷气 ≥1.35，双翼 ≥1.7）；座舱最大宽/视觉机身长 0.30–0.38；机轮半径 0.09–0.13×视觉长；浮筒长 0.50–0.65×视觉长；螺旋桨直径 0.28–0.42×视觉长。

```ts
// src/data/artConfig.ts（新增，示意）
export const CHIBI = { fuselage: 0.85, span: 1.15, head: 1.3, prop: 1.25, gear: 1.35, corner: 1.6, wingThickness: 1.15 } as const;
export const visualLength = (f: Airframe) => f.length * CHIBI.fuselage * f.chibiScale;
export const visualSpan = (f: Airframe) => f.wingspan * CHIBI.span * f.chibiScale;
```

**细节密度量化（标准档预算，低画质 ×0.6）：**

| 对象 | 可见部件（mesh） | 三角形 | draw call | 备注 |
| --- | ---: | ---: | ---: | --- |
| 玩家单发双翼机 | ≤18 | ≤1,400 | ≤8 | 支柱/张线合并后计 1–2 个 mesh |
| 玩家双发/四发 | ≤24 | ≤2,400 | ≤12 | 发动机短舱按材质合并 |
| 玩家飞艇 | ≤26 | ≤3,000 | ≤14 | 气囊 12×6 段、吊舱、尾翼、发动机吊舱 |
| 敌方普通飞机 | ≤8 | ≤700 | ≤4 | 与玩家同配方低配版 |
| 敌方精英/飞艇 | ≤18 | ≤2,600 | ≤8 | 同屏 1 艘（D3） |
| 地面单位 | ≤8 | ≤600 | ≤3 | 含移动防空车/列车 |
| 螺旋桨 | 2–3 叶 | 6 三/叶 | 合并进动力 mesh | 高画质可加 1 层半透明桨盘 |
| 张线 | 1 条 `LineSegments` | ≤12 段 | ≤1 | 不做粗圆柱，几乎零开销 |
| 徽章/编号贴饰 | ≤3 片 | 每片 2 三角形 | 合并 | 薄几何，无贴图 |

禁止项：球体分段 >(8,6)、圆柱分段 >8、任意平滑法线（玻璃除外）、每部件一份独立 `ShaderMaterial`（现状 `ProceduralAircraft.ts:118` 必须改共享材质，见 §3.5.4）。

### 3.2 鲜艳色板与色彩规则
**每架飞机严格 4 色 + 结构色例外：** 主色 A 约 60%（S≥65%、L 75–95%）、主色 B 约 30%（同约束）、强调色约 10%（S≥65%、L 55–75%）、中性色（深蓝/墨蓝 S≤50% 或近白 L≥95%，描边/金属件/座舱框，不承担主涂装；金属件允许 S≤25% 的灰蓝）；结构色（木、帆布、裸金属、轮胎，S 40–75%、L 35–90%、面积 ≤15%）不得成为机身主色，仍禁止灰绿/灰黄。所有颜色必须来自 `src/rendering/palette.ts` 的色板 token，禁止渲染代码写魔法 hex（06/07 直接引用同一 token）。

| 角色 | 名称 | Hex | HSL | 备注 |
| --- | --- | --- | --- | --- |
| 主色 | 奶油白 | `#FFF6E5` | H39 S100 L95 | 帆布/金属通用底色 |
| 主色 | 天空蓝 | `#8FD3FF` | H204 S100 L78 | 玩家主识别色 |
| 主色 | 薄荷蓝 | `#7FD0FF` | H202 S100 L75 | 天空蓝深一档，副面 |
| 主色 | 青绿 | `#8FF0DC` | H168 S76 L75 | 与能量色同族 |
| 主色 | 草绿 | `#C0F09A` | H93 S74 L77 | 二战迷彩的糖果版 |
| 主色 | 暖阳黄 | `#FFE58F` | H46 S100 L78 | 多作识别条/副面，不整机铺满 |
| 主色 | 樱花粉 | `#FF8FB1` | H342 S100 L78 | 可选皮肤彩蛋，不进默认 roster |
| 强调 | 珊瑚橙（UI 同款） | `#FF7A59` | H12 S100 L67 | 玩家强调 + UI 主行动；世界层仅小面积 |
| 强调 | 暖橙 | `#FF9A4D` | H26 S100 L65 | 玩家强调、暖光提示 |
| 敌方 | 落日红 | `#FF9C86` | H14 S100 L76 | **仅敌方**主色 |
| 敌方 | 樱桃红 | `#FF6B7A` | H354 S100 L71 | **仅敌方**强调 |
| 敌方 | 赭红 | `#E8674B` | H11 S77 L60 | **仅敌方**结构/条纹 |
| 敌方 | 骨白 | `#FFE9CC` | H38 S100 L90 | 敌方副色 |
| 中性 | 深海军蓝 / 墨蓝 | `#223A5F` / `#182B45` | H216 S47 L25 / H215 S48 L18 | 描边、机鼻、面板 |
| 中性 | 云白 / 石墨蓝 | `#FFFDF6` / `#4E657A` | H47 S100 L98 / H209 S22 L39 | 高光 / 金属件 |
| 结构 | 焦糖棕 / 旧帆布 / 银灰蓝 / 深青 | `#C98A4A` / `#F3E3C3` / `#A8C4E0` / `#19A08F` | S54 L54 / S67 L86 / S47 L77 / S73 L36 | 木 / 布 / 铝 / 内构描线 |
| 世界 | 草地 `#A6E36D`、沙地 `#F0D48A`、水面 `#5FD3E8`、道路 `#EAD6A6`、山体 `#8AE0B0`、天空 `#A9DFFF`；道路/铁路按时代：土路 `#EAD6A6`→泥泞 `#C9A46B`→沥青 `#8C99A6`+钢轨 `#4E657A`→混凝土 `#C7D2DA` | — | S≥50、L 60–90（道路/铁路为世界面中性例外，L 50–90） | 大色块允许比涂装深一档 |
| 云（07） | 云白 `#FFFDF8`、云影 `#C7E6FF` | — | S≥70、L≥85 | 边缘加 10% 暖阳黄 |
| UI | 珊瑚橙 `#FF7A59`、青绿 `#21CCB0`、奶油白 `#FFF6E5`、天空蓝 `#8FD3FF`、面板墨蓝 `#182B45`、警告红 `#FF4D5E` | — | — | 危险信息用警告红+形状 |

规则：60/30/10 以涂装面积检查；禁用灰绿/灰黄/土黄主色与纯黑大色块（用墨蓝）；同一架不出现两个暖色主色；**玩家不用樱桃红/警告红，敌方不用青绿/天空蓝**；UI 珊瑚橙只出现在有深色底板/描边的 UI 层并辅以形状（不单靠色相）；UI 正文对比度 ≥4.5:1、大标题 ≥3:1；色盲模拟下仍靠轮廓区分敌我。色彩管理：当前 sRGB+ACES（`Renderer.ts:71-73`）会压饱和，方案见 §3.3.1。

**UI 色彩迁移（`src/style.css:1-21` 变量直接替换）：**

| 旧变量 | 新值 | 语义 |
| --- | --- | --- |
| `--cream #e8e9d9` | `#FFF6E5` | 正文/标题奶油白 |
| `--muted #a0afa5` | `#A8C2D8` | 次级文字（冷灰蓝，保持中性） |
| `--mint #c8e5c1` | `#21CCB0` 填充 / `#8FF0DC` 高亮 | 生命、正反馈 |
| `--orange #ef8864` | `#FF7A59` | 出击/升级/危险提示 |
| `--line rgba(220,237,218,.16)` | `rgba(255,246,229,.20)` | 分隔线 |
| `background #101e22` | `#182B45` → `#223A5F` 渐变 | 面板/全屏底 |
| 按钮/摇杆底色 | 墨蓝 0.55–0.65 透明 + 奶油白 1.5px 描边 | “玩具塑料”质感 |

标题字体保留 Georgia/宋体作品牌识别，数值/HUD 改等宽数字；字号与字重不变（避免重排触控区）。能量条：正常青绿 `#21CCB0`→满值 暖阳黄 `#FFE58F`→加力消耗 橙红 `#FF7A59`（与 04 的 HUD 语义一致），低血改警告红 `#FF4D5E`，锁定/信息改天空蓝；HUD 结构与 `.hud-meter` 逻辑（`GameApp.ts:247`、`style.css:941-1004`）不变，只换色值。

### 3.3 光照、材质、描边与统一世界色
#### 3.3.1 场景光照与大气（`Renderer.ts:74,84-88`）
| 项 | 当前 | 目标 |
| --- | --- | --- |
| 清屏色 | `#a6b6a6` 灰绿 | 天空蓝白 `#BFE6FF`（后续可接天空渐变；雾色/清屏色落为 palette token 供 07 引用） |
| 半球光 | `#f5edd2`/`#526b61`，2.8 | 天空 `#FFF6E5` / 地面 `#A6E36D`，2.2–2.6 |
| 平行光 | `#fff1ca`，3 | 暖阳黄白 `#FFF3C4`，2.4–2.8 |
| 雾 | `#a8b7a5`，40–115 | 云影蓝白 `#CFEFFF`，55–140（与 07 衔接） |
| 色调映射 | ACESFilmic，exposure 1.25 | NeutralToneMapping，exposure 1.0–1.1（保饱和） |

#### 3.3.2 材质与描边（`ShaderMaterials.ts:7-36` `aircraftMaterial`）
- 亮度项 `(.52+light*.55)` → `(.70+light*.45)`；边光色 `vec3(.68,.86,.78)` → 奶油暖光 `vec3(1.0,.94,.78)`，fresnel 指数 3→2.2、强度 .24→.34（厚边光）。
- accent 从 `+0.035` 提升为真平涂：新增 uniform `accentColor`/`accentMask`，按 `vLocal` 生成机头环、翼尖条，让“10% 强调色”被看见。
- 损伤黑斑由灰绿改炭黑 `#2E3440`+余烬橙；热量保持橙红；高亮改青绿 `#8FF0DC`（与 D1 部件对接）。
- 玩具化材质参数（扩展 `docs/systems/06-procedural-3d.md:57-69` 的 `LowPolyMaterialParams`）：涂装金属 roughness 0.55 / metalness 0.2，木 0.8/0.0，帆布 0.9/0.0，玻璃 0.15/0.1；全部 flat shading、无贴图。
- 描边两档：标准档只用 shader 内 fresnel 边光（0 额外 draw call）；高画质对“玩家+精英/飞艇”（≤3 对象）加反向外壳（深海军蓝，宽 1.5–2.5% NDC），低画质关闭。
- 玩家机材质槽固定 ≤4：主色 A、主色 B、强调（可并进 A/B 顶点色区域）、共享金属+玻璃；禁止每部件独立材质。

#### 3.3.3 统一敌人/地面/云/水的色彩语言（与 03/06/07 接口）
| 层 | 主色 | 识别手段（不只靠颜色） | 接口 |
| --- | --- | --- | --- |
| 玩家机体 | 冷色（奶油白/天空蓝/青绿/草绿）+ 暖阳黄识别条 | 圆润大头、厚边光、金色描边 | 03 部件可视化 |
| 空中敌机 | 落日红+骨白、深海军蓝机鼻 | 深色前缘 + 暖色涂装 + 无金边 | 03/02 |
| 敌方大型机/飞艇 | 深海军蓝骨架 + 落日红气囊条纹 | 气囊分段、吊舱、炮塔 | 03/06 |
| 敌方地面 | 石墨蓝车体 + 暖沙黄标记 | 履带/轮式轮廓、沙尘粒子 | 06 路线 |
| 水面单位/浮筒 | 青蓝船体 + 奶油白甲板 | 船体/浮筒轮廓、白色尾迹 | 06 水面 |
| 云 | 云白+云影，边缘暖光 | 大块低模云簇 | 07 遮挡 |

### 3.4 四时代与内容矩阵（重点）
#### 3.4.1 时代定义（与 D8 表一致）
| id | 时代 | 年份 | 视觉关键词 | 推荐关卡名（06 地形） | 解锁说明 |
| --- | --- | --- | --- | --- | --- |
| `pioneer` | 萌芽期 | 1903–1914 | 帆布+木、双翼/三翼、敞篷、单发前置螺旋桨、大轮、飞艇、轻武器/无武器 | 黎明草甸 / 1909 飞行大会 | 默认时代（起始机在此） |
| `ww1` | 一战 | 1914–1918 | 帆布+金属机鼻、双翼/三翼、张线、浮筒水上飞机、大型飞艇、机头机枪 | 堑壕天空 / 索姆河上空 | 按机体 `unlockScore` 自然进入（§3.6.1） |
| `ww2` | 二战 | 1939–1945 | 铝蒙皮、单翼、3–4 叶变距桨、封闭座舱、双发重战、四发轰炸、浮筒/飞行艇、炮塔 | 铁翼海峡 / 北海护航 | 同上 |
| `jet` | 初代喷气 | 1945–1955 | 金属蒙皮、后掠单翼、喷口尾焰、双发/四发、雷达罩 | 翡翠海岸（现有） | 收尾时代，现有 4 架归此 |

> 1918–1939 间战期**不设独立时代**（已确认四时代）；其全金属单翼、浮筒竞速机以涂装/皮肤并入一战末与二战初，是否加第五时代见 §8。

#### 3.4.2 必选构型落在哪个时代（需求逐条对账）
| 需求构型 | 首次出现 | 代表玩家机体 | 说明 |
| --- | --- | --- | --- |
| 双翼机 | 萌芽期 | `sparrow_05` SPARROW–05 | 盒风筝式双翼，教学机 |
| 三翼机 | 萌芽期起支持 | `heron_09` HERON–09 | 萌芽期以敌机/皮肤覆盖三翼构型，一战 HERON 为可玩代表 |
| 单翼机 | 萌芽期/二战 | `dragonfly_06`、`falcon_13` | 早期低速竞速机 → 全金属单翼战斗机 |
| 大型轰炸机 | 二战 | `behemoth_17` BEHEMOTH–17 | 四发；一战 `condor_10` 双发中型过渡 |
| 水上飞机（浮筒） | 一战 | `pelican_11`；二战 `albatross_15` | 双浮筒+支柱+尾橇 |
| 飞行艇（船体） | 二战 | `stingray_16` STINGRAY–16 | 船体机身+翼下浮筒 |
| 重型战斗机（双发） | 二战 | `raptor_14` RAPTOR–14 | 双发短舱+重火力+后座炮手 |
| 大型飞艇 | 萌芽期/一战 | `moth_07`、`leviathan_12` | 气囊+吊舱+多炮塔 |
| 多翼多发大型机 | 一战 | 玩家重装流派/敌方大型机 | 双翼/三翼 + 2–4 发动机短舱 + 炮塔（自然叠装，08 §3.4.7） |
| 初代喷气 | 初代喷气 | Swift/Courier/Mastodon/Wasp | 现有 4 架，仅补默认字段 |

#### 3.4.3 玩家机体 roster（基线可调）
**萌芽期（3 架，起点）**

| id | 名称 | 定位 | 构型 flags | 极速/转向/生命 | unlockScore |
| --- | --- | --- | --- | --- | ---: |
| `sparrow_05` | SPARROW–05 盒风筝双翼机 | 新手/侦察 | `wingCount 2, engineCount 1, propellerCount 1, cockpitCount 1` | 5.6 / 240 / 85 | 0 |
| `dragonfly_06` | DRAGONFLY–06 单翼竞速机 | 高速侦察 | `wing 1, prop 1` | 7.8 / 250 / 60 | 250 |
| `moth_07` | MOTH–07 早期飞艇 | 空中平台 | `isAirship, engine 2, turret` | 3.2 / 70 / 260 | 700 |

**一战（5 架）**

| id | 名称 | 定位 | 构型 flags | 极速/转向/生命 | unlockScore |
| --- | --- | --- | --- | --- | ---: |
| `kestrel_08` | KESTREL–08 双翼战斗机 | 制空 | `wing 2, prop 1` | 9.6 / 250 / 105 | 1,100 |
| `heron_09` | HERON–09 三翼格斗机 | 近距缠斗 | `wingCount 3, prop 1` | 8.4 / 280 / 90 | 1,400 |
| `condor_10` | CONDOR–10 双发轰炸机 | 轰炸 | `wing 2, engine 2, prop 2, bombs` | 7.4 / 150 / 200 | 1,700 |
| `pelican_11` | PELICAN–11 浮筒水上飞机 | 水上多用途 | `wing 2, isFloatplane, prop 1` | 8.2 / 210 / 130 | 2,000 |
| `leviathan_12` | LEVIATHAN–12 大型飞艇 | 重型空中平台 | `isAirship, engine 4, turrets` | 2.9 / 55 / 380 | 2,600 |

**二战（5 架，构型覆盖最全）**

| id | 名称 | 定位 | 构型 flags | 极速/转向/生命 | unlockScore |
| --- | --- | --- | --- | --- | ---: |
| `falcon_13` | FALCON–13 单翼战斗机 | 制空 | `wing 1, prop 1` | 13.5 / 275 / 120 | 3,100 |
| `raptor_14` | RAPTOR–14 双发重型战斗机 | 重火力 | `wing 1, engine 2, prop 2, isHeavyFighter, tailGun` | 11.6 / 200 / 210 | 3,600 |
| `albatross_15` | ALBATROSS–15 浮筒水上飞机 | 海上巡逻 | `wing 1, isFloatplane, prop 1` | 10.2 / 205 / 150 | 4,200 |
| `stingray_16` | STINGRAY–16 飞行艇 | 远程海上平台 | `wing 1, isFlyingBoat, engine 2, prop 2` | 8.6 / 145 / 260 | 4,800 |
| `behemoth_17` | BEHEMOTH–17 四发大型轰炸机 | 大轰炸机 | `wing 1, engine 4, prop 4, isLargeBomber, nose/tail turrets` | 7.2 / 110 / 340 | 5,400 |

**初代喷气（现有 4 架，补默认字段 + 重排解锁分，见 §3.6.2）**

| id | 名称 | 定位 | 构型 flags | 极速/转向/生命 | unlockScore（新） |
| --- | --- | --- | --- | --- | ---: |
| `swift_01` | SWIFT–01 轻型截击机 | 喷气起点 | `wing 1, engine 1, propellerCount 0` | 13.5 / 285 / 100 | 6,000 |
| `courier_02` | COURIER–02 平衡攻击机 | 平衡 | `engine 2, prop 0` | 10.5 / 225 / 145 | 6,800 |
| `mastodon_03` | MASTODON–03 重型武装机 | 重装 | `engine 4, prop 0, turret` | 8.2 / 145 / 230 | 7,600 |
| `wasp_04` | WASP–04 轻量侦击机 | 轻量 | `engine 1, prop 0` | 15.5 / 305 / 75 | 8,600 |

> 解锁方式：全部为 `unlockScore` 单局积分阈值（机制同现版），`sparrow_05` 是唯一 `starter: true`。新机体 `mass/wingArea` 由规则生成后微调：`mass ≈ health × 18`、`wingArea ≈ wingspan² / 9`（基线可调），`FlightDynamics` 无需为新机体重写；参数区间：萌芽期极速 3–8 / 生命 60–260，一战 7–10（飞艇 2.9）/90–380，二战 8.6–13.5 / 120–340，喷气沿用现有。

> **完整分时代配置**：13–16 按萌芽期/一战/二战/初代喷气把机体、敌人/水面、武器、地面、升级、刷新各填一遍；本文件的 roster 是时代/外观层，完整字段与数值以 13–16 为准。
>
> **总机体数**：一期 17 架（本文件 §3.4.3）+ 二期候选 6 架（`atlas_18 / vulture_19 / tempest_20 / comet_21 / manta_22 / zephyr_23`，见 11/13–16）= 23 架。

#### 3.4.4 敌人、地面与水面 roster（按时代换皮，二期加专属 kind）
| 时代 | 空中普通 | 空中精英/Boss | 地面/水面 | 实现方式 |
| --- | --- | --- | --- | --- |
| 萌芽期 | 侦察双翼机（`scout` 皮）、双翼巡逻机（`hunter` 皮） | 早期飞艇（`elite` 气囊构造） | 补给马车（`resource` 皮）、弹药堆（`depot` 皮） | 复用现有 kind，渲染按时代换构型 |
| 一战 | 双翼战斗机（`hunter`）、双发重型轰炸机（`bomber`） | 大型飞艇（`elite` 气囊+多炮塔） | 防空卡车、装甲列车、补给卡车、巡逻艇 | 地面/水面 kind 以 06 定稿为准（`aa_truck`/`fuel_truck`/`armored_train`/`gunboat`）；`aa`/`emplacement` 按 D6 删除 |
| 二战 | 单翼战斗机（`hunter`）、四发轰炸机（`bomber` 四发构造） | 重型轰炸机/空中堡垒（`elite`） | 防空车、装甲列车、车队、护航舰（06） | `bomber` 切四发；精英切大型机 |
| 初代喷气 | 现有 `scout/hunter/bomber/escort/striker` | 现有 `elite` | 现有地面（D6 后改移动防空车/列车/舰艇） | 不变，仅统一新色板 |

敌人数据（`src/data/enemies.ts:1-15,16-204`）扩展 `era` + `visual` 配方字段（与 02 的 `spawnRole`/`slotCost` 同期扩展）；**空中 6 种敌人的行为与数值一期保持不变，地面单位按 06 改造为固定路线移动单位（`aa`/`emplacement` 从数据中删除）**，时代差异优先走视觉（一期），二期再加专属 kind 与数值，保证 D3 刷新上限、D2 部件衰减不用重做。大型机（四发轰炸机/飞艇）建议 `slotCost=2`（02 提供的字段）；**一期默认 1 不启用**，二期启用后同屏大型机受 8 个 slot 预算约束（02 §3.1）。

#### 3.4.5 时代化程序化几何方案
| 部件 | 萌芽期 | 一战 | 二战 | 初代喷气 |
| --- | --- | --- | --- | --- |
| 机身蒙皮 | 帆布+外露木梁（细梁+薄板） | 帆布+金属机鼻/发动机罩 | 铝蒙皮（分段截面+深色铆钉线条） | 现有截面机身 |
| 翼组 | 双翼（上下翼+I 支柱） | 双翼/三翼（阶梯+张线） | 单翼（翼根短舱整流） | 单翼后掠 |
| 动力 | 前置单发螺旋桨、木质 2 叶 | 2–3 叶螺旋桨、星型/直列发动机罩 | 3–4 叶变距桨、双发/四发短舱 | 喷口+尾焰（现有） |
| 座舱 | 敞篷+飞行员头部（×1.3） | 敞篷+风挡/围栏 | 封闭座舱盖（驾驶员/炮手多座） | 封闭座舱+雷达罩 |
| 起落/浮筒 | 大轮+尾橇 | 大轮+双浮筒 | 大轮/前三点+浮筒/船体 | 现有 |
| 标志件 | 飞艇气囊/吊舱 | 机头机枪、张线、气囊 | 机鼻/尾/球型炮塔 | 导弹/炮塔/雷达 |
| 材质色 | 旧帆布+焦糖木+天空蓝 | 天空蓝/奶油白+金属机鼻 | 草绿/青绿迷彩+骨白 | 天空蓝+薄荷蓝，奶油白中性，珊瑚橙点缀 |

新增渲染构造器（每个函数只吃配方、不写死机型）：

```ts
buildWingSet(recipe: { count: 1|2|3; span; chord; stagger; gap; dihedral }): THREE.Group
buildStrutsAndWires(gap: number, bays: number): { group; wireMesh }   // 张线用 LineSegments
buildPropeller(diameter: number, blades: 2|3|4): { group; spin }      // update 时 rotation.z += 40*dt
buildFloats(length: number, count: 2): THREE.Group                    // 浮筒+支柱+尾橇
buildFlyingBoatHull(length: number): THREE.Group                      // 船体+断阶+翼下浮筒
buildAirship(envelope: { length; diameter; fins: 4 }, gondola): THREE.Group
buildNacelle(kind: "radial"|"inline"|"jet", index): THREE.Group       // 单发/双发/四发通用
buildCockpit(kind: "open"|"canopy", seats: 1|2): THREE.Group
buildTurrets(recipe: { nose?: boolean; tail?: boolean; ball?: boolean }): THREE.Group
```

#### 3.4.6 时代化表现规则
1. **木布→金属的材质跃迁**：萌芽期/一战用旧帆布（S67 L86）+木色（S54 L54）+天空蓝；二战起改铝蒙皮涂装+骨白；喷气沿用金属但加彩色编队条。
2. **螺旋桨可读**：`propellerCount>0` 必须有可见桨叶与旋转动画，转速 `22 + speed*4` rad/s（低模看“闪”不看真转速），高画质叠半透明桨盘。
3. **敞篷座舱**：早期机必须看得见放大的飞行员头部（头盔暖阳黄/骨白）——“Q 版大头”在游戏里的落点。
4. **大型机不占满屏**：`chibiScale` 压缩 + 战斗相机按 `visualSpan` 做 ≤1.15× 轻微拉远（仅视觉，不改输入映射；巡航距离基线 46 由 10 §3.3 定义，利维坦大型机最多再拉远 15%）。
5. **飞艇专属**：气囊 12×6 段+4 片尾翼+吊舱+发动机吊舱；气囊被击毁按 D1 部件做换气/下坠表现（二期）。

#### 3.4.7 利维坦流：自然涌现的重装流派（不做专属改造链）

- **不是专属升级链**：不新增“利维坦改造”条目，也不要求玩家点一条线性树。玩家在局内持续选择**机翼/发动机/武器/炮塔**类部件，部件数量、翼展、质量、发动机数与火力自然增长，就会趋近“多翼多发的利维坦形态”。这是构筑流派，不是独立系统。
- **任何时代/任何机体都可走**：萌芽期的双翼机、一战的轰炸机、二战的四发重战、喷气机都可以通过叠装变成同类“重型平台”；只是**收益与代价不同**。
- **适配度差异**（由 11 的 `Airframe.refit` 字段表达）：
  - 大而稳的机体（Mastodon、重型轰炸机）——挂点多、结构余量大、基础稳定性好：叠翼/叠发动机的收益高、质量与惯性惩罚相对低，是“适合重装”的机体。
  - 轻而快的机体（Wasp、Swift）——挂点少、翼载低、滚转惯量小：叠同样的部件会迅速变重、变钝、投弹包线大幅收紧，收益低、代价高，只适合小规模混装。
  - 不是硬限制：玩家仍可在轻机上堆出“小利维坦”，只是性能回报更差，形成自然的风险/收益选择。
- **数值来源**：03 的 `flightEnvelope`（质量、翼展、惯量、翼载、推力）与 09 的 `response→投弹坡度` 已经会自然产生“越叠越迟缓”的效果；11 的 `refit` 字段只用于**显式调参、UI 提示与平衡**，不新增独立规则。
- **一战大型机内容**：多翼/多发大型飞机与飞艇作为**敌方大型机/精英/视觉参考**存在（复用 `bomber`/`elite` 行为 + `era+visual` 配方）；玩家通过叠装达到类似轮廓时，由 `AircraftBuilder` 的 `wingDeck`/多发动机短舱/炮塔视觉表达，不需要专属升级 id。
- **一期/二期**：一期先让 `AircraftBuilder`/`Part` 支持多层翼与多发动机的视觉与命中区（03）；二期再调 `refit` 适配度数值与 UI 提示。不做专属链，工作量主要在视觉与调参，而不是新系统。

### 3.5 数据结构与程序化改造### 3.5 数据结构与程序化改造
#### 3.5.1 `Airframe` 扩展（D8 字段名为准）
```ts
type EraId = "pioneer" | "ww1" | "ww2" | "jet";
type WingCount = 1 | 2 | 3;
type SkinKind = "wood_canvas" | "painted_metal" | "bare_metal";
interface Airframe {
  // ...现有字段（src/data/aircrafts.ts:1-29）
  engineCount: number;          // 替代现有 engines（语义相同，统一命名）
  starter: boolean;             // 唯一起始机（新档默认装备）
  era: EraId;
  wingCount: WingCount;
  propellerCount: number;       // 0 = 喷气
  cockpitCount: 1 | 2;
  isFloatplane: boolean;        // 需求口语中的 floats
  isFlyingBoat: boolean;        // 需求口语中的 flyingBoat
  isAirship: boolean;           // 需求口语中的 airship
  isHeavyFighter: boolean;
  isLargeBomber: boolean;
  chibiScale: number;           // 0.9–1.15，仅视觉
  skin: SkinKind;               // 仅视觉
  palette: { main: string; secondary: string; accent: string; neutral: string };
  bombingBankLimitDeg?: number; // 可选手调；缺省由 09 从 flightEnvelope.response 推导
}
```

- 命名口径：需求口语里的 `floats/flyingBoat/airship/heavyFighter/largeBomber` 统一采用 D8 的 `is*` 前缀字段，避免跨文档两套名字。
- 旧机型迁移：`era:"jet"`、`wingCount:1`、`propellerCount:0`、`cockpitCount:1`、四个 `is*` 全 false、`chibiScale:1`、`skin:"painted_metal"`，`engines` 改名 `engineCount`；渲染与 `World` 只认 `engineCount`（影响 `ProceduralAircraft.ts:123`、`World.ts:187-203`）。旧机型补默认值后行为与现在完全一致。
- 投弹包线无需逐架手填：09 用 `flightEnvelope.response`（质量/翼展/推力/惯性/损伤）推导每架机的投弹坡度上限；新机型只要提供 `mass/span/thrust/wingArea` 即自动获得合理值，`bombingBankLimitDeg` 仅在个别机体需要手调时使用。
- 顺带数据化两处特判：`World.ts:227` 的 `wasp_04` 改 `lockTimeMod` 字段；`World.ts:204-221` 的 `gun` 分支改 `mounts: ("nose"|"wing")[]`（可与二期一起做）。

#### 3.5.2 哪些进模拟、哪些只进视觉（硬边界）
| 字段 | 归属 | 规则 |
| --- | --- | --- |
| `length/wingspan/footprint/hardpoints/health/maxSpeed/.../mass/wingArea` | **stats** | 现有语义不动；命中半径、部件尺寸、飞行包线全按它算 |
| `era` | 数据/存档/UI | 不参与物理；决定机库分组、关卡主题、视觉配方 |
| `engineCount` | **stats（部件生成）** | 与现有 `engines` 等价（`World.ts:187-203` 造发动机部件、推力偏置） |
| `wingCount/propellerCount/cockpitCount/isFloatplane/isFlyingBoat/isAirship/isHeavyFighter/isLargeBomber/chibiScale/skin/palette` | **仅视觉** | 只在 `src/rendering/` 读取，不写回 `World`，不改变 `Part.radius`（D1 命中判定）与 `player.radius` |
| `bombingBankLimitDeg?` | **投弹包线（可选）** | 缺省不填，由 09 从 `flightEnvelope.response` 推导；填了则作为该机的手调覆盖值，仍受 maxBank 与损伤收紧 |
| D8 比例系数（0.85/1.15/1.3/1.25/1.35） | **仅视觉常量** | 放 `artConfig.ts`，禁止在 `World`/`FlightDynamics` 使用 |

水面接口归 06（`isWater`/`surfaceHeight`）：08 负责浮筒/飞行艇构型与贴水/滑行表现，完整起降玩法按 06 定稿分期，**不引入新的坠毁规则**（是否把 `isFloatplane` 升为模拟字段见 §8）。

#### 3.5.3 渲染层模块拆分
当前 `ProceduralAircraft.ts` 402 行、`Renderer.createEnemy` 106 行（`Renderer.ts:339-444`），直接加时代构型会变千行文件。建议：

```text
src/rendering/
  AircraftBuilder.ts   // 玩家：按 Airframe 配方组装（替代 ProceduralAircraft.rebuild 大 switch）
  EnemyBuilder.ts      // 敌人：从 Renderer.createEnemy 抽出 + era 配方
  parts/fuselage.ts     parts/wingSet.ts   // 机身（圆角截面）/ 单双三翼、支柱、张线
  parts/propulsion.ts   parts/hull.ts      // 螺旋桨、短舱、喷口 / 浮筒、飞行艇船体
  parts/airship.ts      parts/details.ts   // 气囊、吊舱、尾翼 / 座舱、炮塔、起落架、徽章
  palette.ts           // 色板常量 + 材质缓存（替代每部件 new aircraftMaterial）
```

`ProceduralAircraft` 保留“玩家实例+部件状态+动画”职责（`ProceduralAircraft.ts:74-402`），几何组装委托 `AircraftBuilder`；`update`（`:345-389`）新增螺旋桨旋转、飞艇浮动、张线不受损等表现。

#### 3.5.4 材质与 draw call 策略
- 现状每个部件一份 `aircraftMaterial`（`ProceduralAircraft.ts:118`），四架机体 6–16 个部件 + trim/metal/glass → 单机 10–20 个材质。改为**全局材质缓存**（参考 `Renderer.ts:64,342-346`）：主色 A/B/强调/金属/玻璃/木/帆布共 7 份共享，按“颜色组合”缓存（≤16 份）。
- 同材质小件（支柱、张线锚点、炮管、轮毂）在构建阶段 `mergeGeometries` 合并；张线单独 1 个 `LineSegments`；螺旋桨/轮子等需旋转件单独 mesh（≤4 个）。
- 预算见 §3.1；`QUALITIES`（`src/data/config.ts:21-32`）新增 `detail: "full" | "reduced"` 控制支柱数量/桨盘/描边外壳，不新增画质档。

### 3.6 解锁、机库分组与存档（D9）
#### 3.6.1 时代 = 内容分组（推荐软解锁）
D9 要求“现有解锁与积分保留，`unlockScore` 规则继续生效”。若做“时代硬门槛”，现有 4 架喷气机的分数阈值会被时代顺序压过，与 D9 冲突。推荐：每架机体仍由 `unlockScore` 唯一决定解锁（机制不变）；`unlockedEras` 由“至少一架该时代机体已解锁”派生，写入存档供 UI/二期时代关卡使用，**不构成硬门槛**；机库 UI 按时代分组，未解锁时代显示剪影与“下一架机体解锁分”，由于阈值单调递增，新玩家顺序天然是 萌芽期→一战→二战→喷气。备选硬门槛见 §8。

#### 3.6.2 现有 4 架喷气机的解锁分重排
为让“喷气是最后一章”，起始机改为 `sparrow_05`，四架喷气机 `unlockScore` 从 0/500/2,000/4,000 重排为 6,000/6,800/7,600/8,600（§3.4.3）。这是**数值重调，不是机制改变**：v1 存档的 `unlocked[]` 完整保留（迁移见下），老玩家已获得机体不丢；新玩家按时代顺序解锁。此点需评审确认（§8）。

#### 3.6.3 存档 v2 与迁移（`src/services/Save.ts:4-106`）
```ts
interface SaveDataV2 {
  version: 2;
  equipped: string;
  unlocked: string[];
  unlockedEras: EraId[];   // D9 可选字段：派生后写入，读取时缺失则重算
  bestScore: number; bestTime: number; currency: number; totalXp: number;
  sorties: number; quality: Quality; sound: boolean; vibration: boolean;
}
const SAVE_SLOT = "knight-on-air.v1"; // 保留槽位键名，避免老档丢失；版本以内部 version 为准
```

迁移算法（`SaveStore` 构造函数，替换现有 `Save.ts:37-73`）：

1. 读 `SAVE_SLOT`；JSON 解析失败或非对象 → 全新默认档（starter=`sparrow_05`，`unlocked=[sparrow_05]`）。
2. `saved.version` 为 1 或 2 均接受；其余按 v1 宽松迁移（现有 `Save.ts:44` 的 `!== 1` 直接丢弃要改）。
3. 数值字段沿用现有清洗（`typeof number && isFinite && >=0`，`Save.ts:46-55`）。
4. 重算 `unlocked`：`AIRFRAMES.filter(f => saved.unlocked.includes(f.id) || f.unlockScore <= bestScore)`；**已存解锁与分数解锁是“或”关系**，保证 v1 已解锁的喷气机不丢。
5. `equipped`：在 `unlocked` 中则保留，否则回落到 `starter: true` 的机体（即按时代排序后的 `AIRFRAMES[0]`，与 `airframeById` 回落语义一致；新档不再自动解锁 `swift_01`）。
6. `unlockedEras`：由重算后的 `unlocked` 派生，忽略存档旧值（防手改/漂移）；迁移后 `persist()` 写回 `version: 2`；异常仍走现有 `available=false` 容错（`Save.ts:70-72,74-80`）。
7. `record()`（`Save.ts:89-102`）继续按 `f.unlockScore <= bestScore && !unlocked.includes` 追加解锁并同步派生 `unlockedEras`；结算只写最高分/最长存活/金币/解锁（D9），不写局内部件与加力状态。

#### 3.6.4 机库时代分组 UI（接口 07）
- 装备页（`docs/systems/07-meta-ui.md:127-185`）顶部加“时代时间轴”横条：萌芽期/一战/二战/喷气四格，当前时代高亮、已解锁时代显示进度 `x/y`、未解锁显示下一架机体名称与分数。
- 主界面摘要卡与出击页显示当前机体时代徽标（色块+年份+规格图标），不新增页面、不改底部五栏导航；战斗 HUD 左上角沿用 `GameApp.ts:247` 的 `.battle-clock .eyebrow`（现为“翡翠海岸”）改为“时代 · 关卡名”；结算页（`GameApp.ts:399-404`）解锁横幅加时代前缀。
- 机库配色用新 UI 色板（§3.2）；锁定卡片用深海军蓝+20% 奶油白剪影。

#### 3.6.5 分期建议
- **一期（风格先行）**：Q 版比例/色板/材质/描边/场景光照 + UI 换色 + 现有 4 架喷气机补字段与重上色 + 每时代 1 架可玩机体（`sparrow_05`/`kestrel_08`/`falcon_13`/`swift_01` 作四时代代表）+ 存档 v2，时代线“看得见”。
- **二期（内容扩展）**：补齐 §3.4.3 全部 17 架、时代敌人/地面/水面 roster、时代主题关卡、平衡与解锁分微调；`isFloatplane` 是否升为模拟字段随 06 水面起降定稿。

## 4. 改动清单（文件级）
| 文件 | 改动 | 风险/依赖 |
| --- | --- | --- |
| `src/data/aircrafts.ts:1-149` | `Airframe` 加 §3.5.1 字段；`engines→engineCount`；17 架 roster（按时代排序，首架即 starter）；四架喷气机换色板、解锁分与 `unlockText`；新增 `starter` | 直接影响存档/测试，需与 §3.6 同步 |
| `src/data/enemies.ts:1-204` | `era`+`visual` 配方；`aa/emplacement` 按 D6 从 `ENEMIES` 删除（不保留旧数据；旧存档不引用敌人 kind） | 与 06/03 接口 |
| `src/data/artConfig.ts` / `src/rendering/palette.ts`（新增） | `CHIBI` 系数、预算、相机视觉参数；色板 token（供 03/06/07 引用） | 纯数据，先落地 |
| `src/data/eras.ts`（新增） | 四时代元数据（名称/年份/关卡名/顺序/解锁提示） | 与 06/07 接口 |
| `src/rendering/ProceduralAircraft.ts:74-402` | 抽出 `AircraftBuilder`；改造 `rebuild` 大 switch；共享材质；新增螺旋桨/飞艇/浮筒动画 | 核心重构 |
| `src/rendering/AircraftBuilder.ts` + `parts/*`（新增） | §3.4.5 构造器：单/双/三翼、支柱、张线、浮筒、船体、气囊、座舱、炮塔、起落架 | 依赖 artConfig |
| `src/rendering/EnemyBuilder.ts`（新增） | 从 `Renderer.ts:339-444` 抽出；时代换皮；地面/水面单位 | 与 03 部件视觉 |
| `src/rendering/Renderer.ts:74,84-88` | 清屏/光照/雾/色调映射换色板；敌人改 `EnemyBuilder`；阴影/尾迹配色；大机相机轻拉远 | 全局观感变化，需截图回归 |
| `src/rendering/ShaderMaterials.ts:7-71` | 亮部/边光/强调/损伤/高亮配色；地形/云改鲜艳色板；材质参数扩展 | 影响全部现有画面 |
| `src/style.css:1-21` 及 HUD/标题/按钮段落 | UI 色板与描边/圆角迁移；能量/低血/锁定换色 | 不重排触控布局 |
| `src/app/GameApp.ts:247,385-404` | HUD/结算/解锁横幅显示时代与关卡名 | 依赖存档/eras |
| `src/services/Save.ts:4-106` | `SaveDataV2`、迁移、`unlockedEras`、`record` 派生、槽位常量 | 必须配迁移测试 |
| `src/data/config.ts:1-32` | `RULES.camera` 不动；新增 `ART_BUDGET`/`visual` 常量；`QUALITIES` 加 `detail` | 与 D10 |
| `src/simulation/World.ts:163-227` | `frame.engines→engineCount`；`wasp_04`/`gun` 特判数据化（可二期） | 行为必须与现状等价 |
| `tests/simulation.test.ts`、`tests/flight-dynamics.test.ts` | 见 §7.1 | 必须与实现同批改 |
| `docs/systems/06-procedural-3d.md`、`docs/content/INITIAL_AIRFRAMES.md`、`docs/content/INITIAL_ENEMIES.md`、`docs/GAME_DESIGN.md`、`docs/systems/07-meta-ui.md` | 实施完成后再合并（00-overview §9）；本轮**不改** | 文档债 |

## 5. 实现任务拆分
| # | 任务 | 产出 | 依赖 | 期 |
| --- | --- | --- | --- | --- |
| T1 | 美术规范与数据契约 | `artConfig.ts`（色板/系数/预算）、`eras.ts`、`Airframe` 新字段、roster 数据（可先填四时代代表） | 无 | 一期 |
| T2 | Q 版渲染基座 | 比例系数接入、材质共享与容器改造、边光/强调/描边、光照/雾/色调映射、UI 换色 | T1 | 一期 |
| T3 | 程序化构型 | 单/双/三翼、支柱/张线、螺旋桨、浮筒/飞行艇、飞艇气囊、敞篷/封闭座舱、双/四发短舱、炮塔、起落架 | T1、T2 | 一期做双翼+螺旋桨+敞篷最小集，飞艇/浮筒构造器同批交付骨架、二期接入 roster |
| T4 | 玩家机库/时代分组 UI | 装备页时代时间轴、摘要时代徽标、锁定剪影、结算时代横幅 | T1、07 | 一期 |
| T5 | 敌人/地面/云统一 | `EnemyBuilder`+时代换皮；地面/水面配色与 D6 路线单位；云按 07 色板 | T3、06/07 | 一期敌人换皮，二期专属 kind |
| T6 | 解锁与存档 v2 | `SaveDataV2`+迁移+`unlockedEras`+解锁分重排+测试 | T1、T4 | 一期 |
| T7 | 内容扩充与平衡 | 17 架完整 roster、时代关卡、敌人/地面 roster、参数调优、截图回归 | T2–T6 | 二期 |

硬约束：**T1 先冻结字段与色板**（否则渲染/UI 并行会反复改定义）；T2 与 T3 可并行（T3 面向 T1 配方）；T4/T6 可在 T2 期间并行；T5 必须等 06/07 接口定稿（地形高度、云层渲染顺序）。

## 6. 验收标准
### 6.1 自动化（数据/渲染可断言）
| 项 | 断言（示意） |
| --- | --- |
| 时代 roster 完整 | 每时代 ≥3 架；`pioneer` 恰有 1 架 `starter`；四时代 id 唯一且有序 |
| 必填 flags | 每架 `era/wingCount/engineCount/propellerCount/cockpitCount/chibiScale/palette` 存在且合法；`wingCount∈{1,2,3}`、`propellerCount≥0`、`engineCount≥1` |
| 构型覆盖 | `AIRFRAMES` 中同时存在 `isLargeBomber`、`isFloatplane`、`isFlyingBoat`、`isHeavyFighter`、`isAirship`、`wingCount===3` 的机体 |
| 色板规则 | 每架 `palette.main/secondary` 的 S≥65、L∈[75,95]；`accent` S≥65、L∈[55,75]；恰 2 主色+1 强调+1 中性；全 roster 无灰绿/灰黄主色（HSL 区间扫描） |
| 比例系数 | `visualSpan/visualLength ∈ [1.35,2.2]`；座舱/螺旋桨/浮筒比例落在 §3.1 目标区间（几何包围盒断言） |
| 预算 | 顶点统计：普通玩家机 ≤2,400、飞艇 ≤3,000、敌机 ≤1,200 三角形；`renderer.info.render.calls` 标准档 <150（D10） |
| 存档迁移 | v1 档已解锁/最高分/金币/画质/音效全部保留；`unlockedEras` 正确派生；v2 往返幂等；损坏 JSON/未知 id/负数不崩 |
| 时代分组 | `unlockedEras` 由 `unlocked` 派生；机库数据每时代卡片数正确；未解锁只显示剪影 |

### 6.2 真机/截图（视觉验收）
1. **四时代对比图**：同一机位（机库展示+战斗俯视）各截一张，共 8 张；相邻时代在“翼数/螺旋桨/材质/色温”至少 2 项可辨。
2. **含大机对比图**：`behemoth_17`（四发轰炸）、`stingray_16`（飞行艇）、`raptor_14`（双发重战）、`moth_07`（飞艇）各一张，检查 360×640 竖屏下不占满/不遮挡 HUD。
3. **敌我可读**：截图降饱和 30% 与灰度化后，仍能靠轮廓区分玩家/敌机。
4. **3 秒盲测**：5 名未参与开发者看 8 张随机截图，时代指认正确率 ≥80%、敌我 ≥95%。
5. **真机核查与回归**（标准/低画质各一台中端机）：无穿模/浮空；螺旋桨转向正确；张线不抖动；浮筒/飞艇不穿地；云挡敌机不挡玩家（07）；UI 对比度与安全区正常；标准档 60 FPS 目标、低端 ≥30 FPS（D10）；四架现有喷气机在新色板/新比例下部件脱落、受损变黑、尾焰颜色仍正确（与 03 接口）。

## 7. 测试与兼容
### 7.1 受影响的现有测试（必须同批修改）
| 测试 | 现状 | 需要的修改 |
| --- | --- | --- |
| `tests/simulation.test.ts:258-295` 存档 | 断言默认装备 `swift_01`（`:279`）、`equip("mastodon_03")` 初始 false（`:267`）、2,100 分后 true（`:274`） | 默认装备改 `sparrow_05`；Mastodon 阈值改 7,600 后需把分数提到阈值以上；新增 v1→v2 迁移用例（保留旧解锁、派生 `unlockedEras`、坏档回落 starter） |
| `tests/simulation.test.ts:299-348` 耐力 | `it.each(AIRFRAMES)` 全量跑 5 分钟 | 改代表性集合（现有 4 架+每时代 1 架，约 8 架）或按时代分组，避免 CI 时长随 roster 线性膨胀 |
| `tests/simulation.test.ts:256` | `AIRFRAMES[0].health === 100` | 用 `airframeById("swift_01").health` 替代下标 |
| `tests/flight-dynamics.test.ts:33-45` 倾角 | 依赖 `AIRFRAMES` 下标（0=Swift…3=Wasp） | 改 `airframeById(...)` 取基准；四架既有包线作“手感回归基线”，新机体不参与该断言直到平衡期 |
| `tests/flight-dynamics.test.ts:93-112` 敌人敏捷 | `ENEMIES[kind].turnRate < AIRFRAMES[0].turnRate/2` | 改为对 `swift_01` 取基准；新敌人仅做“存在且有限”断言 |
| 全仓编译 | `engines` 字段改名 | 同步改 `World.ts:187-203`、`ProceduralAircraft.ts:123`，`npm run check` 必须过（本轮不执行） |

### 7.2 新增测试建议
- `art.test.ts`（含 era-grouping）：色板规则（HSL）、比例系数、时代 roster 完整性、构型覆盖、`unlockedEras` 派生、机库分组顺序、预算三角形统计。
- `save-migration.test.ts`：v1 各形态（正常/缺字段/未知 id/重复/负数/损坏 JSON）→ v2；v2 幂等。
- 渲染冒烟：用 Three 构建每个 `AircraftBuilder` 配方，断言顶点数/材质数/draw 预估在预算内且不抛错（模拟层仍不依赖 Three，仅测试渲染构建器）。

### 7.3 性能与兼容
- 预算对齐 D10：标准档总三角形 <150k、draw call <150、云 <25k；新增部件先查 §3.1 单机预算表。
- `QUALITIES`（`src/data/config.ts:21-32`）是唯一画质入口：新增 `detail` 只接这里；低画质关描边外壳、桨盘、部分支柱。
- 不新增外部贴图/字体/模型；保持“程序化+无贴图”（`docs/GAME_DESIGN.md:437-450`）。
- 色调映射切换（ACES→Neutral）是**全局观感变化**，会同时影响地形/云/UI 场景，必须在 T2 一次改完并做截图回归，不允许按屏幕分别换。
- 存档槽位键保留 `knight-on-air.v1`，只升级内部 `version`；若未来改键名，必须双读新旧键并写回新键（视作独立迁移项）。
- 继续 Three.js WebGLRenderer（r181），不新增后处理链；描边外壳额外 draw call 仅高画质、仅 ≤3 对象。

### 7.4 与 03 / 06 / 07 的接口
- **03（部件）**：新增部件视觉走 D1 的 `visual.kind`，渲染层只读 `Part` 状态；Q 版部件配色继承机体 `palette`；浮筒/气囊/炮塔作为可损坏部件的视觉挂点（`PartRole` 已含 `float/turret`）。
- **06（地面/地形）**：地面单位按时代换皮但保持“固定路线”；06 提供 `isWater`/`surfaceHeight`，08 的浮筒/飞行艇据此做贴水/滑行表现；世界色板（草地/沙地/水面/道路/铁路/桥梁/路侧设施的时代材质）由本文 `palette.ts` 提供，地形高度与道路逻辑仍归 06。
- **07（云）**：云色板与雾/清屏 token 由本文（`palette.ts`）提供；云簇形态的圆润度按本文“圆角/大块”规范由 07 实现，云遮挡“挡敌机不挡玩家”的渲染顺序不变，玩家覆盖层保持同样的边光/描边参数。
- **02/04/05（刷新/油门/告警）**：敌人换皮不改变 `kind` 行为与告警事件，精英飞艇仍是 `elite`；04 加力色与 05 告警色映射到本文 UI token（橙红=珊瑚橙、金=暖阳黄），以 `palette.ts` 为唯一来源。
- **09（投弹包线）**：新机体的投弹坡度由 `flightEnvelope.response` 自动推导（越重/越大/推力越低 → 投弹坡度越小）；利维坦流叠装后的重型平台会自动收紧投弹坡度；08 只在需要手调时提供可选 `bombingBankLimitDeg`，不复制 09 的公式。
- **10（高度/镜头）**：大型机/利维坦的相机拉远沿用 `visualSpan` 规则，基线距离 46、最多再拉远 15%；高空/轰炸镜头参数不因机体变大而改变。
- **01（升级池）**：不新增利维坦专属链；01 只需保证通用机翼/发动机/武器部件可以按挂点持续叠加，并满足合法池与 `conflicts/max`；适配度字段见 11。
- **11/12（内容配置）**：11 定义机体 schema 与 `refit` 适配度；12 定义敌人/武器 schema 与新增条目；08 只负责时代外观与 roster。
- **13–16（分时代完整配置）**：每个时代各一份，含该时代机体/敌人/武器/地面/升级/刷新的完整取值；08 的 roster 与它们冲突时，以 13–16 的数值表为准。

## 8. 待确认与备选
| # | 决策点 | 推荐 | 备选与影响 |
| --- | --- | --- | --- |
| 1 | 时代是否用于单局推进 | **一期只做机库分组+关卡时代主题**；二期做时代远征/关卡链 | 单局内跨时代推进（打完一战刷二战）会改 5–12 分钟短局结构与 D3 刷新导演，成本高，暂不做 |
| 2 | 四架喷气机 `unlockScore` 从 0/500/2000/4000 重排到 6000–8600 | **重排**（否则喷气机会出现在起始机库，违背时代线） | 保留旧阈值：机制完全不变，但 Swift 永远 0 分解锁，等于喷气混入起点，需接受“时代线只是展示” |
| 3 | 时代硬门槛 vs 软分组 | **软分组**（§3.6.1），完全遵守“unlockScore 规则继续生效” | 硬门槛体验更清晰，但要给 v1 老玩家豁免、重排全部阈值，并与 D9“积分规则继续生效”口径协商 |
| 4 | 是否保留写实素材作“高画质 DLC” | **不保留**（两套模型/材质维护成本高，且与 D8 冲突） | 保留“写实皮肤”可选包：需额外美术预算与风格一致性风险 |
| 5 | 命名是否继续现有命名法 | **继续**“英文短词–NN”（SPARROW–05、KESTREL–08…），与 Swift/Courier 同构 | 时代前缀法（如 W1-KESTREL）：辨识更强但破坏现有品牌 |
| 6 | 1918–1939 间战期是否第五时代 | **不做**（已确认四时代），用涂装/皮肤表达 | 加第五时代：内容量与 17 架 roster 再涨，测试矩阵扩大 |
| 7 | 玩家飞艇是否保留 | **保留**（D8 要求），定位“低机动高血量空中平台”，用 `chibiScale` 与专用相机距离控观感 | 降级为 NPC/Boss：更好平衡，但违背 D8 的飞艇条目 |
| 8 | 翼数是否影响 stats | **一期纯视觉** | 让 `wingCount` 参与升力/阻力：更真实的时代差异，但需重调四架基线手感与测试，二期讨论 |
| 9 | 色调映射切换是否批准 | **Neutral+exposure 1.05**（保饱和） | 保留 ACES+shader 饱和度补偿：改动小，但高光仍会灰化，鲜艳度打折 |
| 10 | 现有四架喷气机是否一期就换新色板/新比例 | **一期就换**（否则“Q 版”只对新机生效，风格割裂） | 二期再换：一期截图出现写实与 Q 版混排，评审易误判 |
| 11 | 水面起降是否进玩法 | **由 06/D6 的 `isWater`/`surfaceHeight` 接口定义，08 一期先给构型与贴水/滑行表现，完整起降二期** | 06 已与本文对齐“一期贴水/滑行、二期起降玩法”；玩法化会触及 06 高度场与 D6“不撞地”原则，需单独立项 |
