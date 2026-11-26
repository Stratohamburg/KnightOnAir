# 09 · 投弹包线与真实气动转弯

> 状态：提案（**未实施**，只描述改动，不改源码/测试/基线文档）
> 基线：0.3.0（`5b22187`）；行号仅作快速索引，实施以符号名为准。
> 触发需求（用户补充）：
> 1. 投弹模式除限制最大速度外，限制最大滚转角，且要**按机型区分**、**随损伤动态收紧**——“本来迟缓的飞机要更迟缓，受损的飞机也要更迟缓”。
> 2. **投弹目标必须在飞机朝向的前方**。
> 3. 滚转角与转向率/转弯半径之间要建立关系：大飞机与小飞机在同样滚转角度下转弯半径不同，**依托真实空气动力学算法**确定。
> 依赖：[03 部件与损毁](03-parts-and-damage-degradation.md)（`ControlDamage`、`flightEnvelope`、`updateFlightTurn` 的 `bankLimit` 接口）、[04 双区油门与加力](04-throttle-zones-and-boost.md)（投弹油门/能量/HUD）、[08 Q 版与时代线](08-q-art-and-era-progression.md)（全机型数据）。
> 本文是投弹模式滚转/目标的新增主文档；00-overview 的 D12 为共享决策，03/04 只保留接口与引用。轰炸镜头（FOV/俯角/过渡）由 [10 高度分层与轰炸镜头](10-altitude-layers-and-bombing-camera.md) 定义，本文只消费其投影结果。

## 0. 与 00-overview 的一致性

本文件落实 D12（新增共享决策）：

- **投弹模式不是“另一套物理”**：飞机仍用 03 的同一套气动/损伤包线，只是在投弹时再叠加一层**稳定包线**：油门 ≤45%（04）、滚转上限按机型/损伤收紧、滚转响应变慢、目标限制在机头前向锥内。
- **不引入失速/尾旋/俯仰**：本作竖屏单手、无俯仰输入，D6 也明确不撞地；因此“真实气动”只用于**协调转弯的数学关系**与**可解释的机型差异**，不新增不可恢复状态（见 §8-1）。
- **数值全部基线可调**：机型基准值由现有 `flightEnvelope.response`（质量/翼展/推力/惯性）推导，避免为 17 架机体逐一手填；同时保留一个可选手调字段（`Airframe.bombingBankLimitDeg?`）。

## 1. 问题与现状

### 1.1 投弹模式现状：只有油门限制，没有姿态限制

- `World.updatePlayer` 在 `isBombing` 时把转向指令乘 `0.65`（`World.ts:404-409`），把油门压到 45%（`World.ts:419-421`）；但**没有限制滚转角**，玩家仍可把飞机压到接近 87.5° 的滚转极限，只是转向慢一点。
- 上一轮 04/03 的补充口径是**全局 ±30°**（已被本文取代）。这不满足本次要求：Mastodon 与 Wasp 用同一个 30° 既表达不出“重型机本来迟缓”，也无法在掉翼/掉尾翼后进一步收紧。
- `FlightEnvelope` 的 `maxBank`（`FlightDynamics.ts:8-40`）已经和翼载、质量、推力有关，但轰炸模式没有把“当前的坡度上限”与“机型/损伤”联动；`World.updateBombing` 的稳定度模型（`World.ts:1305-1331`）只判断输入幅度，不知道当前姿态是否“适合投弹”。

### 1.2 投弹目标现状：落点可以偏到机身侧方，甚至横向到接近 45°

`World.updateBombing`（`World.ts:1305-1320`）计算：

```ts
this.aim.x = damp(this.aim.x, p.x + Math.sin(p.heading) * lead + this.aimOffset.x, 4, dt);
this.aim.z = damp(this.aim.z, p.z + Math.cos(p.heading) * lead + this.aimOffset.z, 4, dt);
```

- `lead = 2.6 + p.speed * 0.55` 确实沿机头方向，但 `aimOffset` 是**世界坐标**偏移（玩家在轰炸模式下用摇杆累积，`aimOffset.x/z ∈ [-5,5]`），不是机体本地坐标；当机头朝 +Z 时它相当于横向/纵向偏移，当机头朝 +X 时它的语义完全变了。
- 结果：落点可能偏离机头方向很远（`lead` 较小时，5 单位横向偏移相当于 40° 以上），与“投弹目标要在飞机朝向的前方”直接冲突；玩家可以通过横杆把炸弹丢到侧面，规避“机头对准目标”的操作要求。
- 渲染层的轰炸准心（`Renderer.ts:681-685`）、落弹路径（`:721-742`）只是把 `world.aim` 投影到地面，没有前向锥约束，也没有“目标不在机头前方”的提示。

### 1.3 转弯半径现状：公式已经在用，但没有把“机型差异”讲清楚

- `FlightDynamics.updateFlightTurn` 已有协调转弯关系：`turnVelocity = -g·tan(bank)/speed`（`FlightDynamics.ts:56-71`），这其实是真实气动的简化形式；但：
  - 没有把 `n = 1/cos(bank)`（载荷因数）与转弯率/半径显式关联；
  - 没有输出或验收“同坡度下不同机型的转弯半径”；
  - 没有说明“同 bank、同速度时半径与质量无关”这一真实气动结论，容易让人误以为“大飞机同一坡度半径必然更大”。
- 结果：机型差异只能靠 `turnRate` 数值与 maxBank 间接感受，缺少可解释、可测试的气动依据；也无法用同一套公式推导 17 架新机体的转弯性能。

## 2. 目标体验

- **投弹时必须“端平”**：进入轰炸模式后，飞机滚转被限制在一个较小的角度内；重型机上限更小，轻型机稍大；掉翼/掉尾翼后进一步收紧。玩家能明显感到“投弹时不能剧烈机动”。
- **投弹目标永远在机头前方**：准心只沿机头方向前后移动、允许很小的横向微调；把摇杆横推到底，准心也只贴在前向锥的边缘；炸弹不会落到机身侧方或后方。
- **转弯性能可解释**：低速大飞机与高速小飞机在相同滚转角下转弯半径不同——这是由 `R = V²/(g·tanφ)` 决定，而不是拍脑袋写死；重型机不灵活的原因被拆成“最大坡度更小 + 滚转响应更慢 + 投弹包线更窄”三件事。
- **不破坏现有手感**：本文件不引入失速/尾旋；普通飞行沿用 03 的包线；投弹模式是叠加限制，退出后立即恢复。

## 3. 目标设计

### 3.1 真实协调转弯公式（全模式通用）

坐标与单位沿用 03：世界单位约等于 2 m；`FLIGHT_GRAVITY = 9.81/2 = 4.905` 世界单位/s²（`FlightDynamics.ts:5`）。对水平协调转弯（不侧滑）：

```text
载荷因数      n = 1 / cos(φ)                      // φ = |bank|，水平转弯
升力关系      L = n·W                              // 需要 n 倍升力
转弯率        ω = g·sqrt(n² − 1) / V = g·tan(φ) / V
转弯半径      R = V² / (g·sqrt(n² − 1)) = V² / (g·tan(φ))
向心加速度    a_c = g·tan(φ)
```

关键结论（必须写进实现注释与教学）：

1. **同 bank、同 speed 时，R 与质量无关**：R 只由 V 与 φ 决定。真实世界里大飞机在同样坡度和同样空速下，几何半径和小飞机一样；它“转不动”来自更低的最大可用坡度、更慢的滚转进入、更高的失速速度和更大的惯性，而不是“同一坡度下半径自动变大”。
2. **本作的机型差异来自三处**：
   - **速度不同**：R ∝ V²。本作高速轻型机在 30° 坡度下的半径反而大于低速重型机（见 §3.2 表），这是正确的物理结果；重型机真正的劣势在最大坡度和滚转响应。
   - **最大坡度不同**：03 的 `flightEnvelope.maxBank` 由翼载/质量/推力/损伤决定（`FlightDynamics.ts:8-40`）；重型机 maxBank 更小 → 最小转弯半径更大（见 §3.2“自身极限”列）。
   - **滚转响应不同**：`response` 由 `I = m·span²/12` 与推力储备决定（`FlightDynamics.ts:28-40`），重型机进入坡度慢 → 同样的转弯要更长的进入/改出距离。
3. **游戏为可玩性另加 `turnRate` 上限**（`stats.turnRate`，`World.ts:404-409`）：实际稳态转弯率取 `min(ω_aero, turnRateLimit)`，半径取 `max(R_aero, V / turnRateLimit)`；因此在极端坡度和低速下，操控上限可能先于气动极限生效。文档中的“气动半径”是下界，HUD/教学展示用“气动转弯半径”需要注明这一点。

建议新增纯函数（`src/simulation/Aero.ts` 或并入 `FlightDynamics.ts`，无 Three.js 依赖）：

```ts
export function loadFactor(bank: number): number;                  // 1 / cos(bank)
export function aeroTurnRate(speed: number, bank: number): number; // g*tan(bank)/speed
export function aeroTurnRadius(speed: number, bank: number): number; // speed²/(g*tan(bank))
export interface TurnPerformance { bankMax: number; radiusAt30: number; radiusAtLimit: number; response: number; }
export function turnPerformance(p: Player, damage: ControlDamage): TurnPerformance;
```

### 3.2 四架现有机型的转弯性能（基线，按当前数据计算）

公式：`R_30 = V_max² / (g·tan30°)`；`R_limit = V_max² / (g·tan(maxBank))`；`maxBank` 取 03 的 `flightEnvelope`（完好、无改装）；`response` 同 03。单位：世界单位（×2 = 米）。

| 机体 | V_max | maxBank（03 包线） | R @30° 坡度 | R @自身最大坡度 | response（滚转响应） | 定位 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| SWIFT–01 | 13.5 | ≈85.5° | 64.4（128.8 m） | ≈2.9（5.8 m） | 12.0 | 高速轻机：转弯半径大，但坡度权限大、滚转快 |
| COURIER–02 | 10.5 | ≈76.9° | 38.9（77.8 m） | ≈5.2（10.4 m） | 4.9 | 中型：半径居中，响应明显变慢 |
| MASTODON–03 | 8.2 | ≈52.8° | 23.7（47.4 m） | ≈10.4（20.8 m） | 2.5 | 重型：30° 时半径反而最小（速度低），但坡度上限最低、响应最慢、极限半径最大 |
| WASP–04 | 15.5 | ≈87.5° | 84.8（169.6 m） | ≈2.1（4.2 m） | 18.0 | 极轻高速：30° 半径最大，但极限半径最小、响应最快 |

读表方式（也是教学/帮助里的说法）：

- 想比较“同坡度谁转得小”，看 `R @30°`：**速度越低半径越小**（Mastodon 在 30° 时半径最小），但这是因为它飞得慢，不代表灵活。
- 想比较“谁能真正急转”，看 `R @自身最大坡度` + `response`：Wasp/Swift 能压到近 90° 且滚转快；Mastodon 最多约 53°、滚转响应只有 2.5，实际战斗中的转弯进入/改出距离最大。
- 这也解释了为什么“大飞机同坡度半径不一样”：**同坡度时半径由速度决定**；重型机的劣势是“压不到那么大坡度 + 压过去很慢 + 极限半径大”。

> 单位换算：表中半径是游戏世界单位，×2 为设计等效米。`R @自身最大坡度` 是纯气动下界；加上 `turnRate` 操控上限后实际半径会更大，见 §3.1 结论 3。

### 3.3 投弹模式滚转包线（按机型 + 损伤动态收紧）

#### 3.3.1 基准值：从滚转响应推导，不手工逐架填

```ts
// src/data/config.ts
export const BOMBING = {
  throttleLimit: 0.45,          // 沿用 04 的 45% 油门
  rollResponseFactor: 0.75,     // 投弹模式滚转响应整体变慢
  bankBase: 14,                 // 基准坡度下限（度）
  bankPerResponse: 1.15,        // response → 每 1 单位响应的坡度增量
  bankMinDeg: 14,
  bankMaxDeg: 36,
  aimConeDeg: 10,               // 目标前向锥半角
  aimForwardMin: 4,             // 目标最近距离（世界单位）
  aimForwardMax: 14,            // 目标最远距离
  aimForwardMargin: 2,          // 释放时目标必须比机头至少靠前多少
} as const;

// 推导（每帧或部件变化时）
baseDeg = clamp(BOMBING.bankBase + BOMBING.bankPerResponse * response(damage), BOMBING.bankMinDeg, BOMBING.bankMaxDeg);
```

其中 `response(damage)` 取 03 的 `flightEnvelope(p, damage).response`（已包含质量、翼展、惯性、推力、发动机损伤、机翼损伤、尾翼损伤）。由此自动得到：

| 机体（完好） | response | baseDeg（投弹基准坡度上限） |
| --- | ---: | ---: |
| WASP–04 | 18.0 | 34.7° |
| SWIFT–01 | 12.0 | 27.8° |
| COURIER–02 | 4.9 | 19.6° |
| MASTODON–03 | 2.5 | 16.9° |

- **按机型区分**：越迟钝（response 越低）→ baseDeg 越低；满足“本来迟缓的飞机要更迟缓”。08 的利维坦流（持续叠翼/发动机/武器形成的大型多翼多发平台）会显著增加质量与惯量、降低 response，因此投弹坡度会自动进一步收紧，无需专属规则。
- **损伤动态收紧**：response 随损伤下降（03 的 `DamageModel`/`ControlDamage` → `flightEnvelope.response` 路径），baseDeg 自动下降；同时再乘一个只针对升力/尾翼损失的系数，避免“发动机损伤不影响投弹坡度”：

```ts
liftTailFactor = clamp(0.45 + 0.55 * liftAvg * (0.75 + 0.25 * yawStability), 0.35, 1);
effectiveBankLimitDeg = baseDeg * liftTailFactor;
```

  - 完好：1.0；右翼全毁：`liftAvg=0.60` → 0.78；双翼全毁：0.56；尾翼全毁：0.89；翼+尾同时损毁：约 0.71。
  - 与 response 的损伤项叠加后，掉翼的实际投弹坡度会降到原值的约 **50%–78%**，符合“受损飞机更迟缓”。
  - 上限只降不升的约束：升级仍会经 `flightEnvelope.response` 影响基准，但最终被 `min(..., maxBank, 36°)` 夹住，且损伤项只会收紧；投弹模式不能通过升级突破 `bankMaxDeg`。

#### 3.3.2 最终生效值

```ts
effectiveBankLimit = min(
  effectiveBankLimitDeg * RAD,
  flightEnvelope(p, damage).maxBank,     // 损伤后的正常包线；投弹包线不能大于它
  BOMBING.bankMaxDeg * RAD               // 36° 绝对上限
);
rollResponse = flightEnvelope(p, damage).response * BOMBING.rollResponseFactor; // 0.75
```

| 场景 | SWIFT–01 | COURIER–02 | MASTODON–03 | WASP–04 |
| --- | ---: | ---: | ---: | ---: |
| 完好投弹 | 27.8° | 19.6° | 16.9° | 34.7° |
| 右翼全毁 | ≈17.4° | ≈13.5° | ≈13.2° | ≈20.6° |
| 尾翼全毁 | ≈21.8° | ≈16.2° | ≈15.0° | ≈26.5° |
| 右翼+尾翼全毁 | ≈14.5° | ≈12.1° | ≈12.1° | ≈16.7° |

（按 `response = intactResponse × liftAvg × (0.70+0.30×yawStability)`、`bankLimit = (14+1.15×response) × liftTailFactor` 估算；Mastodon 的 response 已触 2.5 下限，损伤后变化较小。最终以 03 的 `flightEnvelope.response` 实现与平衡微调为准。）

**为什么不用“统一 30°”**：统一值表达不出机型差异，也无法随损伤收紧；按 response 推导后，重型机的投弹坡度只有轻机的一半左右，正是“迟缓机更迟缓”。

#### 3.3.3 滚转响应也收紧

- 投弹模式 `rollResponse = env.response × 0.75`：重型机原本 response 只有 2.5，再乘 0.75 → 1.875，压坡度非常慢；轻机 18 ×0.75=13.5 仍较灵活。
- 不额外限制 `rollVelocity` 数值（03 的 `omega` 会随 response 下降）；如果真机仍觉得“瞬间压死”，可把 §8-3 的 `rollRateCapDeg` 作为第二批调整。
- 03 的 `updateFlightTurn(..., bankLimit, bombing)` 在 `bombing=true` 时使用 09 计算的 `bankLimit`，并在内部按 `bombing` 把滚转响应乘 `BOMBING.rollResponseFactor`（0.75）；03 负责 clamp 与贴限保护，不重复定义数值。04 负责把 45% 油门、HUD 与 `toggleBombing()` 状态接好。

### 3.4 投弹目标必须在机头前方

#### 3.4.1 坐标系与约束

目标点在世界 XZ 中表示为机体本地坐标：

```ts
forward = { x: sin(heading), z: cos(heading) };    // 机头方向
right   = { x: cos(heading), z: -sin(heading) };   // 机体右向（本地 +X）

// 瞄准输入累积在“本地前向距离 + 本地横向偏移”上
forwardDist = clamp(baseLead + aimForwardOffset, BOMBING.aimForwardMin, BOMBING.aimForwardMax);
lateralMax  = tan(BOMBING.aimConeDeg * RAD) * forwardDist;   // ±10° 前向锥
lateral     = clamp(aimLateralOffset, -lateralMax, +lateralMax);

aim = {
  x: p.x + forward.x * forwardDist + right.x * lateral,
  z: p.z + forward.z * forwardDist + right.z * lateral,
};
```

- `baseLead` 沿用现有 `2.6 + speed*0.55`，但只作为**沿机头方向**的前向距离基准。
- 玩家的轰炸微调输入被投影到本地坐标：横向输入只改 `lateral`、前后输入只改 `forwardDist`；设 `intent = (input.x, input.z)`（世界方向），则本地横向分量 `localLat = intent.x*cos(heading) − intent.z*sin(heading)`，本地纵向分量 `localFwd = intent.x*sin(heading) + intent.z*cos(heading)`。越界时准心贴在锥边界并显示“目标须在机头前方”。
- **释放条件**：`forwardDist ≥ aimForwardMin` 且 `|lateral| ≤ tan(aimConeDeg)·forwardDist` 且 `dot(aim − p, forward) ≥ aimForwardMargin`；不满足时 `dropBomb()` 返回 false，提示“目标不在机头前方”。
- 目标点每帧随 `heading` 旋转，但一旦投弹，落点 `Bomb` 保持投弹瞬间的世界坐标（沿用现有“不可变落点”逻辑，`World.ts:1350-1366`）。

#### 3.4.2 横向微调的边界与手感

- 锥半角基线 **±10°**（`aimConeDeg: 10`）：`forwardDist=6` 时横向最大约 1.06 单位；`forwardDist=12` 时约 2.12。既允许小幅修正，又保证目标始终“在机头前方”。
- 若希望更严格，可调成 **±6°** 或 **0°（纯正前方）**；0° 时横向输入完全无效，投弹只由机头对准目标，见 §8-4。
- 视觉：准心中心加一条“机头方向”短引导线；准心被锥边界钳住时短暂变红；HUD 显示 `目标 · 机头前方`（释放条件满足）/`目标不在前方`。
- 摇晃/风偏：现有 `aim` 阻尼保留，但约束在投影后执行，避免风把目标吹出锥外（风只影响准心稳定度，不改变“前向”约束）。

#### 3.4.3 轰炸镜头（引用 10 §3.4）

- 进入 `isBombing` 后，相机在 0.35s 内平滑过渡到长焦镜头：FOV 48°→34°、pitch 64°→74°、distance 46→50、lookTarget 向 `aim` 偏移 0.55；退出恢复巡航参数。**数值与实现以 10 §3.4 为权威**，本文不重复定义。
- 前向锥、准心、落点提示、锁定环都按当前 FOV/pitch 投影；镜头过渡期间目标仍在锥内，投弹稳定度不因镜头切换重置。
- 高空（玩家净空 +20，10 §3.1）下，长焦镜头把地面目标放大 ≈1.41×，这是“缩小 POV 看清地面物体”的落点。

#### 3.4.4 与已有投弹流程的关系

| 现有逻辑 | 处理 |
| --- | --- |
| `aimOffset.x/z` 世界偏移（`World.ts:1305-1320`） | 改为本地 `aimForwardOffset/aimLateralOffset`，约束后才转世界坐标 |
| `lead = 2.6 + speed*0.55`（`World.ts:1307`） | 保留，作为 `forwardDist` 基准 |
| 稳定度 `stability` 与 `bombThreshold`（`World.ts:1318-1328`、`config.ts:14`） | 保留；锥内目标 + 稳定度达标才允许投弹 |
| 落点不可变（`World.ts:1350-1366`） | 保留；投弹瞬间快照 `aim` |
| 准心、落弹路径（`Renderer.ts:681-742`） | 保留渲染方式，只是 `aim` 现在总是在机头前方锥内 |
| 投弹后冷却/弹种 | 不变（04/01 不涉及） |

### 3.5 与 03 / 04 的接口

| 模块 | 职责 |
| --- | --- |
| 09（本文） | 定义投弹包线公式/数值、前向目标约束、HUD 文案与测试 |
| 03 | `flightEnvelope` 提供 `maxBank/response`；`updateFlightTurn(..., bankLimit, bombing)` 负责把 `bankLimit` clamp 到 targetBank 与最终 bank、贴限清除外向 rollVelocity；不定义 09 的数值 |
| 04 | 投弹油门 45%、能量不扣、外圈关闭；HUD 的 `滚转 ≤X°` 从 09 的 `effectiveBankLimit` 动态读取；`toggleBombing` 进/出时恢复包线与响应 |
| 08 | 新机体只需提供 `mass/span/thrust/...`，投弹包线自动由 `flightEnvelope.response` 推导；可选 `Airframe.bombingBankLimitDeg` 用于手调，不改结构 |
| 05 | 准心/HUD 文案由本文提供；05 的锁定/雷达逻辑不受影响 |

`World.updateBombing` 的调用顺序建议：

```ts
// 1. 姿态：先算投弹包线，再进飞行
const damage = refreshDamage(p);
const bombingLimit = bombingBankLimit(p, damage);           // 09 §3.3
// 2. 飞行：updateFlightTurn(..., bombingLimit, this.isBombing)
// 3. 目标：限制在机头前向锥（09 §3.4），再更新 stability/aim
// 4. 释放：dropBomb() 校验 forwardDist/lateral/margin
```

### 3.6 数值基线表（全部可调）

| 参数 | 基线 | 说明 |
| --- | ---: | --- |
| 投弹油门上限 | 45% | 沿用 04 |
| 投弹滚转基准公式 | `14 + 1.15×response` | response 来自 03，完好四机 34.7/27.8/19.6/16.9° |
| 投弹滚转绝对范围 | 14–36° | 防止极轻机过大、极重机过小 |
| 升降/尾翼/升力收紧系数 | `0.45 + 0.55×liftAvg×(0.75+0.25×yawStability)` | 完好 1.0；右翼 0.78；双翼 0.56；尾翼 0.89 |
| 投弹滚转响应系数 | ×0.75 | 重型机更明显 |
| 目标前向锥半角 | ±10° | 10° 基线，可调 6–12°；0° 为纯正前方 |
| 目标前向距离 | 4–14 单位 | 复用现有 lead 基准，限制最近/最远 |
| 释放前向余量 | ≥2 单位 | 防止在机头正下方释放 |
| 稳定度阈值 | 0.82 | 沿用（`RULES.bombThreshold`） |
| 气动 g（世界单位） | 4.905 | 沿用 `FLIGHT_GRAVITY` |
| 转弯半径公式 | `R=V²/(g·tanφ)` | 全模式通用，展示/验收用 |

## 4. 改动清单（文件级）

**新增**

| 文件 | 内容 |
| --- | --- |
| `src/simulation/BombingEnvelope.ts` | `bombingBankLimit(p, damage)`、`bombingRollResponse(p, damage)`、`clampAimToForwardCone(...)`、`isBombReleaseLegal(...)`，纯函数、无 Three.js 依赖 |
| `src/simulation/Aero.ts`（或并入 `FlightDynamics.ts`） | `loadFactor / aeroTurnRate / aeroTurnRadius / turnPerformance`，供测试和 HUD/教学使用 |
| `tests/bombing-envelope.test.ts` | 包线、损伤收紧、前向锥、释放条件、半径公式的确定性测试 |

**修改**

| 文件 | 改动 |
| --- | --- |
| `src/data/config.ts` | 新增 `BOMBING` 常量（§3.3/§3.6）；`RULES.bombThreshold` 不变 |
| `src/data/aircrafts.ts` | 可选 `bombingBankLimitDeg?: number` 手调字段；不填则用 §3.3 公式；其余机型数据不动 |
| `src/simulation/World.ts` | `updatePlayer` 每步求 `bombingBankLimit` 传给 `updateFlightTurn`；`updateBombing` 改为本地前向锥目标与释放校验；`dropBomb` 增加前方条件；`toggleBombing` 恢复响应/包线；HUD 读取用的 getter |
| `src/simulation/FlightDynamics.ts` | 只实现 03 的 `bankLimit` 参数（动态值），不改公式；`bombing=true` 时 `turnLimit×0.65` 保留 |
| `src/app/GameApp.ts` | 轰炸 HUD 的 `滚转 ≤X°` 动态显示；准心被钳时提示“目标须在机头前方”；帮助页更新 |
| `src/rendering/Renderer.ts` | 准心/落弹路径随新 `aim` 变化；可选画“机头方向引导线”与锥边界提示；准心投影使用 10 的当前镜头 FOV/pitch，不改渲染结构 |
| `tests/simulation.test.ts`、`tests/flight-dynamics.test.ts` | 见 §7 |

不改：存档、武器/导弹/锁定、敌人 AI、地形/云、加力能量模型（04）、08 的机体数据生成规则（只加可选字段）。

## 5. 实现任务拆分

| # | 任务 | 写作用域 | 依赖 | 完成标志 |
| --- | --- | --- | --- | --- |
| T1 | 气动纯函数 + 单测：载荷因数/转弯率/半径/四机基线 | `src/simulation/Aero.ts`、`tests/aero.test.ts` | — | §3.1/§3.2 的表与断言一致 |
| T2 | 投弹包线：`bombingBankLimit`、response 损伤收紧、HUD 数值来源 | `src/simulation/BombingEnvelope.ts`、`tests/bombing-envelope.test.ts` | T1 | 完好/掉翼/掉尾/掉双翼的坡度单调收紧 |
| T3 | 前向目标：本地坐标、锥约束、释放校验、HUD 提示 | `src/simulation/World.ts`、`GameApp.ts` | T2 | A5–A8 通过；准心永不出锥 |
| T4 | 飞行接入：World 传动态 `bankLimit`，03 的 clamp 生效 | `World.ts`、`FlightDynamics.ts` | T2、03 | A1–A4 通过；退出投弹恢复 |
| T5 | 表现与帮助：准心引导线/边界提示、帮助文案、轰炸镜头投影（10 §3.4）、真机 | `Renderer.ts`、`style.css`、`GameApp.ts` | T3、10 | 真机清单通过；A11 通过 |
| T6 | 平衡与全机型数据：4 架现有 + 08 的 17 架 roster 的 response 推导 | 数据/测试 | T1–T5 | 新机型无需逐架手填投弹坡度 |

## 6. 验收标准

### 6.1 自动化（固定种子）

- **A1 投弹坡度按机型**：完好状态满侧向输入 3s，稳态 `|bank| ≤ effectiveBankLimit + 1°`；大小顺序满足 `Wasp > Swift > Courier > Mastodon`（差值 >3°）。
- **A2 损伤动态收紧**：右翼全毁、尾翼全毁、右翼+尾翼全毁后，`effectiveBankLimit` 相对完好分别下降约 20% / 10% / 30%，且严格单调不升；与 03 的 `liftAvg/yawStability` 对应。
- **A3 与 03 接口**：`updateFlightTurn(..., bankLimit=effective, bombing=true)` 的 `|bank|` 不超过 `min(envelope.maxBank, effective)`；`bankLimit=Infinity、bombing=false` 时与 0.3.0 基线完全一致。
- **A4 退出恢复**：`toggleBombing()` 退出后 2s 内可压回 >55°（完好机），不残留投弹响应系数/坡度上限。
- **A5 前向目标**：任意随机输入 10s，目标点始终满足 `forwardDist∈[4,14]` 且 `|lateral| ≤ tan(10°)*forwardDist`；`dot(aim−p, forward) ≥ 2`。
- **A6 释放条件**：构造目标在侧方/后方/过近的边界，`dropBomb()` 返回 false 并给出提示；合法时保持现有“不可变落点/冷却/稳定度”断言。
- **A7 与现有投弹测试兼容**：`tests/simulation.test.ts:143-162` 的稳定度、落点不可变、冷却改用新 `aim` 后仍通过（断言可改为从 `world.aim` 读取）。
- **A8 HUD**：`#flight-mode` 在轰炸模式包含动态 `滚转 ≤X°`；准心被钳时出现提示；数值随损伤变化。
- **A9 气动公式**：`aeroTurnRadius(V,φ)` 对四组样例与 §3.2 表一致（误差 <1%）；`n=1/cosφ`、`ω=g·tanφ/V`、`R=V²/(g·tanφ)` 三者互相一致。
- **A10 确定性**：同种子 30/60/120 FPS 下投弹包线与目标轨迹一致；无 NaN/越界。
- **A11 投弹镜头**：进入轰炸 0.35s 后 `fov≈34°`、`pitch≈74°`；同一目标屏幕尺寸约为巡航的 1.35–1.45×；准心/落点投影误差 <1px；退出恢复（详见 10 §6.1 A5/A6）。

### 6.2 真机/截图验收

- 轰炸模式下满杆压弯：重型机只能压到很小的坡度、轻型机稍大；准心始终在机头正前方的小锥内，不会出现“炸弹丢到侧面”。
- 掉翼后进入轰炸：坡度上限肉眼可见变小、滚转更慢，HUD 的 `滚转 ≤X°` 同步变小。
- 普通飞行退出轰炸：大坡度机动立即恢复，无粘滞。
- 帮助/教学能解释“同坡度下半径随速度变化；大飞机不快是因为坡度和滚转，不是因为同一坡度半径更大”。

## 7. 测试与兼容

### 7.1 受影响的现有测试

| 测试 | 现状 | 修改 |
| --- | --- | --- |
| `tests/simulation.test.ts:143-162` 轰炸稳定/落点 | 直接设置 `world.aimOffset`、断言落点不可变 | 改为通过输入产生目标；断言 `aim` 在前向锥内、落点不可变、冷却不变 |
| `tests/simulation.test.ts:298-348` 五分钟耐久 | 含投弹流程 | 增加“轰炸模式下坡度受限、目标在前方”的抽样断言；`peak<250` 保持 |
| `tests/flight-dynamics.test.ts:33-92` 倾角/滚转 | 只测普通模式 | 新增投弹模式子用例（A1–A4），普通模式断言不变 |
| `tests/controls.test.ts` | 摇杆/轰炸 trim | 无影响（HUD 文案变化不影响输入断言）；战斗相机投影按 10 的 FOV/pitch 更新 |

### 7.2 新增测试

- `tests/aero.test.ts`：§3.2 表的半径/转弯率、质量无关性（同 V/φ 不同质量结果相同）、单位换算。
- `tests/bombing-envelope.test.ts`：A1–A8、A10。
- 真机截图：四机投弹坡度对比、掉翼前后对比、锥边界准心。

### 7.3 兼容与接口

- **存档**：无新增字段（D9）；BOMBING 常量与派生包线都是局内运行时。
- **03**：只消费 `bankLimit`，不重复实现 09；`bankLimit=Infinity` 时完全等价 0.3.0。
- **04**：投弹油门/能量逻辑不变；HUD 的坡度值来源改为 09 的 getter；04 A5/A11 改为引用 09。
- **08**：17 架新机体的投弹坡度自动由 response 推导；利维坦流（wingDeck/发动机/炮塔叠装）同样经 response 收紧投弹坡度，不需额外字段；若某架手感需要手调，再加可选 `bombingBankLimitDeg`。
- **10**：轰炸镜头/高度层由 10 权威定义；09 的准心、前向锥、HUD 投影都使用 10 的当前镜头参数。
- **性能**：每帧 O(1) 纯计算；前向锥 2 次 sin/cos + 2 次 clamp；不新增对象分配。

## 8. 待确认与备选

| # | 问题 | 推荐 | 备选/影响 |
| --- | --- | --- | --- |
| 1 | 是否引入真实 CLmax/失速/尾旋 | **不引入**（本作无俯仰，竖屏单手） | 引入需重做四架速度/质量数据与全部飞行测试，属于 0.5 大版本 |
| 2 | “同坡度同速度半径与质量无关”是否接受 | **接受**（真实气动），机型差异用速度/最大坡度/滚转响应表达 | 若策划坚持“大机同坡度半径更大”，只能人为加质量项，与真实公式冲突，不推荐 |
| 3 | 投弹滚转响应是否再加 `rollRateCapDeg` | 先只用 ×0.75 响应系数，真机看是否“瞬间压死” | 加硬性 rollRate 上限更直观，但可能与 03 的振荡/损伤模型打架 |
| 4 | 前向锥 10°、4–14 单位是否合适 | 基线 10°/4–14 | 可调 6–12°；0°=纯正前方；改变会影响投弹难度与轰炸机操作 |
| 5 | 是否把“投弹坡度/转弯半径”显示在 HUD | 只显示 `滚转 ≤X°`，转弯半径放帮助/教学 | 显示半径会让竖屏 HUD 更挤，且数值是理想下界 |
| 6 | 09 与 04 的边界 | 04 管油门/能量/HUD，09 管坡度/目标/气动 | 若希望全部投弹规则集中，可把 04 的 45% 油门也移入 09，但会拆散 04 的加力叙事 |
| 7 | 轰炸镜头“缩小 POV”的方向 | **缩小 FOV 48→34（长焦放大）**，见 10 §3.4 | 若实际想要更大范围，改广角；需重写 10 的验收 |
