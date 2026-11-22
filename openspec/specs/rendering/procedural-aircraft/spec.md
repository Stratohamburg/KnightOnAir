# rendering/procedural-aircraft Specification

## Purpose

定义玩家和敌人的程序化飞机、载具构型、局部锚点、姿态同步、部件损伤表现和碎屑效果，保证渲染结果持续反映当前战斗构型与损伤状态。

## Requirements

### Requirement: Configuration-driven aircraft shape

飞机和主要空中载具 MUST 根据机体配置生成可辨识的机身、机翼、发动机、尾翼、炮塔、浮筒或飞艇结构。玩家和敌人的轮廓 MUST 能表达时代、角色和机体大小差异。

#### Scenario: Era-specific shape

- **WHEN** 玩家装备不同时代或不同形状的机体
- **THEN** 展示和战斗场景使用对应构型，而不会退化成同一个通用轮廓

### Requirement: Shared local anchors

每个可见部件、武器挂点、发动机出口和损伤效果锚点 MUST 保存局部三维位置和必要的局部旋转。玩家和敌人的世界变换 MUST 由同一个根节点姿态计算，包含位置、航向、bank 和局部高度。

#### Scenario: Install structural upgrade

- **WHEN** 局内安装机翼、发动机或炮塔升级
- **THEN** 对应部件和其武器挂点出现在正确的局部位置和比例上

#### Scenario: Aircraft banks

- **WHEN** 飞机在转向中产生 bank
- **THEN** 武器挂点、发动机烟雾、命中特效和部件碎屑跟随同一个根节点姿态

### Requirement: Damage presentation without hit flash

玩家和敌人 MUST 根据部件损伤显示局部受损材质、火花、烟雾、火焰或结构碎裂。系统 MUST NOT 使用覆盖整架飞机的显眼受击闪白作为主要命中反馈。

#### Scenario: Damaged engine

- **WHEN** 发动机部件进入严重损伤
- **THEN** 对应发动机出口附近显示黑烟或火焰，烟雾从部件锚点开始并受风场影响

#### Scenario: Damaged wing

- **WHEN** 机翼部件受到连续命中或进入禁用状态
- **THEN** 机翼显示局部火花、裂纹、烟雾或小型碎片，效果不会改变模拟状态

#### Scenario: Impact debris

- **WHEN** 投射物命中并造成足够的部件伤害
- **THEN** 命中点生成沿命中方向和部件局部法线散开的碎屑，碎屑短时间后回收或消失

### Requirement: Persistent impact smoke

命中烟雾 MUST 绑定到命中世界坐标，短时间保留在原地后逐渐漂移、变淡并消失。局部部件烟雾 MUST 随机体移动，命中残留烟雾 MUST 保留命中时的世界位置。

#### Scenario: Hit smoke remains in world space

- **WHEN** 敌机高速飞过后在原位置被命中
- **THEN** 命中烟雾短时间留在原位置，不跟随敌机整体移动

#### Scenario: Engine smoke follows aircraft

- **WHEN** 发动机持续损伤并且飞机改变航向或 bank
- **THEN** 发动机烟雾从发动机局部锚点持续生成，并跟随飞机姿态和移动

### Requirement: Part debris and detachment

可脱落部件 MUST 在进入 destroyed 状态时从主机体视觉树分离，继承命中时的世界位置、姿态和速度，并播放短时旋转、下坠、烟雾或火花效果。不可脱落部件 MUST 保留在机体上并使用禁用状态表现。

#### Scenario: Wing tip detaches

- **WHEN** 可脱落翼尖生命归零并进入 destroyed
- **THEN** 翼尖从机体分离并沿命中方向飞散，主机体继续使用剩余部件构型

#### Scenario: Non-detachable engine disabled

- **WHEN** 不可脱落发动机生命归零
- **THEN** 发动机保留在机体上，停止对应推进力并持续显示损伤烟雾

### Requirement: Aircraft destruction presentation

玩家飞机进入坠毁阶段或敌机整机生命归零时 MUST 使用匹配实体层级的坠落、爆炸、持续烟雾和碎屑表现。击毁表现 MUST 强于普通命中和部件禁用表现。

#### Scenario: Aircraft death

- **WHEN** 整机生命归零
- **THEN** 模型显示下坠或失控滚转，场景生成爆炸、持续烟雾和多方向碎屑

### Requirement: Readable low-poly presentation

飞机模型 MUST 在目标移动端视口保持轮廓、机头方向、主要挂点、烟雾位置和损伤层次可读。

#### Scenario: Narrow viewport

- **WHEN** 场景显示在 360×640 视口
- **THEN** 当前机体轮廓、主要部件和命中特效仍然可辨识

