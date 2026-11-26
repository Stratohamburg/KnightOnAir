# 14 · 一战完整配置（WW1, 1914–1918）

> 状态：提案（未实施）。分时代配置补全第 2 份；schema 见 [11](11-airframe-config-and-refit.md)/[12](12-enemy-weapon-config.md)，时代外观见 [08](08-q-art-and-era-progression.md)。
> 关键：双翼/三翼、浮筒水上飞机、大型飞艇、多翼多发大型机的自然叠装（利维坦流）；无雷达/喷气。

## 0. 时代定位

- 关卡主题：堑壕天空 / 索姆河上空；低空堑壕、铁路、车队、飞艇。
- 关键词：双翼/三翼格斗、浮筒起降、飞艇护航、第一次多翼多发重型平台。
- 玩家净空 +20；空战 ±4；水面单位出现（06 水面）。

## 0.5 设计口径与改动清单（文件级）

- **设计口径**：本时代不新增系统；机体/敌人/武器全部按 11/12 的 schema 填入本文件表；数值 = schema 基准 × 本文件 §2 的时代系数，特殊单位在表中给覆盖值。
- **改动清单**：`src/data/aircrafts.ts`（本时代机体条目）、`src/data/enemies.ts`（本时代敌人/地面/水面）、`src/data/weapons.ts`（本时代武器）、`World/Renderer` 只读 `era/mounts/behavior/route` 字段；时代筛选由 08 的 `era` 与 00 的关卡主题驱动。
- **测试**：本时代数据校验（字段/挂点/目标层/时代枚举）、战斗 smoke（3–5 分钟）、时代过滤（其他时代条目不得出现在本关卡）、性能预算（D10）。
- **实现任务**：T1 本时代数据条目 → T2 字段接入（11/12 schema）→ T3 时代过滤与外观 → T4 平衡与验收；通用任务拆分见 11/12，本文件只负责“这个时代填哪些值”。

## 1. 机体完整配置（6 架）

| 字段 | kestrel_08 | heron_09 | condor_10 | pelican_11 | leviathan_12 | atlas_18（二期） |
| --- | --- | --- | --- | --- | --- | --- |
| 名称/role | KESTREL-08 双翼战斗机 / fighter | HERON-09 三翼格斗机 / fighter | CONDOR-10 双发轰炸机 / bomber | PELICAN-11 浮筒水上机 / seaplane | LEVIATHAN-12 大型飞艇 / airship | ATLAS-18 四发重型轰炸机 / heavyBomber |
| wing/engine/prop | 2 / 1 / 1 | 3 / 1 / 1 | 2 / 2 / 2 | 2 / 1 / 1 | 1 / 4 / 4 | 2 / 4 / 4 |
| cockpit/gear/layout | 1 / tailwheel / tractor | 1 / tailwheel / tractor | 2 / tailwheel / nacelle | 1 / float / tractor | 1 / none / nacelle | 2 / tailwheel / nacelle |
| 特殊 flags | — | — | — | isFloatplane=true | isAirship=true | isLargeBomber=true |
| mass/area/span/length | 1500/20/9.5/6.8 | 1300/18/8.8/6.0 | 4200/45/15/11 | 2600/30/12/9 | 9000/150/26/30 | 6500/65/18/14 |
| maxSpeed/cruise/accel/turn | 9.6/4.0/6.5/250 | 8.4/3.6/7.0/280 | 7.4/3.0/4.2/150 | 8.2/3.4/5.5/210 | 2.9/1.8/1.8/55 | 5.8/2.8/3.2/90 |
| health/energy/hardpoints | 105/90/6 | 90/85/5 | 200/140/10 | 130/110/7 | 380/220/16 | 300/180/14 |
| 默认武器 | nose→ww1_twin_mg | nose→ww1_twin_mg | nose→机枪+top→aa_autocannon | nose→ww1_sync_mg；bottom→ww2_torpedo（早期型） | top×2→aa_autocannon；bottom→ww1_light_bomb | nose→机枪+top×2→aa_autocannon；bottom→ww2_medium_bomb |
| refit（win/eng/wpn/head/pen/pot） | 0.95/1.00/0.95/0.55/1.05/3 | 0.90/0.95/0.90/0.50/1.10/2 | 1.10/1.10/1.05/0.85/0.85/4 | 0.95/0.95/0.95/0.60/1.05/3 | 1.20/1.25/1.15/1.00/0.70/5 | 1.15/1.15/1.10/0.95/0.75/5 |
| unlockScore | 1100 | 1400 | 1700 | 2000 | 2600 | 2900（二期） |

## 2. 时代系数与敌人完整名单

```text
一战系数：hp ×0.80；speed ×0.85；turn ×0.95；damage ×0.80；xp/coins ×0.80；
武器 damage ×0.80、range ×0.90、speed ×0.90。飞艇/大型机速度下限另外覆盖。
```

### 2.1 空中（7）

| id/名称 | role | hp/speed/turn（实际） | behavior | parts | 武器 | 奖励 | spawn |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `scout` 侦察双翼机 | recon | 32 / 5.4 / 76 | chase，18–24 | core+双翼 | nose→ww1_sync_mg | 14 / 2 | intro |
| `hunter` 双翼战斗机 | fighter | 52 / 6.4 / 86 | chase，12–20 | core+双翼 | nose→ww1_twin_mg | 20 / 2 | 全期 |
| `bomber` 双发轰炸机 | bomber | 104 / 4.1 / 33 | crossing 直飞 | core+双翼+2 引擎+尾+弹舱 | nose→机枪+top→aa_autocannon | 44 / 5 | skirmish+ |
| `escort` 护卫机 | escort | 36 / 5.8 / 81 | escort 跟随飞艇 | core+双翼 | wing→ww1_wing_gun | 22 / 2 | pressure+ |
| `striker` 俯冲攻击机 | dive | 64 / 5.8 / 57 | dive 周期性俯冲 | core+双翼+引擎 | nose→ww1_twin_mg | 32 / 3 | skirmish+ |
| `recon_balloon` 侦察气球 | recon | 36 / 0.5 / 19 | patrol | core+囊体+吊舱 | 无（预警） | 19 / 5 | 全期 |
| `elite` 大型飞艇 | elite | 520 / 2.7 / 19 | standoff 环形弹幕 | core+侧舷+4 引擎+尾舵+2 炮塔 | turret×2→aa_autocannon | 176 / 19 | 90s+ |

### 2.2 地面/水面（6）

| id/名称 | layer/role | hp/speed | route | 武器 | 奖励 | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| `resource` 补给车队 | ground/convoy | 80 / 3.2 | road | 无 | 56 / 14 | 2–3 辆 |
| `supply_train` 补给列车 | ground/value | 256 / 1.2 | rail | tail→aa_autocannon | 144 / 24 | 3 节 |
| `armored_train` 装甲列车 | ground/value | 320 / 1.6 | rail | top→howitzer | 208 / 32 | 3 节，每节独立部件 |
| `mobile_artillery` 自行火炮 | ground/value | 112 / 1.4 | road | top→howitzer | 80 / 11 | 移动炮击 |
| `seaplane_patrol` 水上巡逻机 | water/patrol | 96 / 5.4 / turn 62 | water | nose→机枪 + bottom 深弹 | 48 / 6 | 沿水路 |
| `patrol_boat` 巡逻艇 | water/patrol | 144 / 1.9 | water | bow→aa_autocannon | 96 / 13 | 水面火力 |

## 3. 武器完整配置（本时代可用）

| id | 类型/弹种 | 挂点/目标 | damage | rate | speed | range | count/arc | 特殊 |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| `ww1_sync_mg` | directional/bullet | nose/air | 4.0 | 9 | 22 | 20 | 1/20 | 机头 |
| `ww1_twin_mg` | directional/bullet | nose/air | 5.6 | 8 | 22 | 20 | 2/22 | 双联 |
| `ww1_wing_gun` | directional/bullet | wing/air | 4.0 | 8 | 22 | 21 | 1/22 | spread 2 |
| `ww1_light_bomb` | area/bomb | bottom/ground | 64 | 0.25 | — | — | — | explosion 3.5 |
| `gravity_bomb` | area/bomb | bottom/ground | 96 | 0.25 | — | — | — | explosion 4.5 |
| `ww2_medium_bomb`（早期型） | area/bomb | bottom/ground | 144 | — | — | — | — | explosion 6；仅重型机 |
| `ww2_torpedo`（早期型） | area/torpedo | bottom/water+ground | 192 | — | — | — | — | 仅水上机 |
| `aa_autocannon` | turret/flak | turret/air | 8.0 | 6 | 27 | 30 | 1/270 | 对空 |
| `howitzer` | area/shell | top/ground | 72 | 0.5 | 32 | 50 | — | 炮击圈 |
| `naval_gun`（早期型） | turret/shell | deck/ground+air | 56 | 0.6 | 36 | 46 | 1/180 | 舰艇 |
| `top_turret` | turret/bullet | top/air | 5.6 | 4.5 | 22 | 21 | 1/270 | 飞艇/大型机 |

## 4. 地面、水面与刷新

- 地面：公路车队（resource）、铁路补给/装甲列车、移动火炮、静态弹药库（depot 保留）。
- 水面：河流/海岸线，巡逻艇（water）、水上巡逻机（water/air 混合）；水面起降由 08/06 二期实现，一期只做贴水视觉。
- 刷新权重：
  - intro：scout_line 3、resource_run 2；
  - skirmish：hunter_v 3、striker_pair 2、resource/armored_train 1.5；
  - pressure+：bomber_escort 2、elite_guard 事件（飞艇+2 护航）、train 1.5；
  - 上限：空中预算 6、地面 6（D3）。

## 5. 升级与部件适配

| family | 本时代可用 | 说明 |
| --- | --- | --- |
| wing | `giant_wing`、`upper_wing_deck` | 双翼/三翼，叠翼 + 多发是利维坦流主力 |
| engine | `left_engine`、`right_engine`、`dual_engine`、`engine_bank` | 多发动机短舱；喷气不可用 |
| weapon | `left_gun`、`right_gun`、`ammo`、`rocket`（早期无制导）、`turret_pod` | 机枪/机炮/轻炸弹；锁定导弹不可用 |
| structure | `heavy_armor`、`tail_armor`、`armor_belt`、`structural_brace` | 大型机结构 |
| utility | `cooler`、`fuel_tank` | 能量/航程 |
| 禁用 | 雷达、锁定导弹、喷气发动机、现代火箭巢 | 时代不符 |

- 利维坦流：`condor_10 / atlas_18 / leviathan_12` 的 headroom 高（0.85–1.0），叠翼/叠发动机收益最大；`heron_09` 轻三翼（0.50）只适合小规模混装。
- 部件：多翼层 `wingDeck`、多发动机短舱、飞艇气囊/吊舱按 03/11 的 PartRecipe；大型机命中区随翼展扩展。

## 6. 校验与验收

- 6 架机体字段完整、挂点预算合法、`refit` 在范围；飞艇/水上机 flags 正确。
- 敌我识别：双翼/三翼/飞艇轮廓不混淆；大型机有独立部件（引擎/翼/炮塔）。
- 平衡：elite 飞艇 90s 出现且可击毁；三翼机对双翼机有转向优势但速度劣势；多翼叠装后速度/滚转明显下降。
- 水面：巡逻艇/水上巡逻机沿水路移动，无固定炮台。

## 7. 待确认

| # | 问题 | 推荐 | 备选 |
| --- | --- | --- | --- |
| 1 | 一战是否允许“多翼多发”玩家机（atlas_18） | 二期上线；一期通过通用叠装达到类似形态 | 一期直接上会拉长内容/平衡 |
| 2 | 飞艇玩家机体的操作难度 | 保留为低速平台，专用相机拉远 | 降为精英敌人/奖励 |
| 3 | 早期型鱼雷/中型炸弹的时代归属 | 一战末允许 | 严格按 1918 后解锁，会少一条海战路线 |
