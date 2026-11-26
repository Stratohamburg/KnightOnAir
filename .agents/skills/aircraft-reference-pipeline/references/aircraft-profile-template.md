# Aircraft Profile Record

Use one record per real aircraft variant before editing the geometry profile or factory.

## Source

| Field | Value |
| --- | --- |
| Prototype |  |
| Variant |  |
| Depicted configuration and pose |  |
| Three-view source |  |
| Photo sources |  |
| Source qualification | front / side / top / volume / engine / tail |

## Envelope ratios

| Measure | Normalized value |
| --- | --- |
| Overall length | 1.00 |
| Wingspan / length |  |
| Maximum fuselage width / length |  |
| Maximum fuselage height / length |  |
| Cockpit station / length |  |
| Wing-root station / length |  |
| Tail station / length |  |

## Architecture

| Field | Value |
| --- | --- |
| Layout | conventional / twinBoom / flyingWing |
| Body construction | separate fuselage / flying-wing center section / variant-specific |
| Main centerline |  |
| Secondary centerlines |  |
| Wing-root relation | branch / parallel / vertical / longitudinal |
| Tail relation |  |

## Module contract

| Module | Shape | Parent line or node | Relative position | Growth rule |
| --- | --- | --- | --- | --- |
| Center body |  |  |  |  |
| Main wing |  |  |  |  |
| Tail or boom |  |  |  |  |
| Engine |  |  |  |  |
| Cockpit |  |  |  |  |
| Weapon mount |  |  |  |  |

## Three-view part inventory

Select paths from the exact variant and depicted configuration. A child inherits its parent's applicability. Skip an inactive subtree as a unit. If the sources leave a choice between two required branches open, ask the user after checking them. For mixed propulsion or mixed landing gear, follow the path for each installation separately.

| Active path | Required items to locate or ask about | Optional items to look for and omit if unfound |
| --- | --- | --- |
| Airframe → layout and control system | Main lifting surfaces, actual control surfaces and their boundaries. Conventional layout → fuselage and wings. Flying wing → central wing, outer panels and tips. Stacked wings → each layer, its attachment and supporting arrangement. Tailed layout → the fitted tail surfaces and their fixed or moving boundaries. | Additional struts, bracing wires, fairings, trim tabs, slats, flaps, spoilers, airbrakes and folding mechanisms beyond the established layout. |
| Crew → crewed | Cockpit position and opening. Enclosed cockpit → glazing and frame boundaries. Opening canopy → fixed and moving portions and the motion needed for the depicted state. | Separate windscreen on an open cockpit, mirrors and secondary glazing details. |
| Propulsion → jet | Engine position, intake lip, intake duct and tail nozzle. | Auxiliary intake doors, auxiliary scoops and adjustable nozzle features. |
| Propulsion → propeller | Engine position, propeller position, hub and rotation axis. Piston → cylinder arrangement and engine exhaust pipes or outlets. Turboprop → turbine intake and exhaust. For another drive type identify its own installation. | Spinner, separate cowling panels, cowl flaps and auxiliary cooling outlets. |
| Landing arrangement → installed type | Identify the installation and its airframe attachment. Wheels → tire, hub, axle and support at each station. Retractable → retraction attachment and motion needed for the requested animation. Floats, skis or skid → corresponding body and supports. | Gear doors, wheel fairings, secondary braces, float steps and water rudders. A documented door activates its own fixed or moving attachment and, for animation, its pivot or slide. |
| Starting loadout → configured state | Establish whether the default is armed or unarmed. Armed → configured items, counts, side and visible mounting locations. Record the historical fit and game loadout independently. | Additional external racks, pylons, tanks and fairings outside the specified starting equipment. |
| Equipment and surface details → applicable host | If the variant record, user or selected gameplay state establishes a feature, locate its host and the landmarks needed to depict it. For a refit-only feature, apply this requirement in the refitted state. | Search for cooling equipment, antennas, radomes, probes, lights, special landing equipment, protection, distinctive material changes and access panels. Use the detailed rows below for coverage. |

For each optional search that finds nothing, enter **treated absent after search** and the sources checked. Use **documented absent** when the sources explicitly establish absence. An unchecked item still needs research. For several installations, identify the side, layer or station. Use the following details to draw the features included by the tree.

| Assembly | What to label on the registered plate |
| --- | --- |
| Primary structure | Label fuselage and wings separately on a conventional aircraft. On a flying wing, classify the central lifting section, outer panels and tips as wing. Give the cockpit, engines and other installations their own labels under the appropriate host section. |
| Tail and controls | Locate the fixed tailplane and fin where fitted. Identify each applicable aileron, elevator, rudder, elevon, flap or airbrake. Trace its moving outline and hinge line and name the fixed neighbor. Record an all-moving surface as one moving part. |
| Cockpit | Mark the cockpit opening, fixed windscreen and movable canopy portions where fitted. Locate the canopy hinge or slide direction when its movement is evidenced. |
| Jet installation | Mark the engine position, intake lip, intake duct and tail nozzle individually. Identify the duct extent established by the sources and the outlet plane. A section or cutaway can locate an internal run hidden in all three exterior views. |
| Propeller installation | Mark propeller position, hub and rotation axis, engine position and cowling boundary. For a piston engine, identify the cylinder bank or radial cylinder group and the exhaust pipes, including visible outlets. Use an identified engine detail for covered features. Record the applicable exhaust arrangement for other propeller powerplants. |
| Landing gear | Identify each main, nose or tail assembly. Give the tire, hub and axle, supporting leg and braces, and each fitted gear door distinct labels. Mark the fixed airframe attachment, the wheel spin axis, and the evidenced pivots or sliding axes. Identify a fixed fairing, a door carried by a leg, and an independently hinged door according to their actual attachments. |
| Default armament | Mark the visible location of each item in the starting loadout, its count, side and parent on the model. Identify a game-specific default with its configuration or user decision. Cite historical evidence separately for the prototype fit. |
| Supports and detachable equipment | Trace the ends of visible struts, bracing wires, boom bridges and float or ski supports. Mark removable racks, pylons, fairings and external tanks where fitted. Identify the host fitting that stays when the attached item moves or leaves. |
| Cooling and adjustable openings | Locate each radiator, oil cooler, scoop, outlet, bank of louvers or cowl flap involved in the outline or a supported state. Mark the fixed frame, movable leaf and open/closed outline where evidenced. Identify the purpose of similar-looking openings from the variant documentation. |
| Sensors, lights and probes | Locate exposed antenna masts and wire endpoints, radome boundaries, pitot probes, navigation and landing lights where they identify the variant or supply a visible effect. Record the side, base, lens or emitter and whether a tip extension carries the fitting. |
| Auxiliary moving surfaces and special equipment | Check for leading-edge slats, spoilers, trim tabs, folding panels, retractable landing lights, arrestor hooks, tail skids or water rudders as applicable. Label the nesting recess, stowed outline and deployed extremity when these explain the motion or silhouette. |
| Surface construction and protection | Mark changes between fabric, wood, metal and glazing, frame or rib impressions, exposed panel lips, armor plates and distinctive access covers where photographs support them. Record which cue needs thickness, a shadow gap, a material boundary or a texture at the intended display scale. |

For each moving item record its parent, fixed attachment, pivot or slide axis, and which other parts travel with it. Record the depicted pose and any other documented end pose. A deployed-gear photo can establish visible attachments while leaving the retraction path open. Use a keyed hidden-line overlay for known concealed geometry. Mark a required but unknown feature in the inventory and bring it to the user with the available evidence.

| Branch path / part ID | Required or optional | Parent and side | Views and landmark | Visible / documented hidden / documented absent / treated absent after search / unresolved | Motion and pose | Sources checked or user decision |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |

## Installation and refits

For a configurable aircraft, list the starting parts and counts by parent, side and layer. Identify the source of each choice as a prototype feature or a gameplay decision. Fill one row for each distinct insertion rule. A repeated unit can keep its dimensions while its mount changes position along the wing.

| Upgrade and quantity per use | Parent line and insertion seam | Dimensions and internal spacing to reuse | Controlling edge, station and facing | Parts displaced and lines held fixed |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

For an embedded installation, attach the axial section that shows the host skin, housing termination, opening plane and clear space beyond it. Include a top view of the expected refit with the inboard mount, added mount and terminal bay marked. Record the expected change in lateral, vertical and fore/aft position in the local axes that apply.

## Visible changes by state

Start from the variant's eligible cards and the behaviors used in the requested build. For a replacement, identify the original part and the outline, material or movement that changes. For an addition, mark the empty base interface, new geometry and downstream attachments. For an internal or stat-only change, record the configured feedback, including a UI-only presentation where appropriate. A gameplay description establishes the intended change. Use the plate or an explicit design decision to locate its appearance on this airframe.

| Upgrade ID or state | Plate part ID and parent | Default appearance → changed appearance | Seam, pivot or local effect origin | Confirming view, source or game decision |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

For a configured damage or detachment effect, identify the owning game part, its separation seam, the surface exposed in the model, attachments that leave with it and any effect that follows or stops. For a light or engine effect, place the origin on the visible lens or outlet and record its facing. Inspect the two states from the same camera. Label game-authored damage boundaries and upgrade fittings as gameplay decisions. Cite period evidence for claims about the physical aircraft.

## Effect landmarks on the plate

Record a row for each applicable mount, outlet, propeller disk, aerodynamic point or wing-flow region. Include secondary flow from exposed protrusions on each fitted module. For damageable surfaces record the region and outward normal, including distinct fallback sites for unattributed contact positions. Keep these gameplay annotations separate from historical measurements.

| Landmark ID / plate view | Owning part and side or layer | Local point, axis or region | Effect and strength relative to main tip | Moves or leaves with | Combat-view check |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |

## Module edge record

Record one row per visible structural layer. Values are normalized to the chosen three-view drawing unless the implementation profile uses a documented gameplay unit.

| Module or layer | Leading edge | Trailing edge | Upper / lower edge | Root seam | Tip edge | `y` / `z` station | Parent and clearance |
| --- | --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |  |

For stacked wings, record every layer separately. Include sweep, root chord, tip chord, span, and any front or lower support that is visible in the source.

For a defining boundary, preserve its ordered source landmarks so it can be reconstructed and checked between its endpoints.

For a turn that affects the visible surface, attach its before/at/after section readings and the confirming view. Identify the ridge, the bounds and runout of a flat face, or the tangent transition. Record the intended normal continuity and any uncertain dimension with this specific part.

| Module / edge / view | Ordered stations and coordinates | Corners, smooth transitions or hidden intervals | Largest interior deviation / station / tolerance |
| --- | --- | --- | --- |
|  |  |  |  |

## Evidence matrix

Use one row for each visible decision. The same module name must be reused in all projections.

| Module | Decision | Primary source | Source location | Confirming views | Value and units | Status | Notes or unresolved edge |
| --- | --- | --- | --- | --- | --- | --- | --- |
|  |  | three-view / photo / reviewer constraint |  | front / side / top |  | measured / photo-supported / review-constrained / estimate / unresolved |  |

## Left-right symmetry check

Record the source and pose, the independent center-plane datum and the tolerance in drawing units. Explain how source resolution, line thickness and registration uncertainty affect the paired comparison. Keep the original left and right readings. For edges, identify the checked interval and its greatest deviation. Link any reconciled points to the supporting evidence and record the user's decision for each confirmed asymmetry before finalizing the plate.

| View / feature | Left source reading | Right source reading | Paired difference / tolerance | Evidence and disposition | User decision if asymmetric |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  | within tolerance / pending / confirmed asymmetry |  |

## Low-poly treatment

Use the same feature IDs as the evidence matrix. Group cosmetic repetitions in one row. For a protected edge, give the accepted landmark or relationship and its controlling view. For a sampled curve, compare the measured error in drawing units with the recorded tolerance. For a surface cue, record where it must remain legible.

| Feature | Landmark or cue to preserve | Representation (geometry, material, shading, omit) and reason | Confirming view or display scale | Observed result |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

## Generation gate

Every field that affects geometry, topology, anchors or part ownership MUST have a measured, photo-supported or explicitly review-constrained value before the model is generated. Record the accepted H5 revision or approved fields, and link the sheet consumed by the builder. Record estimates and unresolved required fields here. The preview and production gates remain closed until each required field is resolved.

| Field | Missing evidence | Required source or review constraint | Status |
| --- | --- | --- | --- |
|  |  |  | unresolved |

## Mesh acceptance

Attach the assembled-mesh overlays for the registered front, side and top views. For each major module, record the worst visible edge deviation, its station and the tolerance used. For each defining section or interface, attach a section cut or detail and record the measured extrema, opening, gap or boundary.

| View or section / module | Accepted datum and reference | Mesh measurement or maximum deviation | Tolerance / result |
| --- | --- | --- | --- |
|  |  |  |  |

## Discrepancy log

| View | Observed mismatch | Classification | Change | Evidence after change |
| --- | --- | --- | --- | --- |
| Front |  | source / silhouette / topology / module / assembly / camera |  |  |
| Side |  | source / silhouette / topology / module / assembly / camera |  |  |
| Top |  | source / silhouette / topology / module / assembly / camera |  |  |
