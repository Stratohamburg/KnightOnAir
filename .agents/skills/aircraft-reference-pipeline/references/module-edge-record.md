# Module Edge Record

Use this sheet between the outer-silhouette pass and procedural assembly. It is a compact record of the structural boundaries that can be checked in fixed views.

## Coordinate convention

- `+z` points to the nose.
- `-z` points to the tail.
- `x` is lateral and `y` is vertical.
- Record the source drawing's measured stations as ratios first. Convert to gameplay units only after the overall envelope is fixed.

## Per-module pass

For each module, inspect the same region in the front, side, and top drawing.

1. Mark the leading and trailing edges, then the upper and lower edges.
2. Mark the root seam where the module joins its parent and the tip or end edge.
3. Record the module's `x`, `y`, and `z` station, span, chord, taper, sweep, and clearance to the adjacent module.
4. Name the parent centerline and the relation. Use `branch`, `parallel`, `vertical`, or `longitudinal` consistently with the topology definition.
5. Note supports that carry the load, including struts, landing-gear legs, axles, engine pylons, and boom connectors.

## Evidence triangulation

### Trace the interior of each contour

1. Follow one named boundary in one projection. On a wing or tailplane trace leading and trailing edges independently. On a fuselage or pod trace deck, belly and plan outline at common longitudinal stations. On a fin or rudder follow the full perimeter through the crown, trailing edge and root transition.
2. Record landmarks in traversal order. At a sharp turn, sample the incoming edge, corner and outgoing edge. On a smooth turn, mark extrema and inflections and sample through the bend. A smooth transition keeps its tangent. Record hinge and assembly stations separately wherever they cross this trace.
3. Place a trial segment between adjacent retained landmarks and inspect the visible source trace throughout the interval. If its greatest deviation exceeds the variant's drawing tolerance, retain the point of greatest deviation and repeat on both resulting intervals. Keep defining corners and narrow notches even when short. End the visible run at an occlusion and seek the continuation in another view.
4. Overlay the H5 contour and later the projected mesh on the registered source. Check every retained turn and the largest interior deviation between turns. Record the source station and view of a failed interval so the next correction targets the local shape.

Every edge row must identify the views that control it. Confirm a boundary or station in at least two views before turning it into profile data.

| Decision | Minimum confirming views | Required record |
| --- | --- | --- |
| Span, symmetry, and root alignment | front + top | both tip coordinates, root seam, parent line |
| Height, layer gap, and vertical support | front + side | upper and lower edges, body datum, clearance |
| Longitudinal station and chord interval | side + top | nose or tail datum, leading and trailing stations |
| Volume or section shape | front or section detail + side or plan at the same station | section type, extrema, transition evidence and any photographic support |

For paired edges, compare the independently traced left and right intervals about the registered aircraft center plane. Record the largest mirrored deviation and its location in the [symmetry check](aircraft-profile-template.md#left-right-symmetry-check). Derive any reconciled contour from the supported measurements.

If an included part's boundary is hidden in one view, use the second view to locate its parent and endpoint. Consult variant documentation and photographs for a required boundary that remains obscured, then ask the user if it remains unresolved. Apply the [part inventory](aircraft-profile-template.md#three-view-part-inventory) to optional items whose presence could not be established.

A projection outline constrains visible extents. Use a section drawing, a locally identifiable photo, or a recorded user constraint to establish the shape at the relevant station. A round inlet supports the inlet section. Downstream nacelle sections, wing thickness and masked joins each need their own evidence. Record incompatible widths, heights or stations as separate source readings and show the proposed resolution in H5 before fitting the surface.

### Locate a concealed engine

1. In side view, identify the housing contour, the exposed rim and the edge of the skin that obscures it. A housing step can locate the outlet's longitudinal station even when only the top of the opening is visible. Check that station in plan and locate each inlet center in front view. The midpoint of a partially visible rim shifts with occlusion.
2. Recover the full opening from a section or another view where possible. For one approximately cylindrical engine with a dedicated inlet or outlet of comparable bore, start the body diameter close to, and slightly smaller than, the clear dimension of that single opening. Measure across the opposing lip edges in the view that exposes them. A shared intake or a visibly contracted nozzle needs an engine section or another diameter reference. Record the chosen opening and the allowance for the surrounding skin.
3. For a straight installation, fit one axis through the opening centers. Derive both sides of a constant-diameter body from parallel offsets. At a curved intake lip, the upper edge, axis and lower edge can meet the lip at different longitudinal stations. Overlay all three intersections on the source after moving either end. Where a duct bends or is offset, locate the rigid engine and the duct separately.
4. Check the fitted axis against the housing over the span occupied by the body. Where the upper housing follows the engine, its local slope should roughly track the upper body edge with room for structure. Compare the gap near both ends and through the middle. A tapered fairing can change that gap. Keep the rigid body straight through the taper.
5. Show visible contours as solid lines, hidden estimates as dashed lines and the axis as a centerline. If the question is where the engine itself sits, place a translucent rectangle along its axis, leaving the inlet duct and tailpipe their own lengths. Use the same diameter for the rectangle and the inferred body edges so they coincide after a revision. Label its ends as estimated while the internal joints are concealed. Paired engines that coincide in side view can share one marker when the other views establish both positions.

The [Ho 229 V2 profile](../../../../docs/aircraft-profiles/ho229-v2-profile.md) records the lip readings, housing allowance and estimated engine-body interval for this example.

## Boundary decisions

### Construct the surface at a turn

1. Register a section just before, at and just after the turn as the evidence permits. Match corresponding points on the adjoining skins across views. On a wing these can be the leading edge, upper crest, trailing edge and lower skin. On a body they can be the deck, shoulder, widest point and belly. Record any hidden dimension as unresolved.
2. For a hard fold, join the two measured surfaces on the supported ridge and split the shading normals there. For a visible bevel or planar patch, locate both bounding edges, the face orientation and where its width changes or runs out. For a rounded transition, fit the local section sequence through the measured extrema and tangents. A change of sweep in plan alone supplies no bevel width or cross-section shape.
3. At a modular join, match corresponding vertices on the shared local boundary. Preserve shading continuity where the source skin runs smoothly across it. Keep any end cap internal on the assembled model unless the source exposes it. Derive exposed ends from the owning part's section. Keep reusable triangulation and lofting helpers parameterized by these local outlines and crease decisions.
4. Overlay the projected turn against both controlling views, then inspect it obliquely in neutral shading. Check face extent, termination and the path of the highlight across the seam. If a uniform chamfer, clipped corner or dark ridge appears, trace its vertices and normals back to the local evidence before accepting it.

- Read leading-edge stations along the span to determine sweep. Collinear samples can form a swept edge. Equal longitudinal stations identify an unswept edge within the drawing tolerance. Preserve changes in chord independently.
- At each visible kink, sample the inboard endpoint, kink and outboard endpoint of the same edge. Measure plan sweep relative to the aircraft lateral axis and front-view inclination relative to horizontal. Record the structural bay boundary and the geometric kink independently, including when they coincide.
- Where a nacelle hides an edge, follow the exposed wing on either side and check another projection before extending the edge through the hidden region. Record the engine mount's parent bay, local offset and propulsion axis separately from the panel angles.
- A stacked wing needs one record per layer. Derive each layer's `y`, `z`, span, chord, root seam, and support from its evidence rows. Every layer needs its own measured or explicitly review-constrained spacing. An unresolved layer keeps approval disabled.
- A flying wing uses the center-body seam and the outer leading and trailing edges as one continuous boundary. A short center pod must not be stretched into a conventional fuselage.
- A twin-boom aircraft needs a separate edge and parent record for each boom and for the connecting tailplane.
- Landing gear is a module when the source shows a visible leg, axle, wheel, or fairing. Record its attachment edge and ground clearance.

For a worked stacked-wing example, see the [Dr.I variant record](../../../../docs/aircraft-profiles/fokker-dr1-profile.md).

## Acceptance

Reject the assembly for another reference pass when any of these occur.

- A leading edge has an unrecorded sweep or a camera angle is hiding it.
- A root seam floats away from its parent or intersects the body without a structural connector.
- A stacked layer inherits another layer's `y` or `z` despite a different source station.
- Landing gear appears as a generic box or is disconnected from the lower structural edge.
