# Combat Content and Eras Delta

## MODIFIED Requirements

### Requirement: Era content selection

玩家名录 MUST 只收录有可用专属三维装配器的机型，并沿用校验台的历史时代分组。已有可用校验模型的早期机型可以沿用该模型出击，校验台继续显示其几何近似与待核对项。

时代 MUST 定义标签、自由巡航主题、颜色、敌人池、阶段和层级上限，生成和局外展示 MUST 使用同一时代上下文。战役关卡 MUST 通过关卡 ID 选择，并引用所属时代解析兼容内容。

#### Scenario: Reference aircraft enter the playable roster

- **WHEN** 玩家在机库预览、装备或驾驶一架已接入的机型
- **THEN** 游戏使用校验台同一机型的专属基础装配器，战斗部件、挂点和解锁条件来自该机型配置

#### Scenario: A mission era has no playable aircraft of its own

- **WHEN** 某个关卡时代没有可装备机型
- **THEN** 该时代不出现在装备筛选中，关卡仍按已有规则使用指定或已装备的机型

#### Scenario: Era enemy pool
- **WHEN** 自由巡航或战役世界进入指定时代
- **THEN** 相应敌人池、运动 profile 和基础颜色来自该时代配置
- **AND** 自由巡航任务标签来自时代主题，战役任务标签来自所选关卡

#### Scenario: Multiple missions share an era
- **WHEN** 玩家选择同一时代的两个不同战役关卡
- **THEN** 两关按各自的关卡身份配置任务、指定遭遇、装配和环境，同时共享时代可用内容及预算上限
