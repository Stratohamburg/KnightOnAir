# Spec Delta

## ADDED Requirements

### Requirement: Upgrade presentation content

升级预览和正式安装表现 MUST 通过现有三维内容库、飞机工厂、局部锚点和特效 profile 创建，展示副本不得把 Three.js 对象或 DOM 节点写入模拟状态。

#### Scenario: Preview refit part

- **WHEN** 玩家选中一个会新增部件的升级
- **THEN** 展示层从当前构型和配置 ID 创建预览部件，使用正式局部锚点和中心线布局

#### Scenario: Preview disposal

- **WHEN** 玩家切换候选、关闭升级或完成安装
- **THEN** 旧展示副本释放自己的节点和动态资源，不销毁仍被正式飞机或其他实例使用的共享资源

#### Scenario: Repeated wing extensions

- **WHEN** 玩家预览或正式安装多个同侧翼段
- **THEN** 每个翼段使用稳定部件 ID、共享静态几何和独立实例状态，资源数量不会随候选切换无界增长

### Requirement: Upgrade installation event boundary

模拟层 MUST 通过公开升级事件描述新增部件、武器挂点、安装姿态和动画类型，渲染、音频、触觉和 HUD 系统负责消费事件并产生表现。

#### Scenario: Simulation emits installation event

- **WHEN** 玩家确认并成功支付升级
- **THEN** 世界发出包含升级 ID、部件 ID、武器挂点、事件姿态和动画类型的安装事件

#### Scenario: Presentation does not mutate simulation

- **WHEN** 渲染层、音频或 HUD 消费升级预览和安装事件
- **THEN** 这些系统只改变展示状态，不直接修改模拟生命、金币、升级次数或飞行阶段

#### Scenario: Event consumed once

- **WHEN** 一个渲染帧包含多个模拟步产生的升级事件
- **THEN** 每个呈现系统对每个事件消费一次，动画使用事件发生时的部件和姿态数据

### Requirement: Refit animation remains bounded

升级安装动画 MUST 使用有界实例和可回收的短生命周期表现，不能因连续扩建或快速切换候选在战斗帧中无限创建对象。

#### Scenario: Ten-segment installation

- **WHEN** 玩家连续安装同侧十个扩建段
- **THEN** 十个部件动画可以顺序完成，短生命周期效果通过现有对象池或等效复用回收

#### Scenario: Low quality upgrade feedback

- **WHEN** 设备处于低质量档位或帧率低于安全阈值
- **THEN** 系统减少安装粒子、光晕和抖动强度，保留部件位置、尺寸变化和确认音效

