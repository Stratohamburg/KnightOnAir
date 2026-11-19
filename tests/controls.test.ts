import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { AIRFRAMES } from "../src/data/aircrafts";
import { RULES } from "../src/data/config";
import { VirtualStick } from "../src/input/VirtualStick";
import { ProceduralAircraft } from "../src/rendering/ProceduralAircraft";
import { RAD } from "../src/services/Random";
import { World } from "../src/simulation/World";

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
  model.group.position.x = player.x;
  model.group.position.z = player.z;
  model.group.updateMatrixWorld(true);
  // Match the fixed battle camera; compare what the player sees, not the raw heading number.
  const camera = new THREE.PerspectiveCamera(
    RULES.camera.fov,
    360 / 422,
    RULES.camera.near,
    RULES.camera.far,
  );
  const pitch = RULES.camera.pitch * RAD,
    distance = RULES.camera.distance;
  camera.position.set(
    player.x,
    3 + Math.sin(pitch) * distance,
    player.z - Math.cos(pitch) * distance,
  );
  camera.lookAt(player.x, 2, player.z + 1.5);
  camera.updateMatrixWorld(true);
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
    expect(surface.knob.style.transform).toMatch(/^translate\(64px, 0px\)$/);
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
    expect(intent.magnitude).toBeCloseTo(0.49, 2);
    expect(surface.attributes.get("aria-valuenow")).toBe("49");
    expect(surface.label.textContent).toBe("加速 · 油门 49%");
    expect(surface.knob.style.transform).toBe("translate(32px, 0px)");
    surface.pointer("pointermove", 2, 0);
    intent = stick.read(1);
    expect(intent.magnitude).toBeCloseTo(1, 7);
    expect(surface.dataset.mode).toBe("full");
    expect(surface.properties.get("--throttle")).toBe("100");
    expect(surface.label.textContent).toBe("满油门 · 加速 100%");
    surface.pointer("pointerup");
    expect(stick.read(1 / 60).magnitude).toBe(0);
    expect(surface.dataset.mode).toBe("cruise");
    expect(surface.properties.get("--throttle")).toBe("0");
  });
  it("shows the actual bombing trim limit and depleted energy instead of full acceleration", () => {
    const { surface, stick } = touchStick(0, -1);
    stick.setFlightState(true, true);
    stick.read(1);
    expect(surface.dataset.mode).toBe("trim");
    expect(surface.label.textContent).toBe("轰炸微调 · 油门 45%");
    stick.setFlightState(false, false);
    stick.read(1);
    expect(surface.dataset.mode).toBe("depleted");
    expect(surface.properties.get("--throttle")).toBe("0");
    expect(surface.label.textContent).toContain("能量不足");
    stick.reset();
    expect(surface.dataset.mode).toBe("cruise");
  });
});
