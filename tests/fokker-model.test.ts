import { Box3, Euler, Mesh, Vector3 } from "three";
import { expect, it } from "vitest";
import { ProceduralAircraft } from "../src/content/3d/AircraftFactory";
import { muzzleAnchor } from "../src/content/3d/anchors";
import { airframeById } from "../src/data/aircrafts";
import { combatantById } from "../src/data/combatants";
import { ERAS } from "../src/data/eras";
import { NetworkController } from "../src/simulation/Controllers";
import { FOKKER_REFIT_IDS, upgradeById } from "../src/data/upgrades";
import { SaveStore } from "../src/services/Save";
import { requiredXp, World } from "../src/simulation/World";

it("starts a fresh pilot in Dawn Meadow and installs a first-level refit through battle selection", () => {
  const { equipped, unlocked } = new SaveStore().data;
  expect(equipped).toBe("heron_09");
  expect(unlocked).toContain(equipped);
  const world = new World(airframeById(equipped), 1, { director: false });
  const model = new ProceduralAircraft(world.player);
  try {
    expect(ERAS[world.era].mission).toBe("黎明草甸");
    expect(model.group.getObjectByName("dr1-hull")).toBeDefined();
    expect(world.legalUpgradeOptions.map(card => card.id).sort()).toEqual([...FOKKER_REFIT_IDS].sort());
    world.awardXp(requiredXp(world.level));
    expect(world.openUpgrades()).toBe(true);
    expect(world.choices.map(card => card.id)).toEqual([
      "quick_feed", "radiator", expect.stringMatching(/^(left|right)_wing_segment$/),
    ]);
    expect(world.chooseUpgrade(world.choices[2].id)).toBe(true);
    expect(world.phase).toBe("battle");
    expect(world.upgradesAvailable).toBe(0);
    model.update(0, 0);
    model.group.updateMatrixWorld(true);
    const weapon = world.player.weapons.at(-1)!;
    const mount = world.player.parts.find(part => part.id === weapon.partId)!;
    const barrel = model.group.getObjectByName("dr1-wing-gun")!;
    const muzzle = muzzleAnchor(mount, weapon, world.player.heading, 0);
    const bounds = new Box3().setFromObject(barrel, true);
    expect(barrel.parent?.name).toBe(mount.id);
    expect(bounds.getCenter(new Vector3()).x).toBeCloseTo(muzzle.x);
    expect(bounds.getCenter(new Vector3()).y).toBeCloseTo(muzzle.y);
    expect(bounds.max.z).toBeCloseTo(muzzle.z);
  } finally {
    model.dispose();
    world.dispose();
  }
});

it("rotates the Dr.I around its measured three-dimensional lift center", () => {
  const world = new World(airframeById("heron_09"), 1, { director: false });
  const model = new ProceduralAircraft(world.player);
  try {
    const bank = .6;
    const heading = .7;
    world.player.bank = bank;
    world.player.heading = heading;
    model.update(0, 0);
    model.group.rotation.x = .2;
    model.syncLiftPivot();
    model.group.updateMatrixWorld(true);
    const hull = model.group.getObjectByName("dr1-hull")!;
    const position = hull.getWorldPosition(new Vector3());
    const liftCenter = new Vector3(0, world.player.frame.liftCenterY, world.player.frame.liftCenterZ);
    const rotatedLiftCenter = liftCenter.clone().applyEuler(new Euler(.2, heading, bank));
    const liftCenterY = world.player.frame.liftCenterY;
    expect(liftCenterY).toBeGreaterThan(.5);
    expect(world.player.frame.liftCenterZ).toBeGreaterThan(1.5);
    expect(position.x).toBeCloseTo(liftCenter.x - rotatedLiftCenter.x, 5);
    expect(position.y).toBeCloseTo(liftCenter.y - rotatedLiftCenter.y, 5);
    expect(position.z).toBeCloseTo(liftCenter.z - rotatedLiftCenter.z, 5);
  } finally {
    model.dispose();
    world.dispose();
  }
});

it("uses the selected mission's encounters and the aircraft's compatible refits", () => {
  const world = new World(airframeById("heron_09"), 1, { director: false, missionEra: "jet" });
  try {
    expect(ERAS[world.era].mission).toBe("翡翠海岸");
    expect(world.enemies.map(enemy => combatantById(enemy.configId!)?.era)).toEqual(["jet", "jet"]);
    const wing = world.legalUpgradeOptions.find(card => card.id === "left_wing_segment")!;
    world.installUpgrade(wing);
    expect(world.player.weapons.at(-1)?.config.id).toBe("ww1_wing_gun");
  } finally {
    world.dispose();
  }
});

it.each(["player", "replay"])("projects the %s Dr.I onto the accepted front, side and plan landmarks", actor => {
  const frame = airframeById("heron_09");
  const world = new World(frame, 1, { director: false });
  const model = new ProceduralAircraft(actor === "player" ? world.player : world.spawnReplayOpponent(frame, new NetworkController(), 0, 25));
  const unit = frame.length / 253;
  const station = (z: number) => 126.5 - z / unit;
  model.group.updateMatrixWorld(true);
  try {
    for (const [name, span, height, leading, aft] of [
      ["lower", 250, -21, 50, 98], ["middle", 272, 21, 36, 87], ["upper", 315, 63, 25, 87],
    ] as const) {
      const bounds = new Box3();
      const meshes = model.group.getObjectsByProperty("name", "dr1-wing-" + name);
      expect(meshes).toHaveLength(6);
      for (const mesh of meshes) bounds.expandByObject(mesh, true);
      expect((bounds.max.x - bounds.min.x) / unit).toBeCloseTo(span, 4);
      expect(bounds.min.y / unit).toBeCloseTo(height, 4);
      const chord = name === "lower" ? 48 : 51;
      expect((bounds.max.y - bounds.min.y) / unit / chord).toBeCloseTo(.138, 4);
      const thicknessAt = (fraction: number) => {
        const section = new Box3();
        for (const mesh of meshes) mesh.traverse(child => {
          if (!(child instanceof Mesh)) return;
          const positions = child.geometry.getAttribute("position");
          for (let i = 0; i < positions.count; i++) {
            const p = child.localToWorld(new Vector3().fromBufferAttribute(positions, i));
            if (Math.abs(station(p.z) - leading - fraction*chord) < .001) section.expandByPoint(p);
          }
        });
        return (section.max.y - section.min.y) / unit / chord;
      };
      expect(thicknessAt(.20)).toBeCloseTo(.125, 4);
      expect(thicknessAt(.80)).toBeCloseTo(.049, 4);
      expect(station(bounds.max.z)).toBeCloseTo(leading, 4);
      expect(station(bounds.min.z)).toBeCloseTo(aft, 4);
    }
    const shell = model.group.getObjectByName("dr1-hull")!;
    expect(shell.children.map(part => part.name)).toEqual(["cowling","forward","cockpit","aft","tailpost"].map(id => "dr1-hull-" + id));
    for (const side of ["left","right"]) {
      const ailerons = model.group.getObjectsByProperty("name", "dr1-aileron-" + side);
      expect(ailerons).toHaveLength(1);
      expect(ailerons.every(mesh => mesh.parent?.name === "dr1-wing-upper")).toBe(true);
      expect(model.group.getObjectByName("dr1-elevator-" + side)?.parent?.name).toBe("dr1-tailplane");
    }
    expect(model.group.getObjectByName("dr1-fin")?.parent?.name).toBe("dr1-rudder");
    const hull = model.group.getObjectByName("dr1-hull-cowling") as Mesh;
    const positions = hull.geometry.getAttribute("position");
    const section = new Box3();
    for (let i = 0; i < positions.count; i++) {
      const vertex = new Vector3().fromBufferAttribute(positions, i);
      if (Math.abs(station(vertex.z) - 18) < .001) section.expandByPoint(vertex);
    }
    expect(section.max.x / unit).toBeCloseTo(21, 4);
    expect(section.min.y / unit).toBeCloseTo(-21, 4);
    expect(section.max.y / unit).toBeCloseTo(21, 4);
    const tail = new Box3().setFromObject(model.group.getObjectByName("dr1-tailplane")!, true);
    expect((tail.max.x - tail.min.x) / unit).toBeCloseTo(116, 4);
    expect(station(tail.min.z)).toBeCloseTo(244, 4);
    const fin = new Box3().setFromObject(model.group.getObjectByName("dr1-fin")!, true);
    expect(station(fin.min.z)).toBeCloseTo(253, 4);
    expect(fin.max.y / unit).toBeCloseTo(41, 4);
  } finally {
    model.dispose();
    world.dispose();
  }
});

it.each(["left","right"])("inserts two bays before the %s lower tip and reflows them after a span upgrade", hand => {
  const world = new World(airframeById("heron_09"), 1, { director: false });
  const model = new ProceduralAircraft(world.player);
  const side = hand === "left" ? -1 : 1;
  const other = hand === "left" ? "right" : "left";
  const bounds = (id: string) => {
    const box = new Box3().setFromObject(model.group.getObjectByName(id)!, true);
    return [Math.min(side*box.min.x, side*box.max.x), Math.max(side*box.min.x, side*box.max.x)];
  };
  const tip = hand + "_wing_tip";
  const main = hand + "_wing_main";
  const original = bounds(tip);
  const fixed = [main, other + "_wing_tip", hand + "_wing_middle_tip", hand + "_wing_upper_tip"];
  const before = fixed.map(bounds);
  const check = () => {
    model.update(0, 0);
    const inserts = world.player.parts.filter(p => p.centerline?.segmentRole === "insert");
    let edge = bounds(main)[1];
    let parent = main;
    for (const p of inserts) {
      const [start,end] = bounds(p.id);
      expect(start).toBeCloseTo(edge, 5);
      expect(end-start).toBeCloseTo(.7, 5);
      expect(Math.abs(p.x)).toBeCloseTo((start+end)/2, 5);
      expect(p.parentId).toBe(parent);
      const hitXs = p.silhouette![0].map(point => point.x * side);
      expect(Math.min(...hitXs)).toBeCloseTo(start, 5);
      expect(Math.max(...hitXs)).toBeCloseTo(end, 5);
      parent = p.id;
      edge = end;
    }
    expect(bounds(tip)[0]).toBeCloseTo(edge, 5);
    expect(world.player.parts.find(p => p.id === tip)?.parentId).toBe(parent);
  };
  try {
    for (let i = 1; i <= 2; i++) {
      world.installUpgrade(upgradeById(hand + "_wing_segment")!);
      check();
      expect(bounds(tip)[1]).toBeCloseTo(original[1] + i*.7, 5);
      expect(fixed.map(bounds)).toEqual(before);
    }
    world.installUpgrade(upgradeById("giant_wing")!);
    check();
  } finally {
    model.dispose();
    world.dispose();
  }
});
