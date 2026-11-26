import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { ContentCatalog } from "../src/content/3d/ContentCatalog";
import { ProceduralAircraft } from "../src/content/3d/AircraftFactory";
import { aircraftReferencePreview } from "../src/content/3d/aircraftModels";
import { fighterUnit } from "../src/content/3d/pistonFighterModel";

describe("registered piston fighter previews", () => {
  it.each(["falcon_13","dragonfly_06"])("keeps the measured span and left-only pitot on %s", id => {
    const preview = aircraftReferencePreview(id)!;
    const catalog = new ContentCatalog();
    const model = new ProceduralAircraft(preview.create(), catalog);
    try {
      expect(model.contentError).toBeUndefined();
      model.group.updateMatrixWorld(true);
      const port = model.group.getObjectByName("right_wing")!;
      const starboard = model.group.getObjectByName("left_wing")!;
      const probe = port.getObjectByName("pitot")!;
      expect(probe.getWorldPosition(new THREE.Vector3()).x).toBeGreaterThan(0);
      expect(starboard.getObjectByName("pitot")).toBeUndefined();
      const bounds = new THREE.Box3().setFromObject(model.group, true);
      expect(bounds.max.x - bounds.min.x).toBeCloseTo(460 * fighterUnit, 5);
      if (id === "falcon_13") {
        expect(port.getObjectByName("cooler-oil")).toBeDefined();
        expect(starboard.getObjectByName("cooler-radiator")).toBeDefined();
      } else {
        const inner = port.getObjectByName("main-wing") as THREE.Mesh;
        const outer = port.getObjectByName("folding-tip") as THREE.Mesh;
        const seam = (mesh: THREE.Mesh) => {
          const points = mesh.geometry.getAttribute("position");
          const edge = new Set<string>();
          for (let i = 0; i < points.count; i++) {
            if (Math.abs(points.getX(i)-204*fighterUnit)<1e-5)
              edge.add([points.getY(i),points.getZ(i)].join(","));
          }
          return edge;
        };
        expect(seam(inner).size).toBeGreaterThan(10);
        expect(seam(outer)).toEqual(seam(inner));
      }
    } finally {
      model.dispose();
    }
    expect(catalog.stats).toMatchObject({ geometries: 0, materials: 0 });
  });
});
