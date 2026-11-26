import { AIRFRAMES, type Airframe } from "../data/aircrafts";
import type { CampaignMission, MissionPoint, MissionTarget } from "../data/campaignMissions";
import { combatantById, npcProfileById } from "../data/combatants";
import { RULES } from "../data/config";
import { ERAS } from "../data/eras";
import { DAY_PERIODS, WEATHER_PRESETS } from "../data/sortieEnvironment";
import { WEAPONS } from "../data/weapons";
import { createDefaultRoutes, type Route } from "./Routes";

function validPoint({ x, z }: MissionPoint) {
  return Number.isFinite(x) && Number.isFinite(z) && Math.hypot(x, z) < RULES.boundary;
}

export function validateMissionLoadout(mission: CampaignMission, frame: Airframe) {
  const config = combatantById(frame.id);
  if (!config || config.layer !== "air") return [`unknown aircraft ${frame.id}`];
  const required = mission.loadout.weaponId;
  const issued = mission.loadout.temporary && required && Object.hasOwn(WEAPONS, required) ? WEAPONS[required] : undefined;
  if (required && (!Object.hasOwn(WEAPONS, required) || (!issued && !config.mounts.some((mount) => mount.weaponId === required))))
    return [`aircraft ${frame.id} cannot mount ${required}`];
  if (issued && (!frame.hardpoints || !config.parts.some(({ id }) => id === "center_body")))
    return [`aircraft ${frame.id} cannot accept the mission mount`];
  const mounts = config.mounts.filter((mount) => !required || mount.weaponId === required);
  const errors: string[] = [];
  if (required && WEAPONS[required].eras && !WEAPONS[required].eras.includes(mission.era))
    errors.push(`weapon ${required} is unavailable in ${mission.era}`);
  for (const stage of mission.stages) {
    if (stage.goal?.type === "escort") continue;
    for (const target of stage.targets) {
      if (target.friendly) continue;
      const profile = npcProfileById(target.kind, mission.era);
      const layer = profile && combatantById(profile.combatantId)?.layer;
      const compatible = layer && ((issued && (issued.targetLayers ?? (issued.category === "area" ? ["ground", "water"] : ["air"])).includes(layer)) ||
        mounts.some((mount) => (!required || stage.prompt !== "lock" || WEAPONS[mount.weaponId].homing > 0) &&
          mount.targetLayers.includes(layer)));
      // A mandatory payload may coexist with the regular air armament in mixed missions.
      const compatibleAir = layer === "air" && stage.prompt !== "lock" && stage.prompt !== "gun" &&
        config.mounts.some((mount) => mount.targetLayers.includes("air"));
      if (layer && !compatible && !compatibleAir) errors.push(`no compatible weapon for ${target.id} (${layer})`);
    }
  }
  return errors;
}

export function validateCampaignMissions(missions: readonly CampaignMission[], routes: Route[] = createDefaultRoutes()) {
  const errors: string[] = [];
  const ids = new Set<string>();
  const orders = new Set<number>();
  for (const mission of missions) {
    const report = (error: string) => errors.push(`${mission.id}: ${error}`);
    if (!mission.id || ids.has(mission.id)) report("duplicate or empty mission ID");
    ids.add(mission.id);
    if (orders.has(mission.order) || !Number.isInteger(mission.order) || mission.order < 1) report("duplicate or invalid mission order");
    orders.add(mission.order);
    if (!Object.hasOwn(ERAS, mission.era)) report(`unknown era ${mission.era}`);
    const stages = new Map(mission.stages.map((stage) => [stage.id, stage]));
    if (stages.size !== mission.stages.length) report("duplicate stage ID");
    const reached = new Set<string>();
    for (let id: string | undefined = mission.firstStage; id;) {
      if (reached.has(id)) { report(`stage cycle at ${id}`); break; }
      const stage = stages.get(id);
      if (!stage) { report(`unknown stage ${id}`); break; }
      reached.add(id);
      id = stage.next;
    }
    const reachableStages = [...reached].map((id) => stages.get(id)!);
    const knownTargets = new Map<string, { config: NonNullable<ReturnType<typeof combatantById>>; target: MissionTarget }>();
    for (const stage of mission.stages)
      if (!reached.has(stage.id)) report(`unreachable stage ${stage.id}`);
    const priorTargets = new Map<string, MissionTarget>();
    for (const stage of reachableStages) {
      knownTargets.clear();
      const active = new Set<string>();
      for (const target of stage.targets) {
        if (active.has(target.id)) report(`duplicate target ${target.id} in ${stage.id}`);
        active.add(target.id);
        const profile = npcProfileById(target.kind, mission.era);
        const config = profile && combatantById(profile.combatantId);
        if (!config || config.era !== mission.era) { report(`unknown target ${target.kind} in ${mission.era}`); continue; }
        knownTargets.set(target.id, { config, target });
        const prior = priorTargets.get(target.id);
        if (prior && (prior.kind !== target.kind || Boolean(prior.friendly) !== Boolean(target.friendly)))
          report(`changed identity for carried target ${target.id}`);
        priorTargets.set(target.id, target);
        if (target.delay !== undefined && !(target.delay >= 0 && Number.isFinite(target.delay)))
          report(`invalid delay for ${target.id}`);
        if (target.health !== undefined && !(target.health > 0 && Number.isFinite(target.health)))
          report(`invalid health for ${target.id}`);
        if (target.weaponId && (!Object.hasOwn(WEAPONS, target.weaponId) ||
            (WEAPONS[target.weaponId].eras && !WEAPONS[target.weaponId].eras!.includes(mission.era))))
          report(`invalid weapon ${target.weaponId} for ${target.id}`);
        const place = target.placement;
        if ("at" in place && !validPoint(place.at) || "bearing" in place && !Number.isFinite(place.bearing))
          report(`invalid placement for ${target.id}`);
        if ("route" in place) {
          const route = routes.find((entry) => entry.id === place.route);
          if (!route || !config.capabilities.routeKinds.includes(route.kind) || !Number.isFinite(place.distance) ||
              place.distance < 0 || place.distance >= route.length) report(`invalid route or start for ${target.id}`);
          if (target.deadline && "routeDistance" in target.deadline &&
              (!route || !Number.isFinite(target.deadline.routeDistance) || target.deadline.routeDistance <= place.distance ||
                target.deadline.routeDistance > route.length))
            report(`invalid route deadline for ${target.id}`);
          if (target.shuttle && (!route || !(target.shuttle.end > place.distance) ||
              target.shuttle.end > route.length || !(target.shuttle.speed > 0 && Number.isFinite(target.shuttle.speed))))
            report(`invalid shuttle route for ${target.id}`);
        } else if (target.deadline && "routeDistance" in target.deadline) report(`missing deadline route for ${target.id}`);
        else if (target.shuttle) report(`missing shuttle route for ${target.id}`);
        if (target.motion && (!Number.isFinite(target.motion.speed) || target.motion.speed < 0 ||
            target.motion.points.some((point) => !validPoint(point)))) report(`invalid waypoint motion for ${target.id}`);
        if (target.deadline && "seconds" in target.deadline && !(target.deadline.seconds > 0 && Number.isFinite(target.deadline.seconds)))
          report(`invalid deadline for ${target.id}`);
        if (target.deadline && "pathEnd" in target.deadline &&
            (!target.motion?.points.length || !target.motion.speed || target.motion.loop)) report(`missing finite path for ${target.id}`);
      }
      if (!stage.goal && !stage.targets.some((target) => !target.friendly && !target.support))
        report(`no completion objective for ${stage.id}`);
      if (stage.goal) {
        const goal = stage.goal;
        const target = knownTargets.get(goal.target)?.target;
        if (!target) report(`unknown goal target ${goal.target}`);
        else if (goal.type === "escort") {
          const placement = target.placement;
          const route = "route" in placement ? routes.find(({ id }) => id === placement.route) : undefined;
          if (!target.friendly || (goal.routeDistance !== undefined ?
              !route || !("distance" in placement) || !(goal.routeDistance > placement.distance && goal.routeDistance <= route.length) :
              !target.motion?.points.length || !(target.motion.speed > 0) ||
                (goal.waypoint !== undefined && !(goal.waypoint > 0 && goal.waypoint <= target.motion.points.length))))
            report(`invalid escort destination for ${goal.target}`);
        } else if (target.friendly || !(goal.fraction > 0 && goal.fraction < 1)) report(`invalid damage goal for ${goal.target}`);
      }
      for (const target of stage.targets) {
        if (!target.attacks) continue;
        const defender = knownTargets.get(target.attacks);
        const attacker = knownTargets.get(target.id);
        const issued = target.weaponId && WEAPONS[target.weaponId];
        if (!defender?.target.friendly || !attacker || !(issued ?
          (issued.targetLayers ?? ["air"]).includes(defender.config.layer) :
          attacker.config.mounts.some((mount) => mount.targetLayers.includes(defender.config.layer))))
          report(`incompatible attacker ${target.id} for ${target.attacks}`);
      }
    }
    const { environment } = mission;
    if (!Object.hasOwn(WEATHER_PRESETS, environment.weather)) report(`unknown weather ${environment.weather}`);
    if (!Object.hasOwn(DAY_PERIODS, environment.period)) report(`unknown period ${environment.period}`);
    for (const [presets, transition] of [[WEATHER_PRESETS, environment.weatherTransition], [DAY_PERIODS, environment.periodTransition]] as const) {
      if (!transition) continue;
      if (!Object.hasOwn(presets, transition.to)) report(`unknown environment preset ${transition.to}`);
      const trigger = transition.trigger;
      if (!(transition.duration > 0 && Number.isFinite(transition.duration)) ||
          ("stage" in trigger ? !reached.has(trigger.stage) : !(trigger.elapsed >= 0 && Number.isFinite(trigger.elapsed))))
        report(`invalid transition to ${transition.to}`);
    }
    const eligible = mission.loadout.frameId ? AIRFRAMES.filter((frame) => frame.id === mission.loadout.frameId) : AIRFRAMES;
    if (!eligible.length) report(`unknown aircraft ${mission.loadout.frameId}`);
    else {
      const issues = eligible.map((frame) => validateMissionLoadout(mission, frame));
      if (issues.every((entry) => entry.length)) issues[0].forEach(report);
    }
  }
  return errors;
}

export function resolveMissionFrame(mission: CampaignMission, equipped: Airframe) {
  const frame = mission.loadout.frameId ? AIRFRAMES.find(({ id }) => id === mission.loadout.frameId) : equipped;
  if (!frame) throw new Error(`${mission.name}: unknown aircraft ${mission.loadout.frameId}`);
  const errors = validateMissionLoadout(mission, frame);
  if (errors.length) throw new Error(`${mission.name}: ${errors.join(", ")}`);
  return frame;
}
