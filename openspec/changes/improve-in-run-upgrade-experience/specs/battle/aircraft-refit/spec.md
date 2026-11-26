# Spec Delta

## MODIFIED Requirements

### Requirement: Legal upgrade choices

每次打开局内改装时，系统 MUST 提供三个互不重复且符合当前构型、前置条件、互斥关系、价格状态和叠加上限的升级候选。

#### Scenario: Unique legal choices

- **WHEN** 玩家拥有一次可用升级并打开改装界面
- **THEN** 界面显示三个合法候选，已安装且达到该机体叠加上限的升级不会继续出现

#### Scenario: Fallback choices

- **WHEN** 可用的唯一升级已经耗尽
- **THEN** 系统从合法的可重复升级中补足候选数量，并保留价格和支付状态

#### Scenario: First Fokker Dr.I refit

- **WHEN** 玩家首次打开福克 Dr.I 的局内强化
- **THEN** 提供快速供弹、额外散热器和一张由当前出击随机种子决定侧别的延长机枪段

#### Scenario: Fokker Dr.I battle and showroom pool

- **WHEN** 玩家查看福克 Dr.I 的后续局内强化或在展厅试装
- **THEN** 使用同一个机型卡池，提供供弹、左右下翼延长段、左右辅助螺旋桨发动机、散热器、冷却回路、弹药箱、重型装甲、快拆装甲带和机腹炸弹舱。卡面以三翼示意图标出受影响的部位

### Requirement: Refit changes the aircraft build

确认升级后，系统 MUST 按升级效果更新对应的部件、武器挂点、质量、尺寸、操控统计、碰撞区域或可用能力，并为每次新增结构建立独立的运行时部件身份。

#### Scenario: Structural upgrade

- **WHEN** 玩家确认安装发动机、机翼或装甲类升级
- **THEN** 机体构型和对应操控统计发生一致变化，新增部件具有独立生命状态

#### Scenario: Weapon upgrade

- **WHEN** 玩家确认安装武器或挂点类升级
- **THEN** 新武器挂点与所属部件建立关联，并参与后续开火和损伤规则

### Requirement: Build and presentation stay aligned

升级后的模拟构型 MUST 能被渲染层和局内 UI 读取并表达，玩家看到的机体轮廓、部件动画、武器挂点和属性摘要必须对应当前构型。

#### Scenario: Asymmetric build

- **WHEN** 玩家只在一侧安装发动机或机翼
- **THEN** 机体外观、左右操控差异和部件信息保持一致

#### Scenario: Armed extension on the Fokker Dr.I

- **WHEN** 玩家装上单侧延长机枪段
- **THEN** 新翼段插在对应下翼翼尖之前，新机枪随该翼段显示并从同一挂点开火。更高两层机翼和另一侧下翼保持原有位置

## ADDED Requirements

### Requirement: Upgrade selection preview

系统 MUST 在玩家选中候选时生成只用于展示的预览构型，预览不能改变正式模拟部件、武器、生命或操控状态。

#### Scenario: Select a candidate

- **WHEN** 玩家点击一个合法升级候选
- **THEN** 候选保持高亮，展示飞机显示新增部件和前后数值，正式模拟构型保持不变

#### Scenario: Switch candidate

- **WHEN** 玩家在同一次升级选择中点击另一个候选
- **THEN** 当前展示预览被替换为新候选，之前的预览部件和动画状态被清理

#### Scenario: Preview unavailable price

- **WHEN** 玩家选中价格高于当前本局金币的候选
- **THEN** 系统仍显示完整预览和价格差额，但确认安装不可用

### Requirement: Confirmed upgrade payment

系统 MUST 只有在玩家确认、候选仍然合法且本局金币足够时，才支付价格并安装升级。

#### Scenario: Confirm affordable upgrade

- **WHEN** 玩家确认一个合法且买得起的候选
- **THEN** 本局金币减少该升级价格，升级次数减少一次，正式构型提交一次变更并清空选择状态

#### Scenario: Reject unaffordable upgrade

- **WHEN** 玩家确认一个价格高于本局金币的候选
- **THEN** 系统不扣金币、不消费升级次数、不改变正式构型，升级面板继续显示

#### Scenario: Reject stale candidate

- **WHEN** 候选在确认前因构型或合法性变化而失效
- **THEN** 系统拒绝安装并重新生成合法候选，不产生部分提交

### Requirement: Cumulative structural stacks

数量增长类升级 MUST 使用每架机体可配置的叠加上限，默认最多十层。每次安装都必须保留独立部件、挂点、武器和损伤身份。

#### Scenario: Ten Fokker wing segments

- **WHEN** 玩家在福克 Dr.I 同一侧确认十次延长机枪段
- **THEN** 该侧累计增加十米翼段、十个独立机枪挂点和十个独立可损伤部件

#### Scenario: Stack limit reached

- **WHEN** 某机体的数量增长类升级达到配置的叠加上限
- **THEN** 该升级不再进入候选池，但其他合法升级继续可以出现

#### Scenario: Expanded weapon capacity

- **WHEN** 玩家安装一个会提供新武器容量的扩建段
- **THEN** 新增容量按扩建段配置增加，基础硬点数量不会阻止该段绑定自己的武器

