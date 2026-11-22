# Tasks

## 1. Capability inventory and path verification

- [ ] 1.1 Verify that all 17 capability paths listed in proposal.md have exactly one spec.md under the change root and that no duplicate path is present; verify with `openspec status --change organize-capability-specs --json`.
- [ ] 1.2 Review each Purpose section against the current project behavior and remove implementation-only wording; verify each purpose remains a durable user-visible capability description.

## 2. Application and battle boundary review

- [ ] 2.1 Review app shell, out-of-battle hangar, and persistence specs against the `GameApp` screen state, modal state, equipment flow, and SaveStore behavior; verify the three specs have no ownership overlap.
- [ ] 2.2 Review battle session lifecycle, input and action binding, camera and view feedback, and HUD feedback specs against the application and world state machines; verify each requirement has one clear state owner and at least one scenario.
- [ ] 2.3 Review in-run progression and aircraft refit specs against XP, upgrade, pickup, score, and temporary build behavior; verify the specs distinguish run-scoped state from persistent state.
- [ ] 2.4 Review aircraft damage and weapons-targeting-and-bombing specs against shared parts, damage degradation, locks, projectiles, bombing gates, and terrain-aware landing; verify their requirements can evolve independently.
- [ ] 2.5 Review encounter-director spec against spawn budgets, NPC profiles, separation, routes, and era phases; verify the spec does not own content schema fields that belong to world/combat-content-and-eras.

## 3. World and rendering boundary review

- [ ] 3.1 Review world/terrain-and-routes and rendering/terrain-rendering against deterministic height queries, route semantics, terrain chunks, water, and route props; verify simulation contracts and visual contracts remain separate.
- [ ] 3.2 Review world/combat-content-and-eras against airframe, combatant, NPC profile, era, and configuration validation behavior; verify weapon effects and upgrade effects remain owned by their battle specs.
- [ ] 3.3 Review rendering/procedural-aircraft against aircraft construction, parts, upgrades, damage, smoke, fire, and death presentation; verify the spec describes observable visuals instead of renderer internals.
- [ ] 3.4 Review rendering/quality-and-performance against quality tiers, dynamic resolution, resource stability, diagnostics, and target viewport budgets; verify shared performance constraints are not duplicated in unrelated specs.
- [ ] 3.5 Cross-check the two existing environment specs in volumetric-clouds-and-wind-vegetation against the new rendering directory boundaries; verify cloud and vegetation capabilities remain referenced without creating duplicate deltas.

## 4. Evidence and documentation mapping

- [ ] 4.1 Map each capability to its existing tests, browser acceptance hooks, configuration diagnostics, or documented manual checks; verify every spec has at least one concrete evidence source.
- [ ] 4.2 Reconcile historical docs/changes topics 01–16 with the new capability paths in design.md; verify each historical topic has one primary owner and documented cross-capability dependencies.
- [ ] 4.3 Record the known verification gap for mobile performance, browser visual acceptance, and the unfinished cloud and vegetation tasks; verify the gap is visible before archive.

## 5. OpenSpec validation and review

- [ ] 5.1 Run `openspec validate --change organize-capability-specs --strict` and resolve all structural, requirement, scenario, and path errors; verify strict validation passes.
- [ ] 5.2 Run `npm test -- --run` and `npm run build` as behavior and typecheck evidence for the source baseline; verify the commands pass without source changes from this spec-only change.
- [ ] 5.3 Review the generated proposal, design, tasks, and 17 spec files together; verify the final status reports proposal, specs, design, and tasks as done.

## Workflow follow-up

- Archive `volumetric-clouds-and-wind-vegetation` only after its cloud and vegetation implementation tasks and device acceptance are complete.
- Archive `organize-capability-specs` after review and strict validation so the 17 capability specs become the durable `openspec/specs` inventory.
- Verify the archived inventory with `openspec list --specs --json` and confirm the existing environment capabilities appear at their own paths after their separate archive.
