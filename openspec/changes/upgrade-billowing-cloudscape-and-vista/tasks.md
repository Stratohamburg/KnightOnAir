# Tasks

## 1. Era Atmosphere Palette & 3D Billowing Cloud Noise

- [x] 1.1 Extend `src/data/eras.ts` with full atmosphere palette fields (`skyZenith`, `skyHorizon`, `sunTint`, `cloudLit`, `cloudShadow`, `cloudRim`, `valleyFog`) for all four eras while preserving existing `grass`, `accent`, `water`, and `haze` values; verify `npm run check` passes.
- [x] 1.2 Add deterministic 32³ RGBA multi-octave Worley-Perlin billowing noise baking (`bakeBillowNoise`) in `src/rendering/CloudscapeLayout.ts` and update `src/rendering/CloudFlow.ts` with convective rise and 3D billowing flow helpers while preserving existing `bakeCloudNoise`, `cloudMorph`, and `morphWallDensity` contracts; verify deterministic tests in `tests/cloudscape.test.ts` pass.

## 2. Seamless 3D Billowing Cloudscape & Multi-Scatter Lighting

- [x] 2.1 Upgrade `src/rendering/Cloudscape.ts` to render a seamless world-wide two-layer 3D billowing cloudscape (low cloud sea + mid/high cumulus banks with river opening and dynamic billowing erosion over the coastal wall), replacing static-only shading with real-time directional sunlight marching (quality-tiered 1/2/3 steps), multi-scattering, powder effect, dual-lobe silver lining, and era palette uniforms (`setPalette`); verify `npm test -- tests/cloudscape.test.ts` passes with new tests covering wide-world cloud volume, calm billowing evolution, pause freeze, and era palette updates.
- [x] 2.2 Add deterministic per-pixel IGN raymarch start jitter, empty-space skipping, `LinearFilter` cloud buffer sampling with depth-aware upsampling, and player-cavity edge ridge brightening in `src/rendering/Cloudscape.ts`; verify `npm test -- tests/cloudscape.test.ts` and `npm run check` pass.

## 3. Cruise Vista Framing & Player Cloud Integration

- [x] 3.1 Update cruise camera framing in `src/data/config.ts` and `src/rendering/Renderer.ts` (`pitch`, `fov`, `distance`, `far`, and `skyDome` radius) to open up the sky horizon and distant cloud vista while keeping bombing mode high-angle and screen-relative controls unchanged; verify `npm test -- tests/controls.test.ts` passes (including centering, direction mapping, and 30% target scale checks) and add a cruise horizon vista test.
- [x] 3.2 Add bounded cloud-interior light/fog wrapping uniforms (`cloudVeil`, `cloudTint`) to player `aircraftMaterial` in `src/rendering/ShaderMaterials.ts` and wire `Renderer.ts` to update both era atmosphere palettes (`skyDome`, `cloudscape`, `terrainMat`, `terrainChunks`) and player cloud integration smoothly; verify `npm run check` and `npm test` pass.

## 4. Stylized Sky-Like Landscape & Soft-Crown Vegetation

- [x] 4.1 Upgrade `terrainMaterial`, `skyDomeMaterial`, `waterMaterial`, and `landscapeLight` in `src/rendering/ShaderMaterials.ts` (plus `TerrainChunks.ts` / `TerrainLandmarks.ts` palette hooks) for velvet grass shading, two-tone wind grass waves, exponential valley height fog with sun-direction aerial scatter (dissolving terrain cleanly before chunk edges), and shimmering sky-reflected water; verify `npm test -- tests/terrain-chunks.test.ts` and `npm run check` pass.
- [x] 4.2 Upgrade `treeGeometry` and tree shading in `src/rendering/VegetationField.ts` to multi-sphere fluffy storybook crowns with outward radial soft normals (retaining exact `2.685` crown height normalization for `bendWeight`, deterministic placement, and wind bend); verify `npm test -- tests/vegetation.test.ts` passes.

## 5. Verification & Visual Acceptance

- [x] 5.1 Run full `npm test` and `npm run build`, then inspect the live environment acceptance views (`/?environmentTest=1&scene=cloudscape` and `/?environmentTest=1&scene=battle`) at `360×640` standard quality to verify 3D billowing clouds, vista framing, landscape atmosphere, draw calls (<150), and triangles (<150,000).

## Workflow follow-up

- Review visual screenshots and metrics, then archive `upgrade-billowing-cloudscape-and-vista` when approved.
