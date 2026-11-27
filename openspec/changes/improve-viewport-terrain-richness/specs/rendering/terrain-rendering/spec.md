# Spec Delta

## ADDED Requirements

### Requirement: Elevation-driven surface materials

地形渲染 MUST 根据最终地表高度、坡度、水岸状态和地貌权重显示可辨认的草甸、花甸、湿地、沙滩、山肩草皮和裸岩区域。

#### Scenario: Lowland and highland remain distinguishable

- **WHEN** 视口同时包含低地、丘陵和高坡
- **THEN** 不同海拔区域具有稳定且清新的颜色层级，玩家可以从俯视镜头辨认地貌关系

#### Scenario: Slope reveals exposed rock

- **WHEN** 视口包含陡坡、山肩或高处岩面
- **THEN** 裸岩和草皮沿坡度与海拔连续过渡，岩面边界清楚且不覆盖水岸和道路语义

### Requirement: Structured relief readability

地形渲染 MUST 让山脉骨架、连续脊线、谷地低线、鞍部和沟壑在固定俯视角下保持可辨识，并使用坡度、曲率、排水或沉积权重强化局部剧烈转折。

#### Scenario: Ridge and valley read in one viewport

- **WHEN** 当前视口同时包含山脊、山肩、谷底和支谷
- **THEN** 光照、材质边界和局部面片转折共同表达高低关系，地形不会退化为均匀平滑的绿色起伏

#### Scenario: Erosion cues remain anchored

- **WHEN** 地形块重建、时间推进或风向变化
- **THEN** 沟壑、沉积区、碎石坡和谷地边界继续锚定原世界坐标

### Requirement: Stable ground material appearance

地面材质 MUST 使用固定世界坐标的低频色块和地貌权重保持清晰，不能用时间驱动的整片正弦色带改变地形轮廓。

#### Scenario: Ground remains spatially anchored

- **WHEN** 场景时间推进或风向改变
- **THEN** 山脊、丘陵、谷地和草甸的颜色区域保持锚定，地面不出现连续移动波纹

#### Scenario: Pause preserves ground colors

- **WHEN** 世界暂停
- **THEN** 地面颜色、材质边界和地貌明暗保持当前画面，恢复后继续保持空间连续

### Requirement: Viewport environmental density

视口内的房屋、聚落、花簇、灌木、湿地植物、裸岩和小型地标 MUST 按地貌区域提供足够密度，并与最终地表高度和坡度连续衔接。

#### Scenario: Dense view-local landmarks

- **WHEN** 玩家观察包含草甸、丘陵和水岸的当前视口
- **THEN** 视口内出现与区域匹配的房屋或地标、植被群和岩石细节，地表具有可读的空间参照

#### Scenario: Objects attach during streaming

- **WHEN** 玩家跨越地形块边界并重新组织活动块
- **THEN** 相同世界坐标的房屋、植被、岩石和地标保持相同位置、尺度和朝向
