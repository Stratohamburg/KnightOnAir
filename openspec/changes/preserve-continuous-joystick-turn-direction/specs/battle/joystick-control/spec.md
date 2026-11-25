# Spec Delta

## Purpose

定义移动端虚拟摇杆如何把指针轨迹转换为可预测的飞机控制意图。该能力保证摇杆方向、油门行程和连续拨动方向在角度临界点、输入中断、模式切换和固定步长回放中保持一致。

## ADDED Requirements

### Requirement: Absolute heading and throttle remain separate

摇杆 MUST 保持“方向决定目标航向、距离决定普通油门和加力请求”的基础语义。方向输入 MUST 使用归一化后的摇杆方向，油门和加力 MUST 不改变目标航向的含义。

#### Scenario: Direction and travel are read independently
- **WHEN** 玩家把摇杆拖到任意非死区方向并改变拖动距离
- **THEN** 系统保持同一目标方向，同时只调整普通油门或加力请求

#### Scenario: Direct opposite direction remains a heading request
- **WHEN** 玩家从当前方向把摇杆直接移动到相反方向而没有形成连续环绕轨迹
- **THEN** 系统把输入解释为新的目标航向，并允许飞行模型使用正常的最短收敛路径

### Requirement: Continuous turn direction survives the angular boundary

摇杆 MUST 从连续的有效指针轨迹中识别顺时针或逆时针拨动方向。连续轨迹跨过角度表示的 `-π/π` 临界点时，输出的转向偏好 MUST 保持轨迹方向，不得仅因目标角度数值换支而反向。

#### Scenario: Clockwise sweep crosses the heading boundary
- **WHEN** 玩家持续顺时针拨动摇杆，摇杆方向从临界点一侧连续移动到另一侧
- **THEN** 玩家输入保持顺时针转向偏好，飞机在临界点后继续向右转

#### Scenario: Counter-clockwise sweep crosses the heading boundary
- **WHEN** 玩家持续逆时针拨动摇杆，摇杆方向从临界点一侧连续移动到另一侧
- **THEN** 玩家输入保持逆时针转向偏好，飞机在临界点后继续向左转

### Requirement: Direction lock uses hysteresis and settles at the target

系统 MUST 在连续角位移达到方向锁定阈值后才建立转向偏好，并使用反向滞后避免微小抖动立即切换方向。飞机接近目标航向后 MUST 允许转向偏好退出，让姿态稳定收敛而不会为了保持历史方向绕行整圈。

#### Scenario: Small jitter does not switch direction
- **WHEN** 玩家在角度临界点附近来回抖动，反向累计位移未达到反向滞后阈值
- **THEN** 系统保持原有转向偏好，飞机不会在左右转之间快速摆动

#### Scenario: Deliberate reversal changes direction
- **WHEN** 玩家持续向相反方向拨动，反向累计位移达到反向滞后阈值
- **THEN** 系统切换转向偏好，并从新的方向继续处理目标航向

#### Scenario: Reaching the target releases the long-path preference
- **WHEN** 飞机进入目标航向的收敛窗口
- **THEN** 系统停止强制长路径转向，飞机稳定对准目标并保持有限的转向速度

### Requirement: Gesture lifecycle resets are explicit

系统 MUST 在指针释放、取消、失去捕获、页面失焦和飞行模式重置时清除连续拨动状态。清除连续拨动状态 MUST 停止新增方向输入，同时保留正常的松杆滑行语义。

#### Scenario: Pointer interruption clears the gesture
- **WHEN** 当前摇杆指针触发 `pointerup`、`pointercancel`、`lostpointercapture` 或页面失焦
- **THEN** 系统立即清除连续转向偏好和摇杆活动状态，飞机不再接收旧手势的方向输入

#### Scenario: Mode switch starts a fresh gesture
- **WHEN** 玩家在普通空战和轰炸模式之间切换
- **THEN** 系统清除上一模式的连续拨动状态，下一次有效拖动从新的手势开始

### Requirement: Fixed-step input snapshots preserve gesture intent

连续转向偏好 MUST 作为玩家输入快照的一部分进入固定步长模拟和回放。相同的输入快照序列在不同渲染帧率下 MUST 产生一致的转向方向和飞行结果。

#### Scenario: Replay preserves a boundary-crossing sweep
- **WHEN** 回放重放一段跨过角度临界点的连续摇杆输入序列
- **THEN** 回放实体使用与玩家相同的连续转向偏好，并保持相同的转向方向

#### Scenario: Render rate does not change gesture direction
- **WHEN** 30、60 和 120 FPS 使用相同固定步长输入快照序列运行同一段连续拨动
- **THEN** 飞机的转向方向、航向和 bank 在允许误差内一致
