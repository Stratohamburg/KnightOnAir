# Knight on Air 待办任务

基线为 2026-11-22 的 0.4 实现及已归档的 19 个长期 spec。云与植被的功能验收已完成。桌面 Chrome 的 360×640 满额战斗场景中，标准档峰值为 92 次绘制、52,058 个三角形，帧间隔 P95 为 16.8 ms。实体手机基准仍需实测。 [环境验收记录](IMPLEMENTATION_0_4_TERRAIN_CLOUD.md#浏览器验收) · [能力证据映射](../openspec/changes/archive/2026-11-22-organize-capability-specs/design.md#evidence)

## 1. 局内体验修正

- [ ] **1.1 保持暂停期间的镜头构图。** 当前轰炸进入暂停后，镜头会随渲染帧向巡航构图过渡。完成条件是在巡航、轰炸和两者切换途中暂停时保持当前镜头，恢复后从原过渡进度继续。覆盖暂停菜单、从暂停进入设置及页面失焦后的恢复。 [相机 spec](../openspec/specs/battle/camera-and-view-feedback/spec.md) · [镜头实现](../src/rendering/Renderer.ts#L553) · [会话暂停](../src/simulation/World.ts#L1748)

- [ ] **1.2 让投弹控件解释当前不可用状态。** 炸弹舱损坏时投弹已被禁止，界面仍可能提示松杆稳定。完成条件是投弹区能区分未安装弹舱、弹舱失效、装填中、准心尚未稳定或超出包线，以及可以投放，按钮与快捷键沿用同一投弹判定。 [战斗 HUD spec](../openspec/specs/battle/battle-hud-and-event-feedback/spec.md) · [投弹状态显示](../src/app/GameApp.ts#L345) · [投弹判定](../src/simulation/World.ts#L416)

- [ ] **1.3 收敛战斗音效与触觉的触发来源。** 受击音效同时从战斗事件和 HUD 生命变化触发，金币音效还会随分数增长触发。完成条件是一次受击只触发一次受击反馈，击毁和金币拾取各自触发对应反馈，纯分数变化无需播放拾取音，音效和触觉开关分别按现有设置语义验证。 [战斗 HUD spec](../openspec/specs/battle/battle-hud-and-event-feedback/spec.md) · [HUD 更新](../src/app/GameApp.ts#L386) · [战斗事件消费](../src/app/GameApp.ts#L777)

## 2. 发布验收

- [ ] **2.1 完成移动设备性能矩阵。** 用同一满额战斗场景在代表性的 iOS Safari 和 Android Chrome 设备测量三档画质。记录机型、系统、浏览器、分辨率、帧间隔中位数与 P95、动态分辨率变化、绘制次数、三角形和持续运行后的发热与耗电观察。以设计中的中端 60 FPS、低端 30 FPS 为目标，记录超预算场景及复测结果。 [性能 spec](../openspec/specs/rendering/quality-and-performance/spec.md) · [现有浏览器基准](IMPLEMENTATION_0_4_TERRAIN_CLOUD.md#浏览器验收) · [性能目标](GAME_DESIGN.md#性能和兼容性目标)

- [ ] **2.2 复核当前版本的 WebGL 长时资源稳定性。** 在可重复的浏览器场景中连续渲染至少五分钟，跨地形块、切换画质并多次出击和返回机库。完成条件是保存预热后及各轮结束时的几何体、纹理与程序计数，对比相同场景状态下的资源数量，并记录动态分辨率降档和回升表现。现有五分钟自动化覆盖模拟对象池，环境文档记录了每档 90 帧的基准。 [资源稳定性 spec](../openspec/specs/rendering/quality-and-performance/spec.md) · [环境诊断](../src/rendering/EnvironmentAcceptance.ts#L26) · [模拟耐久测试](../tests/simulation.test.ts#L308)

- [ ] **2.3 完成真实单手触控验收。** 在目标手机上连续试玩至少五分钟，覆盖摇杆死区、外圈加力、第二指点按钮、指针取消、屏幕旋转、切后台和恢复。完成条件是留存操作记录和可复现问题，重点确认摇杆能清零、场景区触摸不会意外滚动或缩放，以及中断后能手动继续。 [输入 spec](../openspec/specs/battle/input-and-action-binding/spec.md) · [既有浏览器和触控记录](IMPLEMENTATION.md#浏览器验收步骤)

- [ ] **2.4 完成可访问性专项验收。** 检查机库、出击、局内改装、暂停、设置、结算和重试流程的键盘可达性、焦点返回、控件名称与状态。用移动端屏幕阅读器复核关键提示能否读出，并检查锁定、装填和可投放状态是否易于区分。完成条件是有逐流程验收记录和每个缺陷的复现步骤。 [页面与焦点 spec](../openspec/specs/app/shell-routing/spec.md) · [输入 spec](../openspec/specs/battle/input-and-action-binding/spec.md) · [既有验收记录](IMPLEMENTATION.md#浏览器验收步骤)

- [ ] **2.5 补齐浏览器端关键流程的可重复回归。** 覆盖新档出击、预览无权装备的机体、开启轰炸、暂停恢复、局内安装结构件及武器挂载、结算、按原装备重试及刷新读档。完成条件是用固定种子或可复现操作验证构型和挂载在局内实际生效，重试恢复基础构型，结算的永久奖励只累计一次。 [机库 spec](../openspec/specs/app/out-of-battle-hangar/spec.md) · [改装 spec](../openspec/specs/battle/aircraft-refit/spec.md) · [持久化 spec](../openspec/specs/app/persistence-and-meta-progression/spec.md)

## 3. 四时代平衡与局内构筑

- [ ] **3.1 测量四个时代的战斗压力与解锁节奏。** 每个时代用代表机体、固定种子和有伤害的常规出击记录 3–5 分钟战斗，测量开场、波次、适用的精英与增援、击毁耗时、死亡原因、经验和最高分走势。完成条件是能用记录定位需要调节的敌人密度、武器强度、经验阈值或解锁分，并对调整项用同一场景复测。 [时代内容验收](content/ERA_CONTENT_0_4.md#新玩家起点与旧档) · [阶段 7 验收](ARCHITECTURE_0_4.md#phase-7--平衡性能和真机验收) · [战斗导演 spec](../openspec/specs/battle/encounter-director/spec.md)

- [ ] **3.2 验收局内改装路线与取舍。** 比较轻型、重装、多翼多发和单侧增件构型，覆盖满挂点、受损、兜底选项和安装弹舱后的玩法变化。完成条件是记录各构型在部件与轮廓、火力、受弹区域、转向和投弹上的收益与代价，按试玩结果调节候选权重、安装限制或数值。 [改装 spec](../openspec/specs/battle/aircraft-refit/spec.md) · [机体改装设计](changes/11-airframe-config-and-refit.md) · [现有改装行为测试](../tests/simulation.test.ts#L204)

## 4. 待定范围的功能设计

- [ ] **4.1 定义第一个主动技能及其输入。** 明确技能来源、触控按钮、快捷键、触发条件、资源消耗、冷却、暂停时的输入门控，以及与局内机体改装的关系。完成条件是有可评审的玩法范围和触发、不可用、恢复三个验收场景。 [输入 spec](../openspec/specs/battle/input-and-action-binding/spec.md) · [归档设计记录](../openspec/changes/archive/2026-11-22-organize-capability-specs/design.md#use-behavior-evidence-for-future-archival)

- [ ] **4.2 定义事件驱动的镜头反馈。** 从受击、加力和爆炸中确定首批事件，给出反馈幅度、时长、叠加规则、暂停与恢复行为。完成条件是有可评审的事件清单和对应场景，能够验证反馈过程中控制方向和瞄准仍可读。 [相机 spec](../openspec/specs/battle/camera-and-view-feedback/spec.md) · [归档设计记录](../openspec/changes/archive/2026-11-22-organize-capability-specs/design.md#use-behavior-evidence-for-future-archival)

- [ ] **4.3 确定二期内容范围。** 根据四时代试玩结果筛选候选机体、敌人、升级、精英和阶段性风场。完成条件是列出选中的具体内容、所属时代、装配或行为依赖，以及每项内容可独立复验的场景。 [M4 内容和调优](GAME_DESIGN.md#m4-内容和调优) · [时代内容分期](content/ERA_CONTENT_0_4.md)

- [ ] **4.4 明确局外占位入口的用途。** 盘点商店与两个预留入口，确定首个可交付的局外功能及对应导航。若进入商店设计，完成条件还包括明确资源用途、商品范围、购买或解锁后的装备与存档规则。 [机库 spec](../openspec/specs/app/out-of-battle-hangar/spec.md) · [局外界面设计](systems/07-meta-ui.md)

- [ ] **4.5 评估联网对战需求。** 当前已有时间戳输入与本地双实体回放覆盖。完成条件是确认是否进入联网设计，并在纳入范围时明确首个游戏模式、同步边界和可验证的最小对战流程。 [架构路线](ARCHITECTURE_0_4.md) · [本地回放测试](../tests/baseline-0_4.test.ts#L202)
