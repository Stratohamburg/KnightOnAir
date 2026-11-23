# 飞机展厅规格

## Purpose

飞机展厅为玩家提供局外选机、观察、试装和试射的独立会话。玩家可按任意合法卡序比较机体变化，通过试射复现战斗表现，并在结束预览后返回自己的出击装备。

## ADDED Requirements

### Requirement: Rotatable aircraft display

展厅 MUST 在界面上方展示当前所选飞机的完整三维构型，并允许玩家通过滑动或拖动旋转观察。

#### Scenario: Explore a large build on a phone

- **WHEN** 玩家在手机竖屏或桌面展示区拖动已加长单翼和尾部的飞机
- **THEN** 可以水平环绕一周、调整俯仰观察翼尖和尾舱，完整机体可见；滚动下方卡牌列表仅滚动列表

#### Scenario: Select an aircraft

- **WHEN** 玩家首次进入或切换预览机型
- **THEN** 首次显示当前装备机，选择器可浏览当前战斗配置中的全部可玩机体（含未解锁机）；切换后展示所选机的原装构型和可加卡牌，出击装备仍由装备页管理

### Requirement: Battle content is the sole source

展厅 MUST 以正式战斗配置作为机体、原装配备、部件、挂点、强化卡、武器及视效的唯一来源。选机和组卡按战斗目录及构筑规则解析，展示与试射消费同一配置产生的构型和战斗事件。

#### Scenario: Battle roster changes

- **WHEN** 只在战斗配置中新增或移除可玩机体，重新载入并打开展厅
- **THEN** 选机列表反映当前战斗目录，新增机体可按其原装配备展示和试射

#### Scenario: Battle refit or weapon configuration changes

- **WHEN** 只修改战斗配置中某张卡的适用条件、射速倍率或所装武器的枪口位置，重新载入后在展厅组卡并试射
- **THEN** 候选资格、改装前后数值及适用的发射间隔和位置随变更与实战一致，无需维护展厅专用条目

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

展厅 MUST 提供「开火」按钮，让玩家观察当前构型在与战斗相同的射界、锁定、射速及发射位置条件下的试射。

#### Scenario: Observe guns in different arcs

- **WHEN** 玩家点击一次「开火」，当前机体同时装有前射、侧射和后射炮位
- **THEN** 一段有限时长的连续试射为相应射界提供靶标，可看到各炮位转向、从自身枪口发射及命中效果，视角旋转只改变观察方向

#### Scenario: Observe ordnance

- **WHEN** 展示机装有锁定武器、炸弹或鱼雷并开始试射
- **THEN** 演示提供对应空中、地面或水面目标及攻击阶段，玩家能看到锁定后离轨或稳定投放后的真实离舱效果

#### Scenario: Repeat or edit during demonstration

- **WHEN** 玩家在演示中重复点击开火、编辑构型、切换机型或退出
- **THEN** 同时至多有一段演示；换构型会清理旧弹体与特效，下一次点击从相同初始演示条件开始，演示期间的命中不计入出击奖励

### Requirement: Showroom matches the combat build

展厅 MUST 展示构筑规则产生的机体，并通过既有战斗武器行为演示其效果。

#### Scenario: Showroom reproduces a sortie build

- **WHEN** 以同一基础机型、相同卡序、完整部件和相同目标条件重建展厅与局内构型
- **THEN** 二者的轮廓、受击区、独立炮位数、发射位置、适用倍率与发射间隔一致

### Requirement: Isolated preview session

展厅 MUST 独立管理临时试装和靶场状态，离开时结束该会话。

#### Scenario: Return to the equipped aircraft

- **WHEN** 玩家试装另一机型并开火，离开展厅后开始出击
- **THEN** 新局使用原装备机型的基础构型，奖励、解锁和战绩沿用入厅前的存档
