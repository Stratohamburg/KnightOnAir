import type { CampaignMission, MissionStage, MissionTarget } from "../data/campaignMissions";
import { combatantById, npcProfileById, type NpcProfile } from "../data/combatants";
import type { TargetLayer } from "../data/weapons";
import type { Enemy } from "./types";

export type MissionOutcome = "victory" | "mission_failed" | "aircraft_destroyed" | "retreat";

export interface MissionResult {
  missionId: string;
  outcome: MissionOutcome;
  completedStages: number;
  detail: string;
}

export interface ActiveMissionTarget {
  config: MissionTarget;
  actor?: Enemy;
  destroyed: boolean;
  availableAt?: number;
  waypoint: number;
  initialRouteDistance?: number;
  motion?: MissionTarget["motion"];
  routeDirection?: 1 | -1;
}

export class MissionRun {
  readonly targets = new Map<string, ActiveMissionTarget>();
  stage: MissionStage;
  stageStartedAt = 0;
  completedStages = 0;
  practiced = false;
  result?: MissionResult;
  private readonly byInstance = new Map<number, ActiveMissionTarget>();

  constructor(readonly mission: CampaignMission) {
    this.stage = mission.stages.find((stage) => stage.id === mission.firstStage)!;
    this.activate(this.stage, 0);
  }

  private activate(stage: MissionStage, elapsed: number) {
    this.stage = stage;
    this.stageStartedAt = elapsed;
    this.practiced = false;
    const previous = new Map(this.targets);
    this.targets.clear();
    this.byInstance.clear();
    for (const config of stage.targets) {
      const target = previous.get(config.id) ?? { config, destroyed: false, waypoint: 0 };
      target.config = config;
      target.motion ??= config.motion;
      this.targets.set(config.id, target);
      if (target.actor) this.byInstance.set(target.actor.id, target);
    }
  }

  bind(target: ActiveMissionTarget, actor: Enemy, elapsed: number) {
    if (target.actor || this.result) return;
    target.actor = actor;
    target.availableAt = elapsed;
    target.initialRouteDistance = actor.routeDistance;
    this.byInstance.set(actor.id, target);
  }

  targetFor(id: number) { return this.byInstance.get(id); }

  pending(elapsed: number) {
    if (elapsed < this.stageStartedAt + (this.stage.delay ?? 0)) return [];
    const targets = [...this.targets.values()];
    const candidates = this.stage.sequential ? [targets.find((target) => !target.destroyed)] : targets;
    return candidates.filter((target): target is ActiveMissionTarget =>
      !!target && !target.actor && elapsed >= this.stageStartedAt + (this.stage.delay ?? 0) + (target.config.delay ?? 0));
  }

  reserve(profile: NpcProfile, layer: TargetLayer) {
    let total = 0, slots = 0, sameProfile = 0;
    for (let stage: MissionStage | undefined = this.stage; stage;) {
      let stageTotal = 0, stageSlots = 0, stageSameProfile = 0;
      for (const target of stage.targets) {
        const active = this.targets.get(target.id);
        if (active?.destroyed || (stage === this.stage && active?.actor && active.actor.health > 0)) continue;
        const kind = npcProfileById(target.kind, this.mission.era)!;
        const config = combatantById(kind.combatantId)!;
        stageTotal++;
        const sameGroup = layer === "air"
          ? config.layer === "air" && !!kind.elite === !!profile.elite : config.layer !== "air";
        if (sameGroup) stageSlots += kind.spawn.slotCost;
        if (kind.id === profile.id) stageSameProfile++;
      }
      total = Math.max(total, stage.sequential ? Math.min(1, stageTotal) : stageTotal);
      slots = Math.max(slots, stageSlots);
      sameProfile = Math.max(sameProfile, stage.sequential ? Math.min(1, stageSameProfile) : stageSameProfile);
      const next: string | undefined = stage.next;
      stage = this.mission.stages.find((candidate) => candidate.id === next);
    }
    return { total, slots, sameProfile };
  }

  destroyed(id: number) {
    const target = this.byInstance.get(id);
    if (target && !this.result) target.destroyed = true;
  }

  get total() { return [...this.targets.values()].filter(({ config }) => !config.friendly && !config.support).length; }
  get defeated() { return [...this.targets.values()].filter(({ config, destroyed }) => !config.friendly && !config.support && destroyed).length; }

  private goalComplete() {
    const goal = this.stage.goal;
    if (!goal) return this.total > 0 && this.defeated === this.total;
    const target = this.targets.get(goal.target);
    if (!target?.actor) return false;
    if (goal.type === "damage") return target.actor.health <= target.actor.maxHealth * goal.fraction;
    if (goal.routeDistance !== undefined) return (target.actor.routeDistance ?? -1) >= goal.routeDistance;
    return target.waypoint >= (goal.waypoint ?? target.motion?.points.length ?? Infinity);
  }

  deadline(target: ActiveMissionTarget, elapsed: number) {
    const { actor, availableAt, config, initialRouteDistance } = target;
    const limit = config.deadline;
    if (!limit || !actor || actor.health <= 0 || availableAt === undefined) return;
    if ("seconds" in limit) {
      const seconds = Math.max(0, limit.seconds - (elapsed - availableAt));
      return { expired: seconds <= 0, seconds, urgency: 1 - seconds / limit.seconds };
    }
    if ("routeDistance" in limit && actor.routeDistance !== undefined && initialRouteDistance !== undefined) {
      const remaining = Math.max(0, limit.routeDistance - actor.routeDistance);
      return { expired: remaining <= 0, seconds: remaining / Math.max(.1, actor.speed),
        urgency: 1 - remaining / (limit.routeDistance - initialRouteDistance) };
    }
    if ("pathEnd" in limit && target.motion) {
      const points = target.motion.points;
      const next = points[target.waypoint];
      const remaining = next ? Math.hypot(next.x - actor.x, next.z - actor.z) + points.slice(target.waypoint + 1)
        .reduce((length, point, index) => {
          const previous = points[target.waypoint + index];
          return length + Math.hypot(point.x - previous.x, point.z - previous.z);
        }, 0) : 0;
      const seconds = remaining / target.motion.speed;
      return { expired: !next, seconds, urgency: 1 / (1 + seconds) };
    }
  }

  advance(elapsed: number) {
    if (this.result) return;
    for (const target of this.targets.values()) {
      if (target.config.friendly && target.destroyed)
        return this.finish("mission_failed", `${target.config.name}已被摧毁`);
      if (this.deadline(target, elapsed)?.expired)
        return this.finish("mission_failed", `${target.config.name}已越过拦截期限`);
    }
    if (!this.goalComplete()) return;
    const goal = this.stage.goal;
    if (goal?.type === "damage" && goal.redirect) {
      const boss = this.targets.get(goal.target)!;
      boss.motion = goal.redirect;
      boss.waypoint = 0;
      if (boss.actor) {
        boss.actor.state = "entering";
        boss.actor.phaseTime = 0;
      }
    }
    this.completedStages++;
    if (!this.stage.next) return this.finish("victory");
    this.activate(this.mission.stages.find((stage) => stage.id === this.stage.next)!, elapsed);
  }

  finish(outcome: MissionOutcome, detail = "") {
    return this.result ??= { missionId: this.mission.id, outcome, completedStages: this.completedStages, detail };
  }
}
