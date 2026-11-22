# Spec Delta

## Purpose

定义玩家和敌人的程序化飞机、载具构型、部件挂点、升级外观和损伤表现，保证渲染结果持续反映当前战斗构型。

## ADDED Requirements

### Requirement: Configuration-driven aircraft shape

飞机和主要空中载具 MUST 根据机体配置生成可辨识的机身、机翼、发动机、尾翼、炮塔、浮筒或飞艇结构。

#### Scenario: Era-specific shape

- **WHEN** 玩家装备不同时代或不同形状的机体
- **THEN** 展示和战斗场景使用对应构型，而不会退化成同一个通用轮廓

### Requirement: Part attachment visibility

程序化模型 MUST 将可见部件和武器挂点与当前部件列表关联，升级后新增或移除的构型必须反映到模型。

#### Scenario: Install structural upgrade

- **WHEN** 局内安装机翼、发动机或炮塔升级
- **THEN** 对应部件出现在飞机的正确局部位置和比例上

### Requirement: Damage presentation

模型 MUST 根据部件损伤状态表现受损、烟雾、火焰、失效挂点和死亡阶段，并且表现状态来自模拟结果。

#### Scenario: Damaged engine

- **WHEN** 发动机部件进入严重损伤
- **THEN** 对应位置显示烟雾或热量反馈，且反馈不会改变模拟状态

#### Scenario: Aircraft death

- **WHEN** 玩家或敌人进入死亡阶段
- **THEN** 模型显示坠落、旋转、爆炸或回收表现，并在实体移除后释放资源

### Requirement: Readable low-poly presentation

飞机模型 MUST 在目标移动端视口保持轮廓、机头方向、挂点和损伤层次可读。

#### Scenario: Narrow viewport

- **WHEN** 场景显示在 360×640 视口
- **THEN** 当前机体轮廓和主要部件仍然可辨识
