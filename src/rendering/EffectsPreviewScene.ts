import {
  Group, Matrix4, Mesh, MeshBasicMaterial, Object3D, BoxGeometry, SphereGeometry, PlaneGeometry,
  Raycaster, Vector2, Vector3,
} from "three";
import type { Airframe } from "../data/aircrafts";
import { RULES, type Quality } from "../data/config";
import { AircraftEffectSites, type AircraftEffectSite } from "../content/3d/aircraftEffectSites";
import { ProceduralAircraft, type ReferenceAircraft } from "../content/3d/AircraftFactory";
import { ContentCatalog } from "../content/3d/ContentCatalog";
import type { ActorPose, Point3 } from "../content/3d/anchors";
import { createProjectileBatches } from "../content/3d/SceneObjects";
import { CombatEffects, type DamageEmitter } from "../content/fx/CombatEffects";
import { previewDependencies, type EffectEntry } from "../content/fx/previewEffectsCatalog";
import { airflowProfile, weaponEffectProfile } from "../content/fx/profiles";
import { WeatherRain } from "../content/fx/WeatherRain";
import { AircraftPreview, type AircraftPreviewInput } from "../simulation/AircraftPreview";
import { partFromRecipe } from "../simulation/parts";
import { PreviewClock } from "../simulation/PreviewClock";
import type { AirMotionState, CombatSnapshot, Projectile, WorldEvent } from "../simulation/types";
import { PreviewStage, previewScene } from "./PreviewStage";

export type DisplayCategory = "wingFlow" | "wingTip" | "airflow" | "engines" | "damage" | "fire";
export const categories: readonly DisplayCategory[] = ["wingFlow", "wingTip", "airflow", "engines", "damage", "fire"];
const engineSites = new Set(["propeller", "exhaust", "jetOutlet"]);
const defaults = { yaw: Math.PI + .65, pitch: .52 };
const origin: ActorPose = { x: 0, y: 0, z: 0, vx: 0, vz: 0, heading: 0, bank: 0 };
type Input = AircraftPreviewInput | { type: "trigger" } | { type: "stop" };
type Selection = { frame: Airframe } | { effect: EffectEntry };

export class EffectsPreviewScene {
  readonly clock = new PreviewClock<Input>();
  private readonly scene = previewScene();
  private readonly catalog = new ContentCatalog();
  private readonly props = new Group();
  private readonly markers = new Group();
  private readonly markerGeometry = this.catalog.geometry("preview:anchor", () => new SphereGeometry(.105, 6, 4));
  private readonly markerMaterial = this.catalog.material("preview:anchor", () => new MeshBasicMaterial({ color: "#ffb040" }));
  private readonly markerSites: { mesh: Mesh; site: AircraftEffectSite }[] = [];
  private readonly releases: (() => void)[] = [];
  private readonly projectileTransform = new Object3D();
  private readonly fixedTarget = new Vector3();
  private readonly followTarget = new Vector3();
  private flight?: AircraftPreview;
  private model?: ProceduralAircraft;
  private combat?: CombatEffects;
  private rain?: WeatherRain;
  private reference?: NonNullable<DamageEmitter["model"]>;
  private projectileMeshes?: ReturnType<typeof createProjectileBatches>;
  private projectiles: Projectile[] = [];
  private seed = 491;
  private nextSiteId = 1;
  private emitting = false;
  private triggeredAt = 0;
  private stoppedAt?: number;
  private quality: Quality = "standard";
  dark = true;
  anchors = false;
  following = true;
  yaw = defaults.yaw;
  pitch = defaults.pitch;
  readonly visible = new Set(categories);
  readonly missing;

  constructor(private readonly selection: Selection, seed = 491) {
    this.seed = seed;
    this.scene.add(this.props, this.markers);
    this.missing = "frame" in selection ? previewDependencies(selection.frame) : [];
    try {
      this.setup();
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  get aircraft() { return this.flight; }
  hasSurface(partId: string) { return !!this.model?.effectSites.surfaces.some(surface => surface.partId === partId); }
  get isEmitting() { return this.emitting; }
  get diagnostics() {
    return { step: this.clock.step, resources: this.catalog.stats, effects: this.combat?.diagnostics,
      rainVertices: this.rain?.lines.geometry.drawRange.count ?? 0 };
  }

  private prop(id: string, geometry: () => BoxGeometry | PlaneGeometry | SphereGeometry, color: string) {
    const shape = this.catalog.geometry(`preview:${id}`, geometry);
    const finish = this.catalog.material(`preview:${color}`, () => new MeshBasicMaterial({ color }));
    this.releases.push(shape.release, finish.release);
    const mesh = new Mesh(shape.value, finish.value);
    this.props.add(mesh);
    return mesh;
  }

  private setup() {
    if ("frame" in this.selection) {
      this.flight = new AircraftPreview(this.selection.frame, weapon =>
        !this.missing.some(({ action }) => action === weapon.anchorId));
      this.model = new ProceduralAircraft(this.flight.actor, this.catalog);
      if (this.model.contentError) throw new Error(this.model.contentError);
      this.scene.add(this.model.group);
      this.combat = new CombatEffects(this.scene, this.scene, this.seed);
    } else if (this.selection.effect.kind === "rain") {
      this.rain = new WeatherRain(this.seed);
      this.scene.add(this.rain.lines);
    } else {
      this.combat = new CombatEffects(this.scene, this.scene, this.seed);
      this.setupReference(this.selection.effect);
    }
    for (const site of (this.model ?? this.reference)?.effectSites.sources ?? []) {
      const mesh = new Mesh(this.markerGeometry.value, this.markerMaterial.value);
      this.markers.add(mesh);
      this.markerSites.push({ mesh, site });
    }
  }

  private setupReference(effect: EffectEntry) {
    const surface = effect.kind === "damage" || effect.kind === "detach";
    const group = new Group();
    this.props.add(group);
    const part = partFromRecipe("reference", { role: "engine", detachable: true, health: 10 });
    const effectSites = new AircraftEffectSites();
    const actor: ReferenceAircraft & AirMotionState = {
      ...origin, parts: [part], weapons: [], prevX: 0, prevZ: 0, energy: 1, speed: 18,
      turnVelocity: 0, rollVelocity: 0, boosting: false, boostLocked: false, boost: 0,
      frame: { id: "reference", name: "参考挂点", role: "", color: "#647f87", accent: "#e0edf8", wingspan: 3, length: 3, liftCenterY: 0, liftCenterZ: 0 },
      stats: { maxSpeed: 18, wingspan: 3, length: 3 },
    };
    this.reference = { group, effectSites, actor, matrixAtPose: node => node.matrixWorld.clone() };
    const point = [0, 0, 0] as const;
    if (surface || effect.kind === "impact" || effect.kind === "projectile") {
      const target = this.prop("target", () => new BoxGeometry(3.1, .22, 2.7), "#657f87");
      target.position.set(0, -.18, 0);
      group.add(target);
      if (surface) effectSites.surfaces.push({ partId: part.id, mesh: target });
    }
    if (effect.kind === "projectile") {
      this.projectileMeshes = createProjectileBatches(this.catalog);
      this.scene.add(this.projectileMeshes.batches[0]);
    }
    if (effect.kind === "airflow") {
      const wide = airflowProfile(effect.profile ?? "")?.widthScale !== undefined;
      const w = wide ? 1.3 : .16;
      const root = this.prop("flow-" + w, () => new BoxGeometry(w, .09, .22), "#6b8c95");
      group.add(root);
      effectSites.add(part.id, "flow", wide ? "wingFlow" : "wingTip", group, point,
        wide ? { end: point, halfSpan: [.65, 0, 0] } : {});
    }
    if (effect.kind === "propeller" || effect.kind === "jetOutlet" || effect.kind === "exhaust" || effect.kind === "noseWave") {
      effectSites.add(part.id, effect.kind, effect.kind, group, point, { radius: .44 });
    }
    if (effect.kind === "muzzle") {
      const fixture = this.prop("fixture", () => new BoxGeometry(.32, .32, 1.3), "#657f87");
      fixture.position.z = -.65;
      group.add(fixture);
      effectSites.add(part.id, "muzzle", "muzzle", group, point);
      if (effect.ammunition === "gun")
        effectSites.add(part.id, "casing", "casing", group, [.2, 0, -.4], { direction: [1, .4, 0] });
    }
  }

  queue(input: Input) {
    if (input.type === "hit") this.nextSiteId = Math.max(this.nextSiteId, input.siteId + 1);
    this.clock.queue(input);
  }

  damage(partId: string, local?: Point3, fault = false) {
    this.queue({ type: "hit", partId, local, fault, siteId: this.nextSiteId });
  }

  pointAt(camera: PreviewStage["camera"], x: number, y: number) {
    if (!this.model || !this.flight) return;
    const ray = new Raycaster();
    ray.setFromCamera(new Vector2(x, y), camera);
    const visible = this.model.effectSites.surfaces.filter(({ mesh }) => {
      for (let node: Object3D | null = mesh; node; node = node.parent) if (!node.visible) return false;
      return true;
    });
    const hit = ray.intersectObjects(visible.map(({ mesh }) => mesh), false)[0];
    const surface = visible.find(({ mesh }) => mesh === hit?.object);
    if (!surface || !hit) return;
    const pose = this.flight.pose;
    // Convert the clicked world point to the simulation pose before queuing it.
    // At playback the new pose transforms the same local point through the shared anchors.
    const local = hit.point.clone().sub(new Vector3(pose.x, pose.y, pose.z))
      .applyMatrix4(new Matrix4().makeRotationY(-pose.heading))
      .applyMatrix4(new Matrix4().makeRotationZ(-pose.bank));
    this.damage(surface.partId, local);
  }

  setFollowing(following: boolean) {
    if (!following) this.fixedTarget.copy(this.followTarget);
    this.following = following;
  }

  advance(dt: number, stage: PreviewStage) {
    this.clock.advance(dt, (step, inputs) => this.update(step, inputs, stage));
  }

  singleStep(stage: PreviewStage) {
    this.clock.singleStep((step, inputs) => this.update(step, inputs, stage));
  }

  private update(step: number, inputs: readonly Input[], stage: PreviewStage) {
    const time = step * RULES.step;
    const events: WorldEvent[] = [];
    for (const input of inputs)
      if (input.type === "track" || input.type === "power") this.flight?.apply(input, time);
    this.flight?.advance(time, RULES.step);
    for (const input of inputs) {
      if (input.type === "trigger") events.push(...this.trigger(time));
      else if (input.type === "stop") {
        this.emitting = false;
        this.stoppedAt = time;
      }
      else if (this.flight && input.type !== "track" && input.type !== "power") {
        events.push(...this.flight.apply(input, time));
        if (input.type === "repair") this.combat?.repairPreviewSite(input.siteId);
      }
    }
    if (this.model && this.flight) {
      const { x, y, z } = this.flight.pose;
      this.model.group.position.set(x, y, z);
      this.model.update(time, RULES.step);
      this.model.group.updateWorldMatrix(true, true);
      this.followTarget.set(x, 0, z);
    }
    const effect = "effect" in this.selection ? this.selection.effect : undefined;
    const reference = this.reference;
    if (effect?.kind === "airflow" && reference && this.emitting) {
      const age = time - this.triggeredAt;
      reference.group.position.set(Math.sin(age * 2) * 1.15, .12, Math.cos(age * 2) * 2.2);
      reference.group.updateWorldMatrix(true, true);
    }
    if (effect?.kind === "propeller" && reference && this.emitting) {
      reference.group.rotation.z += RULES.step * 18;
      reference.group.updateWorldMatrix(true, true);
    }
    if (this.rain) this.updateRain(time);
    this.moveProjectiles(events, time);
    const sources: DamageEmitter[] = this.flight && this.model
      ? [{ id: "player", model: this.model, pose: this.flight.pose, parts: this.flight.actor.parts }]
      : reference && effect?.kind !== "airflow" ? [{ id: "player", model: reference, pose: origin, parts: reference.actor.parts }] : [];
    const outletActive = this.emitting || (effect?.kind === "noseWave" && time - this.triggeredAt < .32 && this.triggeredAt > 0);
    this.combat?.update(RULES.step, stage.camera, this.quality, this.projectiles, undefined, events, sources, [], {
      emitting: !!this.flight || outletActive,
      airflow: effect?.kind === "airflow" && reference && this.emitting ? flight => {
        const site = reference.effectSites.sources[0];
        const anchor = reference.group.position;
        flight.emitAirflow(site, effect.profile ?? effect.id, anchor, new Vector3(0, 0, -1), .7, this.quality,
          site.halfSpan ? anchor.clone().add(new Vector3(0, 0, .8)) : undefined,
          site.halfSpan ? new Vector3().fromArray(site.halfSpan) : undefined);
      } : undefined,
    });
  }

  private trigger(time: number): WorldEvent[] {
    if (!("effect" in this.selection)) return [];
    const { effect } = this.selection;
    this.triggeredAt = time;
    this.stoppedAt = undefined;
    this.emitting = effect.playback === "continuous";
    const profile = effect.profile && weaponEffectProfile(effect.profile);
    const powered = effect.ammunition === "powered";
    const snapshot: CombatSnapshot = { effectId: effect.profile, position: { x: 0, y: 0, z: 0 },
      direction: { x: 0, y: 0, z: 1 }, heading: 0, bank: 0, velocity: { x: 0, y: 0, z: 0 },
      damageType: powered ? "explosive" : "kinetic" };
    switch (effect.kind) {
      case "muzzle":
        snapshot.actorPose = origin;
        snapshot.barrel = { partId: "reference", index: 0 };
        snapshot.ammunition = powered ? "powered" : "gun";
        return [{ type: "weapon_fired", time, owner: "player", entityId: "player", anchorId: "reference", snapshot }];
      case "impact": return [{ type: "enemy_hit", time, enemyId: 1, amount: 1, snapshot: { ...snapshot, surface: "metal" } }];
      case "projectile":
        if (profile) this.projectiles = [{
          active: true, id: 1, team: "player", kind: powered ? "missile" : "bullet",
          x: 0, y: .16, z: -5, prevX: 0, prevZ: -5, vy: 0, weaponId: effect.profile ?? "", effectId: effect.profile,
          damageType: snapshot.damageType, heading: 0, speed: profile.speed * 2, life: 1, age: 0, damage: 1,
          targetId: 0, pierce: 0, bounce: 0, explosion: 0, homing: 0, homingLife: 0, escort: false, hitIds: [],
          burn: 0, slow: 0, armorBreak: 0,
        }];
        return [];
      case "damage":
      case "detach": {
        const part = this.reference?.actor.parts[0];
        if (!part) return [];
        part.health = 3;
        const damaged = { ...snapshot, position: { x: 0, y: -.07, z: 0 }, contact: true,
          damagedParts: [{ id: part.id, amount: 7 }] };
        const events: WorldEvent[] = [{ type: "player_hit", time, amount: 7, source: "preview", part: part.id, snapshot: damaged }];
        if (effect.kind === "detach") events.push({ type: "part_detached", time, owner: "player", entityId: "player",
          partId: part.id, partKind: part.kind, color: "#657f87", snapshot });
        return events;
      }
      case "destroyed": return [{ type: "player_destroyed", time, snapshot }];
      case "burst":
      case "coin":
      case "heal": return [{ type: "effect_requested", time, profile: effect.kind, position: snapshot.position, size: 1.9, duration: .45 }];
      case "noseWave":
      case "exhaust":
      case "jetOutlet":
      case "propeller": {
        const actor = this.reference?.actor as (ReferenceAircraft & AirMotionState) | undefined;
        if (!actor) return [];
        actor.boost = 1;
        actor.effectiveThrottle = 1;
        if (effect.kind === "noseWave") actor.speed = actor.stats.maxSpeed * 1.4;
        return [];
      }
      default: return [];
    }
  }

  private moveProjectiles(events: WorldEvent[], time: number) {
    const mesh = this.projectileMeshes?.batches[0];
    for (const projectile of this.projectiles) {
      if (!projectile.active) continue;
      projectile.z += projectile.speed * RULES.step;
      if (projectile.z >= 0) {
        projectile.active = false;
        events.push({ type: "enemy_hit", time, enemyId: 1, amount: 1, snapshot: {
          position: { x: 0, y: .11, z: 0 }, direction: { x: 0, y: 0, z: 1 }, velocity: { x: 0, y: 0, z: projectile.speed },
          heading: 0, bank: 0, damageType: projectile.damageType, effectId: projectile.effectId, surface: "metal",
        } });
      }
      if (mesh) {
        this.projectileTransform.position.set(projectile.x, projectile.y, projectile.z);
        this.projectileTransform.updateMatrix();
        mesh.setMatrixAt(0, this.projectileTransform.matrix);
        mesh.count = Number(projectile.active);
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
  }

  private updateRain(time: number) {
    this.rain?.update(time, this.triggeredAt > 0 ? .72 : 0, 0, 0, 2, .7, this.quality, this.stoppedAt);
  }

  draw(stage: PreviewStage, quality: Quality) {
    this.quality = quality;
    stage.setQuality(quality);
    if (this.rain) this.updateRain(this.clock.step * RULES.step);
    this.markers.visible = this.anchors;
    if (this.anchors) for (const { mesh, site } of this.markerSites) {
      site.node.updateWorldMatrix(true, false);
      mesh.position.fromArray(site.end ?? site.position).applyMatrix4(site.node.matrixWorld);
      mesh.visible = true;
      for (let node: Object3D | null = site.node; node; node = node.parent) mesh.visible &&= node.visible;
    }
    const frame = "frame" in this.selection ? this.selection.frame : undefined;
    const distance = frame ? Math.max(10, frame.wingspan * 2.3, frame.length * 2.3) : this.rain ? 36 : 10;
    stage.render(this.scene, this.following ? this.followTarget : this.fixedTarget,
      distance * Math.max(1, .9 / stage.camera.aspect), this.yaw, this.pitch, this.dark, () => {
        this.combat?.repaint(stage.camera, quality);
        if (this.model) this.combat?.showPreview({
          site: site => engineSites.has(site.kind) ? this.visible.has("engines")
            : site.kind === "wingFlow" || site.kind === "wingTip" ? this.visible.has(site.kind) : this.visible.has("airflow"),
          engines: this.visible.has("engines"), damage: this.visible.has("damage"), fire: this.visible.has("fire"),
        });
      });
  }

  reset(replay: boolean, seed = this.seed) {
    this.clear();
    this.seed = seed;
    this.clock.reset(replay);
    this.triggeredAt = 0;
    this.emitting = false;
    this.stoppedAt = undefined;
    if (!replay) this.nextSiteId = 1;
    this.followTarget.set(0, 0, 0);
    this.fixedTarget.set(0, 0, 0);
    this.setup();
  }

  private clear() {
    this.combat?.dispose();
    this.model?.dispose();
    this.rain?.dispose();
    this.projectileMeshes?.dispose();
    this.reference = undefined;
    this.combat = this.model = this.rain = undefined;
    this.projectileMeshes = undefined;
    this.projectiles = [];
    this.markers.clear();
    this.markerSites.length = 0;
    this.props.clear();
    for (const release of this.releases.splice(0)) release();
  }

  dispose() {
    this.clear();
    this.markerGeometry.release();
    this.markerMaterial.release();
    this.scene.clear();
  }
}
