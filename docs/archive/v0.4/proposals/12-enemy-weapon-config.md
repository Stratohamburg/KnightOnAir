# 12 · 敌人与武器配置扩展

> 2026-11-20 架构修订：本文原有的 `EnemyConfigV2` 作为内容迁移参考保留。0.4 实施时采用 [统一战斗架构与实施路线](../migration-plan.md) 定义的 `CombatantConfig + NpcProfile` 配置 v3。物理、部件和挂载字段进入共享载体配置，行为、刷新和奖励进入 NPC 配置。本文的时代、武器和敌人名录需要按 v3 拆分后才可录入。

> 状态：提案（**未实施**，只描述配置/字段与内容表；不改现有实现/基线文档）
> 基线：0.3.0（`5b22187`）；现有 11 种敌人（含将删除的 `aa`/`emplacement`）、11 种武器。
> 关系：[02 刷新](02-enemy-spawn-and-separation.md) 用 `spawnRole/slotCost`；[03 部件](03-parts-and-damage-degradation.md) 用 `parts/ControlDamage`；[05 雷达/反馈](05-radar-alert-and-target-feedback.md) 用武器开火事件；[06 地面/水面](06-ground-routes-and-terrain.md) 用 `aa_truck/fuel_truck/armored_train/gunboat`；[08 时代/外观](08-q-art-and-era-progression.md) 用 `era/visual`。
> 本文是**敌人与武器的数据 schema + 现有配置扩展 + 新增内容表**；与 06/08 的已定义单位不重复，只补字段或标注“08/06 已定义”。
> **分时代完整配置**：13–16 按本文 schema 把每个时代的敌人/水面/武器/地面/升级/刷新填了一遍；本文给 schema 与新增条目，13–16 给全量取值。

## 1. 现状与缺口

### 1.1 `EnemyConfig` 只有 13 个扁平字段

```ts
// src/data/enemies.ts:1-15
interface EnemyConfig {
  id, name, layer, health, speed, turnRate, radius,
  damage, fireInterval, xp, coins, color, scale
}
```

- 没有 `era / role / spawnRole / slotCost / altitudeBand / behavior / parts / weapon mounts / drops / visual model`；所有敌人都用同一套“朝玩家转向→到点射击”逻辑，靠 `kind` 字符串在 `World.updateEnemies` 里写死特殊行为（`scout` 召唤、`bomber` 直飞、`escort` 跟随、`striker` 俯冲、`elite` 环形弹幕）。
- 没有“武器挂点”：敌人开火时统一用 `WEAPONS.light_cannon` 临时改 `damage/speed/range`（`World.ts:648-673`），无法表达“这架轰炸机机头机枪 + 机背炮塔 + 尾炮”的组合。
- 地面/水面单位没有速度路线/炮塔/静态标记字段，`depot/aa/emplacement` 只能靠 `speed=0` 区分。

### 1.2 `WeaponConfig` 缺少“装在哪、打什么、怎么命中部件”

现有字段偏弹道数值，缺：

- `mountKinds`（机头/翼/背/腹/尾/炮塔能否安装）；
- `targetLayers`（对空/对地/对水）；
- `projectileKind`（子弹/炮弹/火箭/导弹/防空炮/炸弹/鱼雷）；
- `damageType/armorPierce/falloff`（对装甲/部件/软目标）；
- `partPriority`（优先打翼/发动机/核心，供 03 的部件命中）；
- `era`（时代内容/外观）；
- `visual/audio`（曳光色、炮口焰、音效键）；
- `aiUse`（敌人是否可使用、瞄准噪声倍率）。

## 2. 目标设计：敌人配置 v2 schema

```ts
type EnemyLayer = "air" | "ground" | "water";
type EnemyRole = "recon"|"interceptor"|"fighter"|"heavyFighter"|"bomber"|"escort"|"dive"|"gunship"|"elite"|"convoy"|"value"|"static";
type SpawnRole = "pursuit"|"harass"|"heavy"|"support"|"value"|"static"|"convoy"|"interceptor"|"bomber";
type AiKind = "chase"|"patrol"|"intercept"|"crossing"|"strafe"|"escort"|"dive"|"convoy"|"standoff"|"static"|"flee";

interface EnemyBehavior {
  ai: AiKind;
  targetPolicy: "player"|"route"|"intercept"|"escort"|"groundTarget"|"none";
  preferredRange: [number, number];   // 保持/开火距离
  disengageRange: number;             // 超出即脱离/返航
  engageRadius: number;                // patrol/route 单位进入此范围才切换到攻击
  warning: number;                    // 开火前摇（05 事件用）
  fireInterval: [number, number];     // 两次攻击间隔
  burst: number;                      // 每次开火发数
  aimNoise: number;                   // 0–1，越大越不准
  leadTime: number;                   // 提前量秒数
  aggro: number;                      // 0–1，追击权重
  breakChance: number;                // 每次攻击后脱离概率
}

interface EnemyDefense {
  health: number;
  armor: number;                      // 0–1 减伤
  damageTransfer: number;             // 非核心部件 → 核心（03）
  parts: PartRecipe[];                // 03 的部件配方；空则默认 core+左右翼
  weakpoints: PartRole[];             // 高亮/额外伤害部件
}

interface EnemyWeaponMount {
  mount: "nose"|"wing"|"top"|"bottom"|"tail"|"turret"|"side";
  weaponId: string;                   // 12 的 WEAPONS
  count: number;
  arc: number;                        // 射界（度）
  aimAt: "player"|"lead"|"ground";
}

interface EnemyRewards { xp: number; coins: number; score: number; eliteBonus?: number; drops?: string[]; }
interface EnemyVisual { color: string; accent?: string; scale: number; modelKey: string; eraSkin: EraId; shadowScale?: number; }
interface EnemySpawn { phases: ("intro"|"skirmish"|"pressure"|"mixed")[]; minTime: number; weight: number; maxAlive: number; slotCost?: number; formation?: "line"|"v"|"orbit"|"escort"|"crossing"; }

interface EnemyConfigV2 {
  id: string; name: string; era: EraId; layer: EnemyLayer; role: EnemyRole; spawnRole: SpawnRole;
  radius: number;
  altBand?: [number, number];          // 空中单位相对玩家高度的偏移（10）
  behavior: EnemyBehavior;
  defense: EnemyDefense;
  offense: EnemyWeaponMount[];
  rewards: EnemyRewards;
  visual: EnemyVisual;
  spawn: EnemySpawn;
  route?: { kind: "road"|"rail"|"water"; speed: number; lane: number }; // 地面/水面（06）
}
```

### 2.0 v3 配置拆分与分层运动管线

实施时，`EnemyConfigV2` 的扁平结构只用于迁移检查。正式配置拆成共享载体和 NPC 行为两层。`CombatantConfig.frame` 按 `layer` 使用联合结构，空中字段与地面/水面字段分别校验。

```ts
type MotionConfig =
  | {
      model: "air";
      mass: number;
      length: number;
      wingspan: number;
      wingArea: number;
      maxSpeed: number;
      cruiseSpeed: number;
      acceleration: number;
      turnRate: number;
      energyMax: number;
      energyRecover: number;
    }
  | {
      model: "ground" | "water";
      mass: number;
      length: number;
      radius: number;
      maxSpeed: number;
      acceleration: number;
      turnRate: number;
      routeKinds: ("road" | "rail" | "water")[];
    };

interface CombatantConfig {
  id: string;
  layer: "air" | "ground" | "water";
  frame: MotionConfig;
  parts: PartRecipe[];
  mounts: EnemyWeaponMount[];
}
```

`model: "air"` 的载体由空中玩家控制器、空中 NPC 控制器或未来网络控制器生成意图，并进入同一个 `integrateAirActor`。`model: "ground"` 和 `model: "water"` 的载体由路线、车道或水路控制器生成意图，并进入各自移动积分器。三层都使用同一个部件命中、伤害传递、武器失效、弹道和事件管线。

`behavior.ai` 是敌人的目标策略，不是另一套物理系统。每个敌人每步按以下顺序运行：

```text
behavior → 目标点/目标方向/路线意图 → 分离、编队或车距修正（02）
         → 按 layer 进入空中飞行积分器或地面/水面移动积分器
         → 同一武器挂点与开火前摇 → 同一命中与伤害结算
```

| 行为 | 目标策略 | 典型职责 | 目标点规则 |
| --- | --- | --- | --- |
| `chase` | `player` | 追击机、普通战斗机 | 直接追玩家预测位置，进入 `preferredRange` 后攻击，超出 `disengageRange` 返航或重置攻击段。 |
| `patrol` | `route` | 侦察机、巡逻艇、巡逻车 | 沿路线或航点行驶。玩家进入 `engageRadius` 才转入攻击，离开后回到路线，不持续追出巡逻区。 |
| `intercept` | `intercept` | 截击机、拦截编队 | 根据玩家速度和 `leadTime` 计算交会点，切入玩家前方航线。通过交会点后重新计算，不直接贴着玩家转圈。 |
| `escort` | `escort` | 护航机、护航艇 | 以精英或指定长机为锚点保持槽位，只有脱离槽位或受到攻击时短暂拦截玩家。 |
| `crossing` / `strafe` | `player` 或 `route` | 横切攻击机、炮艇机 | 保持横向或侧射航线，攻击段结束后沿离场方向脱离。 |
| `dive` | `player` | 俯冲攻击机 | 先在攻击线外等待，再进入一次俯冲段，结束后强制拉开距离。 |
| `standoff` | `player` | 大型轰炸机、空中堡垒 | 保持远距离和指定方位，只在武器射界内开火。 |
| `convoy` | `route` | 资源车队、列车 | 沿道路、铁路或水路移动，优先保持车距和路线，不追玩家。 |
| `static` | `none` | 燃料设施、固定目标 | 不生成移动意图，只参与共享命中、部件损毁、武器和事件管线。 |
| `flee` | `route` 或 `player` | 受损或任务完成单位 | 沿离场点撤退。它仍使用当前层的移动积分器和共享损毁结果，只更换目标方向。 |

`patrol`、`intercept` 和 `chase` 的差异只存在于目标点或路线意图如何产生。空中行为必须经过 02 的分离、03 的部件损毁控制包线和同一 `integrateAirActor`。地面与水面行为经过各自路线积分器，但同样使用 03 的共享部件、伤害和武器结果。部件损毁后，行为策略不被替换为另一套伤害逻辑。比如拦截机失去一侧机翼仍执行 `intercept`，但由同一 `ControlDamage` 限制转弯和速度，无法完成交会时才按行为规则进入 `flee`。

### 2.1 改动清单（文件级）

| 文件 | 改动 |
| --- | --- |
| `src/data/enemies.ts` | `EnemyConfig` v2 字段、现有 9 种迁移、14 种新增、删除 `aa/emplacement` |
| `src/data/weapons.ts` | `WeaponConfig` v2 字段、现有 11 种迁移、18 种新增 |
| `src/simulation/World.ts` | 按 `offense` 挂点开火，替代 `light_cannon` 临时改参数；按 `behavior` 生成目标方向，再统一经过分离、损毁包线和运动更新 |
| `src/simulation/types.ts` | `Enemy` 读入 parts/behavior/route/altBand 字段 |
| `src/rendering/Renderer.ts` | 按 `visual.modelKey/eraSkin` 构建敌人外观 |
| `tests/enemy-weapon-config.test.ts` | 数据校验/挂点/目标层/时代覆盖断言 |

## 3. 现有敌人配置迁移（9 种，`aa`/`emplacement` 删除）

| id/era/role | layer | 关键 behavior | defense/parts | offense（挂点→武器） | rewards | spawn |
| --- | --- | --- | --- | --- | --- | --- |
| `scout` 侦察机 / ww1-jet / recon | air | chase；preferred 18–24；warning .7；burst 1；召唤：每架一次 | core+双翼（0.20H×2） | nose→`ww1_sync_mg`/`light_cannon` | 18/2/72 | pursuit，intro+ |
| `hunter` 追猎机 / ww1-jet / fighter | air | chase；12–20；breakChance .35 | core+双翼 | nose→`ww1_twin_mg`/`light_cannon` | 25/3/100 | pursuit，全期 |
| `bomber` 轰炸机 / ww1-jet / bomber | air | crossing；直飞，地面轰炸 | core+双翼+2 引擎+尾+弹舱 | nose→机枪 + top→`top_turret` | 55/6/220 | bomber，skirmish+ |
| `escort` 护卫无人机 / ww2-jet / escort | air | escort；跟随精英/长机 | core+双翼 | wing→`wing_turret` | 28/3/112 | support，pressure+ |
| `striker` 俯冲攻击机 / ww2-jet / dive | air | dive；周期性加速俯冲 | core+双翼+2 引擎 | nose→`ww2_autocannon` | 40/4/160 | harass，skirmish+ |
| `elite` 精英空艇 / ww1-jet / elite | air | standoff；环形弹幕，8 门炮 | core+侧舷+2 引擎+尾舵+2 炮塔 | turret×2→`ww2_autocannon` | 220/24/880 | elite，pressure+ |
| `missile_truck` 导弹车 / ww2-jet / value | ground | patrol；沿路移动，30–34 发射 | core+导弹舱+轮组 | top→`jet_air_missile`（对空） | 50/6/200 | value，skirmish+ |
| `resource` 资源车 / pioneer-jet / convoy | ground | convoy；车队 | core+轮组 | 无 | 70/18/280 | value，全期 |
| `depot` 燃料设施 / pioneer-jet / static | ground | static；无武器 | core+储罐 | 无 | 100/10/400 | value，事件 |

> 表中 `ww1_sync_mg` 等武器见 §5；数值沿用 current `ENEMIES`（health/speed/turnRate/radius），`behavior/parts/offense` 为新增字段。`aa`/`emplacement` 按 06 从数据删除。

## 4. 新增敌人内容（14 种，按时代/层）

### 4.1 空中（8）

| id | 名称 | era/role | 定位 | HP/速度/转向 | behavior | parts（03） | 武器挂点 | 奖励 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `interceptor` | 高速截击机 | ww2-jet / interceptor | 快进快出 | 70/8.8/110 | chase，preferred 14–18，breakChance .55 | core+双翼 | nose→`ww2_autocannon` | 32/4/128 |
| `heavy_fighter` | 双发重型战斗机 | ww2 / heavyFighter | 重火力 | 160/7.0/70 | chase，20–25，burst 2 | core+双翼+2 引擎+尾 | nose→`ww2_heavy_cannon` + wing→机枪 | 70/8/280 |
| `torpedo_bomber` | 鱼雷轰炸机 | ww2 / bomber | 对舰/对地 | 150/5.2/45 | crossing + 低空 | core+双翼+2 引擎+弹舱 | bottom→`ww2_torpedo` + nose 机枪 | 85/10/340 |
| `gunship` | 炮艇机 | ww2 / gunship | 侧射火力 | 220/4.2/35 | standoff；侧舷齐射 | core+双翼+2 引擎+侧翼 | sideL/right→`ww2_autocannon` | 110/14/440 |
| `recon_balloon` | 侦察气球 | ww1 / recon | 视野/警报 | 45/0.6/20 | patrol 缓慢漂移 | core+囊体+吊舱 | 无（提供雷达/预警） | 24/6/96 |
| `ace` | 王牌飞行员 | 全 era / fighter | 精英战斗机 | 220/9.0/105 | chase + 机动 | core+双翼+引擎+尾 | nose→`ww2_heavy_cannon` | 180/20/720 |
| `jet_bomber` | 喷气轰炸机 | jet / bomber | 高速掠袭 | 260/10.5/55 | crossing | core+单翼+2 引擎+弹舱 | nose→`jet_autocannon` + bottom 炸弹 | 150/18/600 |
| `seaplane_patrol` | 水上巡逻机 | ww2 / seaplane | 水域 | 120/6.4/65 | patrol 沿水路 | core+双翼+浮筒 | nose→机枪 + bottom 深弹 | 60/8/240 |

### 4.2 地面/水面（6）

| id | 名称 | era/layer | 定位 | HP/速度 | 路线 | 武器 | 奖励 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `supply_train` | 补给列车 | ww1+ / ground | 高价值运输 | 320（3 节）/1.4 | rail | 尾车→机枪 | 180/30/720 |
| `railgun_train` | 轨道炮车 | ww2 / ground | 远程炮击 | 260（2 节）/1.2 | rail | top→`railgun` | 220/36/880 |
| `patrol_boat` | 巡逻艇 | ww2 / water | 水面火力 | 180/2.2 | water | bow→`aa_autocannon` | 120/16/480 |
| `landing_ship` | 登陆舰 | ww2 / water | 大型目标 | 420/1.0 | water | deck→`naval_gun` | 260/40/1040 |
| `radar_truck` | 雷达车 | ww2-jet / ground | 预警/召唤 | 90/2.0 | road | 无（雷达/增援） | 70/12/280 |
| `mobile_artillery` | 自行火炮 | ww1+ / ground | 区域炮击 | 140/1.6 | road | top→`howitzer` | 100/14/400 |

> 地面/水面单位全部沿 06 的路线移动（无固定炮台）；`radar_truck` 不攻击，但会周期性 `requestSpawn` 增援（受 02 上限约束）。

## 5. 武器配置 v2 schema 与现有迁移

```ts
type WeaponCategory = "directional"|"turret"|"area"|"lock";
type ProjectileKind = "bullet"|"shell"|"rocket"|"missile"|"flak"|"bomb"|"torpedo";
type DamageType = "small_arms"|"cannon"|"explosive"|"incendiary"|"armor_piercing";
type WeaponMountKind = "nose"|"wing"|"top"|"bottom"|"tail"|"turret"|"bow"|"deck";

interface WeaponV2 {
  // 身份
  id: string; name: string; era: EraId | ("any");
  category: WeaponCategory;
  projectileKind: ProjectileKind;
  damageType: DamageType;
  mountKinds: WeaponMountKind[];
  targetLayers: EnemyLayer[];
  // 弹道（现有字段）
  damage; fireRate; speed; range; count; arc; spread;
  pierce; bounce; explosion; lockTime; lossRate;
  homing; homingLife; escort; turnRate; turretArc;
  duration; burn; slow; armorBreak;
  // 新字段
  armorPierce: number;            // 0–1，对装甲目标的穿透
  falloff: number;                // 爆炸/范围的距离衰减指数
  ammo: number;                   // 备弹（0=无限）
  reload: number;                 // 装填秒
  heat: number;                   // 每发热量（可选）
  partPriority: PartRole[];       // 03：优先命中部件
  visual: { tracer?: string; muzzle?: string; icon?: string };
  audio: string;                  // Audio 音效键
  aiUse?: { accuracy?: number; burst?: number }; // 敌人使用的限制
}
```

### 5.1 现有 11 种武器迁移（新增字段，数值不变）

| id | 时代 | 类别/弹种/伤害类型 | 可装挂点 | 目标层 | 关键新字段 |
| --- | --- | --- | --- | --- | --- |
| `light_cannon` | ww1+ | directional/bullet/small_arms | nose/wing | air | ammo 0、partPriority [wing,engine] |
| `nose_cannon_pair` | jet | directional/shell/cannon | nose | air | armorPierce .15、partPriority [wing,engine,core] |
| `wing_machinegun_pair` | ww1+ | directional/bullet/small_arms | wing | air | 双挂点、aiUse.accuracy .8 |
| `heavy_machinegun_quad` | ww2+ | directional/bullet/armor_piercing | nose/wing | air | armorPierce .3、pierce 1 |
| `top_turret` | any | turret/bullet | top/turret | air | turretArc 270、aiUse.burst 2 |
| `wing_turret` | ww2+ | turret/shell | wing/turret | air | turnRate 80、turretArc 180 |
| `rocket_pod` | ww2+ | directional/rocket/explosive | wing | air/ground | falloff 1.4、explosion 2.2 |
| `lock_missile` | jet | lock/missile/explosive | wing/turret | air | homing 150、armorPierce .4 |
| `gravity_bomb` | ww1+ | area/bomb/explosive | bottom | ground | falloff 1.6、partPriority [core] |
| `heavy_bomb` | ww2+ | area/bomb/explosive | bottom | ground | explosion 7.5、falloff 1.2 |
| `napalm_bomb` | ww2+ | area/bomb/incendiary | bottom | ground | duration 5、burn 28、fire zone |

### 5.2 新增武器（18 种）

| id | 名称 | era | 类别/弹种 | 挂点/目标 | 关键数值 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| `ww1_sync_mg` | 同步机枪 | ww1 | directional/bullet | nose/air | dmg 5, rate 9, spd 24, range 22 | 机头固定 |
| `ww1_twin_mg` | 双联机枪 | ww1 | directional/bullet | nose/air | dmg 7, rate 8, count 2 | 追猎机标配 |
| `ww1_wing_gun` | 翼上机枪 | ww1 | directional/bullet | wing/air | dmg 5, rate 8, spread 2 | 翼上安装 |
| `ww1_light_bomb` | 轻型炸弹 | ww1 | area/bomb | bottom/ground | dmg 80, explosion 3.5 | 手工投掷 |
| `ww2_autocannon` | 20mm 机炮 | ww2 | directional/shell | nose/wing/air | dmg 14, rate 5, armorPierce .25 | 重战/敌机 |
| `ww2_heavy_cannon` | 37mm 机炮 | ww2 | directional/shell | nose/air | dmg 30, rate 2.2, armorPierce .45 | 拦截轰炸机 |
| `ww2_rocket_battery` | 火箭齐射 | ww2 | directional/rocket | wing/air+ground | dmg 30, count 6, explosion 2.6 | 对地/对舰 |
| `ww2_torpedo` | 鱼雷 | ww2 | area/torpedo | bottom/water+ground | dmg 240, explosion 6 | 水上目标 |
| `ww2_medium_bomb` | 中型炸弹 | ww2 | area/bomb | bottom/ground | dmg 180, explosion 6 | 通用 |
| `ww2_incendiary` | 燃烧弹 | ww2 | area/bomb/incendiary | bottom/ground | dmg 60, duration 6, burn 30 | 区域封锁 |
| `jet_autocannon` | 喷气机炮 | jet | directional/shell | nose/air | dmg 16, rate 7, spd 34 | 现有机炮升级位 |
| `jet_heavy_cannon` | 重型航空炮 | jet | directional/shell | nose/air | dmg 40, rate 1.8, armorPierce .5 | 反大型机 |
| `jet_air_missile` | 空空导弹 | jet | lock/missile | wing/air | dmg 85, lock 1.0, homing 170 | 现有锁定导弹升级 |
| `jet_rocket_pod` | 喷气火箭巢 | jet | directional/rocket | wing/air+ground | dmg 28, count 8, explosion 2.4 | 对地 |
| `flak_88` | 重型防空炮 | ww2 | area/flak | top/air | dmg 45, explosion 3.5, range 40 | 地面防空 |
| `aa_autocannon` | 防空机炮 | ww1+ | turret/flak | turret/air | dmg 10, rate 6, range 30 | 车辆/舰艇 |
| `naval_gun` | 舰炮 | ww2 | turret/shell | deck/ground+air | dmg 70, rate 0.6, range 46 | 舰艇 |
| `howitzer` | 自行火炮 | ww1+ | area/shell | top/ground | dmg 90, explosion 5, range 50 | 炮击圈 |

## 6. 与 02/03/05/06 的接口

- **02**：`spawnRole/slotCost/spawn.phases/formation` 直接作为导演输入；`ace/elite` 计入精英名额。
- **03**：`defense.parts` 直接生成 `Enemy.parts`；`weapon.partPriority` 决定 AI 瞄准优先部件；`torpedo` 仅对 `water/ground` 有效。
- **05**：所有开火走 `enemy_fire`/`ground_attack` 事件；`behavior.warning` 仍是内部计时；瞄准线已删除。
- **06**：`route.kind/speed/lane` 驱动移动；`radar_truck` 等新地面单位受地面 ≤6 与路线约束，无固定炮台。
- **08**：`era/visual.modelKey/eraSkin` 驱动外观；新增敌人只换配置，不新增 AI 系统。

## 7. 校验与验收

- id 唯一、枚举合法；`offense.weaponId` 必须存在；`parts` 必须含 core；`route` 仅地面/水面有；`altBand` 仅空中。
- 现有 9 种敌人的 health/speed/turnRate/radius/奖励与 0.3.0 完全一致；`aa/emplacement` 不存在。
- 新增敌人：至少覆盖每个时代 3 种空中、2 种地面/水面；每种有 1 个弱点部件、1 个可读攻击模式。
- 武器：至少每个时代 3 种；所有武器可在至少一个机体/敌人挂点上安装；`torpedo` 不对空。
- 数据量：`WEAPONS` 新增后总量约 29；`ENEMIES` 约 23（9 迁移 + 14 新增，不含删除的 2 个炮台）。

## 8. 实施任务

| # | 任务 | 依赖 | 完成标志 |
| --- | --- | --- | --- |
| T1 | schema + 现有 9 敌/11 武器迁移，数值不变 | — | `npm run check` + 数据校验通过 |
| T2 | 敌人 `parts/offense/mount` 接入 03/05 | T1、03/05 | 部件命中、武器组合、开火事件与 0.3.0 行为一致 |
| T3 | 新增 14 敌 + 18 武器数据 | T1 | 每个时代/层覆盖断言；无未使用字段 |
| T4 | 08 外观/06 路线/02 导演适配 | T2、T3 | 新单位可生成、可移动、可击毁、可掉落 |
| T5 | 平衡与内容验收 | T4 | 五局 3–5 分钟无“打不死/刷屏/无威胁”单位 |

## 9. 待确认

| # | 问题 | 推荐 | 备选 |
| --- | --- | --- | --- |
| 1 | 新增 14 敌/18 武器是否一期全上 | **分时代二期上**，一期先加 1–2 个 | 一次全上会显著拉长平衡与测试 |
| 2 | `torpedo` 是否真的对水面单位 | 是，仅 `water/ground` | 若不做水面战斗，可先归为 heavy bomb 皮肤 |
| 3 | 敌人武器是否允许玩家掉落/拾取 | 否（敌人武器仅数据） | 允许缴获会需要额外 UI/平衡 |
| 4 | 是否保留 `aa/emplacement` 作为数据兼容 | 否（06 已删） | 保留会违反“无固定炮台”需求 |
