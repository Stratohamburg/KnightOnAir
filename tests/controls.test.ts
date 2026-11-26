import { lightJet } from "./fixtures/simulationFrames";
import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { STARTER_FRAME_ID, airframeById } from "../src/data/aircrafts";
import { aircraftReviewPlate, resolveAircraftModel } from "../src/content/3d/aircraftModels";
import { RULES } from "../src/data/config";
import { VirtualStick } from "../src/input/VirtualStick";
import { frameBattleCamera } from "../src/rendering/BattleCamera";
import { ProceduralAircraft } from "../src/content/3d/AircraftFactory";
import { ContentCatalog } from "../src/content/3d/ContentCatalog";
import { upgradeById } from "../src/data/upgrades";
import { angleDelta, RAD } from "../src/services/Random";
import { World } from "../src/simulation/World";
import { NetworkController } from "../src/simulation/Controllers";

class StickSurface extends EventTarget {
  knob = { style: { transform: "" } };
  label = { textContent: "" };
  base = { getBoundingClientRect: () => ({ width: 128, height: 128 }) };
  dataset: Record<string, string> = {};
  attributes = new Map<string, string>();
  properties = new Map<string, string>();
  style = {
    setProperty: (name: string, value: string) =>
      this.properties.set(name, value),
  };
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  classes = new Set<string>();
  classList = {
    add: (name: string) => this.classes.add(name),
    remove: (name: string) => this.classes.delete(name),
  };
  private captured = new Set<number>();
  querySelector(selector: string) {
    return selector === ".stick-knob"
      ? this.knob
      : selector === ".stick-base"
        ? this.base
        : this.label;
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 200, height: 200 };
  }
  setPointerCapture(id: number) {
    this.captured.add(id);
  }
  hasPointerCapture(id: number) {
    return this.captured.has(id);
  }
  releasePointerCapture(id: number) {
    this.captured.delete(id);
  }
  pointer(type: string, x = 0, y = 0) {
    this.dispatchEvent(
      Object.assign(new Event(type), {
        pointerId: 1,
        pointerType: "touch",
        clientX: 100 + x * 64,
        clientY: 100 + y * 64,
        button: 0,
      }),
    );
  }
}

function touchStick(x: number, y: number) {
  const surface = new StickSurface(),
    stick = new VirtualStick();
  stick.attach(surface as unknown as HTMLElement);
  stick.enabled = true;
  surface.pointer("pointerdown", x, y);
  return { surface, stick };
}

function moveStick(surface: StickSurface, ...angles: number[]) {
  for (const angle of angles) {
    surface.pointer("pointermove", Math.sin(angle * RAD), -Math.cos(angle * RAD));
  }
}

describe("continuous joystick gestures", () => {
  it.each([-1, 1] as const)("holds heading sign %s across the angular boundary", (sign) => {
    const { surface, stick } = touchStick(0, -1);
    moveStick(surface, -sign * 20);
    expect(stick.read(1 / 60).continuousTurn).toBeUndefined();
    moveStick(surface, ...[40, 70, 100, 130, 160, 176].map((angle) => -sign * angle));
    expect(stick.read(1 / 60).continuousTurn).toBe(sign);
    moveStick(surface, -sign * 184, -sign * 178, -sign * 182, -sign * 176);
    expect(stick.read(1 / 60).continuousTurn).toBe(sign);
    moveStick(surface, -sign * 170, -sign * 164);
    expect(stick.read(1 / 60).continuousTurn).toBe(-sign);
  });

  it("uses the absolute target for a direct reposition and after a dead-zone crossing", () => {
    const { surface, stick } = touchStick(0, -1);
    moveStick(surface, 35);
    expect(stick.read(1).continuousTurn).toBeUndefined();
    moveStick(surface, 55);
    expect(stick.read(1).continuousTurn).toBe(-1);
    moveStick(surface, -125);
    const relocated = stick.read(1);
    expect(relocated.continuousTurn).toBeUndefined();
    expect(Math.atan2(relocated.x, relocated.z)).toBeCloseTo(125 * RAD);
    moveStick(surface, -105, -85);
    expect(stick.read(1).continuousTurn).toBe(-1);
    surface.pointer("pointermove");
    expect(stick.read(1 / 60)).toMatchObject({ active: false, magnitude: 0 });
    moveStick(surface, 35);
    expect(stick.read(1 / 60).continuousTurn).toBeUndefined();
  });

  it.each(["pointerup", "pointercancel", "lostpointercapture", "mode", "reset", "disabled"])(
    "starts a fresh gesture after %s",
    (event) => {
      const { surface, stick } = touchStick(0, -1);
      moveStick(surface, 20, 40);
      expect(stick.read(1 / 60).continuousTurn).toBe(-1);
      if (event === "mode") stick.setFlightState(true, true);
      else if (event === "reset") stick.reset();
      else if (event === "disabled") stick.enabled = false;
      else surface.pointer(event);
      expect(stick.read(1 / 60)).toMatchObject({ active: false, magnitude: 0 });
      expect(stick.read(1 / 60).continuousTurn).toBeUndefined();
      expect(surface.hasPointerCapture(1)).toBe(false);
      stick.enabled = true;
      surface.pointer("pointerdown", 1, 0);
      moveStick(surface, 110);
      expect(stick.read(1 / 60).continuousTurn).toBeUndefined();
    },
  );

  it("omits gesture preference when keyboard directions take priority", () => {
    const { surface, stick } = touchStick(0, -1);
    moveStick(surface, 20, 40);
    expect(stick.read(1 / 60).continuousTurn).toBe(-1);
    stick.key("ArrowLeft", true);
    expect(stick.read(1)).toMatchObject({ active: true, magnitude: 1, continuousTurn: undefined });
    expect(stick.read(1).x).toBeCloseTo(1);
  });

  it.each([-1, 1] as const)("reproduces heading sign %s at 30, 60, and 120 FPS", (sign) => {
    const start = -sign * 145 * RAD;
    const { surface, stick } = touchStick(Math.sin(start), -Math.cos(start));
    const snapshots = Array.from({ length: 120 }, (_, step) => {
      if (step < 8) moveStick(surface, -sign * (145 + step * 8));
      if (step === 66) surface.pointer("pointerup");
      return stick.read(RULES.step);
    });

    function run(fps: number) {
      const world = new World(lightJet, 42, { director: false });
      world.player.weapons = [];
      const state = () => {
        const { x, z, vx, vz, heading, bank, speed, turnVelocity } = world.player;
        return { x, z, vx, vz, heading, bank, speed, turnVelocity };
      };
      const states = [state()];
      let sampled = 0;
      for (let frame = 0; frame < 2 * fps; frame++) {
        world.frame(1 / fps, (time) => {
          if (sampled > 0) states.push(state());
          expect(time).toBeCloseTo((sampled + 1) * RULES.step, 9);
          return snapshots[sampled++];
        });
      }
      expect(sampled).toBe(snapshots.length);
      states.push(state());
      world.dispose();
      return states;
    }

    const at60 = run(60);
    const firstOpposite = snapshots.findIndex((snapshot, step) => {
      const error = angleDelta(Math.atan2(snapshot.x, snapshot.z), at60[step].heading);
      return snapshot.continuousTurn === sign && Math.abs(error) > 150 * RAD && error * sign < 0;
    });
    expect(firstOpposite).toBeGreaterThan(0);
    expect(at60[firstOpposite + 1].turnVelocity * sign).toBeGreaterThan(0);
    expect(run(30)).toEqual(at60);
    expect(run(120)).toEqual(at60);
  });
});

function expectFlightDirection(stick: VirtualStick, x: number, y: number) {
  const world = new World(lightJet, 42, { director: false });
  world.player.invulnerable = 10000;
  for (let i = 0; i < 180; i++) world.frame(1 / 60, stick.read(1 / 60));

  const player = world.player,
    model = new ProceduralAircraft(player);
  model.update(3, 3);
  model.group.position.set(player.x, RULES.flightAltitude, player.z);
  model.group.updateMatrixWorld(true);
  // Match the fixed battle camera; compare what the player sees, not the raw heading number.
  const camera = new THREE.PerspectiveCamera(
    RULES.camera.fov,
    360 / 422,
    RULES.camera.near,
    RULES.camera.far,
  );
  frameBattleCamera(camera, player.x, player.z, 0);
  const origin = model.group.getWorldPosition(new THREE.Vector3());
  const base = origin.clone().project(camera);
  const nose = new THREE.Vector3(0, 0, 2)
    .applyMatrix4(model.group.matrixWorld)
    .project(camera);
  const movement = origin
    .clone()
    .add(
      new THREE.Vector3(player.vx, 0, player.vz).normalize().multiplyScalar(2),
    )
    .project(camera);
  const expected = new THREE.Vector2(x, y).normalize();
  const onScreen = (tip: THREE.Vector3) =>
    new THREE.Vector2(tip.x - base.x, -(tip.y - base.y)).normalize();
  expect(onScreen(nose).dot(expected)).toBeGreaterThan(0.98);
  expect(onScreen(movement).dot(expected)).toBeGreaterThan(0.98);
  model.dispose();
}

describe("screen-relative flight controls", () => {
  it("shares geometry across preview and combat models and releases the final lease", () => {
    const catalog = new ContentCatalog();
    const world = new World(airframeById(STARTER_FRAME_ID), 42, { director: false });
    const player = world.player;
    const replay = world.spawnReplayOpponent(player.frame, new NetworkController(), 0, 25);
    const preview = new ProceduralAircraft(player, catalog);
    const battle = new ProceduralAircraft(replay, catalog);
    const mesh = (model: ProceduralAircraft) =>
      model.group.getObjectByName("dr1-hull-cockpit") as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
    const shared = mesh(preview).geometry;
    const disposed = vi.fn();
    shared.addEventListener("dispose", disposed);
    expect(mesh(battle).geometry).toBe(shared);
    expect(mesh(battle).material).not.toBe(mesh(preview).material);
    replay.bank = -.7;
    replay.parts[0].health *= .25;
    battle.update(1, 1 / 60);
    preview.update(1, 1 / 60);
    expect(battle.group.rotation.z).not.toBe(preview.group.rotation.z);
    expect(mesh(battle).material.uniforms.damage.value).toBeGreaterThan(mesh(preview).material.uniforms.damage.value);
    world.installUpgrade(upgradeById("giant_wing")!);
    preview.update(2, 1 / 60);
    preview.dispose();
    expect(disposed).not.toHaveBeenCalled();
    battle.dispose();
    expect(disposed).toHaveBeenCalledTimes(1);
    expect(catalog.stats).toMatchObject({ geometries: 0, materials: 0, textures: 0 });
    world.dispose();
  });

  it("blocks unregistered aircraft in previews and replays without allocating geometry", () => {
    const catalog = new ContentCatalog();
    const frame = lightJet;
    const world = new World(frame, 42, { director: false, showroom: true });
    const replay = world.spawnReplayOpponent(frame, new NetworkController(), 0, 25);
    const playerModel = new ProceduralAircraft(world.player, catalog);
    const replayModel = new ProceduralAircraft(replay, catalog);
    try {
      for (const model of [playerModel, replayModel]) {
        model.update(1, 1 / 60);
        expect(model.contentError).toBeDefined();
        expect(model.group.children).toHaveLength(0);
      }
      expect(catalog.stats).toMatchObject({ geometries: 0, materials: 0 });
      expect(aircraftReviewPlate(frame.id)).toBeUndefined();
      expect(resolveAircraftModel({ ...frame, geometryProfile: "fokkerDr1" }).model).toBeUndefined();
    } finally {
      playerModel.dispose();
      replayModel.dispose();
      world.dispose();
    }
  });
  it.each([
    { name: "up", x: 0, y: -1, key: "ArrowUp" },
    { name: "down", x: 0, y: 1, key: "ArrowDown" },
    { name: "left", x: -1, y: 0, key: "ArrowLeft" },
    { name: "right", x: 1, y: 0, key: "ArrowRight" },
  ])("points and flies $name for both touch and keyboard", ({ x, y, key }) => {
    expectFlightDirection(touchStick(x, y).stick, x, y);
    const keyboard = new VirtualStick();
    keyboard.enabled = true;
    keyboard.key(key, true);
    expectFlightDirection(keyboard, x, y);
  });
  it.each([
    { name: "upper left", x: -1, y: -1 },
    { name: "upper right", x: 1, y: -1 },
    { name: "lower left", x: -1, y: 1 },
    { name: "lower right", x: 1, y: 1 },
  ])("points and flies toward the $name diagonal", ({ x, y }) => {
    expectFlightDirection(touchStick(x, y).stick, x, y);
  });
  it("keeps the knob under the finger and releases directional input on cancellation", () => {
    const { surface, stick } = touchStick(1, 0);
    expect(surface.knob.style.transform).toBe("translate(64px, 0px)");
    expect(surface.classes.has("active")).toBe(true);
    surface.pointer("pointercancel");
    expect(stick.read(1 / 60).active).toBe(false);
    expect(surface.knob.style.transform).toBe("");
    expect(surface.classes.has("active")).toBe(false);
    expect(surface.hasPointerCapture(1)).toBe(false);
  });
  it("matches the throttle ring, percentage and full-power highlight to the acceleration request", () => {
    const { surface, stick } = touchStick(0.5, 0);
    let intent = stick.read(1);
    expect(intent.magnitude).toBeCloseTo(0.43, 2);
    expect(surface.attributes.get("aria-valuenow")).toBe("43");
    expect(surface.label.textContent).toBe("油门 43%");
    expect(surface.knob.style.transform).toBe("translate(32px, 0px)");
    surface.pointer("pointermove", 1, 0);
    intent = stick.read(1);
    expect(intent.magnitude).toBeCloseTo(1);
    expect(intent.boost).toBe(0);
    expect(surface.dataset.mode).toBe("full");
    surface.pointer("pointermove", 2, 0);
    intent = stick.read(1);
    expect(intent.magnitude).toBeCloseTo(1, 7);
    expect(surface.dataset.mode).toBe("boost");
    expect(surface.properties.get("--throttle")).toBe("100");
    expect(surface.label.textContent).toContain("加力");
    surface.pointer("pointerup");
    expect(stick.read(1 / 60).magnitude).toBe(0);
    expect(surface.dataset.mode).toBe("cruise");
    expect(surface.properties.get("--throttle")).toBe("0");
  });
  it("uses only the normal ring while bombing and keeps ordinary throttle during boost recharge", () => {
    const { surface, stick } = touchStick(1.4, 0);
    expect(stick.read(1).boost).toBeCloseTo(1);
    stick.setFlightState(true, true);
    expect(stick.read(1).active).toBe(false);
    surface.pointer("pointerdown", 1.4, 0);
    expect(stick.read(1).boost).toBe(0);
    expect(surface.knob.style.transform).toBe("translate(64px, 0px)");
    expect(surface.dataset.mode).toBe("trim");
    expect(surface.dataset.bombing).toBe("true");
    expect(surface.label.textContent).toBe("轰炸微调 · 油门 45%");
    stick.setFlightState(false, false, true);
    surface.pointer("pointerdown", 1.4, 0);
    const intent = stick.read(1);
    expect(intent.boost).toBeCloseTo(1);
    expect(surface.dataset.mode).toBe("locked");
    expect(surface.properties.get("--throttle")).toBe("100");
    expect(surface.label.textContent).toContain("加力回充");
    stick.reset();
    expect(surface.dataset.mode).toBe("cruise");
  });
});

describe("battle camera framing", () => {
  it.each([360 / 408, 430 / 632, 320 / 700])("keeps the aircraft centered throughout camera transitions at aspect %s", (aspect) => {
    const camera = new THREE.PerspectiveCamera(RULES.camera.fov, aspect);
    const plane = new THREE.Vector3();
    for (const blend of [0, 0.2, 0.5, 0.8, 1, 0.5, 0]) {
      const x = 17 * blend - 31;
      const z = 66 + 7 * blend;
      frameBattleCamera(camera, x, z, blend);
      const point = plane.set(x, RULES.flightAltitude, z).project(camera);
      expect(point.x).toBeCloseTo(0, 8);
      expect(point.y).toBeCloseTo(0, 8);
    }
  });

  it.each([false, true])("reduces air and ground targets by at least 30 percent with bombing mode %s", (bombing) => {
    const aspect = 360 / 408;
    const reference = new THREE.PerspectiveCamera(bombing ? 34 : 48, aspect);
    const referencePitch = (bombing ? 74 : 64) * RAD;
    const referenceDistance = bombing ? 50 : 46;
    reference.position.set(
      0,
      15 + Math.sin(referencePitch) * referenceDistance,
      -Math.cos(referencePitch) * referenceDistance,
    );
    reference.lookAt(0, 2, bombing ? 4.4 : 0);
    reference.updateMatrixWorld();
    const camera = new THREE.PerspectiveCamera(RULES.camera.fov, aspect);
    frameBattleCamera(camera, 0, 0, Number(bombing));
    const width = (view: THREE.PerspectiveCamera, y: number) => Math.abs(
      new THREE.Vector3(2, y, 10).project(view).x -
      new THREE.Vector3(-2, y, 10).project(view).x,
    );
    for (const height of [4, RULES.flightAltitude])
      expect(width(camera, height)).toBeLessThanOrEqual(0.7 * width(reference, height));
  });
});
