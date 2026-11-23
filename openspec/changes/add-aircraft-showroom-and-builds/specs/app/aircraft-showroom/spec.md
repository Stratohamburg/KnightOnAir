# 飞机展厅规格

## Purpose

飞机展厅为玩家提供局外选机、观察、试装和挂点试射的独立会话。展示区占页面上方约三分之二，操作区占下方约三分之一。玩家可按任意合法卡序比较机体变化，通过试射观察当前构型的真实挂点表现，并在结束预览后返回自己的出击装备。

## ADDED Requirements

### Requirement: Rotatable aircraft display

展厅 MUST 在界面上方展示当前所选飞机的完整三维构型，并允许玩家通过滑动或拖动旋转观察。

展示区 MUST 占展厅页面上方约三分之二，机体居中显示。下方操作区 MUST 独立承载机体切换、当前生效卡序、撤销、重置和强化卡列表。

#### Scenario: Explore a large build on a phone

- **WHEN** 玩家在手机竖屏或桌面展示区拖动已加长单翼和尾部的飞机
- **THEN** 可以水平环绕一周、调整俯仰观察翼尖和尾舱，完整机体可见；上下滚动下方强化卡列表仅滚动列表，展示区和机体位置保持不变

#### Scenario: Select an aircraft

- **WHEN** 玩家首次进入或点击操作区的“切换机体”按钮
- **THEN** 首次显示当前装备机；按钮打开机体选择弹窗，弹窗可浏览当前战斗配置中的全部可玩机体（含未解锁机）；选择后关闭弹窗并展示所选机的原装构型和可加卡牌，出击装备仍由装备页管理

### Requirement: Showroom operation area

展厅操作区 MUST 在顶部显示当前已生效的有序卡序，并在其下提供撤销、重置和可上下滚动的合法强化卡列表。选中强化卡后 MUST 立即重建展示构型并更新当前生效卡序。

#### Scenario: Keep active cards visible while browsing

- **WHEN** 玩家已经加入多张强化卡并上下滚动强化卡列表
- **THEN** 操作区顶部仍显示当前生效的卡序、次数和实际收益，滚动只影响卡列表

### Requirement: Battle content is the sole source

展厅 MUST 以正式战斗配置作为机体、原装配备、部件、挂点、强化卡、武器及视效的唯一来源。选机和组卡按战斗目录及构筑规则解析，展示与试射消费同一配置产生的构型和挂点事件。展厅会话 MUST 不启动战斗步进，不创建敌机、战斗目标、战斗锁定、战斗弹体或战斗奖励事件。

#### Scenario: Battle roster changes

- **WHEN** 只在战斗配置中新增或移除可玩机体，重新载入并打开展厅
- **THEN** 选机列表反映当前战斗目录，新增机体可按其原装配备展示和试射

#### Scenario: Battle refit or weapon configuration changes

- **WHEN** 只修改战斗配置中某张卡的适用条件、射速倍率或所装武器的枪口位置，重新载入后在展厅组卡并试射
- **THEN** 候选资格、改装前后数值及适用的发射间隔和位置随变更与实战一致，无需维护展厅专用条目，展厅仍只展示当前构型的挂点结果

### Requirement: Ordered showroom refits

展厅 MUST 按构筑规格 `battle/aircraft-refit` 提供的合法候选和安装结果展示临时卡序，支持逐张选择、撤销和重新搭配。

#### Scenario: Preview and add a card

- **WHEN** 玩家查看并加入一张卡
- **THEN** 可看到提质或提量、实际适用范围、安装前后差异；加入后展示区即时更新，保留观察方向，下方显示有序卡列、次数、实际收益和下一步可选卡

#### Scenario: Branch a build

- **WHEN** 玩家依次加入 A、B，撤销 B 并选择 C，随后重置
- **THEN** 依次可观察 A+B、A、A+C 和原装状态，属性、部件、挂点、火线和候选按每步构型重算

#### Scenario: Ineligible card

- **WHEN** 一张卡因时代、前置、互斥、次数或剩余挂点不适用于当前飞机
- **THEN** 玩家只能加入合法卡；界面若展示不可用卡则说明原因。本次构型试装无需 XP、升级次数或抽取三选一

### Requirement: Fire the previewed build

展厅 MUST 提供「试射」按钮，让玩家观察当前构型在与战斗相同的射界、射速及发射位置条件下的挂点开火展示。试射 MUST 只产生当前挂点的展示事件和特效，不启动敌机、目标、锁定、投弹命中或奖励流程。

#### Scenario: Observe guns in different arcs

- **WHEN** 玩家点击一次「试射」，当前机体同时装有前射、侧射和后射炮位
- **THEN** 各炮位从自身挂点播放一次展示开火效果，保留各自的射界方向和枪口位置，视角旋转只改变观察方向，不出现敌机或战斗目标

#### Scenario: Observe ordnance

- **WHEN** 展示机装有锁定武器、炸弹或鱼雷并点击「试射」
- **THEN** 展示对应武器的真实挂点、方向和离舱特效，不创建锁定目标、地面目标、水面目标或命中结果

#### Scenario: Repeat or edit during demonstration

- **WHEN** 玩家重复点击试射、编辑构型、切换机型或退出
- **THEN** 每次试射只展示当前构型的挂点事件；编辑或退出会清理旧特效，下一次点击从当前构型重新展示，过程不产生命中、奖励或存档写入

### Requirement: Showroom matches the combat build

展厅 MUST 展示构筑规则产生的机体，并通过既有挂点、武器配置、锚点和特效定义演示其效果。展示流程不得复用战斗目标或战斗会话。

#### Scenario: Showroom reproduces a sortie build

- **WHEN** 以同一基础机型、相同卡序和完整部件重建展厅与局内构型
- **THEN** 二者的轮廓、受击区、独立炮位数、发射位置、适用倍率与发射间隔一致，展厅不承担战斗目标、命中和奖励状态

### Requirement: Isolated preview session

展厅 MUST 独立管理临时试装和展示特效状态，离开时结束该会话。

#### Scenario: Return to the equipped aircraft

- **WHEN** 玩家试装另一机型并试射，离开展厅后开始出击
- **THEN** 新局使用原装备机型的基础构型，奖励、解锁和战绩沿用入厅前的存档
