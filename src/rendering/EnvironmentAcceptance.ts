import { Vector3 } from "three";
import { airframeById } from "../data/aircrafts";
import { RULES, type Quality } from "../data/config";
import { World } from "../simulation/World";
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
      effects: world.effects.count,
    };
  }

  function draw(dt = 0, live = false) {
    if (live) world.frame(dt);
    else if (world.clock.timeScale > 0) world.wind.update(dt);
    const start = performance.now();
    renderer.render(world, dt, { display: false });
    const result = { frameCpuMs: performance.now() - start, ...report() };
    renderer.canvas.dataset.frame = JSON.stringify({
      quality: result.quality,
      calls: result.calls,
      triangles: result.triangles,
      resolution: result.resolution,
      bombing: world.isBombing,
    });
    return result;
  }

  function setup(next: Scene, quality: Quality = "standard") {
    scene = next;
    const battle = next === "battle";
    const frame = battle ? "raptor_14" : next === "terrain" ? "courier_02" : "wasp_04";
    world = new World(airframeById(frame), 491, { director: false });
    renderer.setPlayer(world.player);
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
        if (i < 12) world.effect(i % 7 - 3, 5 + i, "hit", 1.2, .75);
      }
    }

    if (next === "occlusion") {
      world.spawnEnemy("mobile_artillery", 0, 11);
      const ground = world.enemies.find((enemy) => enemy.layer === "ground")!;
      unit = new Vector3(ground.x, world.surfaceHeight(ground.x, ground.z) + .55, ground.z);
      frameBattleCamera(renderer.camera, 0, 0, 0);
      fixture.camera = renderer.camera.position.clone().add(new Vector3(28, -9, 0));
      fixture.lookAt = unit.clone();
      const lock = world.mainLock;
      if (lock) {
        lock.targetId = ground.id;
        lock.lockProgress = .9;
      }
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
    flight(x: number, z: number, bombing: boolean, dt = 1 / 60) {
      fixture.camera = fixture.lookAt = undefined;
      world.player.x = world.player.prevX = x;
      world.player.z = world.player.prevZ = z;
      if (world.isBombing !== bombing) world.toggleBombing();
      world.aim.x = x;
      world.aim.z = z + 13;
      return draw(dt);
    },
    surface(x: number, z: number) { return world.surfaceHeight(x, z); },
  };
  Object.assign(window, { __koa: { renderer, environment } });
  const params = new URLSearchParams(location.search);
  if (params.get("environmentTest") === "terrain") {
    const quality = params.get("quality");
    setup("terrain", quality === "low" || quality === "high" ? quality : "standard");
    fixture.clouds = params.get("clouds") !== "off";
    fixture.cloudShadows = params.get("cloudShadows") !== "off";
    const bombing = params.get("view") === "bombing";
    environment.flight(0, bombing ? 7 : -4, bombing, .5);
  } else {
    setup("battle");
  }
}
