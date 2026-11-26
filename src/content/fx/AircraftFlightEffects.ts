import { Matrix3, Quaternion, Vector3, type Scene } from "three";
import type { ProceduralAircraft } from "../3d/AircraftFactory";
import { combatantById } from "../../data/combatants";
import type { Quality } from "../../data/config";
import { AirflowLines } from "./AirflowLines";
import { EffectBatch } from "./EffectBatch";
import { airflowProfile, resolveAirflowProfile, flightEffectProfiles } from "./profiles";
import type { AircraftEffectSite } from "../3d/aircraftEffectSites";

const axis = new Vector3(0, 0, 1);
const rest = { x: 0, y: 0, z: 0 };
const particle = { heading: 0, bank: 0, length: 1, life: 1, hold: 0, priority: 1, velocity: rest };
type FlightModel = Pick<ProceduralAircraft, "actor" | "group" | "effectSites">;

/** Current attached shapes are rewritten on every draw. Released segments age in world space. */
export class AircraftFlightEffects {
  readonly lines: AirflowLines;
  readonly bands: AirflowLines;
  private readonly basis = new Matrix3();
  private readonly span = new Vector3();
  readonly cones: EffectBatch;
  readonly arcs: EffectBatch;
  readonly batches: EffectBatch[];
  private clocks = new WeakMap<FlightModel, {next: Map<string, number>; fast: boolean; waveUntil: number}>();
  private point = new Vector3();
  private dir = new Vector3();
  private tail = new Vector3();
  private rotation = new Quaternion();

  constructor(scene: Scene, attachedScene = scene) {
    this.lines = new AirflowLines(attachedScene, scene === attachedScene ? 512 : 96);
    this.bands = new AirflowLines(attachedScene, scene === attachedScene ? 192 : 64, true);
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
    this.lines.reset();
    this.bands.reset();
  }

  emit(model: FlightModel, time: number, dt: number, quality: Quality, smoke: EffectBatch,
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
      clock = {next: new Map(), fast: false, waveUntil: -1};
      this.clocks.set(model, clock);
    }
    const fast = actor.speed >= maxSpeed * profile.waveThreshold;
    if (fast && !clock.fast) clock.waveUntil = time + .32;
    clock.fast = fast;
    model.group.updateWorldMatrix(true, true);
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
      const interval = site.kind === "exhaust" ? (.34 - .24 * throttle) / Math.max(.2, power) : low ? .15 : .085;
      const release = dt > 0 && (clock.next.get(site.id) ?? 0) <= time;
      if (release) clock.next.set(site.id, time + interval);
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
          const length = (.35 + throttle * .85 + boost * profile.boostLength) * power;
          if (jet || boost && (clock.next.get(site.id) ?? 0) - time > interval * .55) {
            const sections = jet && boost && profile.segmented ? 3 : 1;
            for (let n = 0; n < sections; n++) {
              aft.copy(p).addScaledVector(d, length * (n + .5) / sections);
              this.cones.spawn({...shape, position: aft, opacity:.9, size: radius * (2 - .4*n),
                thickness: length / sections / (radius * (2 - .4*n)),
                color: jet ? boost ? "#b2f0ff" : "#76badd" : "#ffc865"});
            }
          }
          if (release) {
            const v = d.clone().multiplyScalar((jet ? 2 : .9) + throttle * 2);
            v.y += .35;
            smoke.spawn({...particle, drag:2.6, position: jet ? aft.copy(p).addScaledVector(d,length) : p, velocity: v,
              size: radius * (jet ? 1.4 : .85), life: low ? .45 : .8, color: jet ? "#b8cbd1" : "#92928a"});
          }
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
