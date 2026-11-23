# 机体、部件和损坏系统

> 本文记录 0.3.0 阶段的初版设计。当前实现见下列入口。[整机碰撞、部件归因与损伤分配规格](../../openspec/specs/battle/aircraft-damage/spec.md)

## 设计目标

飞机由简单几何体拼成，部件拥有独立的挂点、碰撞体、生命值和损坏表现。升级会把新的部件装到机体上，受到攻击后部件可以单独失效。玩家通过视觉、声音、烟雾和操控变化理解飞机目前的状态。

机体系统同时承担四项职责。

- 管理飞机的空间形状和可见轮廓
- 管理部件挂点和升级后的构型
- 管理命中分区和部件生命值
- 把损坏结果转换为操控、武器和视觉反馈

## 机体坐标

每架飞机使用本地坐标，统一约定如下。

- `+X` 是飞机右侧
- `-X` 是飞机左侧
- `+Z` 是飞机前方
- `-Z` 是飞机后方
- `+Y` 是飞机上方

所有部件都保存本地变换。飞机转向时，整棵部件树一起旋转，损坏烟雾和火焰挂在部件的本地坐标上。

```ts
type AircraftPart = {
  id: string
  socket: 'nose' | 'center' | 'tail' | 'leftWing' | 'rightWing' | 'top' | 'bottom'
  localPosition: Vector3
  localRotation: Euler
  scale: Vector3
  geometry: GeometryRecipe
  hitShape: HitShape
  healthMax: number
  weight: number
  drag: number
  visualState: PartVisualState
  damageEffects: DamageEffectConfig
}
```

## 简单几何体拼装

首版不使用外部 3D 模型。部件由 Box、Cylinder、Cone、Sphere、低分段圆柱和自定义截面棱柱拼成。

### 基础几何体

| 几何体 | 使用场景 |
| --- | --- |
| 低分段椭球 | 机身、燃料舱、雷达罩 |
| 截面棱柱 | 机翼、尾翼、装甲板 |
| 低分段圆柱 | 发动机、炮管、炮塔环 |
| 锥体和截锥 | 喷口、导弹头、炸弹 |
| 盒体 | 弹药箱、外挂油箱、建筑部件 |
| 多段折线棱柱 | 火焰、断裂件、天线 |

每个部件使用材质参数表达材质差异。材质至少包含基础色、粗糙度、金属度、边缘光颜色、损伤颜色和局部噪波强度。

## 初始机体构型

第一批机体数据见 [初版机体](../content/INITIAL_AIRFRAMES.md)。这里定义构型规则。

### 小型机体

- 机身短，机翼窄，迎弹面小
- 加速度和转向率高
- 可用挂点少
- 部件损坏后性能下降明显，但总体仍容易修正航向

### 中型机体

- 机翼和机身比例均衡
- 挂点数量适中
- 可以兼容定向武器、炮台和范围武器
- 适合作为首个完整系统展示机体

### 大型机体

- 机身长，翼展大，正面和侧面迎弹面增加
- 生命值、能量和挂点多
- 加速度、转向率和转向恢复较低
- 部件可以形成明显的左右重量差和前后惯性差

## 挂点和空间升级

升级不是在飞机外面叠加一个图标，而是改变实际构型。

| 挂点方向 | 外观影响 | 手感影响 |
| --- | --- | --- |
| 左翼 | 左翼变长、增加发动机或武器 | 左右转向不对称，左侧碰撞宽度增加 |
| 右翼 | 右翼变长、增加发动机或武器 | 左右转向不对称，右侧碰撞宽度增加 |
| 机头 | 机身前段变长、增加雷达或炮 | 迎弹面积增加，前向武器更强 |
| 机尾 | 尾段变长、增加尾炮或稳定翼 | 惯性增大，后方防御和稳定性提高 |
| 机腹 | 增加炸弹舱、装甲或油箱 | 对地能力或生命提高，垂向轮廓增加 |
| 机背 | 增加炮塔、雷达或散热器 | 目标识别、炮塔或散热能力提高 |

### 前后长度和转向

前后加件改变机体的惯性分布。

```text
length = baseLength + noseExtension + tailExtension
inertiaZ = baseInertiaZ + noseWeight * noseOffset^2 + tailWeight * tailOffset^2
turnRate = baseTurnRate * turnResponseFromInertia(inertiaZ)
```

机头加重时，飞机需要更长时间减小航向误差。机尾加重时，飞机保持直线更稳定，但转向恢复更慢。首版保持这些变化明显但可控，单个升级不让飞机失去可玩性。

### 左右不对称

左右部件使用同一套部件数据，但挂点不同。

```text
leftMass = sum(part.weight for part where part.localPosition.x < 0)
rightMass = sum(part.weight for part where part.localPosition.x > 0)
lateralBias = (rightMass - leftMass) / totalMass
leftTurnRate = baseTurnRate * (1 + lateralBias * 0.12)
rightTurnRate = baseTurnRate * (1 - lateralBias * 0.12)
```

如果右侧增加发动机，右侧质量上升，左转略灵活，右转略迟钝。这个差异需要通过滚转动画、尾迹偏移和轻微摇杆回馈表达，但不能让玩家无法理解。

## 命中分区

每个部件拥有一个或多个低成本碰撞体。首版使用球体、胶囊和盒体，不使用三角形精确碰撞。

| 分区 | 默认占比 | 受损结果 |
| --- | ---: | --- |
| 机身核心 | 45% | 生命归零时坠毁 |
| 左翼 | 15% | 左侧武器或发动机失效，左转性能变化 |
| 右翼 | 15% | 右侧武器或发动机失效，右转性能变化 |
| 机头 | 10% | 前向武器、雷达或锁定能力受损 |
| 机尾 | 10% | 速度保持和转向恢复下降 |
| 机背或机腹 | 5% | 炮塔、炸弹舱或装甲失效 |

部件命中先扣部件生命值，再按 `damageTransfer` 把一部分伤害传给机身核心。大型部件碰撞体随几何体外扩，翼展越大，侧面被命中的概率越高。

## 部件生命和状态

```ts
type PartDamageState = 'intact' | 'damaged' | 'critical' | 'disabled' | 'destroyed'

type RuntimePartDamage = {
  partId: string
  health: number
  state: PartDamageState
  isFunctional: boolean
  smokeLevel: number
  fireLevel: number
  debrisSeed: number
}
```

状态阈值建议如下。

- `intact`，生命高于 70%，只有命中闪光
- `damaged`，生命在 40% 到 70%，出现划痕、火花和轻烟
- `critical`，生命在 1% 到 40%，出现黑烟、火焰和性能下降
- `disabled`，生命为 0，部件停止工作，保留在机体上
- `destroyed`，部件被炸断或脱落，碰撞体和武器挂点移除

不是所有部件都会脱落。发动机和炮塔默认进入 `disabled`，机翼尖端、天线、外挂炸弹和炮管可以在高爆或穿透伤害下进入 `destroyed`。

## 代表性损坏表现

### 发动机

- `damaged`，尾焰颜色变暗，间歇性火花
- `critical`，喷口拉出黑烟，火焰从尾部跳出
- `disabled`，失去对应推进力，局部尾焰停止
- `destroyed`，发动机外壳脱落，产生短时碎片和火焰

发动机损坏按发动机所在侧减少加速度和极速。左右发动机数量不同会直接形成动力偏置。

### 武器

- 炮管受损时出现卡顿、火花和射击散布增加
- 炮塔受损时旋转速度降低，`disabled` 后停止追踪
- 锁定设备受损时锁定时间增加，扇形 UI 变为不稳定的橙色
- 炸弹舱受损时轰炸冷却增加或暂时无法投弹

### 机翼

- 机翼受损时外缘出现裂纹和黑烟
- 机翼断裂时碰撞宽度减少，但升力表现对应地变得不稳定
- 在控制模型中，机翼损坏通过转向率、速度保持和风场响应体现
- 机翼损坏不直接让飞机翻转，避免操作失去可读性

## 损坏对操控的影响

```text
effectiveMaxSpeed = baseMaxSpeed * engineFactor * tailFactor
effectiveAcceleration = baseAcceleration * engineFactor * fuelFactor
effectiveTurnRate = baseTurnRate * wingFactor * inertiaFactor
effectiveEnergyMax = baseEnergyMax * fuelTankFactor
effectiveWeaponOutput = baseWeaponOutput * weaponPartFactor
```

损坏影响要分级加入，避免一次命中就让玩家无法控制。每种影响都有可见表现。

| 影响 | 视觉提示 | 触觉或声音提示 |
| --- | --- | --- |
| 极速下降 | 尾焰缩短、速度线变少 | 发动机断续声 |
| 加速度下降 | 加速尾焰变暗 | 推力音降低 |
| 转向变慢 | 机身滚转幅度变小 | 操作音变沉 |
| 武器失效 | 炮管不再发光、炮塔停止 | 卡壳声或警告音 |
| 锁定变慢 | 扇形收窄过程更慢 | 锁定音断续 |
| 炸弹舱失效 | 投弹门关闭 | 投弹按钮显示维修状态 |

## 维修和死亡

首版不提供战斗中自动完全修复。部分精英敌人或稀有升级可以提供一次性修复包。

- 修复包恢复部件固定百分比生命
- 修复不会重建已脱落部件，除非升级明确包含重装
- 机身核心归零立即进入坠毁状态
- 坠毁播放 1.2 秒的下坠、火焰和碎片动画
- 结算使用坠毁前的最终构型和损坏状态生成展示模型

## 验收标准

- 机体由简单几何体拼装，可以在运行时增加和移除部件。
- 左右、前后不同位置的升级能改变飞机尺寸和操控参数。
- 发动机被击中后有黑烟和喷火，且对应推进力下降。
- 武器、机翼、机头和机尾可以独立损坏。
- 大翼展机体被侧面命中的概率和视觉迎弹面明显增加。
- 损坏反馈可通过画面和声音判断，不需要查看数值面板。
