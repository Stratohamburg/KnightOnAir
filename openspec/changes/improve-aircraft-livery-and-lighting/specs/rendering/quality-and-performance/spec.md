# Spec Delta

## ADDED Requirements

### Requirement: Bounded aircraft livery and lighting cost

飞机涂装和云野受光 MUST 使用共享几何、共享基础材质和有界的实例参数，不得为每个可见飞机创建逐帧纹理或无限材质。标准档的飞机涂装与受光 MUST 纳入现有 360×640 满战斗场景的 150 次绘制和 150,000 三角形预算。

#### Scenario: Full battle keeps aircraft resources bounded

- **WHEN** 标准档同时显示玩家、满额空中敌人、云层、地形和战斗特效
- **THEN** 飞机涂装与受光不会突破既有绘制、三角形和共享材质预算，开发诊断可以区分共享资源与活动实例

#### Scenario: Repeated livery changes remain stable

- **WHEN** 玩家反复切换机库机体、进入战斗并结束出击
- **THEN** 涂装材质、几何和实例参数数量在预热后保持有界，离场实例释放动态资源

### Requirement: Readable low-quality livery fallback

省电或动态降分辨率触发时 MUST 减少涂装图案细节、面板变化和边缘光采样，但 MUST 保留主色、次色、饰边、机头方向、轮廓和云影明暗差异。

#### Scenario: Low quality preserves aircraft identity

- **WHEN** 玩家切换到省电档或设备进入动态降级状态
- **THEN** 飞机仍能辨认主次涂装和机体轮廓，效果降低通过减少图案细节和光照采样完成，模拟状态与机体构型不变
