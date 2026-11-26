# Spec Delta

## ADDED Requirements

### Requirement: Data-driven aircraft livery appearance

可玩机体和空中敌机 MUST 使用稳定的涂装内容 ID或兼容的机型默认映射，至少提供主色、次色、饰边色和可辨识的面板或色带规则。涂装 MUST 在 360×640 俯视战斗镜头下形成清晰的机身、翼面和尾段色彩分区，并保持损伤与高亮状态可读。

#### Scenario: Livery separates aircraft surfaces

- **WHEN** 玩家在机库或战斗场景查看具有已配置涂装的飞机
- **THEN** 机身、主翼或尾段至少呈现两级稳定色彩层次，饰边或色带在当前镜头下可辨认，飞机不再只显示单一平涂色

#### Scenario: Legacy aircraft receives a default livery

- **WHEN** 已有机型没有显式涂装 ID但仍有历史 `color` 和 `accent` 配置
- **THEN** 系统通过确定性的兼容映射生成可辨认的默认涂装，且不会阻止该机型创建

### Requirement: Cloud-compatible aircraft lighting

飞机表面受光 MUST 使用与云层和地表共享的太阳方向、环境色板和云影状态，形成暖色受光面、冷色背光面、柔和天空反弹与受控边缘光。受光结果 MUST 随飞机世界位置、姿态和云影推进更新。

#### Scenario: Aircraft matches sunny cloudscape lighting

- **WHEN** 飞机在晴朗云野区域飞行并改变航向或 bank
- **THEN** 朝向太阳的面保持明快暖色，背光面转为清晰的浅蓝或淡紫冷影，轮廓保留柔和边缘光，且光照随姿态连续变化

#### Scenario: Cloud shadow reaches aircraft

- **WHEN** 云影覆盖飞机所在世界位置
- **THEN** 飞机整体受光平滑降低并带有冷色阴影过渡，涂装分区仍然可辨识，云影随云层推进而移动

#### Scenario: Aircraft enters cloud interior

- **WHEN** 相机或玩家飞机进入云层密度范围
- **THEN** 飞机获得有限的云内包裹色和轮廓光，机体轮廓、机头方向和涂装主次色仍清晰可读

### Requirement: Consistent aircraft presentation across views

同一机体和涂装在机库预览、战斗玩家机和空中敌机中 MUST 使用一致的颜色分区、太阳方向语义与云影响语义。视图差异只允许来自相机、姿态、损伤和实例状态。

#### Scenario: Hangar and battle use the same livery

- **WHEN** 玩家从机库预览切换到战斗场景而不更换机体
- **THEN** 飞机的主色、次色、饰边和面板规则保持一致，受光方向和云影响语义遵循同一套内容定义

#### Scenario: NPC uses the same lighting contract

- **WHEN** 战斗场景同时显示玩家飞机和相同机型或同类模型的 NPC
- **THEN** 两者在相同世界位置和姿态下使用相同的太阳、云影和环境光语义，批处理不会抹掉涂装分区

