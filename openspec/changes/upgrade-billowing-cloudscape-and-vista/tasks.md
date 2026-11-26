# Tasks

## 1. Documentation & Era Palette Baseline

- [x] 1.1 Record the top-down Daylight Prairie visual rules (viewport-focused budget, grouped cloud walls separating sunny regions, no full-map cloud sea or near haze, wind-driven drift vs. in-place slow billowing with subtle bounded local shift, and 3D sampling performance limits) in `docs/RENDERING_GUIDE.md` and `docs/README.md`; verify docs match the revised OpenSpec change.
- [x] 1.2 Tune `src/data/eras.ts` atmosphere palette fields (`skyZenith`, `skyHorizon`, `sunTint`, `cloudLit`, `cloudShadow`, `cloudRim`, `valleyFog`) for bright sunny Daylight Prairie contrast (especially the default coastal/meadow eras) while preserving existing `grass`, `accent`, `water`, and `haze` values; verify `npm run check` passes.

## 2. Fast Top-Down 3D Billowing Cloudscape (Zero Empty-Sky 3D Taps)

- [x] 2.1 Replace multi-tap 3D `billowWarp` in `src/rendering/CloudFlow.ts` with a zero-texture analytic bounded 3D local shift + convective vertical rise helper (preserving strict wind-only macro drift, pause freeze, and deterministic `cloudMorph`/`morphWallDensity` contracts); verify `tests/cloudscape.test.ts` passes.
- [x] 2.2 Refactor `src/rendering/Cloudscape.ts` to remove full-map `seaDensity`, enforce strict 2D `columns`/wall-bounds early-out (0 3D texture taps in sunny clear sky), replace recursive sun-march loops with a single-tap directional-derivative 3D self-shadow combined with macro occlusion + Daylight Prairie cream/sky-blue powder shading, and switch `cloudShadowFragment` to fast macro integration; verify `npm test -- tests/cloudscape.test.ts` confirms sunny openings stay clear (`< 0.1`), calm billowing evolves locally with zero macro drift, and pause freezes state.
- [x] 2.3 Tighten raymarch integration bounds to the visible top-down frustum (`min(surface, 220.)`) while retaining deterministic IGN pixel jitter, `LinearFilter` depth-aware upsampling, and player-cavity rim brightening; verify `npm run check` and `npm test -- tests/cloudscape.test.ts` pass.

## 3. Top-Down Framing, Sunny Landscape & Low-Poly Fluffy Trees

- [x] 3.1 Restore original high-impact top-down cruise camera framing (`fov: 48`, `pitch: 52`, `displayPitch: 64`, `distance: 66`, `far: 280`) in `src/data/config.ts` and `src/rendering/Renderer.ts`, keeping player cloud-interior veil (`cloudVeil`, `cloudTint`) and era palette wiring intact; verify `npm test -- tests/controls.test.ts` passes.
- [x] 3.2 Remove near/mid-range `valleyMist` from `landscapeLight` in `src/rendering/ShaderMaterials.ts` so sunny terrain, grass waves, and shimmering water stay crystal clear inside the top-down viewport with distinct cool-blue cloud shadows; verify `npm test -- tests/terrain-chunks.test.ts` and `npm run check` pass.
- [x] 3.3 Slim `treeGeometry` in `src/rendering/VegetationField.ts` to 3 ultra-low-poly soft-normal spheres (preserving exact `2.685` height normalization and smooth storybook shading) to bring total scene triangles back near the ~55k–65k baseline; verify `npm test -- tests/vegetation.test.ts` passes.

## 4. Verification & Visual/Performance Acceptance

- [x] 4.1 Run full `npm test` and `npm run build`, then inspect `/?environmentTest=1&scene=cloudscape` (estuary sunny opening, cloud wall & wake) and `/?environmentTest=1&scene=battle` at `360×640` standard quality to verify sunny grouped Daylight Prairie cloud walls, smooth performance, and triangle count budget.
- [x] 4.2 Upgrade cloud rendering to Route A Analytical Smooth-Min Metaball SDF + Sphere Tracing (`src/rendering/CloudLobes.ts` + `src/rendering/Cloudscape.ts`), calibrate ACES-safe three-tone Daylight Prairie shading, tight non-fanning `aircraftCarveSdf`, 55%/75%/100% cloud buffer resolution + 3-pass Kawase Bloom, and verify 360×640 screenshots with 0 console/WebGL errors.

## Workflow follow-up

- Review screenshots and frame responsiveness, then archive `upgrade-billowing-cloudscape-and-vista` when approved.

## 5. Route B · Rasterized fused cloud mesh

- [x] 5.1 Bake indexed, smoothly fused cloud groups from the seeded lobe field and cache them within a fixed budget. Drive native-resolution mesh deformation and cream lighting with deterministic scene-clock billowing and a local aircraft wake.
- [x] 5.2 Integrate hardware world depth, soft contact blending, bounded wing-contact surface deformation and interior mist with the player overlay. Verify pause, wind drift, depth ordering and mobile viewport budgets.
