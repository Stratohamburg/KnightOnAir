# Spec Delta

## Purpose

原型校验台用于按历史时代浏览已入档的飞机原型，并在同一详情页核对指定变体的原始参考、抽象三视图、模型与结构记录。

## ADDED Requirements

### Requirement: Browse the historical prototype catalog

校验台 MUST 以已入档的历史原型为选机范围。机型目录 MUST 按历史时代排序，每项显示机型名、时代标签和选中状态。同一时代内沿用档案顺序。

#### Scenario: Browse aircraft with and without game counterparts

- **WHEN** 参考档案包含仅供校验的历史原型、已有游戏机体映射的历史原型和待补齐图板的历史原型，游戏机体目录另含没有历史参考记录的架空机体
- **THEN** 校验台仅列出已入档的历史原型，并使用其历史时代显示标签

### Requirement: Navigate the catalog and selected details

宽屏布局 MUST 提供左侧单列纵向滚动目录与右侧独立滚动详情。窄屏下 MUST 能从左侧打开纵向目录，并在选机后收起目录以展示详情。

#### Scenario: Compare aircraft from the end of a long catalog

- **WHEN** 用户滚到目录末尾，阅读某机型下方资料后选择另一个机型
- **THEN** 目录保留滚动位置，选中项更新，右侧详情回到顶部并展示新机型

#### Scenario: Select an aircraft on a narrow screen

- **WHEN** 用户从窄屏详情打开目录、纵向滚动并选中一个机型
- **THEN** 目录收起，详情从所选机型的首块开始显示，重新打开目录时仍能看到当前选中项

#### Scenario: Open an existing frame link

- **WHEN** 用户通过已有 `frame` 链接打开一个仍在目录中的原型
- **THEN** 校验台选中该原型并使其目录项可见。链接无法解析时打开默认原型

### Requirement: Switch between feature plate and model

详情 MUST 在下方资料之前提供共用预览区，顶部仅有「2D 抽象三视图」与「3D 模型」两个页签。预览 MUST 从所选变体的抽象三视图开始，生成条件已满足时用户 MUST 能直接选择 3D 页签打开预览，3D 页签为唯一的模型预览入口。

#### Scenario: Open the model of an approved variant

- **WHEN** 用户选中生成条件已满足的变体，并点击「3D 模型」页签
- **THEN** 预览区打开该变体的 3D 模型，提供正视、侧视、俯视、重置与拖动环绕，并允许切回同一变体的 2D 图板

#### Scenario: Open a variant with pending evidence

- **WHEN** 用户打开已有参考档案但缺少原始线稿、变体图板、审核或其他必需生成资料的原型
- **THEN** 2D 区域说明具体欠缺项，仍展示该原型已有的图板与下方资料，3D 页签等待生成条件满足后启用

#### Scenario: Compare a pioneer airframe with its source drawing

- **WHEN** 用户通过机型目录、历史档案 ID 或独立机体 ID 打开已注册的早期机型
- **THEN** 三个入口定位到同一变体。用户可叠加或隐藏本地参考原稿，检查各视图、图纸测点和构型取舍。资料仅含局部或透视时，图板标明实际覆盖范围
- **AND** 校验台和机体工厂按该机型的待核对项控制三维生成

#### Scenario: Inspect a variant with reviewer-authorized approximations

- **WHEN** 用户允许按现有图照近似缺项，且所选变体已注册专属校验装配器
- **THEN** 图板列出该机采用的近似，3D 页签显示可旋转的装配模型和正、侧、俯固定视图
- **AND** 已配准的正交图可以叠加当前网格投影。照片和透视图保留原始投影。校验模型的授权独立于可出击配置的几何验收

#### Scenario: Read the structure with the original drawing hidden

- **WHEN** 用户关闭有蒙皮、外露桁架和张线机型的原稿叠加
- **THEN** 图板显示蒙皮外缘、开放构架的杆件和可见钢索的走向与连接点，索围成的区域保持通透
- **AND** 中立翼形采用史料支持的姿态，原图的左右读数、飞行或展示照片及其适用范围可供对照

#### Scenario: Change aircraft after opening the model

- **WHEN** 用户打开一个原型的 3D 模型后选择另一个原型
- **THEN** 上一个原型的预览实例被释放，新原型从 2D 页签开始，3D 页签按新原型的生成条件启用

### Requirement: Inspect selected prototype records below the preview

详情 MUST 在预览下方展示所选原型已有的参考原稿与来源、照片与署名、结构校验、审核记录和改装参考。结构校验节点 MUST 能与已打开的 3D 模型部件联动。适用的翼段试装操作 MUST 从该变体的 3D 工具区进入。

#### Scenario: Compare the original drawing and the abstract plate

- **WHEN** 用户浏览录入原始三视图与抽象图板的原型
- **THEN** 原始三视图及其来源链接出现在资料区，抽象三视图单独出现在 2D 预览页签

#### Scenario: Inspect and refit a supported model

- **WHEN** 用户打开 Ho 229 V2 的 3D 模型，选中结构节点或使用翼段试装入口
- **THEN** 模型高亮对应部件或显示试装后的预览构型，改装路线说明可在下方资料中查阅
