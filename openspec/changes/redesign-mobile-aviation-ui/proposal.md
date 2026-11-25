# Proposal

## Why

当前竖屏移动端的界面存在视觉与交互效率双重瓶颈：全局按钮普遍采用 44px–72px 的厚重块状尺寸并强行通栏堆叠，文末补丁甚至将次级图标和 7 个部件标签拉爆至 44px；字号在 6px–9px 蚂蚁字与粗重宋体大标题之间撕裂，首页、装备页与后加入的展厅配色冲突且依赖大片压黑渐变衬字；局内实心底栏切掉近三分之一的 3D 空战视野，机库选机只能逐架翻页，展厅每次点卡全量重建 DOM 导致列表滚动复位，且「重置」按钮存在未清空构筑的缺陷。同时，桌面端左右静态装饰侧栏并无实际价值。

本项目定位为纯竖屏移动端飞行游戏，需要以「极简复古航空仪表（Minimalist Retro Aviation Instrument）」为核心风格重构整套移动端 UI，在不牺牲触控容错的前提下收紧视觉尺寸、释放 3D 视野并提升选机、配装与战斗操作的效率。

## What Changes

- **纯竖屏移动端壳层（移除桌面端装饰侧栏）**：移除 `.desktop-intro` 与 `.desktop-notes` 静态旁白侧栏及对应桌面断点逻辑，专注移动端竖屏壳层（`100dvh`，宽屏浏览器仅居中承载纯竖屏画面而不维护桌面双栏/三栏布局）。
- **极简复古航空仪表视觉体系**：建立统一的设计 Token（深炭橄榄/航表盘面、暖象牙刻度字、复古仪表琥珀与信号绿高亮、清晰细刻度线与角标），废除 6px–9px 极小字与发虚的 `SimSun` 宋体，统一可读字号阶梯与等宽数字；建立「视觉精巧 + 隐形触控热区扩展」的四档紧凑按钮规范（`xs 28px` / `sm 34px` / `md 40px` / `lg 44px`），彻底解决按钮过大与遮挡问题。
- **局外机库与出击页高效化**：压缩底部导航栏高度并统一仪表风格（保留商店、装备、出击、预留、展厅五个既有槽位与返回路径）；去除出击页冗余大标题与漂浮标语，收拢为底部紧凑仪表出击卡；装备页改用底栏内嵌时代分段与横向可扫视机型胶囊列表（替代仅靠左右箭头盲翻），将 7 个部位选择器收紧为单行紧凑仪表切换芯片。
- **展厅操作效率提升与缺陷修复**：展厅展示区按钮收敛为单行紧凑仪表工具条（不再折行遮挡 3D 机体）；下方操作区改为局部 DOM 更新，连续添加/撤销/重置强化卡时保持强化卡列表滚动位置；支持在当前生效构型中查看卡序并修复「重置」按钮未清空已装构筑的 bug。
- **局内战斗 HUD 视野释放与仪表重排**：取消 `.in-battle .scene-host` 截断 32.5% 高度的厚重实心底栏，恢复全屏 3D 场景渲染，改为半透明悬浮复古航空仪表布局（顶部紧凑双轨生命/加力仪 + 任务计时积分仪 + 2px 经验细刻度；底部遵循右手单手大拇指短路径——中央悬浮紧凑摇杆与外圈加力刻度、摇杆左上紧凑改装升级钮、右上轰炸模式开关、右下投弹环表、左下轻量化罗盘雷达；并细化投弹控件的不可用原因提示，区分未装弹舱、弹舱失效、装填中、准心未稳定/超出包线与可投放状态）。
- **2D 内容库组件化与样式拆分**：按 `rendering/runtime-content-library` 边界将 `GameApp.ts` 中的局外页面、展厅面板、弹窗与结算页模板迁移至 `src/content/2d/` 组件模块并采用局部更新；将 3287 行单文件 `src/style.css` 拆分为模块化样式文件并清除末尾冲突补丁；优化 `CombatHud` 尺寸缓存与 `translate3d` 定位以消除每帧同步回流。

## Capabilities

### New Capabilities

- `app/mobile-ui-system`: 定义竖屏移动端极简复古航空仪表视觉规范、四档紧凑按钮与触控热区分离标准、纯竖屏壳层（无桌面侧栏）及局外/展厅视图的局部 DOM 更新与交互效率约束。

### Modified Capabilities

- `app/out-of-battle-hangar`: 增强装备页同年代机型的直接扫视选择能力与紧凑部件仪表切换，收紧出击页与导航栏对 3D 展示机体的遮挡。
- `battle/battle-hud-and-event-feedback`: 将局内 HUD 与控制甲板由截断 3D 视口的实心底栏改为全屏 3D 场景上的悬浮紧凑航空仪表，优化雷达、状态仪、告警与控制区视野占比。
- `rendering/runtime-content-library`: 补充 2D 内容库对局外页面/展厅/弹窗/结算视图组件的归属、局部更新约束，以及 HUD 帧内零回流定位与视口尺寸缓存要求。

## Impact

- **UI 与视图层**：[src/app/GameApp.ts](file:///d:/Projects/KnightOnAir/src/app/GameApp.ts)、[src/content/2d/BattleStatus.ts](file:///d:/Projects/KnightOnAir/src/content/2d/BattleStatus.ts)、[src/content/2d/CombatHud.ts](file:///d:/Projects/KnightOnAir/src/content/2d/CombatHud.ts)、[src/content/2d/components.ts](file:///d:/Projects/KnightOnAir/src/content/2d/components.ts)、[src/content/2d/icons.ts](file:///d:/Projects/KnightOnAir/src/content/2d/icons.ts)，以及将在 `src/content/2d/` 新增的机库/展厅/弹窗/结算视图模块。
- **样式层**：[src/style.css](file:///d:/Projects/KnightOnAir/src/style.css)（拆分为 `src/styles/` 下按模块组织的样式文件并由 `src/style.css` 统一引入；原型校验台 `ReferenceApp` 样式保持隔离不受破坏）。
- **输入与渲染协作**：[src/input/VirtualStick.ts](file:///d:/Projects/KnightOnAir/src/input/VirtualStick.ts)（保持摇杆与外圈加力物理语义和现有测试兼容）、[src/rendering/BattleCamera.ts](file:///d:/Projects/KnightOnAir/src/rendering/BattleCamera.ts)（确认全屏 3D 视口下居中构图与既有相机单测保持通过）。
- **不包含范围（Out of Scope）**：不改变核心飞行物理、武器数值、敌人 AI 或 3D 机体模型几何；不重新设计 `?reference=1` 原型校验台页面；不新增或定制桌面宽屏端多栏布局。
