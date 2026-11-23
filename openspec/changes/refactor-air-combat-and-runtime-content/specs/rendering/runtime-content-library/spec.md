# rendering/runtime-content-library Delta

## MODIFIED Requirements

### Requirement: Content library boundaries

可复用的动态呈现内容 MUST 通过 3D 内容库、特效库或 2D 内容库接入正式页面与战斗流程。模拟层 MUST 只产生纯数据状态和公开事件，不能直接创建 Three.js 对象或 DOM。页面流程 MUST 通过 2D 内容库创建界面组件，不能在业务逻辑中重复拼接同一类组件。

#### Scenario: New aircraft visual

- **WHEN** 新增一个玩家或敌方飞机的三维构型
- **THEN** 内容通过 3D 内容库的机体工厂和配置 ID 创建，模拟层不引用 Three.js

#### Scenario: New combat effect

- **WHEN** 新增枪口、命中、烟雾、火花、爆炸或碎屑效果
- **THEN** 内容通过特效 profile 和特效系统创建，World 只发送效果请求或战斗事件

#### Scenario: New HUD element

- **WHEN** 新增雷达点、边缘指示、敌机标签、战斗告警或反馈列表
- **THEN** 内容通过 2D 内容库的组件和 ViewModel 创建，渲染层不创建 DOM

#### Scenario: Battle and hangar share aircraft content

- **WHEN** 同一机型在机库预览与战斗中出现
- **THEN** 两处使用相同的几何和锚点定义，并各自持有实例姿态与损伤表现

### Requirement: Simulation and rendering separation

World 和其他模拟模块 MUST 通过公开事件或纯数据特效请求描述开火、命中、部件禁用、部件脱落和击毁。特效系统可以读取风场和实体姿态快照，但不得直接改变模拟生命、部件状态或飞行状态。

#### Scenario: Enemy hit event

- **WHEN** 模拟确认敌人受到伤害
- **THEN** World 发出命中事件，特效系统负责生成命中特效，模拟状态只由伤害系统更新

#### Scenario: Part detached

- **WHEN** 模拟确认可脱落部件进入 destroyed
- **THEN** 事件包含部件锚点、命中方向和继承速度，特效系统创建独立碎屑实例

#### Scenario: Multiple simulation steps per frame

- **WHEN** 一个画面帧内完成多个模拟步并产生开火、命中或脱落事件
- **THEN** 各呈现系统各消费对应事件一次，命中与脱落表现使用事件发生时的世界数据，即使目标已经离场

### Requirement: Reusable 3D catalogs

3D 内容库 MUST 提供共享几何目录、材质目录、机体工厂、投射物工厂和局部锚点工具。静态几何、基础材质和可复用纹理 MUST 按内容 ID 缓存。材质中的动态状态 MUST 使用实例状态、实例属性或独立材质实例，不得意外修改同类实体的共享状态。

#### Scenario: Shared aircraft geometry

- **WHEN** 场景中存在多个相同类型敌机
- **THEN** 敌机共享几何和静态材质，实体姿态和损伤状态仍然可以独立更新

#### Scenario: Aircraft disposal

- **WHEN** 飞机实例从战斗场景移除
- **THEN** 实例释放自身节点和动态资源，不错误销毁仍被其他实例使用的共享几何与材质

#### Scenario: Repeated configurations and scene exits

- **WHEN** 玩家反复切换机库机体、开始战斗和结束出击
- **THEN** 仍在用的共享资源保持有效，离场实例持有的资源可回收，缓存不会随切换次数持续增长
