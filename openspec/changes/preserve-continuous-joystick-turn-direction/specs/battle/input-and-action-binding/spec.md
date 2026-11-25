# Spec Delta

## MODIFIED Requirements

### Requirement: Joystick and throttle semantics

摇杆 MUST 将绝对目标方向、移动强度、加力请求和连续拨动方向偏好分开输出。方向决定目标航向，移动强度决定普通油门，外圈行程决定加力请求。松手后必须停止方向输入并保留合理的滑行语义，跨过角度临界点的连续拨动不得因为角度归一化而反转。

#### Scenario: Partial joystick travel
- **WHEN** 玩家把摇杆拖到内圈的部分距离
- **THEN** 系统输出对应的绝对目标方向和普通油门强度，不触发加力

#### Scenario: Outer boost travel
- **WHEN** 玩家把摇杆拉到外圈且加力可用
- **THEN** 系统输出当前绝对目标方向、普通油门强度和加力请求，摇杆同步显示加力输入状态

#### Scenario: Continuous sweep keeps its turn preference
- **WHEN** 玩家沿顺时针或逆时针连续拖动摇杆并跨过角度表示的临界点
- **THEN** 系统额外输出连续拨动方向偏好，战斗世界继续沿该方向转弯

#### Scenario: Direct reposition uses normal heading convergence
- **WHEN** 玩家把摇杆直接移到另一个方向且没有形成达到阈值的连续角位移
- **THEN** 系统只输出新的绝对目标方向，飞行模型按正常目标航向规则收敛

#### Scenario: Reversal uses direction hysteresis
- **WHEN** 玩家从当前连续拨动方向改向相反方向
- **THEN** 系统在反向累计位移达到滞后阈值后才切换连续拨动方向，临界点附近的小幅抖动不会改变方向

### Requirement: Input priority and gating

系统 MUST 根据当前应用和战斗阶段屏蔽不适用动作，并且输入优先级必须稳定。触控指针取消、失去捕获或窗口失焦时，系统 MUST 立即清零当前摇杆输入、连续拨动方向偏好并释放捕获状态。

#### Scenario: Upgrade modal gating
- **WHEN** 升级选择界面打开
- **THEN** 摇杆与轰炸动作被屏蔽，升级卡片选择保持可用

#### Scenario: Pointer cancellation
- **WHEN** 触控指针取消、失去捕获或窗口失焦
- **THEN** 当前摇杆输入立即清零并释放捕获状态，下一次有效拖动从新的连续手势开始
