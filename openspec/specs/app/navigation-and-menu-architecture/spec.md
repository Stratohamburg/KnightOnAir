# app/navigation-and-menu-architecture Specification

## Purpose

定义局外页面的职责边界、一级和二级菜单规则、调试展台隔离以及菜单变更所需的同步行为，避免页面职责交叉和新增入口失去统一规范。

## Requirements

### Requirement: Canonical first-level navigation

局外应用 MUST 使用稳定的一级职责入口。产品入口为出击、装备、商店、活动和展台。出击 MUST 是默认入口，所有玩家页面 MUST 能够返回出击页。活动在未实现时可以显示为预留入口。展台 MUST 只在开发或显式调试环境显示。

#### Scenario: Default opens sortie

- **WHEN** 玩家首次打开应用或从结算页返回局外
- **THEN** 应用显示出击页，页面默认聚焦当前副本和已确认装备

#### Scenario: First-level tab changes page responsibility

- **WHEN** 玩家点击一级导航中的一个入口
- **THEN** 应用只切换到该入口负责的页面，切换不会隐式修改装备、存档、货币、活动进度或当前副本

#### Scenario: Reserved activity entry is safe

- **WHEN** 活动功能尚未上线且玩家打开活动入口
- **THEN** 页面显示用途说明和返回出击按钮，不出现可提交的购买、领取或解锁动作

#### Scenario: Showroom is debug-gated

- **WHEN** 应用以生产配置运行
- **THEN** 展台入口不可见

- **WHEN** 应用以开发或显式调试配置运行
- **THEN** 展台可以显示，且展台操作不改变玩家装备、货币、战斗统计或持久化存档

### Requirement: Sortie page owns mission decisions

出击页 MUST 只以副本信息为主内容，包含副本名称、目标、环境、当前装备标识和开始出击动作。完整载具数据只能在装备页展示。载具编辑、局外升级、抽奖、货币直购和调试校验 MUST 不出现在出击页内容区。

#### Scenario: Choose mission without changing equipment

- **WHEN** 玩家从出击页打开选关并选择另一个可用副本
- **THEN** 副本预览和出击信息更新，已确认装备保持不变

#### Scenario: Launch uses selected mission and equipped aircraft

- **WHEN** 玩家点击出击
- **THEN** 新战斗使用当前选中的副本和已确认装备，重复点击不会创建第二个战斗会话

### Requirement: Equipment page owns aircraft and upgrades

装备页 MUST 提供载具选择、载具数据、部位信息、武器构型和局外升级。浏览预览 MUST 与确认装备分离。升级提交 MUST 显示前后数值和结果，并且只有明确提交后才修改下一局构型或持久化状态。

#### Scenario: Preview does not equip

- **WHEN** 玩家在装备页浏览另一架载具并返回出击页
- **THEN** 出击页仍使用此前确认的装备

#### Scenario: Equip unlocked aircraft

- **WHEN** 玩家在装备页点击已解锁载具的装备按钮
- **THEN** 该载具成为下一局装备，并显示当前装备状态

#### Scenario: Upgrade stays within equipment

- **WHEN** 玩家从装备页打开升级面板并确认合法升级
- **THEN** 装备页更新构型和数据，出击页只读取更新后的结果，商店和展台状态不被修改

### Requirement: Shop owns acquisition and purchase

商店 MUST 只提供抽奖和货币直购。抽奖和直购 MUST 使用各自的二级切换栏。购买或抽取前 MUST 显示消耗和确认状态，完成后更新货币和商品结果。

#### Scenario: Shop purchase does not equip aircraft

- **WHEN** 玩家完成抽奖或货币直购
- **THEN** 商店更新结果和货币，当前装备、当前副本和战斗状态保持不变

### Requirement: Second-level controls are single-purpose

每个二级切换栏 MUST 只控制一个维度，选项 MUST 同类、互斥且有明确选中态。二级切换栏最多嵌套一层。预览选择不得隐式提交持久化状态，提交动作必须使用独立动作按钮。

展台「校验」的工具切换与直达路径见[调试台规格](../debug-workbench/spec.md)。已有 `?reference=1` 与 `#reference` 链接可显式进入调试台。

#### Scenario: Equipment era switch preserves context

- **WHEN** 玩家在装备页切换时代
- **THEN** 页面筛选同年代载具，保留页面滚动和焦点上下文，不自动装备或升级载具

#### Scenario: Local tab update preserves context

- **WHEN** 玩家切换部位、升级卡或商店分段
- **THEN** 只更新受影响的局部视图，当前滚动位置、按钮状态和可访问选中态保持有效

### Requirement: Menu changes update the navigation inventory

新增、删除、改名或调整菜单职责 MUST 同步更新界面信息架构文档、此规格、ui-navigation-system skill、路由和视图实现、样式、相关测试以及文档索引。旧路由别名如需兼容 MUST 在实现和文档中登记。

#### Scenario: New first-level menu is reviewed against the checklist

- **WHEN** 开发者新增一级菜单
- **THEN** 变更记录包含职责、内容、按钮、二级菜单、返回路径、持久化影响、生产可见性和对应测试，并且菜单变更同步清单中的文件已检查

