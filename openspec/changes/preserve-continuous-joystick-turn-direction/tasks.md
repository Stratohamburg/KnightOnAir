# Tasks

## 1. 摇杆轨迹状态与输入契约

- [x] 1.1 在 `src/input/VirtualStick.ts` 增加连续角度累计、顺/逆时针方向锁定、反向滞后、目标收敛退出和统一复位状态，并保持死区、平滑、普通油门、加力与键盘绝对方向语义。验证 `tests/controls.test.ts` 覆盖跨越 `-π/π`、小幅抖动、反向切换、直接重定位、指针取消和模式切换。
- [x] 1.2 在 `src/simulation/types.ts` 与玩家输入适配处扩展可选的连续转向方向字段，并确认旧输入对象、键盘输入和缺少该字段的回放样本仍能通过 `npm run check`。

## 2. 固定步长飞行响应

- [x] 2.1 在 `src/simulation/World.ts` 将摇杆连续转向方向传入玩家控制意图，处理边界回转优先级，并在输入复位后保留现有松杆滑行行为。验证玩家输入路径的单元测试和边界场景测试通过。
- [x] 2.2 在 `src/simulation/FlightDynamics.ts` 实现受临界保护区和目标收敛窗口限制的有向角误差，确保连续顺时针或逆时针输入跨越角度临界点时保持转向符号，左右损伤只降低响应幅度。验证 `tests/flight-dynamics.test.ts` 覆盖两侧连续转向、目标收敛、损伤和 AI 无偏好时的最短路径。

## 3. 回放、帧率与集成验收

- [x] 3.1 将连续转向方向纳入 `NetworkController` 或回放输入样本的校验、排序和采样，并验证跨临界点手势在玩家、回放实体之间保持一致。
- [x] 3.2 扩展控制与飞行测试，使用相同固定步长输入快照分别以 30、60 和 120 FPS 推进，验证转向方向、航向、bank、位置和速度在允许误差内一致。
- [ ] 3.3 运行 `openspec validate --change "preserve-continuous-joystick-turn-direction" --strict`、`npm run check` 和 `npm test`，并记录真实 360×640 与 390×844 竖屏设备上的顺时针、逆时针、反向拨动和模式切换验收结果。

### 3.3 验收记录

- 2026-11-25 严格规格校验通过。当前 CLI 使用 `openspec validate preserve-continuous-joystick-turn-direction --strict`。
- `npm run check` 通过。 `npm test` 共 15 个测试文件、178 项测试通过。
- Chrome 触控模拟在 360×640 和 390×844 竖屏下均通过顺时针与逆时针跨界锁定、反向拨动、模式切换清除输入和松手复位。模式切换测试为出击装配临时加入可用的投弹配置。
- 本次未连接手机。两个尺寸的真机触控与手感验收待补。

## Workflow follow-up

- 在实现和验收完成后，按 OpenSpec 流程将新建的 `battle/joystick-control` 主规格以及两个修改规格同步到 `openspec/specs/`，再归档本次变更。
