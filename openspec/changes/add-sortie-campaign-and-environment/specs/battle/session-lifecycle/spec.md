# Battle Session Lifecycle Delta

## MODIFIED Requirements

### Requirement: Starter sortie

出击页 MUST 默认进入战役并选择第 01 关「黎明草甸」，该关座机为福克 Dr.I（`heron_09`）。新档案默认装备并解锁福克 Dr.I。

#### Scenario: Launch the first sortie
- **WHEN** 新档案或装备其他机体的旧档案选择默认关卡点击出击
- **THEN** 预览、准备页和战斗 HUD 显示「黎明草甸」，玩家操控配有双联同步机枪的福克 Dr.I 完成固定空靶任务

#### Scenario: Choose another mission
- **WHEN** 玩家通过出击页选关选择一项已解锁的战役关卡
- **THEN** 预览、出击过渡、战斗 HUD、任务和敌群使用该关卡，座机按关卡装配规则选择
- **AND** 可自由选机的关卡使用当前装备及其兼容强化，选择关卡不改写存档装备

## ADDED Requirements

### Requirement: Campaign and free patrol entries

出击页 MUST 能进入战役选关和四个时代的自由巡航。战役简报 MUST 在出击前显示当前关名、主要任务、必要任务装配和影响战斗的起始环境。

#### Scenario: Start free patrol
- **WHEN** 玩家选择任一时代的自由巡航并出击
- **THEN** 世界使用该时代的无限遭遇、现有装备流程和巡航结算，页面以自由巡航标明当前模式

#### Scenario: Launch a compatible mission preset
- **WHEN** 玩家准备出击一项要求预设座机或挂载的战役关卡
- **THEN** 简报、出击过渡和首个战斗模拟步使用一致的任务配置，预设装备在出击结束时随局内构型清除

### Requirement: Mission result navigation

战役结算 MUST 呈现关卡身份、终局原因和局内统计。结算中的重试、下一关和返回 MUST 使用当前终局状态及已解锁战役顺序。

#### Scenario: Finish or retry a mission
- **WHEN** 玩家胜利并存在下一关，或从任一战役结算选择重试
- **THEN** 胜利结算提供「下一关」，其出击使用下一关的简报与配置
- **AND** 重试重新创建同关初始目标和环境，任务失败、坠毁或主动返航的结算显示具体原因
