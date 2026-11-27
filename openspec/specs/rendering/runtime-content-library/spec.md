# rendering/runtime-content-library Specification

## Purpose

定义 KnightOnAir 中动态创建内容的运行时内容库。库统一管理可复用的三维内容、战斗特效和二维界面内容，避免在模拟、渲染和页面流程中重复创建相同对象。三维、特效和二维内容拥有独立的目录、生命周期和渲染接口，同时通过内容 ID、局部锚点和公开事件协议协作。

## Requirements

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

### Requirement: Data-driven content IDs

可复用内容 MUST 使用稳定的内容 ID 和纯数据描述。内容配置不得直接保存 Three.js 对象、DOM 节点或运行时可变状态。未知内容 ID MUST 在配置校验阶段报告错误。

#### Scenario: Geometry registration

- **WHEN** 机体配置引用一个几何 ID
- **THEN** 3D 内容库可以从 GeometryCatalog 取得共享几何，缺失 ID 会被配置校验发现

#### Scenario: Effect profile registration

- **WHEN** 战斗事件引用一个特效 profile ID
- **THEN** 特效系统使用该 profile 的颜色、发光、粒子、烟雾和生命周期参数创建效果

#### Scenario: UI component registration

- **WHEN** 页面配置引用一个 2D 组件 ID
- **THEN** 2D 内容库返回对应组件和渲染器，组件状态不混入全局页面模板

### Requirement: Shared 3D anchor contract

部件、武器挂点、发动机出口、烟雾锚点、命中特效锚点和碎屑脱落锚点 MUST 使用统一的局部三维锚点格式。玩家和敌人 MUST 使用同一个局部到世界变换，包含实体位置、heading、bank、局部高度、局部旋转和实体速度。

#### Scenario: Banked aircraft mount

- **WHEN** 飞机改变 heading 或 bank
- **THEN** 枪口、炮管、发动机烟雾和挂点特效保持在相同局部锚点，并跟随实体姿态

#### Scenario: Hit residue anchor

- **WHEN** 投射物命中飞机
- **THEN** 命中爆点使用命中时的世界姿态，残留烟雾可以脱离实体继续留在世界坐标

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

### Requirement: Profile-driven effects

特效库 MUST 使用 profile 描述枪口爆点、外发光粒子、命中爆点、火花、烟雾、爆炸、冲击环和碎屑。profile MUST 支持外发光核心、柔和光晕、粒子数量、粒子速度、持续时间、风场漂移、是否跟随实体和是否继承实体速度。

#### Scenario: Emissive muzzle effect

- **WHEN** 武器从真实挂点开火
- **THEN** 枪弹每次成功发射均从对应枪管生成低多边形发光球芯、外发光粒子和一股独立枪烟。配置外抛壳的武器从自己的抛壳口抛壳

#### Scenario: Persistent impact smoke

- **WHEN** 投射物命中世界位置
- **THEN** 特效系统生成外发光命中爆点、碎屑和短时残留烟雾，烟雾在命中世界位置漂移、变淡并回收

#### Scenario: Attached damage smoke

- **WHEN** 发动机或机翼持续损伤
- **THEN** 每个活跃破洞从自己的局部锚点发烟或喷火。同一部件的多股烟火可以并存，滚转、维修和脱落后仍对应各自洞口

### Requirement: Aircraft propulsion and flight effects

特效库 MUST 依据机型、实际油门、生效加力、加速度及转弯载荷驱动 3D low-poly 推进与气动效果。喷口焰芯和桨盘滑流起点跟随各自部件，已发出的尾烟和气流段保留世界轨迹。

#### Scenario: Piston and jet boost transitions

- **WHEN** 活塞或喷气飞机从巡航加大油门、进入加力再退出
- **THEN** 活塞机持续从排气口拉出粗细起伏的浓烟，并随油门增强烟柱及桨流。喷气机的喷口火苗随油门伸缩，接续淡而连续的尾烟。烟根随对应排气口或喷口旋转，已发出的尾烟沿世界轨迹随风消散

#### Scenario: Aircraft accelerates and banks

- **WHEN** 飞机直线加速后进入急转
- **THEN** 加速强化尾流和突出点气流，达到机型配置门限时出现机头冲击波。急转强化翼面气流、主翼尖涡和适用的尾翼尖涡，突出点气流仍较弱且清晰可辨

#### Scenario: Bullet flight and impact

- **WHEN** 枪弹离开枪口、飞行并命中目标
- **THEN** 弹头的薄冲击波随弹体前进，命中时在接触位置产生发光爆点和对应的碎屑与残烟

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

### Requirement: Bounded pooling and caching

短生命周期的弹道尾迹、发光爆点、发光粒子、烟雾、火花、冲击环和碎屑 MUST 使用有界对象池或实例批次。静态几何、材质和纹理 MUST 使用共享缓存。对象池耗尽时 MUST 使用定义的降级策略，不得在战斗帧中无限创建对象。

#### Scenario: Full combat pool

- **WHEN** 满额战斗同时产生连续开火、命中、烟雾和碎屑
- **THEN** 系统保持固定容量并按优先级回收或丢弃低优先级效果

#### Scenario: Low quality fallback

- **WHEN** 设备进入低质量档位或帧率低于安全阈值
- **THEN** 系统减少粒子数量、烟雾层数和光晕采样，保留关键外发光爆点、命中方向和颜色区分

### Requirement: 2D component library

2D 内容库 MUST 提供可复用的 HUD、雷达、边缘威胁、敌机标签、战斗告警、反馈列表、按钮、计量条、弹窗和图标组件。重复数量高且每帧更新的元素 MUST 支持 DOM 节点池或等效复用。

#### Scenario: Radar contacts

- **WHEN** 雷达接触目标数量在连续帧之间变化
- **THEN** 2D 内容库复用雷达节点并只更新位置、状态和可见性

#### Scenario: Combat feed

- **WHEN** 命中、部件禁用或击毁事件进入反馈列表
- **THEN** 2D 内容库使用统一反馈项组件更新内容，并限制活动项数量

### Requirement: Content library performance

内容库 MUST 记录并暴露几何、材质、特效池、DOM 池、实例批次和绘制次数的诊断信息。新内容不得通过重复创建相同几何、材质、纹理或界面节点破坏既有渲染预算。

#### Scenario: Runtime content diagnostics

- **WHEN** 开发环境运行满额战斗验收场景
- **THEN** 诊断数据可以区分共享资源数量、活动池数量、实例批次数量和动态创建次数

