# Spec Delta

## Purpose

定义局内升级如何从合法候选中选择并改变玩家机体的部件、武器、统计值、碰撞区域和视觉构型，形成一局中的持续构筑玩法。

## ADDED Requirements

### Requirement: Legal upgrade choices

每次打开局内改装时，系统 MUST 提供三个互不重复且符合当前构型、前置条件、互斥关系和次数限制的升级候选。

#### Scenario: Unique legal choices

- **WHEN** 玩家拥有一次可用升级并打开改装界面
- **THEN** 界面显示三个合法候选，已安装且达到上限的升级不会继续出现

#### Scenario: Fallback choices

- **WHEN** 可用的唯一升级已经耗尽
- **THEN** 系统从合法的可重复升级中补足候选数量

### Requirement: Refit changes the aircraft build

确认升级后，系统 MUST 按升级效果更新对应的部件、武器挂点、质量、尺寸、操控统计、碰撞区域或可用能力。

#### Scenario: Structural upgrade

- **WHEN** 玩家安装发动机、机翼或装甲类升级
- **THEN** 机体构型和对应操控统计发生一致变化

#### Scenario: Weapon upgrade

- **WHEN** 玩家安装武器或挂点类升级
- **THEN** 新武器挂点与所属部件建立关联，并参与后续开火和损伤规则

### Requirement: Run-scoped aircraft build

改装 MUST 作用于当前出击的机体构型。

#### Scenario: Start another sortie after refitting

- **WHEN** 玩家结束已改装的战斗，并用同一基础机型再次出击
- **THEN** 新一局使用该机型的基础部件、挂点与统计

### Requirement: Refit preserves damage state

普通构型升级 MUST 保留现有部件损伤状态，并且不能通过重新计算统计值意外恢复已损坏的部件。

#### Scenario: Install upgrade on damaged aircraft

- **WHEN** 玩家在部件受损后安装不包含维修语义的升级
- **THEN** 原有部件生命和禁用状态保持，只应用升级带来的结构和统计变化

### Requirement: Build and presentation stay aligned

升级后的模拟构型 MUST 能被渲染层和局内 UI 读取并表达，玩家看到的机体轮廓和属性摘要必须对应当前构型。

#### Scenario: Asymmetric build

- **WHEN** 玩家只在一侧安装发动机或机翼
- **THEN** 机体外观、左右操控差异和部件信息保持一致
