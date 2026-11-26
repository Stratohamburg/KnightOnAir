# 16 · 初代喷气完整配置（Early Jet, 1945–1955）

> 状态：提案（未实施）。分时代配置补全第 4 份；schema 见 [11](11-airframe-config-and-refit.md)/[12](12-enemy-weapon-config.md)，时代外观见 [08](08-q-art-and-era-progression.md)。
> 关键：现有 Swift/Courier/Mastodon/Wasp 归入本时代；喷气、雷达、空空导弹、早期防空导弹车；无更晚代的隐身/无人机。

## 0. 时代定位

- 关卡主题：翡翠海岸（现有）/ 铁幕巡航；喷气截击、导弹实验、防空网。
- 关键词：后掠翼/喷口、雷达/锁定、早期空空导弹、喷气轰炸机、导弹车。
- 玩家净空 +20；空战 ±4；轰炸长焦 FOV 34；云层 +14/28/42。

## 0.5 设计口径与改动清单（文件级）

- **设计口径**：本时代不新增系统；机体/敌人/武器全部按 11/12 的 schema 填入本文件表；数值 = schema 基准 × 本文件 §2 的时代系数，特殊单位在表中给覆盖值。
- **改动清单**：`src/data/aircrafts.ts`（本时代机体条目）、`src/data/enemies.ts`（本时代敌人/地面/水面）、`src/data/weapons.ts`（本时代武器）、`World/Renderer` 只读 `era/mounts/behavior/route` 字段；时代筛选由 08 的 `era` 与 00 的关卡主题驱动。
- **测试**：本时代数据校验（字段/挂点/目标层/时代枚举）、战斗 smoke（3–5 分钟）、时代过滤（其他时代条目不得出现在本关卡）、性能预算（D10）。
- **实现任务**：T1 本时代数据条目 → T2 字段接入（11/12 schema）→ T3 时代过滤与外观 → T4 平衡与验收；通用任务拆分见 11/12，本文件只负责“这个时代填哪些值”。

## 1. 机体完整配置（6 架）

| 字段 | swift_01 | courier_02 | mastodon_03 | wasp_04 | comet_21（二期） | manta_22（二期） |
| --- | --- | --- | --- | --- | --- | --- |
| 名称/role | SWIFT-01 截击机 / interceptor | COURIER-02 攻击机 / attack | MASTODON-03 重型武装机 / heavyBomber | WASP-04 轻量侦击机 / interceptor | COMET-21 夜间截击机 / interceptor | MANTA-22 喷气飞行艇 / flyingBoat |
| wing/engine/prop | 1/1/0 | 1/2/0 | 1/4/0 | 1/1/0 | 1/2/0 | 1/2/0 |
| 特殊 flags | — | — | — | — | — | isFlyingBoat |
| mass/area/span/length | 1800/17/6.2/4.8 | 4500/30/8.6/6.4 | 14500/72/13.4/8.8 | 950/11/4.9/4.1 | 3400/24/9.5/7.5 | 6000/40/14/11 |
| max/cruise/accel/turn | 13.5/5.0/9.5/285 | 10.5/4.2/7.5/225 | 8.2/3.6/4.8/145 | 15.5/5.8/11.5/305 | 14.5/6.0/10.0/260 | 10.5/5.0/6.0/140 |
| health/energy/hp（挂点） | 100/85/6 | 145/110/10 | 230/135/16 | 75/75/5 | 130/120/8 | 240/140/12 |
| 默认武器 | nose→nose_cannon_pair；bottom→gravity_bomb | 两翼→wing_machinegun_pair；bottom→gravity_bomb | nose→heavy_machinegun_quad + top→top_turret；bottom→heavy_bomb | nose→light_cannon；bottom→gravity_bomb | nose→jet_autocannon + wing→jet_air_missile | nose→jet_autocannon + wing→jet_rocket_pod |
| refit（win/eng/wpn/head/pen/pot） | 0.90/1.00/0.95/0.55/1.10/3 | 1.05/1.05/1.00/0.70/0.90/4 | 1.15/1.12/1.10/0.90/0.75/5 | 0.75/0.85/0.80/0.40/1.25/1 | 0.95/1.00/0.95/0.55/1.05/3 | 1.05/1.08/1.05/0.78/0.92/4 |
| unlockScore | 6000 | 6800 | 7600 | 8600 | 6200（二期） | 6500（二期） |

## 2. 时代系数与敌人完整名单

```text
喷气系数：hp ×1.00；speed ×1.00；turn ×1.00；damage ×1.00；xp/coins ×1.00；
武器数值按 12/16 原值（本时代为基准）。
```

### 2.1 空中（9）

| id/名称 | role | hp/speed/turn（实际） | behavior | parts | 武器 | 奖励 | spawn |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `hunter` 喷气战斗机 | fighter | 65 / 7.5 / 90 | chase，12–20 | core+双翼 | nose→jet_autocannon | 25 / 3 | 全期 |
| `interceptor` 高速截击机 | interceptor | 70 / 8.8 / 110 | chase，14–18，break .55 | core+双翼 | nose→jet_autocannon | 32 / 4 | skirmish+ |
| `striker` 俯冲攻击机 | dive | 80 / 6.8 / 60 | dive | core+双翼+引擎 | nose→jet_autocannon | 40 / 4 | skirmish+ |
| `bomber` 喷气轰炸机 | bomber | 130 / 4.8 / 35 | crossing 直飞 | core+双翼+2 引擎+弹舱 | nose→jet_autocannon + bottom→gravity_bomb | 55 / 6 | pressure+ |
| `jet_bomber` 高速掠袭机 | bomber | 260 / 10.5 / 55 | crossing 高速 | core+单翼+2 引擎+弹舱 | nose→jet_autocannon + bottom→heavy_bomb | 150 / 18 | pressure+ |
| `escort` 护卫无人机 | escort | 45 / 6.8 / 85 | escort | core+双翼 | wing→wing_turret | 28 / 3 | pressure+ |
| `ace` 王牌飞行员 | elite fighter | 220 / 9.0 / 105 | chase + 机动 | core+双翼+引擎+尾 | nose→jet_heavy_cannon | 180 / 20 | 90s+ |
| `elite` 空中堡垒 | elite | 650 / 3.2 / 20 | standoff 环形弹幕 | core+双翼+4 引擎+尾+2 炮塔 | turret×2→jet_autocannon | 220 / 24 | 90s+ |
| `heavy_fighter` 喷气重战 | heavyFighter | 160 / 7.0 / 70 | chase，20–25 | core+双翼+2 引擎+尾 | nose→jet_heavy_cannon + wing→机枪 | 70 / 8 | pressure+ |

### 2.2 地面/水面（7）

| id/名称 | layer/role | hp/speed | route | 武器 | 奖励 | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| `missile_truck` 防空导弹车 | ground/value | 120 / 1.7 | road | top→jet_air_missile | 50 / 6 | 追踪弹，移动 |
| `aa_truck` 移动防空车 | ground/value | 110 / 1.5 | road | turret→aa_autocannon | 55 / 8 | 高射速 |
| `radar_truck` 雷达车 | ground/support | 90 / 2.0 | road | 无（雷达/增援） | 70 / 12 | 召唤受 02 上限 |
| `fuel_truck` 燃料车 | ground/convoy | 80 / 1.5 | road | 无（爆炸） | 90 / 14 | 连锁爆炸 |
| `mobile_artillery` 自行火炮 | ground/value | 140 / 1.6 | road | top→howitzer | 100 / 14 | 炮击圈 |
| `patrol_boat` 巡逻艇 | water/patrol | 180 / 2.2 | water | bow→naval_gun | 120 / 16 | 水面 |
| `landing_ship` 登陆舰 | water/value | 420 / 1.0 | water | deck→naval_gun | 260 / 40 | 大型目标 |

## 3. 武器完整配置（本时代可用）

| id | 类型/弹种 | 挂点/目标 | damage | rate | speed | range | count/arc | 特殊 |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| `light_cannon` | directional/bullet | nose/wing/air | 6 | 8 | 24 | 24 | 1/20 | — |
| `nose_cannon_pair` | directional/shell | nose/air | 11 | 4 | 28 | 28 | 2/22 | spread 1.5 |
| `wing_machinegun_pair` | directional/bullet | wing/air | 8 | 5 | 22 | 22 | 2/26 | spread 2.5 |
| `heavy_machinegun_quad` | directional/bullet | nose/wing/air | 9 | 7 | 25 | 27 | 4/28 | pierce 1 |
| `jet_autocannon` | directional/shell | nose/wing/air | 16 | 7 | 34 | 30 | 1/20 | armorPierce .35 |
| `jet_heavy_cannon` | directional/shell | nose/air | 40 | 1.8 | 36 | 32 | 1/18 | armorPierce .5 |
| `top_turret` | turret/bullet | top/turret/air | 7 | 4.5 | 21 | 21 | 1/270 | — |
| `wing_turret` | turret/shell | wing/turret/air | 10 | 3.2 | 23 | 24 | 1/180 | pierce 1 |
| `rocket_pod` | directional/rocket | wing/air+ground | 24 | 0.8 | 15 | 30 | 4/18 | explosion 2.2 |
| `jet_rocket_pod` | directional/rocket | wing/air+ground | 28 | 0.8 | 16 | 30 | 8/18 | explosion 2.4 |
| `lock_missile` | lock/missile | wing/turret/air | 75 | 0.5 | 12 | 40 | 1/18 | lock 1.2，homing 150 |
| `jet_air_missile` | lock/missile | wing/air | 85 | 0.5 | 14 | 42 | 1/18 | lock 1.0，homing 170 |
| `gravity_bomb` | area/bomb | bottom/ground | 120 | 0.25 | — | — | — | explosion 4.5 |
| `heavy_bomb` | area/bomb | bottom/ground | 220 | 1/7 | — | — | — | explosion 7.5 |
| `napalm_bomb` | area/bomb/incendiary | bottom/ground | 45 | 0.125 | — | — | — | duration 5，burn 28 |
| `flak_88` | area/flak | top/air | 45 | 0.8 | 30 | 40 | — | explosion 3.5 |
| `aa_autocannon` | turret/flak | turret/air | 10 | 6 | 30 | 30 | 1/270 | 对空 |
| `naval_gun` | turret/shell | deck/ground+air | 70 | 0.6 | 40 | 46 | 1/180 | 舰炮 |
| `howitzer` | area/shell | top/ground | 90 | 0.5 | 36 | 50 | — | 炮击圈 |

## 4. 地面、水面与刷新

- 地面：导弹车/移动防空车/雷达车/燃料车/自行火炮；无固定炮台；补给列车可选（铁路）。
- 水面：巡逻艇、登陆舰；未来可加导弹艇（二期）。
- 刷新权重：
  - intro：scout_line 3、resource_run 2；
  - skirmish：hunter_v 3、striker_pair 2、vehicle_patrol 2；
  - pressure：interceptor/hunter 编队、missile_truck 2、radar_truck 支援；
  - mixed：jet_bomber 掠袭、elite 空中堡垒+护航、ace 编队；
  - 上限：空中 8、地面 6、active 14。

## 5. 升级与部件适配

| family | 本时代可用 | 说明 |
| --- | --- | --- |
| wing | `giant_wing`、`upper_wing_deck`、`heavy_hardpoint` | 大型机叠翼 |
| engine | `left_engine`、`right_engine`、`dual_engine`、`engine_bank` | 多发短舱 |
| weapon | `left_gun`、`right_gun`、`rocket`、`ammo`、`turret_pod`、`radar` | 喷气机炮/导弹/炮塔 |
| structure | `heavy_armor`、`tail_armor`、`armor_belt`、`structural_brace` | 结构 |
| utility | `cooler`、`fuel_tank` | 能量/航程 |
| 禁用 | 更晚代隐身/无人机/超视距 | 时代边界 |

- 利维坦流：`mastodon_03`（potential 5）与 `manta_22`（4）适合；`wasp_04` 最不适合（1）。叠装后投弹坡度自动收紧（09），相机按 10 拉远。
- 部件：喷气发动机、雷达、导弹挂架走 mounts + PartRecipe；导弹/雷达为可损坏部件（03）。

## 6. 校验与验收

- 6 架机体字段完整；喷气构型/导弹/雷达挂点合法；无螺旋桨。
- 敌我识别：喷气机剪影、导弹车/雷达车、空中堡垒不混淆；精英有独立炮塔/引擎部件。
- 平衡：导弹车对空威胁高但可被轰炸；喷气轰炸机高速掠袭需要拦截；锁定导弹不越 05 的 UI/告警规则。
- 性能：现有 4 架 + 新增部件的绘制调用/三角形在 D10 预算内。

## 7. 待确认

| # | 问题 | 推荐 | 备选 |
| --- | --- | --- | --- |
| 1 | 现有四架解锁分重排（08） | 按 08 一期方案 | 保留旧阈值会打乱时代顺序 |
| 2 | 是否加更晚代喷气/导弹 | 本作止于初代喷气 | 后续 DLC 再扩 |
| 3 | 导弹车/雷达车是否算“炮台” | 否，移动车辆，沿路线 | 若要求完全无地面火力，会削弱对地威胁 |
