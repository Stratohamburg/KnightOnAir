# Spec Delta

## Purpose

定义不同应用和战斗状态下的相机位置、注视点、视场角、俯角、距离和视角反馈，保证玩家始终理解飞行方向、地面目标和当前战斗阶段。

## ADDED Requirements

### Requirement: State-based camera views

镜头 MUST 根据机库展示、出击进度和战斗模式应用对应构图，巡航与轰炸构图之间连续过渡。

#### Scenario: Cruise to bombing

- **WHEN** 玩家从普通巡航切换到轰炸模式
- **THEN** 相机平滑调整 视场角、俯角和距离，注视点持续跟随玩家飞行位置

#### Scenario: Launch transition

- **WHEN** 页面从局外进入出击过渡
- **THEN** 展示镜头在进入战斗构图前随出击进度拉近机体

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

### Requirement: Camera response to battle state

镜头 MUST 按当前页面与战斗状态构图。升级期间保留进入升级时的巡航或轰炸构图，结算继续使用末局战斗场景。

#### Scenario: Upgrade while bombing

- **WHEN** 玩家在轰炸模式下打开改装界面
- **THEN** 镜头继续取用轰炸构图作为目标

#### Scenario: Crash and result framing

- **WHEN** 玩家飞机坠毁并进入结算
- **THEN** 飞机的坠落和旋转在战斗画面中可见，随后结算显示于末局战斗场景上
