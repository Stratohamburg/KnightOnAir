# battle/weapons-targeting-and-bombing Specification

## Purpose

定义数据驱动武器从局部挂点、目标选择、锁定、开火、投射物运动、整机命中到持续视觉反馈的完整行为，并覆盖轰炸模式的稳定、包线、冷却和地面落点。

## Requirements

### Requirement: Shared mount transform

玩家和敌人的武器 MUST 使用同一套局部三维挂点数据。挂点世界位置 MUST 由实体根节点位置、航向、bank、局部高度和挂点局部变换共同计算。任何武器不得使用只考虑二维航向的独立坐标公式。

#### Scenario: Weapon follows aircraft bank

- **WHEN** 飞机在转向中改变航向和 bank
- **THEN** 枪口、炮管、发射烟雾和投射物出生点保持在同一局部挂点上

#### Scenario: Enemy and player use same mount transform

- **WHEN** 玩家和敌人从对应挂点发射同一种武器
- **THEN** 两者使用相同的局部到世界变换规则，只有配置和控制意图不同

### Requirement: Mount-aware weapon behavior

武器 MUST 从有效挂点发射，并受挂点部件状态、目标层、射程、扇形和冷却约束。挂点失效不得影响其他有效挂点。

#### Scenario: Disabled mount

- **WHEN** 武器所属部件被禁用
- **THEN** 该武器不能继续发射，其他有效挂点仍可按规则工作

#### Scenario: Target layer filtering

- **WHEN** 武器目标层不包含当前目标层
- **THEN** 武器不会对该目标产生命中或锁定

### Requirement: Locking and guided fire

具有锁定能力的武器 MUST 按目标角度、距离和锁定时间积累锁定，并在失去条件时按规则衰减。锁定武器完成锁定后 MUST 记录目标和发射时的预测方向。

#### Scenario: Lost lock decay

- **WHEN** 已锁定目标离开有效范围
- **THEN** 锁定进度按定义速率下降，并在再次满足条件时继续积累

#### Scenario: Guided projectile

- **WHEN** 锁定武器完成合法锁定并开火
- **THEN** 投射物记录目标并在生命周期内按制导规则追踪

### Requirement: Swept aircraft collision

投射物 MUST 使用连续路径或等效扫掠检测处理高速运动。命中检测 MUST 先判断整机碰撞体，再解析受损部件，不得因为某个部件已禁用而让整机失去命中结果。

#### Scenario: Fast projectile crossing

- **WHEN** 投射物在一个模拟步内跨过敌人整机碰撞区域
- **THEN** 系统仍然检测到整机命中，并将伤害归因到最近或沿路径最早的部件

#### Scenario: Projectile crosses disabled part

- **WHEN** 投射物穿过已经禁用的部件区域
- **THEN** 投射物仍然可以命中整机，并把伤害转移到其他可用部件

### Requirement: Weapon fire feedback

每次成功开火 MUST 产生与真实挂点绑定的枪口反馈。反馈至少包含短时枪口闪光、发射方向变化和可识别的发射音频事件。高射速武器 MUST 使用节流或分组音效，避免声音堆叠。

#### Scenario: Muzzle flash at mount

- **WHEN** 武器从有效挂点发射
- **THEN** 枪口闪光和发射烟雾出现在该挂点的世界位置，并跟随实体航向与 bank

### Requirement: Projectile readability

投射物 MUST 能在移动端视口中被识别为具有方向和速度的弹道。弹体长度、尾迹或亮度至少有一项随投射物类型和速度变化。玩家和敌方弹道 MUST 使用稳定区分的材质和颜色。

#### Scenario: High-speed bullet

- **WHEN** 高速机炮或机枪子弹在场景中飞行
- **THEN** 玩家可以通过短尾迹或速度相关长度判断其飞行方向和来源

#### Scenario: Missile trail

- **WHEN** 制导导弹处于有效生命周期
- **THEN** 导弹保留连续尾迹，尾迹跟随导弹当前位置和航向

### Requirement: Impact effects

投射物命中 MUST 产生位置明确的命中特效。命中特效 MUST 包含烟雾，并可根据伤害类型增加火花、火焰、冲击环和碎屑。命中烟雾 MUST 在命中世界位置短暂停留后逐渐消失。系统不得把整机受击反馈设计为显眼的受击闪白。

#### Scenario: Kinetic hit

- **WHEN** 机枪或机炮命中飞机
- **THEN** 命中点产生短时火花和碎屑，并生成向上或沿风向漂移的烟雾

#### Scenario: Explosive hit

- **WHEN** 火箭、导弹或爆炸伤害命中
- **THEN** 命中点产生更大范围的闪光、冲击环、碎片和持续时间更长的烟雾

#### Scenario: Persistent impact smoke

- **WHEN** 命中特效生成烟雾
- **THEN** 烟雾留在命中世界位置一小段时间，受风场影响逐渐漂移、变淡并消失

### Requirement: Bombing envelope

系统 MUST 仅在轰炸模式下、机体拥有有效炸弹挂载、稳定度达标、冷却结束且瞄准点位于前向包线内时允许投弹。

#### Scenario: Invalid bomb aim

- **WHEN** 地面落点位于飞机后方或超出前向微调锥
- **THEN** 投弹按钮保持不可用且不会生成炸弹

#### Scenario: Stable bomb drop

- **WHEN** 玩家进入轰炸模式并达到稳定门槛、目标位于有效包线且冷却结束
- **THEN** 系统生成具有固定落点的炸弹并开始冷却

### Requirement: Terrain-aware bomb result

炸弹 MUST 飞向投放时确定的世界坐标，落点表现使用最终地表高度。范围伤害按该炸弹允许的目标层判定。

#### Scenario: Fixed landing point

- **WHEN** 玩家投放炸弹后继续移动飞机
- **THEN** 炸弹仍然落向投放时锁定的地面位置

