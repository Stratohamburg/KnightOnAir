# 13 · 萌芽期完整配置（Pioneer, 1903–1914）

> 状态：提案（未实施）。本文件是**分时代配置补全**的第一份，按 11/12 的 schema 把萌芽期全部内容填一遍。
> 基线：0.3.0；关系：[08 时代/外观](08-q-art-and-era-progression.md)、[11 机体 schema/refit](11-airframe-config-and-refit.md)、[12 敌人/武器 schema](12-enemy-weapon-config.md)、[06 地面](06-ground-routes-and-terrain.md)、[10 高度/镜头](10-altitude-layers-and-bombing-camera.md)。
> 口径：单位/字段与 11/12 一致；本时代数值 = schema 基准 × 时代系数（§2）；所有数值“基线可调”。

## 0. 时代定位

- 时间：1903–1914，航空萌芽期；双翼/盒风筝、单翼竞速机、早期飞艇。
- 关卡主题：黎明草甸 / 1909 飞行大会；无喷气、无雷达、无导弹。
- 玩法关键词：低速、轻武器、目视缠斗、飞艇高价值目标、第一次“利维坦”可能（叠翼/叠发动机）。
- 玩家净空 +20（10）；空战高度带 ±4；地面单位沿土路/车队路线移动。

## 0.5 设计口径与改动清单（文件级）

- **设计口径**：本时代不新增系统；机体/敌人/武器全部按 11/12 的 schema 填入本文件表；数值 = schema 基准 × 本文件 §2 的时代系数，特殊单位在表中给覆盖值。
- **改动清单**：`src/data/aircrafts.ts`（本时代机体条目）、`src/data/enemies.ts`（本时代敌人/地面/水面）、`src/data/weapons.ts`（本时代武器）、`World/Renderer` 只读 `era/mounts/behavior/route` 字段；时代筛选由 08 的 `era` 与 00 的关卡主题驱动。
- **测试**：本时代数据校验（字段/挂点/目标层/时代枚举）、战斗 smoke（3–5 分钟）、时代过滤（其他时代条目不得出现在本关卡）、性能预算（D10）。
- **实现任务**：T1 本时代数据条目 → T2 字段接入（11/12 schema）→ T3 时代过滤与外观 → T4 平衡与验收；通用任务拆分见 11/12，本文件只负责“这个时代填哪些值”。

## 1. 机体完整配置（4 架）

| 字段 | sparrow_05 | dragonfly_06 | moth_07 | zephyr_23（二期） |
| --- | --- | --- | --- | --- |
| 名称/role | SPARROW-05 盒风筝双翼机 / starter | DRAGONFLY-06 单翼竞速机 / interceptor | MOTH-07 早期飞艇 / airship | ZEPHYR-23 竞速机 / interceptor |
| era / tier | pioneer / 一期 | pioneer / 一期 | pioneer / 一期 | pioneer / 二期候选 |
| wingCount / engineCount / prop | 2 / 1 / 1 | 1 / 1 / 1 | 1 / 2 / 2 | 1 / 1 / 1 |
| cockpit / gear / layout | 1 / tailwheel / tractor | 1 / wheel / tractor | 1 / none / nacelle | 1 / wheel / tractor |
| isFloatplane/boat/airship/heavy/large | 全 false | 全 false | isAirship=true，其余 false | 全 false |
| mass / wingArea / span / length | 800 / 14 / 8.5 / 5.2 | 600 / 9 / 6.5 / 4.6 | 5000 / 120 / 20 / 22 | 450 / 7 / 4.5 / 4.0 |
| maxSpeed / cruise / accel / turn | 5.6 / 2.4 / 4.0 / 240 | 7.8 / 3.2 / 6.0 / 250 | 3.2 / 2.0 / 2.0 / 70 | 9.0 / 3.8 / 8.5 / 300 |
| health / energy / hardpoints | 85 / 70 / 4 | 60 / 60 / 3 | 260 / 180 / 8 | 55 / 55 / 2 |
| 默认挂点/武器 | nose→ww1_sync_mg；bottom→ww1_light_bomb | nose→ww1_sync_mg | top→aa_autocannon；bottom→ww1_light_bomb | nose→ww1_sync_mg |
| refit（wingGain/engGain/wpnGain/headroom/massPenalty/potential） | 0.85/0.85/0.85/0.45/1.15/2 | 0.80/0.85/0.80/0.40/1.20/1 | 1.20/1.25/1.15/1.00/0.70/5 | 0.70/0.75/0.70/0.35/1.30/1 |
| unlockScore / unlockText | 0 / 初始机体 | 250 / 单局 250 分 | 700 / 单局 700 分 | 900 / 二期内容 |

## 2. 时代系数与敌人完整名单

```text
萌芽期系数（相对 12 的基准值）：
hp ×0.60；speed ×0.60（飞艇/气球另设下限）；turn ×0.90；damage ×0.55；
xp/coins ×0.50；武器 damage ×0.60、range ×0.75、speed ×0.80。
```

### 2.1 空中

| id/名称 | role | hp/speed/turn（实际） | behavior | parts | 武器挂点 | 奖励 xp/coins | spawn |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `scout` 侦察双翼机 | recon | 24 / 3.8 / 72 | chase，18–24，warning .7 | core+双翼 | nose→ww1_sync_mg | 9 / 1 | intro+ |
| `hunter` 巡逻双翼机 | fighter | 39 / 4.5 / 81 | chase，12–20，break .35 | core+双翼 | nose→ww1_twin_mg | 13 / 2 | intro+ |
| `recon_balloon` 侦察气球 | recon | 27 / 0.5 / 18 | patrol 缓慢漂移 | core+囊体+吊舱 | 无（雷达预警） | 12 / 3 | skirmish+ |

### 2.2 地面

| id/名称 | role | hp/speed | route | 武器 | 奖励 | 说明 |
| --- | --- | ---: | --- | --- | --- | --- |
| `resource` 补给马车 | convoy | 60 / 2.0 | road | 无 | 35 / 9 | 车队 2–3 辆 |
| `depot` 弹药/燃料堆 | static | 144 / 0 | 无 | 无 | 50 / 5 | 静态建筑目标，可保留 |
| `mobile_artillery` 早期火炮车 | value | 84 / 0.9 | road | top→howitzer | 50 / 7 | 移动炮击，非固定炮台 |
| `supply_train` 补给列车（二期） | value | 160 / 0.9 | rail | tail→aa_autocannon | 90 / 15 | 铁路路线 |

## 3. 武器完整配置（本时代可用）

| id | 类型/弹种 | 挂点/目标 | damage | rate | speed | range | count/arc | 特殊 |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| `ww1_sync_mg` | directional/bullet | nose/air | 3.0 | 9 | 19 | 16 | 1/20 | 机头固定，无同步限制 |
| `ww1_wing_gun` | directional/bullet | wing/air | 3.0 | 8 | 19 | 17 | 1/22 | spread 2 |
| `ww1_twin_mg` | directional/bullet | nose/air | 4.2 | 8 | 19 | 17 | 2/22 | 双联 |
| `ww1_light_bomb` | area/bomb | bottom/ground | 48 | 0.25 | — | — | — | explosion 3.5 |
| `aa_autocannon` | turret/flak | turret/air | 6.0 | 6 | 26 | 30 | 1/270 | 对空 |
| `howitzer` | area/shell | top/ground | 54 | 0.5 | 30 | 50 | — | explosion 5，炮击圈 |
| `gravity_bomb` | area/bomb（简化版） | bottom/ground | 72 | 0.25 | — | — | — | explosion 4.5，教学用 |

> 表中系数已应用：damage ×0.6、range ×0.75、speed ×0.8。无雷达/导弹/火箭/鱼雷。

## 4. 地面、水面与刷新

- 地面单位：补给马车（road，2 辆一组）、弹药/燃料堆（static，事件投放）、早期火炮车（road）、补给列车（rail，二期）。
- 水面：萌芽期不做独立水面单位；`isWater` 区域仅影响地形与后续水上飞机。
- 刷新权重（02/06 导演）：
  - `intro`（0–30s）：scout_line 3、resource_run 2；
  - `skirmish`（30–90s）：hunter_v 3、resource_run 1.5、artillery 1；
  - 无精英（90s 后也不出飞艇 Boss，改为 moth 玩家/友军视觉）。
- 上限沿用 D3：空中 8（本时代预算 4）、地面 6、活动 ≤14。

## 5. 升级与部件适配

| family | 本时代可用 | 说明 |
| --- | --- | --- |
| wing | `giant_wing`、`upper_wing_deck`（二期） | 萌芽期双翼/三翼，叠翼收益高但低速 |
| engine | `left_engine`、`right_engine`、`dual_engine` | 单发/双发；喷气发动机不可用 |
| weapon | `left_gun`、`right_gun`、`ammo`、`turret_pod` | 机炮/机枪/轻炸弹；导弹/火箭不可用 |
| structure | `heavy_armor`、`tail_armor`、`armor_belt` | 结构/生命 |
| utility | `cooler`、`fuel_tank` | 能量/航程 |
| 禁用 | 雷达、锁定导弹、喷气发动机、火箭巢、鱼雷 | 时代不符 |

- **利维坦流**：萌芽期轻机多，`headroom 0.35–0.50`，只适合小规模叠装；`moth_07` 飞艇例外（可叠发动机/炮塔但极慢）。
- 部件/命中：全部走 11 的 `mounts/baseParts` 与 03 的 PartRecipe；气球/飞艇用 `PartRole.float/engine/turret`。

## 6. 校验与验收

- 数据：4 架机体字段完整、`sum(maxSlots) ≤ hardpoints`、refit 在范围；3 种空中敌人 + 4 种地面/水面（含二期）至少各 1 个弱点部件。
- 战斗：玩家 5.6–9.0 速度下能追上 3.8–4.5 的敌机；无雷达/导弹时锁定 UI 不出现（05 的锁定环隐藏或替换为目视标记）。
- 时代感：所有机体为双翼/单翼/飞艇，无喷气尾焰；武器只有机枪/轻炸弹/早期炮。
- 平衡：单局 3 分钟可完成 1 次升级；叠 2 层机翼后仍能维持巡航速度（不失控）。

## 7. 待确认

| # | 问题 | 推荐 | 备选 |
| --- | --- | --- | --- |
| 1 | 萌芽期是否允许“无武器”历史真实（玩家需要武器） | 采用架空“早期机枪/轻炸弹” | 严格历史会让玩法不成立 |
| 2 | `moth_07` 飞艇作为玩家机体的操作难度 | 保留，低速高血量，仅适合平台玩法 | 降为 NPC/奖励机体 |
| 3 | 时代系数（0.6）是否过低 | 基线可调；真机确认后再固定 | 提高会让后时代机体失去优势 |
