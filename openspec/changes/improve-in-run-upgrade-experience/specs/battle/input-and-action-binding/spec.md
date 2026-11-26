# Spec Delta

## MODIFIED Requirements

### Requirement: Unified player actions

触控和键盘 MUST 分别支持其对应的飞行与战斗动作，并使用相同的玩法判定。当前动作包括转向、普通油门、加力、切换轰炸、投弹、打开升级、选择升级和确认安装。

#### Scenario: Touch and keyboard equivalence

- **WHEN** 玩家用触控摇杆或键盘表达相同的移动方向
- **THEN** 战斗世界收到等价的转向和油门意图

#### Scenario: Button action dispatch

- **WHEN** 玩家点击投弹、升级、候选或确认按钮
- **THEN** 系统向对应玩法发送一个明确动作，并且不会把按钮点击误当成摇杆输入

#### Scenario: Keyboard upgrade confirmation

- **WHEN** 桌面玩家使用键盘选择候选并触发确认动作
- **THEN** 系统产生与触控选择和确认相同的预览、支付和安装结果

### Requirement: Input priority and gating

系统 MUST 根据当前应用和战斗阶段屏蔽不适用动作。升级选择阶段只允许选择候选、合法确认或返回战斗，安装期间等待安装完成。

#### Scenario: Return to combat from upgrade selection

- **WHEN** 玩家在确认前选择「返回战斗」
- **THEN** 系统关闭升级选择并恢复此前的战斗模式，保留升级次数和当前候选供下次打开使用

#### Scenario: Upgrade modal gating

- **WHEN** 升级选择界面打开
- **THEN** 摇杆、轰炸、投弹和暂停动作被屏蔽，升级候选选择保持可用

#### Scenario: Confirm gating

- **WHEN** 没有选中候选、候选价格不足或候选已经失效
- **THEN** 确认安装动作被屏蔽，升级界面保持打开

#### Scenario: Confirm dispatch

- **WHEN** 玩家选中合法且买得起的候选并触发确认
- **THEN** 系统只提交一次安装动作，防止重复点击造成重复扣款或重复安装

#### Scenario: Pointer cancellation

- **WHEN** 触控指针取消、失去捕获或窗口失焦
- **THEN** 当前摇杆输入立即清零并释放捕获状态

### Requirement: Accessible action controls

战斗按钮和升级候选 MUST 支持触控、鼠标和键盘操作，并依据对应玩法的可用状态处理动作。选中状态、支付状态和确认禁用原因 MUST 能被辅助技术读取。

#### Scenario: Disabled action

- **WHEN** 投弹因装填冷却或炸弹舱损伤不可用
- **THEN** 投弹按钮处于禁用状态，快捷键也无法投放炸弹

#### Scenario: Upgrade selection state

- **WHEN** 玩家选中一个升级候选
- **THEN** 候选按钮暴露选中状态，确认按钮暴露价格和可用状态

