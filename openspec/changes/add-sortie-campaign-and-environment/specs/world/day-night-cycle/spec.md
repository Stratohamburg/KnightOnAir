# Day and Night Cycle

## Purpose

定义关卡起始时段、固定与推进模式，以及日夜过渡中的天空、世界光照和战斗信息可读性。局内时段以模拟时间为依据，支持重试和回放复现同一环境。

## ADDED Requirements

### Requirement: Mission time of day

出击 MUST 支持黎明、白天、黄昏和夜间起始时段。关卡 MUST 能选择固定时段，或按模拟时间或任务阶段触发有界的时段推进。未配置时段的出击 MUST 使用兼容原有巡航光照的白天预设。

#### Scenario: Fixed night escort
- **WHEN** 第 19 关以固定夜间开始
- **THEN** 简报和战斗显示同一个时段，护送期间保持夜间
- **AND** 重试使用同一起始时段和配置

#### Scenario: Authored dusk to night
- **WHEN** 第 20 关到达配置的时段触发条件
- **THEN** 世界按配置的持续时间从黄昏连续进入夜间，天气继续沿自己的状态推进
- **AND** HUD 在进入新时段时提示一次

### Requirement: Unified scene illumination

天空、云层、远景雾、地表、水面和机体 MUST 使用一致的时段光照状态。夜间 MUST 具有可辨识的轮廓和环境光，天气对光照的影响 MUST 与时段状态共同呈现。

#### Scenario: Transition passes below the horizon
- **WHEN** 主光方向跨越地平线进入夜间
- **THEN** 天空与云层、地表阴影、水面和机体平滑改变亮度、色调和投影
- **AND** 地平线附近与夜间的云影、阴影或替代表现保持有限且稳定

#### Scenario: Overcast period at dusk
- **WHEN** 同一出击在多云天气从白天进入黄昏
- **THEN** 云量与能见度仍满足天气状态，天空和各表面的受光体现同一个黄昏时段

### Requirement: Deterministic time progression

日夜进度 MUST 由战斗固定步进推进。允许跨越午夜的配置 MUST 保持时间连续。暂停、重试与画质变化 MUST 根据同一局内时钟保持或恢复状态。

#### Scenario: Pause or replay a transition
- **WHEN** 玩家暂停时段过渡或以相同关卡、种子和输入重放
- **THEN** 暂停时停在当前进度，重放在相同模拟步得到同一时段和光照状态

#### Scenario: Cross midnight
- **WHEN** 一个推进片段跨越午夜
- **THEN** 局内时间按配置继续前进，环境光照没有跳回白天

### Requirement: Night combat readability

夜间各画质 MUST 保持玩家机体、己方目标、任务航点、关键告警、准心及投弹状态可辨识。夜间光照 MUST 保持既有装配、锁定、伤害与命中的判定语义。

#### Scenario: Target leaves the illuminated area
- **WHEN** 第 19 关的运输机离开亮区或飞出屏幕
- **THEN** HUD 仍能区分友机、航点和来袭敌机，并通过雷达或方向指示给出可执行的引导
