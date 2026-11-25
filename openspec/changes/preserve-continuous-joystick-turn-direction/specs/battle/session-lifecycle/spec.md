# Spec Delta

## MODIFIED Requirements

### Requirement: Flight response

飞机 MUST 按机体、当前构型和损伤限制改变航向、速度与滚转。普通油门用于加速，加力使用独立储备。玩家存在连续拨动方向偏好且目标位于角度临界分支时，飞行模型 MUST 保持该偏好对应的转向方向，并在接近目标后稳定收敛。

#### Scenario: Release directional input
- **WHEN** 玩家释放方向输入
- **THEN** 飞机保持目标航向，速度回到巡航范围，机体滚转逐步回正

#### Scenario: Boost depletes its reserve
- **WHEN** 玩家加力并耗尽储备
- **THEN** 飞机退出加力，重新启用加力需要回充并释放加力请求

#### Scenario: Clockwise input remains clockwise across the boundary
- **WHEN** 玩家连续顺时针拨动摇杆，目标航向跨过 `-π/π` 临界点
- **THEN** 飞机的实际转向速度保持顺时针符号，不因为最短角度分支改变而突然左转

#### Scenario: Counter-clockwise input remains counter-clockwise across the boundary
- **WHEN** 玩家连续逆时针拨动摇杆，目标航向跨过 `-π/π` 临界点
- **THEN** 飞机的实际转向速度保持逆时针符号，不因为最短角度分支改变而突然右转

#### Scenario: Target convergence ends the directional preference
- **WHEN** 飞机进入目标航向的收敛窗口
- **THEN** 飞机停止被迫沿长路径继续转向，bank、turnVelocity 和 heading 平稳收敛

#### Scenario: Damage changes authority without changing intent
- **WHEN** 左右转向控制面受到不对称损伤，玩家继续保持同一侧连续拨动
- **THEN** 受损侧的响应幅度按损伤降低，实际转向方向仍与玩家输入偏好一致

#### Scenario: Fixed-step replay is deterministic
- **WHEN** 玩家、回放实体和不同渲染帧率使用相同初始状态与连续转向输入快照序列
- **THEN** 固定步长推进得到一致的转向方向、航向、bank、位置和速度，结果保持在既有允许误差内
