# battle/weapons-targeting-and-bombing Delta

## MODIFIED Requirements

### Requirement: Shared mount transform

玩家和敌人的武器 MUST 使用运行时 3D 内容库提供的同一套局部三维挂点数据。挂点世界位置 MUST 由实体根节点位置、航向、bank、局部高度和挂点局部变换共同计算。任何武器不得使用只考虑二维航向的独立坐标公式。

#### Scenario: Weapon follows aircraft bank

- **WHEN** 飞机在转向中改变航向和 bank
- **THEN** 枪口、炮管和发射烟雾的发射器随同一局部挂点旋转，开火时弹体采样该挂点的世界位置

#### Scenario: Enemy and player use same mount transform

- **WHEN** 玩家和敌人从对应挂点发射同一种武器
- **THEN** 两者使用相同的局部到世界变换规则，只有配置和控制意图不同

#### Scenario: Projectile leaves its anchor

- **WHEN** 飞机在滚转时开火
- **THEN** 弹体从发射瞬间的枪口世界位置进入弹道，之后随自身轨迹前进

### Requirement: Swept aircraft collision

投射物 MUST 使用连续路径或等效扫掠检测处理弹体与目标的相对运动。命中检测 MUST 先判断整机碰撞体，再解析受损部件，不得因为某个部件已禁用而让整机失去命中结果。

#### Scenario: Fast projectile crossing

- **WHEN** 投射物在一个模拟步内跨过敌人整机碰撞区域
- **THEN** 系统仍然检测到整机命中，并返回扫掠得到的世界接触点。存在明确部件分区时，记录沿路径最早命中的分区

#### Scenario: Projectile crosses disabled part

- **WHEN** 投射物穿过已经禁用的部件区域
- **THEN** 经过仍附着的禁用部件区域的弹道仍可命中整机，伤害按整机受击规则分配

#### Scenario: Impact uses swept contact

- **WHEN** 弹体在命中步结束时已经越过飞机
- **THEN** 命中事件和爆点位于扫掠接触点

### Requirement: Impact effects

投射物命中 MUST 产生位置明确的命中特效。命中特效 MUST 以外发光命中爆点和外发光粒子为核心，并包含烟雾。命中特效可根据伤害类型增加火花、火焰、冲击环和碎屑。命中烟雾 MUST 在命中世界位置短暂停留后逐渐消失。命中时机体材质不得整机闪白。

#### Scenario: Kinetic hit

- **WHEN** 机枪或机炮命中飞机
- **THEN** 命中点产生短时外发光命中爆点、外发光火花和碎屑，并生成向上或沿风向漂移的烟雾

#### Scenario: Explosive hit

- **WHEN** 火箭、导弹或爆炸伤害命中
- **THEN** 命中点产生更大范围的外发光爆点、外发光冲击粒子、冲击环、碎片和持续时间更长的烟雾

#### Scenario: Persistent impact smoke

- **WHEN** 命中特效生成烟雾
- **THEN** 烟雾先在命中世界位置短暂停留，再受风场影响缓慢漂移并淡出。目标移动或离场期间，残留仍按自己的生命周期更新
