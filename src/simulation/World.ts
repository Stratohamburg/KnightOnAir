import { RULES } from "../data/config";
import { ENEMIES } from "../data/enemies";
import { WEAPONS, type WeaponConfig } from "../data/weapons";
import { UPGRADES, upgradeById, type Upgrade } from "../data/upgrades";
import type { Airframe } from "../data/aircrafts";
import {
  Random,
  RAD,
  clamp,
  damp,
  angleDelta,
  distance,
  segmentDistance,
} from "../services/Random";
import { ObjectPool } from "../services/ObjectPool";
import { Telemetry } from "../services/Telemetry";
import { WindField } from "./WindField";
import {
  NO_INPUT,
  type Player,
  type Stats,
  type Part,
  type Phase,
  type Intent,
  type Enemy,
  type RuntimeWeapon,
  type Projectile,
  type Pickup,
  type Effect,
  type Bomb,
  type FireZone,
} from "./types";

export const requiredXp = (level: number) =>
  Math.floor(80 + level * 45 + Math.pow(level, 1.35) * 18);
export class WorldClock {
  elapsed = 0;
  timeScale = 1;
  accumulator = 0;
}
export class World {
  readonly clock = new WorldClock();
  readonly random: Random;
  readonly telemetry = new Telemetry();
  readonly wind = new WindField();
  readonly player: Player;
  phase: Phase = "battle";
  private resumePhase: "battle" | "bombing" = "battle";
  private upgradeMode: "battle" | "bombing" = "battle";
  private nextId = 1;
  private spawnTimer = 0;
  private groundTimer = 0;
  private pickupTimer = 0;
  private eliteAt = 90;
  private deathTimer = 0;
  enemies: Enemy[] = [];
  readonly projectiles = new ObjectPool<Projectile>(
    RULES.maxProjectiles,
    () => ({
      active: false,
      id: 0,
      team: "player",
      kind: "bullet",
      x: 0,
      z: 0,
      y: 4,
      prevX: 0,
      prevZ: 0,
      heading: 0,
      speed: 0,
      life: 0,
      age: 0,
      damage: 0,
      targetId: 0,
      pierce: 0,
      bounce: 0,
      explosion: 0,
      homing: 0,
      homingLife: 0,
      escort: false,
      hitIds: [],
      burn: 0,
      slow: 0,
      armorBreak: 0,
    }),
  );
  readonly pickups = new ObjectPool<Pickup>(RULES.maxPickups, () => ({
    active: false,
    x: 0,
    z: 0,
    value: 0,
    xp: 0,
    life: 0,
    repair: false,
  }));
  readonly effects = new ObjectPool<Effect>(RULES.maxEffects, () => ({
    active: false,
    x: 0,
    z: 0,
    y: 0,
    life: 0,
    maxLife: 0,
    radius: 0,
    kind: "hit",
    seed: 0,
  }));
  bombs: Bomb[] = [];
  fires: FireZone[] = [];
  score = 0;
  coins = 0;
  kills = 0;
  level = 1;
  xp = 0;
  upgradesAvailable = 0;
  combo = 1;
  comboTimer = 0;
  choices: Upgrade[] = [];
  stability = 0;
  bombCooldown = 0;
  aim = { x: 0, z: 7 };
  aimOffset = { x: 0, z: 0 };
  bombsDropped = 0;
  bombsHit = 0;
  lockPulse = 0;
  damageTaken = 0;
  speedIntegral = 0;
  energyEmptyCount = 0;
  private energyWasEmpty = false;
  notice = "第一关 · 翡翠海岸";
  noticeTime = 4;

  constructor(
    frame: Airframe,
    seed = Date.now(),
    private options: { director?: boolean } = {},
  ) {
    this.random = new Random(seed);
    this.player = {
      frame,
      x: 0,
      z: 0,
      prevX: 0,
      prevZ: 0,
      vx: 0,
      vz: frame.cruiseSpeed,
      heading: 0,
      turnVelocity: 0,
      bank: 0,
      speed: frame.cruiseSpeed,
      energy: frame.energyMax,
      health: frame.health,
      hitFlash: 0,
      invulnerable: 0,
      stats: this.baseStats(frame),
      parts: [],
      weapons: [],
      upgrades: [],
      revision: 0,
    };
    const p = this.player;
    p.parts = [
      this.part("core", "body", "center", 0, 0, frame.health, 0.65),
      this.part(
        "left_wing",
        "wing",
        "leftWing",
        -frame.wingspan * 0.23,
        -0.1,
        30,
        frame.wingspan * 0.16,
      ),
      this.part(
        "right_wing",
        "wing",
        "rightWing",
        frame.wingspan * 0.23,
        -0.1,
        30,
        frame.wingspan * 0.16,
      ),
      this.part("nose", "gun", "nose", 0, frame.length * 0.31, 24, 0.42),
      this.part("tail", "tail", "tail", 0, -frame.length * 0.34, 28, 0.5),
      this.part("bay", "bombBay", "bottom", 0, -0.3, 30, 0.45),
    ];
    for (let i = 0; i < frame.engines; i++) {
      const x =
        frame.engines === 1
          ? 0
          : (i - (frame.engines - 1) / 2) * frame.wingspan * 0.2;
      p.parts.push(
        this.part(
          `engine_${i}`,
          "engine",
          x < 0 ? "leftWing" : x > 0 ? "rightWing" : "tail",
          x,
          -frame.length * 0.2,
          30,
          0.42,
        ),
      );
    }
    if (
      frame.gun === "wing_machinegun_pair" ||
      frame.gun === "heavy_machinegun_quad"
    ) {
      const config = WEAPONS[frame.gun];
      this.addWeapon(
        { ...config, count: config.count / 2 },
        "left_wing",
        -frame.wingspan * 0.2,
        0.5,
      );
      this.addWeapon(
        { ...config, count: config.count / 2 },
        "right_wing",
        frame.wingspan * 0.2,
        0.5,
      );
    } else this.addWeapon(WEAPONS[frame.gun], "nose", 0, frame.length * 0.32);
    if (frame.missile) this.addWeapon(WEAPONS.lock_missile, "nose", 0.6, 0.5);
    if (frame.turret) {
      p.parts.push(this.part("top_turret", "turret", "top", 0, 0, 30, 0.4));
      this.addWeapon(WEAPONS.top_turret, "top_turret", 0, 0);
    }
    if (frame.id === "wasp_04") p.stats.lockTime = -0.25;
    this.telemetry.record(0, "session_start", { frame: frame.id, seed });
    // First encounter approaches from beyond the viewport; the opening coins teach steering.
    this.spawnEnemy("scout", -3, 25);
    this.spawnEnemy("hunter", 3, 31);
    for (let i = 0; i < 6; i++)
      this.spawnPickup(Math.sin(i * 0.4) * 1.6, 4 + i * 2.4, 1, 12);
  }
  private baseStats(f: Airframe): Stats {
    return {
      maxSpeed: f.maxSpeed,
      acceleration: f.acceleration,
      turnRate: f.turnRate,
      energyMax: f.energyMax,
      energyDrain: f.energyDrain,
      energyRecover: f.energyRecover,
      health: f.health,
      wingspan: f.wingspan,
      length: f.length,
      radius: 0.65,
      leftTurn: 1,
      rightTurn: 1,
      bombSettle: 1,
      bombCooldown: 0,
      lockTime: 0,
      lockArc: 0,
      damage: 1,
      fireRate: 1,
      damageTransfer: 0.7,
      windResponse: 1,
    };
  }
  private part(
    id: string,
    kind: string,
    slot: Part["slot"],
    x: number,
    z: number,
    health: number,
    radius = 0.5,
  ): Part {
    return {
      id,
      kind,
      slot,
      x,
      z,
      radius,
      health,
      maxHealth: health,
      destroyed: false,
      weight: 5,
    };
  }
  private addWeapon(
    config: WeaponConfig,
    partId: string,
    x: number,
    z: number,
    baseAngle = 0,
  ) {
    this.player.weapons.push({
      config,
      partId,
      x,
      z,
      cooldown: 0,
      targetId: 0,
      lockProgress: 0,
      lockLost: false,
      heading: this.player.heading + baseAngle,
      baseAngle,
    });
  }
  get elapsed() {
    return this.clock.elapsed;
  }
  get isBombing() {
    return (
      this.phase === "bombing" ||
      (this.phase === "upgrade" && this.upgradeMode === "bombing")
    );
  }
  get bombWeapon() {
    return WEAPONS[
      this.player.upgrades.includes("napalm")
        ? "napalm_bomb"
        : this.player.frame.bomb
    ];
  }
  get canBomb() {
    return (
      this.phase === "bombing" &&
      this.stability >= RULES.bombThreshold &&
      this.bombCooldown <= 0 &&
      this.partFactor("bombBay") > 0
    );
  }
  get mainLock() {
    return this.player.weapons.find((w) => w.config.lockTime > 0);
  }
  get averageSpeed() {
    return this.elapsed ? this.speedIntegral / this.elapsed : 0;
  }
  private partFactor(kind: string) {
    const parts = this.player.parts.filter((p) => p.kind === kind);
    return parts.length
      ? parts.reduce(
          (v, p) =>
            v + (p.health <= 0 ? 0 : 0.5 + (0.5 * p.health) / p.maxHealth),
          0,
        ) / parts.length
      : 1;
  }
  frame(dt: number, input: Intent = NO_INPUT) {
    if (this.clock.timeScale === 0) {
      this.clock.accumulator = 0;
      return;
    }
    this.clock.accumulator += Math.min(RULES.maxFrame, Math.max(0, dt));
    let steps = 0;
    while (this.clock.accumulator >= RULES.step && steps++ < RULES.maxSteps) {
      this.step(RULES.step, input);
      this.clock.accumulator -= RULES.step;
      if (this.clock.timeScale === 0) {
        this.clock.accumulator = 0;
        break;
      }
    }
  }
  step(dt: number, input: Intent = NO_INPUT) {
    if (this.clock.timeScale === 0 || this.phase === "result") return;
    if (this.phase === "dying") {
      this.deathTimer += dt;
      this.updateEffects(dt);
      if (this.deathTimer >= 1.2) {
        this.phase = "result";
        this.clock.timeScale = 0;
      }
      return;
    }
    this.clock.elapsed += dt;
    this.wind.update(dt);
    this.noticeTime = Math.max(0, this.noticeTime - dt);
    this.lockPulse = Math.max(0, this.lockPulse - dt);
    this.updatePlayer(dt, input);
    this.updateDirector(dt);
    this.updateEnemies(dt);
    this.updateWeapons(dt);
    this.updateProjectiles(dt);
    this.updatePickups(dt);
    this.updateBombing(dt, input);
    this.updateEffects(dt);
    this.speedIntegral += this.player.speed * dt;
    if (this.player.health <= 0) this.end("aircraft_destroyed");
  }
  private updatePlayer(dt: number, input: Intent) {
    const p = this.player,
      s = p.stats;
    const core = p.parts.find((part) => part.id === "core");
    if (core) {
      core.maxHealth = s.health;
      core.health = p.health;
    }
    p.prevX = p.x;
    p.prevZ = p.z;
    p.invulnerable = Math.max(0, p.invulnerable - dt);
    p.hitFlash = Math.max(0, p.hitFlash - dt * 4);
    const engineFactor = 0.5 + this.partFactor("engine") * 0.5;
    const wingFactor = 0.65 + this.partFactor("wing") * 0.35;
    let error = input.active
      ? angleDelta(Math.atan2(input.x, input.z), p.heading)
      : 0;
    const edge = Math.hypot(p.x, p.z);
    if (edge > RULES.boundary)
      error = angleDelta(Math.atan2(-p.x, -p.z), p.heading);
    const turn =
      s.turnRate *
      RAD *
      wingFactor *
      (error < 0 ? s.leftTurn : s.rightTurn) *
      (this.isBombing ? 0.65 : 1);
    const targetTurn = clamp(error * 7, -turn, turn);
    p.turnVelocity = damp(p.turnVelocity, targetTurn, 11, dt);
    const delta =
      Math.abs(p.turnVelocity * dt) > Math.abs(error)
        ? error
        : p.turnVelocity * dt;
    p.heading = angleDelta(p.heading + delta, 0);
    p.bank = damp(
      p.bank,
      clamp(-p.turnVelocity / (5 * RAD), -18, 18) * RAD,
      8,
      dt,
    );
    const throttle = input.active
      ? input.magnitude * (this.isBombing ? 0.45 : 1)
      : 0;
    if (throttle > 0 && p.energy > 0) {
      p.energy = Math.max(0, p.energy - s.energyDrain * throttle * dt);
      p.speed += s.acceleration * engineFactor * throttle * dt;
    } else {
      p.energy = Math.min(s.energyMax, p.energy + s.energyRecover * dt);
      p.speed -= 1.2 * dt;
    }
    if (p.energy < 0.5 && !this.energyWasEmpty) {
      this.energyEmptyCount++;
      this.energyWasEmpty = true;
    }
    if (p.energy > 8) this.energyWasEmpty = false;
    p.speed -= Math.abs(delta) * 0.35;
    p.speed = clamp(
      p.speed,
      p.frame.cruiseSpeed,
      Math.max(p.frame.cruiseSpeed, s.maxSpeed * engineFactor),
    );
    const wind = this.wind.sample(p.x, p.z);
    p.vx = Math.sin(p.heading) * p.speed + wind.x * s.windResponse;
    p.vz = Math.cos(p.heading) * p.speed + wind.z * s.windResponse;
    p.x += p.vx * dt;
    p.z += p.vz * dt;
  }
  private updateDirector(dt: number) {
    if (this.options.director === false) return;
    const p = this.player,
      t = this.elapsed;
    this.spawnTimer -= dt;
    this.groundTimer -= dt;
    this.pickupTimer -= dt;
    const airCount = this.enemies.filter((e) => e.layer === "air").length;
    if (
      this.spawnTimer <= 0 &&
      airCount < Math.min(14, 4 + Math.floor(t / 25))
    ) {
      const pool =
        t < 30
          ? ["scout", "hunter"]
          : t < 60
            ? ["hunter", "scout", "striker"]
            : ["hunter", "bomber", "escort", "striker"];
      const count =
        p.health / p.stats.health < 0.35
          ? 1
          : 2 + Math.min(2, Math.floor(t / 70));
      const angle = p.heading + this.random.range(-1.1, 1.1);
      for (let i = 0; i < count; i++)
        this.spawnEnemy(
          this.random.pick(pool),
          p.x + Math.sin(angle) * (30 + i * 3) + (i - 1) * 3,
          p.z + Math.cos(angle) * (30 + i * 3),
        );
      this.spawnTimer = this.random.range(8, 12) * (airCount > 9 ? 1.5 : 1);
    }
    if (
      this.groundTimer <= 0 &&
      this.enemies.filter((e) => e.layer === "ground").length <
        RULES.maxGround - 2
    ) {
      const a = p.heading + this.random.range(-0.6, 0.6),
        d = this.random.range(24, 38);
      const kind =
        t < 30
          ? "resource"
          : t < 60
            ? this.random.pick(["aa", "emplacement", "resource"])
            : this.random.pick(["aa", "missile_truck", "resource", "depot"]);
      this.spawnEnemy(kind, p.x + Math.sin(a) * d, p.z + Math.cos(a) * d);
      this.groundTimer = t < 30 ? 10 : 7;
    }
    if (t >= this.eliteAt - 2 && t < this.eliteAt)
      this.message("大型信号接近 · 精英空艇", 2.1);
    if (t >= this.eliteAt) {
      this.spawnEnemy(
        "elite",
        p.x + Math.sin(p.heading) * 32,
        p.z + Math.cos(p.heading) * 32,
      );
      this.eliteAt += 90;
    }
    if (this.pickupTimer <= 0) {
      for (let i = 0; i < 5; i++) {
        const a = p.heading + Math.sin(i * 0.5) * 0.17,
          d = 9 + i * 2;
        this.spawnPickup(p.x + Math.sin(a) * d, p.z + Math.cos(a) * d, 1, 9);
      }
      this.pickupTimer = 7;
    }
  }
  spawnEnemy(kind: string, x: number, z: number) {
    if (this.enemies.length >= RULES.maxEnemies + RULES.maxGround) return;
    const c = ENEMIES[kind];
    const e: Enemy = {
      id: this.nextId++,
      kind,
      layer: c.layer,
      x,
      z,
      vx: 0,
      vz: 0,
      heading: Math.atan2(this.player.x - x, this.player.z - z),
      health: c.health,
      maxHealth: c.health,
      radius: c.radius,
      age: 0,
      cooldown: this.random.range(1.5, 3.5),
      warning: 0,
      aimX: 0,
      aimZ: 0,
      flash: 0,
      burn: 0,
      slow: 0,
      armorBreak: 0,
      called: false,
      state: "entering",
    };
    this.enemies.push(e);
    return e;
  }
  private updateEnemies(dt: number) {
    const p = this.player;
    for (const e of [...this.enemies]) {
      const c = ENEMIES[e.kind],
        d = distance(e, p);
      e.age += dt;
      e.flash = Math.max(0, e.flash - dt * 5);
      if (e.burn > 0) {
        e.burn -= dt;
        this.damageEnemy(e, dt * 12);
      }
      e.slow = Math.max(0, e.slow - dt);
      e.armorBreak = Math.max(0, e.armorBreak - dt);
      if (e.health <= 0) continue;
      let target = Math.atan2(p.x - e.x, p.z - e.z);
      if (e.layer === "air") {
        e.state =
          d > 22
            ? "entering"
            : e.health < c.health * 0.2
              ? "fleeing"
              : e.age % 9 > 5.5
                ? "breaking"
                : "attacking";
        if (e.state === "breaking") target += 1.15;
        if (e.state === "fleeing") target += Math.PI * 0.7;
        if (e.kind === "scout") {
          target += d < 16 ? 1.5 : 0.3;
          if (e.age > 8 && !e.called) {
            e.called = true;
            this.spawnEnemy("hunter", e.x + 5, e.z + 14);
          }
        }
        if (e.kind === "bomber") target = Math.sin(e.age * 0.2) * 0.4 + Math.PI;
        if (e.kind === "escort") {
          const elite = this.enemies.find((v) => v.kind === "elite");
          if (elite)
            target = Math.atan2(
              elite.x + Math.sin(e.age) * 7 - e.x,
              elite.z + Math.cos(e.age) * 7 - e.z,
            );
        }
        if (e.kind === "elite") target += d < 17 ? 1.3 : 0;
      }
      e.heading += clamp(
        angleDelta(target, e.heading),
        -c.turnRate * RAD * dt,
        c.turnRate * RAD * dt,
      );
      const speed =
        c.speed *
        (e.slow > 0 ? 0.6 : 1) *
        (e.health < e.maxHealth * 0.4 ? 0.8 : 1) *
        (e.kind === "striker" && e.age % 7 < 1.2 ? 1.8 : 1);
      e.vx = Math.sin(e.heading) * speed;
      e.vz = Math.cos(e.heading) * speed;
      e.x += e.vx * dt;
      e.z += e.vz * dt;
      if (e.layer === "air" && d < e.radius + 0.7)
        this.damagePlayer(e.kind === "striker" ? 28 : 8, e.x, e.z, e.kind);
      e.cooldown -= dt;
      const angle = Math.abs(
        angleDelta(Math.atan2(p.x - e.x, p.z - e.z), e.heading),
      );
      const canAttack =
        c.damage > 0 &&
        d < (e.layer === "ground" ? 30 : 22) &&
        (e.layer === "ground" || angle < 0.6 || e.kind === "elite");
      if (e.cooldown <= 0 && canAttack && e.warning === 0) {
        e.warning =
          e.layer === "ground" ? (e.kind === "missile_truck" ? 1.3 : 0.8) : 0.7;
        e.aimX = p.x + p.vx * 0.35;
        e.aimZ = p.z + p.vz * 0.35;
      }
      if (e.warning > 0) {
        e.warning -= dt;
        if (e.warning <= 0) {
          e.warning = 0;
          e.cooldown = c.fireInterval * (e.health < c.health * 0.4 ? 1.5 : 1);
          const a = Math.atan2(e.aimX - e.x, e.aimZ - e.z);
          const count =
            e.kind === "elite" ? 12 : e.kind === "emplacement" ? 5 : 1;
          for (let i = 0; i < count; i++) {
            const heading =
              e.kind === "elite"
                ? a + (i * Math.PI * 2) / count
                : a + (i - (count - 1) / 2) * 0.075;
            this.shoot(
              e.x,
              e.z,
              heading,
              {
                ...WEAPONS.light_cannon,
                damage: c.damage,
                speed: e.kind === "missile_truck" ? 10 : 12,
                range: 45,
                homing: e.kind === "missile_truck" ? 35 : 0,
                homingLife: 4,
              },
              "enemy",
              0,
              e.layer === "ground" ? "flak" : "bullet",
            );
          }
        }
      }
    }
    this.enemies = this.enemies.filter(
      (e) => e.health > 0 && distance(e, p) < 85 && e.age < 65,
    );
  }
  private targetFor(w: RuntimeWeapon) {
    const p = this.player,
      c = w.config;
    let best: Enemy | undefined,
      score = -Infinity;
    for (const e of this.enemies) {
      if (e.layer !== "air" || e.health <= 0) continue;
      const d = distance(e, p);
      if (d > c.range) continue;
      const predict = Math.min(0.7, (d / c.speed) * 0.35);
      const a = Math.atan2(
        e.x + e.vx * predict - p.x,
        e.z + e.vz * predict - p.z,
      );
      const error = Math.abs(angleDelta(a, p.heading + w.baseAngle));
      const arc =
        c.category === "turret"
          ? c.turretArc
          : c.arc + (c.lockTime ? p.stats.lockArc : 0);
      if (error > arc * RAD * 0.5) continue;
      const s =
        5 * (1 - error / Math.PI) +
        (1 - d / c.range) +
        (e.kind === "elite" ? 0.5 : 0) +
        (e.id === w.targetId ? 0.3 : 0);
      if (s > score) {
        best = e;
        score = s;
      }
    }
    return best;
  }
  private updateWeapons(dt: number) {
    const p = this.player;
    for (const w of p.weapons) {
      const part = p.parts.find((v) => v.id === w.partId),
        c = w.config;
      w.cooldown = Math.max(0, w.cooldown - dt);
      if (part && part.health <= 0) {
        w.lockProgress = 0;
        continue;
      }
      const target = this.targetFor(w);
      if (!target) {
        if (w.lockProgress > 0 && w.targetId && !w.lockLost)
          this.telemetry.record(this.elapsed, "lock_lost", {
            target: w.targetId,
          });
        w.lockLost = true;
        w.lockProgress = Math.max(0, w.lockProgress - c.lossRate * dt);
        if (w.lockProgress === 0) w.targetId = 0;
        if (c.category !== "turret") w.heading = p.heading + w.baseAngle;
        continue;
      }
      if (w.targetId && w.targetId !== target.id) w.lockProgress = 0;
      const isNew = w.targetId !== target.id || w.lockLost;
      w.targetId = target.id;
      w.lockLost = false;
      if (c.lockTime > 0 && w.cooldown <= 0) {
        if (isNew)
          this.telemetry.record(this.elapsed, "lock_start", {
            target: target.id,
          });
        const damageFactor = part
          ? 1 + (1 - part.health / part.maxHealth) * 0.4
          : 1;
        w.lockProgress = Math.min(
          1,
          w.lockProgress +
            dt / (Math.max(0.35, c.lockTime + p.stats.lockTime) * damageFactor),
        );
        if (w.lockProgress < 1) continue;
      }
      const prediction = Math.min(0.5, (distance(p, target) / c.speed) * 0.65);
      const heading = Math.atan2(
        target.x + target.vx * prediction - p.x,
        target.z + target.vz * prediction - p.z,
      );
      if (c.category === "turret") {
        const factor = part ? 0.4 + (0.6 * part.health) / part.maxHealth : 1;
        w.heading += clamp(
          angleDelta(heading, w.heading),
          -c.turnRate * RAD * dt * factor,
          c.turnRate * RAD * dt * factor,
        );
        if (Math.abs(angleDelta(heading, w.heading)) > c.arc * RAD * 0.5)
          continue;
      } else w.heading = heading;
      if (w.cooldown > 0) continue;
      const cos = Math.cos(p.heading),
        sin = Math.sin(p.heading);
      for (let i = 0; i < c.count; i++) {
        const localX = w.x + (i - (c.count - 1) / 2) * 0.4;
        const x = p.x + localX * cos + w.z * sin,
          z = p.z - localX * sin + w.z * cos;
        // Each real mount converges on the predicted target instead of firing parallel offset rays.
        const aimHeading =
          c.category === "turret"
            ? w.heading
            : Math.atan2(
                target.x + target.vx * prediction - x,
                target.z + target.vz * prediction - z,
              );
        this.shoot(
          x,
          z,
          aimHeading + (i - (c.count - 1) / 2) * c.spread * RAD,
          { ...c, damage: c.damage * p.stats.damage },
          "player",
          target.id,
        );
      }
      w.cooldown =
        1 /
        (c.fireRate *
          p.stats.fireRate *
          (part && part.health < part.maxHealth * 0.4 ? 0.65 : 1));
      if (c.lockTime) {
        this.lockPulse = 0.3;
        this.telemetry.record(this.elapsed, "lock_fire", { target: target.id });
      }
      w.lockProgress = 0;
    }
  }
  shoot(
    x: number,
    z: number,
    heading: number,
    config: WeaponConfig,
    team: "player" | "enemy",
    targetId = 0,
    kind?: Projectile["kind"],
  ) {
    const v = this.projectiles.acquire();
    if (!v) return;
    Object.assign(v, {
      id: this.nextId++,
      team,
      kind: kind ?? (config.homing > 0 ? "missile" : "bullet"),
      x,
      z,
      y: RULES.playerHeight,
      prevX: x,
      prevZ: z,
      heading,
      speed: config.speed,
      life: config.range / config.speed,
      age: 0,
      damage: config.damage,
      targetId,
      pierce: config.pierce,
      bounce: config.bounce,
      explosion: config.explosion,
      homing: config.homing * RAD,
      homingLife: config.homingLife,
      escort: config.escort,
      burn: config.burn,
      slow: config.slow,
      armorBreak: config.armorBreak,
    });
    v.hitIds.length = 0;
  }
  private updateProjectiles(dt: number) {
    const p = this.player;
    for (const v of this.projectiles.items) {
      if (!v.active) continue;
      v.age += dt;
      v.life -= dt;
      v.prevX = v.x;
      v.prevZ = v.z;
      if (v.life <= 0 || distance(v, p) > 65) {
        v.active = false;
        continue;
      }
      if (v.homing && v.age < v.homingLife) {
        const target =
          v.team === "enemy"
            ? p
            : this.enemies.find((e) => e.id === v.targetId && e.health > 0);
        if (target) {
          const escort = v.escort && distance(target, p) > 35 ? 0.2 : 1;
          v.heading += clamp(
            angleDelta(Math.atan2(target.x - v.x, target.z - v.z), v.heading),
            -v.homing * dt * escort,
            v.homing * dt * escort,
          );
        }
      }
      const wind = this.wind.sample(v.x, v.z);
      v.x += (Math.sin(v.heading) * v.speed + wind.x * 0.15) * dt;
      v.z += (Math.cos(v.heading) * v.speed + wind.z * 0.15) * dt;
      if (v.team === "enemy") {
        if (this.hitPlayer(v)) {
          v.active = false;
          this.damagePlayer(v.damage, v.x, v.z, v.kind);
        }
      } else {
        for (const e of this.enemies) {
          if (e.layer !== "air" || e.health <= 0 || v.hitIds.includes(e.id))
            continue;
          if (
            segmentDistance(e.x, e.z, v.prevX, v.prevZ, v.x, v.z) >
            e.radius + 0.14
          )
            continue;
          this.damageEnemy(e, v.damage, v.x, v.z);
          v.hitIds.push(e.id);
          e.burn = Math.max(e.burn, v.burn > 0 ? 3 : 0);
          e.slow = Math.max(e.slow, v.slow);
          e.armorBreak = Math.max(e.armorBreak, v.armorBreak);
          if (v.explosion)
            this.explode(v.x, v.z, v.explosion, v.damage * 0.5, "air", e.id);
          if (v.pierce-- > 0) continue;
          if (v.bounce-- > 0) {
            const normal = Math.atan2(v.x - e.x, v.z - e.z);
            v.heading = 2 * normal - v.heading + Math.PI;
            break;
          }
          v.active = false;
          break;
        }
      }
    }
  }
  private hitPlayer(v: Projectile) {
    const p = this.player,
      sin = Math.sin(p.heading),
      cos = Math.cos(p.heading);
    const x = v.x - p.x,
      z = v.z - p.z,
      px = v.prevX - p.prevX,
      pz = v.prevZ - p.prevZ;
    const lx = x * cos - z * sin,
      lz = x * sin + z * cos;
    const ax = px * cos - pz * sin,
      az = px * sin + pz * cos;
    return p.parts.some(
      (part) =>
        !part.destroyed &&
        segmentDistance(part.x, part.z, ax, az, lx, lz) <
          part.radius + 0.1 + p.stats.radius * 0.1,
    );
  }
  damagePlayer(
    amount: number,
    x = this.player.x,
    z = this.player.z,
    source = "unknown",
  ) {
    const p = this.player;
    if (p.invulnerable > 0 || this.phase === "dying" || this.phase === "result")
      return;
    const dx = x - p.x,
      dz = z - p.z,
      sin = Math.sin(p.heading),
      cos = Math.cos(p.heading);
    const lx = dx * cos - dz * sin,
      lz = dx * sin + dz * cos;
    const part = p.parts
      .filter((v) => !v.destroyed)
      .sort(
        (a, b) =>
          Math.hypot(a.x - lx, a.z - lz) - Math.hypot(b.x - lx, b.z - lz),
      )[0];
    if (part && part.id !== "core") {
      part.health = Math.max(0, part.health - amount);
      if (part.health === 0 && ["winglet", "gun", "wing"].includes(part.kind))
        part.destroyed = true;
      p.health -= amount * p.stats.damageTransfer;
    } else p.health -= amount;
    p.health = Math.max(0, p.health);
    const core = p.parts.find((part) => part.id === "core");
    if (core) {
      core.health = p.health;
      core.maxHealth = p.stats.health;
    }
    this.damageTaken += amount;
    p.hitFlash = 1;
    p.invulnerable = RULES.invulnerability;
    this.stability *= 0.5;
    this.combo = 1;
    this.comboTimer = 0;
    this.effect(p.x, p.z, "hit", 0.45, 1);
    this.telemetry.record(this.elapsed, "player_damage", {
      source,
      amount,
      part: part?.id ?? "core",
    });
  }
  damageEnemy(e: Enemy, damage: number, x = e.x, z = e.z) {
    if (e.health <= 0) return;
    e.health -= damage * (e.armorBreak > 0 ? 1.25 : 1);
    e.flash = 1;
    if (damage > 1)
      this.effect(x, z, "hit", 0.22, 0.5, e.layer === "ground" ? 0.6 : 4);
    if (e.health > 0) return;
    const c = ENEMIES[e.kind];
    this.kills++;
    this.score += Math.round(c.xp * 4 * this.combo);
    this.awardXp(c.xp);
    this.effect(
      e.x,
      e.z,
      e.layer === "ground" ? "ground" : "explosion",
      1,
      c.radius * 2,
      e.layer === "ground" ? 0.3 : 4,
    );
    for (let i = 0; i < Math.min(c.coins, 6); i++)
      this.spawnPickup(
        e.x + this.random.range(-1.5, 1.5),
        e.z + this.random.range(-1.5, 1.5),
        Math.ceil(c.coins / 6),
        8,
      );
    if (e.kind === "elite") {
      this.spawnPickup(e.x, e.z, 0, 100, true);
      this.message("精英击毁 · 维修补给已投放", 4);
    }
    if (e.kind === "depot") this.explode(e.x, e.z, 5, 90, "ground", e.id);
  }
  private explode(
    x: number,
    z: number,
    radius: number,
    damage: number,
    layer: Enemy["layer"],
    exclude = 0,
  ) {
    this.effect(
      x,
      z,
      layer === "ground" ? "ground" : "explosion",
      1,
      radius,
      layer === "ground" ? 0.2 : 4,
    );
    let hits = 0;
    for (const e of [...this.enemies]) {
      const d = Math.hypot(e.x - x, e.z - z);
      if (
        e.health > 0 &&
        e.id !== exclude &&
        e.layer === layer &&
        d <= radius + e.radius
      ) {
        this.damageEnemy(e, damage * Math.max(0.3, 1 - d / (radius * 1.42)));
        hits++;
      }
    }
    return hits;
  }
  spawnPickup(x: number, z: number, value = 1, xp = 10, repair = false) {
    const item = this.pickups.acquire();
    if (item) Object.assign(item, { x, z, value, xp, repair, life: 28 });
  }
  private updatePickups(dt: number) {
    const p = this.player;
    this.comboTimer = Math.max(0, this.comboTimer - dt);
    if (this.comboTimer === 0) this.combo = 1;
    for (const c of this.pickups.items) {
      if (!c.active) continue;
      c.life -= dt;
      if (c.life <= 0 || distance(c, p) > 70) {
        c.active = false;
        continue;
      }
      const d = distance(c, p);
      if (d < RULES.magnetRadius) {
        const t = Math.min(1, dt * (5 + (RULES.magnetRadius - d) * 3));
        c.x += (p.x - c.x) * t;
        c.z += (p.z - c.z) * t;
      }
      if (d < RULES.pickupRadius) {
        c.active = false;
        this.coins += c.value;
        this.score += Math.round(c.value * 10 * this.combo);
        this.awardXp(c.xp);
        if (c.repair) this.repair(0.35);
        this.combo = Math.min(3, this.combo + 0.05);
        this.comboTimer = RULES.comboTimeout;
        this.effect(c.x, c.z, "coin", 0.4, 0.6, 4);
      }
    }
  }
  awardXp(amount: number) {
    this.xp += amount;
    while (this.xp >= requiredXp(this.level)) {
      this.xp -= requiredXp(this.level);
      this.level++;
      this.upgradesAvailable++;
      this.message(`等级 ${this.level} · 可安装新部件`, 3);
    }
  }
  openUpgrades() {
    if (
      !["battle", "bombing"].includes(this.phase) ||
      this.upgradesAvailable <= 0
    )
      return false;
    this.upgradeMode = this.phase as "battle" | "bombing";
    this.phase = "upgrade";
    this.clock.timeScale = 0;
    const p = this.player;
    const available = UPGRADES.filter(
      (u) =>
        p.upgrades.filter((id) => id === u.id).length < (u.max ?? 1) &&
        !u.conflicts?.some((id) => p.upgrades.includes(id)) &&
        (!u.requires || u.requires.every((id) => p.upgrades.includes(id))) &&
        (!u.weapons?.length ||
          p.weapons.length + u.weapons.length <=
            p.frame.hardpoints +
              (p.upgrades.includes("modular_frame") ? 3 : 0)),
    );
    const weighted = available
      .map((u) => ({
        u,
        weight:
          -Math.log(Math.max(0.00001, this.random.next())) /
          this.upgradeWeight(u),
      }))
      .sort((a, b) => a.weight - b.weight);
    this.choices = weighted.slice(0, 3).map((v) => v.u);
    if (
      p.upgrades.length === 0 &&
      !this.choices.some((u) => ["动力", "机动"].includes(u.tag))
    ) {
      const control =
        available.find((u) => u.id === "right_engine") ??
        available.find((u) => u.id === "low_drag");
      if (control) this.choices[2] = control;
    }
    this.telemetry.record(this.elapsed, "upgrade_options", {
      choices: this.choices.map((u) => u.id).join(","),
    });
    return true;
  }
  private upgradeWeight(u: Upgrade) {
    let w = u.rarity === "common" ? 5 : u.rarity === "rare" ? 2 : 0.7;
    if (u.repair && this.player.health / this.player.stats.health < 0.45)
      w *= 5;
    if (this.player.upgrades.includes("right_engine") && u.id === "left_engine")
      w *= 2;
    if (
      this.player.upgrades.includes("giant_wing") &&
      ["动力", "轰炸", "维修"].includes(u.tag)
    )
      w *= 2;
    if (
      this.player.upgrades
        .slice(-2)
        .every((id) =>
          ["giant_wing", "heavy_armor", "tail_armor"].includes(id),
        ) &&
      u.tag === "结构"
    )
      w *= 0.01;
    return w;
  }
  chooseUpgrade(id: string) {
    if (
      this.phase !== "upgrade" ||
      !this.choices.some((u) => u.id === id) ||
      this.upgradesAvailable <= 0
    )
      return false;
    const u = upgradeById(id)!;
    this.installUpgrade(u);
    this.upgradesAvailable--;
    this.choices = [];
    this.phase = this.upgradeMode;
    this.clock.timeScale = 1;
    this.clock.accumulator = 0;
    this.telemetry.record(this.elapsed, "upgrade_chosen", { id });
    this.message(`已安装 · ${u.name}`, 3);
    return true;
  }
  installUpgrade(u: Upgrade) {
    const p = this.player,
      healthBefore = p.stats.health;
    p.upgrades.push(u.id);
    if (u.add)
      for (const [key, val] of Object.entries(u.add))
        p.stats[key as keyof Stats] += val;
    if (u.multiply)
      for (const [key, val] of Object.entries(u.multiply))
        p.stats[key as keyof Stats] *= val;
    p.health = clamp(
      p.health + p.stats.health - healthBefore,
      1,
      p.stats.health,
    );
    p.energy = Math.min(p.energy, p.stats.energyMax);
    const newlyAdded: Part[] = [];
    u.parts.forEach((recipe, i) => {
      const existing =
        u.max &&
        p.parts.find(
          (part) => part.id.startsWith(`${u.id}_`) && part.kind === recipe.kind,
        );
      if (existing) {
        existing.health = Math.min(
          existing.maxHealth,
          existing.health + recipe.health * 0.3,
        );
        existing.destroyed = false;
        newlyAdded.push(existing);
        return;
      }
      const side =
        recipe.slot === "leftWing" ? -1 : recipe.slot === "rightWing" ? 1 : 0;
      const x = recipe.x ?? side * p.stats.wingspan * 0.32;
      const z =
        recipe.z ??
        (recipe.slot === "nose"
          ? p.stats.length * 0.42
          : recipe.slot === "tail"
            ? -p.stats.length * 0.4
            : 0);
      const part = this.part(
        `${u.id}_${p.upgrades.length}_${i}`,
        recipe.kind,
        recipe.slot,
        x,
        z,
        recipe.health,
        recipe.kind === "wing" ? 1.1 : 0.5,
      );
      part.weight = recipe.weight ?? 5;
      p.parts.push(part);
      newlyAdded.push(part);
    });
    u.weapons?.forEach((id, i) => {
      if (id === "lock_missile" && this.mainLock) return;
      const part = newlyAdded[Math.min(i, newlyAdded.length - 1)];
      const c =
        id === "nose_cannon_pair" && u.id === "nose_cannon"
          ? { ...WEAPONS[id], damage: WEAPONS[id].damage * 1.55, pierce: 1 }
          : WEAPONS[id];
      this.addWeapon(
        c,
        part.id,
        part.x,
        part.z + 0.4,
        u.id === "twin_tail" ? Math.PI : 0,
      );
    });
    // Expand the base hit zones together with the visible wing, including lightweight builds.
    for (const part of p.parts) {
      if (part.id === "left_wing" || part.id === "right_wing") {
        part.x = (part.slot === "leftWing" ? -1 : 1) * p.stats.wingspan * 0.23;
        part.radius = p.stats.wingspan * 0.16;
      }
    }
    if (u.repair) this.repair(0.4);
    if (u.id === "modular_frame")
      for (const part of p.parts) {
        part.maxHealth *= 1.1;
        part.health *= 1.1;
      }
    p.revision++;
  }
  private repair(ratio: number) {
    const p = this.player;
    p.health = Math.min(p.stats.health, p.health + p.stats.health * ratio);
    for (const part of p.parts) {
      part.health = Math.min(
        part.maxHealth,
        part.health +
          part.maxHealth * ratio +
          (part.destroyed ? part.maxHealth * 0.3 : 0),
      );
      part.destroyed = false;
    }
    p.revision++;
  }
  toggleBombing() {
    if (!["battle", "bombing"].includes(this.phase)) return;
    this.phase = this.phase === "battle" ? "bombing" : "battle";
    this.stability = 0;
    this.aimOffset = { x: 0, z: 0 };
    this.telemetry.record(this.elapsed, "bombing_mode", {
      enabled: Number(this.phase === "bombing"),
    });
    this.message(
      this.isBombing ? "轰炸模式 · 松杆稳定准心" : "空战模式 · 保持目标在前方",
      3,
    );
  }
  private updateBombing(dt: number, input: Intent) {
    this.bombCooldown = Math.max(0, this.bombCooldown - dt);
    const p = this.player,
      lead = 2.6 + p.speed * 0.55;
    if (this.isBombing) {
      if (input.active) {
        this.aimOffset.x = clamp(
          this.aimOffset.x + input.x * input.magnitude ** 1.6 * 3 * dt,
          -5,
          5,
        );
        this.aimOffset.z = clamp(
          this.aimOffset.z + input.z * input.magnitude ** 1.6 * 3 * dt,
          -5,
          5,
        );
      }
      const motion = input.active ? input.magnitude : 0;
      const gain =
        (1 - motion * 1.8) * RULES.bombSettleRate * p.stats.bombSettle;
      this.stability = clamp(
        this.stability + (gain - this.wind.gust * 0.08 - p.hitFlash * 0.7) * dt,
      );
    } else this.stability = 0;
    this.aim.x = damp(
      this.aim.x,
      p.x + Math.sin(p.heading) * lead + this.aimOffset.x,
      4,
      dt,
    );
    this.aim.z = damp(
      this.aim.z,
      p.z + Math.cos(p.heading) * lead + this.aimOffset.z,
      4,
      dt,
    );
    for (const bomb of this.bombs) {
      bomb.age += dt;
      if (bomb.age >= RULES.bombFallTime) {
        const hits = this.explode(
          bomb.x,
          bomb.z,
          bomb.weapon.explosion,
          bomb.weapon.damage,
          "ground",
        );
        this.bombsHit += Number(hits > 0);
        this.telemetry.record(this.elapsed, "bomb_impact", { hits });
        this.message(
          hits > 0 ? `直接命中 · ${hits} 个地面目标` : "投弹完成 · 落点无目标",
          2,
        );
        if (bomb.weapon.duration)
          this.fires.push({
            x: bomb.x,
            z: bomb.z,
            radius: bomb.weapon.explosion,
            life: bomb.weapon.duration,
            dps: bomb.weapon.burn,
          });
      }
    }
    this.bombs = this.bombs.filter((b) => b.age < RULES.bombFallTime);
    for (const fire of this.fires) {
      fire.life -= dt;
      for (const e of this.enemies)
        if (e.layer === "ground" && distance(e, fire) < fire.radius)
          this.damageEnemy(e, fire.dps * dt);
    }
    this.fires = this.fires.filter((f) => f.life > 0);
  }
  dropBomb() {
    this.telemetry.record(this.elapsed, "bomb_attempt", {
      stability: this.stability,
    });
    if (!this.canBomb) {
      this.message("准心尚未稳定或炸弹正在装填", 2);
      return false;
    }
    const p = this.player;
    this.bombs.push({
      x: this.aim.x,
      z: this.aim.z,
      startX: p.x,
      startZ: p.z,
      age: 0,
      weapon: this.bombWeapon,
    });
    this.bombCooldown = Math.max(
      1,
      1 / this.bombWeapon.fireRate +
        p.stats.bombCooldown +
        (1 - this.partFactor("bombBay")) * 2,
    );
    this.stability = 0.15;
    this.bombsDropped++;
    this.telemetry.record(this.elapsed, "bomb_drop");
    this.message("炸弹离舱", 1.2);
    return true;
  }
  pause() {
    if (this.phase === "battle" || this.phase === "bombing") {
      this.resumePhase = this.phase;
      this.phase = "paused";
      this.clock.timeScale = 0;
      this.clock.accumulator = 0;
      return true;
    }
    return false;
  }
  resume() {
    if (this.phase === "paused") {
      this.phase = this.resumePhase;
      this.clock.timeScale = 1;
      this.clock.accumulator = 0;
    }
  }
  end(reason = "retreat") {
    if (this.phase === "result" || this.phase === "dying") return;
    this.phase = reason === "aircraft_destroyed" ? "dying" : "result";
    this.clock.timeScale = this.phase === "dying" ? 1 : 0;
    this.telemetry.record(this.elapsed, "session_end", {
      reason,
      score: this.score,
      averageSpeed: this.averageSpeed,
      energyEmpty: this.energyEmptyCount,
      coins: this.coins,
    });
    if (this.phase === "dying")
      this.effect(this.player.x, this.player.z, "explosion", 1.2, 4);
  }
  message(text: string, time = 3) {
    this.notice = text;
    this.noticeTime = time;
  }
  effect(
    x: number,
    z: number,
    kind: Effect["kind"],
    life: number,
    radius: number,
    y = 4,
  ) {
    const e = this.effects.acquire();
    if (e)
      Object.assign(e, {
        x,
        z,
        y,
        kind,
        life,
        maxLife: life,
        radius,
        seed: this.random.next(),
      });
  }
  private updateEffects(dt: number) {
    for (const e of this.effects.items) {
      if (!e.active) continue;
      e.life -= dt;
      if (e.life <= 0) e.active = false;
    }
  }
}
