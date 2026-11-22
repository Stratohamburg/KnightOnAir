# Spec Delta

## Purpose

定义移动端渲染质量、分辨率、绘制预算、对象池、资源释放和验收诊断，保证复杂战斗场景在目标设备上保持可运行和可测量。

## ADDED Requirements

### Requirement: Quality tiers

系统 MUST 提供低、标准和高质量档位，并为云、植被、粒子、阴影和分辨率定义可验证预算。

#### Scenario: Switch quality

- **WHEN** 玩家切换质量档位
- **THEN** 渲染细节和预算立即切换，游戏状态和共享资源保持有效

### Requirement: Dynamic resolution bounds

渲染器 MUST 根据持续帧时间在配置档位和安全下限之间调整分辨率，并且恢复流畅后可以逐步回升。

#### Scenario: Sustained slow frames

- **WHEN** 帧率持续低于安全阈值
- **THEN** 分辨率按步长下降且不会低于安全下限

#### Scenario: Recovery

- **WHEN** 帧率持续恢复到流畅范围
- **THEN** 分辨率逐步接近当前质量档位上限

### Requirement: Resource stability

质量切换、地形重建、云切换和战斗长时间运行 MUST 不产生持续增长的几何体、材质、纹理或对象池数量。

#### Scenario: Five-minute session

- **WHEN** 满战斗场景运行五分钟并切换质量档位
- **THEN** 资源数量保持有界，活动实体和对象池不超过配置容量

### Requirement: Development diagnostics

开发环境 MUST 提供绘制次数、三角形、帧时间、质量档位、云和植被活动数量等诊断数据，生产环境不得因此改变公开行为。

#### Scenario: Development report

- **WHEN** 开发环境执行环境验收场景
- **THEN** 报告包含帧时间、绘制次数、三角形、内存和环境活动数量

### Requirement: Target viewport budget

标准质量在目标移动端视口和满额战斗场景下 MUST 记录并验证既定绘制次数、三角形、帧时间和内存预算。

#### Scenario: Standard battle budget

- **WHEN** 360×640 视口运行包含地形、云、植被、敌人、投射物和特效的满战斗场景
- **THEN** 系统输出可复核的性能数据并标记是否满足标准档预算
