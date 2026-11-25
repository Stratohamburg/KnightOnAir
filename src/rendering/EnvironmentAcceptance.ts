import { Vector3 } from "three";
import { airframeById, STARTER_FRAME_ID } from "../data/aircrafts";
import { RULES, type Quality } from "../data/config";
import { upgradeById } from "../data/upgrades";
import { WEAPONS } from "../data/weapons";
import { World } from "../simulation/World";
import type { CombatSnapshot, WorldEvent } from "../simulation/types";
import { frameBattleCamera } from "./BattleCamera";
import { placeVegetation } from "./VegetationField";
import { cloudDiagnostics, environmentFixture, environmentState, type EnvironmentFixture } from "./RenderDiagnostics";
import { Renderer } from "./Renderer";

type Scene = "occlusion" | "cloudscape" | "grass" | "tree" | "battle" | "terrain";

export function mountEnvironmentAcceptance(root: HTMLElement) {
  const host = document.createElement("div");
  host.className = "scene-host";
  host.style.cssText = "position:fixed;inset:0;z-index:0";
  root.replaceChildren(host);
  const renderer = new Renderer(host);
  const fixture: EnvironmentFixture = { clouds: true };
  environmentFixture.set(renderer, fixture);
  const gl = renderer.renderer.getContext();
  let world: World;
  let scene: Scene;
  let treeRoot: Vector3 | undefined;
  let unit: Vector3 | undefined;
  let displayEvents: WorldEvent[] = [];

  function report() {
    const cloud = cloudDiagnostics.get(renderer)!;
    return {
      scene,
      quality: renderer.quality,
      ...renderer.frameMetrics,
      ...environmentState.get(renderer),
      cloud: { ...cloud, resolution: [...cloud.resolution] },
      memory: { ...renderer.renderer.info.memory, programs: renderer.renderer.info.programs?.length },
      resolution: [gl.drawingBufferWidth, gl.drawingBufferHeight],
      enemies: world.enemies.length,
      projectiles: world.projectiles.count,
      effects: renderer.diagnostics.effects,
      content: renderer.diagnostics.content,
    };
  }

  function draw(dt = 0, live = false) {
    if (live) world.frame(dt);
    else if (world.clock.timeScale > 0) world.wind.update(dt);
    const start = performance.now();
    renderer.render(world, dt, { display: false, events: [...world.consumeEvents(), ...displayEvents] });
    displayEvents = [];
    const result = { frameCpuMs: performance.now() - start, ...report() };
    renderer.canvas.dataset.frame = JSON.stringify({
      quality: result.quality,
      calls: result.calls,
      triangles: result.triangles,
      resolution: result.resolution,
      bombing: world.isBombing,
      cloud: result.cloud,
    });
    return result;
  }

  function setup(next: Scene, quality: Quality = "standard") {
    scene = next;
    const battle = next === "battle";
    world?.dispose();
    world = new World(airframeById(STARTER_FRAME_ID), 491, { director: false, missionEra: battle ? "ww2" : "jet" });
    if (!battle) world.installUpgrade(upgradeById("bomb_bay")!);
    const modelError = renderer.setPlayer(world.player);
    if (modelError) throw new Error(modelError);
    renderer.setQuality(quality);
    world.wind.update(52);
    fixture.camera = fixture.lookAt = undefined;
    fixture.cloudShadows = undefined;
    fixture.clouds = battle || next === "cloudscape" || next === "occlusion" || next === "terrain";
    treeRoot = unit = undefined;

    if (battle) {
      const enemies = [
        "interceptor", "heavy_fighter", "bomber", "escort", "striker", "elite",
        "aa_truck", "fuel_truck", "armored_train", "mobile_artillery", "supply_train", "radar_truck",
      ];
      for (const [index, kind] of enemies.entries()) {
        world.spawnEnemy(kind, (index % 5 - 2) * 4, 7 + Math.floor(index / 5) * 5);
      }
      const weapon = world.player.weapons[0].config;
      for (let i = 0; i < RULES.maxProjectiles; i++) {
        world.shoot(i % 14 - 7, 3 + i / 7, 0, weapon, i % 2 ? "player" : "enemy");
        if (i < 12) world.effect(i % 7 - 3, 5 + i, "burst", 1.2, .75);
      }
    }

    if (next === "occlusion") {
      world.spawnEnemy("mobile_artillery", 0, 11);
      const ground = world.enemies.find((enemy) => enemy.layer === "ground")!;
      unit = new Vector3(ground.x, world.surfaceHeight(ground.x, ground.z) + .55, ground.z);
      frameBattleCamera(renderer.camera, 0, 0, 0);
      fixture.camera = renderer.camera.position.clone().add(new Vector3(28, -9, 0));
      fixture.lookAt = unit.clone();
      world.player.weapons.push({
        ...world.player.weapons[0], config: WEAPONS.lock_missile,
        targetId: ground.id, lockProgress: .9,
      });
    }

    if (next === "cloudscape") {
      world.spawnEnemy("mobile_artillery", -9, 151);
    }

    if (next === "tree") {
      const tree = placeVegetation(0, 0, world.terrainSeed, true)
        .reduce((nearest, plant) => Math.hypot(plant.x, plant.z) < Math.hypot(nearest.x, nearest.z) ? plant : nearest);
      treeRoot = new Vector3(tree.x, tree.y, tree.z);
      fixture.camera = treeRoot.clone().add(new Vector3(3, 2.8, -6.8));
      fixture.lookAt = treeRoot.clone().add(new Vector3(0, 1.15, 0));
    }
    return draw(.4);
  }

  function advance(dt = 1 / 60, live = false) {
    return draw(dt, live);
  }

  const environment = {
    setup,
    advance,
    report,
    pause(paused: boolean) { world.clock.timeScale = paused ? 0 : 1; },
    soak(dt: number, time: number, burst: boolean) {
      world.player.x = world.player.prevX = 8 * Math.sin(time * .14);
      world.player.z = world.player.prevZ = 8 * Math.sin(time * .11);
      for (const enemy of world.enemies) {
        if (enemy.layer === "air") {
          enemy.heading += dt * .17;
          enemy.bank = Math.sin(time * .7 + enemy.id) * .5;
        }
      }
      for (const [index, projectile] of world.projectiles.items.entries()) {
        if (!projectile.active) continue;
        projectile.z = 4 + ((index / 7 + time * projectile.speed) % 22);
        projectile.heading = .2 * Math.sin(time + index % 5);
      }
      return burst ? environment.combatEffects(dt) : draw(dt);
    },
    combatEffects(dt = 1 / 60) {
      const weaponIds = ["machinegun", "light_cannon", "rocket_pod", "lock_missile"];
      for (const [index, weaponId] of weaponIds.entries()) {
        const snapshot: CombatSnapshot = {
          position: { x: (index - 1.5) * 3.2, y: RULES.flightAltitude + .2, z: 3 },
          direction: { x: 0, y: .08, z: 1 }, velocity: { x: 0, y: 0, z: 0 },
          heading: 0, bank: 0, weaponId, damageType: index < 2 ? "kinetic" : "explosive",
        };
        displayEvents.push({ type: "weapon_fired", time: world.elapsed, owner: "player", entityId: "player", anchorId: weaponId, snapshot });
        displayEvents.push({ type: "enemy_hit", time: world.elapsed, enemyId: -1, amount: 10,
          snapshot: { ...snapshot, position: { ...snapshot.position, z: 9 } } });
      }
      return draw(dt);
    },
    frame() {
      draw();
      return renderer.canvas.toDataURL("image/png");
    },
    position() {
      return { unit: unit?.toArray(), treeRoot: treeRoot?.toArray() };
    },
    project(x: number, y: number, z: number) {
      const point = new Vector3(x, y, z).project(renderer.camera);
      return [(point.x + 1) * .5 * gl.drawingBufferWidth, (point.y + 1) * .5 * gl.drawingBufferHeight];
    },
    camera(x: number, y: number, z: number, targetX: number, targetY: number, targetZ: number) {
      fixture.camera = new Vector3(x, y, z);
      fixture.lookAt = new Vector3(targetX, targetY, targetZ);
      return draw();
    },
    clouds(visible: boolean) {
      fixture.clouds = visible;
      return draw();
    },
    flight(x: number, z: number, bombing: boolean, dt = 1 / 60, velocityX = 0, velocityZ = 0) {
      fixture.camera = fixture.lookAt = undefined;
      world.player.x = world.player.prevX = x;
      world.player.z = world.player.prevZ = z;
      // The acceptance fixture can place the aircraft without advancing the
      // simulation, so expose its local velocity for cloud-body and wake checks.
      world.player.vx = velocityX;
      world.player.vz = velocityZ;
      if (world.isBombing !== bombing) world.toggleBombing();
      world.aim.x = x;
      world.aim.z = z + 13;
      return draw(dt);
    },
    surface(x: number, z: number) { return world.surfaceHeight(x, z); },
  };
  Object.assign(window, { __koa: { renderer, environment } });
  const params = new URLSearchParams(location.search);
  const requestedScene = params.get("scene");
  const initialScene: Scene = requestedScene === "occlusion" || requestedScene === "cloudscape" ||
    requestedScene === "grass" || requestedScene === "tree" || requestedScene === "terrain" || requestedScene === "battle"
    ? requestedScene
    : "battle";
  if (params.get("environmentTest") === "terrain") {
    const quality = params.get("quality");
    setup("terrain", quality === "low" || quality === "high" ? quality : "standard");
    fixture.clouds = params.get("clouds") !== "off";
    fixture.cloudShadows = params.get("cloudShadows") !== "off";
    const bombing = params.get("view") === "bombing";
    environment.flight(0, bombing ? 7 : -4, bombing, .5);
  } else {
    setup(initialScene);
    if (initialScene === "cloudscape" || initialScene === "terrain") {
      const x = Number(params.get("x") ?? 0);
      const z = Number(params.get("z") ?? -10);
      const velocityX = Number(params.get("velocityX") ?? 0);
      const velocityZ = Number(params.get("velocityZ") ?? 0);
      environment.flight(x, z, params.get("bombing") === "1", .5, velocityX, velocityZ);
    }
  }
}
