import { describe, expect, it, vi } from "vitest";
import { ProceduralAircraft } from "../src/content/3d/AircraftFactory";
import { aircraftReferencePreview, resolveAircraftModel } from "../src/content/3d/aircraftModels";
import * as aircraftReferences from "../src/data/aircraftReferences";
import { meteorF3Id } from "../src/data/meteorF3Sheet";

describe("Meteor F.3 generation gate", () => {
  it.each([[meteorF3Id, 2], ["vampire-fb5", 1]] as const)("builds the reviewed %s with finite geometry and its own outlets", (id, outlets) => {
    const preview = aircraftReferencePreview(id)!;
    const aircraft = new ProceduralAircraft(preview.create());
    try {
      expect(aircraft.contentError).toBeUndefined();
      expect(aircraft.effectSites.sources.filter(site => site.kind === "jetOutlet")).toHaveLength(outlets);
      expect(aircraft.effectSites.surfaces.length).toBeGreaterThan(5);
      aircraft.group.traverse(node => {
        const positions = (node as import("three").Mesh).geometry?.getAttribute("position");
        if (positions) expect(Array.from(positions.array).every(Number.isFinite), node.name).toBe(true);
      });
    } finally {
      aircraft.dispose();
    }
  });

  it.each(["estimate", "unresolved"] as const)("blocks a %s geometry row even with an approved sheet flag", status => {
    const preview = aircraftReferencePreview(meteorF3Id)!;
    const reference = aircraftReferences.aircraftReferenceByFrameId(meteorF3Id)!;
    const evidence = reference.pipeline!;
    const nacelle = evidence.evidenceMatrix!.find(row => row.module === "短舱")!;
    const lookup = vi.spyOn(aircraftReferences, "aircraftReferenceByFrameId").mockReturnValue({
      ...reference,
      pipeline: {
        ...evidence,
        generatedFromApprovedSheet: true,
        evidenceMatrix: [{ ...nacelle, status }],
      },
    });
    try {
      expect(resolveAircraftModel(preview.frame)).toEqual({ error: "三维几何待核对 · 短舱" });
    } finally {
      lookup.mockRestore();
    }
  });
});
