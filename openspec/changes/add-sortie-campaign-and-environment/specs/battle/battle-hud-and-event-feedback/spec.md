# Battle HUD and Event Feedback Delta

## ADDED Requirements

### Requirement: Persistent actionable objective

战役 HUD MUST 持续显示当前阶段的动作与目标，以及适用的击毁数、波次、倒计时、友方耐久或航程。在当前阶段变化时，进度与目标标记 MUST 同步更新。

#### Scenario: A different target becomes actionable
- **WHEN** 玩家摧毁雷达车并进入空战阶段
- **THEN** 短提示说明阶段变化，常驻任务和引导同步切到敌机
- **AND** 普通敌人击毁继续显示战斗反馈而不增加指定目标计数

### Requirement: Mission marker and threat coexistence

任务引导 MUST 在屏内名牌、屏外边缘标和雷达上提供一致且可区分的任务图标，覆盖空中、地面、水面、友方护送对象和航点。标记 MUST 用形状或文字区分任务身份，边缘优先显示最紧急且可行动的任务方向，并为即时威胁保留位置。

#### Scenario: Mission target and threat are both offscreen
- **WHEN** 列车或运输船位于屏外，另有近距离来袭敌机
- **THEN** HUD 仍给出任务目标的方向和名称，攻击告警继续可见
- **AND** 任务标记进入屏内时切换到实体或航点的名牌

#### Scenario: Weather or night veils the objective
- **WHEN** 云、雾、降雨或夜间光照削弱任务目标的世界可见度
- **THEN** 雷达或边缘方向继续表达目标身份和位置，任务进度、告警、锁定与投弹状态保持可读

### Requirement: Contextual practice prompts

首次学习机枪、投弹或锁定时，HUD MUST 在相应控制区或准心附近显示与当前操作状态一致的短提示。动作已完成或阶段结束时 MUST 清除该条提示。

#### Scenario: Bombing practice progresses
- **WHEN** 玩家在固定地靶教程中切入轰炸，随后松杆并进入允许投放状态
- **THEN** 提示依次指向入口、稳定和投放，按钮仍反映真实装配、包线、装填与稳定度

### Requirement: Meaningful environment feedback

当配置的天气或时段过渡影响玩家阅读场景时，HUD MUST 在对应的阶段变化时提示一次，当前任务与紧急告警保持可读。

#### Scenario: Environment changes during a fight
- **WHEN** 战役进入多云或夜间
- **THEN** HUD 提示新状态一次，常驻目标和即时战斗告警继续提供原有信息
