# Tasks

## 1. 飞行员感知与战术状态

- [x] 1.1 从玩家和邻机快照计算距离、相对方位、目标航向差、闭合速度、横向偏差、能量和武器解算结果，使用 `npm run check` 验证类型完整。
- [x] 1.2 扩展敌人战术状态和动作计时器，加入进入与离开阈值，验证固定步推进不会在 attack、break 和 reengage 之间抖动。
- [x] 1.3 为 chase、intercept、dive、crossing、escort 和 standoff 建立角色级战术参数，验证配置完整性检查和时代内容仍通过 `npm test -- --run tests/config-v3.test.ts`。

## 2. 飞行员动作与武器决策

- [x] 2.1 修改 chase 飞行员，让它使用 lag pursuit 接近尾后目标点、匹配速度并保持尾后射击几何，验证直线巡航时敌人能持续追击而不是每帧直冲玩家当前位置。
- [x] 2.2 修改 intercept 和 dive 飞行员，让它们使用 lead pursuit、高速攻击和超越脱离，验证高速角色不会退化为普通尾追。
- [x] 2.3 修改 break、reengage 和 flee 决策，让玩家转弯、加力、失去武器解算或敌机受损时触发不同动作，验证玩家有可读的摆脱和反击窗口。
- [x] 2.4 修改敌方开火决策，让攻击角、射程、闭合速度和预测命中误差共同决定射击，验证敌人不会在没有武器解算时持续开火。

## 3. 导演边界与行为回归

- [x] 3.1 保留导演对刷新时间、单位类型、编组和入口位置的职责，验证 NPC 生成后由飞行员策略独立驱动每个固定步。
- [x] 3.2 在 `tests/flight-dynamics.test.ts` 增加后方接近、尾后保持、玩家转弯摆脱、加力摆脱和重新切入测试，验证固定步状态序列和敌方开火窗口。
- [x] 3.3 增加截击机超越、俯冲攻击、护航锚点和路线攻击回归测试，验证角色行为不会被普通追猎逻辑覆盖。
- [x] 3.4 更新 `docs/GAMEPLAY_DESIGN.md`、`openspec/specs/battle/air-combat-behavior/spec.md` 和 `openspec/specs/battle/encounter-director/spec.md`，记录追猎者、截击机和路线攻击单位的职责与验收指标，并运行 `openspec validate --strict "add-tail-pursuit-combat"`。

## 4. 集成验证

- [x] 4.1 运行 `npm test`、`npm run check` 和 `npm run build`，确认空战、战役、渲染和存档回归通过。
- [x] 4.2 使用固定种子推进自由巡航和包含侧后方敌群的战役，确认玩家能经历接近、尾后射击、规避、脱离、反向追击和击落的完整流程，并记录验证结果。
