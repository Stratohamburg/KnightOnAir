import { describe, expect, it } from "vitest";
import { AIRFRAMES, STARTER_FRAME_ID } from "../src/data/aircrafts";
import { CAMPAIGN_MISSIONS, missionIsUnlocked } from "../src/data/campaignMissions";
import { SaveStore } from "../src/services/Save";
import { validateCampaignMissions } from "../src/simulation/MissionValidation";
import { World } from "../src/simulation/World";
import { WEAPONS } from "../src/data/weapons";
import { edgeAnchors, type ThreatView } from "../src/content/2d/combatHints";
import { SortieEnvironment } from "../src/simulation/SortieEnvironment";
import { WindField } from "../src/simulation/WindField";
import { sortieLighting } from "../src/rendering/SortieLighting";
import { ERAS } from "../src/data/eras";
import { RULES } from "../src/data/config";
import { routePosition } from "../src/simulation/Routes";

describe("campaign preflight", () => {
  const [dawn, crosswind] = CAMPAIGN_MISSIONS;
  const equipped = AIRFRAMES.find((frame) => frame.id !== STARTER_FRAME_ID)!;

  it("resolves distinct sorties in the same era with their mission loadout", () => {
    expect(validateCampaignMissions(CAMPAIGN_MISSIONS)).toEqual([]);
    expect(dawn.id).not.toBe(crosswind.id);
    expect(dawn.era).toBe(crosswind.era);
    expect(new World(equipped, 42, { mission: dawn }).player.frame.id).toBe(STARTER_FRAME_ID);
  });

  it("rejects missing content, a stage cycle and an incompatible weapon before combat", () => {
    const [practice] = dawn.stages;
    const badMission = {
      ...dawn,
      stages: [{
        ...practice,
        next: practice.id,
        targets: [{ ...practice.targets[0], kind: "missing-target" }],
      }],
      loadout: { ...dawn.loadout, weaponId: "jet_air_missile" },
    };
    expect(() => new World(equipped, 42, { mission: badMission })).toThrow(
      /stage cycle[\s\S]*unknown target[\s\S]*cannot mount/,
    );
  });
});

describe("campaign outcome", () => {
  const [mission] = CAMPAIGN_MISSIONS;
  const [practice] = mission.stages;
  const frame = AIRFRAMES.find(({ id }) => id === STARTER_FRAME_ID)!;
  const makeWorld = () => new World(frame, 7, {
    supply: false,
    mission: {
      ...mission,
      stages: [
        { ...practice, targets: [practice.targets[0]], next: "follow-up" },
        { ...practice, id: "follow-up", targets: [practice.targets[1]] },
      ],
    },
  });

  it("counts the marked combat instance once and advances to a new stage", () => {
    const world = makeWorld();
    world.step(1 / 60);
    const ordinary = world.spawnEnemy("recon_balloon", 9, 20)!;
    world.damageEnemy(ordinary, 1000);
    expect(world.mission?.defeated).toBe(0);
    const marked = world.mission!.targets.get(practice.targets[0].id)!.actor!;
    world.damageEnemy(marked, 1000);
    world.mission!.destroyed(marked.id);
    world.damageEnemy(marked, 1000);
    expect(world.mission?.defeated).toBe(1);
    expect(world.kills).toBe(2);
    world.step(1 / 60);
    expect(world.mission?.completedStages).toBe(1);
    expect(world.mission?.defeated).toBe(0);
    expect(world.mission?.stage.id).toBe("follow-up");
    world.step(1 / 60);
    world.damageEnemy(world.mission!.targets.get(practice.targets[1].id)!.actor!, 1000);
    world.step(1 / 60);
    expect(world.mission?.result).toMatchObject({ missionId: mission.id, completedStages: 2, outcome: "victory" });
    world.end();
    expect(world.mission?.result?.outcome).toBe("victory");
  });

  it("records a crash before the final stage can complete in the same step", () => {
    const world = makeWorld();
    for (const target of practice.targets) {
      world.step(1 / 60);
      world.damageEnemy(world.mission!.targets.get(target.id)!.actor!, 1000);
      if (target === practice.targets[1]) world.damagePlayer(1000);
      world.step(1 / 60);
    }
    expect(world.phase).toBe("dying");
    expect(world.mission?.result).toMatchObject({ completedStages: 1, outcome: "aircraft_destroyed" });
  });
});

describe("required campaign encounters", () => {
  const frame = AIRFRAMES.find(({ id }) => id === STARTER_FRAME_ID)!;
  it.each(CAMPAIGN_MISSIONS.slice(0, 2))("places and activates each training target in sequence in $id", (mission) => {
    const world = new World(frame, 42, { mission, supply: false });
    const [first, second] = [...world.mission!.targets.values()];
    expect(first.actor).toBeDefined();
    expect(second.actor).toBeUndefined();
    const initial = first.actor!.x;
    for (let step = 0; step < 60; step++) world.step(1 / 60);
    if (mission.order === 1) expect(first.actor!.x).toBe(initial);
    else expect(first.actor!.x).toBeGreaterThan(initial + 1);
    world.damageEnemy(first.actor!, 1000);
    for (let step = 0; step < 20; step++) world.step(1 / 60);
    expect(second.actor?.health).toBeGreaterThan(0);
  });

  it("reserves a slot through ordinary spawn saturation and retries pending placement", () => {
    const [mission] = CAMPAIGN_MISSIONS;
    const [practice] = mission.stages;
    const world = new World(frame, 42, {
      mission: { ...mission, stages: [{
        ...practice, delay: 1, ambient: true,
        targets: [{ ...practice.targets[0], placement: { bearing: 0 } }],
      }] },
      supply: false,
    });
    world.isSpawnVisible = () => true;
    for (const kind of ["scout", "hunter", "recon_balloon"])
      for (let n = 0; n < 6; n++) world.spawnEnemy(kind, n * 3, 55);
    expect(world.enemies).toHaveLength(4);
    const [required] = world.mission!.targets.values();
    for (let step = 0; step < 90; step++) world.step(1 / 60);
    expect(required.actor).toBeUndefined();
    world.isSpawnVisible = () => false;
    for (let step = 0; step < 20; step++) world.step(1 / 60);
    expect(required.actor?.health).toBeGreaterThan(0);
    expect(world.enemies.filter(({ layer }) => layer === "air").length).toBeLessThanOrEqual(5);
  });
});

describe("campaign saves", () => {
  const [dawn, crosswind] = CAMPAIGN_MISSIONS;
  it("migrates the existing profile and unlocks only on first victory", () => {
    const equipped = AIRFRAMES.at(-1)!;
    let raw = JSON.stringify({ version: 2, equipped: equipped.id, unlocked: [equipped.id], currency: 314,
      bestScore: 186, bestTime: 28, sorties: 3, totalXp: 700, quality: "low", sound: false, vibration: false });
    const storage = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } };
    const save = new SaveStore(storage);
    expect(save.data).toMatchObject({ equipped: equipped.id, currency: 314, sorties: 3, totalXp: 700,
      quality: "low", sound: false, vibration: false, clearedMissions: [] });
    expect(missionIsUnlocked(dawn, save.data.clearedMissions)).toBe(true);
    expect(missionIsUnlocked(crosswind, save.data.clearedMissions)).toBe(false);
    for (const outcome of ["mission_failed", "retreat", "aircraft_destroyed"] as const) {
      const world = new World(equipped, 42, { mission: dawn });
      world.end(outcome);
      save.record(world);
      expect(save.data.clearedMissions).toEqual([]);
    }
    const world = new World(equipped, 42, { mission: dawn });
    world.coins = 10;
    world.score = 20;
    world.end("victory");
    save.record(world);
    save.record(world);
    expect(save.data).toMatchObject({ clearedMissions: [dawn.id], sorties: 7, currency: 324, missionBestScores: { [dawn.id]: 20 } });
    raw = JSON.stringify({ ...save.data, clearedMissions: ["unknown", null, dawn.id, dawn.id] });
    const reloaded = new SaveStore(storage);
    expect(reloaded.data.clearedMissions).toEqual([dawn.id]);
    expect(reloaded.data.missionBestScores[dawn.id]).toBe(20);
    expect(missionIsUnlocked(dawn, reloaded.data.clearedMissions)).toBe(true);
    expect(missionIsUnlocked(crosswind, reloaded.data.clearedMissions)).toBe(true);
  });
});

describe("campaign intercept deadlines", () => {
  const [mission] = CAMPAIGN_MISSIONS;
  const [practice] = mission.stages;
  const frame = AIRFRAMES.find(({ id }) => id === STARTER_FRAME_ID)!;
  it("starts a train deadline at placement and freezes it during pause and upgrades", () => {
    const world = new World(frame, 42, { mission: {
      ...mission, era: "ww1",
      stages: [{ ...practice, delay: 1, targets: [{
        ...practice.targets[0], kind: "supply_train", name: "补给列车",
        placement: { route: "rail-492", distance: 430 }, deadline: { routeDistance: 470 },
      }] }],
      loadout: { frameId: frame.id, weaponId: "ww1_light_bomb", temporary: true },
    } });
    const run = world.mission!;
    expect(world.bombWeapon?.id).toBe("ww1_light_bomb");
    expect(world.player.parts.some(({ id }) => id === "bay")).toBe(true);
    const [target] = run.targets.values();
    expect(run.deadline(target, world.elapsed)).toBeUndefined();
    for (let n = 0; n < 76; n++) world.step(1 / 60);
    const before = run.deadline(target, world.elapsed);
    expect(before?.seconds).toBeGreaterThan(0);
    world.pause();
    world.frame(.1);
    expect(run.deadline(target, world.elapsed)).toEqual(before);
    world.resume();
    world.upgradesAvailable = 1;
    expect(world.openUpgrades()).toBe(true);
    world.frame(.1);
    expect(run.deadline(target, world.elapsed)).toEqual(before);
  });

  it.each([false, true])("resolves damage before checking a path boundary (destroyed = %s)", (destroyed) => {
    const world = new World(frame, 42, { mission: {
      ...mission, stages: [{ ...practice, targets: [{
        ...practice.targets[0], motion: { points: [{ x: 0, z: 26 }], speed: 60 }, deadline: { pathEnd: true },
      }] }],
    } });
    const [target] = world.mission!.targets.values();
    if (destroyed) world.damageEnemy(target.actor!, 1000);
    world.step(1 / 60);
    expect(world.mission?.result?.outcome).toBe(destroyed ? "victory" : "mission_failed");
  });
});

it("carries the same boss into the next stage and retires older mission targets", () => {
  const [base] = CAMPAIGN_MISSIONS;
  const [practice] = base.stages;
  const [boss, guard] = practice.targets;
  const world = new World(AIRFRAMES[0], 42, { mission: {
    ...base, stages: [
      { ...practice, sequential: false, targets: [boss, guard], next: "final",
        goal: { type: "damage", target: boss.id, fraction: .5,
          redirect: { points: [{ x: 20, z: 25 }], speed: 4 } } },
      { ...practice, id: "final", prompt: undefined, targets: [boss] },
    ],
  } });
  const run = world.mission!;
  const bossActor = run.targets.get(boss.id)!.actor!;
  const guardActor = run.targets.get(guard.id)!.actor!;
  run.practiced = true;
  world.damageEnemy(bossActor, bossActor.health * .65);
  world.step(1 / 60);
  expect(run.stage.id).toBe("final");
  expect(run.practiced).toBe(false);
  expect(run.targets.get(boss.id)?.actor).toBe(bossActor);
  expect(run.targetFor(guardActor.id)).toBeUndefined();
  expect(world.enemies).not.toContain(guardActor);
  for (let n = 0; n < 60; n++) world.step(1 / 60);
  expect(bossActor.x).toBeGreaterThan(0);
  expect(run.completedStages).toBe(1);
});

it("retains a surface objective and an immediate threat when both leave the screen", () => {
  const contact = (id: number, layer: ThreatView["layer"], bearing: number, extra: Partial<ThreatView>): ThreatView =>
    ({ id, x: 0, y: 0, z: 0, layer, distance: 40, bearing, ...extra });
  const train = contact(1, "ground", -.6, { missionName: "补给列车", urgency: .95 });
  const ship = contact(2, "water", 1.2, { missionName: "运输船", friendly: true });
  const attacker = contact(3, "air", .2, { firing: true });
  const bounds = { left: 0, top: 80, right: 390, bottom: 680 };
  expect(edgeAnchors([train, ship, attacker], bounds, 2).map(({ id }) => id)).toEqual([1, 3]);
  expect(edgeAnchors([{ ...train, onScreen: true }, ship, attacker], bounds, 2)).toMatchObject([
    { id: 2, missionName: "运输船", friendly: true }, { id: 3 },
  ]);
});

describe("sortie environment", () => {
  const frame = AIRFRAMES.find(({ id }) => id === STARTER_FRAME_ID)!;
  const snapshot = (world: World) => [world.elapsed, { ...world.environment.weather }, world.environment.hour,
    world.wind.sample(12, -22), world.player.x, world.player.z, world.mission?.result];

  it("preserves the original patrol wind and reduces wind on the range", () => {
    const patrol = new World(frame, 7, { director: false });
    const dawn = new World(frame, 7, { mission: CAMPAIGN_MISSIONS[0] });
    const wind = new WindField();
    for (let step = 0; step < 60; step++) {
      patrol.step(1 / 60);
      dawn.step(1 / 60);
      wind.update(1 / 60);
    }
    expect(patrol.wind.sample(10, 15)).toEqual(wind.sample(10, 15));
    expect(Math.hypot(...Object.values(dawn.wind.sample(10, 15)))).toBeLessThan(.1);
  });

  it("replays weather and daylight identically at 30, 60 and 120 fps", () => {
    const mission = { ...CAMPAIGN_MISSIONS[0], environment: {
      weather: "clear", period: "dusk",
      weatherTransition: { to: "gusts", duration: 4, trigger: { elapsed: 2 } },
      periodTransition: { to: "night", duration: 4, trigger: { elapsed: 2 } },
    } } as const;
    const replay = (fps: number) => {
      const world = new World(frame, 7, { mission });
      for (let n = 0; n < 4 * fps; n++) world.frame(1 / fps);
      const before = snapshot(world);
      world.pause();
      world.frame(.1);
      expect(snapshot(world)).toEqual(before);
      return before;
    };
    expect(replay(30)).toEqual(replay(60));
    expect(replay(120)).toEqual(replay(60));
    const retry = new World(frame, 7, { mission });
    expect(retry.environment.weatherId).toBe("clear");
    expect(retry.environment.period).toBe("dusk");
  });

  it("starts stage weather once and crosses midnight continuously", () => {
    const env = new SortieEnvironment({ weather: "clear", period: "night",
      weatherTransition: { to: "overcast", duration: 2, trigger: { stage: "air" } },
      periodTransition: { to: "dawn", duration: 8, trigger: { elapsed: 1 } },
    });
    expect(env.update(1, "ground")).toEqual([]);
    expect(env.update(2, "air")).toEqual(["多云"]);
    expect(env.update(3, "air")).toEqual([]);
    expect(env.weather.cloud).toBeGreaterThan(.65);
    expect(env.weather.cloud).toBeLessThan(1.45);
    const hours = [env.hour];
    for (let time = 4; time <= 9; time++) {
      env.update(time, "air");
      hours.push(env.hour);
    }
    expect(hours).toEqual([...hours].sort((a, b) => a - b));
    expect(hours.at(-1)).toBe(30.6);
    expect(env.period).toBe("dawn");
  });

  it("keeps shadow inputs finite and attenuates sunlight across the horizon", () => {
    const evaluate = (hour: number) => sortieLighting(hour, 1.45, .79, ERAS.ww2.colors);
    const [dawn, day, dusk, night] = [6.6, 12, 17.8, 21].map(evaluate);
    expect(new Set([dawn, day, dusk, night].map(({ colors }) => colors.skyHorizon)).size).toBe(4);
    expect(day.shade).toBeGreaterThan(dusk.shade);
    expect(night.shade).toBe(0);
    expect(night.ambient).toBeGreaterThan(.3);
    expect(evaluate(17.99).sun.distanceTo(evaluate(18.01).sun)).toBeLessThan(.02);
  });
});

describe("authored campaign sorties", () => {
  const launch = (order: number) => new World(AIRFRAMES[0], 42, {
    mission: CAMPAIGN_MISSIONS.find((mission) => mission.order === order)!, supply: false,
  });
  const tick = (world: World, seconds: number) => {
    for (let n = 0; n < Math.round(seconds / RULES.step); n++) world.step(RULES.step);
  };
  function clearStage(world: World) {
    const run = world.mission!;
    const stage = run.stage;
    for (let step = 0; step < 420 && stage === run.stage && !run.result; step++) {
      for (const { actor, config } of run.targets.values())
        if (actor && !config.friendly && !config.support && actor.health > 0) world.damageEnemy(actor, 9000);
      world.step(RULES.step);
    }
  }

  it.each([1, 2])("can fly the actual firing arc and clear gun training %s", (order) => {
    const world = launch(order);
    const run = world.mission!;
    for (let n = 0; n < 60 * 55 && !run.result; n++) {
      const actor = [...run.targets.values()].find(({ actor }) => actor && actor.health > 0)?.actor;
      if (!actor) {
        world.step(RULES.step);
        continue;
      }
      const x = actor.x - world.player.x, z = actor.z - world.player.z;
      const d = Math.hypot(x, z);
      world.step(RULES.step, { x: x / d, z: z / d, magnitude: .5, active: true });
    }
    expect(run.practiced).toBe(true);
    expect(run.defeated).toBe(2);
    expect(run.result?.outcome).toBe("victory");
  });

  it("reaches the same terminal score and objective outcome at different render rates", () => {
    const replay = (fps: number) => {
      const world = launch(2);
      const run = world.mission!;
      for (let n = 0; n < 55 * fps && !run.result; n++) {
        world.frame(1 / fps, () => {
          const actor = [...run.targets.values()].find(({ actor }) => actor && actor.health > 0)?.actor;
          if (!actor) return { x: 0, z: 1, active: false, magnitude: 0 };
          const x = actor.x - world.player.x, z = actor.z - world.player.z;
          const d = Math.hypot(x, z);
          return { x: x / d, z: z / d, active: true, magnitude: .5 };
        });
      }
      expect(run.result?.outcome).toBe("victory");
      return { result: run.result, score: world.score, kills: world.kills, elapsed: world.elapsed };
    };
    const standard = replay(60);
    expect(replay(30)).toEqual(standard);
    expect(replay(120)).toEqual(standard);
  });

  it("gives the chapter-one patrol a returning gun and a real fire window", () => {
    const world = launch(3);
    world.player.invulnerable = 100;
    for (let n = 0; n < 1500 && !world.telemetry.events.some(({ type }) => type === "player_damage"); n++)
      world.step(RULES.step, { x: 1, z: 0, active: true, magnitude: .1 });
    const [target] = world.mission!.targets.values();
    expect(target.actor?.weapons[0].config.damage).toBeGreaterThan(0);
    expect(world.projectiles.items.some((shot) => shot.team === "enemy")).toBe(true);
  });

  it.each([4, 5, 7, 13])("provides an operational payload for sortie %s", (order) => {
    const world = launch(order);
    const [target] = world.mission!.targets.values();
    const enemy = target.actor!;
    const initial = { x: enemy.x, z: enemy.z };
    world.toggleBombing();
    world.player.x = enemy.x;
    world.player.z = enemy.z - 9;
    world.player.heading = 0;
    world.stability = 1;
    world.aim = { ...initial };
    expect(world.dropBomb()).toBe(true);
    tick(world, 1.5);
    expect(world.bombsHit).toBe(1);
    expect(enemy.health).toBeLessThan(enemy.maxHealth);
    if (order === 5) expect(enemy.z).not.toBe(initial.z);
  });

  it("dispatches the second wave from the authored bearing and retains the relay until both waves are clear", () => {
    const waves = launch(6);
    clearStage(waves);
    expect(waves.mission?.stage.id).toBe("rear");
    tick(waves, .5);
    for (const { actor } of waves.mission!.targets.values()) {
      const bearing = Math.atan2(actor!.x - waves.player.x, actor!.z - waves.player.z);
      expect(Math.abs(bearing)).toBeGreaterThan(1.5);
    }
    clearStage(waves);
    expect(waves.mission?.result?.outcome).toBe("victory");
    const defense = launch(8);
    const relay = defense.mission?.targets.get("relay")?.actor;
    clearStage(defense);
    expect(defense.mission?.targets.get("relay")?.actor).toBe(relay);
    clearStage(defense);
    expect(defense.mission?.result?.outcome).toBe("victory");
  });

  it("fails the train at the route boundary and completes both branches of ship escort", () => {
    const train = launch(7);
    const rail = train.mission!.targets.get("train")!.actor!;
    rail.routeDistance = 509.99;
    train.step(RULES.step);
    expect(train.mission?.result?.outcome).toBe("mission_failed");
    const escort = launch(14);
    const ship = escort.mission!.targets.get("transport")!.actor!;
    ship.routeDistance = 424;
    escort.step(RULES.step);
    expect(escort.mission?.stage.id).toBe("torpedo");
    expect(escort.mission?.targets.get("transport")?.actor).toBe(ship);
    tick(escort, .5);
    const torpedo = escort.mission?.targets.get("torpedo")?.actor;
    expect(torpedo?.weapons[0].config.targetLayers).toEqual(["water"]);
    ship.routeDistance = 457;
    escort.step(RULES.step);
    expect(escort.mission?.result?.outcome).toBe("victory");
    const lost = launch(14);
    lost.damageEnemy(lost.mission!.targets.get("transport")!.actor!, 9000);
    lost.step(RULES.step);
    expect(lost.mission?.result?.outcome).toBe("mission_failed");
  });

  it("flies the authored escort path with ordinary flight integration", () => {
    const world = launch(9);
    const run = world.mission!;
    const actor = run.targets.get("recon")!.actor!;
    for (let n = 0; n < 60 * 75 && !run.result; n++) {
      const x = actor.x - world.player.x, z = actor.z - world.player.z, d = Math.hypot(x, z);
      world.step(RULES.step, { x: x / d, z: z / d, magnitude: .35, active: true });
    }
    expect(run.targets.get("recon")?.waypoint).toBe(2);
    expect(run.result?.outcome).toBe("victory");
  });

  it("activates the chapter-two ace after the guards and keeps the chapter-three boss after half health", () => {
    const ace = launch(10);
    clearStage(ace);
    expect(ace.mission?.stage.id).toBe("ace");
    tick(ace, .5);
    expect(ace.mission?.targets.get("ace")?.actor?.kind).toBe("fighter_ace");
    clearStage(ace);
    expect(ace.mission?.result?.outcome).toBe("victory");
    const boss = launch(15);
    tick(boss, .5);
    const actor = boss.mission!.targets.get("gunship")!.actor!;
    boss.damageEnemy(actor, 101);
    boss.step(RULES.step);
    expect(boss.mission?.stage.id).toBe("showdown");
    expect(boss.mission?.targets.get("gunship")?.actor).toBe(actor);
    clearStage(boss);
    expect(boss.mission?.result?.outcome).toBe("victory");
  });

  it("builds a weapon lock and resolves a guided hit without changing player steering", () => {
    const world = launch(16);
    const control = launch(16);
    const target = control.mission!.targets.get("balloon")!.actor!;
    control.enemies = [];
    expect(target.health).toBeGreaterThan(0);
    tick(world, .5);
    tick(control, .5);
    expect(world.mainLock!.lockProgress).toBeGreaterThan(.3);
    expect(world.mainLock!.lockProgress).toBeLessThan(.8);
    tick(world, .6);
    tick(control, .6);
    const shot = world.projectiles.items.find(({ active, team, kind }) => active && team === "player" && kind === "missile");
    expect(shot?.targetId).toBe(world.mission?.targets.get("balloon")?.actor?.id);
    expect([world.player.x, world.player.z, world.player.heading]).toEqual([control.player.x, control.player.z, control.player.heading]);
    tick(world, 3.2);
    expect(world.mission?.stage.id).toBe("interceptor");
  });

  it("stages the radar weather shift and the three-part finale", () => {
    const radar = launch(12);
    clearStage(radar);
    expect(radar.mission?.stage.id).toBe("air");
    tick(radar, 3);
    expect(radar.environment.weatherId).toBe("overcast");
    expect(radar.environment.weather.cloud).toBeGreaterThan(.65);
    const finale = launch(20);
    clearStage(finale);
    expect(finale.mission?.stage.id).toBe("intercept");
    expect(finale.mission?.targets.get("raider")?.actor).toBeUndefined();
    tick(finale, 4.5);
    expect(finale.environment.hour).toBeGreaterThan(17.8);
    clearStage(finale);
    expect(finale.mission?.stage.id).toBe("ace");
    clearStage(finale);
    expect(finale.mission?.result).toMatchObject({ completedStages: 3, outcome: "victory" });
  });

  it("sets the appropriate training environments and keeps all water targets on the river", () => {
    for (const order of [1, 2, 4, 5, 13, 16]) {
      const world = launch(order);
      expect(world.environment.config.weather).toBe("clear");
      expect(world.environment.period).toBe(order === 1 ? "dawn" : "day");
    }
    const world = launch(14);
    const ship = world.mission!.targets.get("transport")!.actor!;
    const route = world.routes.find(({ id }) => id === ship.routeId)!;
    expect(route.kind).toBe("water");
    const position = routePosition(route, ship.routeDistance!);
    expect([ship.x, ship.z]).toEqual([position.x, position.z]);
    expect(world.environment.weather.rain).toBeGreaterThan(0);
    expect(launch(19).environment.period).toBe("night");
  });

  it("follows the stationary water target with a moving target", () => {
    const world = launch(13);
    const docked = world.mission!.targets.get("boat")!.actor!;
    const start = docked.routeDistance;
    tick(world, 1);
    expect(docked.routeDistance).toBe(start);
    clearStage(world);
    expect(world.mission?.stage.id).toBe("moving");
    tick(world, .5);
    const moving = world.mission!.targets.get("ship")!.actor!;
    const distance = moving.routeDistance!;
    tick(world, 1);
    expect(moving.routeDistance).toBeGreaterThan(distance);
    clearStage(world);
    expect(world.mission?.result?.outcome).toBe("victory");
  });

  it("spawns multiple bombers, supports clearing or breaching the crossing, and exposes missile-truck warnings", () => {
    const intercept = launch(11);
    intercept.player.weapons.length = 0;
    tick(intercept, 7.5);
    const active = [...intercept.mission!.targets.values()].filter(({ actor }) => actor?.health);
    expect(active).toHaveLength(3);
    expect(active.every((target) => intercept.mission!.deadline(target, intercept.elapsed)!.seconds > 0)).toBe(true);
    clearStage(intercept);
    expect(intercept.mission?.result?.outcome).toBe("victory");
    const speed = launch(17);
    tick(speed, 30);
    expect(speed.mission?.result?.outcome).toBe("mission_failed");
    const batteries = launch(18);
    const first = batteries.mission!.targets.get("sam-a")!.actor!;
    expect(first.weapons.some(({ config }) => config.lockTime > 0 && config.homing > 0)).toBe(true);
    clearStage(batteries);
    tick(batteries, .5);
    expect(batteries.mission!.targets.get("cover")?.actor?.health).toBeGreaterThan(0);
    clearStage(batteries);
    expect(batteries.mission?.result?.outcome).toBe("victory");
  });

  it("keeps the nighttime transport in the second leg and publishes the second attacker", () => {
    const world = launch(19);
    const run = world.mission!;
    const transport = run.targets.get("transport-plane")!;
    expect(world.environment.period).toBe("night");
    for (let n = 0; n < 60 * 25 && run.stage.id === "runway"; n++) {
      const attacker = run.targets.get("front")?.actor;
      if (attacker?.health) world.damageEnemy(attacker, 9000);
      world.step(RULES.step);
    }
    expect(run.stage.id).toBe("coast");
    expect(run.targets.get("transport-plane")).toBe(transport);
    tick(world, .5);
    expect(run.targets.get("flank")?.actor?.kind).toBe("jet_bomber");
  });
});

describe("campaign escorts", () => {
  const [base] = CAMPAIGN_MISSIONS;
  const [practice] = base.stages;
  const frame = AIRFRAMES.find(({ id }) => id === STARTER_FRAME_ID)!;
  const escortWorld = () => new World(frame, 42, { mission: {
    ...base, era: "ww1", stages: [{
      ...practice, prompt: undefined, sequential: false, goal: { type: "escort", target: "friend" },
      targets: [
        { ...practice.targets[0], id: "friend", name: "侦察机", kind: "scout", friendly: true,
          motion: { points: [{ x: 0, z: 90 }], speed: 2 } },
        { ...practice.targets[1], id: "attacker", kind: "hunter", attacks: "friend", placement: { at: { x: 0, z: 41 } } },
      ],
    }],
  } });

  it("lets an assigned hostile harm an ally while player fire excludes the ally", () => {
    const world = escortWorld();
    const friend = world.mission!.targets.get("friend")!.actor!;
    const attacker = world.mission!.targets.get("attacker")!.actor!;
    const openingHealth = friend.health;
    attacker.cooldown = 0;
    for (let n = 0; n < 60 * 14 && friend.health === openingHealth; n++) world.step(1 / 60);
    expect(friend.health).toBeLessThan(openingHealth);
    expect(world.kills).toBe(0);
    expect(world.consumeEvents()).not.toContainEqual(expect.objectContaining({ type: "weapon_fired", owner: "player" }));
  });

  it("fails when a friendly is destroyed on the same step it reaches the last waypoint", () => {
    const world = escortWorld();
    const friend = world.mission!.targets.get("friend")!;
    friend.waypoint = 1;
    world.shoot(friend.actor!.x, friend.actor!.z - 1, 0, { ...WEAPONS.light_cannon, speed: 60, damage: 1000 },
      "enemy", friend.actor!.id, "bullet", 24);
    world.step(1 / 60);
    expect(world.mission?.result).toMatchObject({ outcome: "mission_failed", detail: "侦察机已被摧毁" });
  });
});
