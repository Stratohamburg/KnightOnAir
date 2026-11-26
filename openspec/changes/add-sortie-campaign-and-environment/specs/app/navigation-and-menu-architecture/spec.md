# Navigation and Menu Architecture Delta

## MODIFIED Requirements

### Requirement: Sortie page owns mission decisions

出击页 MUST 以副本信息为主内容，显示关卡或巡航名称、出击类型、目标、起始环境、最高积分、出击装配摘要和出击动作。完整载具数据只能在装备页展示。载具编辑、局外升级、抽奖、货币直购和调试校验 MUST 不出现在出击页内容区。

#### Scenario: Choose mission without changing equipment

- **WHEN** 玩家从出击页打开选关并选择另一个可用战役关卡或时代巡航
- **THEN** 选择弹窗返回出击简报并将焦点交还给选关按钮，已确认装备保持不变

#### Scenario: Launch uses selected mission and equipped aircraft

- **WHEN** 玩家点击出击
- **THEN** 新战斗使用当前选中的副本及简报上显示的装配，重复点击不会创建第二个战斗会话
- **AND** 自由巡航和允许自由选机的战役关卡使用当前装备，要求固定座机或任务挂载的关卡使用配置中的出击装配
