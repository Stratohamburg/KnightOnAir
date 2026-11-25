# Weather

## Purpose

定义出击时的可配置天气、风和能见度，以及局内天气如何平滑过渡。飞行与环境渲染共享模拟天气，允许关卡编排稳定的教学条件或逐步变化的战场条件。

## ADDED Requirements

### Requirement: Selectable sortie weather

出击 MUST 支持晴朗、多云、阵风、薄雾和小雨预设。天气预设 MUST 定义可解析的 ID、风向或风场参数、风速与阵风上限、云覆盖、视距和降水强度。未配置天气的出击 MUST 使用兼容原有巡航风场和云层的默认预设。

#### Scenario: Training starts with stable weather
- **WHEN** 关卡指定晴朗、低风和固定天气
- **THEN** 从入场到完成训练阶段，风力保持在低风配置范围，环境不会自动切入雨雾或强阵风

#### Scenario: Weather presets are distinct
- **WHEN** 在同一场景、时段和镜头下分别载入各预设
- **THEN** 多云具有更高云覆盖，阵风体现更强的风力变化，薄雾降低远处可见度，小雨有可辨识的降水效果

### Requirement: Shared weather-dependent wind

天气 MUST 为飞机、弹道、轰炸稳定度、烟雾、云和植被提供一致的模拟风场语义。天气对飞行和武器的作用 MUST 通过已有风响应和目标判定规则表达。

#### Scenario: Gust affects the same world
- **WHEN** 阵风预设在同一位置产生更强风力
- **THEN** 飞行和现有受风行为使用该位置的风场，云与植被的变动方向和强度与采样一致
- **AND** 暂停与画质切换不会额外改变实际风力或武器结果

### Requirement: Authored weather transitions

关卡 MUST 能以模拟时刻或任务阶段开始天气过渡。连续天气参数 MUST 在配置的过渡区间内从当前有效状态平滑变化，且相同关卡、种子和输入重放产生相同变化。

#### Scenario: Clouds increase during mission
- **WHEN** 第 12 关到达配置的晴转多云触发条件
- **THEN** 云量和能见度在指定过渡区间内变化，现有云层保持空间连续
- **AND** 局内环境提示在有意义的天气切换时出现一次

#### Scenario: Pause during changing weather
- **WHEN** 玩家在天气过渡中暂停或打开升级
- **THEN** 风、云、雨雾状态和过渡进度保持当前值，恢复后从当前模拟步继续

### Requirement: Visibility and quality parity

天气 MUST 允许云、雾和雨削弱世界物体的视觉可见度，同时保持玩家机体、任务导航、重要告警、准心和有效投放状态的可读性。各画质 MUST 共用天气与遮挡语义。

#### Scenario: Rainy escort scene
- **WHEN** 第 14 关以小雨运行且友方目标进入低能见度区域
- **THEN** 可通过雷达或边缘指示继续追踪友方目标和关键来袭方向，投放与命中仍按模拟规则判定
- **AND** 省电档使用有界的雨粒子或等效表现，任务状态和目标方向与标准档一致
