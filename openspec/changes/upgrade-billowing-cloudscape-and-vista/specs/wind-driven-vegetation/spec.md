# Spec Delta

## MODIFIED Requirements

### Requirement: Wind-driven trees

树木和高植被 MUST 使用与现有风场时间、位置采样和阵风状态一致的摆动方向。树木根部 MUST 保持贴地，树冠摆幅 MUST 随高度增加。树冠几何与着色 MUST 呈现柔和蓬松的绘本球簇轮廓与连续受光过渡，避免生硬的尖刺多面体反光。

#### Scenario: Tree crown bends with wind

- **WHEN** 风场方向或阵风强度发生变化
- **THEN** 蓬松树冠沿对应方向平滑摆动，树干底部和根部保持在地形表面

#### Scenario: Trees keep deterministic phase

- **WHEN** 相同种子和相同世界坐标重新生成一块地形
- **THEN** 树木的布局、初始相位、尺度和摆动刚度保持一致
