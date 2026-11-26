# app/debug-workbench Specification

## Purpose

定义展台「校验」入口内原型与特效调试台的行为。调试台从共享库读取内容，在独立空间内复现运行时表现，供开发和美术逐项核对。

## Requirements

### Requirement: Read all preview configuration from the libraries

调试台 MUST 从共享库枚举原型档案、有模型的机型以及运行时特效和变体，并按库中的 ID 与关联读取配置。模型、部件、挂点、武器、效果参数、可用动作及有配置值的预览预设 MUST 由相应库提供。界面只持有本次会话的选中 ID、观察设置、播放状态及当前预览实例。界面 MUST NOT 自建或持久化机型清单、特效注册表、机型到特效的映射、参数副本或后备配置。

#### Scenario: Add library content without editing the workbench

- **WHEN** 库新增一个有模型的机型和一个使用已有播放方式的特效变体，随后用更新后的库重新打开调试台
- **THEN** 两项分别出现在对应目录，可直接预览。仅有模型的机型也可进入「机型表现」，无需为其补录原型档案或界面条目

#### Scenario: Change an effect or an aircraft anchor at its source

- **WHEN** 在库里修改翼中拖尾的带宽和透明度，或移动机型的排气挂点，再用该版本重新打开预览
- **THEN** 特效库与整机预览中使用该特效的实例均采用新参数，整机推进效果从新挂点发出，无需修改调试台

#### Scenario: Remove content or encounter a broken reference

- **WHEN** 库移除某条目，或者机型仍引用一个无法解析的效果 ID
- **THEN** 重新打开后，已移除的条目从目录消失。遇到缺失引用时，界面标明受影响项及缺失 ID，禁用对应动作，其余有效内容仍可预览。目录为空时显示空状态

### Requirement: Switch between prototype and effects inspection

调试台 MUST 沿用展台「校验」入口与既有原型直达链接，默认打开「原型」。顶部 MUST 常驻「原型」「特效」两个页签。「原型」继续按档案检查三视图、模型与资料，「特效」提供「特效库」「机型表现」两种预览。跨页签选择 MUST 按库中已有映射解析，只推进可见预览的时钟。

#### Scenario: Switch tools on a portrait screen

- **WHEN** 在 360 × 640 竖屏展开控制面板，从正在播放或已暂停的预览点击另一页签，再切回
- **THEN** 每次只需点击一次顶部页签。两侧均有对应内容时选中同一机型，返回同一预览时保留观察设置和离开时刻

#### Scenario: Open a reference link or inspect an unmapped aircraft

- **WHEN** 通过既有 `?reference=1` 或 `#reference` 入口进入，或从指定原型的有效 `frame` 链接进入
- **THEN** 打开原型页并沿用已有选机规则。切换到另一侧时，若库中没有对应机型或档案，显示缺少对应内容，可返回原选择或另选条目

### Requirement: Preview individual runtime effects

「特效库」 MUST 展示库条目的名称、标识与触发条件，使用真实效果实现，并提供能触发该效果的最小输入，例如移动挂点、受损表面或简单靶面。一次性效果 MUST 支持单次播放与重播，持续效果 MUST 支持开始、停止发射与重置。

#### Scenario: Replay a muzzle flash and stop a trail

- **WHEN** 单独播放并重播一次枪口效果，再播放持续气流并停止发射
- **THEN** 每次单发均可观察完整的瞬时效果。气流停止产生新轨迹，已发出的尾迹按库配置消散。点击重置后恢复初始画面

### Requirement: Combine aircraft motion and power presets

「机型表现」 MUST 按所选机型的飞行与动力配置，以固定步输入驱动预览。默认使用巡航平飞。航迹可选平飞、S 弯、持续左转或右转，动力可选低速、巡航及机型支持的加力。两组选项 MUST 可独立切换，姿态、速度和拖尾从切换时刻连续演进。

#### Scenario: Compare power settings along an S turn

- **WHEN** 从巡航平飞进入低速 S 弯，再沿 S 弯切换加力，随后切换为持续转弯
- **THEN** S 弯交替左右倾侧并经过回正，动力切换遵循机型自身的可用条件与持续时间。持续转弯保持所选转向，之前产生的尾迹仍沿已飞过的路径消散

### Requirement: Inspect effects on the configured aircraft

「机型表现」 MUST 用与战斗共用的模型工厂、特效实现和运行时挂点，支持按类别单显或组合观察气流、发动机、破损和开火。动作可用性 MUST 取自所选机型的部件与挂载。

#### Scenario: Inspect the wing ribbon through a reversal

- **WHEN** 在 Dr.I 的 S 弯中单显机翼中段气流，再叠加翼尖气流
- **THEN** 左右机翼中部各拉出宽而淡的连续带，经过换向处仍可沿带追踪航迹。翼尖细线从独立起点拉出，两者在同一镜头下可辨

#### Scenario: Isolate an engine fault and inspect gunfire while banked

- **WHEN** 在 Ho 229 加力时触发单侧发动机故障，或在配置多个枪口的机型倾侧时触发齐射
- **THEN** 可分别核对正常与故障侧出口的推进效果。每个实际开火的枪口在对应挂点产生枪焰和烟团，有抛壳口的武器从对应出口抛壳

#### Scenario: Track two damage sites through motion and detachment

- **WHEN** 在同一机翼制造两个不同的破损点，观察倾侧、单点维修与部件脱落
- **THEN** 两个破损点各自跟随所属表面，已发出的烟留在飞过的路径。维修只清理对应点，脱落后残余烟火的起点跟随残片

### Requirement: Replay and inspect a fixed simulation step

调试台 MUST 提供暂停、单步、慢放与固定种子重播。机型表现 MUST 提供跟随和固定镜头。特效预览 MUST 支持明暗背景、适用的挂点标记和运行时画质档，以便在同一条件下复查效果。

#### Scenario: Compare a reproducible frame

- **WHEN** 暂停一次正在转弯开火的预览，前进一帧，再从相同配置、种子与输入重播至该步
- **THEN** 暂停同时冻结飞机和特效，单步只推进一个模拟步。重播到该步时可在相同姿态与挂点核对同一次开火

### Requirement: Isolate preview scenes and session state

两种特效预览 MUST 在独立轻量空间中只加载当前预览所需的相机、光照、背景、模型、效果或简单测试物。进入、切换、重播与触发动作 MUST NOT 加载游戏场景或初始化关卡、地形、云海、敌群及战斗 HUD。调试台 MUST 复用展台的调试可见性规则，并在退出时释放实例与资源租约，所有调试操作仅影响本次会话。

#### Scenario: Inspect resource use across both previews

- **WHEN** 从校验入口遍历两种特效预览，触发开火、命中或降雨效果，并检查资源加载与初始化记录
- **THEN** 两种预览都能独立运行，记录中没有游戏场景初始化、关卡加载或地景资源请求

#### Scenario: Reset, switch aircraft, and leave the workbench

- **WHEN** 在有尾迹、烟火和孔洞的预览中重置或切换机型，然后退出到展台
- **THEN** 旧实例的残留随重置或换机清理。退出后预览停止并释放所持资源，本次操作没有写入内容库、玩家装备、任务或存档
