# Spec Delta

## Purpose

定义玩家在局外查看机体、浏览时代、预览部件、切换装备和开始出击的机库体验，保证预览状态与实际出击状态清晰分离。

## ADDED Requirements

### Requirement: Hangar navigation

局外机库 MUST 提供出击、装备和预留入口，并且所有入口都必须能够返回出击页面。

#### Scenario: Default opens sortie

- **WHEN** 玩家首次进入应用
- **THEN** 局外默认显示出击页面并展示当前装备机体

#### Scenario: Placeholder page returns safely

- **WHEN** 玩家打开尚未实现的商店或预留入口
- **THEN** 页面显示可返回的占位内容，当前装备和存档状态保持不变

### Requirement: Aircraft preview and equipment selection

装备页面 MUST 区分预览机体和当前装备机体，只有明确确认装备后才改变下一局出击机体。

#### Scenario: Preview does not equip

- **WHEN** 玩家浏览另一架未装备的机体并返回出击页面
- **THEN** 出击页面仍使用原装备机体

#### Scenario: Equip unlocked aircraft

- **WHEN** 玩家确认一架已解锁机体
- **THEN** 该机体成为下一局出击机体，并且页面显示新的当前装备状态

### Requirement: Aircraft information summary

装备和出击页面 MUST 展示足以支持出击决策的机体属性、武器和构型信息。

#### Scenario: Compare airframes

- **WHEN** 玩家切换机体预览
- **THEN** 页面同步更新生命、速度、加速度、转向、能量、翼展、挂点和主要武器信息

#### Scenario: Inspect a part

- **WHEN** 玩家选择机体部位
- **THEN** 页面显示该部位的功能、挂点或损伤影响说明

### Requirement: Sortie transition

点击出击后页面 MUST 进入短暂的出击过渡，并使用确认后的装备机体创建新的局内战斗。

#### Scenario: Start a sortie

- **WHEN** 玩家从出击页面点击出击
- **THEN** 出击按钮进入锁定状态，展示场景进入过渡并创建新的战斗世界
