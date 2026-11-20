import { RULES } from "../data/config";
import {
  combatantById,
  type CombatantConfig,
  assertCombatantConfigIntegrity,
  npcProfileById,
} from "../data/combatants";
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
} from "../services/Random";
import { ObjectPool } from "../services/ObjectPool";
import { Telemetry } from "../services/Telemetry";
import { WindField } from "./WindField";
import { integrateAirActor } from "./FlightDynamics";
import {
  applyPartDamage,
  evaluateDamage,
  neutralDamage,
  repairPartsWithOverflow,
  stateFor,
  totalPartHealth,
  totalPartMaxHealth,
} from "./DamageModel";
import { hitEntity as hitCombatEntity } from "./HitTest";
import { HEALTH_SUPPLY, PICKUP } from "../data/pickups";
import { surfaceHeight as sampleSurfaceHeight } from "./Terrain";
import { separationTarget } from "./Separation";
import { createDefaultRoutes, nearestRouteDistance, routeHeading, routePosition } from "./Routes";
import { playerIntent } from "./Controllers";
import { partFromRecipe } from "./parts";
import {
  NO_INPUT,
  type CombatEntity,
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
  type WorldEvent,
  type PickupKind,
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
  readonly actors: CombatEntity[] = [];
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
    kind: "coin",
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
  private supplyTimer = 0;
  private supplyEnabled: boolean;
  private readonly eventQueue: WorldEvent[] = [];
  readonly events: readonly WorldEvent[] = this.eventQueue;
  notice = "第一关 · 翡翠海岸";
  noticeTime = 4;
  healPulse = 0;
  boostStatePulse = 0;
  readonly terrainSeed = 491;
  readonly routes = createDefaultRoutes(this.terrainSeed);

  constructor(
    frame: Airframe,
    seed = Date.now(),
    private options: { director?: boolean; supply?: boolean } = {},
  ) {
    this.supplyEnabled = options.supply ?? options.director !== false;
    this.random = new Random(seed);
    assertCombatantConfigIntegrity();
    const playerConfig = combatantById(frame.id);
    if (!playerConfig || playerConfig.layer !== "air" || playerConfig.frame.model !== "air")
      throw new Error(`missing air combatant config ${frame.id}`);
    this.player = {
      id: "player",
      configId: frame.id,
      factionId: "player",
      layer: "air",
      controllerId: "player-input",
      frame,
      x: 0,
      z: 0,
      prevX: 0,
      prevZ: 0,
      vx: 0,
      vz: playerConfig.frame.cruiseSpeed,
      heading: 0,
      turnVelocity: 0,
      bank: 0,
      rollVelocity: 0,
      speed: playerConfig.frame.cruiseSpeed,
      energy: playerConfig.frame.energyMax,
      health: frame.health,
      maxHealth: frame.health,
      damageTransfer: 0,
      hitFlash: 0,
      invulnerable: 0,
      stats: this.baseStats(frame, playerConfig),
      parts: [],
      weapons: [],
      upgrades: [],
      revision: 0,
      boost: 0,
      boosting: false,
      boostLocked: false,
      damage: neutralDamage(),
      partRevision: 0,
      damageRevision: 0,
    };
    const p = this.player;
    p.parts = this.partsFromConfig(playerConfig);
    for (const mount of playerConfig.mounts)
      if (mount.weaponId !== frame.bomb)
        this.addConfiguredWeapon(p, mount, playerConfig);
    this.syncPlayerHealth();
    if (frame.id === "wasp_04") p.stats.lockTime = -0.25;
    this.player.damage = evaluateDamage(this.player.parts);
    this.actors.push(this.player);
    this.telemetry.record(0, "session_start", { frame: frame.id, seed });
    // First encounter approaches from beyond the viewport; the opening coins teach steering.
    this.spawnEnemy("scout", -4, 38);
    this.spawnEnemy("hunter", 4, 46);
    this.supplyTimer = this.supplyEnabled
      ? this.random.range(HEALTH_SUPPLY.firstDelay[0], HEALTH_SUPPLY.firstDelay[1])
      : Number.POSITIVE_INFINITY;
    for (let i = 0; i < 6; i++)
      this.spawnPickup("coin", Math.sin(i * 0.4) * 1.6, 4 + i * 2.4, 1, 12);
  }
  private baseStats(f: Airframe, config?: CombatantConfig): Stats {
    const motion = config?.frame?.model === "air" ? config.frame : undefined;
    return {
      maxSpeed: motion?.maxSpeed ?? f.maxSpeed,
      acceleration: motion?.acceleration ?? f.acceleration,
      turnRate: motion?.turnRate ?? f.turnRate,
      energyMax: motion?.energyMax ?? f.energyMax,
      energyDrain: motion?.energyDrain ?? f.energyDrain,
      energyRecover: motion?.energyRecover ?? f.energyRecover,
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
  private partsFromConfig(config: CombatantConfig) {
    return config.parts.map((recipe) => {
      const part = partFromRecipe(recipe.id, {
        kind: recipe.kind ?? recipe.role,
        role: recipe.role,
        side: recipe.side,
        slot: recipe.slot,
        x: recipe.x,
        z: recipe.z,
        radius: recipe.radius,
        health: recipe.health,
        lift: recipe.lift,
        thrust: recipe.thrust,
        damageTransfer: recipe.damageTransfer,
        weight: recipe.weight,
        detachable: recipe.detachable,
      });
      part.visual = { ...(part.visual ?? { kind: part.kind, scale: 1, detachable: false }), detachable: false };
      return part;
    });
  }
  private addConfiguredWeapon(
    entity: Player | Enemy,
    mount: CombatantConfig["mounts"][number],
    config: CombatantConfig,
  ) {
    const weaponConfig = WEAPONS[mount.weaponId];
    if (!weaponConfig) return;
    const weapon: RuntimeWeapon = {
      config: { ...weaponConfig, count: mount.count, arc: mount.arc, ...(mount.overrides ?? {}) },
      partId: mount.partId,
      x: mount.x ?? 0,
      z: mount.z ?? 0,
      cooldown: entity === this.player ? 0 : this.random.range(1.5, 3.5),
      targetId: 0,
      lockProgress: 0,
      lockLost: false,
      heading: entity.heading + mount.baseAngle,
      baseAngle: mount.baseAngle,
    };
    const part = entity.parts.find((value) => value.id === mount.partId);
    if (!part) return;
    part.weaponIds = [...(part.weaponIds ?? []), weapon.config.id];
    entity.weapons.push(weapon);
    if (config.layer !== "air" && weapon.config.damage <= 0) entity.weapons.pop();
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
      addedMass: 0,
      role:
        kind === "bombBay"
          ? "bay"
          : kind === "wing" || kind === "winglet"
            ? "wing"
            : kind === "engine"
              ? "engine"
              : kind === "tail"
                ? "tail"
                : kind === "turret"
                  ? "turret"
                  : kind === "gun" || kind === "cannon"
                    ? "gun"
                    : kind === "radar"
                      ? "radar"
                      : "body",
      side: slot === "leftWing" ? -1 : slot === "rightWing" ? 1 : 0,
      lift: kind === "wing" || kind === "winglet" ? 1 : 0,
      thrust: kind === "engine" ? 1 : 0,
      weaponIds: [],
      damageTransfer: kind === "engine" ? 0.35 : kind === "wing" ? 0.5 : 1,
      state: "intact",
      disabled: false,
      visual: {
        kind,
        scale: 1,
        detachable: false,
      },
      detachSeed: id.length,
    };
  }
  private syncPlayerHealth() {
    this.player.health = totalPartHealth(this.player.parts);
    this.player.maxHealth = totalPartMaxHealth(this.player.parts);
    this.player.damageTransfer = this.player.stats.damageTransfer;
  }
  get playerMaxHealth() {
    return totalPartMaxHealth(this.player.parts);
  }
  private addWeapon(
    config: WeaponConfig,
    partId: string,
    x: number,
    z: number,
    baseAngle = 0,
  ) {
    const mount = this.player.parts.find((part) => part.id === partId);
    if (mount) mount.weaponIds = [...(mount.weaponIds ?? []), config.id];
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
  surfaceHeight(x: number, z: number) {
    return sampleSurfaceHeight(x, z, this.terrainSeed);
  }
  get isBombing() {
    return (
      this.phase === "bombing" ||
      (this.phase === "upgrade" && this.upgradeMode === "bombing")
    );
  }
  get bombWeapon() {
    const config = combatantById(this.player.configId);
    const mount = config?.mounts.find((value) => value.partId === "bay");
    const id = this.player.upgrades.includes("napalm") ? "napalm_bomb" : mount?.weaponId ?? this.player.frame.bomb;
    return WEAPONS[id];
  }
  get canBomb() {
    return (
      this.phase === "bombing" &&
      this.stability >= RULES.bombThreshold &&
      this.bombCooldown <= 0 &&
      this.player.damage.bombFactor > 0
    );
  }
  get mainLock() {
    return this.player.weapons.find((w) => w.config.lockTime > 0);
  }
  get averageSpeed() {
    return this.elapsed ? this.speedIntegral / this.elapsed : 0;
  }
  frame(dt: number, input: Intent = NO_INPUT) {
    if (this.clock.timeScale === 0) {
      this.clock.accumulator = 0;
      return;
    }
    this.eventQueue.length = 0;
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
    this.syncActorCollection();
    this.healPulse = Math.max(0, this.healPulse - dt);
    this.boostStatePulse = Math.max(0, this.boostStatePulse - dt);
    this.wind.update(dt);
    this.noticeTime = Math.max(0, this.noticeTime - dt);
    this.lockPulse = Math.max(0, this.lockPulse - dt);
    this.updatePlayer(dt, input);
    this.updateDirector(dt);
    this.updatePickupSupply(dt);
    this.updateEnemies(dt);
    this.updateWeapons(dt);
    this.updateProjectiles(dt);
    this.updatePickups(dt);
    this.updateBombing(dt, input);
    this.updateEffects(dt);
    this.speedIntegral += this.player.speed * dt;
    if (this.player.health <= 0) this.end("aircraft_destroyed");
  }
  consumeEvents() {
    const events = this.eventQueue.slice();
    this.eventQueue.length = 0;
    return events;
  }
  private syncActorCollection() {
    this.actors.length = 0;
    this.actors.push(this.player, ...this.enemies);
  }
  private emit(event: WorldEvent) {
    if (this.eventQueue.length >= 64) this.eventQueue.shift();
    this.eventQueue.push(event);
  }
  private updatePlayer(dt: number, input: Intent) {
    const p = this.player,
      s = p.stats;
    this.syncPlayerHealth();
    p.prevX = p.x;
    p.prevZ = p.z;
    p.invulnerable = Math.max(0, p.invulnerable - dt);
    p.hitFlash = Math.max(0, p.hitFlash - dt * 4);
    const nextDamage = evaluateDamage(p.parts);
    p.damage = nextDamage;
    p.damageRevision++;
    const edge = Math.hypot(p.x, p.z);
    const targetHeading = edge > RULES.boundary
      ? Math.atan2(-p.x, -p.z)
      : input.active
        ? Math.atan2(input.x, input.z)
        : p.heading;
    const throttle = input.active
      ? (input.travel === undefined ? input.magnitude : Math.min(1, input.travel / 0.74)) * (this.isBombing ? 0.45 : 1)
      : 0;
    const request = !this.isBombing && RULES.boost.enabled && input.active
      ? clamp(input.boost ?? 0)
      : 0;
    if (p.boostLocked && p.energy >= RULES.boost.rearm && request === 0)
      p.boostLocked = false;
    const previousBoosting = p.boosting;
    p.boosting = request > 0 && p.energy > 0 && !p.boostLocked;
    p.boost = p.boosting ? request : 0;
    if (p.boosting) {
      p.energy = Math.max(0, p.energy - s.energyDrain * p.boost * dt);
      if (p.energy <= 0) {
        p.energy = 0;
        p.boosting = false;
        p.boost = 0;
        p.boostLocked = true;
        this.energyEmptyCount++;
      }
    } else {
      p.energy = Math.min(s.energyMax, p.energy + s.energyRecover * dt);
    }
    if (p.boosting !== previousBoosting) {
      this.boostStatePulse = 0.25;
      this.telemetry.record(this.elapsed, "boost_state", { on: Number(p.boosting) });
    }
    if (p.energy < 0.5 && !this.energyWasEmpty) {
      this.energyEmptyCount++;
      this.energyWasEmpty = true;
    }
    if (p.energy > RULES.boost.rearm) this.energyWasEmpty = false;
    integrateAirActor(
      p,
      playerIntent({
        heading: targetHeading,
        throttle,
        boost: p.boost,
        fire: true,
        bomb: this.isBombing,
      }),
      {
        mass: p.frame.mass + p.parts.reduce((sum, part) => sum + part.addedMass, 0),
        wingspan: s.wingspan,
        wingArea: p.frame.wingArea,
        acceleration: s.acceleration,
        maxSpeed: s.maxSpeed,
        cruiseSpeed: p.frame.cruiseSpeed,
        turnRate: s.turnRate * (this.isBombing ? 0.65 : 1),
        speedMultiplier: RULES.boost.speedMultiplier,
        thrustMultiplier: RULES.boost.thrustMultiplier,
      },
      nextDamage,
      dt,
    );
    p.bank = clamp(p.bank + nextDamage.rollBias * dt * 2, -87.5 * RAD, 87.5 * RAD);
    const wind = this.wind.sample(p.x, p.z);
    p.vx += wind.x * s.windResponse;
    p.vz += wind.z * s.windResponse;
    p.x += wind.x * s.windResponse * dt;
    p.z += wind.z * s.windResponse * dt;
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
        p.health / this.playerMaxHealth < 0.35
          ? 1
          : 2 + Math.min(2, Math.floor(t / 70));
      const angle = p.heading + this.random.range(-1.1, 1.1);
      for (let i = 0; i < count; i++)
          this.spawnEnemy(
          this.random.pick(pool),
          p.x + Math.sin(angle) * (34 + i * 4) + (i - 1) * 3,
          p.z + Math.cos(angle) * (34 + i * 4),
            true,
        );
      this.spawnTimer = this.random.range(8, 12) * (airCount > 9 ? 1.5 : 1);
    }
    if (
      this.groundTimer <= 0 &&
      this.enemies.filter((e) => e.layer !== "air").length <
        RULES.maxGround - 2
    ) {
      const a = p.heading + this.random.range(-0.6, 0.6),
        d = this.random.range(34, 46);
      const kind =
        t < 30
          ? "resource"
          : t < 60
            ? this.random.pick(["aa_truck", "resource"])
            : this.random.pick(["aa_truck", "missile_truck", "resource", "depot"]);
      this.spawnEnemy(kind, p.x + Math.sin(a) * d, p.z + Math.cos(a) * d, true);
      this.groundTimer = t < 30 ? 10 : 7;
    }
    if (t >= this.eliteAt - 2 && t < this.eliteAt)
      this.message("大型信号接近 · 精英空艇", 2.1);
    if (t >= this.eliteAt) {
      this.spawnEnemy(
        "elite",
        p.x + Math.sin(p.heading) * 40,
        p.z + Math.cos(p.heading) * 40,
        true,
      );
      this.eliteAt += 90;
    }
    if (this.pickupTimer <= 0) {
      for (let i = 0; i < 5; i++) {
        const a = p.heading + Math.sin(i * 0.5) * 0.17,
          d = 9 + i * 2;
        this.spawnPickup("coin", p.x + Math.sin(a) * d, p.z + Math.cos(a) * d, 1, 9);
      }
      this.pickupTimer = 7;
    }
  }
  spawnEnemy(kind: string, x: number, z: number, safePlacement = false) {
    const profile = npcProfileById(kind);
    if (!profile) return;
    kind = profile.id;
    const config = combatantById(profile.combatantId);
    if (!config) return;
    const layerCount = this.enemies.filter((enemy) => enemy.layer === config.layer).length;
    const airOrdinary = this.enemies.filter((enemy) => enemy.layer === "air" && enemy.kind !== "elite").length;
    if (config.layer === "air" && (kind === "elite" ? layerCount >= RULES.maxEnemies + RULES.maxElite : airOrdinary >= RULES.maxEnemies)) return;
    if (config.layer !== "air" && layerCount >= RULES.maxGround) return;
    if (kind === "elite" && this.enemies.some((enemy) => enemy.kind === "elite")) return;
    if (this.enemies.length >= RULES.maxTotal) return;
    if (safePlacement) {
      const playerDistance = distance({ x, z }, this.player);
      if (playerDistance < 34 || playerDistance > 46) return;
      if (this.enemies.some((enemy) => enemy.layer === config.layer && distance({ x, z }, enemy) < 10)) return;
    }
    const parts = this.partsFromConfig(config);
    const totalHealth = totalPartHealth(parts);
    const totalMaxHealth = totalPartMaxHealth(parts);
    const weapons: RuntimeWeapon[] = [];
    const enemy: Enemy = {
      id: this.nextId++,
      kind,
      configId: config.id,
      profileId: profile.id,
      layer: config.layer,
      x,
      z,
      vx: 0,
      vz: 0,
      heading: Math.atan2(this.player.x - x, this.player.z - z),
      turnVelocity: 0,
      bank: 0,
      rollVelocity: 0,
      speed: config.frame.model === "air" ? config.frame.cruiseSpeed : config.frame.maxSpeed,
      health: totalHealth,
      maxHealth: totalMaxHealth,
      radius: config.combat.collisionRadius,
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
      state: "entering" as Enemy["state"],
      factionId: "enemy",
      controllerId: `npc:${profile.id}`,
      parts,
      weapons,
      damage: evaluateDamage(parts),
      damageTransfer: 0.7,
      partRevision: 0,
      damageRevision: 0,
      routeId: undefined,
      routeDistance: undefined,
      laneOffset: undefined,
    };
    for (const mount of config.mounts) this.addConfiguredWeapon(enemy, mount, config);
    const routeKind = profile.behavior.patrolRoute?.includes("water")
      ? "water"
      : profile.behavior.patrolRoute?.includes("rail")
        ? "rail"
        : "road";
    const routeCandidate = config.layer === "water"
      ? this.routes.find((candidate) => candidate.kind === "water")
      : routeKind === "rail"
        ? this.routes.find((candidate) => candidate.kind === "rail")
        : config.layer === "ground"
          ? this.routes.find((candidate) => candidate.kind === "road")
          : undefined;
    const candidateDistance = routeCandidate
      ? nearestRouteDistance(routeCandidate, x, z)
      : 0;
    const candidatePoint = routeCandidate
      ? routePosition(routeCandidate, candidateDistance)
      : undefined;
    const route = routeCandidate && candidatePoint && distance(candidatePoint, { x, z }) < 20
      ? routeCandidate
      : undefined;
    enemy.routeId = route?.id;
    enemy.routeDistance = route ? nearestRouteDistance(route, x, z) : undefined;
    enemy.laneOffset = route ? this.random.range(-0.55, 0.55) : undefined;
    const e = enemy;
    this.enemies.push(e);
    this.actors.push(e);
    return e;
  }
  private updateEnemies(dt: number) {
    const p = this.player;
    for (const e of [...this.enemies]) {
      const profile = npcProfileById(e.kind);
      const config = profile ? combatantById(profile.combatantId) : undefined;
      if (!profile || !config) continue;
      const behavior = profile.behavior,
        d = distance(e, p);
      e.age += dt;
      if (e.parts) e.damage = evaluateDamage(e.parts);
      e.flash = Math.max(0, e.flash - dt * 5);
      if (e.burn > 0) {
        e.burn -= dt;
        this.damageEnemy(e, dt * 12);
      }
      e.slow = Math.max(0, e.slow - dt);
      e.armorBreak = Math.max(0, e.armorBreak - dt);
      if (e.health <= 0) continue;
      let target = e.layer !== "air"
        ? e.heading + Math.sin(e.age * 0.23 + e.id) * 0.14
        : Math.atan2(p.x - e.x, p.z - e.z);
      if (e.layer === "air") {
        e.state =
          d > 22
            ? "entering"
            : e.health < e.maxHealth * 0.2
              ? "fleeing"
              : e.age % 9 > 5.5
                ? "breaking"
                : "attacking";
        if (e.state === "breaking") target += 1.15;
        if (e.state === "fleeing") target += Math.PI * 0.7;
        if (behavior.kind === "crossing") {
          target += d < 16 ? 1.5 : 0.3;
          if (e.age > 8 && !e.called) {
            e.called = true;
            this.spawnEnemy(
              "hunter",
              p.x + Math.sin(p.heading + 0.5) * 38,
              p.z + Math.cos(p.heading + 0.5) * 38,
              true,
            );
          }
        }
        if (behavior.kind === "standoff") target = Math.sin(e.age * 0.2) * 0.4 + Math.PI;
        if (behavior.kind === "escort") {
          const elite = this.enemies.find((v) => v.kind === "elite");
          if (elite)
            target = Math.atan2(
              elite.x + Math.sin(e.age) * 7 - e.x,
              elite.z + Math.cos(e.age) * 7 - e.z,
            );
        }
        if (e.kind === "elite") target += d < 17 ? 1.3 : 0;
      }
      if (e.layer === "air") {
        target = separationTarget(
          target,
          e,
          this.enemies.filter((other) => other.layer === "air" && other.health > 0),
        );
      }
      const targetSpeed =
        config.frame.maxSpeed *
        (e.damage ? e.damage.engineFactor : 1) *
        (e.slow > 0 ? 0.6 : 1) *
        (e.health < e.maxHealth * 0.4 ? 0.8 : 1) *
        (behavior.kind === "dive" && e.age % 7 < 1.2 ? 1.8 : 1);
      if (e.layer === "air") {
        e.speed = targetSpeed;
        const factor = Math.max(0.2, e.damage.engineFactor);
        integrateAirActor(
          e,
          {
            targetHeading: target,
            throttle: 0,
            boost: 0,
            fire: false,
            bomb: false,
            brake: false,
          },
          {
            mass: config.frame.model === "air" ? config.frame.mass : 100,
            wingspan: config.frame.model === "air" ? config.frame.wingspan : 1,
            wingArea: config.frame.model === "air" ? config.frame.wingArea : 1,
            acceleration: 0,
            maxSpeed: Math.max(0.1, targetSpeed / factor),
            cruiseSpeed: Math.max(0, targetSpeed / factor),
            turnRate: config.frame.turnRate,
            speedMultiplier: 1,
            thrustMultiplier: 1,
          },
          e.damage,
          dt,
        );
      } else {
        const route = e.routeId ? this.routes.find((candidate) => candidate.id === e.routeId) : undefined;
        if (route && e.routeDistance !== undefined) {
          e.routeDistance = (e.routeDistance + (e.speed * dt) / 12) % route.points.length;
          const point = routePosition(route, e.routeDistance);
          const heading = routeHeading(route, e.routeDistance);
          const side = e.laneOffset ?? 0;
          e.x = point.x + Math.cos(heading) * side;
          e.z = point.z - Math.sin(heading) * side;
          e.heading = heading;
          e.speed = damp(e.speed, targetSpeed, 1.5, dt);
          e.turnVelocity = 0;
          e.bank = 0;
          e.vx = Math.sin(e.heading) * e.speed;
          e.vz = Math.cos(e.heading) * e.speed;
        } else {
          const turnError = angleDelta(target, e.heading);
        const desiredTurn = clamp(turnError * 2.2, -config.frame.turnRate * RAD, config.frame.turnRate * RAD);
          e.turnVelocity = damp(e.turnVelocity, desiredTurn, 5, dt);
          e.heading = angleDelta(e.heading + e.turnVelocity * dt, 0);
          e.speed = damp(e.speed, targetSpeed, 1.5, dt);
          e.bank = 0;
          e.vx = Math.sin(e.heading) * e.speed;
          e.vz = Math.cos(e.heading) * e.speed;
          e.x += e.vx * dt;
          e.z += e.vz * dt;
        }
      }
      if (e.layer === "air" && d < e.radius + 0.7)
        this.damagePlayer(behavior.kind === "dive" ? 28 : 8, e.x, e.z, e.kind);
      e.cooldown -= dt;
      const angle = Math.abs(
        angleDelta(Math.atan2(p.x - e.x, p.z - e.z), e.heading),
      );
      const canAttack =
        config.combat.weaponDamage > 0 &&
        d < (e.layer !== "air" ? 30 : 22) &&
        (e.layer !== "air" || angle < 0.6 || e.kind === "elite");
      if (e.cooldown <= 0 && canAttack && e.warning === 0) {
        e.warning =
          e.layer !== "air" ? (e.kind === "missile_truck" ? 1.3 : 0.8) : 0.7;
        e.aimX = p.x + p.vx * 0.35;
        e.aimZ = p.z + p.vz * 0.35;
      }
      if (e.warning > 0) {
        e.warning -= dt;
        if (e.warning <= 0) {
          e.warning = 0;
          e.cooldown = config.combat.fireInterval * (e.health < e.maxHealth * 0.4 ? 1.5 : 1);
          const a = Math.atan2(e.aimX - e.x, e.aimZ - e.z);
          const weapon = e.weapons[0];
          const active = weapon && this.weaponMountActive(e, weapon);
          const count = active ? weapon.config.count : 0;
          if (weapon && active)
            this.fireWeaponSalvo(
              weapon,
              e.x,
              e.z,
              a,
              "enemy",
              0,
              e.layer !== "air" ? "flak" : "bullet",
              e.kind === "elite"
                ? (index, total) => a + (index * Math.PI * 2) / total
                : (index, total) => a + (index - (total - 1) / 2) * 0.075,
            );
          const eventType = e.layer !== "air" ? "ground_attack" : "enemy_fire";
          this.emit({
            type: eventType,
            time: this.elapsed,
            enemyId: e.id,
            heading: a,
            aimX: e.aimX,
            aimZ: e.aimZ,
            count,
            threat: Math.max(0, 1 - d / 45),
          });
          if (e.kind === "missile_truck")
            this.emit({
              type: "missile_lock_warning",
              time: this.elapsed,
              enemyId: e.id,
              heading: a,
              aimX: e.aimX,
              aimZ: e.aimZ,
              count,
              threat: Math.max(0, 1 - d / 45),
            });
        }
      }
    }
    this.enemies = this.enemies.filter(
      (e) => e.health > 0 && distance(e, p) < 85 && e.age < 65,
    );
    const live = new Set(this.enemies);
    for (let i = this.actors.length - 1; i > 0; i--)
      if (!live.has(this.actors[i] as Enemy)) this.actors.splice(i, 1);
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
      if (!part || !this.weaponMountActive(p, w)) {
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
  private weaponMountActive(entity: Pick<CombatEntity, "parts">, weapon: RuntimeWeapon) {
    const part = entity.parts.find((value) => value.id === weapon.partId);
    return Boolean(part && part.health > 0 && part.state !== "disabled" && !part.destroyed);
  }
  private fireWeaponSalvo(
    weapon: RuntimeWeapon,
    x: number,
    z: number,
    heading: number,
    team: "player" | "enemy",
    targetId = 0,
    kind?: Projectile["kind"],
    headingForShot?: (index: number, count: number) => number,
  ) {
    if (!weapon.config.count) return;
    for (let i = 0; i < weapon.config.count; i++) {
      const shotHeading = headingForShot
        ? headingForShot(i, weapon.config.count)
        : heading + (i - (weapon.config.count - 1) / 2) * weapon.config.spread * RAD;
      this.shoot(x, z, shotHeading, weapon.config, team, targetId, kind);
    }
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
        const hit = hitCombatEntity(this.player, v);
        if (hit) {
          v.active = false;
          this.damageEntity(this.player, hit.part, v.damage, v.x, v.z, v.kind, "player");
        }
      } else {
        for (const e of this.enemies) {
          if (e.layer !== "air" || e.health <= 0 || v.hitIds.includes(e.id))
            continue;
          const hit = hitCombatEntity(e, v);
          if (!hit) continue;
          this.damageEntity(e, hit.part, v.damage, v.x, v.z, "player", "enemy");
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
  private nearestPart(entity: { x: number; z: number; heading: number; parts: Part[] }, x: number, z: number) {
    const dx = x - entity.x;
    const dz = z - entity.z;
    const sin = Math.sin(entity.heading);
    const cos = Math.cos(entity.heading);
    const localX = dx * cos - dz * sin;
    const localZ = dx * sin + dz * cos;
    return entity.parts
      .filter((part) => part.health > 0 && part.state !== "destroyed" && part.state !== "disabled" && !part.destroyed)
      .sort((a, b) => Math.hypot(a.x - localX, a.z - localZ) - Math.hypot(b.x - localX, b.z - localZ))[0]
      ?? entity.parts.find((part) => part.health > 0) ?? entity.parts[0];
  }
  private damageEntity(
    entity: Player | Enemy,
    part: Part,
    amount: number,
    x: number,
    z: number,
    source: string,
    owner: "player" | "enemy",
  ) {
    if (entity.health <= 0) return;
    if (owner === "player" && this.player.invulnerable > 0) return;
    const damage = amount * (owner === "enemy" && "armorBreak" in entity && entity.armorBreak > 0 ? 1.25 : 1);
    const wasDisabled = part.health <= 0 || part.state === "disabled";
    const appliedDamage = Math.min(damage, Math.max(0, part.health));
    applyPartDamage(
      {
        health: entity.health,
        maxHealth: owner === "player" ? this.playerMaxHealth : (entity as Enemy).maxHealth,
        parts: entity.parts,
        damageTransfer: owner === "player" ? this.player.stats.damageTransfer : (entity as Enemy).damageTransfer ?? 0.7,
        partRevision: entity.partRevision,
        damageRevision: entity.damageRevision,
      },
      part,
      appliedDamage,
    );
    if (owner === "player") {
      this.syncPlayerHealth();
    } else {
      entity.health = Math.max(0, entity.health - appliedDamage);
    }
    entity.partRevision = (entity.partRevision ?? 0) + 1;
    entity.damageRevision = (entity.damageRevision ?? 0) + 1;
    part.state = stateFor(part);
    part.disabled = part.state === "disabled";
    if (part.state === "disabled" && !wasDisabled) {
      part.destroyed = false;
      this.emit({
        type: "part_disabled",
        time: this.elapsed,
        owner,
        entityId: entity === this.player ? "player" : (entity as Enemy).id,
        partId: part.id,
        label: part.slot === "leftWing" ? "左翼" : part.slot === "rightWing" ? "右翼" : part.kind,
      });
    }
    if (owner === "player") {
      const p = entity as Player;
      p.health = Math.max(0, p.health);
      this.damageTaken += appliedDamage;
      p.hitFlash = 1;
      p.invulnerable = RULES.invulnerability;
      this.stability *= 0.5;
      this.combo = 1;
      this.comboTimer = 0;
      this.effect(p.x, p.z, "hit", 0.45, 1);
      this.emit({ type: "player_hit", time: this.elapsed, amount: appliedDamage, source, part: part.id });
      this.telemetry.record(this.elapsed, "player_damage", { source, amount: appliedDamage, part: part.id });
    } else {
      const e = entity as Enemy;
      e.flash = 1;
      if (appliedDamage > 1)
        this.effect(x, z, "hit", 0.22, 0.5, e.layer !== "air" ? 0.6 : 4);
      this.emit({ type: "enemy_hit", time: this.elapsed, enemyId: e.id, amount: appliedDamage, part: part.id });
      if (e.health <= 0) this.finishEnemy(e);
    }
  }
  damagePlayer(
    amount: number,
    x = this.player.x,
    z = this.player.z,
    source = "unknown",
  ) {
    if (this.phase === "dying" || this.phase === "result") return;
    this.damageEntity(this.player, this.nearestPart(this.player, x, z), amount, x, z, source, "player");
  }
  damageEnemy(e: Enemy, damage: number, x = e.x, z = e.z) {
    if (e.health <= 0 || !e.parts) return;
    this.damageEntity(e, this.nearestPart(e, x, z), damage, x, z, "damage", "enemy");
  }
  private finishEnemy(e: Enemy) {
    if (e.health > 0) return;
    const profile = npcProfileById(e.kind);
    const config = profile ? combatantById(profile.combatantId) : undefined;
    if (!profile || !config) return;
    this.kills++;
    this.score += Math.round(profile.rewards.score * this.combo);
    this.awardXp(profile.rewards.xp);
    this.effect(
      e.x,
      e.z,
      e.layer !== "air" ? "ground" : "explosion",
      1,
      config.combat.collisionRadius * 2,
      e.layer !== "air" ? 0.3 : 4,
    );
    for (let i = 0; i < Math.min(profile.rewards.coins, 6); i++)
      this.spawnPickup(
        "coin",
        e.x + this.random.range(-1.5, 1.5),
        e.z + this.random.range(-1.5, 1.5),
        Math.ceil(profile.rewards.coins / 6),
        8,
      );
    for (const drop of profile.rewards.drops ?? [])
      if (drop === "repairLarge" || drop === "repairSmall") this.spawnPickup(drop, e.x, e.z);
    this.emit({
      type: "enemy_destroyed",
      time: this.elapsed,
      enemyId: e.id,
      kind: e.kind,
      score: Math.round(profile.rewards.score * this.combo),
      coins: profile.rewards.coins,
      combo: this.combo,
    });
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
      layer !== "air" ? "ground" : "explosion",
      1,
      radius,
      layer !== "air" ? 0.2 : 4,
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
  spawnPickup(kind: PickupKind, x: number, z: number, value?: number, xp?: number) {
    const item = this.pickups.acquire();
    if (item) {
      const spec = PICKUP[kind];
      Object.assign(item, {
        x,
        z,
        kind,
        value: value ?? spec.coinValue,
        xp: xp ?? spec.xp,
        life: spec.life,
      });
    }
  }
  spawnHealthPickup(kind: "repairSmall" | "repairLarge") {
    const p = this.player;
    const bearing = p.heading + this.random.range(-HEALTH_SUPPLY.bearingMax, HEALTH_SUPPLY.bearingMax);
    const range = kind === "repairLarge" ? HEALTH_SUPPLY.largeDistance : HEALTH_SUPPLY.smallDistance;
    const d = this.random.range(range[0], range[1]);
    this.spawnPickup(kind, p.x + Math.sin(bearing) * d, p.z + Math.cos(bearing) * d);
    this.telemetry.record(this.elapsed, "health_pickup_spawn", { kind, distance: d });
  }
  private updatePickupSupply(dt: number) {
    if (!this.supplyEnabled) return;
    this.supplyTimer -= dt;
    if (this.supplyTimer > 0) return;
    const activeHealth = this.pickups.items.filter(
      (item) => item.active && (item.kind === "repairSmall" || item.kind === "repairLarge"),
    ).length;
    if (activeHealth >= HEALTH_SUPPLY.fieldCap) {
      this.supplyTimer = HEALTH_SUPPLY.capRetry;
      return;
    }
    const ratio = this.player.health / this.playerMaxHealth;
    const base = this.random.range(HEALTH_SUPPLY.interval[0], HEALTH_SUPPLY.interval[1]);
    const factor = ratio < HEALTH_SUPPLY.critical
      ? HEALTH_SUPPLY.criticalFactor
      : ratio < HEALTH_SUPPLY.low
        ? HEALTH_SUPPLY.lowFactor
        : 1;
    const kind = this.random.next() < (ratio < HEALTH_SUPPLY.lowChanceThreshold ? HEALTH_SUPPLY.largeChanceLow : HEALTH_SUPPLY.largeChance)
      ? "repairLarge"
      : "repairSmall";
    this.spawnHealthPickup(kind);
    this.supplyTimer = Math.max(
      HEALTH_SUPPLY.minInterval,
      base * factor,
    );
    if (ratio < HEALTH_SUPPLY.critical && activeHealth === 0)
      this.supplyTimer = Math.min(this.supplyTimer, HEALTH_SUPPLY.pityDelay);
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
      const spec = PICKUP[c.kind];
      if (d < spec.magnetRadius) {
        const t = Math.min(1, dt * (5 + (spec.magnetRadius - d) * 3));
        c.x += (p.x - c.x) * t;
        c.z += (p.z - c.z) * t;
      }
      if (d < spec.pickupRadius) {
        c.active = false;
        if (c.kind === "coin") {
          this.coins += c.value;
          this.score += Math.round(c.value * 10 * this.combo);
          this.awardXp(c.xp);
          this.combo = Math.min(3, this.combo + 0.05);
          this.comboTimer = RULES.comboTimeout;
          this.effect(c.x, c.z, "coin", 0.4, 0.6, 4);
          this.emit({ type: "pickup", time: this.elapsed, kind: c.kind, amount: c.value });
        } else {
          const missing = this.playerMaxHealth - p.health;
          if (missing <= 0) {
            this.coins += spec.coinValue;
            this.score += spec.coinValue * 10;
            this.message(`部件已修复 · 转入 ${spec.coinValue} 金币`, 2);
          } else {
            const amount = Math.min(missing, this.playerMaxHealth * spec.healRatio);
            this.repairWithAmount(amount);
            this.awardXp(spec.xp);
            this.healPulse = 0.35;
            this.effect(c.x, c.z, "heal", 0.5, 0.8, 4);
            this.message(`${c.kind === "repairLarge" ? "大修理包" : "小修理包"} · +${Math.round(amount)} 修复量`, 2);
            this.emit({ type: "pickup", time: this.elapsed, kind: c.kind, amount });
          }
        }
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
    if (this.player.upgrades.includes("right_engine") && u.id === "left_engine")
      w *= 2;
    if (
      this.player.upgrades.includes("giant_wing") &&
      ["动力", "轰炸"].includes(u.tag)
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
    const p = this.player;
    p.upgrades.push(u.id);
    if (u.add)
      for (const [key, val] of Object.entries(u.add))
        p.stats[key as keyof Stats] += val;
    if (u.multiply)
      for (const [key, val] of Object.entries(u.multiply))
        p.stats[key as keyof Stats] *= val;
    // Newly installed parts enter at full local health and expand the total pool.
    p.health = Math.max(1, p.health);
    p.energy = Math.min(p.energy, p.stats.energyMax);
    const newlyAdded: Part[] = [];
    u.parts.forEach((recipe, i) => {
      const existing =
        u.max &&
        p.parts.find(
          (part) => part.id.startsWith(`${u.id}_`) && part.kind === recipe.kind,
        );
      if (existing) {
        if (!existing.destroyed)
          existing.health = Math.min(
            existing.maxHealth,
            existing.health + recipe.health * 0.3,
          );
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
      part.addedMass = part.weight * 10;
      if (part.kind !== "wing" && part.kind !== "winglet")
        part.visual = { ...(part.visual ?? { kind: part.kind, scale: 1, detachable: false }), detachable: false };
      p.parts.push(part);
      newlyAdded.push(part);
    });
    u.weapons?.forEach((id, i) => {
      if (id === "lock_missile" && this.mainLock) return;
      const part = newlyAdded[Math.min(i, newlyAdded.length - 1)];
      if (!part || part.destroyed) return;
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
    if (u.id === "modular_frame")
      for (const part of p.parts) {
        part.maxHealth *= 1.1;
        part.health *= 1.1;
      }
    this.syncPlayerHealth();
    p.revision++;
  }
  private repairWithAmount(amount: number) {
    repairPartsWithOverflow(this.player.parts, amount);
    this.syncPlayerHealth();
    this.player.revision++;
  }
  toggleBombing() {
    if (!["battle", "bombing"].includes(this.phase)) return;
    this.player.boosting = false;
    this.player.boost = 0;
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
        if (e.layer !== "air" && distance(e, fire) < fire.radius)
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
        (1 - this.player.damage.bombFactor) * 2,
    );
    this.stability = 0.15;
    this.bombsDropped++;
    this.telemetry.record(this.elapsed, "bomb_drop");
    this.message("炸弹离舱", 1.2);
    return true;
  }
  pause() {
    if (this.phase === "battle" || this.phase === "bombing") {
      this.eventQueue.length = 0;
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
