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
| Fuselage construction | tube / integratedWing |
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
|  |  | three-view / photo / reviewer constraint |  | front / side / top |  | measured / photo-supported / review-constrained / estimate / preset-fallback |  |

## Low-poly treatment

Use the same feature IDs as the evidence matrix. Group cosmetic repetitions in one row. For a protected edge, give the accepted landmark or relationship and its controlling view. For a sampled curve, compare the measured error in drawing units with the recorded tolerance. For a surface cue, record where it must remain legible.

| Feature | Landmark or cue to preserve | Representation (geometry, material, shading, omit) and reason | Confirming view or display scale | Observed result |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

## Preset audit

Search the implementation and record every candidate preset before approval.

| Candidate path | Search result | Selected value | Why the drawing could not resolve it | Owner and review date |
| --- | --- | --- | --- | --- |
| generic body, wing, tier, span, symmetry, or feature plate | rejected / selected |  |  |  |

## Discrepancy log

| View | Observed mismatch | Classification | Change | Evidence after change |
| --- | --- | --- | --- | --- |
| Front |  | source / silhouette / topology / module / assembly / camera |  |  |
| Side |  | source / silhouette / topology / module / assembly / camera |  |  |
| Top |  | source / silhouette / topology / module / assembly / camera |  |  |
