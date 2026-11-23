# 机库导航增量规格

## MODIFIED Requirements

### Requirement: Hangar navigation

局外机库 MUST 将主界面底部导航最右侧的预留按钮用作「展厅」入口。底栏从左到右依次为商店、装备、出击、预留、展厅，所有入口都可返回出击页面。

#### Scenario: Default opens sortie

- **WHEN** 玩家首次进入应用
- **THEN** 局外默认显示出击页面并展示当前装备机体

#### Scenario: Placeholder page returns safely

- **WHEN** 玩家打开尚未实现的商店或预留入口
- **THEN** 页面显示可返回的占位内容，当前装备和存档状态保持不变

#### Scenario: Enter and leave showroom

- **WHEN** 玩家点击主界面底部最右侧的「展厅」，随后使用返回出击入口
- **THEN** 应用打开飞机展厅，返回后出击页显示当前装备机体
