import { Matrix3, Quaternion, Vector3, type Camera, type Scene } from "three";
import type { ProceduralAircraft } from "../3d/AircraftFactory";
import { combatantById } from "../../data/combatants";
import type { Quality } from "../../data/config";
import { AirflowLines } from "./AirflowLines";
import { EffectBatch } from "./EffectBatch";
import { airflowProfile, resolveAirflowProfile, flightEffectProfiles, propulsionSmoke } from "./profiles";
import type { AircraftEffectSite } from "../3d/aircraftEffectSites";

const axis = new Vector3(0, 0, 1);
const rest = { x: 0, y: 0, z: 0 };
const particle = { heading: 0, bank: 0, length: 1, life: 1, hold: 0, priority: 1, velocity: rest };
type FlightModel = Pick<ProceduralAircraft, "actor" | "group" | "effectSites">;

/** Current attached shapes are rewritten on every draw. Released segments age in world space. */
export class AircraftFlightEffects {
  readonly lines: AirflowLines;
  readonly bands: AirflowLines;
  readonly pistonSmoke: AirflowLines;
  readonly jetSmoke: AirflowLines;
  readonly trails: readonly AirflowLines[];
  private readonly basis = new Matrix3();
  private readonly span = new Vector3();
  private readonly view = new Vector3();
  readonly cones: EffectBatch;
  readonly arcs: EffectBatch;
  readonly batches: EffectBatch[];
  private clocks = new WeakMap<FlightModel, {fast: boolean; waveUntil: number}>();
  private point = new Vector3();
  private dir = new Vector3();
  private tail = new Vector3();
  private rotation = new Quaternion();

  constructor(scene: Scene, attachedScene = scene) {
    this.lines = new AirflowLines(attachedScene, scene === attachedScene ? 512 : 96);
    this.bands = new AirflowLines(attachedScene, scene === attachedScene ? 192 : 64, true);
    const smokeCapacity = scene === attachedScene ? 96 : 24;
    this.pistonSmoke = new AirflowLines(attachedScene, smokeCapacity, true, propulsionSmoke.piston);
    this.jetSmoke = new AirflowLines(attachedScene, smokeCapacity, true, propulsionSmoke.jet);
    this.trails = [this.lines, this.bands, this.pistonSmoke, this.jetSmoke];
    this.cones = new EffectBatch(attachedScene, 96, "cone");
    this.arcs = new EffectBatch(attachedScene, 96, "arc");
    this.batches = [this.cones, this.arcs];
  }
  resetRoots() {
    this.cones.reset();
    this.arcs.reset();
  }
  reset() {
    this.clocks = new WeakMap();
    for (const trail of this.trails) trail.reset();
  }

  emit(model: FlightModel, time: number, quality: Quality, camera: Camera,
    enabled: (site: AircraftEffectSite) => boolean = () => true) {
    if (!model.group.visible) return;
    const actor = model.actor;
    const motion = "boost" in actor ? actor : undefined;
    const config = "configId" in actor ? combatantById(actor.configId ?? "") : undefined;
    const maxSpeed = "stats" in actor ? actor.stats.maxSpeed : config?.frame.maxSpeed ?? 20;
    const profile = flightEffectProfiles[config?.visual.modelKey ?? ("frame" in actor ? actor.frame.id : "")] ?? flightEffectProfiles.default;
    const throttle = motion?.effectiveThrottle ?? .35, boost = motion?.boost ?? 0;
    const accel = Math.min(1, Math.max(0, motion?.acceleration ?? 0) / 8);
    const turn = Math.min(1, (motion?.turnLoad ?? 0) / 3);
    let clock = this.clocks.get(model);
    if (!clock) {
      clock = {fast: false, waveUntil: -1};
      this.clocks.set(model, clock);
    }
    const fast = actor.speed >= maxSpeed * profile.waveThreshold;
    if (fast && !clock.fast) clock.waveUntil = time + .32;
    clock.fast = fast;
    model.group.updateWorldMatrix(true, true);
    camera.getWorldDirection(this.view);
    const low = quality === "low";
    for (const site of model.effectSites.sources) {
      if (!enabled(site)) continue;
      if (["muzzle","casing","ordnanceRelease"].includes(site.kind)) continue;
      const part = actor.parts.find(p => p.id === site.partId);
      if (!part || part.destroyed || ("health" in actor && actor.health <= 0)) continue;
      let visible = true;
      for (let node = site.node.parent; node; node = node.parent) visible &&= node.visible;
      if (!visible || !site.node.visible) continue;
      const power = part.health / Math.max(1, part.maxHealth);
      const p = this.point.fromArray(site.position).applyMatrix4(site.node.matrixWorld);
      const d = this.dir.fromArray(site.direction).transformDirection(site.node.matrixWorld);
      const q = this.rotation.setFromUnitVectors(axis, d);
      const radius = site.radius ?? .24;
      const aft = this.tail.copy(p);
      const shape = { ...particle, opacity:.44, color: "#cbe0de", position: p, orientation: q };
      switch (site.kind) {
        case "noseWave":
          if (clock.waveUntil > time) this.arcs.spawn({...shape, size: 1.8 + (.32 - clock.waveUntil + time) * 2,
            orientation: q.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0), Math.PI/2))});
          break;
        case "jetOutlet":
        case "exhaust": {
          if (power <= 0) break;
          const jet = site.kind === "jetOutlet";
          const length = (.52 + throttle * .85 + boost * profile.boostLength) * power *
            (1 + .09 * Math.sin(time * 27));
          if (jet) {
            const sections = boost && profile.segmented ? 3 : 1;
            for (let n = 0; n < sections; n++) {
              aft.copy(p).addScaledVector(d, length * (n + .5) / sections);
              this.cones.spawn({...shape, position: aft, opacity:.9, size: radius * (2 - .4*n),
                thickness: length / sections / (radius * (2 - .4*n)),
                color: n === 0 ? "#e3f7ff" : "#8dc9f4"});
            }
          }
          const smoke = jet ? propulsionSmoke.jet : propulsionSmoke.piston;
          const trail = jet ? this.jetSmoke : this.pistonSmoke;
          if (jet) aft.addScaledVector(d, length * .82);
          this.span.crossVectors(d, this.view);
          if (this.span.lengthSq() < .01) this.span.set(1, 0, 0).transformDirection(site.node.matrixWorld);
          this.span.normalize().multiplyScalar(smoke.width * (.85 + .45 * throttle + .2 * boost) *
            Math.sqrt(power) * Math.max(1, radius / .36));
          trail.follow(site, aft, d, smoke.life, smoke.opacity * (.65 + .35 * power),
            low ? .06 : .042, undefined, this.span);
          break;
        }
        case "propeller": {
          if (power <= 0) break;
          site.node.getWorldQuaternion(q);
          this.arcs.spawn({...shape, opacity:.15 + boost*.25, size:radius * 2, color:"#c9dbd6"});
          aft.set(radius,0,0).applyQuaternion(q).add(p);
          this.lines.follow(site,aft,d,.08 + .07*boost,.10 + .14*boost,1/90);
          break;
        }
        case "wingTip":
        case "wingFlow":
        case "tailTip":
        case "protrusion":
        case "wake": {
          const load = site.kind === "wake" ? accel : Math.min(1, turn + accel * .25);
          const { id } = resolveAirflowProfile(site.kind, "frame" in actor ? actor.frame.airflowEffects : undefined);
          if (site.end) aft.fromArray(site.end).applyMatrix4(site.node.matrixWorld);
          if (site.kind === "wingFlow" && site.halfSpan) {
            this.span.fromArray(site.halfSpan).applyMatrix3(this.basis.setFromMatrix4(site.node.matrixWorld));
            this.emitAirflow(site, id, aft, d, load, quality, p, this.span);
          } else {
            this.emitAirflow(site, id, aft, d, load, quality);
          }
        }
      }
    }
  }

  emitAirflow(site: AircraftEffectSite, id: string, root: Vector3, direction: Vector3, load: number,
    quality: Quality, lead?: Vector3, halfSpan?: Vector3) {
    const style = airflowProfile(id);
    if (!style) return;
    const life = (style.life + style.extension * load) * site.strength;
    const opacity = (style.opacity + style.brighten * load) * Math.sqrt(site.strength);
    const span = halfSpan?.multiplyScalar(style.widthScale ?? 1);
    (span ? this.bands : this.lines).follow(site, root, direction, life, opacity,
      quality === "low" ? .06 : .034, lead, span);
  }
}
