## ADDED Requirements

### Requirement: Surface contact and damage attribution

损伤事件 MUST 保留命中时刻姿态、可用接触点和实际扣血的大件。每处破洞 MUST 优先取接触在归属大件蒙皮上的投影。无法定位时在已知受损大件上随机选点，缺少部件归因时从本次承伤且仍附着的大件表面选点一次。

#### Scenario: Rigging before skin

- **WHEN** 弹道经过外露张线或结构空隙随后接触翼面
- **THEN** 仅在后续大件接触时扣血并在该大件上开洞，细件不参与分摊。

#### Scenario: Two holes, repair and separation

- **WHEN** 同一翼段两处受损，随后滚转、维修或脱落
- **THEN** 每处黑洞与自己的烟火共用位置和法线。近邻重复命中可加重原洞，维修逐洞减弱反馈，脱落碎片携带所属洞痕并拖烟。整机损毁先有爆点和碎片，随后下坠残骸拖淡烟。
