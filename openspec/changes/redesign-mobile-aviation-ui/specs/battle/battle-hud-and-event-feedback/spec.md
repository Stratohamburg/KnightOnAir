# battle/battle-hud-and-event-feedback Delta Specification

## MODIFIED Requirements

### Requirement: Player status HUD

HUD MUST 展示生命、加力储备、XP、等级、时间、分数、战斗阶段和可用升级次数，并与世界状态同步。局内三维战斗场景 MUST 铺满整个竖屏视口高度，不得通过底部不透明实心甲板截断三维渲染画布；状态仪、摇杆与战斗动作按钮 MUST 以半透明悬浮复古航空仪表形式排布，底部操控区遵循右手单手大拇指短路径（中央悬浮摇杆、摇杆左上改装按钮、摇杆右上轰炸开关、摇杆右下投弹环表），相邻控件保持清晰视觉间距与不重叠触控热区，最大化核心空战视野。

#### Scenario: Health changes

- **WHEN** 玩家受到伤害或获得修理
- **THEN** 顶部紧凑双轨仪表中的生命数值和进度条在下一次 HUD 更新中反映新的状态

#### Scenario: Upgrade count

- **WHEN** 玩家获得或消费升级次数
- **THEN** 悬浮改装按钮的状态高亮和数量角标同步变化

#### Scenario: Full-height battlefield visibility

- **WHEN** 玩家进入战斗或切换到轰炸模式
- **THEN** 三维战斗画布保持 100% 视口高度，中央悬浮摇杆与周边紧凑仪表按钮仅占据底部与边缘局部区域，不遮挡居中飞行的玩家机体

### Requirement: Action availability feedback

HUD MUST 显示升级可用次数，以及投弹的准备、装填、不可用原因和可投放状态。局内战斗控制按钮（改装升级、轰炸模式切换、投弹、暂停、帮助）MUST 采用与操作频率匹配的紧凑仪表尺寸，轰炸模式下投弹环表与稳定进度清晰可辨，能够明确区分未安装弹舱、弹舱失效、装填中、准心未稳定或超出投弹包线以及可投放状态；非轰炸模式下隐藏投弹按钮以减少画面占用。

#### Scenario: Bomb reload indicator

- **WHEN** 玩家在轰炸模式中等待炸弹装填
- **THEN** 悬浮投弹仪表环显示装填剩余时间和环形进度，准心未稳定或装填未完成时保持禁用态

#### Scenario: Bombing unavailable reasons are distinguishable

- **WHEN** 玩家因未安装弹舱、弹舱损毁失效、准心尚未稳定或落点超出投弹包线而无法投弹
- **THEN** 轰炸开关或投弹仪表环显示与当前模拟判定一致的明确状态提示，并保持禁用态

#### Scenario: Non-bombing combat keeps right edge clean

- **WHEN** 玩家处于普通空战巡航阶段
- **THEN** 投弹环表保持隐藏，摇杆周边仅保留左上改装升级与右上轰炸模式切换控件，不占用额外画面空间
