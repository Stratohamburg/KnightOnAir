# Three-View Review Checklist

Apply each check to the documented architecture. Record absent modules once in the inventory.

## Camera

- [ ] Front view looks along the local `-z` direction toward the nose-facing model.
- [ ] Side view looks along the local `-x` direction with `y` vertical and `z` horizontal.
- [ ] Top view looks along the local `-y` direction with `x` horizontal and `z` vertical.
- [ ] Orthographic views match the registered scale, source orientation and depicted configuration.
- [ ] Fixed views suppress idle roll, bank, and showroom wobble.

## Evidence gate

- [ ] Every visible module has one shared row across front, side, and top.
- [ ] Every station, overlap, attachment, and spacing decision has at least two confirming views or a recorded supplementary source, constraint or unresolved field.
- [ ] The source, photo, constraint, estimate, and preset-fallback status is recorded for every row.
- [ ] The preset audit lists generic body, wing, tier, span, symmetry, and feature-plate paths.
- [ ] No preset was selected before the drawing and photo search was recorded as unresolved.

## Front view

- [ ] Fuselage maximum width is at the correct station.
- [ ] Main wing height and dihedral match the source.
- [ ] Engine count and lateral spacing match the source.
- [ ] Twin booms, vertical fins, floats, or wing-root pods are symmetric when the source is symmetric.
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
- [ ] No module uses a generic icon, default body section, symmetric layer formula, or default span shrink where a measured row exists.
- [ ] Any selected fallback is local to one unresolved field and includes its reason, value, source search, and reviewer.

## Assembly and runtime

- [ ] Each module has a configured content ID.
- [ ] Each mount resolves through a local anchor or centerline placement.
- [ ] The aircraft factory owns Three.js creation.
- [ ] Shared geometry and materials use `ContentCatalog` leases.
- [ ] Instance leases are released when the model leaves the scene.
- [ ] Simulation code contains no Three.js or DOM objects.
- [ ] Refit extensions preserve the module's parent line and local orientation.
- [ ] After repeated insertions on one side, adjacent sections meet, the terminal attachments follow their bay, and unaffected lines retain their stations.

## Low-poly fidelity and readability

- [ ] At each defining turn, the local sections support the modeled ridge, flat face or blend. Both projected boundaries and an oblique neutral-shaded view confirm its extent and termination. A smooth skin crossing a module seam has continuous shading.

- [ ] With neutral shading, the identifying outline, openings and spaces between modules survive in the controlling views. The actual mesh meets the recorded landmarks and curve tolerances.
- [ ] Section cuts retain the measured chordwise thickness distribution, body extrema and transitions where these identify the aircraft. Intentional creases and smooth transitions read correctly under lighting.
- [ ] Control-surface outlines, hinges and extension interfaces retain their geometry and part ownership where required. Decorative seams remain distinguishable from structural joints.
- [ ] At showroom scale and at the normal battle distance in a 360 × 640 viewport, nose direction and distinguishing components read clearly. Check any merged or omitted detail that formerly provided one of those cues.

## Acceptance

- [ ] The reference card names the exact three-view source and variant.
- [ ] The model can be inspected in fixed front, side, and top views.
- [ ] Every mismatch is classified before it is corrected.
- [ ] The discrepancy log records the final change and confirming view.
