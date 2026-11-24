# 局内变形构筑增量规格

## ADDED Requirements

### Requirement: Centerline-based aircraft layout

局内构型 MUST 由战斗配置提供的中心线结构图解析。部件、延长段、武器挂点和发动机挂点 MUST 通过中心线、连接节点、纵向站位和局部偏移确定位置，不能依赖按升级次数累加的全局绝对坐标。

#### Scenario: Accumulate a wing extension

- **WHEN** 玩家连续安装两节右翼延长段
- **THEN** 两节按安装顺序插在原右翼尖段内侧。翼尖及其附件外移，两节各自承载枪位与受击区域，左翼端点保持原位置

#### Scenario: Reflow after a later structural change

- **WHEN** 玩家先安装机枪、发动机和翼段，再安装会改变同一中心线长度的结构卡
- **THEN** 已有部件沿中心线重新解析到对应节点，部件间距、枪口、尾焰、碰撞区域和视觉轮廓保持连接

### Requirement: Wing assembly and profile

每条半翼 MUST 以翼根段开始、翼尖段收尾。带一台原装翼载发动机的半翼默认由翼根段、发动机段、翼尖段组成。插段 MUST 遵循选定翼线的分段方向、折点和截面。

#### Scenario: Insert mixed modules in an engine-bearing wing

- **WHEN** 右翼原装一台发动机，并依次加装各长 1 米的机枪段和辅助发动机段
- **THEN** 从内向外依次为翼根、原发动机段、机枪段、辅助发动机段、原翼尖。该翼线增长 2 米，原翼尖保留附件与损伤，两处新增挂载各占其段，接缝连续

#### Scenario: Preserve the profile of the selected wing

- **WHEN** 对平直、上反、下反、海鸥和倒海鸥五种原装翼形分别在翼尖前插段
- **THEN** 从正面可辨原型的水平走向、升降方向或内外段折点，新段沿所选外翼方向接合。上下分层及前后串列构型只有卡牌指定的翼线参与插段

### Requirement: Engine installation and fuselage contour

战斗构型 MUST 指定发动机的承载部件、站位和轴向，并按动力形式配置桨毂或喷口。各机身 MUST 由本机型沿中心线的截面形成连续轮廓。

#### Scenario: Inspect tractor and pusher installations

- **WHEN** 从侧面观察前置牵引式和后置推进式构型，再沿相邻中心线插入结构段
- **THEN** 可分别看到桨盘位于相应桨轴前端和后端。桨毂对齐轴心，桨叶旋转范围与邻近机身、机翼、尾翼及挂载保持净距

#### Scenario: Insert a fuselage bay

- **WHEN** 在带驾驶舱和尾翼的机身上插入尾舱
- **THEN** 新舱两端衔接相邻截面，机鼻、驾驶舱和尾部仍可从轮廓辨认，尾翼及下游动力附件随所属段移动，受击范围对应新外形

### Requirement: Multiple centerline topologies

构型解析 MUST 支持多条互相连接或平行的中心线。中心线图 MUST 能表达多机身、上下或前后串列的多层机翼、左右分置的翼段、分支短舱及连接梁。

#### Scenario: Twin fuselage build

- **WHEN** 战斗配置定义左右两条机身中心线，并通过横向连接线挂载共同的机翼和武器段
- **THEN** 两条机身各自拥有独立的部件、受击区和挂点，连接梁按自己的中心线解析，新增左侧或右侧部件不会被压到另一条机身上

#### Scenario: Biplane and tandem-wing build

- **WHEN** 战斗配置定义上下双翼或前后串列双翼中心线，并在其中一条线上安装延长段
- **THEN** 只有被选中的翼层或前后翼线延长，其他翼线保持其原有站位、间距、碰撞区域和挂点

### Requirement: Deterministic structure graph resolution

相同基础机型和相同有序升级卡 MUST 从基础中心线图重建出相同的结构图。升级顺序、撤销、展厅重放和正式出击重建不得依赖上一次运行留下的绝对坐标。

#### Scenario: Rebuild the same card sequence

- **WHEN** 展厅和正式出击使用同一基础机型与同一有序卡序重建构型
- **THEN** 两处得到相同的中心线、连接节点、部件位置、枪口位置、受击区域、外包围范围和飞行统计

#### Scenario: Branch from an earlier build

- **WHEN** 玩家从 A+B 撤销 B 并改装 C，或从基础构型重新应用 A+C
- **THEN** 结构图只包含当前卡序产生的中心线和部件，不保留 B 的连接节点、挂点、碰撞区域或视觉残留

### Requirement: Resolved layout drives combat and presentation

模拟、碰撞、武器锚点、发动机出口、部件脱落和渲染 MUST 消费同一份解析后的中心线布局结果。父节点损坏或脱落时，子节点及其挂点 MUST 按结构图规则失去支撑。

#### Scenario: Detached parent segment

- **WHEN** 承载机枪的外翼段被摧毁或脱落
- **THEN** 该翼段的下游部件、枪口和碰撞区域从同一连接节点中移除或停用，其他中心线上的武器继续工作

### Requirement: Fleet of mounts benefits from common rate cards

普通整机射速卡 MUST 以同一倍率提高机上每一个自动开火挂点的发射频率，包括原装和后续安装的挂点。

#### Scenario: Six firing stations benefit from one common card

- **WHEN** 一架重型机以合法的局内升级组出六个健康的独立炮位，并选取一张标明倍率 M 的普通射速卡
- **THEN** 在相同目标条件下，六个炮位各自的发射冷却间隔均变为原值除以 M，固定步进允许一个模拟步的时间误差，六个炮位仍从各自位置开火

#### Scenario: Add mounts before or after rate cards

- **WHEN** 玩家用相同合法卡组先加炮位后提速，或先提速后加炮位
- **THEN** 两种顺序的各炮位最终有效射速一致；多张普通射速卡的倍率逐张相乘，每张只结算一次

#### Scenario: Damaged or reloading weapons

- **WHEN** 玩家在有禁用枪位、待锁定武器或投弹舱的飞机上选取射速卡
- **THEN** 禁用枪位按原损伤状态停火，待锁定武器仍须完成锁定，投弹舱沿用单独的装填属性；卡面明确强化自动开火与适用炮位数

### Requirement: Quality and quantity have observable effects

每张强化卡 MUST 标注提质或提量，并为改装后的机体产生与实际收益一致、可从模型或动作辨认的视觉变化。

#### Scenario: Improve an existing part

- **WHEN** 玩家安装同座双联、整机伤害、发动机功率、持续加力或快速冷却卡
- **THEN** 卡面显示对应范围和本机前后值；双联显示原枪座上的两个发射点，整机伤害显示强化弹着，动力与冷却分别显示动力部件动作与加力消耗或恢复节奏

#### Scenario: Repeat an eligible quality card

- **WHEN** 玩家再次合法选取同一张提质卡
- **THEN** 改装后的机体能体现本层相对上层的差异，例如更密的射击节奏或更快的储备恢复，卡面数值与最终模拟构型一致

#### Scenario: Extend a single wing

- **WHEN** 机体安装左翼延长机枪段，并在允许重复时继续向同侧扩建
- **THEN** 每次在左翼尖段之前插入一节可见翼面和独立枪位，右翼端点保持原位；枪口、受击区域和损伤效果位于对应的新翼段

#### Scenario: Extend the rear fuselage

- **WHEN** 玩家选取左舷尾段侧射舱
- **THEN** 尾翼前出现新机身段、尾翼后移，侧窗炮口对左侧斜后方有效目标开火；再次合法选取右舷配套舱时，两侧枪位可独立工作

### Requirement: Fly a late-game assembled aircraft

玩家 MUST 能通过正式局内升级连续叠加结构牌与整机提质牌，并驾驶由此形成的非对称多炮位机体与敌机交战。

#### Scenario: A six-station asymmetric gunship in battle

- **WHEN** MASTODON 从原装左右翼主武器和机背炮塔起步，在一局中先后安装两节左外翼机枪段、一座左舷尾段侧射舱及普通整机射速卡
- **THEN** 正常空战镜头可辨两节外翼和加长尾舱，飞机能转向并与真实敌机交火；六个独立炮位在各自射界有目标时按改装后的节奏工作，外翼枪位被打坏后其他完好炮位继续作战
