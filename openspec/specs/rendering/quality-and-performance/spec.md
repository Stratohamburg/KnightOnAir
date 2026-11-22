# rendering/quality-and-performance Specification

## Purpose

定义渲染质量、分辨率、绘制预算和帧统计，使包含云、地形和战斗对象的复杂画面能够按统一场景对比和验收。

## Requirements

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

持续战斗、地形块更新和画质切换 MUST 将渲染资源控制在场景所需的有界范围内。

#### Scenario: Five-minute session

- **WHEN** 满战斗场景运行五分钟并切换质量档位
- **THEN** 几何体、材质与纹理资源数量在场景预热后保持有界

### Requirement: Development diagnostics

开发环境 MUST 提供绘制次数、三角形、帧时间、质量档位、云和植被活动数量等诊断数据，生产环境不得因此改变公开行为。

#### Scenario: Development report

- **WHEN** 开发环境执行环境验收场景
- **THEN** 报告包含帧时间、绘制次数、三角形、内存和环境活动数量

### Requirement: Target viewport budget

标准档在 360×640 视口的满额战斗基准中 MUST 保持低于 150 次绘制和 150,000 个三角形。验收时同时记录帧间隔与资源统计。

#### Scenario: Standard battle budget

- **WHEN** 360×640 视口运行包含地形、云、植被、敌人、投射物和特效的满战斗场景
- **THEN** 帧统计可用于判定绘制次数和三角形上限，设备与渲染后端随测量结果一并记录
