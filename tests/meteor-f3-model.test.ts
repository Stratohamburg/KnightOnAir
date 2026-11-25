import { describe, expect, it, vi } from "vitest";
import { ProceduralAircraft } from "../src/content/3d/AircraftFactory";
import { aircraftReferencePreview, resolveAircraftModel } from "../src/content/3d/aircraftModels";
import * as aircraftReferences from "../src/data/aircraftReferences";
import { meteorF3Id } from "../src/data/meteorF3Sheet";

describe("Meteor F.3 generation gate", () => {
  it("reports missing geometry and leaves the model empty", () => {
    const preview = aircraftReferencePreview(meteorF3Id)!;
    const { model, error } = resolveAircraftModel(preview.frame);
    expect(model).toBeUndefined();
    expect(error).toContain("短舱");

    const aircraft = new ProceduralAircraft(preview.create());
    try {
      expect(aircraft.contentError).toBe(error);
      expect(aircraft.group.children).toHaveLength(0);
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
