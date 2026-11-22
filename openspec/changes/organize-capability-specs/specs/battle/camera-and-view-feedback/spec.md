# Spec Delta

## Purpose

定义不同应用和战斗状态下的相机位置、注视点、视场角、俯角、距离和视角反馈，保证玩家始终理解飞行方向、地面目标和当前战斗阶段。

## ADDED Requirements

### Requirement: State-based camera views

系统 MUST 为局外展示、出击过渡、普通巡航、轰炸、死亡和结算提供明确视角，并根据状态平滑切换。

#### Scenario: Cruise to bombing

- **WHEN** 玩家从普通巡航切换到轰炸模式
- **THEN** 相机平滑调整 FOV、俯角、距离和注视点，且飞机保持在可读位置

#### Scenario: Launch transition

- **WHEN** 页面从局外进入出击过渡
- **THEN** 相机完成展示镜头到战斗镜头的连续过渡，不产生突然跳变

### Requirement: Screen-relative orientation

战斗镜头 MUST 保持稳定的屏幕前方语义，玩家输入方向、飞机机头方向和镜头投影方向必须一致。

#### Scenario: Direction remains readable

- **WHEN** 玩家向屏幕右侧输入
- **THEN** 飞机的目标移动方向和屏幕投影都指向右侧，镜头不会绕转造成方向反转

### Requirement: Viewport adaptation

相机 MUST 在目标竖屏比例和桌面比例下保持飞机、地面目标和关键战斗范围可见。

#### Scenario: Narrow mobile viewport

- **WHEN** 视口宽高比变窄到移动端竖屏范围
- **THEN** 相机调整距离或构图，使玩家飞机保持居中且不被 UI 区域遮挡

### Requirement: Camera feedback

相机 MUST 能够消费受击、加力、爆炸、锁定、死亡和状态切换反馈，并以受限的视角变化表达事件。

#### Scenario: Damage feedback

- **WHEN** 玩家受到有效命中
- **THEN** 相机可以产生短促、可控的视角反馈，同时保持输入方向和模拟结果不变

#### Scenario: Pause freezes view

- **WHEN** 世界进入暂停或升级暂停
- **THEN** 相机位置、过渡进度和视角反馈保持当前状态
