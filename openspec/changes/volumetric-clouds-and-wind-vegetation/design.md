# Design

## Context

See `proposal.md` for the motivation and scope. The current renderer already uses a world scene and an overlay scene with a shared camera. World geometry, enemy units and clouds are drawn before `clearDepth()`, while the player aircraft and critical aiming information are drawn afterward. The existing `CloudField` creates deterministic low-poly puff clusters and the terrain system exposes final surface height and terrain normals.

The simulation already owns a deterministic `WindField`. It updates time and gust state at the fixed simulation step, while the renderer currently reads only the gust value for smoke. Terrain rendering already carries a surface mask that distinguishes grass, roads, sand, water and rock. The target is a 360 x 640 mobile viewport with an existing budget around 150 draw calls and 150k triangles for the complete frame.

## Goals / Non-Goals

**Goals:**

- Give near clouds a readable volume impression with density variation, layered lighting, blue cloud bottoms and a smooth interior veil.
- Preserve world-object occlusion and the existing player overlay guarantee.
- Keep distant clouds and low quality rendering within the current mobile budget.
- Make distant grass read as a moving field with broad wind waves and low individual-blade detail.
- Give trees and high vegetation a separate height-weighted vertex bend that follows the simulation wind semantics.
- Keep placement, phase, quality changes and pause behavior deterministic.

**Non-Goals:**

- Full atmospheric froxel simulation for the entire sky.
- Physically accurate multiple scattering or volumetric shadow maps.
- Per-blade grass simulation or visible individual grass animation across the whole terrain.
- Wind-driven gameplay effects, collision changes, visibility rules or hit calculation changes.
- New external models, textures, runtime services or save data.

## Decisions

### Hybrid cloud representation

The cloud field will use three visual levels.

```text
far clouds       low-poly puffs + toon lighting + blob shadows
mid clouds       puffs + edge shell + density-colored shading
near hero clouds proxy volume + bounded ray marching
```

Low-poly puffs remain the default representation for far and low-quality clouds. A near hero cloud can use a proxy volume with a custom material that integrates density along the view ray. The high quality tier receives the full near-volume budget first. Standard quality keeps the puff and shell path as its guaranteed fallback and can enable one near volume after the performance gate passes.

This preserves the current Q-style silhouette and gives the implementation a bounded fragment cost. A full-screen ray marching pass was considered. It would provide broad atmospheric coverage, but it would couple the entire frame to the cloud step count and complicate mobile depth upsampling.

### Cloud pass ordering

Clouds will be removed from the general world object ordering and rendered in a dedicated cloud stage between the world scene and the overlay scene.

```text
clear
  |
  v
world scene
terrain, ground units, enemies, enemy projectiles, shadows
  |
  v
cloud stage
opaque puffs, proxy volumes, interior veil
  |
clearDepth
  |
  v
overlay scene
player, player projectiles, lock ring, crosshair, bomb path
```

The cloud color pass depth-tests against the already rendered world depth. Dense cloud samples blend over world pixels in front of the depth surface. A shallow depth shell remains available for the low-poly path and for stable cloud-to-cloud ordering. The overlay scene continues to guarantee that the player and critical aiming information remain visible.

### Cloud density and lighting

Each near volume uses an ellipsoid or bounded box with a deterministic local coverage value. The shader evaluates a low-frequency shape term, a low-frequency coverage noise and a smaller erosion term. The bottom receives a flattening mask so the cloud reads as a stylized cumulus bank.

The lighting model uses a small fixed budget. View-ray samples use 8 steps for the first mobile implementation. The high quality tier can use up to 16 steps for one or two near clouds. A short 2 to 4 sample sun-direction lookup approximates self-shadowing. The accumulated result is quantized into three lighting bands, then mixed with the existing cream, middle and blue shadow palette. A low-strength warm rim term supplies the existing edge highlight.

Noise starts as deterministic procedural 3D value noise in the shader. A generated `Data3DTexture` remains an optional optimization if profiling shows that procedural noise dominates the fragment cost. The texture is generated from the same cloud seed and is uploaded once per renderer lifetime.

### Cloud interior veil

The cloud stage computes a camera density estimate from the active cloud volumes. A full-screen cloud-interior quad uses this value to apply a white-blue veil with a capped opacity. The veil ramps with density and is temporally stable. It is drawn before the depth reset and the player overlay, so the player remains readable while the surrounding world gains the sensation of entering a cloud.

### Cloud data and quality lifecycle

Cloud cluster data stays deterministic and is generated once for the maximum configured count. Quality changes adjust visibility, instance counts and ray-marching mode without rebuilding shared geometry or materials. The initial data build must allocate enough clusters for the high quality count, fixing the current seven-cluster capacity mismatch with the ten-cluster configuration.

Cloud drift and noise time use the renderer's scene time. When the world is paused, scene time stops, so cloud positions, density animation and the interior veil remain frozen. Cloud puffs receive their generated tint through instance color or a per-instance attribute so the existing tint seed affects the result.

### Two-level grass expression

The grass effect will use a broad terrain wave as the primary distant cue and sparse low-poly tufts as a secondary silhouette cue.

```text
grass terrain regions
  +-- moving world-space color bands and low-contrast normal variation
  +-- sparse deterministic tufts near the playable view
trees and high vegetation
  +-- separate instanced mesh
  +-- height-weighted vertex bend
```

The terrain shader will add a grass-only wave term using world position, wind direction, wind time and gust. This term changes the brightness and saturation of broad bands that travel across grass regions. It does not move the authoritative terrain vertices, so roads, routes, water, height queries and ground units remain aligned.

Sparse tufts use a shared three-blade or low-poly wedge geometry. They are placed only on grass-compatible samples and use a small instance count. Their role is to reinforce the wave silhouette near the camera, not to represent every blade.

Trees remain separate from the distant grass field. Tree geometry receives a bend weight based on local height. The root remains fixed and the crown receives increasing wind displacement. Instance phase, stiffness and scale are deterministic per world position.

### Shared wind semantics

The renderer will receive wind time and gust from the simulation and reproduce the existing spatial sampling formula in the vegetation and terrain shaders. This keeps the visual wind direction consistent with aircraft drift, projectile drift and smoke. The vegetation path remains render-only and does not feed back into simulation.

The terrain wave uses the sampled horizontal wind direction as a moving phase. Tree vertices use the same direction plus a per-instance phase and a higher-frequency flutter term. The renderer uses scene time for pause consistency and reads the current gust value from the world.

### Vegetation placement and terrain attachment

Vegetation placement remains deterministic per terrain chunk. Candidate points are accepted when the final surface is grass-compatible, the road mask is low and the slope is below the vegetation threshold. Tree and tuft roots use `surfaceHeight()`. Trees may align to `terrainNormal()` with a capped tilt so the crown remains readable on sloped terrain.

The vegetation owner may be a dedicated field module or a focused extension around `TerrainChunks`. The implementation must keep chunk rebuilds responsible for placement and keep per-frame work limited to uniform updates and shader animation.

### Quality budgets

The initial budgets are defined as follows.

| Tier | Clouds | Grass expression | Tree detail |
| --- | --- | --- | --- |
| low | four puff clusters | terrain wave only or very sparse tufts | reduced bend frequency |
| standard | seven puff clusters, optional one near volume after profiling | terrain wave plus sparse tufts | normal bend |
| high | ten clusters, one or two near volumes | terrain wave plus denser near tufts | normal bend with flutter |

The quality system changes counts and shader modes in place. The implementation will measure frame time on the existing dynamic-resolution path and retain the current total draw-call budget.

### Validation hooks

Pure deterministic helpers for cloud layout and vegetation placement will be tested without WebGL. Browser validation will expose optional development diagnostics for cloud mode, cloud count, grass wave state, tree instance count and per-pass CPU timing. Visual checks will cover cloud depth, player overlay readability, cloud entry and exit, broad grass waves, tree roots and pause behavior.

## Risks / Trade-offs

- [Risk] Ray marching increases fragment cost on mobile GPUs. -> Limit it to one or two near volumes, use early termination and keep the puff path as the guaranteed fallback.
- [Risk] Transparent cloud compositing can produce unstable cloud-to-cloud ordering. -> Render a shallow depth shell or sort proxy volumes by camera distance before the color stage.
- [Risk] A moving terrain color band can read as a texture scroll. -> Use broad low-contrast bands, spatially varying phase and sparse silhouette tufts to anchor the effect to the terrain.
- [Risk] Tree bending can make trunks look rubbery. -> Bake height weights, clamp trunk displacement and move most of the amplitude into the crown.
- [Risk] Chunk rebuilds can pop vegetation phases. -> Derive phase and seed from world coordinates instead of rebuild order.
- [Risk] Cloud and vegetation animation can continue while the UI is paused. -> Drive both from renderer scene time, which already stops when the world time scale is zero.
- [Risk] The existing seven-cluster allocation hides the high-quality ten-cluster setting. -> Allocate the maximum quality count during cloud field construction and add a deterministic count check.

## Migration Plan

1. Add the new cloud and wind-vegetation behavior tests and development diagnostics without changing gameplay simulation.
2. Correct cloud capacity, tint propagation and cloud animation time while keeping the current low-poly path active.
3. Add the broad grass wave uniforms and sparse tuft path. Keep the existing static tree representation as a fallback until tree vertex bending passes visual checks.
4. Move clouds into the dedicated cloud stage and verify world depth plus overlay behavior.
5. Add the bounded near-cloud proxy volume for high quality and benchmark it on the target viewport.
6. Add tree height-weighted bending and synchronize it with the wind field.
7. Tune color, wave amplitude, cloud density and quality budgets on desktop viewport and a representative mobile device.

Rollback is controlled by the quality configuration. Disabling near-volume mode returns clouds to the puff path. Disabling vegetation animation returns trees to static matrices and keeps the terrain wave term at zero. No simulation state or save data migration is required.
