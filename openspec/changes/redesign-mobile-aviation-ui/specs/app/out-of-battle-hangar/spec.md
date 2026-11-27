# app/out-of-battle-hangar Delta Specification

## MODIFIED Requirements

### Requirement: Hangar navigation

局外机库 MUST 提供包含商店、装备、出击、活动以及调试环境的展台的紧凑底部导航栏，所有入口都必须能够返回出击页面。导航栏 MUST 与内容票分开，使用单行大图标和短标签，预留底部安全区。

#### Scenario: Default opens sortie

- **WHEN** 玩家首次进入应用
- **THEN** 局外默认显示出击页面并展示当前装备机体

#### Scenario: Placeholder page returns safely

- **WHEN** 玩家打开尚未实现的商店或预留入口
- **THEN** 页面显示可返回的占位内容，当前装备和存档状态保持不变

#### Scenario: Compact navigation preserves airframe space

- **WHEN** 玩家在 640px 高度的竖屏设备上浏览出击页、装备页或展厅
- **THEN** 底部导航栏保持单行紧凑高度，不挤压上方三维机体展示区域

### Requirement: Aircraft preview and equipment selection

装备页面 MUST 区分预览机体和当前装备机体，只有明确确认装备后才改变下一局出击机体。装备页面 MUST 在底部操作面板内提供同年代机型的直接扫视选择列表（显示机型名称与已装备/已解锁/未解锁状态），同时保留快速切换能力，避免只能逐架盲翻。

#### Scenario: Preview does not equip

- **WHEN** 玩家浏览另一架未装备的机体并返回出击页面
- **THEN** 出击页面仍使用原装备机体

#### Scenario: Equip unlocked aircraft

- **WHEN** 玩家确认一架已解锁机体
- **THEN** 该机体成为下一局出击机体，并且页面显示新的当前装备状态

#### Scenario: Direct scan and select within an era

- **WHEN** 玩家在装备页切换时代分段并查看该年代的机体列表
- **THEN** 玩家可以在底部面板中直接扫视同年代所有机体及其解锁/装备状态，并单次点击切换到目标机体预览

### Requirement: Aircraft information summary

装备和出击页面 MUST 以紧凑航空仪表盘形式展示足以支持出击决策的机体属性、武器和构型信息，并去除出击页顶部的冗余装饰大标题，为三维机体保留清晰的中上部展示空间。

#### Scenario: Compare airframes

- **WHEN** 玩家切换机体预览
- **THEN** 页面同步更新生命、速度、加速度、转向、能量、翼展、挂点和主要武器信息，面板布局保持稳定不跳动

#### Scenario: Inspect a part

- **WHEN** 玩家在装备页选择紧凑部位芯片
- **THEN** 页面高亮三维模型对应部位并显示该部位的功能、挂点或损伤影响说明，不重绘整页容器
