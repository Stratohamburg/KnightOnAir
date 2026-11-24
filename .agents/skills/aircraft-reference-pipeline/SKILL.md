---
name: aircraft-reference-pipeline
description: Build or review a reference-based low-poly aircraft in KnightOnAir. Use for variant-specific three-view abstraction, silhouette and section fidelity, articulated or extensible modules, and in-game visual acceptance.
---

# Aircraft Reference Pipeline

Use the variant's approved landmarks to control the procedural model. Apply low-poly styling through the placement of vertices, shading and surface detail. Keep variant measurements, assembly seams and accepted estimates in its own record.

## Establish the reference

- Read `AGENTS.md` and the affected OpenSpec scenarios. For runtime content read `.agents/skills/runtime-content-library/SKILL.md` and `openspec/specs/rendering/runtime-content-library/spec.md`. Consult `docs/GAMEPLAY_CORE.md` when changing build identity or module growth.
- Identify the exact variant and depicted state, including gear position and control deflection where these affect the outline. Register front, side and plan panels in one coordinate system. Record orientation, scale, datum and source line thickness. Check a suspect discrepancy against variant, pose and panel scale.
- Name each visible module and its parent. Match each landmark in two independent source views wherever visible. Check lateral coordinates in front and plan, heights in front and side, longitudinal stations in side and plan. For occlusion, use a section detail, dimension, qualified photograph or explicit review constraint. Reprojection of a single measurement verifies consistency only.
- Identify measurements, photo-supported decisions, reviewer constraints and unresolved estimates in the [profile record](references/aircraft-profile-template.md). Use a preset only for a field that remains unresolved after checking the available sources. Log that field, the missing evidence, the value and what would replace it.

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

Trace every defining contour in order in its controlling view. Mark intermediate corners, shoulders, extrema, inflections and transitions into or out of curves. Check straightness against the exposed edge along the entire proposed segment. Carry these ordered landmarks into the H5 plate and the model. Use the [edge sampling procedure](references/module-edge-record.md) when deciding which intermediate vertices a low-poly outline needs.

1. Trace each lifting surface's root, tips, leading and trailing edges, stagger, overlap and supporting structure. Sample both skins from a rib detail where available. Record maximum thickness and its chord station. Locate control hinges, moving outlines, fixed neighbors and any all-moving surface.
2. At common stations read hull or nacelle half-widths from plan and deck and belly heights from side. Use front or section details for the section shape. Locate cockpit openings, propulsion axes, disk or outlet planes and tail attachments. Record physical joints and game assembly divisions separately. Use the [module edge record](references/module-edge-record.md).
3. Project the same rows into the aircraft-specific H5 front, side and plan panels. Show hidden or coincident edges through line treatment while preserving their coordinates. Compare against the registered originals, show consequential estimates, and obtain review of the plate before generating the model. An explicit instruction to proceed with the accepted plate authorizes generation.

## Generate the low-poly assembly

- Resolve the local surface at each defining turn. A kink in one projection locates a change of outline. Check the adjacent sections and a second view for a crease, a bounded flat face or a smooth blend. Store its geometry and shading decision with that variant and part. Shared mesh helpers take these local inputs explicitly. See the [turn construction procedure](references/module-edge-record.md#construct-the-surface-at-a-turn).
- Use the variant's registered builder and one uniform conversion into local axes (lateral x, vertical y, nose +z). Generate the major volumes from the accepted sheet. Place divisions at profile extrema, real breaks and interfaces. Use fewer stations on straight runs. Preserve tangent transitions on rounded forms and use hard normals at documented creases.
- Give each structural part its configured ID, attachments and section boundaries. Adjacent bays share their interface ring or rib. Derive mesh contours, hit regions and anchors from the same station data. Preserve catalog leases and independent state for detachable parts.
- For extensible wings, record each half-wing's ordered bays, insertion seam and terminal attachments. Exercise repeated one-sided insertion through the normal refit path. Check both ends of every insert for chord, thickness and orientation continuity. Check downstream attachments, hit regions and all unaffected wing lines, including after a later structural upgrade.
- Mark planform and elevation breaks separately. Read each panel's leading-edge sweep in plan and its dihedral or anhedral in front. Preserve the incoming and outgoing directions at a shared break. At an insertion seam, follow the selected structural line's local direction and join the matching section.
- For a wing-mounted engine, locate its supporting bay and mount in plan and front, then check its fore/aft station and shaft axis in side view. Record the nacelle outline separately from the underlying wing. During insertion on either side of that bay, verify the engine follows its parent and retains the recorded orientation.

## Accept the generated result

Use the [review checklist](references/three-view-checklist.md) with the project's [low-poly presentation criteria](../../../openspec/specs/rendering/procedural-aircraft/spec.md).

- Compare the actual mesh and source in registered orthographic views at one scale and pose. Use a silhouette or neutral material to inspect the outline, negative spaces and section transitions. Remeasure the protected stations and extrema after any geometry reduction. Correct the responsible sheet row, mesh or assembly when a relationship fails.
- Inspect the finished material in the showroom and at normal battle-camera distance in the 360 × 640 viewport. Check nose direction, the variant's identifying features and major modules under gameplay lighting. Resolve clutter or disappearing detail through representation, contrast and shading while keeping the approved outline.
- Trace the reference and runtime entry points for inherited defaults. Check the generated base configuration separately from refitted or damaged states. Record discrepancy, evidence, correction and confirming view. Report unverified measurements as such.
