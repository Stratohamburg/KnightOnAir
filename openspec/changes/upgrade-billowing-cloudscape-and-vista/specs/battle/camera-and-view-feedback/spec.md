# Spec Delta

## MODIFIED Requirements

### Requirement: State-based camera views

镜头 MUST 根据机库展示、出击进度和战斗模式应用对应构图，巡航与轰炸构图之间连续过渡。巡航构图 MUST 采用舒展的纵深俯角与远景视距，使画面上方能够呈现开阔的云海纵深、立体积云轮廓与天空地平线，同时下方保留完整的空战机动视野；轰炸构图 MUST 切换为高俯角战术视角以突出地面与水面目标。

#### Scenario: Cruise to bombing

- **WHEN** 玩家从普通巡航切换到轰炸模式
- **THEN** 相机平滑调整视场角、俯角和距离，从开阔的巡航云海纵深构图过渡到高俯角轰炸构图，注视点持续跟随玩家飞行位置且玩家飞机始终居中

#### Scenario: Cruise reveals sky and cloud vista

- **WHEN** 玩家处于普通巡航状态
- **THEN** 相机在保持玩家居中和空战目标尺度可控的同时，在画面上方呈现可辨识的远景云层、天空渐变与地平线纵深

#### Scenario: Launch transition

- **WHEN** 页面从局外进入出击过渡
- **THEN** 展示镜头在进入战斗构图前随出击进度平滑推进并过渡到巡航纵深视角
