import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { AIRFRAMES } from "../src/data/aircrafts";
import { RULES } from "../src/data/config";
import { VirtualStick } from "../src/input/VirtualStick";
import { frameBattleCamera } from "../src/rendering/BattleCamera";
import { ProceduralAircraft } from "../src/content/3d/AircraftFactory";
import { ContentCatalog } from "../src/content/3d/ContentCatalog";
import { upgradeById } from "../src/data/upgrades";
import { RAD } from "../src/services/Random";
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

function expectFlightDirection(stick: VirtualStick, x: number, y: number) {
  const world = new World(AIRFRAMES[0], 42, { director: false });
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
    const world = new World(AIRFRAMES[0], 42, { director: false });
    const player = world.player;
    const replay = world.spawnReplayOpponent(player.frame, new NetworkController(), 0, 25);
    const preview = new ProceduralAircraft(player, catalog);
    const battle = new ProceduralAircraft(replay, catalog);
    const mesh = (model: ProceduralAircraft) =>
      model.group.getObjectByName("center_body")!.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
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
