# rendering/procedural-aircraft Delta

## MODIFIED Requirements

### Requirement: Shared local anchors

每个可见部件、武器挂点、发动机出口和损伤效果锚点 MUST 保存局部三维位置和必要的局部旋转。玩家和敌人的世界变换 MUST 由同一个根节点姿态计算，包含位置、航向、bank 和局部高度。

#### Scenario: Install structural upgrade

- **WHEN** 局内安装机翼、发动机或炮塔升级
- **THEN** 对应部件和其武器挂点出现在正确的局部位置和比例上

#### Scenario: Aircraft banks

- **WHEN** 飞机在转向中产生 bank
- **THEN** 武器挂点和发动机烟雾发射器跟随同一个根节点姿态。命中爆点和碎屑使用事件发生时的接触点或部件姿态

### Requirement: Damage presentation without hit flash

玩家和敌人 MUST 根据部件损伤显示局部受损材质、外发光火花、烟雾、火焰或结构碎裂。开火和命中爆点 MUST 使用外发光核心与柔和光晕形成局部亮度对比。开火和命中 MUST 将发光限制在爆点及粒子范围内，受击时整架飞机的材质不得闪白。

#### Scenario: Damaged engine

- **WHEN** 发动机部件进入严重损伤
- **THEN** 对应发动机出口附近显示黑烟或火焰，烟雾从部件锚点开始并受风场影响

#### Scenario: Damaged wing

- **WHEN** 机翼部件受到连续命中或进入禁用状态
- **THEN** 机翼显示局部外发光火花、裂纹、烟雾或小型碎片，效果不会改变模拟状态

#### Scenario: Impact debris

- **WHEN** 投射物命中并造成足够的部件伤害
- **THEN** 命中点生成外发光粒子和沿命中方向及部件局部法线散开的碎屑，碎屑短时间后回收或消失

### Requirement: Persistent impact smoke

命中烟雾 MUST 绑定到命中世界坐标，短时间保留在原地后逐渐漂移、变淡并消失。持续损伤的烟雾发射源 MUST 随机体移动。烟粒离开发射源后按自己的世界轨迹更新。

#### Scenario: Hit smoke remains in world space

- **WHEN** 敌机高速飞过后在原位置被命中
- **THEN** 命中烟雾短时间留在原位置，不跟随敌机整体移动

#### Scenario: Engine smoke follows aircraft

- **WHEN** 发动机持续损伤并且飞机改变航向或 bank
- **THEN** 发动机烟雾从发动机局部锚点持续生成，发射源跟随飞机姿态和移动，已发出的烟粒形成尾迹
