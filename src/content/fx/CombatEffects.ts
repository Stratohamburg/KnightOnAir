import { Vector3, Quaternion, Euler, type Camera, type Scene } from "three";
import type { Quality } from "../../data/config";
import { RULES } from "../../data/config";
import { WEAPONS } from "../../data/weapons";
import { Random } from "../../services/Random";
import type { CombatSnapshot, FireZone, Part, Projectile, WorldEvent } from "../../simulation/types";
import { localToWorld, partAnchor, type ActorPose, type Point3 } from "../3d/anchors";
import { SurfaceDamage } from "./SurfaceDamage";
import { AircraftFlightEffects } from "./AircraftFlightEffects";
import type { ProceduralAircraft } from "../3d/AircraftFactory";
import { EffectBatch, type WindSampler } from "./EffectBatch";
import { upgradeImpact, weaponEffectId, weaponEffectProfile } from "./profiles";
import type { AircraftEffectSite } from "../3d/aircraftEffectSites";

const still = { x: 0, y: 0, z: 0 };
const defaultParticle = { length: 1, priority: 1, hold: 0, heading: 0, bank: 0 };

export interface DamageEmitter {
  id: string | number;
  pose: ActorPose;
  parts: readonly Part[];
  model?: Pick<ProceduralAircraft, "group" | "actor" | "effectSites" | "matrixAtPose">;
}

export interface PreviewEffectVisibility {
  site: (site: AircraftEffectSite) => boolean;
  engines: boolean;
  damage: boolean;
  fire: boolean;
}

export class CombatEffects {
  private readonly flashes: EffectBatch;
  private readonly streaks: EffectBatch;
  private readonly trails: EffectBatch;
  private readonly rings: EffectBatch;
  private readonly smoke: EffectBatch;
  private readonly debris: EffectBatch;
  private readonly detached: EffectBatch;
  private readonly batches: readonly EffectBatch[];
  private readonly cases: EffectBatch;
  private readonly waves: EffectBatch;
  private readonly gunSmoke: EffectBatch;
  private nextPoweredSmoke = 0;
  private readonly holes: SurfaceDamage;
  private wrecks: {particle: import("./EffectBatch").Particle; generation: number; next: number}[] = [];
  private readonly playerFlight: AircraftFlightEffects;
  private readonly flight: AircraftFlightEffects;
  private readonly airflow: AircraftFlightEffects["lines"][];
  private nextFire = 0;
  private elapsed = 0;
  private readonly random: Random;
  private readonly engineSmoke: EffectBatch;
  private readonly impactSmoke: EffectBatch;
  private readonly muzzleFlashes: EffectBatch;
  private readonly muzzleStreaks: EffectBatch;
  private readonly refitGlow: EffectBatch;
  private readonly refitSparks: EffectBatch;
  private refitImpacts: { position: Point3; delay: number; low: boolean }[] = [];

  constructor(scene: Scene, overlay = scene, previewSeed?: number) {
    this.random = new Random(previewSeed ?? 491);
    this.flashes = new EffectBatch(scene, 48, "facet");
    this.streaks = new EffectBatch(scene, 96, "glow");
    this.trails = new EffectBatch(scene, RULES.maxProjectiles, "glow");
    this.rings = new EffectBatch(scene, 16, "ring");
    this.smoke = new EffectBatch(scene, 96, "smoke");
    this.engineSmoke = previewSeed === undefined ? this.smoke : new EffectBatch(scene, 96, "smoke");
    this.impactSmoke = previewSeed === undefined ? this.smoke : new EffectBatch(scene, 96, "smoke");
    this.muzzleFlashes = previewSeed === undefined ? this.flashes : new EffectBatch(scene, 48, "facet");
    this.muzzleStreaks = previewSeed === undefined ? this.streaks : new EffectBatch(scene, 96, "glow");
    this.debris = new EffectBatch(scene, 64, "debris");
    this.detached = new EffectBatch(scene, 24, "wing");
    this.cases = new EffectBatch(scene, 96, "casing");
    this.waves = new EffectBatch(scene, RULES.maxProjectiles, "arc");
    this.gunSmoke = new EffectBatch(scene, RULES.maxProjectiles, "smoke");
    this.refitGlow = new EffectBatch(overlay, 16, "facet");
    this.refitSparks = new EffectBatch(overlay, 48, "glow");
    this.flight = new AircraftFlightEffects(scene);
    this.playerFlight = new AircraftFlightEffects(scene,overlay);
    this.airflow = [this.flight.lines,this.flight.bands,this.playerFlight.lines,this.playerFlight.bands];
    this.holes = new SurfaceDamage(scene,overlay,this.random);
    this.batches = [...new Set([this.flashes, this.streaks, this.muzzleFlashes, this.muzzleStreaks,
      this.trails, this.rings, this.smoke, this.engineSmoke, this.impactSmoke, this.debris, this.detached,
      ...this.flight.batches, ...this.playerFlight.batches, this.cases, this.waves, this.gunSmoke,
      this.refitGlow, this.refitSparks, ...this.holes.batches])];
  }

  consume(events: readonly WorldEvent[], quality: Quality, sources: readonly DamageEmitter[] = []) {
    const detachedThisFrame = [];
    for (const event of events) {
      if (event.type === "upgrade_installed") {
        const player = sources.find(source => source.id === "player");
        for (const id of event.partIds.length ? event.partIds : [""]) {
          const part = player?.parts.find(candidate => candidate.id === id);
          if (this.refitImpacts.length >= 16) this.refitImpacts.shift();
          this.refitImpacts.push({
            position: part ? localToWorld(event.pose, partAnchor(part)) : event.pose,
            delay: event.animation === "extension" ? upgradeImpact.delay : .08,
            low: quality === "low",
          });
        }
      } else if (event.type === "effect_requested") {
        if (event.surface) {
          this.weapon({ position: event.position, direction: {x:0,y:1,z:0}, velocity: still,
            bank:0, heading:0, surface: event.surface, damageType:"explosive" }, "impact", quality);
        }
        const color = event.profile === "coin" ? "#ffcd67" : event.profile === "heal" ? "#9afa96" : "#ffc276";
        this.flash(event.position, color, event.size, event.duration, event.profile === "burst" ? 3 : 2);
      } else if (event.type === "weapon_fired") {
        if (event.snapshot.ammunition === "bomb") continue;
        this.weapon(event.snapshot, "muzzle", quality);
        if (event.snapshot.barrel && event.snapshot.ammunition === "gun") {
          const model = sources.find(s => s.id === event.entityId)?.model;
          if (model) this.eject(model, event.snapshot);
        }
      } else if (event.type === "player_hit" || event.type === "enemy_hit") {
        const source = sources.find(s => s.id === (event.type === "player_hit" ? "player" : event.enemyId));
        if (source?.model) this.holes.hit(source,event.part,event.snapshot);
        this.weapon(event.snapshot, "impact", quality);
      } else if (event.type === "player_destroyed" || event.type === "enemy_destroyed") {
        this.weapon(event.snapshot, "destroyed", quality);
        const {position,velocity,heading,bank} = event.snapshot;
        const wreck = this.detached.spawn({...defaultParticle,position,velocity,heading,bank,size:.95,
          length:1.9,life:1.8,color:"#5b5751",priority:5});
        if (wreck) this.wrecks.push({particle:wreck,generation:wreck.generation!,next:this.elapsed+.1});
      } else if (event.type === "part_disabled") {
        this.flash(event.snapshot.position, "#ffab53", .7, .16, 3);
      } else if (event.type === "part_detached") {
        const { position, velocity, direction, heading, bank } = event.snapshot;
        const fragment = this.detached.spawn({ ...defaultParticle, position, heading, bank, color: event.color,
          velocity: { x: velocity.x + direction.x * 1.8, y: velocity.y + .9, z: velocity.z + direction.z * 1.8 },
          size: .65, length: 2.1, life: 1.8, priority: 4,
        });
        const source = sources.find(s => s.id === event.entityId);
        if (fragment && source?.model) detachedThisFrame.push({source,part:event.partId,fragment});
      }
    }
    for (const {source,part,fragment} of detachedThisFrame) this.holes.detach(source,part,fragment);
  }

  private eject(model: NonNullable<DamageEmitter["model"]>, snapshot: CombatSnapshot) {
    const barrel = snapshot.barrel, pose = snapshot.actorPose;
    if (!barrel || !pose) return;
    const ports = model.effectSites.sources.filter(site => site.partId === barrel.partId && site.kind === "casing");
    const port = ports[barrel.index] ?? (ports.length === 1 ? ports[0] : undefined);
    if (!port) return;
    const atFire = model.matrixAtPose(port.node,pose);
    const position = new Vector3().fromArray(port.position).applyMatrix4(atFire);
    const velocity = new Vector3().fromArray(port.direction).transformDirection(atFire)
      .multiplyScalar(3.4).add(snapshot.velocity);
    this.cases.spawn({...defaultParticle, position, velocity, color:"#dbad5a", size:.18, life:.75,
      heading:pose.heading, bank:pose.bank, priority:3});
  }

  private flash(position: Point3, color: string, size: number, life: number, priority: number) {
    this.flashes.spawn({ ...defaultParticle, position, color, size, life, priority, velocity: still });
  }

  private weapon(snapshot: CombatSnapshot, stage: "muzzle" | "impact" | "destroyed", quality: Quality) {
    const { position, direction, damageType, weaponId } = snapshot;
    const profile = weaponEffectProfile(snapshot.effectId ?? WEAPONS[weaponId ?? ""]?.effectId ?? weaponEffectId(weaponId, damageType));
    if (!profile) return;
    const destroyed = stage === "destroyed";
    const explosive = destroyed || damageType === "explosive";
    const size = profile.size * (destroyed ? 4.4 : stage === "impact" ? 1.4 : 1);
    const duration = profile.duration * (destroyed ? 2.8 : stage === "impact" ? 1.65 : 1);
    const priority = destroyed ? 5 : stage === "impact" ? 4 : 2;
    const muzzle = stage === "muzzle";
    const flashes = muzzle ? this.muzzleFlashes : this.flashes;
    const streaks = muzzle ? this.muzzleStreaks : this.streaks;
    flashes.spawn({ ...defaultParticle, position, color: profile.core, size: size * .7, life: duration,
      priority, velocity: still });
    if (quality !== "low") streaks.spawn({...defaultParticle, position, velocity: still,
      color:profile.color, size:size * 1.46, life:duration * 1.2, priority:priority - 1});
    if (explosive && stage !== "muzzle") {
      this.rings.spawn({ ...defaultParticle, position, velocity: still, color: profile.color, size: size * 2.4, life: duration * 1.5, priority: destroyed ? 3 : 2 });
    }
    const water = snapshot.surface === "water", dust = snapshot.surface === "ground", fabric = snapshot.surface === "fabric";
    const spray = water ? "#c2edf5" : dust ? "#bda583" : fabric ? "#c4ab79" : profile.color;
    const count = Math.max(1, Math.ceil(profile.sparks * (quality === "low" ? .32 : 1) * (destroyed ? 2 : 1)));
    for (let i = 0; i < count; i++) {
      const spread = stage === "muzzle" ? .23 : .95;
      const speed = profile.speed * this.random.range(.42, 1.12);
      const velocity = {
        x: (direction.x + this.random.range(-spread, spread)) * speed,
        y: (direction.y + this.random.range(0, spread)) * speed,
        z: (direction.z + this.random.range(-spread, spread)) * speed,
      };
      streaks.spawn({ ...defaultParticle, position, velocity, color: spray,
        size: size * .24, length: 2.2, life: duration * this.random.range(1.1, 2), priority: stage === "muzzle" ? 1 : 2 });
    }
    const smokeBatch = muzzle ? this.gunSmoke : this.impactSmoke;
    const smokeCount = quality === "low" || muzzle ? 1 : explosive ? 3 : 2;
    for (let i = 0; i < smokeCount; i++) {
      smokeBatch.spawn({ ...defaultParticle, position, size: size * (.52 + i * .22),
        color: water ? "#c8eced" : dust ? "#ac9879" : explosive ? "#5e493d" : "#73736a", life: profile.smoke + (destroyed ? 1.7 : explosive ? .65 : .25) + i * .1,
        velocity: { x: direction.x * (muzzle ? 1.1 : .25), y: .52 + i * .2, z: direction.z * (muzzle ? 1.1 : .25) },
        hold: muzzle ? 0 : .24 + i * .025, priority: destroyed ? 3 : muzzle ? 1 : 2,
      });
    }
    if (muzzle) return;
    const pieces = quality === "low" ? 1 : destroyed ? 12 : explosive ? 5 : 2;
    for (let i = 0; i < pieces; i++) {
      this.debris.spawn({ ...defaultParticle, position, color: water ? "#bbe4ef" : dust || fabric ? spray : i % 2 ? "#715846" : "#938773",
        heading: snapshot.heading, bank: snapshot.bank, size: .085 + this.random.next() * (destroyed ? .36 : .12),
        velocity: {
          x: snapshot.velocity.x * .55 + direction.x * 2 + this.random.range(-3.4, 3.4),
          y: this.random.range(.8, 3.8),
          z: snapshot.velocity.z * .55 + direction.z * 2 + this.random.range(-3.4, 3.4),
        },
        life: this.random.range(.45, destroyed ? 1.85 : 1.1), priority: destroyed ? 3 : 1,
      });
    }
  }

  update(dt: number, camera: Camera, quality: Quality, projectiles: readonly Projectile[], wind?: WindSampler,
    events: readonly WorldEvent[] = [],
    sources: readonly DamageEmitter[] = [],
    fires: readonly { zone: FireZone; y: number }[] = [],
    preview?: { emitting?: boolean; airflow?: (flight: AircraftFlightEffects) => void; refitDt?: number; reducedRefit?: boolean },
  ) {
    this.trails.reset();
    this.waves.reset();
    const poweredSmoke = dt > 0 && this.elapsed >= this.nextPoweredSmoke;
    if (poweredSmoke) this.nextPoweredSmoke = this.elapsed + (quality === "low" ? .18 : .09);
    for (const projectile of projectiles) {
      if (!projectile.active) continue;
      const profile = weaponEffectProfile(projectile.effectId ?? WEAPONS[projectile.weaponId]?.effectId ?? weaponEffectId(projectile.weaponId, projectile.damageType));
      if (!profile) continue;
      const direction = { x: Math.sin(projectile.heading), y: projectile.vy / projectile.speed, z: Math.cos(projectile.heading) };
      const powered = projectile.kind === "missile" || projectile.weaponId.includes("rocket");
      if (powered && poweredSmoke) this.smoke.spawn({...defaultParticle, position:projectile, velocity:still,
        size:.27, life:quality === "low" ? .35 : .7, color:"#a4aaa8"});
      if (!powered) {
        const orientation = new Quaternion().setFromEuler(new Euler(Math.PI / 2, projectile.heading, 0, "YXZ"));
        this.waves.spawn({...defaultParticle, position:{x: projectile.x + direction.x*.19,
          y:projectile.y + direction.y*.19, z:projectile.z + direction.z*.19}, size:.42,
          life:1, velocity:still, orientation, color:"#e6eee3"});
      }
      const length = profile.trail + projectile.speed * .027;
      const size = projectile.kind === "missile" ? .46 : .22;
      this.trails.spawn({ ...defaultParticle,
        position: {
          x: projectile.x - direction.x * length * .48,
          y: projectile.y - direction.y * length * .48,
          z: projectile.z - direction.z * length * .48,
        },
        velocity: direction, color: projectile.team === "enemy" ? "#ff784e" : profile.color,
        size, length: Math.max(1, length / size), life: 1,
      });
    }
    for (const batch of this.batches) {
      if (batch === this.refitGlow || batch === this.refitSparks) batch.tick(preview?.refitDt ?? dt);
      else if (batch !== this.trails && batch !== this.waves && dt > 0) batch.tick(dt, wind);
    }
    this.elapsed += dt;
    for (const batch of this.airflow) batch.advance(dt,wind);
    this.flight.resetRoots();
    this.playerFlight.resetRoots();
    for (const {id,model} of sources) {
      if (model && preview?.emitting !== false)
        (typeof id === "string" ? this.playerFlight : this.flight).emit(model,this.elapsed,dt,quality,this.engineSmoke);
    }
    preview?.airflow?.(this.playerFlight);
    for (const batch of this.airflow) batch.write();
    this.consume(events, quality, sources);
    const refitDt = preview?.refitDt ?? dt;
    this.refitImpacts = this.refitImpacts.filter(impact => {
      impact.delay -= refitDt;
      if (impact.delay > 0) return true;
      const low = impact.low || preview?.reducedRefit;
      const { position } = impact;
      const { color, life, size, lowSize, sparks } = upgradeImpact;
      this.refitGlow.spawn({ ...defaultParticle, position, color, life, size: low ? lowSize : size, velocity: still });
      for (let index = 0; index < (low ? 0 : sparks); index++) {
        const velocity = { x: this.random.range(-2, 2), y: this.random.range(.3, 2), z: this.random.range(-2, 2) };
        this.refitSparks.spawn({ ...defaultParticle, position, velocity, color, life, size: .09 });
      }
      return false;
    });
    this.holes.update(this.elapsed,dt,quality === "low",sources,this.smoke,this.debris,preview?.emitting);
    this.wrecks = this.wrecks.filter(w => w.generation === w.particle.generation && w.particle.age < w.particle.life);
    for (const wreck of this.wrecks) {
      if (dt <= 0 || this.elapsed < wreck.next) continue;
      wreck.next = this.elapsed + .15;
      this.smoke.spawn({...defaultParticle,position:wreck.particle.position,velocity:still,size:.44,
        color:"#9faaa9",life:.8});
    }
    if (fires.length > 0 && this.elapsed >= this.nextFire && dt > 0) {
      this.nextFire = this.elapsed + (quality === "low" ? .26 : .15);
      for (const { zone, y } of fires) {
        const position = { x: zone.x + this.random.range(-.5, .5) * zone.radius, y, z: zone.z + this.random.range(-.5, .5) * zone.radius };
        this.streaks.spawn({ ...defaultParticle, position, velocity: { x: 0, y: 1.3, z: 0 }, size: zone.radius * .66,
          color: "#ff7d36", life: .44, length: 1.2 });
      }
    }
    this.repaint(camera, quality);
  }

  repaint(camera: Camera, quality: Quality) {
    const low = quality === "low";
    for (const batch of this.batches) {
      const streaks = batch === this.streaks || batch === this.muzzleStreaks;
      batch.write(camera, low && streaks ? .75 : 1, low);
    }
  }
  get active() { return this.airflow.reduce((sum,batch) => sum + batch.active,0) + this.batches.reduce((sum, batch) => sum + batch.mesh.count, 0); }
  repairPreviewSite(siteId: number) { this.holes.repair(siteId); }
  showPreview(visibility: PreviewEffectVisibility) {
    for (const batch of this.airflow) batch.write(visibility.site);
    for (const batch of [...this.flight.batches, ...this.playerFlight.batches, this.engineSmoke]) {
      batch.mesh.visible = visibility.engines && batch.mesh.count > 0;
    }
    for (const batch of [...this.holes.batches, this.smoke, this.impactSmoke, this.debris, this.detached, this.rings, this.flashes, this.streaks]) {
      batch.mesh.visible = visibility.damage && batch.mesh.count > 0;
    }
    for (const batch of [this.cases, this.gunSmoke, this.trails, this.waves, this.muzzleFlashes, this.muzzleStreaks]) {
      batch.mesh.visible = visibility.fire && batch.mesh.count > 0;
    }
  }
  get diagnostics() {
    return {
      active: this.active,
      airflow: { ...this.playerFlight.lines.visibleStrands, ...this.playerFlight.bands.visibleStrands },
      engineRoots: this.playerFlight.cones.mesh.count,
      holes: this.holes.count,
      activeBatches: this.airflow.filter(batch => batch.active > 0).length + this.batches.filter(({ mesh }) => mesh.count > 0).length,
      allocatedBatches: this.batches.length + this.airflow.length,
      dynamicGpuCreations: 0,
      pools: {
        flashes: { ...this.flashes.stats, active: this.flashes.mesh.count + (this.muzzleFlashes === this.flashes ? 0 : this.muzzleFlashes.mesh.count) },
        sparks: this.streaks.stats, trails: this.trails.stats, rings: this.rings.stats,
        refitGlow: this.refitGlow.stats, refitSparks: this.refitSparks.stats,
        smoke: this.smoke.stats, gunSmoke: this.gunSmoke.stats, casings: this.cases.stats, waves: this.waves.stats, debris: this.debris.stats, detached: this.detached.stats,
      },
    };
  }
  reset() {
    this.refitImpacts = [];
    for (const batch of this.batches) batch.reset();
    this.holes.reset();
    this.wrecks.length = 0;
    this.flight.reset();
    this.playerFlight.reset();
    this.elapsed = this.nextFire = this.nextPoweredSmoke = 0;
  }
  dispose() {
    for (const batch of this.airflow) batch.dispose();
    for (const batch of this.batches) batch.dispose();
  }
}
