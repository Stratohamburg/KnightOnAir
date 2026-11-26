# Fokker Dr.I procedural reference record

This record controls the simplified generated model used by the prototype reference lab and the battle aircraft factory.

## Source qualification

| Field | Value |
| --- | --- |
| Prototype | Fokker Dr.I Dreidecker |
| Variant | 1917 production layout |
| Three-view drawing | [Fokker Dr.I drawing](https://commons.wikimedia.org/wiki/File:Fokker_Dr.I_dwg.jpg) |
| Three-view file | `Fokker_Dr.I_dwg.jpg`, 1204 × 895 px |
| Coverage | front, side, top |
| Volume source | [Hiller Aviation Museum replica](https://commons.wikimedia.org/wiki/File:1917_Fokker_Dr.I_replica_at_Hiller_Aviation_Museum.jpg) |
| Front source | [Dr.I replica front view](https://commons.wikimedia.org/wiki/File:Fokker_Dr.I_%27Dreidecker%27_triplane_replica_front_view.jpg) |
| Rear and tail source | [Hahnweide Dr.I](https://commons.wikimedia.org/wiki/File:Fokker_Dr.I_D-EFTJ_Hahnweide_2011.jpg) |
| Loading result | Verified in the reference card and used as the three-view authority |

The drawing controls proportional stations and straight leading edges. The photographs control the round rotary-engine cowling, open cockpit volume, interplane supports, landing-gear structure, and tail transition.

## Accepted H5 sheet and generated model

The user approved the simplified three-view plate and authorized model generation. All stations below are in plate units aft of the propeller plane. Height is measured above the shaft. One uniform scale maps the 253-unit length to 6 game units. The upper wingspan is consequently about 7.47 game units. The registered builder serves the reference lab and battle.

| Surface | Full span | Height | Root leading–trailing stations | Evidence |
| --- | ---: | ---: | --- | --- |
| Lower wing | 250 | −21 | 50–98 | Plan tip rows 420–670 |
| Middle wing | 272 | +21 | 36–87 | Plan tip rows 408–680 |
| Upper wing | 315 | +63 | 25–76 | Plan tip rows 386–701, outboard ailerons reach station 87 |
| Horizontal tail | 116 | +6 | starts at 175, lobes end at 244 | Accepted plan and side outlines |

The recorded tip readings are from the plan drawing. The front panel reprojects those spans. The round front section and wing attachment heights follow the review constraint. The hull has seven width/deck/belly stations, with a 42-unit circular section at station 18. The fin reaches station 253 and height 41. The wheel centers lie at station 42 and height −55. Strut diameters, hinge clearances, shell gauges, colors and cockpit interior are simplified presentation choices.

The main surfaces, hull sections and tail outlines come from [the variant sheet](../../src/data/fokkerDr1Sheet.ts). Base wing meshes consume the same clipped outlines as the part silhouettes. The generic feature plate, tier spacing and default tube do not supply these landmarks. Gameplay refits and unmeasured fittings retain their runtime conventions.

## Wing section, control surfaces and hull bays

The central rib detail labeled *Rippe des Ober-, Mittel- und Unterflügels* in the 1917 drawing supplies the section for all three wings. Its chord occupies roughly x=439–858 in the source. Read the two outlines against their common lower tangent. The section is about 12.5% chord thick around 20% chord and about 5% at 80%. The upturned lower outline makes maximum ordinate and local thickness different measurements. The plan sets each surface's outline and tip extensions. The upper ailerons include the projecting outer horns. The two elevator lobes meet the tailplane along a transverse hinge with an outboard step. The rounded vertical tail represents the all-moving rudder mounted at the tailpost. Surfaces are displayed in neutral position.

| Hull bay | Stations aft of the propeller | Boundary used in the model |
| --- | ---: | --- |
| Cowling | 8–18 | Nose face and aft rim in side and plan |
| Forward fuselage | 18–85 | Wing-root envelope to cockpit opening |
| Cockpit | 85–112 | Opening, deck dip and rear fairing |
| Aft fuselage | 112–175 | Cockpit rear to tailplane leading station |
| Tail attachment | 175–225 | Tailplane root to rudder post |

These are model assembly intervals. The rim follows a visible joint. The other boundaries use structural landmarks on the approved plate. Adjacent meshes share the same boundary ring. The plan rounds hinge locations to sheet units. Fabric tints distinguish movable portions and body sections for review.

## Extensible wing bays

Each half-wing carries its own root, load-bearing bay and terminal bay. The following assembly stations are distances outboard of the center plane in plate units. They use visible landmarks as modeling divisions. Each upper aileron belongs entirely to its terminal bay.

| Half-wing | Root | Load-bearing bay | Terminal bay |
| --- | --- | --- | --- |
| Lower | 0–21 | 21–109 | 109–125 |
| Middle | 0–21 | 21–109 | 109–136 |
| Upper | 0–38 | 38–48 | 48–157.5 |

The inner divisions follow the hull width or upper cabane attachment. The lower and middle terminal seams use the interplane strut station. The upper terminal starts just inboard of the aileron. Existing left/right extension cards select their respective lower wing line. Each 0.7-unit extension adds a new part at its terminal seam, with the adjoining rib, an independent hit region and a local mount. The base heat, damage and attachment ownership are held by the corresponding part.

## Historical discrepancy log

The model-space values below describe earlier revisions. The accepted sheet above controls the current geometry.

| View | Previous mismatch | Classification | Correction | Confirmation |
| --- | --- | --- | --- | --- |
| Front | The old shared tier formula collapsed the three layers into one unreadable band. | silhouette | Added independent y, chord, tip chord, and span values for all layers. | Fixed front view shows three separated wing bands and the two-wheel gear. |
| Side | The wing group sat aft and the propeller disk was placed behind the engine ring. | topology / assembly | Moved wing roots to measured z stations and placed ring, hub, and propeller at the tractor front. | Fixed side view shows the upper leading edge approaching the disk with a small clearance. |
| Top | Wing roots were offset from their centerline seam. | assembly | Structural wing parts now mount at station 0. Tip parts use the effective wing-line length. | Fixed top view shows continuous left and right root seams with zero sweep. |
| Top | Wings were rendered as a full-span trapezoid even though the drawing shows parallel edges. | silhouette | Kept chord constant through the main 82% span and moved taper into the rounded terminal tip. | Fixed top view shows near-rectangular planforms with parallel leading and trailing edges. |
| Front | The previous body profile narrowed to pointed nose and tail stations, making a long spindle silhouette. | silhouette | Replaced it with a broad center section, blunt engine-side nose, and gradual rear transition. | Fixed front and side views show the short, thick Dr.I body. |
| Front | Wing layers were separated by only about 0.43–0.45 units and their seam relationships were ambiguous. | silhouette / topology | Moved the layers to y=-0.58, 0.58, and 1.74, aligned the first two to the circular fuselage edges, and lowered the gear root to y=-0.72. | Fixed front view preserves the body-height offsets and lower-wing ground clearance. |
| Front | The previous abstraction treated the middle wing as a centerline layer and omitted the tail surfaces. | topology / feature map | Align the lower wing to the fuselage lower edge, the middle wing to the upper edge, raise the upper wing by one fuselage height, and add horizontal and vertical tail key lines. | The draft front and side feature panels expose all three wing layers and both tail surfaces. |
| Top | The previous abstraction separated the three wings along the longitudinal axis, making them appear as three independent planforms. | feature map | Keep the three top-view wing outlines nearly coincident and reserve only small station offsets. | The draft top feature panel reads the stacked wing group as one near-overlapping planform. |
| Front | The previous feature plate used an ellipse for the fuselage section. | silhouette / feature map | Use a circular front section and preserve elongated contours only in side and top views. | The front feature panel shows a round fuselage section. |
