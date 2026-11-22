---
name: runtime-content-library
description: Apply KnightOnAir's runtime content library rules when creating or changing dynamic 3D content, combat effects, projectiles, smoke, debris, anchors, or 2D HUD and overlay components.
---

# Runtime Content Library

Use this skill for any new or refactored dynamic content in KnightOnAir, including aircraft visuals, weapons, projectiles, muzzle effects, impact effects, smoke, debris, terrain-facing markers, HUD elements, radar contacts, labels, overlays, and reusable icons.

Read the governing spec before changing code.

- Read openspec/specs/rendering/runtime-content-library/spec.md.
- Read the related rendering, weapons, damage, HUD, or combat behavior spec when the change crosses that boundary.
- Inspect existing catalogs, factories, pools, anchor utilities, and event types before adding a new helper.

Classify every requested object into one of three libraries.

- The 3D content library owns shared geometry, static materials, aircraft factories, projectile geometry, scene nodes, and local three-dimensional anchors.
- The effects library owns effect profiles, emissive bursts, emissive particles, smoke, sparks, impact residue, trails, explosions, and debris.
- The 2D content library owns DOM or SVG components, HUD view models, icons, labels, radar contacts, edge threats, feedback lists, buttons, and overlays.

Keep simulation independent from Three.js and DOM.

- Simulation produces state, public events, and pure effect requests.
- Rendering consumes those events and requests.
- UI consumes view models and public events.
- Effects must not directly modify health, parts, flight state, or other simulation state.

Use content IDs and pure data descriptors. Do not place Three.js objects, DOM nodes, mutable uniforms, or runtime state in data configuration.

Use shared local anchors for parts, weapon mounts, engine outlets, smoke, hit effects, and detachable debris. Resolve world transforms through the common anchor transform with actor position, heading, bank, local height, local rotation, and inherited velocity.

Reuse before creating.

- Cache static geometry, base materials, and reusable textures by content ID.
- Use bounded pools or instance batches for bullets, trails, glow bursts, particles, smoke, sparks, rings, debris, and repeated HUD nodes.
- Give pooled objects an explicit reset and release path.
- Preserve per-entity dynamic state when using shared geometry or materials.
- Add low-quality fallback behavior for particle-heavy effects.
- Define disposal ownership so an instance cannot dispose shared resources.

When an existing path creates the same kind of content directly, move the creation through the matching library instead of adding another parallel factory. Update the relevant OpenSpec when a new reusable content category, anchor type, pool, event, or lifecycle rule is introduced.

For detailed boundaries and examples, read references/architecture.md.

