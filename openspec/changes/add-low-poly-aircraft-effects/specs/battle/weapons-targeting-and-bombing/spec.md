## ADDED Requirements

### Requirement: Per-projectile visual feedback

每发实际生成的枪弹 MUST 在发射时的对应枪口产生一个低面发光球和独立烟团。配置外抛壳的武器 MUST 从自身抛壳口产生翻滚下坠的弹壳。

#### Scenario: Banked salvo within one display frame

- **WHEN** 倾侧飞机的两个挂点在数个模拟步内各自发射
- **THEN** 画面保留各发弹的枪口、烟团和适用的弹壳。未发出弹体的挂点没有上述效果。

#### Scenario: Projectile travel and contact

- **WHEN** 枪弹、火箭、导弹或炸弹飞行并接触目标或地表
- **THEN** 枪弹携带前缘薄弧和曳光，火箭与导弹从导轨带出推进烟，炸弹从弹架释放，在实际落点起爆。接触位置按机体、地面或水面呈现爆点和对应的火花、碎屑、土尘或水花与适用残烟。
