# Spec Delta

## Purpose

定义跨局保存的机体解锁、装备选择、长期统计和设置状态，保证局内结果能够安全写回并在数据异常时维持可游玩性。

## ADDED Requirements

### Requirement: Persistent profile state

系统 MUST 保存当前装备机体、已解锁机体、最高分、最长时间、货币、出击次数和用户设置。

#### Scenario: Record a completed sortie

- **WHEN** 一局战斗结束并完成结算
- **THEN** 系统更新最高分、最长时间、货币、局外经验、出击次数和可解锁机体

#### Scenario: Restore the profile

- **WHEN** 玩家刷新页面或重新打开应用
- **THEN** 系统恢复上次有效的装备、解锁和设置状态

### Requirement: Safe equipment validation

读取档案时，系统 MUST 将无效装备回退为初始机体。执行装备操作时，系统 MUST 拒绝未解锁的机体。

#### Scenario: Unknown equipped aircraft

- **WHEN** 存档中的装备机体 ID 不存在或尚未解锁
- **THEN** 系统使用有效的初始机体并继续进入机库

#### Scenario: Locked aircraft cannot equip

- **WHEN** 玩家尝试装备未解锁机体
- **THEN** 装备操作失败，当前装备保持不变

### Requirement: Corrupt storage tolerance

存档内容损坏、版本不匹配或浏览器存储不可用时，系统 MUST 使用安全默认值并允许继续游玩。

#### Scenario: Malformed save data

- **WHEN** 存储中的数据无法解析或缺少有效版本
- **THEN** 系统加载默认档案且不会抛出阻止启动的错误

#### Scenario: Storage unavailable

- **WHEN** 浏览器拒绝读写本地存储
- **THEN** 应用进入会话级运行状态并明确记录无法持久保存

#### Scenario: Legacy version one profile

- **WHEN** 浏览器只有旧版 v1 存档
- **THEN** 应用使用默认 v2 档案开始运行

### Requirement: Settings persistence

画质、音效和触觉设置 MUST 在可用存储中持久化，并在下一次启动时应用。

#### Scenario: Change quality setting

- **WHEN** 玩家选择新的画质档位并关闭设置
- **THEN** 当前渲染器立即使用新档位，下一次启动继续使用该档位
