# Mission Objectives

## Purpose

定义战斗模拟如何激活、推进及结算战役任务，为 HUD、导演与结算提供一致的目标身份、计数、航程、失败原因和终局状态。任务判定随固定步进运行并可复现。

## ADDED Requirements

### Requirement: Authoritative mission progress

战役 MUST 在固定步进中判定当前阶段的目标进度，以稳定的任务目标身份关联战斗实例，且每个符合条件的实例只可推进一次计数。显示层 MUST 从模拟结果读取任务状态。

#### Scenario: Only marked targets count
- **WHEN** 当前阶段要求击毁指定目标，玩家击毁同类的普通敌人后再击毁指定目标
- **THEN** 两次击毁按战斗规则结算奖励，只有指定实例推进任务
- **AND** 重复消费击毁反馈时进度保持原值

#### Scenario: A stage exposes its actionable targets
- **WHEN** 一个阶段完成且游戏尚有下一阶段
- **THEN** 下一阶段按编排激活，模拟同步发布目标身份、总量、已完成量、可用位置或入场方位及条件相关进度
- **AND** 旧阶段目标停止参与当前计数和引导，终段完成只生成一次胜利

### Requirement: Deadline and breach objectives

限时与越线任务 MUST 从配置的可交战状态起执行。失败条件 MUST 对应目标到达的路线边界或明确的模拟时间截止点。

#### Scenario: Delayed placement preserves intercept window
- **WHEN** 目标按安全生成规则延迟入场
- **THEN** 未入场目标保持待入场，期限在达到可交战状态后才起算
- **AND** 有多个目标时，每个激活目标按自己的越线进度报告紧迫程度

#### Scenario: Target reaches the boundary alive
- **WHEN** 固定步进中的伤害已结算，受拦截目标仍存活并达到失败边界
- **THEN** 任务以该目标越线原因失败
- **AND** 同一步中已被击毁的目标计为成功拦截

### Requirement: Friendly protection and escort

任务 MUST 支持可受损的固定或移动友方目标、指定攻击其的敌人和可查询的航点进度。队伍与目标层约束 MUST 一致地用于敌人的选敌、开火和伤害。

#### Scenario: An assigned attacker threatens the escort
- **WHEN** 指定敌人进入对移动友方目标的攻击窗口
- **THEN** 敌人按武器射程与目标层规则选择友方目标，合法命中可减少其耐久
- **AND** 任务状态暴露攻击来向，玩家的自动武器按常规队伍规则筛选敌人

#### Scenario: Friendly arrives or is destroyed
- **WHEN** 移动友方目标到达下个航点，或固定友方目标守完配置波次
- **THEN** 仅在该目标存活时推进航点或完成任务，目标被毁时以具体对象名称报告失败
- **AND** 同一步内先结算伤害，再判定是否存活抵达或守住阵地

### Requirement: Deterministic task outcome

战役 MUST 以唯一的终局记录区分胜利、任务失败、玩家坠毁和主动返航。任务时钟、路线和阶段 MUST 遵守世界暂停规则。

#### Scenario: Mission pauses with the world
- **WHEN** 玩家在限时拦截或护送中暂停，或打开升级弹层
- **THEN** 剩余时间、友方航程、目标移动和阶段保持在当前模拟步，恢复后从该步继续

#### Scenario: Player crashes at final completion
- **WHEN** 玩家在最后一个任务条件完成的同一模拟步坠毁
- **THEN** 坠毁优先，形成唯一终局并沿用坠毁过渡
- **AND** 玩家存活时，当前阶段失败优先于同时满足的完成条件，阶段成功后停止继续推进任务与战斗
