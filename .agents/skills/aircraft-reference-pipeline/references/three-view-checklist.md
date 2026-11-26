# Three-View Review Checklist

Apply each check only to the branches selected for the documented architecture and configuration. Record an inactive branch once. Inventory its descendants only when the branch applies.

## Camera

- [ ] Front view looks along the local `-z` direction toward the nose-facing model.
- [ ] Side view looks along the local `-x` direction with `y` vertical and `z` horizontal.
- [ ] Top view looks along the local `-y` direction with `x` horizontal and `z` vertical.
- [ ] Orthographic views match the registered scale, source orientation and depicted configuration.
- [ ] Fixed views suppress idle roll, bank, and showroom wobble.

## Evidence gate

- [ ] Each active branch lists both required and optional searches. Missing required items have a question for the user and remain open. Optional items with no evidence after research have their checked sources recorded and are treated as absent for this build. They clear the gate. An identified feature hidden in one view is checked in the other views or supporting sources.

- [ ] Open the H5 plate and match the [applicable subparts](aircraft-profile-template.md#three-view-part-inventory) to visible callouts, keyed hidden lines or a section detail. Trace a label to its part in each useful view. Check flying-wing center-section ownership and the displayed default armament against the inventory.
- [ ] Follow each propulsion installation from its separately labeled components to its host. For gear, controls and movable canopy parts, trace the moving member, its parent and the evidenced axis. Check any documented end poses against the same axis.
- [ ] Each concealed, absent or disputed feature has a recorded basis. Remaining required unknowns have a specific question for the user with the sources already checked.

- [ ] Every visible module has one shared row across front, side, and top.
- [ ] Every station, overlap, attachment, and spacing decision has at least two confirming views or a recorded supplementary source, constraint or unresolved field.
- [ ] The source, photo, constraint, estimate or unresolved status is recorded for every row.
- [ ] Every field that affects geometry, topology, anchors or part ownership has a variant-specific source or an explicit review constraint.
- [ ] Required estimates and unresolved fields keep the preview and production gates closed. The approval record links the decisions shown in H5 and used by the builder.

## Left-right symmetry

- [ ] The registered center plane has body or datum evidence independent of the feature being checked.
- [ ] Left and right contours were read independently in front and top views where visible. Corresponding lateral offsets, heights and fore/aft stations agree within the documented source tolerance, or the discrepancy is recorded.
- [ ] The plate shows the main components and locating points. The record preserves both original readings and any evidence-supported adjustment.
- [ ] Deviations beyond tolerance have been checked against independent evidence for the same variant and configuration. Pending deviations keep the model gate closed. The user has decided how to represent each confirmed asymmetry.

## Front view

- [ ] Fuselage maximum width is at the correct station.
- [ ] Main wing height and dihedral match the source.
- [ ] Engine count and lateral spacing match the source.
- [ ] Body, cockpit and tail offsets match their recorded axes.
- [ ] Every stacked-wing layer has the correct vertical seam, layer gap, and support or strut.
- [ ] Visible landing gear connects to its documented support.

## Side view

- [ ] Nose length and taper match the source.
- [ ] Cockpit height and longitudinal station match the source.
- [ ] Main-wing chord and wing-root station match the source.
- [ ] Propeller, inlet, exhaust, and engine installation point in the correct direction.
- [ ] Tail or boom length, height, and connection to the body match the source.
- [ ] Module leading and trailing edges preserve their measured longitudinal stations.
- [ ] The main-wing leading edge has the measured clearance to the propeller disk, inlet, or nose.

## Top view

- [ ] Main-wing leading and trailing edges match the source.
- [ ] Taper, ellipse, sweep, and tip shape match the source.
- [ ] Each lifting surface meets its documented parent or support.
- [ ] Tailplane span and fin station match the source.
- [ ] Flying-wing center body and wing roots form one continuous silhouette.
- [ ] Weapon and engine mounts follow the correct branch from the centerline.
- [ ] Wing leading and trailing edges are continuous at the root and have the measured sweep and taper.
- [ ] Each layer's root seam, tip edge, and parent centerline agree with the source drawing.

## Module edge pass

- [ ] In the controlling views, the plate and projected mesh reproduce the ordered corners, extrema and smooth transitions of each defining contour. Interior deviations along each visible interval fit the source tolerance.

- [ ] The edge record exists for the fuselage, every wing layer, tail surface, engine fairing, and landing gear.
- [ ] Leading-edge stations reproduce measured forward sweep, aft sweep or zero sweep.
- [ ] No module boundary is hidden by a scale change, generic box, or camera angle.
- [ ] Edge gaps, intersections, floating parts, and incorrect parent seams have been classified before editing.
- [ ] No module uses a generic icon, default body section, symmetric layer formula, default span shrink or inherited geometry.
- [ ] An unresolved required field is recorded with its missing evidence and keeps approval disabled.

## Assembly and runtime

- [ ] Each module has a configured content ID.
- [ ] Each mount resolves through a local anchor or centerline placement.
- [ ] The aircraft factory owns Three.js creation.
- [ ] Shared geometry and materials use `ContentCatalog` leases.
- [ ] Instance leases are released when the model leaves the scene.
- [ ] Simulation code contains no Three.js or DOM objects.

## Installation and refit checks

- [ ] Compare the variant's eligible upgrades and supported special states against the plate IDs. Inspect the recorded before/after cue on the assembled model. For internal changes verify the configured feedback. For detachable parts, check what stays on the host, what travels with the part, and which visible effects move or stop.

- [ ] In the base assembly, compare the configured count, parent and side of each requested module with the starting loadout. On stacked wings, identify each layer in front view and trace its own span, stagger and degree of overlap in plan. Include the supports, horizontal tail and vertical tail where present.
- [ ] In the showroom, exercise zero, one and two additions on the same side when the upgrade is repeatable. Exercise both sides independently when supported. For independent upgrade types sharing a wing, try a mixed sequence. Compare the assembled top views at one scale and datum. Follow both edges from the center to the tip, checking sweep, intended turns and the space behind each opening. Use front or side views for vertical displacement.
- [ ] Measure the repeated part's dimensions in its own axes and its station in aircraft coordinates. Check these independently against the installation record. Compare the adjacent panel ends, downstream attachments, hit regions and unaffected side or layers. If a later span change is supported, repeat the seam check after applying it.
- [ ] For a directional opening, inspect the finished mesh along its axis and from the side or rear quarter. Verify the anchor at the lip and check clearance across the aperture, including its lower and lateral edges. A section cut or rays against the actual surrounding mesh can reveal a blocked exit. For a propeller, inspect clearance across the swept disk.
- [ ] When review finds a repeatable failure, record the failing configuration, view and relationship. Correct the responsible sheet, part dimensions or placement rule, then compare the base and failing state again. Add a targeted regression when an existing check could pass the faulty assembly.

The [Dr.I record](../../../../docs/aircraft-profiles/fokker-dr1-profile.md) illustrates independent layer stations, control surfaces and terminal bays. The [Ho 229 V2 record](../../../../docs/aircraft-profiles/ho229-v2-profile.md) illustrates a raised housing, a clear dorsal outlet and full-size repeated units staggered along a swept carrier. Use the current variant's evidence to choose its geometry and growth direction.

## Low-poly fidelity and readability

- [ ] At each defining turn, the local sections support the modeled ridge, flat face or blend. Both projected boundaries and an oblique neutral-shaded view confirm its extent and termination. A smooth skin crossing a module seam has continuous shading.

- [ ] With neutral shading, the identifying outline, openings and spaces between modules survive in the controlling views. The actual mesh meets the recorded landmarks and curve tolerances.
- [ ] Section cuts retain the measured chordwise thickness distribution, body extrema and transitions where these identify the aircraft. Intentional creases and smooth transitions read correctly under lighting.
- [ ] Control-surface outlines, hinges and extension interfaces retain their geometry and part ownership where required. Decorative seams remain distinguishable from structural joints.
- [ ] At showroom scale and at the normal battle distance in a 360 × 640 viewport, nose direction and distinguishing components read clearly. Check any merged or omitted detail that formerly provided one of those cues.

## Acceptance

- [ ] The reference card names the exact three-view source and variant.
- [ ] The model can be inspected in fixed front, side, and top views.
- [ ] Assembled-mesh overlays in all three fixed views and section or interface checks meet the recorded landmarks and tolerances. The evidence records the actual deviations and their locations.
- [ ] Every mismatch is classified before it is corrected.
- [ ] The discrepancy log records the final change and confirming view.
