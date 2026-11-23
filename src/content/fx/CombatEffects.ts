import type { Camera, Scene } from "three";
import type { Quality } from "../../data/config";
import { RULES } from "../../data/config";
import { Random } from "../../services/Random";
import type { CombatSnapshot, FireZone, Part, Projectile, WorldEvent } from "../../simulation/types";
import { engineOutlet, localToWorld, partAnchor, type ActorPose, type Point3 } from "../3d/anchors";
import { EffectBatch, type WindSampler } from "./EffectBatch";
import { weaponEffectId, weaponEffects } from "./profiles";

const still = { x: 0, y: 0, z: 0 };
const defaultParticle = { length: 1, priority: 1, hold: 0, heading: 0, bank: 0 };

export interface DamageEmitter {
  id: string | number;
  pose: ActorPose;
  parts: readonly Part[];
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
  private readonly emitters = new Map<string, number>();
  private nextFire = 0;
  private elapsed = 0;
  private readonly random = new Random(491);

  constructor(scene: Scene) {
    this.flashes = new EffectBatch(scene, 48, "glow");
    this.streaks = new EffectBatch(scene, 96, "glow");
    this.trails = new EffectBatch(scene, RULES.maxProjectiles, "glow");
    this.rings = new EffectBatch(scene, 16, "ring");
    this.smoke = new EffectBatch(scene, 96, "smoke");
    this.debris = new EffectBatch(scene, 64, "debris");
    this.detached = new EffectBatch(scene, 24, "wing");
    this.batches = [this.flashes, this.streaks, this.trails, this.rings, this.smoke, this.debris, this.detached];
  }

  consume(events: readonly WorldEvent[], quality: Quality) {
    for (const event of events) {
      if (event.type === "effect_requested") {
        const color = event.profile === "coin" ? "#ffcd67" : event.profile === "heal" ? "#9afa96" : "#ffc276";
        this.flash(event.position, color, event.size, event.duration, event.profile === "burst" ? 3 : 2);
      } else if (event.type === "weapon_fired") {
        this.weapon(event.snapshot, "muzzle", quality);
      } else if (event.type === "player_hit" || event.type === "enemy_hit") {
        this.weapon(event.snapshot, "impact", quality);
      } else if (event.type === "player_destroyed" || event.type === "enemy_destroyed") {
        this.weapon(event.snapshot, "destroyed", quality);
      } else if (event.type === "part_disabled") {
        this.flash(event.snapshot.position, "#ffab53", .7, .16, 3);
      } else if (event.type === "part_detached") {
        const { position, velocity, direction, heading, bank } = event.snapshot;
        this.detached.spawn({ ...defaultParticle, position, heading, bank, color: event.color,
          velocity: { x: velocity.x + direction.x * 1.8, y: velocity.y + .9, z: velocity.z + direction.z * 1.8 },
          size: .65, length: 2.1, life: 1.8, priority: 4,
        });
      }
    }
  }

  private flash(position: Point3, color: string, size: number, life: number, priority: number) {
    this.flashes.spawn({ ...defaultParticle, position, color, size, life, priority, velocity: still });
  }

  private weapon(snapshot: CombatSnapshot, stage: "muzzle" | "impact" | "destroyed", quality: Quality) {
    const { position, direction, damageType, weaponId } = snapshot;
    const profile = weaponEffects[weaponEffectId(weaponId, damageType)];
    const destroyed = stage === "destroyed";
    const explosive = destroyed || damageType === "explosive";
    const size = profile.size * (destroyed ? 4.4 : stage === "impact" ? 1.4 : 1);
    const duration = profile.duration * (destroyed ? 2.8 : stage === "impact" ? 1.65 : 1);
    const priority = destroyed ? 5 : stage === "impact" ? 4 : 2;
    this.flash(position, profile.core, size * .7, duration, priority);
    if (quality !== "low") this.flash(position, profile.color, size * 1.46, duration * 1.2, priority - 1);
    if (explosive && stage !== "muzzle") {
      this.rings.spawn({ ...defaultParticle, position, velocity: still, color: profile.color, size: size * 2.4, life: duration * 1.5, priority: destroyed ? 3 : 2 });
    }
    const count = Math.max(1, Math.ceil(profile.sparks * (quality === "low" ? .32 : 1) * (destroyed ? 2 : 1)));
    for (let i = 0; i < count; i++) {
      const spread = stage === "muzzle" ? .23 : .95;
      const speed = profile.speed * this.random.range(.42, 1.12);
      const velocity = {
        x: (direction.x + this.random.range(-spread, spread)) * speed,
        y: (direction.y + this.random.range(0, spread)) * speed,
        z: (direction.z + this.random.range(-spread, spread)) * speed,
      };
      this.streaks.spawn({ ...defaultParticle, position, velocity, color: profile.color,
        size: size * .24, length: 2.2, life: duration * this.random.range(1.1, 2), priority: stage === "muzzle" ? 1 : 2 });
    }
    const muzzle = stage === "muzzle";
    if (muzzle && quality === "low" && !explosive) return;
    const smokeCount = quality === "low" || muzzle ? 1 : explosive ? 3 : 2;
    for (let i = 0; i < smokeCount; i++) {
      this.smoke.spawn({ ...defaultParticle, position, size: size * (.52 + i * .22),
        color: explosive ? "#5e493d" : "#73736a", life: profile.smoke + (destroyed ? 1.7 : explosive ? .65 : .25) + i * .1,
        velocity: { x: direction.x * (muzzle ? 1.1 : .25), y: .52 + i * .2, z: direction.z * (muzzle ? 1.1 : .25) },
        hold: muzzle ? 0 : .24 + i * .025, priority: destroyed ? 3 : muzzle ? 1 : 2,
      });
    }
    if (muzzle) return;
    const pieces = quality === "low" ? 1 : destroyed ? 12 : explosive ? 5 : 2;
    for (let i = 0; i < pieces; i++) {
      this.debris.spawn({ ...defaultParticle, position, color: i % 2 ? "#715846" : "#938773",
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

  private emitDamage(dt: number, sources: readonly DamageEmitter[], quality: Quality) {
    if (dt <= 0) return;
    const current = new Set<string>();
    for (const { id, pose, parts } of sources) {
      for (const part of parts) {
        if (part.destroyed || part.health >= part.maxHealth * .45 ||
            !["engine", "wing", "body"].includes(part.role ?? "")) continue;
        if (quality === "low" && part.role === "wing" && part.health > 0) continue;
        const key = `${id}:${part.id}`;
        current.add(key);
        if ((this.emitters.get(key) ?? 0) > this.elapsed) continue;
        this.emitters.set(key, this.elapsed + (quality === "low" ? .44 : .22));
        const anchor = localToWorld(pose, part.role === "engine" ? engineOutlet(part) : partAnchor(part));
        this.smoke.spawn({ ...defaultParticle, position: anchor, size: part.role === "engine" ? .82 : .55,
          color: "#4d5350", life: quality === "low" ? .95 : 1.25,
          velocity: { x: anchor.velocity.x * .14, y: .58, z: anchor.velocity.z * .14 },
        });
      }
    }
    for (const key of this.emitters.keys()) if (!current.has(key)) this.emitters.delete(key);
  }

  update(dt: number, camera: Camera, quality: Quality, projectiles: readonly Projectile[], wind?: WindSampler,
    events: readonly WorldEvent[] = [],
    sources: readonly DamageEmitter[] = [],
    fires: readonly { zone: FireZone; y: number }[] = [],
  ) {
    this.trails.reset();
    for (const projectile of projectiles) {
      if (!projectile.active) continue;
      const profile = weaponEffects[weaponEffectId(projectile.weaponId, projectile.damageType)];
      const direction = { x: Math.sin(projectile.heading), y: projectile.vy / projectile.speed, z: Math.cos(projectile.heading) };
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
      if (batch !== this.trails && dt > 0) batch.tick(dt, wind);
    }
    this.elapsed += dt;
    this.consume(events, quality);
    this.emitDamage(dt, sources, quality);
    if (fires.length > 0 && this.elapsed >= this.nextFire && dt > 0) {
      this.nextFire = this.elapsed + (quality === "low" ? .26 : .15);
      for (const { zone, y } of fires) {
        const position = { x: zone.x + this.random.range(-.5, .5) * zone.radius, y, z: zone.z + this.random.range(-.5, .5) * zone.radius };
        this.streaks.spawn({ ...defaultParticle, position, velocity: { x: 0, y: 1.3, z: 0 }, size: zone.radius * .66,
          color: "#ff7d36", life: .44, length: 1.2 });
      }
    }
    for (const batch of this.batches) {
      batch.write(camera, quality === "low" && batch === this.streaks ? .75 : 1);
    }
  }

  get active() { return this.batches.reduce((sum, batch) => sum + batch.mesh.count, 0); }
  get diagnostics() {
    return {
      active: this.active,
      activeBatches: this.batches.filter(({ mesh }) => mesh.count > 0).length,
      allocatedBatches: this.batches.length,
      dynamicGpuCreations: 0,
      pools: {
        flashes: this.flashes.stats, sparks: this.streaks.stats, trails: this.trails.stats, rings: this.rings.stats,
        smoke: this.smoke.stats, debris: this.debris.stats, detached: this.detached.stats,
      },
    };
  }
  reset() {
    for (const batch of this.batches) batch.reset();
    this.emitters.clear();
    this.elapsed = this.nextFire = 0;
  }
  dispose() { for (const batch of this.batches) batch.dispose(); }
}
