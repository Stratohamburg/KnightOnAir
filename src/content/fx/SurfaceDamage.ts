import { Euler, Matrix3, Quaternion, Triangle, Vector3, type Mesh, type Scene } from "three";
import type { CombatSnapshot, Part } from "../../simulation/types";
import type { Random } from "../../services/Random";
import type { DamageEmitter } from "./CombatEffects";
import { EffectBatch, type Particle } from "./EffectBatch";

const zAxis = new Vector3(0,0,1);
const zero = {x:0,y:0,z:0};
const style = { hold:0, bank:0, heading:0, length:1, life:1, priority:4, velocity:zero };

interface SurfacePoint {
  partId: string;
  surface: number;
  point: Vector3;
  normal: Vector3;
}
interface Hole extends SurfacePoint {
  siteId?: number;
  actor: string | number;
  damage: number;
  lastHealth: number;
  maxHealth: number;
  combustible: boolean;
  next: number;
  fragment?: Particle;
  generation?: number;
  worldPoint: Vector3;
  worldNormal: Vector3;
}

/** Project at the hit pose so scaled or mirrored meshes have the same distance metric.
 * Area-weighted reservoir sampling chooses a fallback without retaining all triangles. */
export function selectDamageSite(source: DamageEmitter, partId: string | undefined, shot: CombatSnapshot, random: Random): SurfacePoint | undefined {
  const model = source.model;
  if (!model) return;
  const damaged = shot.damagedParts ?? [];
  const attributed = damaged.some(d => d.id === partId) && model.effectSites.surfaces.some(s => s.partId === partId);
  const allowed = new Set(attributed ? [partId] : damaged.filter(d =>
    source.parts.some(part => part.id === d.id && !part.destroyed)).map(d => d.id));
  if (!allowed.size) return;
  model.group.updateWorldMatrix(true,true);
  const pose = shot.actorPose ?? source.pose;
  const contact = shot.contact && attributed ?
    new Vector3().copy(shot.position) : undefined;
  let best: SurfacePoint | undefined, fallback: SurfacePoint | undefined;
  let nearest = Infinity, totalArea = 0;
  const tri = new Triangle(), q = new Vector3();
  const surfaceIndices = new Map<string,number>();
  for (const {partId: owner,mesh} of model.effectSites.surfaces) {
    if (!allowed.has(owner)) continue;
    const surface = surfaceIndices.get(owner) ?? 0;
    surfaceIndices.set(owner,surface + 1);
    const matrix = model.matrixAtPose(mesh,pose), toMesh = matrix.clone().invert();
    const positions = mesh.geometry.getAttribute("position"), indices = mesh.geometry.index;
    const read = (v: Vector3,i: number) => v.fromBufferAttribute(positions, indices?.getX(i) ?? i).applyMatrix4(matrix);
    const localPoint = (p: Vector3): SurfacePoint => ({
      partId:owner, surface, point:p.clone().applyMatrix4(toMesh),
      normal:tri.getNormal(new Vector3()).applyNormalMatrix(new Matrix3().getNormalMatrix(toMesh))
        .multiplyScalar(matrix.determinant() < 0 ? -1 : 1),
    });
    for (let i = 0; i < (indices?.count ?? positions.count); i += 3) {
      read(tri.a,i); read(tri.b,i+1); read(tri.c,i+2);
      const area = tri.getArea();
      if (area <= 1e-10) continue;
      if (contact) {
        tri.closestPointToPoint(contact,q);
        const distance = q.distanceToSquared(contact);
        if (distance < nearest) { nearest = distance; best = localPoint(q); }
        continue;
      }
      totalArea += area;
      if (random.next() * totalArea < area) {
        const u = Math.sqrt(random.next()), v = random.next();
        q.copy(tri.a).multiplyScalar(1-u).addScaledVector(tri.b,u*(1-v)).addScaledVector(tri.c,u*v);
        fallback = localPoint(q);
      }
    }
  }
  const part = source.parts.find(p => p.id === partId);
  if (!contact) return fallback;
  if (nearest <= Math.max(.4,part?.radius ?? 0) ** 2) return best;
  return selectDamageSite(source,partId,{...shot,contact:false},random);
}

export const surfaceDamagePreviews = {
  damage: { name: "破洞与烟火", trigger: "击中可损的参考表面", kind: "damage", playback: "continuous" },
  detach: { name: "脱落碎片", trigger: "分离受损参考部件", kind: "detach", playback: "once" },
  destroyed: { name: "击毁爆炸", trigger: "播放击毁事件", kind: "destroyed", playback: "once" },
} as const;

export class SurfaceDamage {
  readonly marks: EffectBatch;
  readonly playerMarks: EffectBatch;
  readonly flames: EffectBatch;
  readonly playerFlames: EffectBatch;
  readonly batches: EffectBatch[];
  private holes: Hole[] = [];
  constructor(scene: Scene, overlay: Scene, private readonly random: Random) {
    this.marks = new EffectBatch(scene,256,"mark");
    this.playerMarks = new EffectBatch(overlay,48,"mark");
    this.flames = new EffectBatch(scene,256,"cone");
    this.playerFlames = new EffectBatch(overlay,48,"cone");
    this.batches = [this.marks,this.playerMarks,this.flames,this.playerFlames];
    for (const b of this.batches) b.mesh.renderOrder = 2;
  }
  private mesh(source: DamageEmitter, site: SurfacePoint): Mesh | undefined {
    return source.model?.effectSites.surfaces.filter(s => s.partId === site.partId)[site.surface]?.mesh;
  }
  hit(source: DamageEmitter, partId: string | undefined, shot: CombatSnapshot) {
    const site = selectDamageSite(source,partId,shot,this.random);
    if (!site) return;
    const part = source.parts.find(p => p.id === site.partId)!;
    const amount = shot.damagedParts?.find(d => d.id === site.partId)?.amount ?? 0;
    const mesh = this.mesh(source,site)!;
    const worldPoint = site.point.clone().applyMatrix4(mesh.matrixWorld);
    const nearby = shot.damageSiteId === undefined && this.holes.find(h => !h.fragment && h.actor === source.id && h.partId === site.partId &&
      h.surface === site.surface && h.point.clone().applyMatrix4(mesh.matrixWorld).distanceToSquared(worldPoint) < .035);
    if (nearby) { nearby.damage += amount; nearby.lastHealth = part.health; return; }
    if (this.holes.length >= 192) this.holes.shift();
    const owned = this.holes.filter(h => h.actor === source.id);
    if (owned.length >= 32) this.holes.splice(this.holes.indexOf(owned[0]),1);
    this.holes.push({...site, siteId:shot.damageSiteId, actor:source.id, damage:amount, lastHealth:part.health, maxHealth:part.maxHealth,
      combustible:part.role === "engine" || part.kind === "fuel", next:0, worldPoint,
      worldNormal:site.normal.clone().applyNormalMatrix(new Matrix3().getNormalMatrix(mesh.matrixWorld))});
  }
  detach(source: DamageEmitter, partId: string, fragment: Particle) {
    const inverse = this.fragmentRotation(fragment).invert();
    for (const h of this.holes) {
      if (h.actor !== source.id || h.partId !== partId || h.fragment) continue;
      const mesh = this.mesh(source,h);
      if (mesh) {
        h.worldPoint.copy(h.point).applyMatrix4(mesh.matrixWorld);
        h.worldNormal.copy(h.normal).applyNormalMatrix(new Matrix3().getNormalMatrix(mesh.matrixWorld));
      }
      h.point.copy(h.worldPoint).sub(fragment.position).applyQuaternion(inverse);
      h.normal.copy(h.worldNormal).applyQuaternion(inverse);
      h.fragment = fragment;
      h.generation = fragment.generation;
    }
  }
  private fragmentRotation(f: Particle) {
    return new Quaternion().setFromEuler(new Euler(f.age*2.1, f.heading+f.age*2.7, f.bank+f.age*3.4));
  }
  update(time: number, dt: number, low: boolean, sources: readonly DamageEmitter[], smoke: EffectBatch, debris: EffectBatch,
    emitting = true) {
    for (const b of this.batches) b.reset();
    const repairs = new Map<Part,number>();
    this.holes = this.holes.filter(h => {
      const source = sources.find(s => s.id === h.actor);
      const part = source?.parts.find(p => p.id === h.partId);
      if (h.fragment) {
        const f = h.fragment;
        if (f.generation !== h.generation || f.age >= f.life) return false;
        const rotation = this.fragmentRotation(f);
        h.worldPoint.copy(h.point).applyQuaternion(rotation).add(f.position);
        h.worldNormal.copy(h.normal).applyQuaternion(rotation);
      } else {
        const mesh = source && this.mesh(source,h);
        if (!part || part.destroyed || !mesh || part.health >= part.maxHealth) return false;
        const restored = h.siteId !== undefined ? 0 : repairs.get(part) ?? Math.max(0,part.health - h.lastHealth);
        const reduce = Math.min(restored,h.damage);
        repairs.set(part,restored-reduce);
        h.lastHealth = part.health;
        h.damage -= reduce;
        if (h.damage <= 0) return false;
        h.worldPoint.copy(h.point).applyMatrix4(mesh.matrixWorld);
        h.worldNormal.copy(h.normal).applyNormalMatrix(new Matrix3().getNormalMatrix(mesh.matrixWorld));
      }
      const localPlayer = typeof h.actor === "string" && !h.fragment;
      const severity = Math.min(1,h.damage / Math.max(1,h.maxHealth * .4));
      const size = .18 + .23 * severity;
      const root = h.worldPoint.clone().addScaledVector(h.worldNormal,.012);
      const orientation = new Quaternion().setFromUnitVectors(zAxis,h.worldNormal);
      (localPlayer ? this.playerMarks : this.marks).spawn({...style,position:root,orientation,color:"#171511",size});
      const burning = !h.fragment && h.combustible && (severity >= .75 || (part && part.health <= 0));
      const aft = new Vector3(-Math.sin(source?.pose.heading ?? 0),.18,-Math.cos(source?.pose.heading ?? 0)).normalize();
      if (burning && emitting) {
        const flame = localPlayer ? this.playerFlames : this.flames;
        const length = size * (1.8 + .22*Math.sin(time*39));
        const q = new Quaternion().setFromUnitVectors(zAxis,aft);
        flame.spawn({...style,position:root.clone().addScaledVector(aft,length*.5),orientation:q,size:size*.8,
          thickness:length/(size*.8),color:"#ff842c"});
        flame.spawn({...style,position:root,orientation,size:size*.55,color:"#ffda75"});
      }
      if (emitting && dt > 0 && time >= h.next) {
        h.next = time + (burning ? .075 : .27 - .1*severity) * (low ? 1.45 : 1);
        const velocity = aft.clone().multiplyScalar(burning ? 1.5 : .5);
        velocity.y += .5;
        smoke.spawn({...style,position:burning ? root.clone().addScaledVector(aft,size*1.6) : root,
          color:h.fragment ? "#a1aaa5" : burning ? "#48443f" : "#83918f",
          size:size*(burning ? 1.7 : .85),velocity,life:low ? .7 : 1.25});
        if (!h.fragment && !burning && severity > .7) debris.spawn({...style,position:root,velocity,
          size:.09,color:"#847868",life:.5});
      }
      return true;
    });
  }
  get count() { return this.holes.length; }
  repair(siteId: number) { this.holes = this.holes.filter(h => h.siteId !== siteId); }
  reset() { this.holes.length = 0; }
}
