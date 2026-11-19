# 04 · 双区油门与加力能量

> 状态：提案（未实施）。本文只描述修改，不改源码、测试和 `docs/` 基线文档。
> 对应总览：需求 #7；必须遵守共享决策 **D4（双区油门与加力）**、**D11（测试与验收原则）**；接口相关 D2（发动机损伤）、D5（事件总线）、D8（色板）、D9（存档）。
> 基线：0.3.0（提交 `5b22187`）。行号以该提交为准，实施时以符号名为准；所有数值均为**基线可调**，D4 已给定的阈值/倍率本文原样沿用，只做补充口径说明。

## 0. 与 00-overview D4 的一致性

本文逐条落实 D4：三段行程 `0.74 / 0.84 / 0.76` 与 `boost=(t-0.84)/0.16`（§3.1）；极速 ×1.55、推力 ×1.9、`energyDrain` 耗能、耗尽后回充 ≥8、8/s 超速回落（§3.2/§3.3）；轰炸关闭外圈、≤45% 微调（投弹坡度/目标规则见 09，本文只保留油门/能量/HUD 接口）；双环 HUD、橙红加力、迟滞轻振、Shift 长按（§3.4）；能量条改“加力储备”（§3.2/§3.4）。D4 未展开的口径（迟滞只锁许可、耗能随 boost 线性、与 03 损伤的叠加顺序）在对应小节补充，均不改变 D4 的阈值与倍率。

## 1. 问题与现状

### 1.1 当前输入链路

- `VirtualStick.read()`（`src/input/VirtualStick.ts:86-110`）把触控向量长度映射为 0..1 的 `magnitude`：死区 0.12、指数 0.85（`VirtualStick.ts:98-101`），返回 `x/z` 单位方向 + `magnitude` + `active`（`:103-109`）。**没有正常区/外圈区分**，`magnitude=1` 就是物理推到边缘。
- 摇杆帽按单位方向贴在圆环上（`VirtualStick.ts:76-85`、`:143-145`）；`feedback()`（`:111-146`）写 `data-mode`（`cruise / accelerating / full / trim / depleted`，`:117-127`）、`--throttle` 百分比与 conic 进度（`:128`）、文案（`:130-142`）。它只是“把当前油门画出来”，外圈不是一个操作区域。
- `setFlightState(energyAvailable, bombing)`（`VirtualStick.ts:68-71`）由 `GameApp.updateHud()` 以 `p.energy > 0` 调用（`src/app/GameApp.ts:265`）：能量归零后普通油门也被显示成 `depleted`、进度环归零（`VirtualStick.ts:113-115`），与“普通油门免费”直接冲突。
- 键盘只识别 WASD / 方向键（`VirtualStick.ts:88-95`；`GameApp.ts:672-692` 的 `movement` 列表），**没有任何加力键**；键盘恒为满行程，没有模拟“再拉一段”的手段。

### 1.2 当前模拟与能量语义

- `World.updatePlayer()`（`src/simulation/World.ts:384-445`）里 `throttle = input.magnitude × (isBombing ? 0.45 : 1)`（`:419-421`）。只要 `throttle > 0 && energy > 0` 就扣能量并加速，否则回能并减速（`:422-428`）：
  - **任意油门都在耗能**，能量实际是“加速计时器”；
  - 能量耗尽后 `throttle` 逻辑失效，飞机只能减速回能（`:426-427`）；
  - 松杆回能（`:426`）反而成为唯一恢复方式，玩家最优策略恒为“能推就推、推不动再松”，没有“普通满油门”和“搏一把加力”的取舍。
- 速度 clamp 在 `cruiseSpeed .. maxSpeed × engineFactor`（`:435-439`），其中 `engineFactor = 0.5 + partFactor("engine") × 0.5`（`:396`）。没有超速上限、没有“超过常规极速后的回落”概念；加力极速无处安放。
- 能量耗尽次数用 `energyEmptyCount` 记录（`:127-129`、`:429-433`），结算写入 `energyEmpty`（`:1394`）。语义是“加速中断次数”，改造后应改为“加力耗尽次数”。
- `isBombing` 会把油门压到 45%（`:419-421`；`GameApp.ts:291-295` 的 `isBombing` 展示），轰炸期间仍然按 45% 油门扣能量——三处（摇杆反馈、World、HUD）各自维护同一套“能量/轰炸”判断，缺乏单一来源。

### 1.3 HUD、CSS 与测试现状

- 战斗 HUD：能量条由 `p.energy / p.stats.energyMax` 驱动（`GameApp.ts:276-277`），状态文案“能量不足 · 松杆恢复 / 建议松杆恢复 / 能量充足”（`:298-305`），低能量根类 `.low-energy`（`:345`；`src/style.css:1392-1394`）。
- 摇杆 DOM：`role="slider"`、`aria-valuenow`、外圈 `.stick-throttle`、内圈虚线 `.stick-half`（`GameApp.ts:253`；`src/style.css:1195-1212`）。满油门金色（`style.css:1265-1280`）、轰炸青蓝（`:1281-1283`）、耗尽红色文案（`:1284-1286`），但**外圈的 conic 进度只是 0–100% 油门的可视化，没有“外圈=另一种操作”的语义**。
- 参考记录：`docs/IMPLEMENTATION.md:31` 只引用了本机 MadMax 的“虚线半油门圈、实线满油门圈、金色满油门、进度环百分比”，是纯视觉参照；MadMax 式“内圈正常 / 外圈有代价的加力”没有落地。
- 受影响测试：`tests/controls.test.ts:148-165`（进度环、百分比、满油门金色、松手清零）、`:166-179`（轰炸微调、能量耗尽 `depleted`）；`tests/simulation.test.ts:26-40`（满油门耗能、松杆回能）、`:163-182`（发动机损伤后极速上限）、`:298-348`（五分钟耐久按 `magnitude: 0.7` 持续飞行）。

### 1.4 结论

现状把“能量”和“油门”绑成一个加速资源：正常满油门也扣能、外圈没有操作含义、键盘无法表达加力、轰炸与耗尽反馈互相污染。需求要的是相反的层次：**普通推满 100% 是免费的基线机动；越过外圈迟滞坎才是花储备换爆发的高风险选择。**

## 2. 目标体验

- **核心循环**：内圈随便推——0–100% 普通油门零成本，推满也只是常规极速；越过外圈坎——加力点亮、引擎轰鸣、极速与推力大幅抬升，能量条开始掉；松回内圈或用完——速度以 8/s 收回常规极速，储备慢慢回充。
- **三段可感知决策**：巡航（省电/耐心）→ 满油门（免费、稳定，默认战斗状态）→ 加力（搏一次追击、脱离或救援）。加力时长 5–7 秒（基线机体，见 §3.3），回充后能再来一次，形成节奏。
- **外圈必须“拉出一段”**：从内圈满油门环到加力触发之间隔着迟滞带，少量手抖/推到边不会误触；越过时有一次轻振和颜色变化，玩家能“感觉到坎”。
- **单手不增负**：加力仍然只用一根拇指、同一个方向，只是径向多拉 10%–26% 行程；方向不受影响，斜向输入与正交方向一致。
- **失败可理解**：能量为 0 时外圈灰掉/锁定并提示“加力耗尽 · 回充中”，加力不可用但普通油门照常工作，不会让玩家觉得“飞机坏了”。
- **本轮边界**：能量只服务加力。普通油门、普通转向、轰炸微调、风场都不耗能；武器、护盾、过热/冷却系统本轮不引入（见 §8）。

## 3. 目标设计

### 3.1 输入映射：三段行程 + 迟滞状态机

**行程口径**：沿用 `VirtualStick.read()` 内部算出的行程量作为归一化行程 `t`（死区与 0.85 指数已包含，`VirtualStick.ts:98-101`），实现时把这个中间量命名为 `travel`，`Intent.magnitude` 改为返回 `throttleOf(t)`（§3.5），避免两套行程定义；UI 圆环位置按同一公式反算，保证“看到哪一圈=推到哪一段”。

| 段 | `t` 范围 | 普通油门 | 加力 |
| --- | --- | --- | --- |
| 正常区 | `0 ≤ t < 0.74` | `throttle = t / 0.74`（0–100%） | 0 |
| 迟滞带 | `0.74 ≤ t < 0.84` | 100%（保持满油门） | 未获许可：0；已获许可：按公式，通常为 0 |
| 加力区 | `0.84 ≤ t ≤ 1` | 100% | `boost = (t - 0.84) / 0.16`（0–1） |

```ts
// 建议放在新文件 src/input/ThrottleZones.ts，纯函数，不碰 DOM/Three.js
const T = RULES.boost; // §3.5 的常量

export function throttleOf(t: number): number {
  return clamp(t / T.normalMax, 0, 1);            // 0.74 → 100%
}
export function boostLevelOf(t: number): number {
  return clamp((t - T.enter) / (1 - T.enter), 0, 1); // 0.84 → 0, 1 → 1
}
// 迟滞：只锁“加力许可”，不锁等级
export function nextBoostLatch(t: number, latched: boolean): boolean {
  return latched ? t >= T.exit : t >= T.enter;    // 进入 0.84 / 退出 0.76
}
```

- **迟滞语义**：`latched` 是一个布尔许可。未许可时 `t` 必须 ≥0.84 才置 true；已许可时跌到 0.76 以下才置 false。0.76–0.84 之间即使等级算回 0 也不撤销许可——再次推回 0.84 以上无需重新跨坎；只有跌出 0.76 才完全退出、重新“拉一段”。这样抖动 0.78±0.02 不会反复点亮/熄灭。
- **能量门**：`boostLevel > 0` 还要求 `energy > 0 && !boostLocked`；`boostLocked` 只在能量耗尽时置位，回充到 ≥8 且加力输入松开后清除（§3.2）。被锁时即使 `t=1`，`boost=0`，摇杆进入“加力耗尽”表现。
- **键盘例外**：键盘没有行程，WASD/方向键按满油门 100% 处理，`boost` 只由独立加力键给出（§3.4）。否则“按 W 即到 t=1”会绕过迟滞、直接加力。

**摇杆帽 / 进度环 / 外圈如何表达“还要再拉一段”**（建议 DOM 与 CSS 变量）：

| 元素 | 现状 | 目标 |
| --- | --- | --- |
| `.stick-half` 虚线圆 | 50% 半径处（`style.css:1206-1212`） | 保留为“半油门”参考 |
| 新增普通满油门环 | 无（底盘边框即满油门） | 74% 半径的虚线/实线环，标注“满油门”；正常区油门满格时环亮金色 |
| 新增加力外圈 | `.stick-throttle` conic 即 0–100% 油门（`:1195-1205`、`:1265-1280`） | 84%–100% 半径的橙色环带 + 外缘进度弧 `--boost`；未许可时半透明，许可/加力中点亮为橙红 |
| 摇杆帽 | 只跟随方向（`:1231-1243`） | 加力时帽外扩 4% 或加一圈橙色光晕（rubber-band 表现，不改变 t 上限） |
| 迟滞带 | 无 | 74%–84% 之间窄环：进入时闪一次，文案“再拉进入加力” |

> 半径换算：`t` 是死区+指数后的值，圆环的物理半径 `r = 0.12 + 0.88 × t^(1/0.85)`。据此 74%/84%/76% 阈值分别落在约 **73.7% / 83.7% / 75.7% 半径**；CSS 圆环直接取 74%/84% 即可（误差 <0.3% 半径），但阈值判断必须用 `t`，不要用像素或 CSS 变量。真机手感风险见 §8。

**触觉迟滞点**（由 `VirtualStick` 只在状态变化时回调，`Audio`/`GameApp` 执行振动并尊重 `save.data.vibration`）：

| 事件 | 时机 | 反馈 |
| --- | --- | --- |
| `band` | 未许可状态下 `t` 升过 0.74 | 一次 8–10ms 轻振 + 环闪，提示“到满油门了” |
| `engage` | 许可从 false→true 且能量足够 | 一次 12–15ms 振动 + 点火音 + 外圈点亮 |
| `exit` | 许可 true→false（跌到 0.76 以下） | 一次 6–8ms 轻振 + 外圈熄灭 |
| `denied` | `t≥0.84` 但能量为 0/锁定 | 一次短促双振（1s 冷却）+ 警告音，避免每帧触发 |
| `depleted` | 加力中能量归零 | 一次警告音 + HUD 红光脉冲，不加振 |

**复位时机**（“松手/暂停/失焦/切轰炸必须回到普通状态”）：

| 场景 | 复位点 | 行为 |
| --- | --- | --- |
| 松手 / pointercancel / lostpointercapture | `VirtualStick.resetPointer()`（`:147-156`）扩展 | `active=false`、`t=0`、许可清零、`--boost=0` |
| 暂停、失焦、页面隐藏 | `GameApp` 现有 `stick.reset()`（`GameApp.ts:93-108`、`:460-461`、`:515-516`） | 清键盘与行程；恢复后必须重新拉过 0.84 才能加力，避免回到前台瞬间自动点火 |
| 打开升级 / 结算 | `World.openUpgrades()`（`World.ts:1073-1080`）、phase 变化 | 世界冻结；HUD 隐藏加力状态；恢复后按普通状态 |
| 切入轰炸模式 | `World.toggleBombing()`（`World.ts:1256-1266`） | 立即 `boosting=false / boost=0`，外圈关闭（§3.2），摇杆显示轰炸微调 |
| 能量耗尽 | `World.updatePlayer()` | 立即退出加力并置 `boostLocked`；回充 ≥8 且加力输入松开后解锁，重新拉出才点火 |
| 失速/边界风险 | `World.updatePlayer()`（`:401-403` 的边界软推） | 不特殊处理，加力照常可用（边界软推优先） |

**方向与斜向**：`x/z` 仍是单位方向（`VirtualStick.ts:103-109`），`t` 只由长度决定；斜向在相同径向距离下得到相同 `t`，不做 `√2` 补偿，方向不变。平滑仍用现有 `damp(...,24,dt)`（`:96-97`）；为避免 24/s 平滑让加力状态滞后，状态判断用平滑后的长度（现状口径），真机若觉得钝可把加力判断改用原始长度，属于调参项。

### 3.2 能量语义重构

**新语义：能量 = 加力储备（Boost Reserve）**，只被加力消耗，其他行为一律回能或不变。

| 行为 | 能量 | 速度 |
| --- | --- | --- |
| 无输入（滑行） | `+energyRecover × dt` | 以 1.2/s 自然减速（`World.ts:427`），超速时按 8/s |
| 普通油门 0–100%（含拉满） | `+energyRecover × dt`，**不消耗** | 推力 `acceleration × engineFactor × throttle` |
| 普通转向 / 风场 | 不变 | 转向损耗仍为 `speed -= Math.abs(delta) × 0.35`（`World.ts:434`） |
| 轰炸微调（≤45%） | `+energyRecover × dt`，**不消耗** | 推力 `acceleration × engineFactor × throttle × 0.45` |
| 加力 | `-energyDrain × boost × dt`；`boost=1` 时即每秒 `energyDrain` | 推力与极速按 §3.3 抬升 |

- **耗尽与再触发**：加力把能量扣到 0 的同一帧即 `energy=0`、`boost=0`、`boosting=false`、`boostLocked=true`。解锁需同时满足 `energy ≥ boostRearm(8)` **且加力输入已松开**（`boostRequest = 0`，拉回迟滞带或内圈），再重新拉出才点火——否则玩家贴着外圈不动会变成“回 8 点就自动点、点半秒又灭”的抽搐。D4 的 ≥8 门槛不变，只是额外要求一次有意的重新拉出。锁定期间普通油门完全不受影响；外圈显示锁定，HUD 提示“加力耗尽 · 回充中”。
- **D4 口径细化**：D4 只要求“0 能量无法进入、回充 ≥8 才能再次触发”。本文采用：进入加力要求 `energy > 0 && !boostLocked`；正常消耗后（未耗尽）只要还有能量就可以再次进入，只有**耗尽那一次**触发 8 点锁定。若希望更保守，见 §8-2 的备选（统一 ≥8）。
- **轰炸模式（油门 + 姿态限制）**：`isBombing` 时 `boost` 强制为 0（输入层和 `World` 双重防护），油门限 45%，能量正常恢复；外圈视觉变暗并标注“轰炸模式 · 外圈关闭”。轰炸模式不因加力改动转向曲线（仍为 `×0.65`，`World.ts:404-409`）。
  - **滚转上限按 09/D12 的机型 + 损伤动态包线**：`bankLimit = bombingBankLimit(p, damage)`（14–36°；完好示意 Wasp 34.7°、Swift 27.8°、Courier 19.6°、Mastodon 16.9°；右翼全毁再收紧到约 78%），由 03 的 `updateFlightTurn(..., bankLimit, bombing)` clamp；04 不重复实现坡度公式。
  - 投弹滚转响应 ×0.75（09 §3.3.3）：重型机更迟缓；损伤后的 response 下降会同时收紧坡度和滚转速度。
  - 进入轰炸模式时若当前 `|bank| > bankLimit`，按正常滚转速率回收到限值（不瞬移）；退出后恢复完整包线，可立即滚回大角度。
  - 滚转振荡/偏置仍在限值内生效：右翼缺失时右滚更快、左滚更慢的差异保留，只是整体被动态 `bankLimit` 夹住。
  - HUD 在轰炸模式显示动态 `滚转 ≤X°`（与“准心稳定 X%”并列，见 §3.4），帮助页补一句；X 由 09 的 getter 提供。
- **HUD 提示**：能量条标题从“能量”改为“加力储备”（`GameApp.ts:247`），文案 `加力就绪 / 加力中 / 加力储备偏低 / 加力耗尽 · 回充中`，阈值从现有 `<8` / `<40%`（`GameApp.ts:298-305`、`:345`）改为基于 `boostLocked` 与 `energy / energyMax` 的统一 helper，避免三处各写一套。
- **与 03 发动机损伤的叠加**：加力倍率乘在**损伤后的汇总推力/极速**上，不绕过损伤。`engineFactor = 0.5 + partFactor("engine") × 0.5`（`World.ts:396`）在 03 定稿后由 `ControlDamage.thrustLeft/Right` 聚合替代，顺序固定为：部件/损伤系数 → 汇总 `engineFactor` → 加力倍率。加力不吃掉损伤下限，也不放宽 03 的偏航/滚转偏置；残机靠加力反超完好机的幅度必须可验证（§6-A7）。03 的 `weaponFactor / lockFactor / bombFactor` 与加力无关。
- **本轮明确不引入**：过热、冷却、加力次数、武器/护盾耗能、加力影响锁定。以后若加“武器耗能/护盾”，需要重新定义能量为通用资源并更新 01/03/05；本轮能量只服务加力。

### 3.3 速度与推力模型

新增常量集中在 `src/data/config.ts` 的 `RULES.boost`（`RULES` 已是全局唯一配置入口，`config.ts:1-20`）：

```ts
boost: {
  enabled: true,           // 灰度开关：一键回退到 0.3.0 行为
  normalMax: 0.74,         // 正常区上限，t
  enter: 0.84,             // 进入加力阈值，t
  exit: 0.76,              // 退出加力阈值，t（迟滞）
  speedMultiplier: 1.55,   // 加力极速倍率
  thrustMultiplier: 1.9,   // 加力推力倍率
  overspeedDecay: 8,       // 超过当前极速后的回落速率，单位/秒²
  rearm: 8,                // 耗尽后允许再次加力的能量点
},
```

> 投弹相关常量（45% 油门、`bankBase/bankPerResponse/aimConeDeg`、滚转响应系数等）统一在 **09 的 `BOMBING`**（§3.3/§3.6），避免两处各写一套；04 只定义加力/能量常量并在投弹时读取 09。动态坡度由 09 的 `bombingBankLimit(p, damage)` 计算，经 03 的 `bankLimit` 参数在 `FlightDynamics` 接收端 clamp。

| 量 | 公式 | 备注 |
| --- | --- | --- |
| 常规极速 | `maxSpeed × engineFactor` | 与现状一致（`World.ts:435-439`），不再乘 boost |
| 加力极速 | `maxSpeed × engineFactor × (1 + (1.55 - 1) × boost)` | `boost=1` 时恰为 ×1.55 |
| 常规推力 | `acceleration × engineFactor × throttle` | 普通油门免费 |
| 加力推力 | `acceleration × engineFactor × (throttle + (1.9 - 1) × boost)` | `throttle=1, boost=1` 时 ×1.9 |
| 加力耗能 | `energyDrain × boost × dt` | 线性；满级即 `energyDrain`/秒 |
| 回能 | `energyRecover × dt`（非加力时） | 含普通满油门、转向、轰炸、滑行 |
| 超速回落 / 绝对上限 | 超速时 `speed -= 8 × dt`；`hardMax = maxNormal × 1.55` | 超速时不再叠加推力，松杆/退出加力/降低 boost 都适用；任何时刻不越过 hardMax |
| 再次触发 | `energy ≥ 8` 且此前耗尽锁定 | 见 §3.2 |
| 轰炸滚转上限 | 由 09 `bombingBankLimit(p, damage)` 提供动态值 | 只在 `isBombing` 时生效；03 负责 min(maxBank) 与双重 clamp；退出立即恢复 |

`updatePlayer()` 的目标伪代码（替换 `World.ts:419-439` 的油门/能量/速度段，其余保持）：

```ts
const trim = this.isBombing ? 0.45 : 1;
const throttle = input.active ? clamp(input.magnitude) * trim : 0;
const boostRequest = !this.isBombing && RULES.boost.enabled && input.active
  ? clamp(input.boost ?? 0) : 0;                       // 兼容旧 Intent，见 §3.5
if (p.boostLocked && p.energy >= RULES.boost.rearm && boostRequest === 0)
  p.boostLocked = false; // 回充够且已松开外圈，避免贴边反复自动点火
const wasBoosting = p.boosting;
p.boosting = boostRequest > 0 && p.energy > 0 && !p.boostLocked;
p.boost = p.boosting ? boostRequest : 0;
if (p.boosting) {
  p.energy = Math.max(0, p.energy - s.energyDrain * p.boost * dt);
  if (p.energy <= 0) {                                 // 本帧耗尽：立即断加力
    p.energy = 0; p.boosting = false; p.boost = 0;
    p.boostLocked = true; this.energyEmptyCount++;     // 语义改为“加力耗尽次数”
  }
} else p.energy = Math.min(s.energyMax, p.energy + s.energyRecover * dt);
if (p.boosting !== wasBoosting)
  this.telemetry.record(this.elapsed, "boost_state", { on: p.boosting }); // 可选，接 05
const thrust = s.acceleration * engineFactor *
  (throttle + (RULES.boost.thrustMultiplier - 1) * p.boost);
const maxNormal = Math.max(p.frame.cruiseSpeed, s.maxSpeed * engineFactor);
const softMax = maxNormal * (1 + (RULES.boost.speedMultiplier - 1) * p.boost);
const hardMax = maxNormal * RULES.boost.speedMultiplier; // 绝对上限 ×1.55
if (p.speed > softMax)                                 // 超速只回落，不再被推力顶高
  p.speed = Math.max(softMax, p.speed - RULES.boost.overspeedDecay * dt);
else {
  p.speed = Math.min(softMax, p.speed + thrust * dt);
  if (throttle === 0 && p.boost === 0) p.speed -= 1.2 * dt; // 保留现有滑行阻力
}
p.speed = clamp(p.speed, p.frame.cruiseSpeed, hardMax);
```

要点：

- 加力结束不会瞬移：`softMax` 从 ×1.55 掉回 ×1，`speed > softMax` 时每帧 −8/s 回落；超速期间推力不再把速度顶高，`hardMax`（×1.55）只作为绝对护栏。玩家能感到“冲出去再被风压回来”。
- 转向不变：不加成 `turnRate`。现有协调转弯 `ω = -g·tan(bank)/speed`（`FlightDynamics.ts:56-71`）会因速度升高而自然变钝（同等坡度转弯半径更大），这已经构成加力的操控代价；是否额外削减转向权限见 §8-1。
- 速度上下限：下限仍是 `cruiseSpeed`；上限在加力时抬到 1.55 倍，其余时间回落。引擎损伤把 `engineFactor` 压低时，常规与加力上限同步降低，8/s 回落自然处理“损伤后超速”。

**各机体加力续航估算（无改装，数据来自 `src/data/aircrafts.ts:42-44 / 71-73 / 100-102 / 129-131`）**：

| 机体 | 能量上限 | 加力耗能/s | 满加力持续 | 回能/s | 0→8 解锁 | 空仓回满 | 常规极速 | 加力极速（×1.55） | 回落（8/s） |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| SWIFT–01 | 85 | 15 | 5.7s | 17 | 0.47s | 5.0s | 13.5 | 20.9（+7.4） | ≈0.93s |
| COURIER–02 | 110 | 16 | 6.9s | 13 | 0.62s | 8.5s | 10.5 | 16.3（+5.8） | ≈0.72s |
| MASTODON–03 | 135 | 21 | 6.4s | 9 | 0.89s | 15.0s | 8.2 | 12.7（+4.5） | ≈0.56s |
| WASP–04 | 75 | 14 | 5.4s | 20 | 0.40s | 3.8s | 15.5 | 24.0（+8.5） | ≈1.07s |

改装会改变这张表（`src/data/upgrades.ts`）：反应堆（`:272-285`）`energyMax +45`、回能 ×1.35、`energyDrain ×1.18`，例如 Swift 装配后满加力约 7.3s、回满约 5.7s；高压发动机/辅助发动机（`:36-56`、`:245-258`）提高耗能、缩短单次加力；冷却鳍（`:348-358`）提高回能。**升级后的实际值以 `Stats` 计算为准，上表只作基线**。

### 3.4 HUD、音效、触觉与键位

**双环摇杆 + 加力储备**：

- 内圈：0–100% 普通油门进度（青绿 → 满油门金色，沿用 `style.css:1265-1280` 的 `data-mode="full"`）；74% 半径环标记“满油门 / 再拉进入加力”。
- 外圈：84%–100% 半径橙色环带 + `--boost` 进度弧；`data-mode="boost"` 时橙红发光、摇杆帽光晕；`data-mode="locked"` 时外圈灰红、文案“加力耗尽 · 回充中”；轰炸模式 `data-mode="trim"` 且外圈变暗。
- 颜色（与 D8 色板一致）：青绿 `--mint` → 金 `#ffd27f` → 加力橙红 `#ff7a4d`；能量条默认青绿/金，加力中橙红，锁定红光脉冲（`style.css:976-984`、`:1392-1394` 的 `.low-energy` 语义改为“加力储备低/锁定”）。
- 数值文字：`#speed-label` 保持 m/s；`#energy-state` 改为加力状态；`#flight-mode`（`GameApp.ts:292-295`）在战斗模式追加 `加力中 · 储备 41%` / `加力就绪` / `加力耗尽`；**轰炸模式改显示 `准心稳定 X% · 滚转 ≤X°`（X 来自 09 的动态包线）**，让玩家知道这是刻意的包线限制而不是操纵失灵。
- 无障碍：`GameApp.ts:253` 的 `aria-label` 改为“飞行摇杆：方向控制航向，内圈普通油门，外圈加力”；`VirtualStick.feedback()` 同步 `aria-valuenow = round(throttle×100)`、`aria-valuetext`：`巡航 · 油门 0%` / `油门 66%` / `满油门 100% · 再拉进入加力` / `加力 62% · 极速 +55%` / `轰炸微调 · 油门 45%` / `加力耗尽 · 回充中`。`role="slider"` 无法表达二维，保留现状并把方向文本放在 label 中作为降级。
- 帮助文案：更新 `GameApp.ts:477` 的“拖动中央摇杆”步骤为“内圈拉满是普通油门、不耗能；再向外拉过外圈才进入加力，会消耗加力储备”；轰炸步骤补“轰炸模式会自动限制滚转角，便于稳定准心”；桌面提示（`GameApp.ts:68`）追加 `SHIFT` 长按加力。

**音效与触觉**（全部 Web Audio 合成，无新资源；`src/services/Audio.ts:15` 现有 `click/coin/hit/bomb/upgrade/lock` 扩展）：

| 反馈 | 触发 | 实现建议 |
| --- | --- | --- |
| `boost_engage` | 许可进入 0.84 | 低频上扫 + 噪声起音，0.25s；与触觉同时 |
| 引擎轰鸣 | 加力中持续 | 复用现有环境音/振荡器，音量与 `boost` 成正比；能量低时音高下降 |
| `boost_exit` | 退出加力 | 短促下扫，0.12s |
| `boost_denied` | 外圈但能量锁定 | 两次短促低音，1s 冷却 |
| `boost_depleted` | 能量归零 | 警告音 + 屏幕边缘橙红脉冲（复用低能量样式） |
| 触觉 | 见 §3.1 触觉表 | `navigator.vibrate`（现有 `Audio.ts:52` 路径），不支持时静默降级 |

**键盘加力键（推荐 Shift 长按）**：

- 推荐：`ShiftLeft/ShiftRight` 长按 = 加力 100%，与 WASD/方向键并行；方向键照常给普通满油门。理由：离散、确定、可单测；可以在转向中途按/松；无需计时状态；不会和浏览器/输入框冲突（战斗界面已限制输入框）。
- 备选：双击 W 进入加力。优点是不需要第二根手指；缺点是必须维护双击计时与防抖、与 `keydown` repeat 冲突、无法在左/右/下方向加力、测试与教学都更难，**不作为默认**。
- 细节：Shift 只在有移动键按下时生效（避免“Shift 单独按着就冲”）；窗口失焦/暂停时随 `stick.reset()` 清除；加力键不加入 `GameApp.ts:672-692` 的 `movement` 数组，另走独立分支；帮助面板与桌面键位说明同步（§4）。

### 3.5 接口伪代码

```ts
// src/simulation/types.ts
export interface Intent {
  x: number; z: number;
  magnitude: number;   // 普通油门 0..1（轰炸模式再乘 0.45）
  active: boolean;
  boost?: number;      // 加力 0..1；缺省 0，兼容旧字面量（实施后 0.5 再收紧为必填）
}
export const NO_INPUT: Intent = { x: 0, z: 1, magnitude: 0, active: false, boost: 0 };

export interface Player {
  // …现有字段
  boosting: boolean;   // 本帧是否在加力
  boost: number;       // 本帧生效的加力等级 0..1
  boostLocked: boolean;// 耗尽锁定，energy ≥ rearm 且输入松开后解锁；overspeed 可按 speed-maxNormal 派生，不新增字段
}

// src/input/VirtualStick.ts
setFlightState(s: {
  boostReady: boolean; // energy>0 && !boostLocked
  boosting: boolean;
  locked: boolean;     // boostLocked
  bombing: boolean;
}): void;
onZone?: (e: "band" | "engage" | "exit" | "denied" | "depleted") => void;
// read(dt): Intent —— magnitude 改为“普通油门”，boost 为加力等级；
// 键盘分支：movement 键 → magnitude=1、boost=Shift?1:0（覆盖全部方向）。
```
- **调用顺序**：`GameApp.loop()` 在 `this.world.frame(dt, this.stick.read(dt))`（`GameApp.ts:733`）之前用当前 `world.player` 调 `stick.setFlightState(...)`，把反馈延迟从 HUD 的 90ms 降到 1 帧；`updateHud()` 只负责能量条/文字，不再调用 `setFlightState`（移除 `GameApp.ts:265` 的旧调用）。
- **轰炸滚转上限的传递**：`World.updatePlayer` 调 `updateFlightTurn(..., bankLimit, bombing)`，其中 `bankLimit = isBombing ? bombingBankLimit(p, damage) : Infinity`（09 动态值）、`bombing = isBombing`；`FlightDynamics` 负责 `min(envelope.maxBank, bankLimit)` 与 target/final 双重 clamp（03 §3.5.1–3.5.2），04 不重复实现滚转动力学。`Intent` 不新增字段，轰炸模式由 `World.phase` 判定（与现有 `isBombing` 一致）。
- **兼容性**：`boost` 设为可选，旧测试里的 `{ x, z, magnitude, active }` 字面量可继续编译；`World` 内统一 `input.boost ?? 0`。`Player` 新字段初始化在 `World` 构造函数（`World.ts:139-161`）。`Intent`/`NO_INPUT` 在测试同步后再考虑必填。
- **不新增测试依赖 Three.js**：映射纯函数放 `src/input/ThrottleZones.ts`（或 `src/simulation/` 下的无 DOM 模块），`VirtualStick` 只负责采样与 DOM；`World` 单测可直接构造 `boost` 值验证（符合 D11）。

## 4. 改动清单（文件级）

| 文件 | 改动 | 类型 |
| --- | --- | --- |
| `src/data/config.ts` | 新增 `RULES.boost`（§3.3 全部常量，含 `enabled` 灰度开关）；投弹常量（油门 45%、坡度、目标锥）统一在 09 的 `BOMBING` | 配置 |
| `src/input/ThrottleZones.ts` | **新增**：`throttleOf / boostLevelOf / nextBoostLatch / zoneOf` 纯函数 | 输入 |
| `src/input/VirtualStick.ts` | `read()` 输出普通油门 + `boost`；三段映射与迟滞；`feedback()` 双环 `data-mode`/文案/aria；`setFlightState` 新签名；`reset()`/`resetPointer()` 清许可；Shift 键；`onZone` 回调 | 输入 |
| `src/simulation/types.ts` | `Intent.boost?`、`NO_INPUT`、`Player.boosting/boost/boostLocked` | 模拟 |
| `src/simulation/FlightDynamics.ts` | `updateFlightTurn` 新增 `bankLimit` 参数；`isBombing` 时把 targetBank/bank clamp 到 `min(envelope.maxBank, bankLimit)`；超限时清除向外的 rollVelocity，避免贴限抖动 | 模拟 |
| `src/simulation/World.ts` | `updatePlayer()` 能量/推力/极速/超速回落/耗尽锁定；轰炸强制关外圈、**从 09 取 `bombingBankLimit(p, damage)` 传给 `updateFlightTurn`**；构造初始化新字段；`toggleBombing()` 清加力、切回时恢复完整包线；`energyEmptyCount` 语义；可选 `boost_state` telemetry | 模拟 |
| `src/app/GameApp.ts` | loop 内先行 `setFlightState`；HUD 文案/颜色/`#flight-mode`/`#energy-state`；**轰炸模式显示 `准心稳定 X% · 滚转 ≤X°`（09 动态值）**；帮助与桌面键位；Shift 键；`low-energy` 语义；移除 `updateHud()` 内的旧 `setFlightState` 调用 | UI/输入 |
| `src/style.css` | 74%/84% 圆环、外圈橙红环带、`data-mode="boost"/"locked"/"trim"`、能量条配色与脉冲、`--boost` 变量、窄屏可读性 | UI |
| `src/services/Audio.ts` | 新增 `boost_engage / boost_exit / boost_denied / boost_depleted` 音色与触觉；保留振动开关 | 音频 |
| `src/data/upgrades.ts` | 仅文案：`能耗` → `加力耗能`、`能量恢复` → `加力回充`（如 `:45`、`:254`、`:278` 附近）；数值不变 | 内容 |
| `src/data/aircrafts.ts` | 无结构性改动：`energyDrain` 语义改为“满级加力耗能/s”，数值不变；字段名暂不改（§8） | 内容 |
| `src/rendering/ProceduralAircraft.ts` | 不改逻辑：尾焰已按 `p.speed / maxSpeed` 缩放（`:370-378`），超速时自动变长；08 做 Q 版换色时再接加力色 | 渲染（只读） |
| `tests/controls.test.ts` | 更新 `:148-165`、`:166-179`，新增三段/迟滞/键盘用例 | 测试 |
| `tests/simulation.test.ts` | 更新 `:26-40`、`:163-182`（断言上限）、`:298-348`（加入加力段） | 测试 |
| `tests/throttle.test.ts` | **新增**：映射/迟滞/耗尽锁定的纯逻辑单测 | 测试 |

不改：存档（`src/services/Save.ts`，D9）、武器/导弹/锁定、轰炸稳定度/落点算法（只新增滚转包线限制，见 §3.2）、相机、敌人 AI、渲染主循环结构；不改 `docs/` 基线（实施完成后再按总览 §9 合并）。

## 5. 实现任务拆分

| ID | 任务 | 写作用域 | 依赖 | 完成标志 | 估时 |
| --- | --- | --- | --- | --- | --- |
| T1 | 常量 + 纯映射/迟滞模块 + 单测 | `src/data/config.ts`、`src/input/ThrottleZones.ts`、`tests/throttle.test.ts` | — | 三段边界、0.84/0.76 迟滞、能量锁单测全绿 | 0.5d |
| T2 | `VirtualStick` 输出与反馈改造（含 Shift、复位、`onZone`） | `src/input/VirtualStick.ts`、`tests/controls.test.ts` | T1 | read 输出普通油门+boost；DOM `data-mode`/aria 正确；旧测试改完 | 1d |
| T3 | `World` 能量/速度模型（含轰炸门、耗尽锁、超速回落、初始化）**+ 轰炸滚转上限（`FlightDynamics` 的 `bankLimit` 参数与 clamp）** | `src/simulation/types.ts`、`src/simulation/World.ts`、`src/simulation/FlightDynamics.ts`、`tests/simulation.test.ts` | T1 | A1–A3、A5、A7–A9、A11 通过；30/60/120fps 一致 | 1.5d |
| T4 | `GameApp` 接线：调用顺序、HUD 文案（含轰炸滚转限制）、Shift、帮助、复位 | `src/app/GameApp.ts` | T2、T3 | 真机/浏览器操作与文案全链路可用 | 0.5d |
| T5 | CSS 双环、颜色、窄屏可读性 | `src/style.css` | T2 | 360×640 无溢出，环位与 `t` 一致（目测 + 截图） | 0.5d |
| T6 | 音效/触觉与警告 | `src/services/Audio.ts`、`src/app/GameApp.ts` | T4 | 点火/退出/拒绝/耗尽四类反馈可辨，静音降级正常 | 0.5d |
| T7 | 测试补齐与回归（含确定性、旧用例语义更新、A11 轰炸滚转上限） | `tests/*` | T2、T3 | 见 §7；测试数变化在评审中说明 | 0.5d |
| T8 | 数值调校与真机验收 | `src/data/config.ts` | T1–T7 | §6 真机清单通过，参数落在基线可调范围 | 1d |

顺序建议：T1 先行；T2 与 T3 可并行（接口按 §3.5 先对齐）；T4 在两者之后；T5/T6 与 T4 并行；T8 最后。与 03 的接口在 T3 中预留“损伤系数 → 加力倍率”的固定顺序；与 05 的 `boost_state` 事件是可选项，不阻塞。

## 6. 验收标准

### 6.1 自动化断言

| ID | 断言 | 方法 |
| --- | --- | --- |
| A1 | 普通满油门 5s 能量**不下降**（保持 `energyMax`），速度收敛到常规极速 | `World` 定步长，`intent {magnitude:1, active:true}`；`energy === energyMax`（±1e-6） |
| A2 | 加力 1.5s 后能量按 `energyDrain × boost` 下降，速度超过常规极速且向 `×1.55×engineFactor` 收敛 | 同上加 `boost:1`；能量误差 <1 步长的耗能量 |
| A3 | 能量为 0 时 `boost=0`、不再耗能；能量 <8 时无法再次加力；≥8 **且松开外圈一次**后可再次加力 | 耗尽后分别设 `energy=7.9 / 8.1`、并保持/松开 boost 输入断言 |
| A4 | 迟滞不抖动：`t=0.83` 不进入；`0.85` 进入；持在 `0.80` 保持许可；`0.75` 退出；`0.78±0.02` 抖动状态不变 | `ThrottleZones` 纯函数序列断言 |
| A5 | 轰炸模式：`t=1` 时油门 45%、`boost=0`、能量恢复；满侧向输入 2s 后 `|bank| ≤ effectiveBankLimit + 1°`（09 动态值）；外圈 HUD 为关闭态 | `World.toggleBombing()` 后 `advance` |
| A6 | 松手复位：pointerup 后 `active=false / magnitude=0 / boost=0`；下一帧无残留加力；暂停/失焦后必须重新跨 0.84 | `VirtualStick` 假 DOM 测试 + `GameApp` 行为手测 |
| A7 | 损伤叠加：发动机损毁后常规上限 `maxSpeed×engineFactor`，加力上限 `×1.55×engineFactor`，不得越界 | `damagePlayer` + 满加力 2s 采样 |
| A8 | 超速回落：加力结束瞬间 `speed > maxNormal`，在 `(speed-maxNormal)/8 + 0.1s` 内回到 `maxNormal + ε` | 逐帧采样，不用硬 clamp 断言 |
| A9 | 确定性：30/60/120fps 同种子下位置、速度、能量一致（带 boost 输入） | 现有 `advance` 三帧率用例扩展 |
| A10 | DOM/aria：`data-mode` 依次出现 `cruise → accelerating → full → boost → locked`；`aria-valuetext` 含“加力/满油门/耗尽”关键词 | 假 `StickSurface` 断言（沿用 `tests/controls.test.ts:10-60`） |
| A11 | 投弹滚转上限：任意机体满侧向输入 2s，`|bank| ≤ min(envelope.maxBank, 09 动态值) + 1°`；机型顺序满足 Wasp > Swift > Courier > Mastodon；退出轰炸 2s 内可压回 >30°；损伤后上限只降不升、无贴限抖动 | `World.toggleBombing()` + 定步长逐帧采样 |

### 6.2 真机/视觉验收

- 360×640 与 390×844：右手拇指从内圈满油门继续拉到外圈触发需要明确“再拉一段”，不误触；连续 10 次拉放无一次意外点火。
- 迟滞带轻振、点火振动、耗尽警告在真机上可区分；关闭振动设置后全部静默且不影响操作；加力状态的颜色（青绿→金→橙红）在户外亮度下可读，能量条与摇杆双环不混淆，`加力耗尽` 文字不遮挡战斗。
- 轰炸模式下外圈变暗/关闭的表意清楚，玩家不会在轰炸中尝试加力。
- 轰炸模式下满杆压弯：重型机只能压到十几度、轻型机三十多度（按 09 动态值），准心明显更稳；退出轰炸模式后能立刻压回大角度，无卡顿/回弹；损伤后限制更小也不出现抖动。
- 5 秒以上的加力爆发与 8/s 回落手感成立：松开外圈能感到“被风压回来”而不是硬切。

## 7. 测试与兼容

### 7.1 受影响的现有测试

| 测试 | 现状断言 | 需要的修改 |
| --- | --- | --- |
| `tests/controls.test.ts:148-165` “matches the throttle ring…” | 半行程 `magnitude≈0.49`、文案“加速 · 油门 49%”、推到物理边缘 `data-mode="full"` | 新语义：半行程 `t≈0.49 → 油门 66%`；物理边缘 = 加力 100% → `data-mode="boost"`；普通满油门改为推到 74% 环（用 `ThrottleZones` 精确值断言）；`--boost` 同步断言 |
| `tests/controls.test.ts:166-179` “shows the actual bombing trim…” | `setFlightState(true,true)` → `trim`；`setFlightState(false,false)` → `depleted`、`--throttle 0` | 新签名 `setFlightState({boostReady,boosting,locked,bombing})`；轰炸 `trim/45%` 保留；`depleted` 改为“外圈 `locked` + 普通油门仍可用”的断言；补加力锁定用例 |
| `tests/simulation.test.ts:26-40` “coasts and recovers on release” | 普通满油门会耗能，松杆后能量增加 | 拆成两条：普通满油门能量不变 + 滑行速度下降；加力耗能、松杆后回能 |
| `tests/simulation.test.ts:163-182` “removes a disabled engine contribution” | 2s 满油门后 `speed ≤ maxSpeed×0.75` | 旧输入无 boost 时仍应通过（`boost ?? 0`），但需补“损伤后加力上限”断言；如引擎损伤实现变化，按 03 更新 `engineFactor` 口径 |
| `tests/simulation.test.ts:298-348` 五分钟耐久 | 用 `magnitude: 0.7` 循环，从不加力 | 保留为“普通油门耐久”，另加周期性 `boost` 段，断言能量有限、不越界；避免加力把能量长期钉在 0 |
| `tests/simulation.test.ts:54-87` 暂停冻结 | `JSON.stringify(player)` 前后一致 | 新字段自然纳入；无需改断言，但需确认暂停恢复后不会残留 `boosting` |
| `tests/simulation.test.ts:143-162` 轰炸稳定/落点 | 只测稳定度、不可变落点与冷却 | 追加“满侧向输入 2s 后 `|bank| ≤ 09 动态值 + ε`，退出轰炸后恢复包线”；原稳定度/落点断言不变 |
| `NO_INPUT` / `Intent` 字面量（多处） | 无 boost 字段 | `boost?` 可选即可编译；收紧为必填时统一补 `boost: 0` |

### 7.2 新增测试

- `tests/throttle.test.ts`：三段映射表（含 0.74/0.84 边界）、迟滞序列（0.83→0.85→0.80→0.75→0.85）、耗尽锁定与 8 点解锁、键盘 Shift 组合、轰炸强制 0。
- 轰炸滚转上限：A11 的左/右满杆、松杆、切换模式、损伤后取 min 断言；`FlightDynamics` 在 `bankLimit=Infinity` 时必须与 0.3.0 的倾角行为完全一致（防回归）。
- `tests/simulation.test.ts` 增补：A1–A3、A5、A7–A9、A11、能量耗尽后普通油门不受影响、`toggleBombing` 清加力。
- DOM 层：`data-mode`/`aria-valuenow`/`aria-valuetext`/`--throttle`/`--boost` 断言，沿用现有 `StickSurface` 假对象，不引入真实浏览器。

### 7.3 兼容与接口

- **D9 存档**：无新字段、无版本变化；局内 `boosting/boost/boostLocked` 不写存档；`energyEmpty` 继续写入结算，含义改为“加力耗尽次数”，旧存档读取不受影响。
- **03 部件/损伤**：加力倍率固定乘在损伤后的 `engineFactor` 上（§3.2）；03 若改变 `engineFactor` 下限/左右偏置，需回归 A7，但 04 不依赖 03 即可先行（Wave 1）。
- **05 事件总线**：可选把 `boost_state`（on/off/denied/depleted）并入 D5 的 `WorldEvent`，供 HUD/音效/雷达告警消费；不强制，04 的 HUD 直接读 `Player` 字段也能工作。
- **01/03/06/07/08**：不冲突。08 的色板使用同一橙红；06/07 不涉及输入；01 的能量类升级文案按 §4 同步“加力耗能/回充”。
- **文档合并**：实施完成后按总览 §9 更新 `docs/GAME_DESIGN.md`（§输入和操作 `:105-125`、§飞机控制模型 `:157-208`、首版数值 `:606-627`）、`docs/systems/01-control-camera.md`（摇杆映射与逐帧逻辑 `:51-100`）、`docs/IMPLEMENTATION.md`（MadMax 记录 `:31`、能量行为 `:43-52`、浏览器验收 `:85`）。本轮不改这些基线。
- **性能**：映射为 O(1) 纯计算；CSS 只更新自定义属性，复用现有 conic-gradient（`style.css:1195-1205`），不新增每帧对象分配；加力音效沿用现有合成器与 voices 上限。

## 8. 待确认与备选
1. **加力是否影响转向/锁定**：默认不直接改 `turnRate` 与锁定扇形；高速下协调转弯自然变钝已提供代价。若 05 认为高加力追击破坏锁定平衡，可把加力时 `lockArc × 0.85`（需 05 评估），不默认启用。
2. **进入门槛**：默认按 D4 字面——`energy > 0` 可进入，只有耗尽后需要回充 ≥8，且默认额外要求松开外圈一次再点火（防抽搐）；备选是任何进入都要求 `energy ≥ 8`（更保守、行为更统一），或能量到 8 即自动恢复加力。三者都以 `rearm` 参数化，推荐真机后定。
3. **加力等级与耗能**：默认线性（半拉半耗），备选“一进外圈即满级、恒定满耗”。线性更适合“外圈拉多少给多少”的操作叙事；若手感太黏再改。
4. **外圈物理行程偏窄**：100px 底盘半径 50px，74%→84% 只有约 5 CSS px（86px 底盘约 4px）。D4 阈值必须遵守；可先通过加粗外圈、帽光晕、触觉与文案弥补，必要时把底盘放大到 112–120px 或调整 D4 阈值（**调整阈值必须先更新 00-overview D4**）。
5. **键盘方案**：推荐 Shift 长按（§3.4）；双击 W 作为备选，不默认。若后续支持手柄，加力映射到扳机行程，复用 `ThrottleZones`。
6. **轰炸外圈表现**：默认“变暗 + 标注外圈关闭”；备选完全隐藏外圈（更干净但玩家切换模式时会看到控件跳变）。
7. **回能延迟**：默认松加力立即回能；备选加 0.5–1s 冷却再回充（更像“引擎喘口气”，但会拉长节奏）。本轮默认无延迟。
8. **字段命名**：`energyDrain/energyRecover` 保留旧名（存档、升级、测试兼容），语义改为加力耗能/回充；`aircrafts.ts` 与 `upgrades.ts` 只改文案。是否在 0.5 改名为 `boostDrain/boostRecover` 另议。
9. **HUD 是否显示剩余加力秒数**：默认能量条百分比 + 低于 2s 闪烁；若要显示“可加力 3.2s”需额外 UI 位置（控制区较挤），暂缓。
10. **能量耗尽的惩罚**：默认只禁止加力，不掉速、不咳嗽、不扣血；备选加一次性引擎咳嗽/短暂掉推力（需 03/音效配合），本轮不做。
11. **03 全损发动机 + 加力**：若 03 给全毁发动机保留 50% 推力下限，则加力极速约为常规的 ×1.55 相对该下限；需在 03 定稿后回归 A7，防止“残机靠加力反超完好机”。
12. **能量只服务加力的边界**：本轮明确普通油门/转向/轰炸/风场不耗能；若未来加入武器耗能、护盾或过载/过热，需要重新定义能量为通用资源，并同步修改 01/03/05 与存档文案。**本轮不引入。**
13. **过热/冷却机制**：本轮不引入；若后续加入，需先定“过热只锁加力还是同时降推力、冷却条与加力储备是否共用能量”，建议在能量语义升级时一并设计（与 03 发动机损伤联动）。
14. **轰炸滚转上限**：已按机型 + 损伤动态化，公式与数值见 09 §3.3/§3.6（Wasp 34.7°/Swift 27.8°/Courier 19.6°/Mastodon 16.9°）；前向目标锥角/距离与气动解释也在 09 §8。若真机觉得过松/过紧，调 09 的 `BOMBING.bankBase/bankPerResponse`，不改 03 的 clamp 逻辑。
