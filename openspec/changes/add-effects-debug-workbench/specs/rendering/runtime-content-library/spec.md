# Spec Delta

## ADDED Requirements

### Requirement: Discover runtime content for isolated previews

共享库 MUST 允许调试工具按稳定 ID 枚举有模型的机型以及运行时特效与变体，并从对应定义取得展示名称、播放所需输入与可用动作。读取目录 MUST 能在创建游戏场景前完成。带数值的飞行预设、效果参数和机型关联 MUST 能从相应库解析，供单项和整机预览使用。

#### Scenario: Discover a new variant from its source definition

- **WHEN** 在库中增加使用已有触发方式的效果变体，并重新打开「特效库」
- **THEN** 调试工具可取得其 ID、名称和触发条件，从该定义播放效果，无需在界面登记该变体

#### Scenario: Resolve the current configuration for both previews

- **WHEN** 修改一个被机型使用的翼中拖尾配置，并重新打开单项与整机预览
- **THEN** 两处均能从库读取修改后的宽度及透明度，整机挂点仍从所选机型解析

#### Scenario: Report a missing dependency

- **WHEN** 可枚举机型的某个挂载引用了已移除的效果定义
- **THEN** 调试工具可以从读取结果识别缺失 ID 及受影响的动作，仍可读取同机型其余有效配置
