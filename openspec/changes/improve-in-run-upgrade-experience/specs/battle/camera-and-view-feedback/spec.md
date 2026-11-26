# Spec Delta

## MODIFIED Requirements

### Requirement: State-based camera views

镜头 MUST 根据机库展示、出击进度、战斗模式和升级状态应用对应构图，巡航、轰炸和升级构图之间连续过渡。

#### Scenario: Cruise to bombing

- **WHEN** 玩家从普通巡航切换到轰炸模式
- **THEN** 相机平滑调整视场角、俯角和距离，注视点持续跟随玩家飞行位置

#### Scenario: Launch transition

- **WHEN** 页面从局外进入出击过渡
- **THEN** 展示镜头在进入战斗构图前随出击进度拉近机体

#### Scenario: Enter upgrade framing

- **WHEN** 玩家从普通战斗或轰炸阶段打开升级
- **THEN** 相机从当前战斗构图连续放大飞机，并把飞机和升级预览区域安排在底部托盘上方

#### Scenario: Exit upgrade framing

- **WHEN** 玩家完成安装动画并退出升级
- **THEN** 相机从升级构图连续缩回进入升级前的战斗构图，不发生瞬间跳转

### Requirement: Viewport adaptation

相机 MUST 在目标竖屏比例和桌面比例下保持飞机、地面目标和关键战斗范围可见，并允许升级中的大型飞机部分超出视口。

#### Scenario: Narrow mobile viewport

- **WHEN** 视口宽高比变窄到移动端竖屏范围
- **THEN** 相机调整距离或构图，使玩家飞机保持在可读区域且不被升级托盘遮挡

#### Scenario: Large aircraft upgrade

- **WHEN** 当前飞机的翼展或机身长度已经超过升级构图的舒适尺寸
- **THEN** 相机降低额外放大幅度并允许飞机边缘超出视口，同时保持升级部件和主要轮廓可读

### Requirement: Camera response to battle state

镜头 MUST 按当前页面与战斗状态构图。升级期间保留进入升级时的巡航或轰炸构图作为过渡基准，边缘部件需要时调整注视点和距离，结算继续使用末局战斗场景。

#### Scenario: Upgrade while bombing

- **WHEN** 玩家在轰炸阶段打开改装
- **THEN** 镜头从轰炸构图平滑进入升级构图，并保留轰炸方向和准心的空间语义

#### Scenario: Edge-mounted preview

- **WHEN** 待安装部件的预览位置靠近屏幕边缘
- **THEN** 相机平滑移动注视点并调整距离，使待安装部件在升级托盘上方保持可见

#### Scenario: Crash and result framing

- **WHEN** 玩家飞机坠毁并进入结算
- **THEN** 飞机的坠落和旋转在战斗画面中可见，随后结算显示于末局战斗场景上

## ADDED Requirements

### Requirement: Upgrade camera continuity

升级镜头 MUST 使用连续的目标状态插值，不能因打开面板、切换候选或确认安装造成视角瞬移。

#### Scenario: Candidate changes during upgrade

- **WHEN** 玩家在升级面板中切换候选
- **THEN** 相机保持当前升级构图，只根据新部件的位置平滑调整目标注视点和距离

#### Scenario: Preview follows aircraft pose

- **WHEN** 升级预览显示新增部件
- **THEN** 预览部件使用进入升级时飞机的 heading、bank 和局部锚点，镜头移动不改变屏幕前方语义

