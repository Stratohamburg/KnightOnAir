# 15 · 二战完整配置（WW2, 1939–1945）

> 状态：提案（未实施）。分时代配置补全第 3 份；schema 见 [11](11-airframe-config-and-refit.md)/[12](12-enemy-weapon-config.md)，时代外观见 [08](08-q-art-and-era-progression.md)。
> 关键：单翼、双发重型战斗机、四发大型轰炸机、浮筒/飞行艇、雷达、火箭/鱼雷；利维坦流的最优时代。

## 0. 时代定位

- 关卡主题：铁翼海峡 / 北海护航；大规模编队、护航、舰队防空。
- 关键词：单翼高速、重火力、鱼雷/火箭、雷达车/列车、四发重轰。
- 玩家净空 +20；轰炸镜头 FOV 34；云层 +14/28/42（10）。

## 0.5 设计口径与改动清单（文件级）

- **设计口径**：本时代不新增系统；机体/敌人/武器全部按 11/12 的 schema 填入本文件表；数值 = schema 基准 × 本文件 §2 的时代系数，特殊单位在表中给覆盖值。
- **改动清单**：`src/data/aircrafts.ts`（本时代机体条目）、`src/data/enemies.ts`（本时代敌人/地面/水面）、`src/data/weapons.ts`（本时代武器）、`World/Renderer` 只读 `era/mounts/behavior/route` 字段；时代筛选由 08 的 `era` 与 00 的关卡主题驱动。
- **测试**：本时代数据校验（字段/挂点/目标层/时代枚举）、战斗 smoke（3–5 分钟）、时代过滤（其他时代条目不得出现在本关卡）、性能预算（D10）。
- **实现任务**：T1 本时代数据条目 → T2 字段接入（11/12 schema）→ T3 时代过滤与外观 → T4 平衡与验收；通用任务拆分见 11/12，本文件只负责“这个时代填哪些值”。

## 1. 机体完整配置（7 架）

| 字段 | falcon_13 | raptor_14 | albatross_15 | stingray_16 | behemoth_17 | vulture_19（二期） | tempest_20（二期） |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 名称/role | FALCON-13 单翼战斗机 / fighter | RAPTOR-14 双发重战 / heavyFighter | ALBATROSS-15 浮筒水上机 / seaplane | STINGRAY-16 飞行艇 / flyingBoat | BEHEMOTH-17 四发重轰 / heavyBomber | VULTURE-19 鱼雷机 / attack | TEMPEST-20 双发重战 / heavyFighter |
| wing/engine/prop | 1/1/1 | 1/2/2 | 1/1/1 | 1/2/2 | 1/4/4 | 1/2/2 | 1/2/2 |
| 特殊 flags | — | isHeavyFighter | isFloatplane | isFlyingBoat | isLargeBomber | — | isHeavyFighter |
| mass/area/span/length | 2600/22/11/8.5 | 4800/32/13/10.5 | 3400/34/13/10 | 5200/42/15/12 | 9500/85/22/17 | 3800/28/12/9.5 | 5200/34/13/10.8 |
| max/cruise/accel/turn | 13.5/5.0/8.5/275 | 11.6/4.6/6.5/200 | 10.2/4.2/6.0/205 | 8.6/3.8/4.6/145 | 7.2/3.4/3.6/110 | 9.8/4.4/6.8/170 | 10.8/5.0/7.0/150 |
| health/energy/hp（挂点） | 120/110/8 | 210/130/12 | 150/120/8 | 260/140/10 | 340/180/18 | 170/120/10 | 210/130/12 |
| 默认武器 | nose→ww2_autocannon | nose→ww2_heavy_cannon + wing→机枪 | nose→机枪 + bottom→ww2_torpedo | nose→机枪 + wing→火箭 | nose→机枪 + top×2→aa_autocannon + bottom→重弹 | nose→机枪 + bottom→ww2_torpedo | nose→ww2_heavy_cannon + wing→火箭 |
| refit（win/eng/wpn/head/pen/pot） | 1.00/1.00/1.00/0.60/1.00/3 | 1.08/1.08/1.05/0.72/0.90/4 | 0.95/0.95/0.95/0.60/1.05/3 | 1.05/1.08/1.05/0.78/0.92/4 | 1.15/1.15/1.10/0.95/0.75/5 | 1.00/1.05/1.00/0.62/1.00/3 | 1.08/1.08/1.05/0.72/0.90/4 |
| unlockScore | 3100 | 3600 | 4200 | 4800 | 5400 | 3300（二期） | 3800（二期） |

## 2. 时代系数与敌人完整名单

```text
二战系数：hp ×0.95；speed ×0.95；turn ×0.95；damage ×0.95；xp/coins ×0.95；
武器 damage ×0.95、range ×0.95、speed ×0.95。
```

### 2.1 空中（10）

| id/名称 | role | hp/speed/turn（实际） | behavior | parts | 武器 | 奖励 | spawn |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `hunter` 单翼战斗机 | fighter | 62 / 7.1 / 86 | chase，12–20 | core+双翼 | nose→ww2_autocannon | 24 / 3 | 全期 |
| `interceptor` 截击机 | interceptor | 66 / 8.4 / 105 | chase，14–18，break .55 | core+双翼 | nose→ww2_autocannon | 30 / 4 | skirmish+ |
| `heavy_fighter` 双发重战 | heavyFighter | 152 / 6.7 / 67 | chase，20–26，burst 2 | core+双翼+2 引擎+尾 | nose→ww2_heavy_cannon + wing→机枪 | 66 / 8 | pressure+ |
| `torpedo_bomber` 鱼雷机 | bomber | 142 / 4.9 / 43 | crossing 低空 | core+双翼+2 引擎+弹舱 | bottom→ww2_torpedo + nose 机枪 | 81 / 10 | pressure+ |
| `bomber` 四发轰炸机 | bomber | 124 / 4.6 / 33 | crossing 直飞 | core+双翼+4 引擎+尾+弹舱 | nose→机枪 + top→aa_autocannon | 52 / 6 | skirmish+ |
| `gunship` 炮艇机 | gunship | 209 / 4.0 / 33 | standoff 侧射 | core+双翼+2 引擎+侧翼 | side×2→ww2_autocannon | 105 / 13 | pressure+ |
| `escort` 护卫机 | escort | 43 / 6.5 / 81 | escort | core+双翼 | wing→ww2_autocannon | 27 / 3 | pressure+ |
| `striker` 俯冲攻击机 | dive | 76 / 6.5 / 57 | dive | core+双翼+引擎 | nose→ww2_autocannon | 38 / 4 | skirmish+ |
| `ace` 王牌飞行员 | elite fighter | 209 / 8.6 / 100 | chase + 机动 | core+双翼+引擎+尾 | nose→ww2_heavy_cannon | 171 / 19 | 90s+ |
| `elite` 重型轰炸机 | elite bomber | 650 / 3.1 / 19 | standoff 环形弹幕 | core+双翼+4 引擎+尾+2 炮塔 | turret×2→ww2_autocannon | 209 / 22 | 90s+ |

### 2.2 地面/水面（8）

| id/名称 | layer/role | hp/speed | route | 武器 | 奖励 | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| `aa_truck` 移动防空车 | ground/value | 105 / 1.5 | road | turret→aa_autocannon | 52 / 8 | 移动，非炮台 |
| `missile_truck` 导弹车 | ground/value | 114 / 1.7 | road | top→jet_air_missile（早期型） | 48 / 6 | 追踪弹 |
| `fuel_truck` 燃料车 | ground/convoy | 76 / 1.5 | road | 无（死亡爆炸） | 86 / 13 | 连锁爆炸 |
| `supply_train` 补给列车 | ground/value | 304 / 1.3 | rail | tail→aa_autocannon | 171 / 29 | 3 节 |
| `armored_train` 装甲列车 | ground/value | 380 / 1.8 | rail | top→naval_gun | 247 / 38 | 3 节 |
| `radar_truck` 雷达车 | ground/support | 86 / 1.9 | road | 无（雷达/增援） | 66 / 11 | 召唤增援受 02 上限 |
| `mobile_artillery` 自行火炮 | ground/value | 133 / 1.5 | road | top→howitzer | 95 / 13 | 炮击圈 |
| `patrol_boat` 巡逻艇 | water/patrol | 171 / 2.1 | water | bow→aa_autocannon | 114 / 15 | 水面 |
| `landing_ship` 登陆舰 | water/value | 399 / 1.0 | water | deck→naval_gun | 247 / 38 | 大型目标 |
| `seaplane_patrol` 水上巡逻机 | water/air patrol | 114 / 6.1 / 62 | water | nose→机枪 + bottom 深弹 | 57 / 8 | 贴水/滑行 |

## 3. 武器完整配置（本时代可用）

| id | 类型/弹种 | 挂点/目标 | damage | rate | speed | range | count/arc | 特殊 |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| `ww2_autocannon` | directional/shell | nose/wing/air | 13.3 | 5 | 28 | 26 | 1/20 | armorPierce .25 |
| `ww2_heavy_cannon` | directional/shell | nose/air | 28.5 | 2.2 | 30 | 28 | 1/18 | armorPierce .45 |
| `heavy_machinegun_quad` | directional/bullet | nose/wing/air | 8.6 | 7 | 23.8 | 25.7 | 4/28 | pierce 1 |
| `ww2_rocket_battery` | directional/rocket | wing/air+ground | 28.5 | 0.8 | 14.3 | 28.5 | 6/18 | explosion 2.6 |
| `rocket_pod` | directional/rocket | wing/air+ground | 22.8 | 0.8 | 14.3 | 28.5 | 4/18 | explosion 2.2 |
| `ww2_torpedo` | area/torpedo | bottom/water+ground | 228 | — | — | — | — | explosion 6 |
| `ww2_medium_bomb` | area/bomb | bottom/ground | 171 | — | — | — | — | explosion 6 |
| `heavy_bomb` | area/bomb | bottom/ground | 209 | 1/7 | — | — | — | explosion 7.5 |
| `ww2_incendiary` | area/bomb/incendiary | bottom/ground | 57 | — | — | — | — | duration 6，burn 30 |
| `napalm_bomb` | area/bomb/incendiary | bottom/ground | 42.8 | 0.125 | — | — | — | duration 5，burn 28 |
| `top_turret` | turret/bullet | top/turret/air | 6.7 | 4.5 | 20 | 20 | 1/270 | 对空 |
| `wing_turret` | turret/shell | wing/turret/air | 9.5 | 3.2 | 21.9 | 22.8 | 1/180 | pierce 1 |
| `flak_88` | area/flak | top/air | 42.8 | 0.8 | 30 | 40 | — | explosion 3.5，炮击圈 |
| `aa_autocannon` | turret/flak | turret/air | 9.5 | 6 | 30 | 30 | 1/270 | 对空 |
| `naval_gun` | turret/shell | deck/ground+air | 66.5 | 0.6 | 40 | 46 | 1/180 | 舰炮 |
| `howitzer` | area/shell | top/ground | 85.5 | 0.5 | 36 | 50 | — | 炮击圈 |
| `jet_air_missile`（早期型） | lock/missile | wing/turret/air | 80.8 | 0.5 | 19 | 36 | 1/18 | homing 140，仅导弹车/后期 |

## 4. 地面、水面与刷新

- 地面：公路防空车/导弹车/燃料车/雷达车/自行火炮；铁路补给/装甲列车；静态 depot（建筑目标）。
- 水面：巡逻艇、登陆舰、水上巡逻机；06 水面与 10 高度配合。
- 刷新权重：
  - intro：scout_line 3、resource_run 2；
  - skirmish：hunter_v 3、striker_pair 2、bomber_escort 1.5、vehicle_patrol 2；
  - pressure：heavy_fighter/gunship/ace 编队、radar_truck 支援、armored_train 1.5；
  - mixed：四发轰炸+护航、精英重轰+2 护航、舰队编队；
  - 上限：空中 8、地面 6、active 14。

## 5. 升级与部件适配

| family | 本时代可用 | 说明 |
| --- | --- | --- |
| wing | `giant_wing`、`upper_wing_deck`、`heavy_hardpoint` | 四发重轰/重战叠翼收益高 |
| engine | `left_engine`、`right_engine`、`dual_engine`、`engine_bank` | 多发短舱 |
| weapon | `left_gun`、`right_gun`、`rocket`、`ammo`、`turret_pod` | 机炮/火箭/鱼雷/炸弹 |
| structure | `heavy_armor`、`tail_armor`、`armor_belt`、`structural_brace` | 大型机结构 |
| utility | `cooler`、`fuel_tank` | 能量/航程 |
| 禁用 | 喷气发动机/雷达后期型；锁定导弹仅后期探索 | 时代边界可放宽到 1945 末 |

- 利维坦流：`behemoth_17`（headroom .95）与 `tempest_20`（.72）最适合；重型平台叠 4 发+多炮塔后投弹坡度自动收紧（09），需要 10 的相机拉远。
- 部件：四发/多炮塔/鱼雷挂点全部走 11 的 mounts + 03 的 PartRecipe；大型机雷达/尾炮塔为可损坏部件。

## 6. 校验与验收

- 7 架机体字段完整；双发/四发引擎部件数正确；浮筒/飞行艇标志正确；轰炸机炸弹舱可投鱼雷/重型炸弹。
- 敌我识别：单翼/双发/四发/浮筒/飞行艇剪影不混淆；精英重轰有独立炮塔部件。
- 平衡：四发重轰低速高血量但被截击机克制；鱼雷机对舰收益高；雷达车召唤增援不越 02 上限。
- 水面：巡逻艇/登陆舰沿水路移动，无固定炮台。

## 7. 待确认

| # | 问题 | 推荐 | 备选 |
| --- | --- | --- | --- |
| 1 | 二战是否允许雷达/早期导弹 | 雷达给雷达车；导弹只给导弹车（不可玩家用） | 给玩家会提前进入喷气时代体验 |
| 2 | 四发重轰是否玩家可驾驶 | 一期 `behemoth_17` 可；二期加 `atlas/behemoth` 变体 | 只做敌人 Boss |
| 3 | 水面舰艇是否可被玩家鱼雷击沉 | 是，需 06 水面 + 03 部件 | 只做视觉目标会削弱鱼雷机价值 |
