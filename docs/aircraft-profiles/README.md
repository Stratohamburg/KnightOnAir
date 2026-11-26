# 真实机型三视图档案

本目录保存每架参考真实历史原型的低模飞机三视图配准、左右对称校验、截面复核与实网格叠合验收记录。相关工程与审图规范见 [aircraft-reference-pipeline Skill](../../.agents/skills/aircraft-reference-pipeline/SKILL.md) 与 [程序化飞机规格](../../openspec/specs/rendering/procedural-aircraft/spec.md)。

在原型校验台打开已装配机型的 3D 模型，展开「特效挂点与可损蒙皮 · 三视图」。俯视、正视和侧视共用编号，下方列出部件挂点 ID、节点局部坐标、朝向、强度和配置近似点。线框来自本次装配登记的可损表面。

## 已建档机型索引

| 档案 | 目标原型 | 游戏槽位 / 阶段 | 附带叠合图 |
| --- | --- | --- | --- |
| [fokker-dr1-profile.md](fokker-dr1-profile.md) | Fokker Dr.I Dreidecker（1917） | `heron_09` / 首关正式机型，已验收 | — |
| [spitfire-vb-profile.md](spitfire-vb-profile.md) | Supermarine Spitfire Mk Vb | `falcon_13` / 实网格已验收 | [spitfire-vb-mesh-overlay.png](spitfire-vb-mesh-overlay.png) |
| [a6m2-21-profile.md](a6m2-21-profile.md) | Mitsubishi A6M2 Model 21 Zero | `dragonfly_06` / 实网格已验收 | [a6m2-21-mesh-overlay.png](a6m2-21-mesh-overlay.png) |
| [ho229-v2-profile.md](ho229-v2-profile.md) | Horten Ho 229 V2（Ho 9 V2） | `stingray_16` / 实网格与扩翼已验收 | — |
| [gloster-meteor-f3-profile.md](gloster-meteor-f3-profile.md) | Gloster Meteor F.3（G.41D） | 早期短舱校验模型 | [实网格叠合](gloster-meteor-f3-mesh-overlay.png) |
| [vampire-fb5-profile.md](vampire-fb5-profile.md) | de Havilland Vampire FB.5 | 单座收轮校验模型 | [实网格叠合](vampire-fb5-mesh-overlay.png) |

## 三视图还原流程

原型飞机的还原顺序固定为：参考筛选 → 外轮廓 → 架构 → 模块边缘 → 中心线 → 翼根 → 发动机 → 尾翼 → 武器 → 爆改层。

1. 先用权威三视图确认机长、翼展、机身最大宽度和主翼前后缘，并用同变体实机照片补充体积和结构连接。
2. 确认飞机属于常规机身、双尾梁或飞翼架构，再确认座舱、发动机、翼根和尾翼在纵向中心线上的站位。
3. 对机身、每一层机翼、尾翼、发动机整流罩和起落架分别记录前缘、后缘、上下缘、根部接缝、翼尖和净距；从独立测量的左右轮廓检查对称性并记录容差。
4. 将主翼、尾翼、发动机和起落架转成局部锚点与模块 profile。多层翼不得用统一的层间公式掩盖各层不同的前后、上下和翼展位置。
5. 用生成式模型重建正面、侧面和俯视轮廓，在参考校验台用固定正视、侧视、俯视逐面切换（关闭自动滚转），并输出同尺度实网格与三视图叠合图。
6. 最后叠加武器、装甲、炸弹舱和非对称爆改。

## 历史三视图核对修正摘要

| 原型 | 三视图暴露的偏差 | 程序化修正 |
| --- | --- | --- |
| Fokker Dr.I | 旧模型用统一层级公式，翼面后掠、翼组偏后，缺少下方起落架 | 三层翼改为独立边缘 profile，全部设为平直翼并前置到螺旋桨盘附近，上中下翼分别落在机身上缘、中心线和下缘，补入双支柱起落架 |
| Spitfire Mk Vb | 椭圆翼翼尖过厚，发动机与翼根关系不清 | 审核板分别描读双侧椭圆翼，模型按双侧均值生成主翼，保留右翼冷却液散热器、左翼滑油冷却器与空速管 |
| A6M2 二一型 | 主翼弦长过深，细长机身被翼面比例遮盖 | 审核板配准展开翼尖、主翼前后缘和机身中线，模型在展开的折叠缝两侧共用边界翼肋，只在左外翼装空速管 |
| de Havilland Vampire | 双尾梁过短且尾翼偏前，进气道没有站在翼根前缘 | 延长并后移双尾梁，提高尾翼，补入两侧进气道 |
| Horten Ho 229 | 早期被误按飞行艇生成，中心舱过长，尾缘控制面漂浮 | 改为 `integratedWing` 飞翼承载槽，缩短中心舱，发动机移到翼根，尾缘控制面沿连续翼面布置 |

## 原型准入标准

一个机型进入正式内容目录前，需要满足以下条件：

- 正视图能认出主翼高度、翼展和发动机左右关系；侧视图能认出机鼻、座舱、机身厚度和尾段长度；俯视图能认出主翼前后缘、尾翼和挂点方向。
- 每个关键部件都有对应中心线和局部锚点；每个结构模块都有三视图边缘记录，层叠机翼和起落架的根部接缝可在正视图中读出。
- 武器从真实挂点发射，发动机尾焰从真实出口生成。
- 爆改件沿中心线插入，数量增加不会随机漂浮；左右不对称会反映到操控和受弹面积。
- 机型的最佳构筑方向可以通过视觉和数值同时读懂。
