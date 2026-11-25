# Tasks

## 1. 极简复古航空仪表样式体系与纯竖屏壳层

- [x] 1.1 将 `src/style.css` 拆分为 `src/styles/` 模块（`tokens.css`、`base.css`、`hangar.css`、`battle.css`、`showroom.css`、`modals.css`、`reference-lab.css`），建立复古航空仪表 Token（深炭橄榄面板、暖象牙刻度字、琥珀金/信号绿/朱红状态色、最小 10px 字阶与等宽数字）并原样迁出 `.reference-*` 样式；通过 `npm run build` 验证样式入口打包无报错。
- [x] 1.2 在 `src/styles/base.css` 与 `src/content/2d/components.ts` 中落地四档紧凑按钮体系（`xs 28px`、`sm 34px`、`md 40px`、`lg 44px`）与透明外扩热区（`::after`），彻底移除原 `style.css` 末尾的 44px 强覆盖补丁；确认组件按钮辅助函数通过 `npm run check` 类型检查。
- [x] 1.3 移除 `src/app/GameApp.ts` 中的 `.desktop-intro` 和 `.desktop-notes` 静态桌面侧栏及多余 `.keyboard-controls` 类切换，使主壳层仅渲染纯竖屏 `.game-shell` 并适配移动端安全区；运行 `npm run check` 并检查页面 DOM 不再包含桌面侧栏节点。

## 2. 局外机库、出击页与装备页视图组件化与高效交互

- [x] 2.1 新建 `src/content/2d/HangarView.ts`，实现紧凑 `meta-top` 状态条、52px 紧凑底部导航栏（保留商店/装备/出击/预留/展厅五槽位与返回路径）、去除冗余大标题的复古仪表出击卡以及占位页模板，替换 `GameApp.ts` 中的内联 HTML 拼接；运行 `npm run check` 验证编译通过。
- [x] 2.2 在 `src/content/2d/HangarView.ts` 与 `src/styles/hangar.css` 中重构装备页：将时代分段控件与同年代机型横向直选胶囊集成至底部仪表板，保留解锁/已装备状态标记与前后微调，并将 7 个部位选择器收紧为 28px 单行芯片并支持局部高亮更新（不重绘整页 DOM）；在 `GameApp.ts` 中接入对应局部更新并补充单元测试验证「预览不改变出击装备」及「部位切换局部更新」。

## 3. 展厅紧凑工具条、局部状态更新与重置缺陷修复

- [x] 3.1 新建 `src/content/2d/ShowroomView.ts` 与 `src/styles/showroom.css`，将展厅展示区操作按钮收敛为单行紧凑 `xs` 仪表工具条（换机/撤销/重置/试射/校验），修复 `GameApp.ts` 中 `showroom-reset` 未清空 `showroomBuild` 的 bug，并在加卡/撤销/重置时执行局部 DOM 更新且保存/恢复强化卡列表 `scrollTop`。
- [x] 3.2 扩展 `tests/aircraft-showroom.test.ts`（或新增 UI 行为测试文件），验证展厅「重置」清空已装构型恢复原装、连续加卡/撤销时保留列表滚动位置且工具条按钮状态同步更新；运行 `npm test` 确认全部通过。

## 4. 全屏 3D 局内战斗 HUD 与零回流性能重构

- [x] 4.1 重构 `src/content/2d/BattleStatus.ts` 与 `src/styles/battle.css`：取消 `.in-battle .scene-host` 截断 32.5% 高度的实心底栏，恢复 100% 全屏 3D 渲染；实现顶部紧凑双轨生命/加力仪与 2px 经验刻度条、底部透明悬浮单手操控层（居中悬浮虚拟摇杆并保留 `VirtualStick` 全部 DOM 钩子、左上紧凑改装钮、右上轰炸开关、右下 60px 投弹环表、左下 84px 轻透罗盘雷达，控件视觉间距 ≥ 14px 且热区不重叠）；同步接入投弹不可用原因细分（未装弹舱/弹舱失效/装填中/超出包线/稳定中/可投放）并补充对应单测；运行 `npm test` 确认全部通过。
- [x] 4.2 优化 `src/content/2d/CombatHud.ts`：使用 `ResizeObserver`（带安全回退）缓存容器宽高取代每帧 `getBoundingClientRect()`，将敌机名牌、锁定/投弹标签与边缘威胁箭头改用 `transform: translate3d(...)` 定位，并调整全屏 HUD 的边缘指示安全边距；新增单元测试覆盖 `CombatHud` 零回流更新、节点复用和边缘安全区边界，运行 `npm test` 通过。

## 5. 弹窗与结算页复古仪表化统一

- [x] 5.1 新建 `src/content/2d/ModalViews.ts` 与 `src/styles/modals.css`，将设置、帮助、暂停、选关、局内升级三选一与结算页从 `GameApp.ts` 迁出并统一应用极简复古航空仪表风格与紧凑按钮尺寸，保留弹窗焦点陷阱（`inert` + `Tab` 循环）与暂停→设置返回路径；运行 `npm run check && npm test` 验证无回归。

## 6. 竖屏移动端全流程集成与视觉验收

- [x] 6.1 执行 `npm run build && npm test` 确认构建与全部自动化测试通过。
- [x] 6.2 启动开发服务器并在竖屏移动端视口（`360×640` 小屏与 `390×844` 标准屏）及 `?reference=1` 原型校验台逐页核验：出击页、装备页（时代切换/同年代直选/部位芯片）、展厅（单行工具条/滚屏加卡/撤销/重置/试射）、局内战斗（全屏 3D 视野/巡航与轰炸模式/升级弹窗/暂停设置）与结算页，确认无按钮过大、无文字裁切遮挡、无桌面侧栏残留且校验台零回归。

## Workflow follow-up

- 待全部任务与视觉验收完成后，按 OpenSpec 流程同步规格并归档 `redesign-mobile-aviation-ui` 变更。
