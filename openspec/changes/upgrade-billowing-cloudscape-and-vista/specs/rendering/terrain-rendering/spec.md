# Spec Delta

## MODIFIED Requirements

### Requirement: Surface material expression

渲染器 MUST 在固定俯视角视野内呈现明媚清透的《光·遇》云野式晴天地景：草地以干净的大色块暖阳黄绿与清透翠绿过渡配合双色风吹麦浪呈现，云组投下的软影以清透浅青蓝冷调与阳光草地形成强烈空间反差；禁止在玩家可玩近中景叠加压低通透度的阴天低谷雾纱。水面 MUST 保留风场波纹语义并呈现清澈浅滩、泡沫岸线与太阳方向闪烁高光。

#### Scenario: Water and shore

- **WHEN** 视野包含河道和岸线
- **THEN** 水面呈现清澈浅滩渐变、天空色反射与太阳方向闪烁高光，岸线泡沫与陆地具有可辨识的颜色和边界

#### Scenario: Sunny prairie contrast under grouped clouds

- **WHEN** 玩家在晴天多云副本中俯瞰云墙之间的陆地与河谷
- **THEN** 无云覆盖区域的草地、道路与水面保持高通透度与明媚阳光感，有云覆盖区域投下清晰的冷蓝软影以强化云地高度差
