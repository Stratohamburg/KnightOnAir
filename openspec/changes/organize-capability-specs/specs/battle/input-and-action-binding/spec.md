# Spec Delta

## Purpose

定义触控、键盘和界面按钮如何转换为统一的玩家动作，覆盖摇杆、油门、加力、轰炸、升级、暂停和可扩展技能入口。

## ADDED Requirements

### Requirement: Unified player actions

所有输入设备 MUST 产生统一的语义动作，包括转向、普通油门、加力、切换轰炸、投弹、打开升级、暂停和技能触发。

#### Scenario: Touch and keyboard equivalence

- **WHEN** 玩家用触控摇杆或键盘表达相同的移动方向
- **THEN** 战斗世界收到等价的转向和油门意图

#### Scenario: Button action dispatch

- **WHEN** 玩家点击投弹、升级、暂停或技能按钮
- **THEN** 系统向对应玩法发送一个明确动作，并且不会把按钮点击误当成摇杆输入

### Requirement: Joystick and throttle semantics

摇杆 MUST 将方向、移动强度和加力请求分开输出，松手后必须停止方向输入并保留合理的滑行语义。

#### Scenario: Partial joystick travel

- **WHEN** 玩家把摇杆拖到内圈的部分距离
- **THEN** 系统输出对应方向和普通油门强度，不触发加力

#### Scenario: Outer boost travel

- **WHEN** 玩家把摇杆拉到外圈且加力可用
- **THEN** 系统输出加力请求，界面同步显示加力状态和能量反馈

### Requirement: Input priority and gating

系统 MUST 根据当前应用和战斗阶段屏蔽不适用动作，并且输入优先级必须稳定。

#### Scenario: Upgrade modal gating

- **WHEN** 升级选择界面打开
- **THEN** 摇杆、轰炸和技能动作被屏蔽，升级卡片选择保持可用

#### Scenario: Pointer cancellation

- **WHEN** 触控指针取消、失去捕获或窗口失焦
- **THEN** 当前摇杆输入立即清零并释放捕获状态

### Requirement: Accessible action controls

按钮和技能入口 MUST 支持触控、鼠标和键盘激活，并且可用状态、冷却状态和不可用原因必须可读。

#### Scenario: Disabled action

- **WHEN** 投弹或技能因冷却、损伤或资源不足不可用
- **THEN** 按钮保持不可触发并显示对应状态
