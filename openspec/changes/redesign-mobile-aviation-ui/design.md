# Design

## Context

详见 [proposal.md](./proposal.md) 中的背景与动机。当前主游戏采用无框架的原生 TypeScript + 字符串模板 + 全局单文件 CSS（`src/style.css`，3287 行）+ 根容器事件委托架构，3D 场景通过 Three.js 渲染至 `.scene-host`，局内 2D HUD 由 `BattleStatus.ts` 和 `CombatHud.ts` 负责，而局外页面、展厅、弹窗与结算页的 HTML 拼接则直接写在 `src/app/GameApp.ts` 中。

核心约束：
- 本项目是纯竖屏移动端游戏（典型视口 `360×640` 至 `430×932`，含 `env(safe-area-inset-*)`），不需要任何桌面宽屏布局或装饰侧栏。
- `src/simulation` 与 Three.js / DOM 保持完全隔离；所有复用 2D 控件与视图需归口至 `src/content/2d/`（遵循 `rendering/runtime-content-library` 规范）。
- `VirtualStick.ts` 与既有单测 `tests/controls.test.ts` 绑定了 `.stick-surface`、`.stick-base`、`.stick-knob`、`.stick-label` 等选择器与 `data-mode` / `data-bombing` / `--throttle` / `--outer-ratio` 契约，重构时必须保持兼容。
- `?reference=1` 原型校验台（`ReferenceApp.ts`）共用 `src/style.css` 入口但使用独立的 `.reference-*` 命名空间，拆分样式时须保持其视觉和布局零回归。

## Goals / Non-Goals

**Goals:**
- 以「极简复古航空仪表（Minimalist Retro Aviation Instrument）」统一全部主游戏 UI，打造轻盈、精密、高对比度的仪表盘质感。
- 将全站按钮收紧到克制尺寸（`xs 28px` / `sm 34px` / `md 40px` / `lg 44px`），并通过透明外扩热区保证移动端单手触控容错。
- 彻底释放 3D 展示与空战视野：移除出击页冗余大标题、取消局内截断 32.5% 屏幕高度的实心底栏、压低底部导航栏、将展厅按钮收拢为不遮挡机体的单行紧凑工具条。
- 提升交互与渲染效率：装备页增加同年代机型直选胶囊；展厅改为局部 DOM 更新保留滚动条位置并修复 `showroom-reset` 清空构筑缺陷；`CombatHud` 缓存视口尺寸并用 `translate3d` 更新投影元素。
- 清理结构债务：移除桌面侧栏代码与样式；将 `GameApp.ts` 中散落的视图模板抽离到 `src/content/2d/`；将 `src/style.css` 拆分为清晰的模块化 CSS 文件。

**Non-Goals:**
- 不改造桌面宽屏多栏界面或键盘专属 HUD。
- 不重新设计 `?reference=1` 原型校验台（仅将其现有 CSS 迁移至独立子文件并保持效果一致）。
- 不引入 React/Vue/Tailwind 等外部前端框架或构建期 CSS 预处理依赖。
- 不更改飞行动力学、武器/升级数据、AI、相机投影公式或 3D 模型生成逻辑。

## Decisions

### 1. 极简复古航空仪表设计系统（Design Tokens）

**决策**：在 `src/styles/tokens.css` 建立单一视觉真源，统一色板、字阶、圆角、细描边与刻度装饰：
- **色板（Cockpit Slate & Brass Instrument）**：
  - 仪表盘底面：`--panel-bg: rgba(15, 22, 20, 0.80)`（实心弹窗 `--panel-solid: #141d1b`），搭配 `backdrop-filter: blur(8px)` 替代大片黑绿 `.scene-vignette`。
  - 细刻度边框：`--line-subtle: rgba(232, 228, 212, 0.14)`、`--line-strong: rgba(232, 228, 212, 0.28)`，圆角收紧至 `4px–8px` 的机械仪表切角感，去掉臃肿大圆角与浑浊阴影。
  - 文本阶梯：`--ink: #ebe6d5`（暖象牙刻度白）、`--ink-muted: #9aa79c`（雾灰刻度字）、`--ink-dim: #6f7d73`。
  - 语义强调色（全站统一，彻底消除薄荷绿与展厅暖金打架）：
    - 主操作/航电琥珀：`--amber: #e6b65c`（复古仪表背光金，用于主 CTA、选中刻度、能量/加力状态与轰炸准备态）
    - 航空信号绿：`--signal: #8fd19e`（健康、已解锁/已装备、准心锁定就绪）
    - 警示朱红：`--alert: #e46c50`（低血量、来袭告警、负面属性代价、损坏提示）
- **字体与可读字号阶梯**：
  - 取消 Windows 下发虚锯齿的 `SimSun` 宋体，统一采用清晰无衬线字体栈（`system-ui, -apple-system, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif`）+ 等宽仪表数字栈（`ui-monospace, "SFMono-Regular", "JetBrains Mono", Consolas, monospace` + `font-variant-numeric: tabular-nums`）。
  - 全站最小字号提升至 **`10px`**（微刻度标签 `10px`，次级信息 `11px`，标准按钮与正文 `12px–13px`，仪表主数值 `16px–20px`，页面标题 `18px–22px`），消灭 `6px–9px` 蚂蚁字。

**备选方案**：保留原 `Georgia + SimSun` 杂志画报风与薄荷绿单色。放弃原因：画报风大字标题与密集飞行状态信息天生冲突，在竖屏小屏下浪费顶部 25% 空间且跨页色系不统一。

### 2. 四档紧凑按钮与“视觉/热区分离”机制

**决策**：在 `src/content/2d/components.ts` 与 `src/styles/base.css` 中定义统一的 `.btn` 尺寸与语义修饰类，彻底替换文末暴力覆盖 `44px` 的补丁：
- `.btn-xs`：视觉高 `28px`，`padding: 0 8px`，`font-size: 11px`，图标 `13px` — 用于部位芯片、时代分段、展厅工具栏、辅助图标钮。
- `.btn-sm`：视觉高 `34px`，`padding: 0 12px`，`font-size: 12px`，图标 `15px` — 用于选关、更换机体、局内改装/轰炸开关、弹窗次级按钮。
- `.btn-md`：视觉高 `40px`，`padding: 0 14px`，`font-size: 13px`，图标 `16px` — 用于装备机体、继续飞行、确认设置、结算页「再次出击」。
- `.btn-lg`：视觉高 `44px`，`padding: 0 18px`，`font-size: 14px`，图标 `18px` — 仅用于首页「出击」主行动按钮（单行精炼排版，取消双行英文副标题）。
- **隐形热区扩展**：对 `.btn-xs`、`.btn-sm` 及 `.icon-btn`（视觉 `32px×32px`）通过 `position: relative` 与 `::after { content: ""; position: absolute; inset: -6px; }` 扩大点击热区，并保证容器 `gap` ≥ `6px` 避免相邻按钮热区重叠。

**备选方案**：把视觉盒子统一做成 `44px` 以满足触控规范。放弃原因：正是当前「满屏大按钮、部件芯片像竖条砖块、展厅按钮挡住飞机」的根本诱因。

### 3. 纯竖屏移动端壳层（移除桌面侧栏）

**决策**：
- 在 `GameApp.ts` 构造函数中移除 `.desktop-intro` 和 `.desktop-notes` 两个 `<aside>` 节点，仅保留 `<section class="game-shell">` 作为唯一游戏舞台。
- 在 CSS 中设置 `#app` 为全屏暗炭背景并居中 `.game-shell`（移动端 `width: 100%; height: 100dvh;`，在宽于 `480px` 的预览窗口下限制 `max-width: 480px` 保持移动端竖屏比例，不渲染任何额外桌面组件）。
- 移除 `.keyboard-controls` 与桌面侧栏相关冗余样式，保留键盘快捷键监听（便于开发调试与外接键盘测试，但不为其定制桌面 UI）。

### 4. 局内全屏 3D 视野与悬浮航空仪表 HUD

**决策**：
- **取消 3D 画布截断**：删除 `.in-battle .scene-host { height: calc(100% - var(--deck)); }` 与 `--deck` 实心底栏高度变量，让 `.scene-host` 与 `.world-labels` 始终占满 `100%` 壳层高度。
- **顶部紧凑仪表带（`battle-top`）**：
  - 左侧：单块紧凑半透明航电盒，内置「机体生命条 + 数值」与「加力储备条 + 数值」，用图标 + 简明刻度代替冗长标签。
  - 中央：紧凑计时/积分/任务航段读数（去掉过大衬线钟面，总高度压缩至 ~48px）。
  - 右侧：`32px` 视觉暂停圆钮（热区 `44px`），并把帮助按钮移入暂停菜单或极简右上角辅助位，取消无用的底部 `KNIGHT ON AIR / FPS` 状态栏（FPS/画质信息改为极细微半透明角标，不独立占行）。
  - 顶部紧贴安全区下方放置 `2px` 贯穿 XP 细刻度条 + 右端 `LV.xx` 微角标。
- **悬浮底部控制布局（对齐 `docs/systems/01-control-camera.md` 右手单手大拇指短路径，`control-deck` 改为 `pointer-events: none` 透明承载层，子控件 `pointer-events: auto`）**：
  - 上沿扇形肩部（位于摇杆上方左右两侧，靠近屏幕中轴且与摇杆及相邻控件保持 `≥ 14px` 视觉间隔、外扩热区互不重叠）：
    - 左上：`sm` 级「改装升级 + 次数角标」紧凑仪表胶囊钮；
    - 右上：`sm` 级「轰炸模式开关」紧凑拨动仪表钮（无弹舱或弹舱损毁时同步体现禁用态）。
  - 下层三区：
    - 左下角：轻透复古罗盘雷达（直径由 `112px` 收紧至 `84px`，带十字细刻度与方向北标）+ 紧凑速度/航态数字读数，击毁/连击/风向微标签置于雷达上方贴边。
    - 中下方：水平居中的半透明悬浮虚拟摇杆（内圈 `92px`，保留外圈加力虚线刻度环与 `VirtualStick` 全部 DOM 钩子），方便右手拇指在摇杆、左上升级、右上轰炸开关与右下投弹钮之间短距离移动。
    - 右下角：仅在轰炸模式显示的 `60px` 圆形「投弹仪表环」（较原先 `75px` 更精巧且带清晰环形进度与中心图标），与摇杆中心保持单次拇指舒适跨度。
- **投弹不可用状态细化映射（收口 `docs/TASKS.md` #1.2）**：
  - 基于 `World` 现有判定字段（`bombWeapon`、`player.damage.bombFactor`、`bombCooldown`、`validBombAim`、`stability`、`canBomb`）在 `GameApp.ts` → `BattleStatus` 中精确区分 6 种状态文案与视觉态：
    1. 未安装弹舱（`!bombWeapon`）→ 轰炸开关禁用并提示「无弹舱」；
    2. 弹舱失效（`bombFactor <= 0`）→ 提示「弹舱损毁」，投弹环禁用并呈警示色；
    3. 装填中（`bombCooldown > 0`）→ 显示剩余秒数与装填环进度；
    4. 超出投弹包线（`isBombing && !validBombAim`）→ 提示「超出包线」，投弹环禁用；
    5. 准心稳定中（`isBombing && stability < threshold`）→ 显示稳定百分比与「松杆稳定」；
    6. 可投放（`canBomb`）→ 亮起信号绿/琥珀就绪环并显示「投弹 / 落点锁定」。
- **边缘威胁指示裁剪区**：`CombatHud` 边缘指示边界跟随全屏视口内缩安全边距（上 `68px`、下 `152px`、左右 `12px`），避免箭头落入顶部状态条或底部单手操控区。

**权衡考量**：全屏 3D 渲染在像素面积上比截断 `32.5%` 高度的旧画布略大。通过 `Renderer` 既有动态质量档位（`low`/`standard`/`high`）即可平稳承压，且换来显著更开阔的空战与提前发现敌机视野。

### 5. 局外机库与展厅高效交互重构

- **底部导航栏（`bottom-nav`）**：高度由 `73px` 压至 `52px + env(safe-area-inset-bottom)`；保留既有 5 个槽位（商店 / 装备 / 出击 / 预留 / 展厅）确保 `app/out-of-battle-hangar` 规格兼容，视觉上为「商店」「预留」应用低饱和度未启用刻度态，突出「出击 / 装备 / 展厅」三项核心入口。
- **出击页（`sortie`）**：
  - 顶部保留极简 `meta-top` 状态条（飞行员等级胶囊 + 金币数 + `32px` 设置按钮，去掉厚重旋转徽章块）。
  - 移除占掉顶部 1/3 空间的 `.home-heading` 大标语与漂浮 `.plane-caption`，让 3D 展示飞机成为画面视觉主角。
  - 底部悬浮单张紧凑复古仪表出击卡（最大高度约占视口底部 34%）：
    - 顶行：当前机型名称 + 时代/定位标签 + 紧凑武器芯片 + `xs` 级「更换」按钮（非 pioneer 关卡显示）。
    - 中行：4 格紧凑仪表属性条（生命 / 极速 / 加速 / 转向，等宽数值 + `2px` 细刻条）。
    - 关卡行：当前关卡编号与名称 + `sm` 级「选关」钮。
    - 行动行：左侧 `sm` 级「指南」图标按钮 + 右侧 `lg` 级「出击」按钮（或紧凑主按钮 + 底部单行历史最高分）。
- **装备页（`equipment`）**：
  - 移除悬在半空的 `.era-tabs` 和巨大 `.equipment-title`，顶部仅留轻量化时代标题与当前分页指示。
  - 底部整合为「复古仪表机库控制板」，自上而下依次为：
    1. **时代分段条**（4 段紧凑 `xs` 分段控件，高度 `28px`）；
    2. **同年代机型横向胶囊条**（可横向滑动/一行扫视，显示每架机型名称及已装备/已解锁/未解锁小图标，点击直接切换预览；左右小箭头辅以微调）；
    3. **机体核心参数 + 简明规格行 + 武器标签**；
    4. **7 部位单行紧凑芯片栏**（高 `28px`，点击局部高亮并更新下方单行说明，不重建整页 DOM）；
    5. **`md` 级装备确认按钮**（`40px`）。
- **展厅（`showroom`）**：
  - 展示区占上方约 62%–65%，左上角紧凑显示机型名与精简挂载计数（部件/炮位/枪管），底部贴边放一条**单行紧凑 `xs` 仪表工具条**：`换机` / `撤销` / `重置` / `试射` / `校验`，再也不会折行挡住 3D 飞机。
  - 下方操作区占约 35%–38%：顶部固定显示「当前生效构型」横向有序卡条，下方为可滚动的紧凑强化卡列表。
  - **局部更新与 Bug 修复**：
    - `GameApp.ts` 中 `case "showroom-reset"` 修复为 `this.rebuildShowroom(undefined, [])`。
    - 拆出独立 `ShowroomView`（位于 `src/content/2d/`），当加卡/撤销/重置时仅更新挂载统计、工具条禁用态、生效构型条和强化卡列表内容并**显式保存/恢复列表 `scrollTop`**，避免滚回顶部。

### 6. 2D 内容库拆分与样式模块化架构

**2D 视图模块划分（`src/content/2d/`）**：
- `components.ts`：增强 `button()` 支持尺寸/风格语义类与属性，保留 `dialog()`、`meter()`、`setMeter()`、`NodePool`。
- `HangarView.ts`（新增）：负责 `meta-top`、紧凑 `bottom-nav`、出击页、装备页（含同年代机型胶囊与部位高亮局部更新方法）以及占位页的渲染与局部更新。
- `ShowroomView.ts`（新增）：负责展厅页面渲染、紧凑工具条、强化卡列表局部更新与滚动位置保持，以及展厅选机弹窗内容。
- `ModalViews.ts`（新增）：负责设置、帮助、暂停、选关、局内改装升级三选一与结算页的渲染。
- `BattleStatus.ts`：重构为全屏悬浮复古航空仪表 HUD 与底部悬浮控制组件，保留 `update(view)` 高频差量更新路径。
- `CombatHud.ts`：引入 `ResizeObserver` 缓存容器宽高（回退时使用 `clientWidth`/`clientHeight`），敌机名牌、锁定/投弹标签与边缘威胁箭头改用 `transform: translate3d(x, y, 0)` 定位，消除每帧 `getBoundingClientRect()` 回流。
- `GameApp.ts`：瘦身为状态机与事件/循环协调器，不再内联大段页面 HTML。

**CSS 模块划分（`src/styles/`，由 `src/style.css` 按顺序 `@import`）**：
- `src/styles/tokens.css`：复古航空仪表色板、字阶、间距、层级与按钮尺寸变量。
- `src/styles/base.css`：重置、纯竖屏 `.game-shell`、四档 `.btn-*` 与触控热区、图标与通用仪表盘表面类。
- `src/styles/hangar.css`：顶栏、紧凑底栏、出击页、装备页（时代分段、机型胶囊、部位芯片）与占位页。
- `src/styles/battle.css`：全屏局内悬浮 HUD、双轨生命/加力仪、轻透罗盘雷达、悬浮虚拟摇杆与投弹仪表环、敌机名牌与边缘威胁。
- `src/styles/showroom.css`：展厅展示区紧凑工具条、可滚动强化卡操作区与选机网格。
- `src/styles/modals.css`：复古仪表弹窗、升级卡、设置表单、帮助、结算页与 Toast。
- `src/styles/reference-lab.css`：原样迁出 `style.css` 中第 2325–3155 行的 `.reference-*` 规则，保持零回归。

## Risks / Trade-offs

- **[风险] 悬浮 HUD 在极端小屏（360×640）或轰炸模式下与摇杆/雷达发生挤压** → **缓解**：针对 `max-height: 680px` 与 `max-width: 380px` 提供紧凑断点，缩小摇杆内径（`92px → 80px`）与雷达直径（`84px → 72px`），并在 360×640 和 390×844 两个标准移动端视口完成实机/模拟器视觉核验。
- **[风险] 全屏 3D 战斗画布下，玩家飞机居中投影位置下方靠近摇杆区域** → **缓解**：悬浮摇杆与底栏控件高度总计控制在 ~136px 以内（原实心底栏高达 232–300px），玩家飞机位于视口垂直中线（约 320px–422px 处），与摇杆之间保留充裕空战视野；同时确保 `tests/controls.test.ts` 中全部相机居中与摇杆断言全部通过。
- **[风险] 样式拆分与 DOM 选择器重构可能破坏 `VirtualStick` 或既有测试/无障碍属性** → **缓解**：严格保留 `.stick-surface`、`.stick-base`、`.stick-knob`、`.stick-label`、`data-action`、`data-tab`、`aria-pressed`、`aria-current`、弹窗焦点陷阱（`inert` + `Tab` 循环）等既有交互与可访问性契约，并补充 UI 行为自动化测试覆盖展厅重置、滚动保留、装备页直选与 HUD 零回流更新。
- **[风险] 高对比浅色天空背景上悬浮文字可读性下降** → **缓解**：所有悬浮在 3D 天空上的 HUD 组件统一使用深炭橄榄半透明背板（`rgba(15, 22, 20, 0.76)`）+ `1px` 细边框，避免“裸字飘在亮云上看不清”，同时无需全局压黑渐变。
