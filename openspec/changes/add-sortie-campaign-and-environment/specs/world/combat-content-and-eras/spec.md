# Combat Content and Eras Delta

## MODIFIED Requirements

### Requirement: Era content selection

时代 MUST 定义标签、自由巡航主题、颜色、敌人池、阶段和层级上限，生成和局外展示 MUST 使用同一时代上下文。战役关卡 MUST 通过关卡 ID 选择，并引用所属时代解析兼容内容。

#### Scenario: Era enemy pool
- **WHEN** 自由巡航或战役世界进入指定时代
- **THEN** 相应敌人池、运动 profile 和基础颜色来自该时代配置
- **AND** 自由巡航任务标签来自时代主题，战役任务标签来自所选关卡

#### Scenario: Multiple missions share an era
- **WHEN** 玩家选择同一时代的两个不同战役关卡
- **THEN** 两关按各自的关卡身份配置任务、指定遭遇、装配和环境，同时共享时代可用内容及预算上限
