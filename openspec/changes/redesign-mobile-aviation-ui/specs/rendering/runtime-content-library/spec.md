# rendering/runtime-content-library Delta Specification

## MODIFIED Requirements

### Requirement: 2D component library

2D 内容库 MUST 提供可复用的 HUD、雷达、边缘威胁、敌机标签、战斗告警、反馈列表、按钮、计量条、弹窗、图标，以及局外机库、展厅与结算视图组件。重复数量高且每帧更新的元素 MUST 支持 DOM 节点池或等效复用；局内高频更新的标签与边缘指示 MUST 使用合成层变换定位并缓存视口容器尺寸，避免每帧触发同步布局回流；局外交互面板 MUST 支持局部状态更新而不是无差别全量替换页面 HTML。

#### Scenario: Radar contacts

- **WHEN** 雷达接触目标数量在连续帧之间变化
- **THEN** 2D 内容库复用雷达节点并只更新位置、状态和可见性

#### Scenario: Combat feed

- **WHEN** 命中、部件禁用或击毁事件进入反馈列表
- **THEN** 2D 内容库使用统一反馈项组件更新内容，并限制活动项数量

#### Scenario: Zero-reflow HUD projection updates

- **WHEN** 战斗画面在连续渲染帧中更新敌机名牌、锁定标签与边缘威胁箭头
- **THEN** 2D HUD 从缓存的容器尺寸计算边缘锚点，并通过 `transform` 更新节点位置，不在每帧调用强制同步布局查询

#### Scenario: Hangar and showroom views live in 2D content library

- **WHEN** 应用渲染出击页、装备页、展厅面板、模态弹窗或结算页
- **THEN** 页面结构与交互片段通过 `src/content/2d/` 视图模块构建和局部更新，应用协调器仅负责状态管理与动作分发
