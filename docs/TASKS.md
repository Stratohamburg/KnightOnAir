# Knight on Air 待办任务

当前桌面浏览器基准覆盖 360×640 视口下的满额出击渲染。标准档峰值为 132 次绘制、84,032 个三角形，帧间隔 P95 为 16.8 ms。实体手机基准仍需实测。[空战与内容库验收](VERIFICATION.md#既有满额渲染基线5-分钟) · [云与植被验收](VERIFICATION.md#连续云层与风动植被验收)

## 1. 局内体验修正

- [ ] **1.1 保持暂停期间的镜头构图。** 当前轰炸进入暂停后，镜头会随渲染帧向巡航构图过渡。完成条件是在巡航、轰炸和两者切换途中暂停时保持当前镜头，恢复后从原过渡进度继续。覆盖暂停菜单、从暂停进入设置及页面失焦后的恢复。 [相机 spec](../openspec/specs/battle/camera-and-view-feedback/spec.md) · [镜头实现](../src/rendering/Renderer.ts) · [会话暂停](../src/simulation/World.ts)

- [ ] **1.2 让投弹控件解释当前不可用状态。** 炸弹舱损坏时投弹已被禁止，界面仍可能提示松杆稳定。完成条件是投弹区能区分未安装弹舱、弹舱失效、装填中、准心尚未稳定或超出包线，以及可以投放，按钮与快捷键沿用同一投弹判定。 [战斗 HUD spec](../openspec/specs/battle/battle-hud-and-event-feedback/spec.md) · [投弹状态显示](../src/app/GameApp.ts) · [投弹判定](../src/simulation/World.ts)

- [ ] **1.3 验收战斗音效和触觉设置。** 开火、受击、击毁与拾取音效已从公开事件触发，连发按类别节流。仍需在支持振动的手机上验证音效与触觉设置组合。`GameAudio.play` 在音效禁用或音频上下文未运行时会提前返回，需对照设置语义检查振动结果。[战斗音频](../src/services/Audio.ts) · [反馈规格](../openspec/specs/battle/battle-hud-and-event-feedback/spec.md)

## 2. 发布验收

- [ ] **2.1 完成移动设备性能矩阵。** 用同一满额战斗场景在代表性的 iOS Safari 和 Android Chrome 设备测量三档画质。记录机型、系统、浏览器、分辨率、帧间隔中位数与 P95、动态分辨率变化、绘制次数、三角形和持续运行后的发热与耗电观察。以设计中的中端 60 FPS、低端 30 FPS 为目标，记录超预算场景及复测结果。 [性能 spec](../openspec/specs/rendering/quality-and-performance/spec.md) · [现有浏览器基准](VERIFICATION.md#既有满额渲染基线5-分钟) · [渲染性能红线](RENDERING_GUIDE.md#俯视角视觉原则光遇云野基线)

- [ ] **2.2 补充跨地块与多次出击的 WebGL 资源验收。** 五分钟满额战斗已覆盖标准、低、标准切换，并记录预热后的有界资源计数。其余验收覆盖跨地块、反复出击并返回机库，以及持续低帧率下的自动分辨率降档和回升。在各轮结束时比较相同场景状态下的几何体、纹理和程序计数。[资源稳定性规格](../openspec/specs/rendering/quality-and-performance/spec.md) · [五分钟基准](VERIFICATION.md#既有满额渲染基线5-分钟)

- [ ] **2.3 完成真实单手触控验收。** 在目标手机上连续试玩至少五分钟，覆盖摇杆死区、外圈加力、第二指点按钮、指针取消、屏幕旋转、切后台和恢复。完成条件是留存操作记录和可复现问题，重点确认摇杆能清零、场景区触摸不会意外滚动或缩放，以及中断后能手动继续。 [输入 spec](../openspec/specs/battle/input-and-action-binding/spec.md) · [浏览器验收步骤](VERIFICATION.md#浏览器手工验收步骤)

- [ ] **2.4 完成可访问性专项验收。** 检查机库、出击、局内改装、暂停、设置、结算和重试流程的键盘可达性、焦点返回、控件名称与状态。用移动端屏幕阅读器复核关键提示能否读出，并检查锁定、装填和可投放状态是否易于区分。完成条件是有逐流程验收记录和每个缺陷的复现步骤。 [页面与焦点 spec](../openspec/specs/app/shell-routing/spec.md) · [输入 spec](../openspec/specs/battle/input-and-action-binding/spec.md) · [浏览器验收步骤](VERIFICATION.md#浏览器手工验收步骤)

- [ ] **2.5 补齐浏览器端关键流程的可重复回归。** 覆盖新档出击、预览无权装备的机体、开启轰炸、暂停恢复、局内安装结构件及武器挂载、结算、按原装备重试及刷新读档。完成条件是用固定种子或可复现操作验证构型和挂载在局内实际生效，重试恢复基础构型，结算的永久奖励只累计一次。 [机库 spec](../openspec/specs/app/out-of-battle-hangar/spec.md) · [改装 spec](../openspec/specs/battle/aircraft-refit/spec.md) · [持久化 spec](../openspec/specs/app/persistence-and-meta-progression/spec.md)

## 3. 四时代平衡与局内构筑

- [ ] **3.1 测量四个时代的战斗压力与解锁节奏。** 每个时代用代表机体、固定种子和有伤害的常规出击记录 3–5 分钟战斗，测量开场、波次、适用的精英与增援、击毁耗时、死亡原因、经验和最高分走势。完成条件是能用记录定位需要调节的敌人密度、武器强度、经验阈值或解锁分，并对调整项用同一场景复测。 [时代内容验收](CONTENT_CATALOG.md#新玩家起点与存档-v2-约定) · [历史阶段 7 验收](archive/v0.4/migration-plan.md#phase-7--平衡性能和真机验收) · [战斗导演 spec](../openspec/specs/battle/encounter-director/spec.md)

- [ ] **3.2 验收局内改装路线与取舍。** 比较轻型、重装、多翼多发和单侧增件构型，覆盖满挂点、受损、兜底选项和安装弹舱后的玩法变化。完成条件是记录各构型在部件与轮廓、火力、受弹区域、转向和投弹上的收益与代价，按试玩结果调节候选权重、安装限制或数值。 [改装 spec](../openspec/specs/battle/aircraft-refit/spec.md) · [机体改装提案](archive/v0.4/proposals/11-airframe-config-and-refit.md) · [现有改装行为测试](../tests/simulation.test.ts)

## 4. 待定范围的功能设计

- [ ] **4.1 定义第一个主动技能及其输入。** 明确技能来源、触控按钮、快捷键、触发条件、资源消耗、冷却、暂停时的输入门控，以及与局内机体改装的关系。完成条件是有可评审的玩法范围和触发、不可用、恢复三个验收场景。 [输入 spec](../openspec/specs/battle/input-and-action-binding/spec.md) · [归档设计记录](../openspec/changes/archive/2026-11-22-organize-capability-specs/design.md#use-behavior-evidence-for-future-archival)

- [ ] **4.2 定义事件驱动的镜头反馈。** 从受击、加力和爆炸中确定首批事件，给出反馈幅度、时长、叠加规则、暂停与恢复行为。完成条件是有可评审的事件清单和对应场景，能够验证反馈过程中控制方向和瞄准仍可读。 [相机 spec](../openspec/specs/battle/camera-and-view-feedback/spec.md) · [归档设计记录](../openspec/changes/archive/2026-11-22-organize-capability-specs/design.md#use-behavior-evidence-for-future-archival)

- [ ] **4.3 确定二期内容范围。** 根据四时代试玩结果筛选候选机体、敌人、升级、精英和阶段性风场。完成条件是列出选中的具体内容、所属时代、装配或行为依赖，以及每项内容可独立复验的场景。 [M4 内容和调优（归档）](archive/v0.3/GAME_DESIGN.md#m4-内容和调优) · [时代内容分期](CONTENT_CATALOG.md)

- [ ] **4.4 明确局外占位入口的用途。** 盘点商店与两个预留入口，确定首个可交付的局外功能及对应导航。若进入商店设计，完成条件还包括明确资源用途、商品范围、购买或解锁后的装备与存档规则。 [机库 spec](../openspec/specs/app/out-of-battle-hangar/spec.md) · [局外界面初版设计](archive/v0.3/systems/07-meta-ui.md)

- [ ] **4.5 评估联网对战需求。** 当前已有时间戳输入与本地双实体回放覆盖。完成条件是确认是否进入联网设计，并在纳入范围时明确首个游戏模式、同步边界和可验证的最小对战流程。 [运行时架构](ARCHITECTURE.md) · [本地回放测试](../tests/baseline-0_4.test.ts)
