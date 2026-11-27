import { applyHoPanelLayout } from "./Ho229Layout";
import { RULES } from "../data/config";
import {
  combatAircraftFrame,
  combatantById,
  type CombatantConfig,
  assertCombatantConfigIntegrity,
  npcProfileById,
  type NpcProfile,
  type EraId,
} from "../data/combatants";
import { WEAPONS, type WeaponConfig, type TargetLayer } from "../data/weapons";
import { FOKKER_UPGRADES, HO229_UPGRADES, UPGRADES, refitStructureLength, upgradePrice, type Upgrade } from "../data/upgrades";
import type { Airframe } from "../data/aircrafts";
import { ERAS, missionEraOf } from "../data/eras";
import type { CampaignMission } from "../data/campaignMissions";
import { resolveMissionFrame, validateCampaignMissions } from "./MissionValidation";
import { MissionRun, type MissionOutcome } from "./MissionRun";
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
import { SortieEnvironment } from "./SortieEnvironment";
import { configuredFlight, integrateAirActor } from "./FlightDynamics";
import { addConfiguredWeapon, aircraftPreviewFire, configuredParts, createAirframeActor, weaponMountActive, weaponMuzzle } from "./AirframeActor";
import { localToWorld, mountOffset, partAnchor, type ActorPose } from "../content/3d/anchors";
import {
  applyPartDamage,
  evaluateDamage,
  repairPartsWithOverflow,
  stateFor,
  totalPartHealth,
  totalPartMaxHealth,
} from "./DamageModel";
import { hitEntity as hitCombatEntity, silhouetteExtent } from "./HitTest";
import { HEALTH_SUPPLY, PICKUP } from "../data/pickups";
import { isWater, surfaceHeight as sampleSurfaceHeight } from "./Terrain";
import { separationTarget } from "./Separation";
import { createDefaultRoutes, nearestRouteDistance, routeHeading, routeHeight, routePosition } from "./Routes";
import { npcIntent, playerIntent, type NetworkController } from "./Controllers";
import { partFromRecipe, refreshAirframeSilhouette } from "./parts";
import { applyCenterlineLayout, defaultTopology, lineExtension, mountForPart, mountForUpgrade } from "./CenterlineLayout";
import { legalUpgrades, refitWeaponForEra } from "./RefitRules";
import {
  NO_INPUT,
  type CombatEntity,
  type CombatSnapshot,
  type DamageType,
  type Player,
  type Stats,
  type Part,
  type Phase,
  type Intent,
  type Enemy,
  type RuntimeWeapon,
  type Projectile,
  type Pickup,
  type Bomb,
  type FireZone,
  type WorldEvent,
  type UpgradePreview,
  type UpgradeInstalledEvent,
  type PickupKind,
} from "./types";

export const requiredXp = (level: number) =>
  Math.floor(80 + level * 45 + Math.pow(level, 1.35) * 18);
export class WorldClock {
  elapsed = 0;
  timeScale = 1;
  accumulator = 0;
}
interface RefitLayout { wingspan: number; length: number }

export class World {
  readonly clock = new WorldClock();
  readonly random: Random;
  readonly telemetry = new Telemetry();
  readonly wind = new WindField();
  readonly environment: SortieEnvironment;
  environmentNotice = "";
  private environmentNoticeUntil = 0;
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
  private nextSpawnAttempt = 0;
  private nextMissionSpawnAttempt = 0;
  private boundaryTurn?: Intent["continuousTurn"];
  private readonly replayControllers = new Map<number, { profile: NpcProfile; controller: NetworkController }>();
  private pendingSpawns: { kind: string; bearing: number; expires: number }[] = [];
  isSpawnVisible?: (x: number, y: number, z: number, radius: number) => boolean;
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
      vy: 0,
      weaponId: "",
      damageType: "kinetic",
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
  selectedUpgradeId?: string;
  upgradePreview?: UpgradePreview;
  upgradeInstallation?: UpgradeInstalledEvent;
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
  private refitLayout: RefitLayout;
  private readonly eventQueue: WorldEvent[] = [];
  readonly events: readonly WorldEvent[] = this.eventQueue;
  notice: string;
  readonly era: EraId;
  readonly seed: number;
  readonly mission?: MissionRun;
  private readonly sortieWeapon?: WeaponConfig;
  private readonly refitEra: EraId;
  noticeTime = 4;
  healPulse = 0;
  boostStatePulse = 0;
  readonly terrainSeed = 491;
  readonly routes = createDefaultRoutes(this.terrainSeed);

  constructor(
    frame: Airframe,
    seed = Date.now(),
    private options: { director?: boolean; supply?: boolean; showroom?: boolean; missionEra?: EraId; mission?: CampaignMission } = {},
  ) {
    if (options.mission) {
      const issues = validateCampaignMissions([options.mission], this.routes);
      if (issues.length) throw new Error(issues.join("\n"));
      frame = resolveMissionFrame(options.mission, frame);
      this.mission = new MissionRun(options.mission);
      if (options.mission.loadout.temporary && options.mission.loadout.weaponId)
        this.sortieWeapon = WEAPONS[options.mission.loadout.weaponId];
    }
    this.environment = new SortieEnvironment(options.mission?.environment);
    this.wind.update(0, this.environment.weather);
    this.refitEra = missionEraOf(frame);
    this.era = options.mission?.era ?? options.missionEra ?? this.refitEra;
    this.refitLayout = { wingspan: frame.wingspan, length: frame.length };
    this.notice = ERAS[this.era].label + " · " + (this.mission?.mission.name ?? ERAS[this.era].mission);
    this.supplyEnabled = options.supply ?? options.director !== false;
    this.seed = seed;
    this.random = new Random(seed);
    assertCombatantConfigIntegrity();
    const playerConfig = combatantById(frame.id);
    if (!playerConfig || playerConfig.layer !== "air" || playerConfig.frame.model !== "air")
      throw new Error(`missing air combatant config ${frame.id}`);
    this.player = createAirframeActor(frame, playerConfig);
    const p = this.player;
    if (this.sortieWeapon?.category === "area" && !p.parts.some(({ id }) => id === "bay")) {
      const bay = this.part("bay", "bombBay", "bottom", 0, -.3, frame.health * .05);
      bay.parentId = "center_body";
      bay.weaponIds = [this.sortieWeapon.id];
      bay.centerline = mountForUpgrade("bomb_bay", bay, frame, p.parts);
      p.parts.push(bay);
    }
    refreshAirframeSilhouette(p.parts, p.stats.wingspan, p.stats.length, frame.engines === 4 ? .75 : .48, frame.wingCount ?? 1, frame.length, undefined, frame);
    this.applyPlayerCenterlineLayout();
    p.hitExtent = silhouetteExtent(p.parts);
    for (const mount of playerConfig.mounts)
      if (!options.mission?.loadout.exclusive && mount.weaponId !== frame.bomb)
        this.addConfiguredWeapon(p, mount, playerConfig);
    if (this.sortieWeapon && this.sortieWeapon.category !== "area") {
      const launcher = this.part("mission_launcher", "gun", "bottom", 0, .28, frame.health * .05);
      launcher.parentId = "center_body";
      launcher.centerline = mountForPart({ ...launcher, role: "gun" }, frame, { layer: "weapon" });
      p.parts.push(launcher);
      this.addConfiguredWeapon(p, {
        id: "mission-launcher", partId: launcher.id, weaponId: this.sortieWeapon.id, count: this.sortieWeapon.count,
        arc: this.sortieWeapon.arc, baseAngle: 0, targetLayers: this.sortieWeapon.targetLayers ?? ["air"], centerline: launcher.centerline,
      }, playerConfig);
      this.applyPlayerCenterlineLayout();
      p.hitExtent = silhouetteExtent(p.parts);
    }
    this.syncPlayerHealth();
    this.player.damage = evaluateDamage(this.player.parts);
    this.actors.push(this.player);
    this.telemetry.record(0, "session_start", { frame: frame.id, seed });
    this.updateMissionEncounters(true);
    // First encounter approaches from beyond the viewport; the opening coins teach steering.
    if (!options.showroom && !this.mission) ERAS[this.era].opening.forEach((kind, index) => {
      if (options.director === false) this.spawnEnemy(kind, index ? 4 : -4, index ? 46 : 38);
      else this.requestSpawn(kind, index ? .09 : -.10);
    });
    this.supplyTimer = this.supplyEnabled
      ? this.random.range(HEALTH_SUPPLY.firstDelay[0], HEALTH_SUPPLY.firstDelay[1])
      : Number.POSITIVE_INFINITY;
    if (!options.showroom) for (let i = 0; i < 6; i++)
      this.spawnPickup("coin", Math.sin(i * 0.4) * 1.6, 4 + i * 2.4, 1, 12);
  }
  private applyPlayerCenterlineLayout(player = this.player, layout = this.refitLayout) {
    const config = combatantById(player.configId);
    const topology = config?.topology ?? defaultTopology(player.frame);
    const wingExtension = Math.max(
      lineExtension(player.parts, "left-wing-0"),
      lineExtension(player.parts, "right-wing-0"),
    ) * 2;
    const statWingspan = Math.max(player.frame.wingspan, layout.wingspan);
    const scale = player.frame.wingspan > 0 ? statWingspan / player.frame.wingspan : 1;
    const structuralLength = lineExtension(player.parts, "fuselage") + lineExtension(player.parts, "tail");
    const statLength = Math.max(player.frame.length, layout.length);
    const adjusted = {
      ...topology,
      centerlines: topology.centerlines.map((line) => ({
        ...line,
        length: line.kind === "wing" ? line.length * scale : line.kind === "fuselage" ? Math.max(line.length, statLength) : line.length,
        nodes: line.tipStart === undefined ? line.nodes : line.nodes.map(node => ({ ...node, station: node.station * scale })),
        origin: line.kind === "wing" ? { ...line.origin, x: line.origin.x * scale } : line.origin,
      })),
    };
    applyCenterlineLayout(adjusted, player.parts);
    if (player.frame.geometryProfile === "fokkerDr1") {
      const extent = (side: number) => Math.max(...adjusted.centerlines
        .filter(line => line.kind === "wing" && line.side === side)
        .map(line => Math.abs(line.origin.x) + line.length + lineExtension(player.parts, line.id)));
      player.stats.wingspan = extent(-1) + extent(1);
    } else if (player.frame.geometryProfile === "ho229V2") {
      applyHoPanelLayout(player.parts, statWingspan);
      player.stats.wingspan = statWingspan + lineExtension(player.parts, "left-wing-0") + lineExtension(player.parts, "right-wing-0");
    } else player.stats.wingspan = statWingspan + wingExtension;
    player.stats.length = statLength + structuralLength;
  }
  private playerWingSpans(player: Player, layout: RefitLayout) {
    if (player.frame.geometryProfile === "fokkerDr1")
      return { left: layout.wingspan, right: layout.wingspan };
    return {
      left: layout.wingspan + lineExtension(player.parts, "left-wing-0") * 2,
      right: layout.wingspan + lineExtension(player.parts, "right-wing-0") * 2,
    };
  }
  private addConfiguredWeapon(entity: Player | Enemy, mount: CombatantConfig["mounts"][number], config: CombatantConfig) {
    addConfiguredWeapon(entity, mount, config.layer, () => entity === this.player ? 0 : this.random.range(1.5, 3.5));
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
    return partFromRecipe(id, { kind, slot, x, z, health, radius });
  }
  private syncPlayerHealth(player = this.player) {
    player.health = totalPartHealth(player.parts);
    player.maxHealth = totalPartMaxHealth(player.parts);
    player.damageTransfer = player.stats.damageTransfer;
  }
  get playerMaxHealth() {
    return totalPartMaxHealth(this.player.parts);
  }
  private addWeapon(
    player: Player,
    config: WeaponConfig,
    partId: string,
    baseAngle = 0,
  ) {
    const mount = player.parts.find((part) => part.id === partId);
    if (!mount) return;
    mount.weaponIds = [...(mount.weaponIds ?? []), config.id];
    player.weapons.push({
      config,
      anchorId: `${partId}:${config.id}`,
      partId,
      offset: player.frame.geometryProfile === "fokkerDr1" && mount.centerline?.insertion === "tip-before"
        ? { x: 0, y: .21, z: .56 }
        : mountOffset(mount, config),
      barrelSpacing: mount.role === "turret" ? .3 : .46,
      cooldown: 0,
      targetId: 0,
      lockProgress: 0,
      lockLost: false,
      heading: player.heading + baseAngle,
      baseAngle,
      centerline: mount.centerline,
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
      (this.phase === "paused" && this.resumePhase === "bombing") ||
      (this.phase === "upgrade" && this.upgradeMode === "bombing")
    );
  }
  get bombWeapon(): WeaponConfig | undefined {
    if (this.sortieWeapon?.category === "area") return this.sortieWeapon;
    const config = combatantById(this.player.configId);
    const mount = config?.mounts.find((value) => value.partId === "bay");
    if (this.player.upgrades.includes("napalm")) return WEAPONS[this.refitEra === "ww2" ? "ww2_incendiary" : "napalm_bomb"];
    if (!mount && this.player.upgrades.includes("bomb_bay"))
      return WEAPONS[this.refitEra === "pioneer" ? "pioneer_light_bomb" : this.refitEra === "ww1" ? "ww1_light_bomb" : this.refitEra === "ww2" ? "ww2_medium_bomb" : "gravity_bomb"];
    return mount ? WEAPONS[mount.weaponId] : undefined;
  }
  get canBomb() {
    return (
      this.phase === "bombing" &&
      !!this.bombWeapon &&
      this.stability >= RULES.bombThreshold &&
      this.bombCooldown <= 0 &&
      this.player.damage.bombFactor > 0 &&
      this.validBombAim
    );
  }
  get validBombAim() {
    const p = this.player;
    const dx = this.aim.x - p.x, dz = this.aim.z - p.z;
    const front = dx * Math.sin(p.heading) + dz * Math.cos(p.heading);
    const side = dx * Math.cos(p.heading) - dz * Math.sin(p.heading);
    return front >= 4 - 1e-6 && front <= 14 + 1e-6 &&
      Math.abs(side) <= front * Math.tan(10 * RAD) + 1e-6;
  }
  get mainLock() {
    return this.player.weapons.find((w) => w.config.lockTime > 0);
  }
  get averageSpeed() {
    return this.elapsed ? this.speedIntegral / this.elapsed : 0;
  }
  frame(dt: number, input: Intent | ((stepTime: number) => Intent) = NO_INPUT) {
    if (this.clock.timeScale === 0) {
      this.clock.accumulator = 0;
      return;
    }
    this.clock.accumulator += Math.min(RULES.maxFrame, Math.max(0, dt));
    let steps = 0;
    while (this.clock.accumulator >= RULES.step && steps++ < RULES.maxSteps) {
      const snapshot = typeof input === "function" ? input(this.elapsed + RULES.step) : input;
      this.step(RULES.step, snapshot);
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
    const environmentNotices = this.environment.update(this.elapsed, this.mission?.stage.id);
    if (environmentNotices.length) {
      this.environmentNotice = environmentNotices.join(" · ");
      this.environmentNoticeUntil = this.elapsed + 3;
    } else if (this.elapsed >= this.environmentNoticeUntil) this.environmentNotice = "";
    this.wind.update(dt, this.environment.weather);
    this.noticeTime = Math.max(0, this.noticeTime - dt);
    this.lockPulse = Math.max(0, this.lockPulse - dt);
    this.updatePlayer(dt, input);
    this.updateMissionEncounters();
    this.updateDirector(dt);
    this.updatePickupSupply(dt);
    this.updateEnemies(dt);
    this.updateWeapons(dt);
    this.updateProjectiles(dt);
    this.updatePickups(dt);
    this.updateBombing(dt, input);
    this.speedIntegral += this.player.speed * dt;
    if (this.player.health <= 0) {
      this.end("aircraft_destroyed");
    } else {
      this.updateMissionProgress();
    }
  }
  private updateMissionProgress() {
    const run = this.mission;
    if (!run) return;
    const previousStage = run.stage;
    const previousActors = [...run.targets.values()].flatMap(({ actor }) => actor ? [actor.id] : []);
    const result = run.advance(this.elapsed);
    if (result) this.end(result.outcome, result.detail);
    else if (run.stage !== previousStage) {
      this.enemies = this.enemies.filter((enemy) => !previousActors.includes(enemy.id) || run.targetFor(enemy.id));
      this.syncActorCollection();
      this.nextMissionSpawnAttempt = this.elapsed;
      this.message(run.stage.action);
    }
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
    p.prevHeading = p.heading;
    p.prevBank = p.bank;
    p.invulnerable = Math.max(0, p.invulnerable - dt);
    p.hitFlash = Math.max(0, p.hitFlash - dt * 4);
    const nextDamage = evaluateDamage(p.parts);
    p.damage = nextDamage;
    p.damageRevision++;
    const returningFromBoundary = Math.hypot(p.x, p.z) > RULES.boundary;
    const inputTurn = input.active ? input.continuousTurn : undefined;
    // A lock interrupted by auto-return stays cleared until the input changes.
    if (returningFromBoundary) this.boundaryTurn = inputTurn;
    else if (inputTurn !== this.boundaryTurn) this.boundaryTurn = undefined;
    const targetHeading = returningFromBoundary
      ? Math.atan2(-p.x, -p.z)
      : input.active
        ? Math.atan2(input.x, input.z)
        : p.heading;
    const throttle = input.active
      ? clamp(input.travel ?? input.magnitude) * (this.isBombing ? 0.45 : 1)
      : 0;
    const request = !this.isBombing && RULES.boost.enabled && input.active
      ? clamp(input.boost ?? 0)
      : 0;
    const previousBoosting = p.boosting;
    const wingRetention = Math.min(nextDamage.liftLeft, nextDamage.liftRight);
    const bombingBank = (17 + 18 * clamp((p.frame.turnRate - 145) / 160)) * RAD *
      Math.min(1, wingRetention, nextDamage.response);
    integrateAirActor(
      p,
      playerIntent({
        heading: targetHeading,
        continuousTurn: inputTurn === this.boundaryTurn ? undefined : inputTurn,
        throttle,
        boost: request,
        fire: true,
        bomb: this.isBombing,
      }),
      configuredFlight({
        mass: p.frame.mass,
        wingspan: s.wingspan,
        wingArea: p.frame.wingArea,
        acceleration: s.acceleration,
        maxSpeed: s.maxSpeed,
        cruiseSpeed: p.frame.cruiseSpeed,
        turnRate: s.turnRate * (this.isBombing ? 0.65 : 1),
        bankLimit: this.isBombing ? bombingBank : undefined,
        energyMax: s.energyMax,
        energyDrain: s.energyDrain,
        energyRecover: s.energyRecover,
        windResponse: s.windResponse,
      }, p.parts),
      nextDamage,
      dt,
      this.wind,
    );
    if (p.boosting !== previousBoosting) {
      this.boostStatePulse = 0.25;
      this.telemetry.record(this.elapsed, "boost_state", { on: Number(p.boosting) });
    }
    if (p.energy === 0 && !this.energyWasEmpty) {
      this.energyEmptyCount++;
      this.energyWasEmpty = true;
    }
    if (p.energy >= RULES.boost.rearm) this.energyWasEmpty = false;
  }
  private updateMissionEncounters(preflight = false) {
    if (!this.mission || this.elapsed < this.nextMissionSpawnAttempt) return;
    if (!preflight) this.nextMissionSpawnAttempt = this.elapsed + .25;
    for (const target of this.mission.pending(this.elapsed)) {
      const place = target.config.placement;
      let actor: Enemy | undefined;
      if ("at" in place) {
        actor = this.spawnEnemy(target.config.kind, place.at.x, place.at.z, "placed");
      } else if ("bearing" in place) {
        if (preflight) continue;
        actor = this.spawnFromBearing(target.config.kind, this.player.heading + place.bearing, "required");
      } else {
        const route = this.routes.find((candidate) => candidate.id === place.route)!;
        const point = routePosition(route, place.distance);
        actor = this.spawnEnemy(target.config.kind, point.x, point.z, "placed");
        if (actor) {
          actor.routeId = route.id;
          actor.routeDistance = place.distance;
          actor.heading = routeHeading(route, place.distance);
        }
      }
      if (actor) {
        if (target.config.friendly) {
          actor.factionId = "player";
          actor.weapons.length = 0;
        }
        const { health, weaponId } = target.config;
        if (health !== undefined) {
          const scale = health / actor.maxHealth;
          for (const part of actor.parts) {
            part.health *= scale;
            part.maxHealth *= scale;
          }
          actor.health = actor.maxHealth = health;
        }
        if (weaponId) {
          const weapon = WEAPONS[weaponId];
          const config = combatantById(actor.configId!)!;
          const part = weapon.category === "area"
            ? actor.parts.find(candidate => candidate.role === "bay")?.id ?? "center_body"
            : config.mounts[0]?.partId ?? "center_body";
          actor.weapons.length = 0;
          this.addConfiguredWeapon(actor, {
            id: "mission-attack", partId: part, weaponId, count: 1, arc: 48, baseAngle: 0,
            targetLayers: weapon.targetLayers ?? ["air"],
            overrides: { damage: 35, range: 35 }, offset: { x: 0, y: -.15, z: .4 },
          }, config);
        }
        const waypoint = target.motion?.points[0];
        if (waypoint && actor.layer === "air" && actor.kind !== "recon_balloon")
          actor.heading = Math.atan2(waypoint.x - actor.x, waypoint.z - actor.z);
        this.mission.bind(target, actor, this.elapsed);
      }
    }
  }

  private updateDirector(dt: number) {
    if (this.options.director === false || this.mission && !this.mission.stage.ambient) return;
    const p = this.player,
      t = this.elapsed;
    this.spawnTimer -= dt;
    this.groundTimer -= dt;
    this.pickupTimer -= dt;
    const plan = ERAS[this.era];
    const phase = t < 30 ? "intro" : t < 60 ? "skirmish" : t < 110 ? "pressure" : "mixed";
    if (this.spawnTimer <= 0) {
      const pool = plan.air.filter((id) => npcProfileById(id, this.era)?.spawn.phases.includes(phase));
      const count = p.health / this.playerMaxHealth < .35 ? 1 : 2 + Math.min(2, Math.floor(t / 70));
      const bearing = p.heading + this.random.range(-1.1, 1.1);
      const tailKind = pool.includes("hunter") ? "hunter" : pool.find((id) => npcProfileById(id, this.era)?.behavior.kind === "chase");
      for (let index = 0; index < count && pool.length; index++) {
        const kind = index === 0 && tailKind ? tailKind : this.random.pick(pool);
        const profile = npcProfileById(kind, this.era);
        const approach = profile?.behavior.kind === "chase"
          ? Math.PI + (index - (count - 1) / 2) * .18
          : bearing - p.heading + (index - (count - 1) / 2) * .24;
        this.requestSpawn(kind, p.heading + approach);
      }
      this.spawnTimer = this.random.range(8, 12);
    }
    if (this.groundTimer <= 0) {
      const pool = plan.surface.filter((id) => npcProfileById(id, this.era)?.spawn.phases.includes(phase));
      if (pool.length) {
        const kind = this.random.pick(pool);
        const profile = npcProfileById(kind, this.era)!;
        const count = profile.behavior.kind === "convoy" && kind !== "armored_train" && kind !== "supply_train" ? 2 : 1;
        const bearing = p.heading + this.random.range(-.55, .55);
        for (let index = 0; index < count; index++) this.requestSpawn(kind, bearing + index * .22);
      }
      this.groundTimer = t < 30 ? 10 : 7;
    }
    if (plan.elite.length && t >= this.eliteAt) {
      this.requestSpawn(this.random.pick(plan.elite), p.heading);
      this.eliteAt += 90;
    }
    if (t >= this.nextSpawnAttempt) {
      this.nextSpawnAttempt = t + .35;
      this.placePendingSpawns(t);
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
  private placePendingSpawns(t: number) {
    this.pendingSpawns = this.pendingSpawns.filter((request) => {
      if (request.expires < t) return false;
      const profile = npcProfileById(request.kind, this.era);
      const config = profile && combatantById(profile.combatantId);
      if (!profile || !config || !this.hasSpawnBudget(profile, config.layer)) return true;
      return !this.spawnFromBearing(request.kind, request.bearing, true);
    });
  }
  private spawnFromBearing(kind: string, bearing: number, mode: true | "required") {
    const p = this.player;
    // Search beyond the current camera when a candidate remains visible at nominal range.
    for (const range of [36, 42, 46, 54, 64, 76]) {
      for (const offset of [0, -.34, .34, -.85, .85, Math.PI]) {
        const angle = bearing + offset;
        const x = p.x + Math.sin(angle) * range, z = p.z + Math.cos(angle) * range;
        if (mode === "required" && Math.hypot(x, z) >= RULES.boundary) continue;
        const actor = this.spawnEnemy(kind, x, z, mode);
        if (actor) return actor;
      }
    }
  }
  private requestSpawn(kind: string, bearing: number) {
    if (this.pendingSpawns.length < 28)
      this.pendingSpawns.push({ kind, bearing, expires: this.elapsed + 20 });
  }
  private hasSpawnBudget(profile: NpcProfile, layer: TargetLayer, required = false) {
    const active = this.enemies.filter((enemy) => enemy.health > 0);
    const grouped = active.filter((enemy) =>
      layer === "air"
        ? enemy.layer === "air" && !!npcProfileById(enemy.kind, this.era)?.elite === !!profile.elite
        : enemy.layer !== "air",
    );
    const cap = layer === "air"
      ? profile.elite ? RULES.maxElite : ERAS[this.era].caps.air
      : ERAS[this.era].caps.surface;
    const slots = grouped.reduce((sum, enemy) => sum + (npcProfileById(enemy.kind, this.era)?.spawn.slotCost ?? 1), 0);
    const reserved = required ? undefined : this.mission?.reserve(profile, layer);
    return active.length + (reserved?.total ?? 0) < RULES.maxTotal &&
      slots + profile.spawn.slotCost + (reserved?.slots ?? 0) <= cap &&
      grouped.filter((enemy) => enemy.profileId === profile.id).length + (reserved?.sameProfile ?? 0) < profile.spawn.maxAlive;
  }
  spawnEnemy(kind: string, x: number, z: number, safety: boolean | "required" | "placed" = false) {
    const profile = npcProfileById(kind, this.era);
    if (!profile) return;
    kind = profile.kind ?? kind;
    const config = combatantById(profile.combatantId);
    if (!config) return;
    if (!this.hasSpawnBudget(profile, config.layer, typeof safety === "string")) return;
    const route = safety !== "placed" && profile.behavior.targetPolicy === "route"
      ? this.routes.find((candidate) => candidate.id === profile.behavior.patrolRoute)
      : undefined;
    const routeDistance = route ? nearestRouteDistance(route, x, z) : undefined;
    if (route && routeDistance !== undefined) {
      const point = routePosition(route, routeDistance);
      x = point.x;
      z = point.z;
    }
    if (safety) {
      const radius = config.combat.collisionRadius;
      const playerDistance = distance({ x, z }, this.player);
      if (safety === "placed" ? playerDistance < radius + 4 : playerDistance < 32 || playerDistance > 78) return;
      if (safety !== "placed" && this.isSpawnVisible?.(x, (config.layer === "air" ? RULES.flightAltitude : this.surfaceHeight(x, z) + 1), z, radius * 1.7 + 2))
        return;
      if (this.enemies.some((enemy) => enemy.health > 0 && (enemy.layer === "air") === (config.layer === "air") &&
          distance({ x, z }, enemy) < Math.max(7, radius + enemy.radius + 2))) return;
    }
    const enemy = this.createOpponent(profile, config, kind, x, z);
    enemy.routeId = route?.id;
    enemy.routeDistance = routeDistance;
    return enemy;
  }

  previewFire() {
    for (const event of aircraftPreviewFire(this.player, this.actorPose(this.player), this.elapsed)) this.emit(event);
  }

  spawnReplayOpponent(frame: Airframe, controller: NetworkController, x: number, z: number) {
    const config = combatantById(frame.id);
    if (!config || config.frame.model !== "air") throw new Error("Unknown replay airframe " + frame.id);
    const profile: NpcProfile = {
      id: "replay:" + frame.id, combatantId: frame.id,
      behavior: { kind: "chase", targetPolicy: "player", preferredRange: [0, 40],
        engageRadius: 40, disengageRange: 60, leadTime: .35, breakChance: 0 },
      spawn: { phases: [], weight: 0, maxAlive: 1, slotCost: 1 },
      rewards: { xp: 0, coins: 0, score: 0 },
    };
    const enemy = this.createOpponent(profile, config, frame.id, x, z);
    enemy.controllerId = profile.id;
    this.replayControllers.set(enemy.id, { profile, controller });
    return enemy;
  }

  private createOpponent(profile: NpcProfile, config: CombatantConfig, kind: string, x: number, z: number) {
    const frame = combatAircraftFrame(config.visual.modelKey);
    const parts = configuredParts(config, frame);
    if (frame) {
      refreshAirframeSilhouette(parts, frame.wingspan, frame.length, frame.engines === 4 ? .75 : .48,
        frame.wingCount ?? 1, frame.length, undefined, frame);
      if (config.topology) {
        applyCenterlineLayout(config.topology, parts);
        if (frame.geometryProfile === "ho229V2") applyHoPanelLayout(parts, frame.wingspan);
      }
    }
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
      energy: config.frame.model === "air" ? config.frame.energyMax : 0,
      boost: 0,
      boosting: false,
      boostLocked: false,
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
      phaseTime: 0,
      breakHeading: 0,
      attackWindow: 0,
      tailAttack: false,
      attackTargetHeading: 0,
      breakWindow: 0,
      factionId: "enemy",
      controllerId: `npc:${profile.id}`,
      parts,
      weapons,
      damage: evaluateDamage(parts),
      damageTransfer: 0.7,
      partRevision: 0,
      hitExtent: silhouetteExtent(parts),
      damageRevision: 0,
      routeId: undefined,
      routeDistance: undefined,
      laneOffset: undefined,
    };
    for (const mount of config.mounts)
      if (WEAPONS[mount.weaponId].category !== "area") this.addConfiguredWeapon(enemy, mount, config);
    this.enemies.push(enemy);
    this.actors.push(enemy);
    return enemy;
  }
  private updateEnemies(dt: number) {
    const p = this.player;
    for (const e of [...this.enemies]) {
      const replay = this.replayControllers.get(e.id);
      const profile = replay?.profile ?? npcProfileById(e.kind, this.era);
      const config = profile ? combatantById(profile.combatantId) : undefined;
      if (!profile || !config) continue;
      const missionTarget = this.mission?.targetFor(e.id);
      const assigned = missionTarget?.config.attacks && this.mission?.targets.get(missionTarget.config.attacks)?.actor;
      const defender = assigned && assigned.health > 0 && e.weapons.some(
        (weapon) => this.isWeaponTarget(e.factionId ?? "enemy", assigned, weapon.config.targetLayers),
      ) ? assigned : p;
      const behavior = profile.behavior, d = distance(e, defender);
      e.prevX = e.x;
      e.prevZ = e.z;
      e.prevHeading = e.heading;
      e.prevBank = e.bank;
      e.age += dt;
      if (e.parts) e.damage = evaluateDamage(e.parts);
      e.flash = Math.max(0, e.flash - dt * 5);
      if (e.burn > 0) {
        e.burn -= dt;
        this.damageEnemy(e, dt * 12, undefined, undefined, "fire");
      }
      e.slow = Math.max(0, e.slow - dt);
      e.armorBreak = Math.max(0, e.armorBreak - dt);
      if (e.health <= 0) continue;
      const anchor = behavior.escortAnchorTag
        ? this.enemies.find((other) => other.id !== e.id && other.health > 0 &&
            combatantById(other.configId ?? other.kind)?.tags.includes(behavior.escortAnchorTag!))
        : undefined;
      const previousState = e.state;
      const intent = replay?.controller.sample(this.elapsed) ?? npcIntent(
        profile, e, defender, e.age, anchor, config.frame.model === "air" ? config.frame : undefined, dt,
      );
      if (previousState !== e.state) this.telemetry.record(this.elapsed, "air_phase", { enemy: e.id, phase: e.state });
      if (replay) e.state = intent.fire ? "attacking" : "cruising";
      let target = intent.targetHeading ?? e.heading;
      if (e.layer === "air" && !replay)
        target = separationTarget(target, e, this.enemies.filter((other) => other.layer === "air" && other.health > 0));
      if (profile.reinforcement && !e.called && e.age > 8 && this.options.director !== false) {
        e.called = true;
        this.requestSpawn(profile.reinforcement, p.heading + .5);
      }
      const speedFactor = e.slow > 0 ? .6 : 1;
      const targetMotion = missionTarget;
      if (targetMotion?.motion) {
        const motion = targetMotion.motion;
        const point = motion.points[targetMotion.waypoint];
        const gap = point ? distance(e, point) : 0;
        const bearing = point && gap > 0 ? Math.atan2(point.x - e.x, point.z - e.z) : e.heading;
        const aircraft = config.frame.model === "air" && e.kind !== "recon_balloon" && motion.speed > 0;
        if (aircraft && config.frame.model === "air") {
          const flight = configuredFlight(config.frame, e.parts);
          const throttle = (motion.speed - flight.cruiseSpeed) / Math.max(.1, flight.maxSpeed - flight.cruiseSpeed);
          integrateAirActor(e, { ...intent, targetHeading: point ? bearing : target, throttle: point ? clamp(throttle) : intent.throttle },
            flight, e.damage, dt, this.wind, speedFactor);
        } else {
          e.heading = bearing;
          e.speed = Math.min(motion.speed * speedFactor, gap / dt);
          e.vx = Math.sin(bearing) * e.speed;
          e.vz = Math.cos(bearing) * e.speed;
          e.x += e.vx * dt;
          e.z += e.vz * dt;
        }
        if (point && gap <= (aircraft ? Math.max(1.2, e.speed * .35) : motion.speed * speedFactor * dt)) {
          targetMotion.waypoint++;
          if (motion.loop) targetMotion.waypoint %= motion.points.length;
        }
      } else if (config.frame.model === "air") {
        integrateAirActor(
          e,
          {
            ...intent,
            targetHeading: target,
          },
          configuredFlight(config.frame, e.parts),
          e.damage,
          dt,
          this.wind,
          speedFactor,
        );
      } else {
        const targetSpeed = config.frame.maxSpeed * e.damage.engineFactor * speedFactor;
        const route = e.routeId ? this.routes.find((candidate) => candidate.id === e.routeId) : undefined;
        if (route && e.routeDistance !== undefined) {
          const shuttle = missionTarget?.config.shuttle;
          const direction = missionTarget?.routeDirection ?? 1;
          const routeSpeed = shuttle ? shuttle.speed * speedFactor * e.damage.engineFactor : targetSpeed;
          const travel = (shuttle ? routeSpeed : e.speed) * dt;
          for (const other of this.enemies) {
            if (other === e || other.routeId !== route.id || other.routeDistance === undefined || other.health <= 0) continue;
            const gap = route.loop ? (other.routeDistance - e.routeDistance + route.length) % route.length
              : (other.routeDistance - e.routeDistance) * direction;
            if (gap > 0) e.speed = Math.min(e.speed, Math.max(0, (gap - e.radius - other.radius - 2) / dt));
          }
          e.routeDistance += direction * (shuttle ? travel : Math.min(travel, e.speed * dt));
          if (shuttle && missionTarget && missionTarget.initialRouteDistance !== undefined) {
            if (e.routeDistance >= shuttle.end) missionTarget.routeDirection = -1;
            if (e.routeDistance <= missionTarget.initialRouteDistance) missionTarget.routeDirection = 1;
            e.routeDistance = clamp(e.routeDistance, missionTarget.initialRouteDistance, shuttle.end);
          }
          if (route.loop) e.routeDistance %= route.length;
          else if (e.routeDistance >= route.length) {
            e.age = 66;
            continue;
          }
          const point = routePosition(route, e.routeDistance);
          const heading = routeHeading(route, e.routeDistance) + (direction < 0 ? Math.PI : 0);
          const side = e.laneOffset ?? 0;
          e.x = point.x + Math.cos(heading) * side;
          e.z = point.z - Math.sin(heading) * side;
          e.heading = heading;
          e.speed = damp(e.speed, routeSpeed, 1.5, dt);
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
      if (e.factionId !== "player" && e.layer === "air" && e.kind !== "recon_balloon" &&
          distance(e, p) < e.radius + 0.7 && targetMotion?.motion?.speed !== 0)
        this.damagePlayer(behavior.kind === "dive" ? 28 : 8, e.x, e.z, e.kind);
      e.cooldown -= dt;
      const aimX = intent.attackPoint?.x ?? intent.targetPoint?.x ?? defender.x + defender.vx * .35;
      const aimZ = intent.attackPoint?.z ?? intent.targetPoint?.z ?? defender.z + defender.vz * .35;
      const angle = Math.abs(angleDelta(Math.atan2(aimX - e.x, aimZ - e.z), e.heading));
      const aimWithinWeapon = (weapon: RuntimeWeapon) =>
        weaponMountActive(e.parts, weapon) && this.isWeaponTarget(e.factionId ?? "enemy", defender, weapon.config.targetLayers) && d <= weapon.config.range &&
        (e.layer !== "air" || profile.radial || angle <=
          (weapon.config.category === "turret" ? weapon.config.turretArc : weapon.config.arc) * RAD / 2);
      const canAttack = intent.fire && e.weapons.some(aimWithinWeapon);
      if (e.layer === "air" && !canAttack) e.warning = 0;
      if (e.cooldown <= 0 && canAttack && e.warning === 0) {
        e.warning =
          e.layer !== "air" ? (e.weapons.some((weapon) => weapon.config.homing > 0) ? 1.3 : 0.8) : 0.35;
        e.aimX = aimX;
        e.aimZ = aimZ;
      }
      if (e.warning > 0) {
        if (e.layer === "air") {
          e.aimX = aimX;
          e.aimZ = aimZ;
        }
        e.warning -= dt;
        if (e.warning <= 0) {
          e.warning = 0;
          e.cooldown = config.combat.fireInterval * (e.health < e.maxHealth * 0.4 ? 1.5 : 1);
          const a = Math.atan2(e.aimX - e.x, e.aimZ - e.z);
          const weapons = e.weapons.filter(aimWithinWeapon);
          let count = 0;
          for (const weapon of weapons) {
            count += this.fireWeaponSalvo(
              e, weapon, a, defender,
              weapon.config.homing ? "missile" : e.layer !== "air" ? "flak" : "bullet",
              profile.radial ? (index, total) => a + index * Math.PI * 2 / total : undefined,
            );
          }
          const eventType = e.layer !== "air" ? "ground_attack" : "enemy_fire";
          if (count > 0) this.emit({
            type: eventType,
            time: this.elapsed,
            enemyId: e.id,
            heading: a,
            aimX: e.aimX,
            aimZ: e.aimZ,
            count,
            threat: Math.max(0, 1 - d / 45),
          });
          if (count > 0 && weapons.some((weapon) => weapon.config.homing > 0))
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
      (e) => e.health > 0 && (this.mission?.targetFor(e.id) || distance(e, p) < 85 && e.age < 65),
    );
    const live = new Set(this.enemies);
    const activeIds = new Set(this.enemies.map((enemy) => enemy.id));
    for (const id of this.replayControllers.keys())
      if (!activeIds.has(id)) this.replayControllers.delete(id);
    for (let i = this.actors.length - 1; i > 0; i--)
      if (!live.has(this.actors[i] as Enemy)) this.actors.splice(i, 1);
  }
  private isWeaponTarget(factionId: string, actor: CombatEntity, layers: WeaponConfig["targetLayers"]) {
    return actor.factionId !== factionId && actor.health > 0 && (layers ?? ["air"]).includes(actor.layer);
  }
  private updateWeapons(dt: number) {
    const p = this.player;
    for (const w of p.weapons) {
      const part = p.parts.find((v) => v.id === w.partId),
        c = w.config;
      w.cooldown = Math.max(0, w.cooldown - dt);
      if (!part || !weaponMountActive(p.parts, w)) {
        w.lockProgress = 0;
        w.targetId = 0;
        continue;
      }
      const lockTime = c.lockTime > 0 ? Math.max(.15, c.lockTime + p.stats.lockTime) : 0;
      w.heading = p.heading + w.baseAngle;
      if (w.cooldown > 0 && !lockTime) continue;

      // Use the center of the barrel group to check this mount's firing arc.
      const origin = this.weaponMuzzle(p, w, (c.count - 1) / 2);
      if (!origin) continue;
      const arcHeading = Math.atan2(origin.direction.x, origin.direction.z);
      const halfArc = c.arc * RAD / 2;
      let target: Enemy | undefined;
      let targetDistance = Infinity;
      let targetAngle = Infinity;
      for (const enemy of this.enemies) {
        if (!this.isWeaponTarget(p.factionId, enemy, c.targetLayers)) continue;
        const range = distance(origin, enemy);
        if (range > c.range) continue;
        const bearing = Math.atan2(enemy.x - origin.x, enemy.z - origin.z);
        const angle = Math.abs(angleDelta(bearing, arcHeading));
        if (angle > halfArc) continue;
        if (lockTime && enemy.id === w.targetId) {
          target = enemy;
          targetDistance = range;
          break;
        }
        if (angle > targetAngle || (angle === targetAngle && range >= targetDistance)) continue;
        target = enemy;
        targetDistance = range;
        targetAngle = angle;
      }
      if (lockTime) {
        if (!target || (w.targetId && w.targetId !== target.id && w.lockProgress > 0)) {
          w.lockLost = w.lockProgress > 0;
          w.lockProgress = Math.max(0, w.lockProgress - c.lossRate * dt);
          if (!w.lockProgress) w.targetId = 0;
          continue;
        }
        w.lockLost = false;
        w.targetId = target.id;
        if (w.cooldown > 0) continue;
        w.lockProgress = Math.min(1, w.lockProgress + dt / lockTime);
        if (w.lockProgress < 1) continue;
      }
      if (!target) continue;

      const { travelTimeFraction, maxLeadTime } = RULES.playerAimAssist;
      const lead = Math.min(maxLeadTime, targetDistance / c.speed * travelTimeFraction);
      const aimX = target.x + target.vx * lead;
      const aimZ = target.z + target.vz * lead;

      for (let i = 0; i < c.count; i++) {
        const muzzle = this.weaponMuzzle(p, w, i);
        if (!muzzle) continue;
        const bearing = Math.atan2(aimX - muzzle.x, aimZ - muzzle.z);
        const spread = (i - (c.count - 1) / 2) * c.spread * RAD;
        const heading = arcHeading + clamp(angleDelta(bearing, arcHeading) + spread, -halfArc, halfArc);
        const fired = this.fireFromMount(p, w, muzzle, heading, { ...c, damage: c.damage * p.stats.damage }, lockTime ? target.id : 0, i);
        if (fired && lockTime) {
          this.lockPulse = .3;
          w.lockProgress = 0;
          if (this.mission?.stage.prompt === "lock" && this.mission.targetFor(target.id)) this.mission.practiced = true;
        }
        if (fired && this.mission?.stage.prompt === "gun" && this.mission.targetFor(target.id)) this.mission.practiced = true;
      }
      w.cooldown =
        1 /
        (c.fireRate *
          p.stats.fireRate *
          (part && part.health < part.maxHealth * 0.4 ? 0.65 : 1));
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
    y = RULES.flightAltitude as number,
    vy = 0,
  ) {
    const v = this.projectiles.acquire();
    if (!v) return;
    Object.assign(v, {
      id: this.nextId++,
      team,
      targetLayers: config.targetLayers,
      armorPierce: config.armorPierce,
      kind: kind ?? (config.homing > 0 ? "missile" : "bullet"),
      x,
      z,
      y,
      vy,
      weaponId: config.id,
      damageType: config.explosion > 0 || config.homing > 0 ? "explosive" : "kinetic",
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
    return v;
  }
  actorPose(entity: Player | Enemy): ActorPose {
    const { x, z, heading, bank, vx, vz } = entity;
    const route = "routeId" in entity ? this.routes.find(({ id }) => id === entity.routeId) : undefined;
    const y = entity.layer === "air" ? RULES.flightAltitude :
      (route ? routeHeight(route, x, z) : this.surfaceHeight(x, z)) + .2;
    return { x, y, z, heading, bank, vx, vz };
  }
  weaponMuzzle(entity: Player | Enemy, weapon: RuntimeWeapon, index: number) {
    return weaponMuzzle(entity, this.actorPose(entity), weapon, index);
  }
  private fireFromMount(entity: Player | Enemy, weapon: RuntimeWeapon, muzzle: ReturnType<typeof localToWorld>,
    heading: number, config: WeaponConfig, targetId: number, index: number, kind?: Projectile["kind"]) {
    const owner = entity === this.player ? "player" : "enemy";
    const actor = targetId ? this.enemies.find((enemy) => enemy.id === targetId) : owner === "enemy" ? this.player : undefined;
    const target = actor && this.actorPose(actor);
    const attackDistance = target ? Math.max(3, Math.hypot(target.x - muzzle.x, target.z - muzzle.z)) : 1;
    const vy = target && (entity.layer !== "air" || actor.layer !== "air") ? (target.y - muzzle.y) * config.speed / attackDistance : 0;
    const projectile = this.shoot(muzzle.x, muzzle.z, heading, config, owner, targetId, kind, muzzle.y, vy);
    if (!projectile) return false;
    this.emit({
      type: "weapon_fired", time: this.elapsed, owner, entityId: entity.id, anchorId: weapon.anchorId,
      projectileId: projectile.id,
      snapshot: {
        position: { x: muzzle.x, y: muzzle.y, z: muzzle.z },
        direction: { x: Math.sin(heading), y: vy / config.speed, z: Math.cos(heading) },
        velocity: muzzle.velocity, heading, bank: muzzle.bank,
        actorPose: this.actorPose(entity), barrel: { partId: weapon.partId, index },
        ammunition: config.homing || config.id.includes("rocket") ? "powered" : "gun",
        damageType: projectile.damageType, weaponId: config.id,
      },
    });
    return true;
  }
  private fireWeaponSalvo(
    entity: Player | Enemy,
    weapon: RuntimeWeapon,
    heading: number,
    target: Player | Enemy,
    kind?: Projectile["kind"],
    headingForShot?: (index: number, count: number) => number,
  ) {
    let count = 0;
    for (let i = 0; i < weapon.config.count; i++) {
      const muzzle = this.weaponMuzzle(entity, weapon, i);
      if (!muzzle) continue;
      const shotHeading = headingForShot
        ? headingForShot(i, weapon.config.count)
        : heading + (i - (weapon.config.count - 1) / 2) * weapon.config.spread * RAD;
      const targetId = typeof target.id === "number" ? target.id : 0;
      if (this.fireFromMount(entity, weapon, muzzle, shotHeading, weapon.config, targetId, i, kind)) count++;
    }
    return count;
  }
  private updateProjectiles(dt: number) {
    const p = this.player;
    for (const v of this.projectiles.items) {
      if (!v.active) continue;
      v.age += dt;
      v.life -= dt;
      v.prevX = v.x;
      v.prevZ = v.z;
      v.prevY = v.y;
      if (v.life <= 0 || distance(v, p) > 65) {
        v.active = false;
        continue;
      }
      if (v.homing && v.age < v.homingLife) {
        const target = v.targetId
          ? this.enemies.find((e) => e.id === v.targetId && this.isWeaponTarget(v.team, e, v.targetLayers))
          : v.team === "enemy" ? p : undefined;
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
      v.y += v.vy * dt;
      if (v.team === "enemy") {
        const contacts = [p, ...this.enemies].flatMap((actor) => {
          if (!this.isWeaponTarget(v.team, actor, v.targetLayers)) return [];
          const hit = hitCombatEntity(actor, v, actor.layer === "air" ? RULES.flightAltitude : this.actorPose(actor).y);
          return hit ? [{ actor, hit }] : [];
        }).sort((a, b) => a.hit.t - b.hit.t);
        const contact = contacts[0];
        if (contact) {
          const { actor, hit } = contact;
          v.active = false;
          this.damageEntity(actor, hit.part, v.damage, hit.x, hit.z, v.kind,
            actor === p ? "player" : "enemy", this.projectileImpact(actor, v, hit));
        }
      } else {
        const contacts = this.enemies.flatMap((e) => {
          if (!this.isWeaponTarget(v.team, e, v.targetLayers) || v.hitIds.includes(e.id)) return [];
          const hit = hitCombatEntity(e, v, e.layer === "air" ? RULES.flightAltitude : undefined);
          return hit ? [{ e, hit }] : [];
        }).sort((a, b) => a.hit.t - b.hit.t || a.e.id - b.e.id);
        for (const { e, hit } of contacts) {
          if (e.health <= 0) continue;
          const armor = hit.part?.kind === "armor" ? .65 : 1;
          const penetration = v.armorPierce ?? 0;
          this.damageEntity(e, hit.part, v.damage * (armor + (1 - armor) * penetration), hit.x, hit.z, "player", "enemy", this.projectileImpact(e, v, hit));
          v.hitIds.push(e.id);
          e.burn = Math.max(e.burn, v.burn > 0 ? 3 : 0);
          e.slow = Math.max(e.slow, v.slow);
          e.armorBreak = Math.max(e.armorBreak, v.armorBreak);
          if (v.explosion)
            this.explode(hit.x, hit.z, v.explosion, v.damage * 0.5, v.targetLayers ?? ["air"], e.id, e.layer);
          if (v.pierce-- > 0) continue;
          if (v.bounce-- > 0) {
            const normal = Math.atan2(hit.x - e.x, hit.z - e.z);
            v.heading = 2 * normal - v.heading + Math.PI;
            v.x = hit.x;
            v.z = hit.z;
            break;
          }
          v.active = false;
          break;
        }
      }
    }
  }
  private projectileImpact(entity: Player | Enemy, projectile: Projectile, hit: { x: number; z: number; t: number }): CombatSnapshot {
    const y = (projectile.prevY ?? projectile.y) + (projectile.y - (projectile.prevY ?? projectile.y)) * hit.t;
    const pose = this.actorPose(entity);
    return {
      actorPose: { ...pose,
        x: entity.x - (entity.x - (entity.prevX ?? entity.x)) * (1 - hit.t),
        z: entity.z - (entity.z - (entity.prevZ ?? entity.z)) * (1 - hit.t),
        heading: pose.heading - angleDelta(pose.heading, entity.prevHeading ?? pose.heading) * (1 - hit.t),
        bank: pose.bank - (pose.bank - (entity.prevBank ?? pose.bank)) * (1 - hit.t),
      },
      contact: true,
      position: { x: hit.x, y: entity.layer === "air" ? y : pose.y, z: hit.z },
      direction: { x: Math.sin(projectile.heading), y: projectile.vy / projectile.speed, z: Math.cos(projectile.heading) },
      velocity: { x: pose.vx, y: 0, z: pose.vz }, heading: pose.heading, bank: pose.bank,
      damageType: projectile.damageType, weaponId: projectile.weaponId,
    };
  }
  private impactSnapshot(entity: Player | Enemy, x: number, z: number, damageType: DamageType): CombatSnapshot {
    const pose = this.actorPose(entity);
    const heading = Math.atan2(entity.x - x, entity.z - z);
    return {
      position: { x, y: pose.y, z }, velocity: { x: pose.vx, y: 0, z: pose.vz },
      direction: { x: Math.sin(heading), y: 0, z: Math.cos(heading) },
      heading: pose.heading, bank: pose.bank, damageType,
    };
  }
  private impactPart(entity: Player | Enemy, x: number, z: number) {
    const pose = this.actorPose(entity);
    let best: Part | undefined;
    let nearest = Infinity;
    for (const part of entity.parts) {
      if (!hitCombatEntity({ ...pose, parts: [part] }, { prevX: x, prevZ: z, x, z, radius: 0 })) continue;
      const center = localToWorld(pose, partAnchor(part));
      const distance = Math.hypot(center.x - x, center.z - z);
      if (distance < nearest) {
        nearest = distance;
        best = part;
      }
    }
    return best;
  }
  private damageEntity(
    entity: Player | Enemy,
    part: Part | undefined,
    amount: number,
    x: number,
    z: number,
    source: string,
    owner: "player" | "enemy",
    snapshot = this.impactSnapshot(entity, x, z, owner === "player" ? "contact" : "kinetic"),
  ) {
    if (entity.health <= 0) return;
    if (owner === "player" && this.player.invulnerable > 0) return;
    const damage = amount * (owner === "enemy" && "armorBreak" in entity && entity.armorBreak > 0 ? 1.25 : 1);
    const { appliedDamage, damagedParts, transitions, destroyed } = applyPartDamage(entity, part, damage);
    if (!appliedDamage) return;
    const era = combatantById(entity.configId ?? "")?.era ?? this.era;
    snapshot = { ...snapshot, actorPose: snapshot.actorPose ?? this.actorPose(entity),
      surface: entity.layer === "air" && (era === "pioneer" || era === "ww1") ? "fabric" : "metal",
      damagedParts };
    for (const { part, state } of transitions) {
      if (state !== "disabled" && state !== "destroyed") continue;
      const anchor = localToWorld(this.actorPose(entity), partAnchor(part));
      const localSnapshot = { ...snapshot, position: { x: anchor.x, y: anchor.y, z: anchor.z } };
      this.emit({
        type: "part_disabled",
        time: this.elapsed,
        owner,
        entityId: entity === this.player ? "player" : (entity as Enemy).id,
        partId: part.id,
        label: part.slot === "leftWing" ? "左翼" : part.slot === "rightWing" ? "右翼" : part.kind,
        snapshot: localSnapshot,
      });
      if (state === "destroyed") this.emit({
        type: "part_detached", time: this.elapsed, owner, entityId: entity.id, partId: part.id, partKind: part.kind,
        color: combatantById(entity.configId ?? "")?.visual.color ?? "#899589",
        snapshot: localSnapshot,
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
      this.emit({ type: "player_hit", time: this.elapsed, amount: appliedDamage, source, part: part?.id, snapshot });
      this.telemetry.record(this.elapsed, "player_damage", { source, amount: appliedDamage, part: part?.id ?? "airframe" });
    } else {
      const e = entity as Enemy;
      e.flash = 1;
      this.emit({ type: "enemy_hit", time: this.elapsed, enemyId: e.id, amount: appliedDamage, part: part?.id, snapshot });
      if (destroyed) this.finishEnemy(e, snapshot.damageType);
    }
  }
  damagePlayer(
    amount: number,
    x = this.player.x,
    z = this.player.z,
    source = "unknown",
  ) {
    if (this.phase === "dying" || this.phase === "result") return;
    this.damageEntity(this.player, this.impactPart(this.player, x, z), amount, x, z, source, "player");
  }
  damageEnemy(e: Enemy, damage: number, x?: number, z?: number, type: DamageType = "kinetic") {
    if (e.health <= 0 || !e.parts) return;
    const part = x !== undefined && z !== undefined ? this.impactPart(e, x, z) : undefined;
    this.damageEntity(e, part, damage, x ?? e.x, z ?? e.z, "damage", "enemy", this.impactSnapshot(e, x ?? e.x, z ?? e.z, type));
  }
  private finishEnemy(e: Enemy, type: DamageType) {
    if (e.health > 0) return;
    this.detachDestroyedParts(e, "enemy");
    this.mission?.destroyed(e.id);
    if (e.factionId === "player") return;
    const profile = this.replayControllers.get(e.id)?.profile ?? npcProfileById(e.kind, this.era);
    const config = profile ? combatantById(profile.combatantId) : undefined;
    if (!profile || !config) return;
    this.kills++;
    this.score += Math.round(profile.rewards.score * this.combo);
    this.awardXp(profile.rewards.xp);
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
      snapshot: this.impactSnapshot(e, e.x, e.z, type),
    });
    if (["depot", "fuel_truck"].includes(e.kind)) this.explode(e.x, e.z, 5, 90, ["ground"], e.id);
  }
  private explode(
    x: number,
    z: number,
    radius: number,
    damage: number,
    layers: readonly TargetLayer[],
    exclude = 0,
    layer = layers[0],
  ) {
    this.effect(
      x,
      z,
      "burst",
      1,
      radius,
      layer !== "air" ? this.surfaceHeight(x, z) + .2 : RULES.flightAltitude,
      layer !== "air" ? isWater(x,z,this.terrainSeed) ? "water" : "ground" : undefined,
    );
    let hits = 0;
    for (const e of [...this.enemies]) {
      const d = Math.hypot(e.x - x, e.z - z);
      if (
        this.isWeaponTarget("player", e, [...layers]) &&
        e.id !== exclude &&
        layers.includes(e.layer) &&
        d <= radius + e.radius
      ) {
        this.damageEnemy(e, damage * Math.max(0.3, 1 - d / (radius * 1.42)), x, z, "explosive");
        hits++;
      }
    }
    return hits;
  }
  spawnPickup(kind: PickupKind, x: number, z: number, value?: number, xp?: number) {
    if (kind !== "coin" && this.pickups.items.filter(
      (item) => item.active && item.kind !== "coin",
    ).length >= HEALTH_SUPPLY.fieldCap) return;
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
  spawnHealthPickup(kind: "repairSmall" | "repairLarge", supplemental = false) {
    const p = this.player;
    const offset = supplemental ? this.random.range(.7, HEALTH_SUPPLY.bearingMax) * (this.random.next() < .5 ? -1 : 1)
      : this.random.range(-.5, .5);
    const bearing = p.heading + offset;
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
    if (activeHealth === 0 && HEALTH_SUPPLY.fieldCap > 1)
      this.spawnHealthPickup("repairSmall", true);
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
      if (c.life <= 0 || distance(c, p) > (c.kind === "coin" ? 70 : HEALTH_SUPPLY.keepDistance)) {
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
          this.effect(c.x, c.z, "coin", 0.4, 0.6);
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
            this.effect(c.x, c.z, "heal", 0.5, 0.8);
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
    const available = this.legalUpgradeOptions;
    if (available.length < 3) return false;
    this.upgradeMode = this.phase as "battle" | "bombing";
    this.phase = "upgrade";
    this.clock.timeScale = 0;
    if (this.choices.length !== 3 || this.choices.some(choice => !available.includes(choice)))
      this.rollUpgradeChoices(available);
    return true;
  }
  private rollUpgradeChoices(available = this.legalUpgradeOptions) {
    const p = this.player;
    const weighted = available
      .map((u) => ({
        u,
        weight:
          -Math.log(Math.max(0.00001, this.random.next())) /
          this.upgradeWeight(u),
      }))
      .sort((a, b) => a.weight - b.weight);
    this.choices = weighted.slice(0, 3).map((v) => v.u);
    if (p.frame.geometryProfile === "fokkerDr1" && p.upgrades.length === 0) {
      const wing = weighted.find(({ u }) => u.id === "left_wing_segment" || u.id === "right_wing_segment");
      const starter = available.filter(u => u.id === "quick_feed" || u.id === "radiator");
      if (wing && starter.length === 2) this.choices = [...starter, wing.u];
    } else if (
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
  }
  get legalUpgradeOptions() {
    return legalUpgrades({
      frame: this.player.frame,
      era: this.refitEra,
      upgrades: this.player.upgrades,
      parts: this.player.parts,
      weapons: this.player.weapons,
    }, this.player.frame.geometryProfile === "fokkerDr1" ? FOKKER_UPGRADES :
      this.player.frame.geometryProfile === "ho229V2" ? HO229_UPGRADES : UPGRADES);
  }
  private refitWeapon(id: string) { return refitWeaponForEra(id, this.refitEra); }
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
  selectUpgrade(id: string) {
    const upgrade = this.choices.find(choice => choice.id === id);
    if (this.phase !== "upgrade" || this.upgradeInstallation || this.upgradesAvailable <= 0 || !upgrade ||
      !this.legalUpgradeOptions.includes(upgrade)) return false;
    if (this.selectedUpgradeId === id) return true;
    this.upgradePreview = this.projectRefit(upgrade).preview;
    this.selectedUpgradeId = id;
    return true;
  }
  inspectUpgrade(upgrade: Upgrade) {
    return this.projectRefit(upgrade).preview;
  }
  private projectRefit(upgrade: Upgrade) {
    const player = { ...structuredClone(this.player), frame: this.player.frame };
    const layout = { ...this.refitLayout };
    this.applyRefit(player, layout, upgrade);
    const partIds = player.parts.slice(this.player.parts.length).map(part => part.id);
    const changedMounts = player.weapons.filter((weapon, index) => {
      const previous = this.player.weapons[index];
      return previous && (weapon.config.count !== previous.config.count || weapon.config.turnRate !== previous.config.turnRate);
    });
    const focusPartIds = partIds.length ? partIds
      : changedMounts.length ? [...new Set(changedMounts.map(weapon => weapon.partId))]
        : player.parts.filter(part => part.slot === upgrade.preview).map(part => part.id);
    const preview: UpgradePreview = {
      player,
      partIds,
      focusPartIds,
      mountIds: player.weapons.slice(this.player.weapons.length).map(weapon => weapon.anchorId),
    };
    return { preview, layout };
  }
  confirmUpgrade() {
    if (this.phase !== "upgrade" || this.upgradeInstallation || this.upgradesAvailable <= 0) return false;
    const upgrade = this.choices.find(choice => choice.id === this.selectedUpgradeId);
    if (!upgrade) return false;
    if (!this.legalUpgradeOptions.includes(upgrade)) {
      this.clearUpgradeSelection();
      this.rollUpgradeChoices();
      return false;
    }
    const price = upgradePrice(upgrade);
    if (this.coins < price) return false;

    const { preview, layout } = this.projectRefit(upgrade);
    const event: UpgradeInstalledEvent = {
      type: "upgrade_installed",
      time: this.elapsed,
      upgradeId: upgrade.id,
      partIds: preview.partIds,
      mountIds: preview.mountIds,
      pose: this.actorPose(this.player),
      animation: preview.player.parts.some(part => preview.partIds.includes(part.id) && part.centerline?.segmentRole === "insert")
        ? "extension" : preview.partIds.length ? "mount" : "system",
    };
    this.coins -= price;
    this.upgradesAvailable--;
    Object.assign(this.player, preview.player);
    this.refitLayout = layout;
    this.clearUpgradeSelection();
    this.choices = [];
    this.upgradeInstallation = event;
    this.emit(event);
    this.telemetry.record(this.elapsed, "upgrade_chosen", { id: upgrade.id, price, balance: this.coins });
    this.message(`已安装 · ${upgrade.name}`, 3);
    return true;
  }
  chooseUpgrade(id: string) {
    const upgrade = this.choices.find((choice) => choice.id === id);
    if (this.phase !== "upgrade" || this.upgradesAvailable <= 0 || !upgrade) return false;
    this.installUpgrade(upgrade);
    this.upgradesAvailable--;
    this.choices = [];
    this.resumeAfterUpgrade();
    this.telemetry.record(this.elapsed, "upgrade_chosen", { id });
    this.message(`已安装 · ${upgrade.name}`, 3);
    return true;
  }
  returnFromUpgrade() {
    if (this.phase !== "upgrade" || this.upgradeInstallation) return false;
    this.clearUpgradeSelection();
    this.resumeAfterUpgrade();
    return true;
  }
  finishUpgradeInstallation() {
    if (this.phase !== "upgrade" || !this.upgradeInstallation) return false;
    this.upgradeInstallation = undefined;
    this.resumeAfterUpgrade();
    return true;
  }
  private clearUpgradeSelection() {
    this.selectedUpgradeId = undefined;
    this.upgradePreview = undefined;
  }
  private resumeAfterUpgrade() {
    this.phase = this.upgradeMode;
    this.clock.timeScale = 1;
    this.clock.accumulator = 0;
  }
  installUpgrade(u: Upgrade) {
    this.applyRefit(this.player, this.refitLayout, u);
  }
  private applyRefit(p: Player, layout: RefitLayout, u: Upgrade) {
    p.upgrades.push(u.id);
    if (u.id === "twin_mount") {
      const weapon = p.weapons.find((candidate) =>
        candidate.config.category !== "area" && candidate.config.count === 1 &&
        p.parts.find((part) => part.id === candidate.partId)?.role === "gun",
      );
      if (weapon) weapon.config = { ...weapon.config, count: 2, damage: weapon.config.damage * .65 };
    }
    if (u.id === "turret_fast_traverse") {
      for (const weapon of p.weapons)
        if (weapon.config.category === "turret")
          weapon.config = { ...weapon.config, turnRate: weapon.config.turnRate * 1.25 };
    }
    if (u.add)
      for (const [key, val] of Object.entries(u.add))
        p.stats[key as keyof Stats] += val;
    layout.wingspan += u.add?.wingspan ?? 0;
    layout.length += u.add?.length ?? 0;
    if (u.multiply)
      for (const [key, val] of Object.entries(u.multiply))
        p.stats[key as keyof Stats] *= val;
    if (u.id === "armor_belt") {
      const body = p.parts.find((part) => part.id === "center_body")!;
      body.maxHealth += u.add?.health ?? 0;
      stateFor(body);
    }
    // Newly installed parts enter at full local health and expand the total pool.
    p.energy = Math.min(p.energy, p.stats.energyMax);
    const newlyAdded: Part[] = [];
    u.parts.forEach((recipe, i) => {
      const side =
        recipe.slot === "leftWing" ? -1 : recipe.slot === "rightWing" ? 1 : 0;
      const copies = p.parts.filter((part) => part.id.startsWith(u.id + "_") && part.slot === recipe.slot).length;
      const x = (recipe.x ?? side * (p.stats.wingspan * 0.32 + copies * .65));
      const z =
        recipe.z ??
        (recipe.slot === "nose"
          ? p.stats.length * 0.42
          : recipe.slot === "tail"
            ? -p.stats.length * 0.4
            : 0) - copies * .45;
      const part = this.part(
        `${u.id}_${p.upgrades.length}_${i}`,
        recipe.kind,
        recipe.slot,
        x,
        z,
        recipe.health,
        recipe.kind === "wing" ? 1.1 : 0.5,
      );
      part.centerline = mountForUpgrade(u.id, part, p.frame, p.parts, i === 0 ? refitStructureLength(u, p.frame.geometryProfile) : undefined);
      if (u.wingBay && i === 0) {
        Object.assign(part.centerline, { segmentRole: "insert", insertion: u.wingBay.insertion, segmentLength: u.wingBay.width });
      }
      if (copies && !u.wingBay && part.centerline.segmentRole === "mount") {
        const offset = part.centerline.offset ?? { x: 0, y: 0, z: 0 };
        part.centerline.offset = {
          x: offset.x + side * copies * .42,
          y: offset.y + (side === 0 ? (recipe.slot === "bottom" ? -.15 : .15) * copies : 0),
          z: offset.z - copies * .45,
        };
      }
      if (part.role === "engine" && !u.wingBay) {
        part.engineInstallation = p.frame.id === "stingray_16" ? "pusher" : "tractor";
        part.centerline.axis = part.engineInstallation;
        part.centerline.clearance = .8;
      }
      const terminal = part.centerline.insertion === "root-before"
        ? p.parts.find(candidate => candidate.id === (side < 0 ? "left_wing" : "right_wing"))
        : (p.frame.geometryProfile === "fokkerDr1" || p.frame.geometryProfile === "ho229V2") && part.centerline.insertion === "tip-before"
        ? p.parts.find(candidate => candidate.centerline?.lineId === part.centerline!.lineId && candidate.centerline.segmentRole === "tip")
        : undefined;
      const parent = u.wingBay && i > 0 ? newlyAdded[0] : terminal ? p.parts.find(candidate => candidate.id === terminal.parentId) : u.id === "left_wing_segment" || u.id === "right_wing_segment"
        ? p.parts.slice().reverse().find((candidate) => candidate.slot === recipe.slot && candidate.role === "wing" && candidate.health > 0)
        : u.id === "tail_side_bay" ? p.parts.find((candidate) => candidate.id === "tail")
          : u.id === "airship_gun_gallery" ? p.parts.find((candidate) => candidate.slot === "leftWing" && candidate.role === "wing")
            : u.id === "float_pylon" ? p.parts.find((candidate) => candidate.slot === "leftWing" && candidate.role === "wing")
              : undefined;
      if (parent) {
        part.parentId = parent.id;
        part.connection = { side, x: x - parent.x, z: z - parent.z };
      }
      if (terminal) terminal.parentId = part.id;
      part.weight = recipe.weight ?? 5;
      part.addedMass = part.weight * 10 * (p.frame.refit?.massPenalty ?? 1);
      if (part.role === "wing") part.lift = (part.lift ?? 1) * (p.frame.refit?.wing ?? 1);
      if (part.role === "engine") part.thrust = (part.thrust ?? 1) * (p.frame.refit?.engine ?? 1);
      if (part.kind !== "wing" && part.kind !== "winglet")
        part.visual = { ...(part.visual ?? { kind: part.kind, scale: 1, detachable: false }), detachable: false };
      p.parts.push(part);
      newlyAdded.push(part);
    });
    u.weapons?.forEach((id, i) => {
      if (id === "lock_missile" && p.weapons.some(weapon => weapon.config.lockTime > 0)) return;
      const part = u.wingBay ? newlyAdded.find(p => p.role === "gun") : newlyAdded[Math.min(i, newlyAdded.length - 1)];
      if (!part || part.destroyed) return;
      const baseWeapon = this.refitWeapon(id);
      const c = u.id === "nose_cannon"
        ? { ...baseWeapon, damage: baseWeapon.damage * 1.55, pierce: 1 }
        : baseWeapon;
      const sideCount = p.parts.filter((candidate) => candidate.id.startsWith("tail_side_bay_")).length;
      this.addWeapon(
        p,
        { ...c, damage: c.damage * (p.frame.refit?.weapon ?? 1) },
        part.id,
        u.id === "twin_tail" ? Math.PI :
          u.id === "tail_side_bay" ? (sideCount % 2 === 0 ? -Math.PI / 2.6 : Math.PI / 2.6) :
            u.id === "airship_gun_gallery" || u.id === "float_pylon" ? Math.PI / 2 : 0,
      );
    });
    // Expand the base hit zones together with the visible wing, including lightweight builds.
    for (const part of p.parts) {
      if (part.id === "left_wing" || part.id === "right_wing") {
        part.x = (part.slot === "leftWing" ? -1 : 1) * p.stats.wingspan * 0.23;
        part.radius = p.stats.wingspan * 0.16;
      }
      if (part.id === "tail") part.z = -p.stats.length * .34;
    }
    if (u.id === "modular_frame")
      for (const part of p.parts) {
        part.maxHealth *= 1.1;
        part.health *= 1.1;
      }
    this.applyPlayerCenterlineLayout(p, layout);
    if (p.frame.geometryProfile !== "ho229V2")
      refreshAirframeSilhouette(p.parts, p.stats.wingspan, p.stats.length, p.frame.engines === 4 ? .75 : .48, p.frame.wingCount ?? 1, p.frame.length, this.playerWingSpans(p, layout), p.frame);
    p.hitExtent = silhouetteExtent(p.parts);
    this.syncPlayerHealth(p);
    p.damage = evaluateDamage(p.parts);
    p.revision++;
  }
  private repairWithAmount(amount: number) {
    repairPartsWithOverflow(this.player.parts, amount);
    this.syncPlayerHealth();
    this.player.revision++;
  }
  toggleBombing() {
    if (!["battle", "bombing"].includes(this.phase) || !this.bombWeapon) return;
    this.player.boosting = false;
    this.player.boost = 0;
    this.phase = this.phase === "battle" ? "bombing" : "battle";
    this.stability = 0;
    this.aimOffset = { x: 0, z: 0 };
    this.telemetry.record(this.elapsed, "bombing_mode", {
      enabled: Number(this.phase === "bombing"),
    });
    this.message(
      this.isBombing ? "轰炸模式 · 松杆稳定准心" : "空战模式 · 把目标带入火线",
      3,
    );
  }
  private updateBombing(dt: number, input: Intent) {
    this.bombCooldown = Math.max(0, this.bombCooldown - dt);
    const p = this.player;
    const headingSin = Math.sin(p.heading), headingCos = Math.cos(p.heading);
    const lateral = input.active ? input.x * headingCos - input.z * headingSin : 0;
    const longitudinal = input.active ? input.x * headingSin + input.z * headingCos : 0;
    const lead = clamp(7 + p.speed * .55 + longitudinal * 3, 4, 14);
    this.aimOffset.z = damp(this.aimOffset.z || lead, lead, 5, dt);
    this.aimOffset.x = damp(this.aimOffset.x, clamp(lateral, -1, 1) * this.aimOffset.z * Math.tan(10 * RAD), 5, dt);
    this.aim.x = p.x + headingSin * this.aimOffset.z + headingCos * this.aimOffset.x;
    this.aim.z = p.z + headingCos * this.aimOffset.z - headingSin * this.aimOffset.x;
    if (this.isBombing) {
      const motion = input.active ? input.magnitude : 0;
      const gain = (1 - motion * 1.8) * RULES.bombSettleRate * p.stats.bombSettle;
      this.stability = clamp(this.stability + (gain - this.wind.gust * .08 - p.hitFlash * .7) * dt);
    } else this.stability = 0;
    for (const bomb of this.bombs) {
      bomb.age += dt;
      if (bomb.age >= RULES.bombFallTime) {
        const waterOnly = bomb.weapon.targetLayers?.length === 1 && bomb.weapon.targetLayers[0] === "water";
        const hits = waterOnly && !isWater(bomb.x, bomb.z, this.terrainSeed) ? 0 : this.explode(
          bomb.x,
          bomb.z,
          bomb.weapon.explosion,
          bomb.weapon.damage,
          bomb.weapon.targetLayers ?? ["ground", "water"],
        );
        this.bombsHit += Number(hits > 0);
        this.telemetry.record(this.elapsed, "bomb_impact", { hits });
        this.message(
          hits > 0 ? `直接命中 · ${hits} 个目标` : "投放完成 · 落点无目标",
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
        if (e.factionId !== "player" && e.layer !== "air" && distance(e, fire) < fire.radius)
          this.damageEnemy(e, fire.dps * dt, fire.x, fire.z, "fire");
    }
    this.fires = this.fires.filter((f) => f.life > 0);
  }
  dropBomb() {
    this.telemetry.record(this.elapsed, "bomb_attempt", {
      stability: this.stability,
    });
    const weapon = this.bombWeapon;
    if (!this.canBomb || !weapon) {
      this.message("准心尚未稳定或炸弹正在装填", 2);
      return false;
    }
    const p = this.player;
    const bay = p.parts.find((part) => part.role === "bay" && part.health > 0 && !part.destroyed);
    const origin = bay ? localToWorld(this.actorPose(p), { ...partAnchor(bay), y: (bay.y ?? 0) - .22 }) : this.actorPose(p);
    this.bombs.push({
      x: this.aim.x,
      z: this.aim.z,
      startX: origin.x,
      startZ: origin.z,
      startY: origin.y,
      age: 0,
      weapon,
    });
    this.emit({
      type: "weapon_fired", time: this.elapsed, owner: "player", entityId: p.id, anchorId: bay?.id ?? "bay",
      snapshot: {
        position: { x: origin.x, y: origin.y, z: origin.z },
        direction: { x: 0, y: -1, z: 0 },
        heading: p.heading, bank: p.bank, velocity: { x: p.vx, y: 0, z: p.vz },
        damageType: "explosive", weaponId: weapon.id, ammunition: "bomb",
      },
    });
    this.bombCooldown = Math.max(
      1,
      1 / weapon.fireRate +
        p.stats.bombCooldown +
        (1 - this.player.damage.bombFactor) * 2,
    );
    this.stability = 0.15;
    this.bombsDropped++;
    if (this.mission?.stage.prompt === "bomb") this.mission.practiced = true;
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
  end(reason: MissionOutcome = "retreat", detail = "") {
    if (this.phase === "result" || this.phase === "dying") return;
    this.mission?.finish(reason, detail);
    this.phase = reason === "aircraft_destroyed" ? "dying" : "result";
    this.clock.timeScale = this.phase === "dying" ? 1 : 0;
    this.telemetry.record(this.elapsed, "session_end", {
      reason,
      score: this.score,
      averageSpeed: this.averageSpeed,
      energyEmpty: this.energyEmptyCount,
      coins: this.coins,
    });
    if (this.phase === "dying") {
      this.detachDestroyedParts(this.player, "player");
      this.emit({ type: "player_destroyed", time: this.elapsed, snapshot: this.impactSnapshot(this.player, this.player.x, this.player.z, "explosive") });
    }
  }

  private detachDestroyedParts(entity: Player | Enemy, owner: "player" | "enemy") {
    const pose = this.actorPose(entity);
    for (const part of entity.parts) {
      if (!part.visual?.detachable || part.destroyed) continue;
      part.destroyed = true;
      part.state = "destroyed";
      part.disabled = true;
      const anchor = localToWorld(pose, partAnchor(part));
      this.emit({
        type: "part_detached", time: this.elapsed, owner,
        entityId: entity === this.player ? "player" : entity.id,
        partId: part.id, partKind: part.kind,
        color: combatantById(entity.configId ?? "")?.visual.color ?? "#899589",
        snapshot: { ...this.impactSnapshot(entity, entity.x, entity.z, "explosive"),
          position: { x: anchor.x, y: anchor.y, z: anchor.z } },
      });
    }
    entity.partRevision++;
  }
  dispose() {
    this.projectiles.clear();
    this.pickups.clear();
    this.bombs.length = 0;
    this.fires.length = 0;
    this.enemies.length = 0;
    for (let i = this.actors.length - 1; i > 0; i--) this.actors.splice(i, 1);
    this.eventQueue.length = 0;
    this.replayControllers.clear();
  }
  message(text: string, time = 3) {
    this.notice = text;
    this.noticeTime = time;
  }
  effect(x: number, z: number, profile: "burst" | "coin" | "heal", duration: number, size: number,
    y: number = RULES.flightAltitude, surface?: "ground" | "water",
  ) {
    this.emit({ type: "effect_requested", time: this.elapsed, profile, surface, position: { x, y, z }, size, duration });
  }
}
