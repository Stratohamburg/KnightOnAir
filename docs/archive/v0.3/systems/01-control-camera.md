# 控制、相机和单手布局

> 本文记录 0.3.0 阶段的初版设计。当前实现见下列入口。[固定步进飞行规格](../../../../openspec/specs/battle/session-lifecycle/spec.md) · [当前运行时架构](../../../ARCHITECTURE.md#当前运行时架构)

## 设计目标

玩家使用右手拇指完成一局中的主要操作。操作重点是改变目标朝向、控制加速、切换轰炸模式、点击轰炸和触发升级。屏幕上不需要双摇杆，也不要求玩家进行手指拖拽瞄准。

控制反馈要让玩家在不看说明的情况下理解三件事。

- 摇杆方向代表飞机想要前往的方向。
- 摇杆距离代表加速意图。
- 飞机需要一小段时间转向，转向能力由机体和部件决定。

## 竖屏单手布局

游戏区占屏幕上方约三分之二，控制区占下方约三分之一。控制区使用半透明深色面板，不遮住游戏区的主要威胁和玩家飞机。

| 控件 | 位置 | 触控策略 |
| --- | --- | --- |
| 主摇杆 | 控制区左右中心，中心线与屏幕中心重合 | 右手拇指持续拖动 |
| 升级按钮 | 控制区上沿，略偏左但接近屏幕中央 | 松开摇杆后点击 |
| 轰炸模式开关 | 控制区右上方 | 单击切换，保持状态 |
| 轰炸按钮 | 控制区右下方 | 准心稳定后点击 |
| 能量条 | 摇杆上方或摇杆外圈 | 通过颜色和长度读取 |

摇杆直径建议为屏幕短边的 20% 到 24%，最小触控直径为 112 CSS 像素。摇杆底盘的可见半径和触控半径分离，避免玩家必须精确点在图形上。

### 单手移动路径

右手拇指在三个动作之间形成短路径。

1. 拖动中央摇杆移动和加速。
2. 向上移动少量距离点击升级按钮或模式开关。
3. 向右下移动点击轰炸按钮后回到摇杆。

按钮之间保留至少 14 CSS 像素的可见间隔，点击区域可以扩大到 44 CSS 像素，但不能互相重叠。

## 摇杆输入

摇杆输出两个独立量。

```ts
type StickIntent = {
  direction: Vector2
  magnitude: number
  hasInput: boolean
}
```

`direction` 是归一化平面方向，`magnitude` 是 0 到 1 的加速意图。触控输入先经过圆形限制、死区和指数曲线。

```text
raw = touchPosition - stickCenter
clamped = clampToCircle(raw, stickRadius)
normalized = clamped / stickRadius
deadZone = 0.12
direction = normalizeOrLastDirection(normalized)
magnitude = remap(length(normalized), deadZone, 1.0)
magnitude = pow(magnitude, 0.85)
```

玩家松开摇杆后，`hasInput` 变为 false，飞机保持当前航向，进入滑行和风场修正。飞机不会因为松手立即转向屏幕上方。

## 飞机运动

游戏使用平面运动，飞机模型仍然是完整 3D 物体。飞机的前向方向投影到 XZ 平面。

```text
targetHeading = angle(stickIntent.direction)
headingError = shortestAngle(targetHeading, aircraft.heading)
turnLimit = aircraft.turnRate * deltaTime
aircraft.heading += clamp(headingError, -turnLimit, turnLimit)

throttle = stickIntent.hasInput ? stickIntent.magnitude : 0
energyCost = throttle * aircraft.energyDrain * deltaTime

if throttle > 0 and aircraft.energy > 0:
    aircraft.energy -= energyCost
    aircraft.speed += aircraft.acceleration * throttle * deltaTime
else:
    aircraft.energy += aircraft.energyRecover * deltaTime
    aircraft.speed -= aircraft.drag * deltaTime

aircraft.speed = clamp(aircraft.speed, aircraft.cruiseSpeed, aircraft.maxSpeed)
aircraft.velocity = forward(aircraft.heading) * aircraft.speed + windAt(aircraft.position)
aircraft.position += aircraft.velocity * deltaTime
```

转向时减少一部分前向速度，并把减少的速度按机体阻力恢复。大型机体的转向半径更大，玩家可以通过提前输入来保持路线。

### 手感参数

| 参数 | 说明 | 操作表现 |
| --- | --- | --- |
| `turnRate` | 最大航向角速度 | 决定飞机追上摇杆方向的速度 |
| `turnAcceleration` | 转向速度达到上限的快慢 | 决定转向是否有重量感 |
| `turnDrag` | 转向时速度损失 | 让大飞机转向有代价 |
| `cruiseSpeed` | 松杆后的最低巡航速度 | 避免飞机在战斗中完全停住 |
| `energyDrain` | 满油门耗能 | 控制连续加速时长 |
| `energyRecover` | 松油门恢复速度 | 控制重新加速节奏 |
| `windResponse` | 风对飞机速度的影响比例 | 控制风场存在感 |

## 透视相机

使用 `THREE.PerspectiveCamera`。相机固定在玩家后上方，跟随玩家位置和速度方向产生轻微偏移，保持飞机和前方战场可见。

推荐初始参数如下。

```ts
camera.fov = 48
camera.near = 0.1
camera.far = 140
cameraPitch = 62 * DEG_TO_RAD
cameraDistance = 24
cameraHeight = 18
lookAheadDistance = 8
```

相机目标点为玩家位置加上速度方向的前视偏移。相机位置和目标点使用指数阻尼，避免飞机转向时画面产生硬切。

```text
lookTarget = player.position + forward(player.heading) * lookAheadDistance
desiredCamera = player.position - forward(player.heading) * cameraDistance
desiredCamera.y = cameraHeight
camera.position = damp(camera.position, desiredCamera, followSharpness, deltaTime)
camera.lookAt(damp(cameraTarget, lookTarget, targetSharpness, deltaTime))
```

相机视角固定，玩家只能看到有限范围的前方和侧前方。敌人进入屏幕边缘前通过边缘预警提示，避免透视缩放导致目标突然出现。

### 屏幕空间和世界空间

- 游戏区的中心是玩家视觉锚点，不代表玩家永远位于世界原点。
- 远处物体随透视缩小，近处弹道和飞机部件产生尺度变化。
- UI 位置使用屏幕坐标，准心落点使用世界坐标投影到屏幕坐标。
- 触控区不随着相机移动，不参与世界遮挡。

## 轰炸模式输入

轰炸模式不改变玩家飞机的基础物理，而是把摇杆输出乘以更柔和的灵敏度曲线。

```text
bombingDirection = normalize(stickIntent.direction)
bombingMagnitude = pow(stickIntent.magnitude, 1.6)
crosshairVelocity = bombingDirection * bombingMagnitude * crosshairSpeed
```

准心稳定度由准心速度、风场扰动、玩家受到的冲击和微调持续时间共同决定。准心半径从橙色大圈逐步收缩到绿色小圈，只有绿色状态可以投弹。

## 输入优先级

1. 升级选择界面打开时，所有世界控制输入屏蔽。
2. 轰炸按钮、模式开关和升级按钮优先于摇杆区域的拖动。
3. 摇杆触控点锁定到第一次有效触摸，手指离开后才释放。
4. 页面滚动、双击缩放和浏览器长按菜单在游戏画布范围内禁用。
5. 触控丢失时立即结束当前摇杆输入，飞机进入滑行状态。

## 验收标准

- 一只右手可以在 360 CSS 像素宽的设备上完成移动、模式切换和投弹。
- 摇杆在屏幕左右方向居中，左右手指不需要跨越屏幕寻找操作区域。
- 拖动方向能稳定映射到目标航向，飞机不会瞬间改变朝向。
- 透视相机能表现远近尺度变化，飞机和前方战场仍保持清晰。
- 轰炸模式下准心可以小幅调整，停稳后颜色和按钮状态明确变化。
- 升级界面打开后飞机、敌人、弹道和风场全部暂停。
