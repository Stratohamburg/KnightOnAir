---
name: aircraft-reference-pipeline
description: Build or review a reference-based low-poly aircraft in KnightOnAir. Use for variant-specific three-view abstraction, silhouette and section fidelity, articulated or extensible modules, and in-game visual acceptance.
---

# Aircraft Reference Pipeline

Use the variant's approved landmarks to control the procedural model. Apply low-poly styling through the placement of vertices, shading and surface detail. Keep variant measurements, assembly seams and accepted estimates in its own record.

When a generated model fails review, identify the last accepted H5 decisions. Trace each discrepancy from the mesh back to a specific measurement, section, interface, or transform. Return unsupported decisions to the H5 plate and keep generation closed until those decisions are resolved.

## Establish the reference

- Read `AGENTS.md` and the affected OpenSpec scenarios. For runtime content read `.agents/skills/runtime-content-library/SKILL.md` and `openspec/specs/rendering/runtime-content-library/spec.md`. Consult `docs/GAMEPLAY_DESIGN.md` when changing build identity or module growth, and `docs/aircraft-profiles/README.md` for three-view profile conventions.
- Identify the exact variant and depicted state, including gear position and control deflection where these affect the outline. Register front, side and plan panels in one coordinate system. Record orientation, scale, datum and source line thickness. Check a suspect discrepancy against variant, pose and panel scale.
- Name each visible module and its parent. Match each landmark in two independent source views wherever visible. Check lateral coordinates in front and plan, heights in front and side, longitudinal stations in side and plan. For occlusion, use a section detail, dimension, qualified photograph or explicit review constraint. Reprojection of a single measurement verifies consistency only.
- Identify measurements, photo-supported decisions, reviewer constraints and unresolved fields in the [profile record](references/aircraft-profile-template.md). Use variant-specific evidence for every field that affects the generated model. If a field remains unresolved after checking the available sources, record it and keep the generation gate closed until a source or an explicit review constraint resolves it.
- Collect evidence for the applicable [effect landmarks](references/aircraft-profile-template.md#effect-landmarks-on-the-plate) during reference intake. Record the source and unresolved details while the dossier is still at the research stage. A configured approximation is a gameplay annotation and needs its own basis in the record.

## Check left-right symmetry

- Check bilateral symmetry for every new base variant in its documented configuration. Establish the aircraft center plane from body or datum evidence independently of the pair being checked. Compare separately traced left and right contours in the registered front and plan views. Check corresponding tips, roots, module positions and boundaries along their visible lengths. Compare lateral offsets from the center plane, front-view heights and plan-view longitudinal stations.
- Record the raw readings, paired differences and tolerance in the profile record. Base the tolerance on the source resolution, line thickness and registration uncertainty. When evidence establishes a drawing error on a symmetric part, fit one contour to the verified landmarks and mirror it across the center plane. Use the corrected geometry in the default review plate and preserve the original traces for comparison. Missing measurements still require variant-specific evidence.
- Recheck deviations beyond tolerance for drawing distortion, scale, pose and configuration, then consult independent evidence for the same variant and configuration. Keep unresolved deviations pending. When the evidence confirms a real asymmetry, show the user the location, size and supporting evidence, and record their decision before finalizing the feature plate or generating the model.

## Decide what the geometry must carry

For each candidate simplification, ask what changes in a fixed view, at gameplay size, or when the affected part moves, extends or detaches. Group repeated details when the answer is the same.

| Effect of simplifying the feature | Generation decision |
| --- | --- |
| Changes the silhouette, a defining section, a visible opening or the space between major parts | Preserve it in geometry. Pin extrema, changes of slope, section maxima, attachment points and gap boundaries before reducing intermediate samples. |
| Changes which part owns a surface, hinge, tip or mount | Preserve the boundary and its parent in assembly data. Keep the required independently moving or detachable geometry, even where adjacent surfaces share a color. |
| Changes a visible surface cue while the outline, depth and module behavior are preserved | Use a material boundary, a change of normal or a shallow modeled seam according to its appearance at display scale. |
| Adds repetition below the intended viewing scale | Combine or omit it. For example, a row of flush rivets can disappear. A small horn that extends a control surface's silhouette retains its endpoint. |

Record the controlling view, protected landmarks and chosen representation for the features that distinguish this variant. Counts, attachment relationships, span order and presence or absence are exact. For sampled curves use a stated drawing-space tolerance justified by the source resolution. Keep confirmed proportions when applying era palettes or general art guidance about exaggerated thickness and cockpit size.

## Build and review the H5 plate

Trace the outer covering of each fabric, wood or metal panel. For uncovered
bays, draw the exposed longerons, posts and braces and leave the space between
them open. Follow visible bracing and control wires to their actual fittings,
including mast heads and points outside the covered outline. Check the plate
with its source hidden so the assembly and wire routes remain legible. When a
wing can warp or flex, identify the depicted load and control state before
using an apparent difference in tip height as the neutral shape.

Trace every defining contour in order in its controlling view. Mark intermediate corners, shoulders, extrema, inflections and transitions into or out of curves. Check straightness against the exposed edge along the entire proposed segment. Carry these ordered landmarks into the H5 plate and the model. Use the [edge sampling procedure](references/module-edge-record.md) when deciding which intermediate vertices a low-poly outline needs.

Build the plate legend from the [three-view part inventory](references/aircraft-profile-template.md#three-view-part-inventory). Establish the architecture and configuration from sources first. Expand only the matching branches, separately for each installation on a mixed aircraft. Within each active branch, search for both required and optional items in the variant drawings, technical records and identified historical photographs.

- **Required.** Locate and label the item. If the branch itself or a required landmark remains ambiguous after research, record the sources and ask the user. Keep that decision open until resolved.
- **Optional.** When found, label the item. When the search yields no evidence of its presence, record the sources checked and treat it as absent for this build. This completes the item without a question or a generation hold. A positively identified part with an obscured attachment counts as present. Resolve that attachment if the model or requested animation depends on it.

Use the [Dr.I review plate](../../../src/content/2d/fokkerReviewPlate.ts) as the project's visual convention for H5 module annotations. Give each visible module a distinct outline color and fill its visible area translucently. Reuse that color for its callouts and legend entry across all three projections. Show line-like parts such as probes along their actual trace. Keep hinges and seams readable between adjacent regions.

Give each included subpart its own label and the same identifier across views. Anchor a leader to the actual outline, opening, axis or attachment in the views that locate it. Use a keyed detail or section for crowded or concealed features. Carry labeled parent and motion boundaries into the model so that a wheel, strut and door can move independently where the evidence shows that relationship.

Cross-check the inventory against this variant's eligible upgrade cards, supported presentation states and distinguishing photographic details. For each visible change, identify the existing plate part or the attachment for a new one, its before/after appearance and the view that reveals it. Keep the base drawing legible using keyed refit, motion or damage overlays as needed. Record the [state-to-part mapping](references/aircraft-profile-template.md#visible-changes-by-state) before building the affected feature.

Check the variant drawing against technical documentation and identified period photographs. Cite the sheet, page, figure or photo and the landmark it establishes. Distinguish a documented absence from an obscured part and an unknown location. If research leaves a required part, position or movement ambiguous, mark it unresolved and ask the user about that specific decision. Include the relevant crop or source, what it establishes and what is still missing. Use a prior explicit decision when it already covers the question.

1. Trace each lifting surface's root, tips, leading and trailing edges, stagger, overlap and supporting structure. Sample both skins from a rib detail where available. Record maximum thickness and its chord station. Locate control hinges, moving outlines, fixed neighbors and any all-moving surface.
2. At common stations read hull or nacelle half-widths from plan and deck and belly heights from side. Use front or section details for the section shape. Locate cockpit openings, propulsion axes, disk or outlet planes and tail attachments. Record physical joints and game assembly divisions separately. Use the [module edge record](references/module-edge-record.md).
   When the airframe conceals an engine or part of an opening, use the [concealed engine procedure](references/module-edge-record.md#locate-a-concealed-engine) to mark its estimated position on the plate.
3. Project the generation inputs into the aircraft-specific H5 front, side and plan panels. Show the main component landmarks and add section cuts or interface details where an outline alone leaves the surface ambiguous. Compare the registered originals, corrected contours and proposed points in the same coordinates. Expose any proposed change to a measured extent, contour family, or part boundary before using it in a mesh.
4. Record which decisions the user accepted and the evidence for each required generation input. Approval of a silhouette covers the visible decisions shown on that plate. Resolve new section shapes, disputed stations and hidden joins with qualified evidence or an explicit user-approved constraint. An instruction to proceed authorizes generation from the resolved sheet and carries forward the decisions already accepted. Keep both the preview and production gates closed while required geometry has an `estimate` or `unresolved` status.

## Plan upgrades before placing assembly cuts

Read the [aircraft refit spec](../../../openspec/specs/battle/aircraft-refit/spec.md), the gameplay build roles and the [upgrade catalog](../../../src/data/upgrades.ts) for a playable aircraft. Record its starting loadout, build role, recommended opening upgrades and later growth direction in the [installation and refit record](references/aircraft-profile-template.md#installation-and-refits). Check eligibility, prerequisites, exclusions, capacity and repeat limits against the existing configuration. Keep historical measurements and gameplay decisions in separate fields. A reference-only dossier can record candidate interfaces with their planning status.

For a structural refit, sketch the starting state and a representative installed state on the same datum before cutting the model. Mark the receiving part, side or layer, insertion seam or local anchor, facing, clearance, and the parts and effect origins that move. Plan the changes to silhouette, collision, damage ownership and visible feedback. Record internal or stat-only upgrades with their configured feedback.

## Assign damage ownership on the plate

Use the [aircraft damage spec](../../../openspec/specs/battle/aircraft-damage/spec.md) and the [damage ownership record](references/aircraft-profile-template.md#damage-ownership). Map each visible item to its model parent, then record which configured part owns its collision region and which exterior meshes can host holes. Configured major assemblies can carry independent damage. Rigging, control cables, thin struts, pitot tubes and small fittings are attached details. Exclude their geometry and the gaps between major assemblies from collision coverage, local damage allocation and damage-surface registration. Attached details can still move with their host and carry airflow landmarks.

## Generate the low-poly assembly

Register only the approved exterior skins in the damage-surface list. Keep each skin on its configured part and verify that the simulation collision coverage and the rendered damage surfaces agree on part ownership. For detachable parts, preserve the separation seam and the surfaces and effect origins that travel with the part.

Record effect landmarks on the annotated plate and carry their stable part-local IDs into the generated configuration. Use the effect landmark table in the [profile record](references/aircraft-profile-template.md). Trace primary and tail tips, wing-flow regions and each exposed protruding point on the installed parts, including movable and detachable fittings. Assign protrusions a weaker but clearly visible stream than the main tips. Identify damageable surface regions and outward normals that can host multiple separate holes on one part. Also locate propulsion and weapon origins for the fitted equipment. Check the assembled result in the banked combat view against the [aircraft effects guide](../../../docs/RENDERING_GUIDE.md#飞机-3d-low-poly-特效制作与验收).

- Family-level or era-level assemblers are opt-in helpers. Do not register one as a fallback for a reference variant. Every generated variant requires an explicit model registration that points to its reviewed, variant-specific builder. If that registration is missing, keep the 3D preview blocked and return the missing-builder state.
- Resolve the local surface at each defining turn. A kink in one projection locates a change of outline. Check the adjacent sections and a second view for a crease, a bounded flat face or a smooth blend. Store its geometry and shading decision with that variant and part. Shared mesh helpers take these local inputs explicitly. See the [turn construction procedure](references/module-edge-record.md#construct-the-surface-at-a-turn).
- Use the variant's registered builder and one uniform conversion into local axes (lateral x, vertical y, nose +z). Read the H5 and mesh inputs from the same resolved station and section data. Confine interpolation to documented intervals and preserve their endpoints, extrema and interface positions. Preserve tangent transitions on rounded forms and use hard normals at documented creases.
- Give each structural part its configured ID, attachments and section boundaries. Adjacent bays share their interface ring or rib. Derive mesh contours, hit regions and anchors from the same station data. Preserve catalog leases and independent state for detachable parts.
- For extensible wings, compute each new station from the measured local direction of the receiving panel. Carry downstream wing sections, tips, attached controls and anchors through the same placement. Track both edges through the full extended half-wing. Two coincident seam endpoints can still create a kink or reverse the sweep between them. Use the [refit checks](references/three-view-checklist.md#installation-and-refit-checks) on the normal upgrade path.
- Mark planform and elevation breaks separately. Read each panel's leading-edge sweep in plan and its dihedral or anhedral in front. Preserve the incoming and outgoing directions at a shared break. At an insertion seam, follow the selected structural line's local direction and join the matching section.
- For a wing-mounted engine, resolve the host skin, housing, inlet and outlet or propeller disk separately. Cut a section through the axis to locate the exposed lip, steps, openings and surrounding skin. When a refit installs another instance of the same unit, reuse its dimensions and internal spacing. Compute its mount position from the receiving bay and its facing from the recorded axis. Verify the visible opening and effect anchor together.

## Accept the generated result

Use the [review checklist](references/three-view-checklist.md) with the project's [low-poly presentation criteria](../../../openspec/specs/rendering/procedural-aircraft/spec.md).

- Export or render the **assembled mesh** in registered front, side and top orthographic views. Overlay it on the accepted H5 plate at the same scale, datum and pose. Record controlling landmarks, maximum edge deviations between them, section cuts, openings and joins for each major module. An orbit view and mesh sanity tests support this evidence. Geometry acceptance requires the registered overlays and measurements. Follow the [review checklist](references/three-view-checklist.md) for the checks and the [profile record](references/aircraft-profile-template.md#mesh-acceptance) for the results.
- Inspect the finished material in the showroom and at normal battle-camera distance in the 360 × 640 viewport. Check nose direction, the variant's identifying features and major modules under gameplay lighting. Resolve clutter or disappearing detail through representation, contrast and shading while keeping the approved outline.
- Run the [damage and refit checks](references/three-view-checklist.md#damage-ownership-checks) on the assembled model. In the workbench's effects and damage-surface plate, review the origin, direction and owner of each applicable effect. Trace any configured approximation back to its recorded basis.
- Trace the reference and runtime entry points for inherited defaults. Remove any inherited geometry from the generated base configuration and check it separately from refitted or damaged states. Record discrepancy, evidence, correction and confirming view. Report unverified measurements as such and keep the generation gate closed until they are resolved.
