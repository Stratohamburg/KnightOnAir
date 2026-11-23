# Runtime content library architecture

## Library boundaries

Use three independent libraries under the content layer.

- content/3d for geometry, materials, aircraft factories, projectile factories, and anchor transforms
- content/fx for effect profiles, glow, particles, smoke, trails, impacts, explosions, and debris
- content/2d for DOM or SVG components, view models, icons, HUD, labels, and overlays

The application layer composes these libraries. Simulation stays free of Three.js and DOM dependencies.

## Shared contracts

Prefer small pure contracts.

- Content IDs identify reusable definitions.
- Anchor poses contain local position and local rotation.
- Fx requests contain profile ID, world pose or actor attachment, intensity, seed, inherited velocity, and persistence.
- UI view models contain display-ready values and do not expose mutable simulation objects.

## Reuse rules

Static geometry, static materials, and textures are cached. Short-lived visual objects use bounded pools or instanced batches. Repeated DOM nodes such as radar contacts, edge indicators, labels, and feed rows use a DOM pool or equivalent reuse.

Shared materials must not carry per-entity mutable state. Use material instances, instanced attributes, or separate dynamic buffers for damage, heat, glow, and flash-like local state. Whole-aircraft hit flash is not part of the game's visual language.

## Effects

Weapon fire and impacts use emissive cores, soft halos, and emissive particles. Impact smoke records a world-space position and fades after a short persistence interval. Continuous damage smoke attaches to an actor anchor. Detachable debris inherits hit pose and velocity, then releases into world space.

## Integration points

World emits public events and pure requests. The effects system consumes them. The renderer submits shared resources and active instances. The UI system consumes view models and events. Adding a new visual effect should not require importing Three.js into simulation or building DOM inside gameplay logic.

## Repository entry points

- Use the pure local anchors and the aircraft and scene factories from the 3D library. Hold catalog leases for shared resources and release them at instance disposal. [Anchors](../../../../src/content/3d/anchors.ts) · [Aircraft factory](../../../../src/content/3d/AircraftFactory.ts) · [Scene objects](../../../../src/content/3d/SceneObjects.ts) · [Resource catalog](../../../../src/content/3d/ContentCatalog.ts)
- Pass the world snapshots from `GameApp` into the existing effect consumer. Add weapon visuals through the profile definitions and reuse the effect batches. [Combat effects](../../../../src/content/fx/CombatEffects.ts) · [Profiles](../../../../src/content/fx/profiles.ts)
- Pass display data into the HUD and reuse the shared controls and pools. [Combat HUD](../../../../src/content/2d/CombatHud.ts) · [Battle status](../../../../src/content/2d/BattleStatus.ts) · [Components](../../../../src/content/2d/components.ts)
