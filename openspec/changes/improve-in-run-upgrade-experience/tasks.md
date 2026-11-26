# Tasks

## 1. Upgrade data and stacking rules

- [x] 1.1 Extend the upgrade data contract with numeric prices, additive stack limits, structure length, and capacity contribution, then verify every enabled upgrade has a finite valid price or an explicit pricing default.
- [x] 1.2 Migrate structural and cumulative upgrades from the current `max: 1` and `max: 2` limits to a configurable stack limit of 10, preserve true mode-modifier uniqueness, and verify the legal candidate pool reflects installed stack counts.
- [x] 1.3 Set left and right Fokker Dr.I wing extension segments to one metre and configure per-airframe capacity for at least 10 segments per side, then verify centerline extension and silhouette length equal the number of installed segments.
- [x] 1.4 Update refit eligibility and weapon-capacity calculations so additive extension segments provide their own weapon capacity without being blocked by base hardpoints, then verify ten same-side segments each retain an independent weapon mount.
- [x] 1.5 Add data validation for prices, stack limits, extension lengths, and capacity contributions, and verify invalid IDs or non-positive values fail configuration checks.

## 2. Simulation transaction and progression

- [x] 2.1 Add explicit upgrade selection state and a presentation-only build projection, then verify selecting or switching candidates leaves the formal player parts, weapons, health, coins, and upgrade count unchanged.
- [x] 2.2 Split upgrade choice from installation and implement an atomic confirmation path that rechecks legality, available upgrades, and current-run coins before applying the build, then verify a rejected confirmation causes no partial mutation.
- [x] 2.3 Deduct the configured price only after successful validation and consume one upgrade count only after payment, then verify insufficient coins keep the upgrade phase open with all simulation values unchanged.
- [x] 2.4 Emit one public upgrade-installation event containing upgrade ID, added part IDs, weapon mount IDs, actor pose, and animation type, then verify multiple fixed-step events are consumed once.
- [x] 2.5 Preserve damaged existing parts while adding new full-health parts and recalculate cumulative stats, collision extent, and centerline layout once per committed installation, then verify damaged aircraft refits retain their damage states.
- [x] 2.6 Add simulation tests for deterministic candidate selection, payment order, rejected confirmations, ten-segment stacking, dynamic weapon capacity, and restoration of the pre-upgrade battle or bombing phase.

## 3. Presentation preview and resource lifecycle

- [x] 3.1 Add a preview aircraft instance that is built from the projected refit state while sharing geometry and static materials through `ContentCatalog`, then verify the preview matches the candidate's parts, weapons, stats, and local anchors.
- [x] 3.2 Implement preview replacement and disposal when the player switches candidates, confirms, or leaves the upgrade phase, then verify catalog leases and dynamic materials return to the expected counts after repeated previews.
- [x] 3.3 Add component animation state for scale-in, centerline translation, overshoot, settling, and edge-part highlighting, then verify a wing or fuselage extension moves outward before reaching its final size.
- [x] 3.4 Add presentation tests for repeated same-side segments, preview cleanup, independent part identities, and low-quality fallback behavior.

## 4. Upgrade camera and installation feedback

- [x] 4.1 Extend battle camera framing with an upgrade target that interpolates from the current cruise or bombing view and places the aircraft above the bottom sheet, then verify there is no camera jump when entering upgrade mode.
- [x] 4.2 Calculate upgrade focus from the selected preview bounds, reduce magnification for already-large aircraft, and allow controlled viewport overflow, then verify edge-mounted parts remain readable at 360×640, 390×844, 430×932, and desktop aspect ratios.
- [x] 4.3 Interpolate back to the pre-upgrade battle framing after the installation animation completes, then verify cruise and bombing phases resume with their original screen-relative orientation.
- [x] 4.4 Consume installation events in the renderer, audio, haptics, and bounded effects pipeline, then verify part growth, extension impact, sound, vibration, and short camera shake occur once per installed segment.
- [x] 4.5 Add camera and presentation tests for upgrade entry, candidate switching, edge focus, large-aircraft framing, completion return, and ten consecutive installation events.

## 5. Bottom-sheet upgrade UI and input

- [x] 5.1 Replace the centered upgrade dialog with a full-width bottom sheet occupying the lower third of the viewport, then verify the upper two-thirds retain the battle scene and HUD at the target mobile sizes.
- [x] 5.2 Render three vertically ordered candidates with persistent selected state, per-item price, current balance, numeric deltas, and an inline confirmation action, then verify the confirmation action appears only for the selected candidate.
- [x] 5.3 Show an explicit insufficient-balance state and keep the preview available while disabling confirmation, then verify the displayed shortfall updates when the candidate changes.
- [x] 5.4 Add touch, mouse, and keyboard actions for selecting a candidate and confirming installation, then verify joystick, bombing, firing, and pause actions remain gated during the upgrade phase.
- [x] 5.5 Add accessible pressed, disabled, price, and confirmation labels and preserve focus when the sheet updates, then verify keyboard navigation and screen-reader state in the mobile UI tests.
- [x] 5.6 Add UI tests for bottom-sheet geometry, selection persistence, candidate switching, insufficient coins, confirmation dispatch, and restoration of the previous focus target.

## 6. Documentation and integration verification

- [x] 6.1 Update `docs/VERIFICATION.md` with manual checks for continuous camera zoom, edge-part framing, bottom-sheet layout, payment rejection, installation animation, and ten-segment aircraft growth, then verify each step can be followed in a local build.
- [x] 6.2 Update the relevant current design documentation to describe run-scoped payment, preview-only selection, configurable ten-layer additive stacks, and independent extension weapon segments, then verify links point to the modified OpenSpec capabilities.
- [x] 6.3 Run `npm test` and verify simulation, controls, mobile UI, aircraft showroom, and content lifecycle tests pass.
- [x] 6.4 Run `npm run check` and `npm run build`, then verify the strict TypeScript check and production bundle complete without errors.
- [x] 6.5 Perform browser acceptance at 360×640, 390×844, 430×932, and desktop width, then verify no horizontal overflow, no blocked confirmation path, no camera jump, and no resource growth after repeated candidate switching and installations.

## Workflow follow-up

- Archive the change after implementation and verification satisfy all tracked tasks.
- Run the archive validation and confirm the modified capability deltas are ready to sync into the main specifications.
