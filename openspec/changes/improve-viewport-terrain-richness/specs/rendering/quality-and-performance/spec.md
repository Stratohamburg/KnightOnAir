# Spec Delta

## ADDED Requirements

### Requirement: Viewport-first quality allocation

地形、房屋、植被、岩石、水岸和地标 MUST 优先使用当前视口内的几何、材质、实例与阴影预算，视口外内容 MUST 使用低密度或低细节表现。

#### Scenario: Visible terrain receives detail

- **WHEN** 标准档在 360×640 视口运行地形场景
- **THEN** 当前视口内的山脉、丘陵、谷地、房屋、植被和地表材质保持可辨识，视口外内容不挤占同等细节预算

#### Scenario: Viewport priority follows the camera

- **WHEN** 玩家移动导致活动视口改变
- **THEN** 高密度景物和材质细节随视口平滑转移，已离开视口的装饰资源按有界策略复用或回收

### Requirement: Terrain detail budget

新增地形材质通道、房屋、植被、岩石和地标 MUST 在各画质档位保持有界资源、绘制次数和三角形数量，并纳入开发诊断。

#### Scenario: Standard viewport budget

- **WHEN** 标准档运行包含完整地形、景物、云、地面单位、投射物和特效的 360×640 场景
- **THEN** 总绘制次数低于 150 次且总三角形低于 150,000，诊断可以区分地形、景物和内容库资源

#### Scenario: Low quality fallback

- **WHEN** 玩家切换到省电档或持续帧时间超过安全阈值
- **THEN** 系统优先降低视口外景物、远处材质细节和阴影成本，保留视口内的主要地貌颜色、轮廓和关键房屋或地标

### Requirement: Ground clarity acceptance

环境验收 MUST 覆盖固定俯视镜头下的海拔材质、地貌轮廓、景物密度、云开关和地面波纹移除结果。

#### Scenario: Clear viewport comparison

- **WHEN** 使用固定种子依次观察低地、丘陵、高坡和水岸，并切换云与云影
- **THEN** 各海拔材质保持清新明快，地貌边界清楚，地面没有连续移动波纹或整体发灰

#### Scenario: Pause and chunk regression

- **WHEN** 在地形块边界附近暂停、恢复并继续移动
- **THEN** 地面颜色、景物位置、材质分层和共享资源计数保持连续且有界

### Requirement: Bounded terrain generation methods

地形生成 MUST 将热侵蚀、液压侵蚀或其他派生过程限制在地形块创建、预计算或缓存阶段，并将生成耗时纳入开发诊断。浏览器运行时不得为每帧完整执行侵蚀模拟、GAN 推理或扩散去噪。

#### Scenario: Generation budget is visible

- **WHEN** 环境验收创建固定种子的地形块
- **THEN** 诊断记录地形生成、侵蚀派生、缓存命中和活动块数量，生成时间保持在设定上限内

#### Scenario: Runtime keeps a deterministic fallback

- **WHEN** 侵蚀缓存不可用、设备不支持额外计算或生成时间超出阈值
- **THEN** 系统回退到确定性的山脉骨架、谷地横截面、热侵蚀规则和低频噪波，并保持高度、路线和材质查询可用
