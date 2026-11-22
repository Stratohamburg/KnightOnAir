# Tasks

## 1. Cloud data and quality baseline

- [x] 1.1 Expand cloud field allocation to the maximum configured cluster count, propagate puff tint data and update cloud animation time from scene time. Verify a deterministic cloud-field test covers the configured low, standard and high counts and catches the current seven-versus-ten mismatch.
- [x] 1.2 Add cloud quality parameters for puff count, shell mode, near-volume count, ray-marching steps and interior veil strength. Verify switching quality changes counts and modes without creating new shared geometry or materials.
- [x] 1.3 Add development diagnostics for active cloud count, active volume count, cloud mode and cloud-stage CPU time. Verify the diagnostics are available only in development builds and do not alter the public renderer API.

## 2. Cloud rendering stages

- [x] 2.1 Move cloud rendering into a dedicated stage between the world scene and overlay scene while preserving world depth testing and the existing `clearDepth()` player pass. Verify a browser scene shows a cloud covering a ground unit while the player aircraft and lock indicators remain visible.
- [x] 2.2 Implement the near proxy-volume material with bounded view-ray sampling, low-frequency coverage, edge erosion, flattened cloud bottoms and three-band stylized lighting. Verify a fixed near-cloud scene shows a readable top, side, blue bottom and soft irregular silhouette.
- [x] 2.3 Add optional short sun-direction sampling and retain the existing blob shadow path for ground projection. Verify cloud shadows remain attached to `surfaceHeight()` while cloud quality changes do not add per-frame geometry allocation.
- [x] 2.4 Add the cloud-interior veil driven by camera density and render it before the overlay scene. Verify entering and leaving a cloud changes veil strength smoothly and leaves player geometry and aiming information clear.
- [x] 2.5 Implement the low-quality puff fallback and high-quality near-volume selection, including disposal for cloud scene resources. Verify disabling near-volume mode restores the puff-only path and a five-minute render session shows no growing geometry or material count.

## 3. Distant grass wave

- [x] 3.1 Add wind time, direction and gust uniforms to the terrain material and apply a low-contrast world-space wave term only to grass surface regions. Verify roads, water, terrain height queries and ground units retain their original positions while grass bands move with the wind.
- [x] 3.2 Add sparse deterministic low-poly grass tufts for near and medium distance, filtering candidates by final surface, road mask and slope. Verify a placement test reproduces the same positions and phases for the same seed and excludes blocked surfaces.
- [x] 3.3 Tune the wave scale, phase variation, color range and tuft density for the three quality tiers. Verify a 360 x 640 browser capture reads as broad wind-blown grass from the battle camera without requiring visible individual blades.
- [x] 3.4 Verify grass animation uses renderer scene time and freezes when the world clock is paused. Verify the same grass phase resumes after unpausing and terrain chunk rebuilds do not create a visible phase pop.

## 4. Wind-driven trees

- [x] 4.1 Add height-weighted bend data to tree geometry and a wind-aware tree material that keeps roots fixed and moves crowns along the shared wind direction. Verify a tree test scene shows increasing displacement from trunk base to crown without ground separation.
- [x] 4.2 Add deterministic per-instance phase, stiffness and scale values derived from world position. Verify regenerating a chunk with the same seed reproduces tree layout, color and animation phase.
- [x] 4.3 Synchronize tree uniforms with `WindField` time and gust values, including paused-state handling. Verify tree motion direction follows the same sampled wind direction used by aircraft drift and smoke.
- [x] 4.4 Add tree quality controls for bend frequency and flutter detail. Verify the low tier preserves readable tree silhouettes while reducing vertex animation cost.

## 5. Integration and acceptance

- [x] 5.1 Add pure tests for cloud layout, cloud wrapping, vegetation placement and quality budgets, then run `npm test` and `npm run check` to verify existing simulation and control tests remain green.
- [x] 5.2 Add browser acceptance hooks for cloud occlusion, player overlay visibility, cloud entry veil, distant grass waves, tree root attachment and pause behavior. Verify the checks work at 360 x 640 and on all three quality tiers.
- [x] 5.3 Measure draw calls, triangles, frame time and memory across a full battle scene with clouds, terrain, trees, projectiles and effects. Verify the standard tier stays within the existing 150 draw-call and 150k triangle targets, with ray-marching cost recorded separately.
- [x] 5.4 Update the implementation and procedural-3D system documentation with the final cloud modes, grass-wave behavior, tree wind parameters, quality budgets and fallback rules. Verify the documented values match the shipped configuration and diagnostics.
