# 武器系统

> 本文记录 0.3.0 阶段的初版设计。当前实现见下列入口。[挂点、扫掠与命中反馈规格](../../openspec/specs/battle/weapons-targeting-and-bombing/spec.md)

## 设计目标

武器由数据驱动，并通过飞机上的实际挂点表现。玩家不需要手动拖动瞄准线，主要决策是移动飞机把目标放进有效扇形、保持锁定、管理能量和选择升级方向。

武器分为定向武器、炮台武器和范围武器。三种武器都能组合穿透、弹射、齐射、散射、爆炸、制导和 buff。

## 数据结构

```ts
type WeaponCategory = 'directional' | 'turret' | 'area'
type TargetLayer = 'air' | 'ground' | 'both'

type WeaponConfig = {
  id: string
  name: string
  category: WeaponCategory
  targetLayer: TargetLayer
  damage: number
  damageType: 'kinetic' | 'explosive' | 'fire' | 'energy'
  fireRate: number
  projectileSpeed: number
  range: number
  projectileCount: number
  spreadAngle: number
  pierceCount: number
  bounceCount: number
  explosionRadius: number
  lockOn: boolean
  lockTime: number
  lockArc: number
  lockLossRate: number
  turret: boolean
  turretTurnRate: number
  turretArc: number
  homing: boolean
  homingTurnRate: number
  homingLifetime: number
  homingNeedsEscort: boolean
  cooldownAfterFire: number
  buffs: BuffEffect[]
  mountType: 'nose' | 'wing' | 'turret' | 'bombBay' | 'hardpoint'
}
```

运行时实例另外保存当前冷却、当前目标、锁定进度、炮塔角度、弹药数量、挂点损坏状态和最后一次命中时间。

## 目标选择

目标评分使用距离、夹角、威胁、血量和目标类型。玩家飞机本地前方扇形是主要筛选范围。

```text
score = threatWeight * target.threat
      + angleWeight * angleScore(targetDirection, weaponForward)
      + distanceWeight * distanceScore(distance)
      + healthWeight * target.priorityHealth
```

对地武器优先使用准心落点、目标标记和地面预警圈。空中武器优先选择进入扇形的敌人，避免射击角度和 UI 目标不一致。

## 定向武器

定向武器挂在机头、机翼或外挂点上，使用固定前向和窄扇形自动开火。

- 扇形默认宽度 24°
- 目标进入扇形并且距离小于射程时，武器按射速开火
- 目标不在扇形内时不会自动大幅转向
- 摇杆方向改变飞机朝向，玩家通过提前转向把目标放入扇形
- 弹道和射击点使用真实挂点位置，左右翼武器的弹道不会合并成一条线

## 炮台武器

炮台有独立旋转环和炮管。炮台方向由目标选择系统提供，炮塔系统限制旋转速度和最大角度。

```text
turretError = shortestAngle(targetHeading, turretHeading)
turretHeading += clamp(turretError, -turretTurnRate * deltaTime, turretTurnRate * deltaTime)
canFire = abs(turretError) < fireTolerance && withinArc(target)
```

炮台损坏后仍保留在机体上，旋转速度逐步降低，进入 `disabled` 后停止发射。炮台挂在机背时会增加顶部轮廓和重量，挂在翼端时会扩大侧面迎弹面。

## 范围武器

范围武器作用于地面落点或目标周围区域。第一版范围武器全部通过轰炸模式投放，保持按钮和准心逻辑一致。

- 投弹前显示预测落点和爆炸半径
- 爆炸伤害按距离衰减
- 火焰和持续区域在地面留下可识别的颜色与烟雾
- 范围武器可以破坏建筑、地面炮台和道路上的车辆

## 锁定武器

锁定武器需要目标持续处于有效扇形和射程内。

### 锁定状态

```ts
type LockState = 'idle' | 'acquiring' | 'locked' | 'fired' | 'lost'
```

锁定进度在 `acquiring` 中逐渐增加，目标离开扇形时按 `lockLossRate` 衰减。锁定扇形的开口从宽到窄，颜色从蓝色经过黄色到红色。达到 100% 时扇形收窄到最小，短暂闪白后发射。

### 提前量

锁定检测使用目标当前位置和短时预测位置。

```text
predictionTime = clamp(distance / projectileSpeed * 0.35, 0, 0.7)
predictedPosition = target.position + target.velocity * predictionTime
```

预测只影响锁定和发射方向，目标标记仍显示真实位置，避免玩家误解敌人的当前状态。

## 投射物类型

### 直线弹

- 低成本、射速高
- 使用对象池
- 命中后根据穿透数量决定是否销毁

### 火箭

- 速度较慢，带小幅制导
- 命中后产生小范围爆炸
- 适合定向武器或炮塔武器

### 锁定导弹

- 需要完整锁定后发射
- 目标离开后仍持续追踪一段时间
- 可以配置是否需要玩家伴随
- 玩家离开护航距离后，导弹转向能力降低

### 炸弹

- 从炸弹舱离机后沿抛物线下降
- 落点由投弹瞬间的准心位置决定
- 命中地面后产生爆炸、尘土、冲击波和积分反馈

### 持续区域

- 在地面生成持续时间有限的火焰、电弧或毒雾区域
- 对多个地面目标重复造成伤害
- 区域边缘使用透明度和粒子表示，避免遮挡准心

## 武器附加效果

| 效果 | 行为 |
| --- | --- |
| 穿透 | 每命中一个目标减少一次穿透次数 |
| 弹射 | 命中后按碰撞法线反射，限制最大弹射次数 |
| 齐射 | 从多个挂点同时发射，允许每个挂点有偏移 |
| 散射 | 按角度分布生成多个投射物 |
| 爆炸 | 命中点附近造成范围伤害和击退 |
| 制导 | 投射物按最大转向速度追踪目标 |
| 伴随制导 | 玩家持续靠近目标时保持更高制导强度 |
| 点燃 | 目标进入持续伤害状态并显示火焰 |
| 减速 | 目标速度在短时间内降低 |
| 破甲 | 后续爆炸或机炮伤害提高 |
| 标记 | 提高其他武器对该目标的目标评分 |

## 命中反馈

- 不同伤害类型使用不同颜色、音效和粒子
- 命中部件时在部件本地位置生成火花或裂纹
- 命中发动机显示黑烟和喷火
- 命中机翼显示碎片和短暂失衡动画
- 爆炸按距离产生不同大小的冲击波
- 伤害数字只在短间隔内合并，避免密集弹道遮住飞机

## 首版平衡目标

- 机枪负责持续稳定输出
- 机炮负责短距离高伤害
- 炮塔负责覆盖侧面和追击目标
- 锁定导弹负责处理高价值或高机动目标
- 炸弹负责清理地面区域
- 范围持续武器负责制造地面封锁区域

## 验收标准

- 三类武器在视觉、目标选择和操作节奏上有明显差异。
- 定向武器使用窄扇形，玩家可以通过提前转向命中目标。
- 炮台有独立旋转速度和挂点方向。
- 锁定武器显示清晰的收窄、变色、完成和失锁反馈。
- 受损挂点会影响对应武器的射击或旋转。
- 投射物、范围伤害和持续区域都支持对象池或可控生命周期。
