# Spec Delta

## MODIFIED Requirements

### Requirement: Director and pilot boundary

导演 MUST 只负责空中单位的刷新时机、角色、编组、入口位置和预算。单位生成后，NPC 飞行员 MUST 根据自身角色和实时相对几何持续产生控制意图，导演不得替代每个固定步的追击、射击、脱离或重新切入决策。

#### Scenario: Spawned aircraft owns its behavior

- **WHEN** 导演完成一架空中单位的安全生成
- **THEN** 该单位由自身飞行员策略决定目标点、速度、加力和开火意图，直到离场或被击毁

#### Scenario: Director does not overwrite a maneuver

- **WHEN** 空中 NPC 正在执行尾追、交会、脱离或护航动作
- **THEN** 导演只更新遭遇生命周期和预算，不直接改写 NPC 的位置、速度、航向或当前动作

### Requirement: Configured air-combat behavior

空中敌人 profile MUST 定义共享飞行模型所需的速度、加速度、转向响应、攻击速度、攻击窗口、尾后保持距离、脱离距离、重新切入距离、目标提前量和受损逃逸阈值。导演 MUST 为普通追猎机安排后方或侧后方入口，并根据 profile 选择追击、拦截、护航、俯冲、横穿或 standoff 行为。

#### Scenario: Air enemy attack cycle

- **WHEN** 空中敌人进入攻击距离和攻击角
- **THEN** 敌人按照 profile 进入 attacking，完成攻击窗口或失去尾后几何后进入 breaking，拉开距离后重新进入巡航或攻击

#### Scenario: Tail hunter wave

- **WHEN** 导演生成包含普通追猎机的空中波次
- **THEN** 至少一个追猎机从玩家后方或侧后方的安全屏外位置进入，并保留可读的尾后接近路线
- **AND** 同一波的其他单位使用侧向、截击或支援职责，避免所有单位沿同一条正面航线接近

#### Scenario: High-speed interceptor

- **WHEN** 截击机或俯冲机进入攻击阶段
- **THEN** 其攻击速度高于巡航速度，并在攻击结束后保持脱离航向，不直接黏在玩家尾部

#### Scenario: Low-speed bomber

- **WHEN** 轰炸机执行路线攻击
- **THEN** 轰炸机沿横穿或 standoff 目标点移动，不使用普通追猎机的尾后保持逻辑

#### Scenario: Spawn remains safe for rear entry

- **WHEN** 后方或侧后方候选点位于当前视野、越过边界或与现存空中单位过近
- **THEN** 导演拒绝该点并在请求有效期内尝试其他安全入口
