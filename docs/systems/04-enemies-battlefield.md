# 敌人和战场系统

> 本文记录 0.3.0 阶段的初版设计。当前实现见下列入口。[空战状态与飞行包线规格](../../openspec/specs/battle/air-combat-behavior/spec.md) · [遭遇导演规格](../../openspec/specs/battle/encounter-director/spec.md)

## 战场目标

战场同时提供空中追击、地面火力、金币路线和轰炸目标。敌人需要形成清晰的压力层级，让玩家知道自己正在躲避什么、优先击毁什么，以及什么时候应该切换轰炸模式。

敌人生成使用导演系统控制密度、编队、精英事件和风场强度。首版不追求完全随机，优先保证每个阶段出现可理解的组合。

## 目标层级

### 即时威胁

- 正在瞄准玩家的追猎机
- 已发射追踪导弹
- 地面防空炮的红色预警线
- 即将进入爆炸范围的炮弹

### 战术威胁

- 正在召唤增援的侦察机
- 提供范围保护的护卫无人机
- 形成区域封锁的机枪阵地和火焰区域
- 逼近玩家航线的轰炸机

### 高价值目标

- 资源车
- 精英空艇
- 指挥无人机
- 被多个护卫包围的地面设施

## 空中敌人初版

初版详细数据见 [初版敌人](../content/INITIAL_ENEMIES.md)。这里定义敌人系统的共同规则。

### 空中 AI 状态

```ts
type AirEnemyState =
  | 'entering'
  | 'cruising'
  | 'attacking'
  | 'breaking'
  | 'fleeing'
  | 'disabled'
  | 'destroyed'
```

空中敌人使用有限状态机，不使用重型导航。大多数敌人只需要目标方向、距离、攻击窗口和离场方向。

```text
entering -> cruising when inside combat radius
cruising -> attacking when targetScore exceeds threshold
attacking -> breaking when attack window ends
breaking -> cruising after break distance
attacking -> fleeing when health is critical
any -> disabled when critical part is disabled
```

### 编队

- 直线编队，适合机炮和扫射
- V 字编队，鼓励从侧面切入
- 环绕编队，展示炮塔和散射武器价值
- 护航编队，高价值目标位于中心
- 穿越编队，敌人从一侧进入并从另一侧离开

编队通过局部锚点控制队形，成员受到伤害或失去护航目标后可以脱离。

## 地面敌人初版

地面单位固定在地表或沿道路移动，不进入空战平面。它们通过范围预警、瞄准线和弹道影响玩家航线。

### 地面武器规则

- 发射前至少提供 0.7 秒的视觉预警
- 追踪导弹在发射后显示来源方向和尾迹
- 范围炮击显示落点圈，落点随玩家预测轨迹移动
- 地面炮塔拥有可破坏炮管或弹药箱部件
- 地面建筑可以被轰炸分阶段摧毁

## 战场地表

地面由程序化分块网格组成，每块记录高度、材质区域、道路、可破坏物和风场采样参数。

```ts
type GroundChunk = {
  id: string
  center: Vector2
  size: number
  heightSeed: number
  materialSeed: number
  roads: RoadSegment[]
  targets: GroundTargetSpawn[]
  windSeed: number
}
```

地面视野需要比敌人生成半径更大，避免透视相机看到战场边缘突然出现。远处地面降低网格细分和透明效果，近处地面保留目标阴影和弹坑。

## 云层和可见性

- 云层是透明 billboard 或低密度体积片，不阻挡重要 UI
- 玩家和敌人顶部轮廓增加边缘光，保证在云层前后都能识别
- 锁定目标在云层中保留颜色环和方向标记
- 轰炸落点显示在地面上方的小型投影层
- 云层不改变碰撞，只改变颜色、雾度和局部对比度

## 风场

风场是 XZ 平面的向量场，使用低频噪波和阶段性风带组合。

```text
wind = baseWind
     + noiseVector(worldPosition * 0.015, time * 0.03) * gustStrength
     + activeGustDirection * gustEnvelope
```

风影响飞机速度向量、弹道偏移和轰炸准心稳定度。锁定和目标选择使用目标实际速度，因此玩家可以通过提前量应对风。

## 敌人生成导演

导演系统每 8 到 12 秒选择一次下一组内容，输入包括存活时间、当前玩家速度、生命、武器输出、机体大小和最近一次敌人类型。

```ts
type EncounterDirectorInput = {
  elapsed: number
  playerHealthRatio: number
  playerPartDamage: number
  playerDps: number
  playerFootprint: number
  currentAirCount: number
  currentGroundCount: number
  recentEncounterTags: string[]
}
```

导演规则。

- 玩家生命低于 35% 时减少持续追击，增加金币和逃生空隙
- 玩家输出过高时加入护卫、分散目标和地面火力
- 玩家长期不使用轰炸模式时提高高价值地面目标权重
- 玩家构筑偏向大型机体时增加侧面包围和穿透弹
- 玩家构筑偏向轻型机体时增加范围预警和追踪导弹

## 初版波次节奏

| 时间 | 内容 |
| --- | --- |
| 0 到 30 秒 | 追猎机、侦察机、少量金币路线 |
| 30 到 60 秒 | 追猎机和机枪阵地组合，第一次要求绕行 |
| 60 到 90 秒 | 轰炸机、导弹车、护卫无人机 |
| 90 到 120 秒 | 第一个精英空艇和地面防空组合 |
| 120 秒以后 | 混合编队、风带、精英护航和高价值目标 |

## 击毁和掉落

- 普通敌人掉落少量经验球或金币
- 高价值敌人掉落大金币和升级选择增益
- 精英敌人掉落修复包、临时 buff 或多倍经验
- 地面建筑摧毁后生成轰炸积分和区域资源
- 敌人掉落物生成在可见范围内，避免掉到云层和屏幕外

## 验收标准

- 空中敌人和地面敌人形成不同的压力类型。
- 每种敌人有清晰的进入、攻击、受损和死亡反馈。
- 地面攻击在命中前提供足够预警。
- 云层、透视相机和风场不会让玩家无法识别关键威胁。
- 导演系统能根据玩家机体大小、部件损坏和输出强度调整战斗节奏。
