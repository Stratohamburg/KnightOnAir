# 历史文档归档

> **说明**：本目录保存早期版本的完整设计快照、评审记录与历史迁移计划，**仅用于决策溯源和二期候选参考，不是现行规则真源**。
> 当前有效的文档请查阅 [docs/README.md](../README.md)，行为契约与验收场景以 [OpenSpec 主规格](../../openspec/specs) 为准。

## 目录结构

### `v0.3/` · 初版设计与 M0–M3 基线

- [GAME_DESIGN.md](v0.3/GAME_DESIGN.md)：初版全量 GDD（含早期 0.3 数值与相机基线，部分参数已被 0.4 迭代替代）。
- [m0-m3-implementation.md](v0.3/m0-m3-implementation.md)：M0–M3 里程碑映射、早期实现选择、39 项基线测试与 2026-11-19 浏览器初测记录。
- `systems/01–07`：初版七份分系统设计文档（控制与相机、机体损坏、武器、敌人战场、升级构筑、程序化 3D、局外 UI）。
- `content/`：初版 4 机体、初版敌人、武器、升级部件与局外 UI 内容表。

### `v0.4/` · 0.4 方向调整评审与迁移存档

- [design-review.md](v0.4/design-review.md)：2026-11-20 对 21 项反馈与提案 01–16 的方案评审结论与实施顺序。
- [migration-plan.md](v0.4/migration-plan.md)：从 0.3.0 迁移至统一战斗管线与配置 v3 的接口草案与 Phase 0–7 计划。
- [terrain-cloud-plan.md](v0.4/terrain-cloud-plan.md)：0.4 早期确定性地形块与低模云簇方案及第一/二批施工记录（现行俯视角云野视觉原则与连续体积云方案见 [渲染与视觉指南](../RENDERING_GUIDE.md)）。
- `proposals/00–16`：0.4 方向调整的 17 份原始修改提案；其中 `13–16` 仍作为四时代二期候选参考库，入口见 [时代内容与配置规范](../CONTENT_CATALOG.md)。
