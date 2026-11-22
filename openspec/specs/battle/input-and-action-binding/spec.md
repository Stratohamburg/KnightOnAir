# battle/input-and-action-binding Specification

## Purpose

定义触控、键盘和战斗控制区如何提交相同的玩家意图，涵盖摇杆、油门、加力、投弹、改装与暂停，以及弹层和指针取消时的输入处理。

## Requirements

### Requirement: Unified player actions

触控和键盘 MUST 分别支持其对应的飞行与战斗动作，并使用相同的玩法判定。当前动作包括转向、普通油门、加力、切换轰炸、投弹、打开升级和暂停。

#### Scenario: Touch and keyboard equivalence

- **WHEN** 玩家用触控摇杆或键盘表达相同的移动方向
- **THEN** 战斗世界收到等价的转向和油门意图

#### Scenario: Button action dispatch

- **WHEN** 玩家点击投弹、升级或暂停按钮
- **THEN** 系统向对应玩法发送一个明确动作，并且不会把按钮点击误当成摇杆输入

### Requirement: Joystick and throttle semantics

摇杆 MUST 将方向、移动强度和加力请求分开输出，松手后必须停止方向输入并保留合理的滑行语义。

#### Scenario: Partial joystick travel

- **WHEN** 玩家把摇杆拖到内圈的部分距离
- **THEN** 系统输出对应方向和普通油门强度，不触发加力

#### Scenario: Outer boost travel

- **WHEN** 玩家把摇杆拉到外圈且加力可用
- **THEN** 系统输出加力请求，摇杆同步显示加力输入状态

### Requirement: Input priority and gating

系统 MUST 根据当前应用和战斗阶段屏蔽不适用动作，并且输入优先级必须稳定。

#### Scenario: Upgrade modal gating

- **WHEN** 升级选择界面打开
- **THEN** 摇杆与轰炸动作被屏蔽，升级卡片选择保持可用

#### Scenario: Pointer cancellation

- **WHEN** 触控指针取消、失去捕获或窗口失焦
- **THEN** 当前摇杆输入立即清零并释放捕获状态

### Requirement: Accessible action controls

战斗按钮 MUST 支持触控、鼠标和键盘操作，并依据对应玩法的可用状态处理动作。

#### Scenario: Disabled action

- **WHEN** 投弹因装填冷却或炸弹舱损伤不可用
- **THEN** 投弹按钮处于禁用状态，快捷键也无法投放炸弹
