# Spec Delta

## ADDED Requirements

### Requirement: Upgrade payment feedback

升级界面 MUST 展示本局金币余额、候选价格、选中候选的支付结果和不足差额，并与世界状态同步。

#### Scenario: Candidate price display

- **WHEN** 玩家打开升级界面或切换候选
- **THEN** 当前余额、候选价格和确认可用状态同步显示

#### Scenario: Insufficient balance feedback

- **WHEN** 选中候选的价格高于本局金币
- **THEN** 界面显示还需金币数量，确认动作处于禁用状态

#### Scenario: Successful payment feedback

- **WHEN** 玩家确认并支付升级
- **THEN** 界面显示扣除后的余额和安装确认，升级次数与 HUD 角标同步减少

### Requirement: Upgrade installation event feedback

战斗呈现系统 MUST 通过公开升级安装事件播放部件新增、挂点定位、音效、触觉和短促抖动反馈。

#### Scenario: Small part grows into aircraft

- **WHEN** 世界发出新增部件的升级安装事件
- **THEN** 新部件从小比例沿局部挂点或中心线移动到机体，放大到正常尺寸并完成定位

#### Scenario: Structural extension impact

- **WHEN** 升级安装事件包含翼段或机身延长部件
- **THEN** 部件先沿结构方向外移，再完成冲击式伸展，同时播放安装音效和短促抖动

#### Scenario: Repeated upgrade feedback

- **WHEN** 同一侧连续安装多个扩建段
- **THEN** 每个新部件使用自己的部件身份和挂点播放一次反馈，不覆盖已有段的状态

### Requirement: Upgrade preview readability

升级预览 MUST 在移动端视口中清晰表达新增部件的位置、尺寸、所属侧别和主要数值变化。

#### Scenario: Preview selected part

- **WHEN** 玩家选中一个候选升级
- **THEN** 预览高亮受影响部件，并显示升级前后数值和结构变化

#### Scenario: Preview part near edge

- **WHEN** 预览部件位于飞机外缘或接近屏幕边缘
- **THEN** 相机和局部高亮共同保持该部件可辨识，底部升级托盘不遮挡关键变化

