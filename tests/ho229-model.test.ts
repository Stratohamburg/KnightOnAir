import { Box3, Mesh, Raycaster, Vector3 } from "three";
import { expect, it } from "vitest";
import { ProceduralAircraft } from "../src/content/3d/AircraftFactory";
import { ContentCatalog } from "../src/content/3d/ContentCatalog";
import { engineOutlet, muzzleAnchor } from "../src/content/3d/anchors";
import { airframeById } from "../src/data/aircrafts";
import { hoPlateEngineMm, hoSideEngineBody, hoUnit } from "../src/data/ho229V2Sheet";
import { upgradeById } from "../src/data/upgrades";
import { NetworkController } from "../src/simulation/Controllers";
import { World } from "../src/simulation/World";
import type { Part } from "../src/simulation/types";
import { hoPlacedPanels, hoSectionAt } from "../src/simulation/Ho229Layout";

it("assembles both V2 actors with the sheet envelope, three wheels and two registered jet outlets", () => {
  const frame = airframeById("stingray_16");
  const catalog = new ContentCatalog();
  const world = new World(frame, 17, { director: false });
  const replay = world.spawnReplayOpponent(frame, new NetworkController(), 0, 6);
  const models = [world.player, replay].map(actor => new ProceduralAircraft(actor, catalog));
  try {
    for (const model of models) {
      expect(model.contentError).toBeUndefined();
      expect(model.actor.weapons).toHaveLength(1);
      expect(model.actor.weapons[0]).toMatchObject({ partId: "nose", config: { id: "ww2_autocannon", count: 2 } });
      expect(model.group.getObjectsByProperty("name", "ho229-cannon")).toHaveLength(2);
      expect(model.group.getObjectsByProperty("name", "ho229-wheel")).toHaveLength(3);
      expect(model.group.getObjectsByProperty("name", "ho229-elevon")).toHaveLength(4);
      const bounds = new Box3().setFromObject(model.group, true);
      expect(bounds.max.x - bounds.min.x).toBeCloseTo(frame.wingspan, 5);
      expect(bounds.max.z - bounds.min.z).toBeCloseTo(frame.length, 5);
      for (const part of model.actor.parts.filter(p => p.role === "engine")) {
        const outlet = engineOutlet(part);
        const mesh = model.group.getObjectByName(part.id)!.getObjectByName("ho229-nozzle")!;
        const position = mesh.getWorldPosition(new Vector3());
        expect(position.distanceTo(new Vector3(outlet.x, outlet.y, outlet.z))).toBeLessThan(1e-6);
      }
    }
  } finally {
    models.forEach(m => m.dispose());
    expect(catalog.stats).toMatchObject({ geometries: 0, materials: 0 });
    world.dispose();
  }
});

it.each(["left", "right"])("fits mixed engine and cannon bays on the %s side in structural order", hand => {
  const world = new World(airframeById("stingray_16"), 17, { director: false });
  const model = new ProceduralAircraft(world.player);
  const actor = world.player;
  const otherHand = hand === "left" ? "right" : "left";
  const sign = hand === "left" ? -1 : 1;
  const otherTip = actor.parts.find(p => p.id === otherHand + "_wing_tip")!;
  const fixed = [otherTip.x, otherTip.z];
  const engines: Part[] = [], cannons: Part[] = [];
  try {
    for (const kind of ["cannon", "engine", "engine", "cannon"]) {
      const card = world.legalUpgradeOptions.find(u => u.id === "ho229_" + hand + "_" + kind)!;
      world.installUpgrade(card);
      const bay = actor.parts.at(-2)!, fitting = actor.parts.at(-1)!;
      expect(fitting.parentId).toBe(bay.id);
      (kind === "engine" ? engines : cannons).push(bay);
    }
    model.update(0, 0);
    expect(model.contentError).toBeUndefined();
    expect([otherTip.x, otherTip.z]).toEqual(fixed);
    expect(actor.stats.wingspan).toBeCloseTo(15 + 2 * (1.05 + .58));
    const main = actor.parts.find(p => p.id === hand + "_wing")!;
    const tip = actor.parts.find(p => p.id === hand + "_wing_tip")!;
    const chain = [...engines, main, ...cannons, tip];
    for (let i = 1; i < chain.length; i++) {
      expect(chain[i].parentId).toBe(chain[i - 1].id);
      const strip = (index: number) => chain[index].silhouette!.flat().map(p => sign * p.x);
      expect(Math.max(...strip(i - 1))).toBeCloseTo(Math.min(...strip(i)), 5);
    }
    for (const weapon of actor.weapons) {
      const part = actor.parts.find(p => p.id === weapon.partId)!;
      const barrels = model.group.getObjectByName(part.id)!.getObjectsByProperty("name", "ho229-cannon");
      expect(barrels).toHaveLength(weapon.config.count);
      barrels.forEach((mesh, i) => {
        const muzzle = muzzleAnchor(part, weapon, actor.heading, i);
        expect(mesh.getWorldPosition(new Vector3()).distanceTo(new Vector3(muzzle.x, muzzle.y, muzzle.z))).toBeLessThan(1e-6);
      });
    }
    expect(model.group.getObjectsByProperty("name", "ho229-cannon")).toHaveLength(4);
    expect(model.group.getObjectsByProperty("name", "ho229-nozzle")).toHaveLength(4);
  } finally {
    model.dispose();
    world.dispose();
  }
});

it.each(["left", "right"])("retains full-size raised engines and a clear aft outlet across repeated %s bays", hand => {
  const world = new World(airframeById("stingray_16"), 17, { director: false });
  const model = new ProceduralAircraft(world.player);
  try {
    const tip = world.player.parts.find(p => p.id === hand + "_wing_tip")!;
    const tipBefore = { x: tip.x, z: tip.z };
    const sweep = hand === "left" ? (431.1 - 313.6) / 192 : (434.1 - 315) / 189;
    for (let count = 0; count <= 2; count++) {
      if (count) world.installUpgrade(upgradeById("ho229_" + hand + "_engine")!);
      model.update(0, 0);
      model.group.updateMatrixWorld(true);
      const panels = hoPlacedPanels(world.player.parts, world.player.frame.wingspan);
      expect(tipBefore.z - tip.z).toBeCloseTo(sweep * Math.abs(tip.x - tipBefore.x), 6);
      const sideEngines = world.player.parts.filter(p => p.kind === "engine" && p.slot === hand + "Wing")
        .sort((a, b) => Math.abs(a.x) - Math.abs(b.x));
      for (let i = 1; i < sideEngines.length; i++) {
        expect(sideEngines[i].z).toBeLessThan(sideEngines[i - 1].z - .4);
      }
      for (const engine of world.player.parts.filter(p => p.kind === "engine")) {
        const rows = panels.get(engine.parentId!)!;
        const outlet = engineOutlet(engine);
        expect(outlet.z - hoSectionAt(rows, outlet.x).aft).toBeGreaterThan(56 * hoUnit);
        const host = model.group.getObjectByName(engine.parentId!)!.getObjectsByProperty("name", "ho229-wing-skin");
        const deckAt = (z: number) => new Raycaster(new Vector3(outlet.x, 3, z), new Vector3(0, -1, 0))
          .intersectObjects(host)[0].point.y;
        const root = model.group.getObjectByName(engine.id)!;
        const native = model.group.getObjectByName(engine.slot === "leftWing" ? "engine_0" : "engine_1")!;
        for (const name of ["ho229-intake", "ho229-engine-body", "ho229-engine-cover", "ho229-nozzle"]) {
          const mesh = root.getObjectByName(name)!;
          const original = native.getObjectByName(name)!;
          const bounds = new Box3().setFromObject(mesh, true);
          const nativeBounds = new Box3().setFromObject(original, true);
          expect(bounds.getSize(new Vector3()).distanceTo(nativeBounds.getSize(new Vector3()))).toBeLessThan(1e-6);
          const nativePart = world.player.parts.find(p => p.id === native.name)!;
          expect(bounds.min.z - nativeBounds.min.z).toBeCloseTo(engine.z - nativePart.z, 6);
          expect(bounds.max.y).toBeCloseTo(nativeBounds.max.y, 6);
        }
        const cover = root.getObjectByName("ho229-engine-cover")!;
        const crown = new Raycaster(new Vector3(outlet.x, 3, outlet.z + .09), new Vector3(0, -1, 0))
          .intersectObject(cover)[0].point.y;
        const rim = new Box3().setFromObject(root.getObjectByName("ho229-nozzle")!, true);
        expect((rim.max.x - rim.min.x) / hoUnit).toBeCloseTo(hoPlateEngineMm.diameter, 4);
        expect(rim.max.y - rim.min.y).toBeCloseTo(rim.max.x - rim.min.x, 5);
        const atExit = new Raycaster(new Vector3(outlet.x, 3, outlet.z + .00001), new Vector3(0, -1, 0))
          .intersectObject(cover)[0].point.y;
        expect((atExit - rim.max.y) / hoUnit).toBeCloseTo(hoPlateEngineMm.outletCover, 1);
        const body = root.getObjectByName("ho229-engine-body") as Mesh;
        body.geometry.computeBoundingBox();
        const localBody = body.geometry.boundingBox!;
        expect((localBody.max.y - localBody.min.y) / hoUnit).toBeCloseTo(hoSideEngineBody.length, 3);
        const foreAxis = new Vector3(0, 1, 0).transformDirection(body.matrixWorld);
        const outletToBody = body.getWorldPosition(new Vector3()).sub(new Vector3(outlet.x, outlet.y, outlet.z)).normalize();
        expect(foreAxis.distanceTo(outletToBody)).toBeLessThan(1e-6);
        const outerSide = engine.slot === "leftWing" ? -1 : 1;
        const sideOccluded = (y: number) => new Raycaster(new Vector3(outlet.x + outerSide * 20, y, outlet.z - .001),
          new Vector3(-outerSide, 0, 0), 0, 20).intersectObjects(host).length > 0;
        expect(sideOccluded(outlet.y)).toBe(true);
        expect(sideOccluded(rim.max.y - hoUnit)).toBe(false);
        const rimAxis = new Vector3(0, 1, 0).transformDirection(root.getObjectByName("ho229-nozzle")!.matrixWorld);
        expect(rimAxis.distanceTo(new Vector3(0, 0, -1))).toBeLessThan(1e-6);
        expect(outlet.yaw).toBeCloseTo(Math.PI);
        expect(crown).toBeGreaterThan(rim.max.y);
        expect(deckAt(outlet.z - .08)).toBeLessThan(rim.min.y);
        // Cast from the perimeter back toward the exit to detect even a wing
        // already enclosing part of the aperture at the nozzle plane.
        for (const [dx, dy] of [[0, 0], [0, -.95], [-.65, -.62], [.65, -.62], [-.95, 0], [.95, 0]]) {
          const x = outlet.x + dx * (rim.max.x - outlet.x);
          const y = outlet.y + dy * (rim.max.y - outlet.y);
          const aft = hoSectionAt(rows, x).aft - .01;
          const ray = new Raycaster(new Vector3(x, y, aft), new Vector3(0, 0, 1), 0, outlet.z - aft - .001);
          expect(ray.intersectObject(model.group)).toHaveLength(0);
        }
        root.traverse(obj => {
          if (!(obj instanceof Mesh)) return;
          const pos = obj.geometry.getAttribute("position");
          for (let i = 0; i < pos.count; i++) {
            const v = obj.localToWorld(new Vector3().fromBufferAttribute(pos, i));
            expect(v.z).toBeGreaterThan(hoSectionAt(rows, v.x).aft + .15);
          }
        });
        const lip = root.getObjectByName("ho229-nozzle")!.getWorldPosition(new Vector3());
        expect(lip.distanceTo(new Vector3(outlet.x, outlet.y, outlet.z))).toBeLessThan(1e-6);
      }
      const bays = world.player.parts.filter(p => p.centerline?.insertion === "root-before");
      let lastAft: number | undefined;
      for (const bay of bays) {
        const sections = panels.get(bay.id)!.slice();
        if (hand === "left") sections.reverse();
        if (lastAft !== undefined) expect(sections[0].aft).toBeCloseTo(lastAft, 6);
        const inner = sections[0], outer = sections.at(-1)!;
        expect(inner.fore - outer.fore).toBeCloseTo(sweep * Math.abs(outer.x - inner.x), 6);
        lastAft = outer.aft;
      }
    }
  } finally {
    model.dispose();
    world.dispose();
  }
});

it.each(["left", "right"])("moves only the %s terminal bay when inserting twice along the sweep", hand => {
  const world = new World(airframeById("stingray_16"), 17, { director: false });
  const model = new ProceduralAircraft(world.player);
  const part = (id: string) => world.player.parts.find(p => p.id === id)!;
  const tip = part(hand + "_wing_tip");
  const other = part((hand === "left" ? "right" : "left") + "_wing_tip");
  const base = { x: tip.x, z: tip.z, otherX: other.x };
  const side = hand === "left" ? -1 : 1;
  try {
    for (let i = 1; i <= 2; i++) {
      world.installUpgrade(upgradeById(hand + "_wing_segment")!);
      model.update(0, 0);
      expect(model.contentError).toBeUndefined();
      expect(tip.x).toBeCloseTo(base.x + side * .7 * i);
      expect(tip.z).toBeLessThan(base.z);
      expect(other.x).toBeCloseTo(base.otherX);
      const bounds = new Box3().setFromObject(model.group.getObjectByName(tip.id)!, true);
      const hit = tip.silhouette!.flat().map(p => p.x);
      expect(bounds.min.x).toBeCloseTo(Math.min(...hit), 5);
      expect(bounds.max.x).toBeCloseTo(Math.max(...hit), 5);
      expect(part(tip.parentId!).centerline?.segmentRole).toBe("insert");
    }
    world.installUpgrade(upgradeById("giant_wing")!);
    model.update(0, 0);
    expect(model.contentError).toBeUndefined();
    const inserts = world.player.parts.filter(p => p.centerline?.segmentRole === "insert");
    const chain = [part(hand + "_wing"), ...inserts, tip];
    for (let i = 1; i < chain.length; i++) {
      const end = (id: string) => new Box3().setFromObject(model.group.getObjectByName(id)!, true);
      const a = end(chain[i - 1].id), b = end(chain[i].id);
      expect(side < 0 ? a.min.x : a.max.x).toBeCloseTo(side < 0 ? b.max.x : b.min.x, 5);
    }
  } finally {
    model.dispose();
    world.dispose();
  }
});
