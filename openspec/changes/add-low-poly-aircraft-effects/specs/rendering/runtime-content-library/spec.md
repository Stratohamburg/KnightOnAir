## ADDED Requirements

### Requirement: Local sources and world-space trails

特效 MUST 从各自的活动挂点按实际动力及机动状态发射，尾迹释放到世界中随风消散。

#### Scenario: Piston acceleration through a cloud

- **WHEN** 活塞机给油、加力、穿云并急转
- **THEN** 各组排气随给油变密变长，加力出现暖焰、桨尖断弧与螺旋滑流，加速强化机尾流并在配置门限产生短暂机鼻弧。翼面薄片、翼尖涡和较弱突出点细流随载荷加强。穿云扰动衔接旧航迹。

#### Scenario: Twin jet with a disabled engine

- **WHEN** 双发喷气机加力，随后一台发动机禁用
- **THEN** 健康侧保持本机型加力喷流与渐宽尾烟，禁用侧停止喷流。可燃部件重伤的黑洞接亮火根、火舌与浓烟，结构重伤产生灰烟与碎屑。

### Requirement: Mobile aircraft effect lifecycle

暂停 MUST 冻结特效，重开 MUST 清除旧洞、烟和轨迹。各档画质 MUST 使用有界实例池。

#### Scenario: Full mobile battle

- **WHEN** 在 360×640 标准画质满载战斗并切换至低档
- **THEN** 标准档整帧少于 150 次绘制且少于 150000 个三角形。低档优先降低切面、光晕与旧轨迹密度，保留逐发枪烟、可辨的气流起点和各洞口烟根。
