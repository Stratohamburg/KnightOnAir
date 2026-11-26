# 初版机体设计

## 机体设计原则

第一批机体使用同一套参数化几何体和损坏接口，通过长度、翼展、截面、挂点和部件状态区分。每架机体都有明确的优势和空间代价。机体越大，机翼和机身越容易被弹道击中，玩家需要用路线和升级补足缺点。

## 统一参数

| 参数 | 说明 |
| --- | --- |
| `maxSpeed` | 满能量和满油门时的极速 |
| `acceleration` | 油门输入到速度变化的速度 |
| `turnRate` | 理想状态下的最大转向率 |
| `energyMax` | 能量上限 |
| `energyRecover` | 松油门时的每秒恢复 |
| `health` | 机身核心生命 |
| `length` | 机头到机尾的本地长度 |
| `wingspan` | 左翼尖到右翼尖的本地宽度 |
| `footprint` | 用于命中和导演系统的可见面积估计 |
| `hardpoints` | 可安装部件和武器的挂点数量 |

## 机体一，Swift-01 轻型截击机

### 定位

默认起始机体。机身短、翼展窄、转向快，适合学习提前量、锁定和轰炸准心。

### 基础参数

| 参数 | 数值 |
| --- | ---: |
| `maxSpeed` | 13.5 |
| `cruiseSpeed` | 5.0 |
| `acceleration` | 9.5 |
| `turnRate` | 285°/秒 |
| `energyMax` | 85 |
| `energyDrain` | 15/秒 |
| `energyRecover` | 17/秒 |
| `health` | 100 |
| `length` | 4.8 |
| `wingspan` | 6.2 |
| `footprint` | 0.75 |
| `hardpoints` | 6 |

### 几何构型

- 机身由 5 个截面棱柱组成
- 机头为低面数椭圆锥
- 两侧机翼为短三角翼，翼尖向后收
- 尾翼为双垂尾和一片水平尾翼
- 发动机位于机身后下方，使用小型圆柱和喷口环
- 默认机炮挂点位于机头两侧

### 默认武器

- 双联机炮 `nose_cannon_pair`
- 小型锁定导弹挂点各一

### 损坏特征

- 发动机失效后极速明显下降，但转向仍可保持
- 机翼受损时转向率下降 12%
- 机头损坏时锁定时间增加 0.25 秒

### 适合的升级

- 轻型翼尖
- 左右小型发动机
- 机头雷达罩
- 小型炮塔
- 稳定型炸弹舱

## 机体二，Courier-02 平衡攻击机

### 定位

中型多用途机体，用于展示定向武器、炮台和轰炸模式的完整组合。它的初始空间足以支持对称和非对称构筑。

### 基础参数

| 参数 | 数值 |
| --- | ---: |
| `maxSpeed` | 10.5 |
| `cruiseSpeed` | 4.2 |
| `acceleration` | 7.5 |
| `turnRate` | 225°/秒 |
| `energyMax` | 110 |
| `energyDrain` | 16/秒 |
| `energyRecover` | 13/秒 |
| `health` | 145 |
| `length` | 6.4 |
| `wingspan` | 8.6 |
| `footprint` | 1.0 |
| `hardpoints` | 10 |

### 几何构型

- 机身由 7 个截面组成，中段有明显的设备舱
- 中等后掠翼，翼根连接左右发动机短舱
- 机背有炮塔基座挂点
- 机腹有炸弹舱和地面目标瞄准设备
- 尾部为宽水平尾翼和单垂尾

### 默认武器

- 双翼机枪 `wing_machinegun_pair`
- 机腹炸弹舱 `gravity_bomb`
- 机背炮塔挂点为空，可通过升级安装

### 损坏特征

- 任意发动机受损都会减少加速度 15%
- 双侧发动机状态不同会产生动力偏置
- 炸弹舱受损后轰炸冷却增加 1 秒
- 机背炮塔被击毁后只影响炮塔，不影响机身核心

### 适合的升级

- 双侧动力
- 机背自动炮塔
- 机腹重型炸弹
- 机头锁定雷达
- 巨型翼和装甲

## 机体三，Mastodon-03 重型武装机

### 定位

巨无霸路线的基础机体。翼展大、挂点多、生命和火力强，但需要提前转向和规划路线。

### 基础参数

| 参数 | 数值 |
| --- | ---: |
| `maxSpeed` | 8.2 |
| `cruiseSpeed` | 3.6 |
| `acceleration` | 4.8 |
| `turnRate` | 145°/秒 |
| `energyMax` | 135 |
| `energyDrain` | 21/秒 |
| `energyRecover` | 9/秒 |
| `health` | 230 |
| `length` | 8.8 |
| `wingspan` | 13.4 |
| `footprint` | 1.45 |
| `hardpoints` | 16 |

### 几何构型

- 厚重机身由 9 个截面组成
- 两侧主翼使用宽梯形翼，翼尖有外挂梁
- 四个发动机短舱分布在主翼前缘
- 机背和机腹各有炮塔基座
- 尾部有宽尾翼和双垂尾
- 机腹保留大型炸弹舱

### 默认武器

- 四联重机枪 `heavy_machinegun_quad`
- 机背小型炮塔 `top_turret`
- 机腹重型炸弹 `heavy_bomb`

### 损坏特征

- 发动机逐个受损，速度和加速度分阶段下降
- 任一主翼受损后，对应侧转向率下降 18%
- 炮塔被摧毁后，机背会留下冒烟的空挂点
- 机身核心生命高，但翼展会让侧面迎弹十分明显

### 适合的升级

- 额外装甲
- 翼端炮塔
- 双侧发动机
- 机尾防御炮
- 爆炸弹药和穿透弹

## 机体四，Wasp-04 轻量侦击机

### 定位

解锁后提供极端轻型流派。它的机身比 Swift 更窄，依赖速度、锁定和小碰撞体生存。

### 基础参数

| 参数 | 数值 |
| --- | ---: |
| `maxSpeed` | 15.5 |
| `cruiseSpeed` | 5.8 |
| `acceleration` | 11.5 |
| `turnRate` | 305°/秒 |
| `energyMax` | 75 |
| `energyDrain` | 14/秒 |
| `energyRecover` | 20/秒 |
| `health` | 75 |
| `length` | 4.1 |
| `wingspan` | 4.9 |
| `footprint` | 0.58 |
| `hardpoints` | 5 |

### 几何构型

- 极短机身和尖锐机头
- 翼展短，翼尖略向上折
- 单发动机位于机身尾部
- 机背有狭窄雷达舱
- 机腹只能安装小型炸弹或轻量炸弹舱

### 默认武器

- 轻型机炮 `light_cannon`
- 快速锁定雷达 `quick_lock_radar`

### 损坏特征

- 发动机受损会明显降低加速度，但能量恢复仍保持
- 机翼受损时碰撞体缩小，转向率也会下降
- 机头雷达受损后锁定速度下降 30%

### 适合的升级

- 轻型翼尖
- 高转速炮塔
- 快速锁定雷达
- 小型火箭巢
- 低阻力尾翼

## 机体数据示例

```ts
const swift01: AirframeConfig = {
  id: 'swift_01',
  name: 'Swift-01',
  baseGeometry: 'light_interceptor',
  stats: {
    maxSpeed: 13.5,
    acceleration: 9.5,
    turnRate: 285,
    energyMax: 85,
    health: 100,
  },
  parts: [
    { id: 'fuselage_core', socket: 'center', healthMax: 100 },
    { id: 'left_wing', socket: 'leftWing', healthMax: 24 },
    { id: 'right_wing', socket: 'rightWing', healthMax: 24 },
    { id: 'main_engine', socket: 'tail', healthMax: 30 },
    { id: 'nose_weapon_mount', socket: 'nose', healthMax: 18 },
  ],
}
```

## 机体选择目标

- Swift-01 让玩家快速理解摇杆、提前量和轻型机动。
- Courier-02 让玩家理解多武器、轰炸和左右部件。
- Mastodon-03 让玩家理解迎弹面、损坏管理和巨型火力。
- Wasp-04 让玩家理解轻量化、小碰撞体和高风险高速路线。
