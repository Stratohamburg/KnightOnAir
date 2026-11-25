# app/mobile-ui-system Specification

## Purpose

定义 KnightOnAir 竖屏移动端界面的极简复古航空仪表视觉体系、紧凑控件尺寸与触控热区规范、纯竖屏应用壳层以及局外/展厅交互的视图稳定性规则，确保在有限手机视口中优先呈现三维飞机与空战视野。

## ADDED Requirements

### Requirement: Portrait mobile-only application shell

主游戏应用 MUST 仅渲染纯竖屏移动端壳层，不得渲染桌面端左右装饰或说明侧栏。壳层 MUST 适配竖屏移动端视口（含安全区 `env(safe-area-inset-*)`），在超出移动端宽度的屏幕上仅保持居中竖屏容器而不启用多栏桌面布局。

#### Scenario: Opening the game on a mobile portrait viewport

- **WHEN** 玩家在 360×640 至 430×932 范围的竖屏视口打开主游戏
- **THEN** 主壳层填满视口宽度与高度，界面顶部与底部遵守安全区边距，不出现横向溢出或隐藏的桌面侧栏节点

#### Scenario: Opening the game in a wide viewport

- **WHEN** 玩家或开发者在宽于移动端壳层的浏览器窗口中打开主游戏
- **THEN** 页面仅居中显示纯竖屏游戏壳层，左右两侧不渲染静态文案、坐标或键盘说明侧栏

### Requirement: Minimalist retro aviation instrument visual hierarchy

主游戏所有局外页面、局内 HUD、弹窗与结算页 MUST 遵循统一的极简复古航空仪表视觉语言：使用统一的高对比深色仪表盘底色、暖象牙色主刻度文本、细实线边框与刻度元素、复古琥珀与仪表信号绿状态色，以及可读的最小字号阶梯与等宽数字。

#### Scenario: Readable instrumentation across screens

- **WHEN** 玩家在出击页、装备页、展厅、战斗 HUD、弹窗与结算页之间切换
- **THEN** 所有可读标签与数值字号不低于 10px，关键数值采用等宽数字排版，各页面共用同一套仪表盘表面与状态强调色而不出现跨页风格割裂

#### Scenario: Clean sky and airframe presentation

- **WHEN** 玩家处于出击页、装备页或战斗场景中
- **THEN** 界面不依赖覆盖画面中部的重度深色压黑渐变衬字，而是通过局部紧凑仪表盘表面承载信息，使三维飞机和天空轮廓保持清晰可见

### Requirement: Compact button sizing with decoupled touch targets

控件 MUST 按交互优先级分为四档紧凑视觉高度（`xs` 约 28px、`sm` 约 34px、`md` 约 40px、`lg` 约 44px），禁止将次级工具按钮、图标按钮、分段标签或部件芯片放大为厚重通栏方块。视觉高度小于 40px 的可点击控件 MUST 通过透明外扩热区保证移动端手指可准确点按，且热区不得与相邻高频按钮重叠造成误触。

#### Scenario: Secondary controls stay visually compact

- **WHEN** 玩家查看顶栏设置/暂停钮、装备页部位芯片、时代分段标签或展厅操作条
- **THEN** 按钮呈现与功能层级匹配的紧凑视觉高度，不遮挡展示机体或撑高底栏

#### Scenario: Primary sortie action stays prominent without bloating

- **WHEN** 玩家在出击页查看主行动区
- **THEN** 「出击」按钮作为唯一 `lg` 级主按钮醒目可读，高度受限于 44px–48px 范围，不包含撑高按钮的冗余副标题行

### Requirement: Stateful local updates in interactive panels

局外机库与展厅的交互操作（包括部件高亮切换、时代切换、展厅加卡、撤销与重置）MUST 保持平滑的交互上下文，不得因整页 DOM 销毁重建导致当前列表滚动位置跳回顶部或丢失按钮操作状态。展厅的「重置」动作 MUST 清空全部已选强化卡并恢复原装构型。

#### Scenario: Adding multiple upgrades in showroom preserves scroll position

- **WHEN** 玩家在展厅向下滚动强化卡列表并连续点击多张合法强化卡
- **THEN** 展示机体、顶部生效卡序和候选卡状态即时更新，强化卡列表保持当前滚动位置不跳回顶部

#### Scenario: Resetting a showroom build clears all installed cards

- **WHEN** 玩家在展厅安装一张或多张强化卡后点击「重置」
- **THEN** 已生效卡序立即清空为原装构型，三维机体与挂载统计恢复初始状态，且撤销与重置按钮随之禁用
