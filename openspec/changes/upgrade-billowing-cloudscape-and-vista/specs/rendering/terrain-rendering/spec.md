# Spec Delta

## MODIFIED Requirements

### Requirement: Surface material expression

渲染器 MUST 根据草地、道路、沙地、水面、岸线和岩石遮罩显示绘本风格化颜色、丝绒化风吹草浪色带、云影冷调层次以及结合高度与太阳方向的连续大气透视。地表与水面材质 MUST 随时代色板同步更新受光暖调、阴影冷调与雾海氛围，并保持水面、浅滩、道路与陆地的清晰边界。

#### Scenario: Water and shore

- **WHEN** 视野包含河道和岸线
- **THEN** 水面呈现天空梯度反射与太阳方向闪烁高光，浅滩、泡沫岸线和陆地具有可辨识的颜色和边界

#### Scenario: Valley haze and sun scatter

- **WHEN** 玩家从高空巡航观察远方山谷、水面与地形起伏
- **THEN** 低谷呈现更柔和的乳白/青蓝高度雾层次，朝向太阳方向的远景大气叠加温暖散射光晕，地形色块在远景自然融入天空与云海
