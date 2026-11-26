import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it, vi } from "vitest";
import { debugVisible, referenceRequested } from "../src/app/debugVisibility";
import { renderBottomNav } from "../src/content/2d/HangarView";
import { referenceCatalog } from "../src/content/2d/referenceLab";
import { airframeById } from "../src/data/aircrafts";
import { combatantById } from "../src/data/combatants";
import { ProceduralAircraft } from "../src/content/3d/AircraftFactory";
import { previewAircraftCatalog } from "../src/content/3d/previewAircraftCatalog";
import { previewDependencies, previewEffectsCatalog } from "../src/content/fx/previewEffectsCatalog";
import { airflowProfiles, resolveAirflowProfile, type AirflowProfile } from "../src/content/fx/profiles";
import { AirflowLines } from "../src/content/fx/AirflowLines";
import { EffectsPreviewScene } from "../src/rendering/EffectsPreviewScene";
import type { PreviewStage } from "../src/rendering/PreviewStage";
import { RULES } from "../src/data/config";
import { AircraftPreview, type AircraftPreviewInput } from "../src/simulation/AircraftPreview";
import { PreviewClock } from "../src/simulation/PreviewClock";

const dr1 = airframeById("heron_09");
const ho229 = airframeById("stingray_16");
const effect = (id: string) => previewEffectsCatalog().find(entry => entry.id === id)!;
const stage = {
  camera: new PerspectiveCamera(),
  setQuality: vi.fn(),
  render: vi.fn((...args: Parameters<PreviewStage["render"]>) => args[6]?.()),
} as unknown as PreviewStage;
const step = (scene: EffectsPreviewScene, count = 1) => {
  while (count-- > 0) scene.singleStep(stage);
};

describe("workbench content discovery", () => {
  it("lists configured models and dossiers independently, including empty and unmapped catalogs", () => {
    const catalog = previewAircraftCatalog();
    const noDossier = { ...dr1, id: "model-only" };
    const noModel = { ...catalog.initialPrototype!, id: "dossier-only", frameId: "no-model" };
    const mixed = previewAircraftCatalog([noDossier], [noModel], frame => frame.id === noDossier.id);
    expect(mixed.aircraft.map(frame => frame.id)).toEqual(["model-only"]);
    expect(mixed.aircraftForPrototype(noModel)).toBeUndefined();
    expect(mixed.prototypeForAircraft(noDossier.id)).toBeUndefined();
    expect(mixed.initialPrototype).toBe(noModel);
    expect(catalog.aircraftForPrototype(catalog.prototype(dr1.id))).toBe(dr1);
    expect(catalog.prototypeForAircraft(ho229.id)).toBe(catalog.prototype(ho229.id));
    expect(previewAircraftCatalog([], []).aircraft).toEqual([]);
    expect(previewAircraftCatalog([], []).initialPrototype).toBeUndefined();
    expect(referenceCatalog([])).toContain("暂无原型档案");
  });

  it("discovers and plays a variant, and resolves changed or removed profiles from its library", () => {
    const profiles = airflowProfiles as Record<string, AirflowProfile>;
    const variant = { ...profiles.wingFlow, preview: { ...profiles.wingFlow.preview, name: "翼流变体" }, opacity: .43, widthScale: 2.6 };
    const frame = { ...dr1, airflowEffects: { wingFlow: "wide-flow" } };
    profiles["wide-flow"] = variant;
    const observations: { opacity: number; width: number }[] = [];
    const follow = AirflowLines.prototype.follow;
    const followSpy = vi.spyOn(AirflowLines.prototype, "follow").mockImplementation(function (this: AirflowLines, ...args) {
      const [site, , , , opacity, , , halfSpan] = args;
      if (site.kind === "wingFlow" && halfSpan) observations.push({ opacity, width: halfSpan.length() });
      follow.apply(this, args);
    });
    try {
      const entry = effect("wide-flow");
      expect(entry).toMatchObject({ name: "翼流变体", profile: "wide-flow", playback: "continuous" });
      expect(resolveAirflowProfile("wingFlow", frame.airflowEffects).profile).toBe(variant);
      const sample = () => {
        const single = new EffectsPreviewScene({ effect: entry });
        const aircraft = new EffectsPreviewScene({ frame });
        try {
          single.queue({ type: "trigger" });
          step(single, 18);
          expect(single.diagnostics.effects!.airflow.wingFlow).toBeGreaterThan(0);
          const singleProfile = observations.splice(0)[0];
          step(aircraft, 18);
          expect(aircraft.diagnostics.effects!.airflow.wingFlow).toBeGreaterThan(0);
          return [singleProfile, observations.splice(0)[0]];
        } finally {
          single.dispose();
          aircraft.dispose();
        }
      };
      const before = sample();
      variant.opacity += .1;
      variant.widthScale *= 1.5;
      const after = sample();
      for (const [index, value] of after.entries()) {
        expect(value.opacity).toBeCloseTo(before[index].opacity + .1);
        expect(value.width).toBeCloseTo(before[index].width * 1.5);
      }
    } finally {
      followSpy.mockRestore();
      delete profiles["wide-flow"];
    }
    expect(previewEffectsCatalog().map(entry => entry.id)).not.toContain("wide-flow");
    expect(previewDependencies(frame)).toEqual([{ action: "wingFlow", id: "wide-flow" }]);
    expect(resolveAirflowProfile("wingTip", frame.airflowEffects).profile).toBe(airflowProfiles.wingTip);
  });

  it("uses a changed engine outlet from the source configuration", () => {
    const engine = combatantById(ho229.id)!.parts.find(part => part.id === "engine_0")!;
    const original = engine.outletOffset;
    const outlet = () => {
      const preview = new AircraftPreview(ho229);
      const model = new ProceduralAircraft(preview.actor);
      const site = model.effectSites.sources.find(site => site.partId === engine.id && site.kind === "jetOutlet")!;
      site.node.updateWorldMatrix(true, false);
      const position = new Vector3().fromArray(site.position).applyMatrix4(site.node.matrixWorld);
      model.dispose();
      return position;
    };
    const before = outlet();
    try {
      engine.outletOffset = { x: (original?.x ?? 0) + 1, y: original?.y ?? 0, z: original?.z ?? 0 };
      expect(outlet().x).toBeCloseTo(before.x + 1, 5);
    } finally {
      engine.outletOffset = original;
    }
  });

  it("gates the showroom and recognizes both direct-link forms", () => {
    expect(debugVisible("", false)).toBe(false);
    expect(debugVisible("", true)).toBe(true);
    expect(debugVisible("?debug=1", false)).toBe(true);
    expect(renderBottomNav("sortie", false)).not.toContain('data-tab="showroom"');
    expect(renderBottomNav("sortie", true)).toContain('data-tab="showroom"');
    expect(referenceRequested("?reference=1&frame=heron_09", "")).toBe(true);
    expect(referenceRequested("", "#reference")).toBe(true);
  });
});

describe("fixed-step effect previews", () => {
  it.each(previewEffectsCatalog().map(entry => [entry.id, entry] as const))("plays the library entry %s", (_id, entry) => {
    const scene = new EffectsPreviewScene({ effect: entry });
    try {
      scene.queue({ type: "trigger" });
      step(scene, entry.kind === "airflow" ? 15 : 1);
      expect(scene.diagnostics.effects?.active || scene.diagnostics.rainVertices).toBeGreaterThan(0);
      expect(scene.isEmitting).toBe(entry.playback === "continuous");
      scene.reset(false);
      expect(scene.diagnostics.effects?.active ?? scene.diagnostics.rainVertices).toBe(0);
    } finally {
      scene.dispose();
    }
    expect(scene.diagnostics.resources).toMatchObject({ geometries: 0, materials: 0, textures: 0 });
  });

  it("replays a gun flash and lets an airflow trail and rainfall expire after stopping", () => {
    const muzzle = new EffectsPreviewScene({ effect: effect("machineGun/muzzle") }, 27);
    const airflow = new EffectsPreviewScene({ effect: effect("wingFlow") });
    const rain = new EffectsPreviewScene({ effect: effect("rain") }, 27);
    try {
      muzzle.queue({ type: "trigger" });
      step(muzzle, 4);
      const before = muzzle.diagnostics.effects;
      expect(before?.pools.gunSmoke.active).toBe(1);
      expect(before?.pools.casings.active).toBe(1);
      muzzle.reset(true);
      step(muzzle, 4);
      expect(muzzle.diagnostics.effects).toEqual(before);
      for (const scene of [airflow, rain]) {
        scene.queue({ type: "trigger" });
        step(scene, 30);
        scene.queue({ type: "stop" });
        step(scene);
        expect(scene.diagnostics.effects?.active || scene.diagnostics.rainVertices).toBeGreaterThan(0);
        step(scene, 240);
        expect(scene.diagnostics.effects?.active ?? scene.diagnostics.rainVertices).toBe(0);
      }
    } finally {
      muzzle.dispose();
      airflow.dispose();
      rain.dispose();
    }
  });

  it("advances a paused clock by one step and repeats the exact banked muzzle event", () => {
    const clock = new PreviewClock<AircraftPreviewInput>();
    let flight = new AircraftPreview(dr1);
    const shots: ReturnType<AircraftPreview["apply"]> = [];
    const update = (step: number, inputs: readonly AircraftPreviewInput[]) => {
      const time = step * RULES.step;
      for (const input of inputs) shots.push(...flight.apply(input, time));
      flight.advance(time, RULES.step);
    };
    clock.advance(1, update);
    expect(clock.step).toBe(0);
    clock.queue({ type: "track", value: "slalom" });
    for (let i = 0; i < 41; i++) clock.singleStep(update);
    clock.rate = .5;
    clock.paused = false;
    clock.advance(RULES.step, update);
    expect(clock.step).toBe(41);
    clock.advance(RULES.step, update);
    expect(clock.step).toBe(42);
    clock.paused = true;
    clock.queue({ type: "fire" });
    clock.singleStep(update);
    const pose = flight.pose;
    expect(clock.step).toBe(43);
    expect(Math.abs(pose.bank)).toBeGreaterThan(.15);
    expect(shots).toHaveLength(2);
    const before = shots.splice(0);
    flight = new AircraftPreview(dr1);
    clock.reset(true);
    for (let i = 0; i < 43; i++) clock.singleStep(update);
    expect(flight.pose).toEqual(pose);
    expect(shots).toEqual(before);
  });

  it("keeps both Dr.I wing bands across a reversal and combines them with independent tip strands", () => {
    const scene = new EffectsPreviewScene({ frame: dr1 });
    try {
      expect(scene.aircraft).toMatchObject({ track: "straight", power: "cruise" });
      scene.queue({ type: "track", value: "slalom" });
      scene.queue({ type: "power", value: "low" });
      step(scene, 30);
      const initial = scene.aircraft!.pose;
      const bank = [initial.bank];
      const speed = scene.aircraft!.actor.speed;
      scene.queue({ type: "power", value: "boost" });
      step(scene);
      const next = scene.aircraft!.pose;
      expect(Math.hypot(next.x - initial.x, next.z - initial.z)).toBeLessThan(1);
      for (let i = 0; i < 230; i++) {
        step(scene);
        const streams = scene.diagnostics.effects!.airflow;
        expect(streams.wingFlow).toBeGreaterThanOrEqual(2);
        expect(streams.wingTip).toBeGreaterThanOrEqual(2);
        bank.push(scene.aircraft!.actor.bank);
      }
      expect(Math.min(...bank)).toBeLessThan(-.2);
      expect(Math.max(...bank)).toBeGreaterThan(.2);
      expect(scene.aircraft!.actor.speed).toBeGreaterThan(speed);
      scene.queue({ type: "track", value: "right" });
      step(scene, 160);
      expect(scene.aircraft!.actor.turnVelocity).toBeLessThan(0);
      scene.visible.clear();
      scene.visible.add("wingFlow");
      scene.draw(stage, "high");
      expect(scene.diagnostics.effects!.airflow).toMatchObject({ wingTip: 0 });
      scene.visible.add("wingTip");
      scene.draw(stage, "high");
      expect(scene.diagnostics.effects!.airflow.wingTip).toBeGreaterThanOrEqual(2);
    } finally {
      scene.dispose();
    }
  });

  it("observes an engine fault and banked fire and keeps each wing damage site independent", () => {
    const scene = new EffectsPreviewScene({ frame: ho229 });
    try {
      scene.queue({ type: "power", value: "boost" });
      scene.queue({ type: "track", value: "left" });
      step(scene, 35);
      scene.queue({ type: "fire" });
      step(scene);
      expect(scene.diagnostics.effects?.pools.flashes.active).toBeGreaterThanOrEqual(2);
      expect(scene.diagnostics.effects?.pools.casings.active).toBeGreaterThanOrEqual(2);
      scene.damage("engine_0", undefined, true);
      step(scene);
      expect(scene.aircraft!.actor.parts.find(part => part.id === "engine_0")?.health).toBe(0);
      expect(scene.aircraft!.actor.parts.find(part => part.id === "engine_1")?.health).toBeGreaterThan(0);
      expect(scene.diagnostics.effects?.engineRoots).toBeGreaterThan(0);
      scene.damage("left_wing_tip");
      step(scene);
      scene.damage("left_wing_tip");
      step(scene, 30);
      expect(scene.diagnostics.effects?.holes).toBe(3);
      scene.queue({ type: "repair", siteId: 2 });
      step(scene);
      expect(scene.diagnostics.effects?.holes).toBe(2);
      scene.queue({ type: "detach", partId: "left_wing_tip" });
      step(scene, 8);
      expect(scene.diagnostics.effects?.pools.detached.active).toBe(1);
      expect(scene.diagnostics.effects?.holes).toBe(2);
      step(scene, 130);
      expect(scene.diagnostics.effects?.holes).toBe(1);
      scene.reset(false);
      expect(scene.diagnostics.effects?.holes).toBe(0);
    } finally {
      scene.dispose();
    }
    expect(scene.diagnostics.resources).toMatchObject({ geometries: 0, materials: 0 });
  });
});
