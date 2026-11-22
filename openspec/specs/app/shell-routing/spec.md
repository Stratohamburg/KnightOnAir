# app/shell-routing Specification

## Purpose

定义应用从局外页面进入战斗、暂停、结算和返回机库的页面生命周期，保证页面状态和局内世界状态之间的切换可预测、可恢复并且不会重复创建会话。

## Requirements

### Requirement: Application screen lifecycle

应用 MUST 支持局外、出击过渡、战斗和结算四种页面状态，并且每次状态切换都必须有明确的进入条件和退出动作。

#### Scenario: Launch creates one battle screen

- **WHEN** 用户在局外页面点击出击
- **THEN** 应用进入出击过渡状态并最终进入一个新的战斗页面，重复点击不会创建第二个战斗会话

#### Scenario: Result returns to the hangar

- **WHEN** 战斗进入结算状态并且用户选择返回机库
- **THEN** 应用回到局外页面并显示当前局外装备状态

### Requirement: Modal state ownership

应用 MUST 维护设置、帮助、暂停和升级弹层的互斥状态，并管理弹层的输入焦点与返回路径。

#### Scenario: Modal keeps focus

- **WHEN** 玩家在打开的弹层中使用 Tab 移动焦点
- **THEN** 焦点保持在当前弹层内

#### Scenario: Settings can return to pause

- **WHEN** 用户从暂停弹层进入设置并关闭设置
- **THEN** 应用回到暂停弹层，世界仍保持暂停

### Requirement: Recoverable application interruptions

应用 MUST 在页面隐藏、窗口失焦、WebGL 上下文丢失和窗口尺寸改变时保持可恢复状态。

#### Scenario: Window loses focus

- **WHEN** 浏览器窗口失去焦点
- **THEN** 当前触控输入被清理并且战斗进入可恢复的暂停状态

#### Scenario: Renderer context is restored

- **WHEN** WebGL 上下文恢复
- **THEN** 应用显示图形连接已恢复的提示，等待玩家主动继续战斗
