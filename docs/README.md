# Knight on Air 设计文档索引

这里是《Knight on Air》的设计文档入口。游戏是移动端竖屏网页版，目标是右手单手操作。它使用 3D lowpoly 资源、透视相机和固定俯视角，控制逻辑在 XZ 平面运行，因此拥有 2.5D 的操作清晰度和 3D 的空间临场感。

## 0.4 修改提案（未实施）

本轮 21 项反馈（13 项原始 + 8 项补充）已整理为 17 份文档（总览 + 01–16），入口见 [修改文档总览](changes/00-overview.md)。它们是**增量提案，尚未实施**；本目录其余文档仍描述 0.3.0 的当前实现。

## 阅读顺序

1. [总设计文档](GAME_DESIGN.md)
2. [控制、相机和单手布局](systems/01-control-camera.md)
3. [机体、部件和损坏系统](systems/02-aircraft-body-damage.md)
4. [武器系统](systems/03-weapons.md)
5. [敌人和战场系统](systems/04-enemies-battlefield.md)
6. [升级和构筑系统](systems/05-progression-upgrades.md)
7. [程序化 3D 和 shader 表现](systems/06-procedural-3d.md)
8. [局外 UI 和主界面系统](systems/07-meta-ui.md)

## 初版内容目录

- [初版机体](content/INITIAL_AIRFRAMES.md)
- [初版武器](content/INITIAL_WEAPONS.md)
- [初版敌人](content/INITIAL_ENEMIES.md)
- [初版升级部件](content/INITIAL_UPGRADES.md)
- [初版局外 UI 内容](content/OUT_OF_BATTLE_UI.md)

## 文档约定

- 系统文档描述规则、状态、接口和验收条件。
- 内容文档描述第一批可进入游戏的数据、行为和数值。
- 所有数值先作为配置，不直接写死在渲染逻辑中。
- `position.x` 和 `position.z` 是战斗平面的坐标，`position.y` 是高度。
- 数值会在真机试玩和遥测数据出现后继续调校。
