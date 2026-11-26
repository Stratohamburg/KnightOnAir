## ADDED Requirements

### Requirement: Installed aircraft effect sources

每个可装配机型 MUST 按实际构型标注各桨盘、排气组、喷口、主翼与尾翼尖、翼面气流区、突出点、机鼻、尾流、枪管、抛壳口、导轨、弹架及可损蒙皮。机型档案与三视图标注 MUST 能按稳定 ID 找到所属部件、局部姿态、强度及近似点依据。

#### Scenario: Refit and bank

- **WHEN** 同一机型在机库、战斗或 NPC 构型装配并滚转或更换挂载
- **THEN** 特效从当前实际装配部件对应的位置和方向产生。移除部件后其挂点停止发射，活动翼面的挂点随节点移动。

#### Scenario: Open framework

- **WHEN** 飞机具有开放尾架、张线、操纵索或支柱
- **THEN** 细件能提供适用的突出点气流，大件表面集合仅包含承伤蒙皮。
