import * as THREE from "three";
import { RULES, QUALITIES, type Quality } from "../data/config";
import { eraOf } from "../data/aircrafts";
import { ERAS } from "../data/eras";
import { routeHeight } from "../simulation/Routes";
import { clamp, damp, RAD } from "../services/Random";
import { World } from "../simulation/World";
import { lineExtension } from "../simulation/CenterlineLayout";
import { surfaceHeight } from "../simulation/Terrain";
import type { Player, Enemy, WorldEvent } from "../simulation/types";
import { ProceduralAircraft, type ReferenceAircraft } from "../content/3d/AircraftFactory";
import { CombatEffects } from "../content/fx/CombatEffects";
import { ContentCatalog } from "../content/3d/ContentCatalog";
import { createBombs, createProjectileBatches, createSurfaceActor, type SceneActor } from "../content/3d/SceneObjects";
import {
  terrainMaterial,
  skyDomeMaterial,
  crosshairMaterial,
} from "./ShaderMaterials";
import { TerrainChunks } from "./TerrainChunks";
import { AircraftShadows } from "./AircraftShadows";
import { createTerrainDetail } from "./TerrainDetail";
import { Cloudscape } from "./Cloudscape";
import { cloudSun } from "./CloudscapeLayout";
import { cloudDiagnostics, environmentFixture, environmentState } from "./RenderDiagnostics";
import { frameBattleCamera } from "./BattleCamera";
import { updateVegetationWind, vegetationWindUniforms } from "./VegetationWind";
import { VegetationField } from "./VegetationField";
import { ShowroomBackdrop } from "../content/3d/ShowroomBackdrop";

export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly overlayScene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly canvas: HTMLCanvasElement;
  private aircraft?: ProceduralAircraft;
  private terrainChunks: TerrainChunks;
  private readonly skyDome: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private readonly cloudscape: Cloudscape;
  private readonly vegetationWind = vegetationWindUniforms();
  private readonly aircraftShadows = new AircraftShadows();
  private readonly terrainDetail = createTerrainDetail();
  private readonly terrainMat = terrainMaterial(this.terrainDetail, this.vegetationWind);
  private readonly content = new ContentCatalog();
  private readonly showroomBackdrop = new ShowroomBackdrop(this.content);
  private readonly projectileContent = createProjectileBatches(this.content);
  private readonly bombContent = createBombs(this.content, 8);
  private readonly enemies = new Map<number, SceneActor>();
  private readonly bulletBatches = this.projectileContent.batches;
  private pickups: THREE.InstancedMesh;
  private repairKits: THREE.InstancedMesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private readonly effects = new CombatEffects(this.scene);
  private readonly bombs = this.bombContent.meshes;
  private bombPath: THREE.Line;
  private crosshair: THREE.Mesh;
  private lockFan: THREE.Mesh;
  private targetRing: THREE.Mesh;
  private groundMarkers: THREE.Mesh[] = [];
  private readonly vegetation: VegetationField;
  private dummy = new THREE.Object3D();
  private projected = new THREE.Vector3();
  private displayAnchor = new THREE.Vector3();
  private displayOrbitYaw = 0;
  private displayOrbitPitch = 0.14;
  private displayView: "orbit" | "front" | "side" | "top" = "orbit";
  private time = 0;
  private crashTime = 0;
  private cameraBombing = 0;
  private readonly viewFrustum = new THREE.Frustum();
  private readonly viewProjection = new THREE.Matrix4();
  private readonly spawnBounds = new THREE.Sphere();
  private era?: ReturnType<typeof eraOf>;
  readonly frameMetrics = { calls: 0, triangles: 0 };
  private fpsTime = 0;
  private fpsFrames = 0;
  private slowFrames = 0;
  private fastFrames = 0;
  fps = 60;
  resolution = 1;
  quality: Quality = "standard";
  private width = 0;
  private height = 0;
  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.setClearColor("#a6b6a6");
    this.canvas = this.renderer.domElement;
    this.canvas.setAttribute("aria-label", "程序化三维飞行场景");
    this.host.append(this.canvas);
    this.camera = new THREE.PerspectiveCamera(
      RULES.camera.fov,
      1,
      RULES.camera.near,
      RULES.camera.far,
    );
    this.scene.add(new THREE.HemisphereLight("#f5edd2", "#526b61", 2.8));
    const sun = new THREE.DirectionalLight("#fff1ca", 3);
    sun.position.set(...cloudSun);
    this.scene.add(sun);
    this.scene.add(this.showroomBackdrop.group);
    this.showroomBackdrop.setVisible(false);
    this.skyDome = new THREE.Mesh(
      new THREE.SphereGeometry(440, 24, 16),
      skyDomeMaterial(),
    );
    this.skyDome.renderOrder = -1000;
    this.skyDome.frustumCulled = false;
    this.scene.add(this.skyDome);
    this.overlayScene.add(new THREE.HemisphereLight("#fff6e5", "#526b61", 2.2));
    this.overlayScene.add(new THREE.DirectionalLight("#fff1ca", 2.4));
    this.scene.fog = new THREE.Fog("#dff5f0", 78, 196);
    this.overlayScene.fog = this.scene.fog;
    this.renderer.autoClear = false;
    this.renderer.info.autoReset = false;
    if (import.meta.env.DEV) {
      cloudDiagnostics.set(this, {
        enabled: false,
        resolution: [0, 0],
        samples: 0,
        cpuMs: 0,
        rayMarchCpuMs: 0,
        cameraDensity: 0,
        windDirection: [0, 0],
        drift: [0, 0],
        morphTime: 0,
        windSpeed: 0,
      });
    }
    this.cloudscape = new Cloudscape(this.renderer, 491);
    const terrainLighting = { ...this.cloudscape.shadowUniforms, ...this.aircraftShadows.uniforms };
    Object.assign(this.terrainMat.uniforms, terrainLighting);
    this.terrainChunks = new TerrainChunks(
      this.scene,
      this.terrainMat,
      491,
      terrainLighting,
      this.vegetationWind,
    );
    this.bulletBatches.forEach((batch, index) => {
      (index % 2 === 0 ? this.overlayScene : this.scene).add(batch);
    });
    const coinGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.09, 8);
    coinGeo.rotateX(Math.PI / 2);
    this.pickups = new THREE.InstancedMesh(
      coinGeo,
      new THREE.MeshStandardMaterial({
        color: "#f6d778",
        emissive: "#62421c",
        metalness: 0.65,
        roughness: 0.3,
      }),
      RULES.maxPickups,
    );
    this.pickups.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.pickups.frustumCulled = false;
    this.scene.add(this.pickups);
    const badge = document.createElement("canvas");
    badge.width = badge.height = 64;
    const paint = badge.getContext("2d")!;
    paint.fillStyle = "#163e30";
    paint.strokeStyle = "#c4ffa9";
    paint.lineWidth = 4;
    paint.beginPath();
    paint.roundRect(5, 5, 54, 54, 12);
    paint.fill();
    paint.stroke();
    paint.fillStyle = "#dcffd0";
    paint.fillRect(26, 15, 12, 34);
    paint.fillRect(15, 26, 34, 12);
    const repairIcon = new THREE.CanvasTexture(badge);
    repairIcon.colorSpace = THREE.SRGBColorSpace;
    this.repairKits = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: repairIcon, transparent: true, depthWrite: false, toneMapped: false }),
      RULES.maxPickups,
    );
    this.repairKits.count = 0;
    this.repairKits.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.repairKits.frustumCulled = false;
    this.overlayScene.add(this.repairKits);
    const aimMat = crosshairMaterial();
    this.crosshair = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), aimMat);
    this.crosshair.rotation.x = -Math.PI / 2;
    this.crosshair.visible = false;
    this.crosshair.renderOrder = 5;
    this.overlayScene.add(this.crosshair);
    const fanGeometry = new THREE.BufferGeometry();
    fanGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(new Float32Array(16 * 9), 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    this.lockFan = new THREE.Mesh(
      fanGeometry,
      new THREE.MeshBasicMaterial({
        color: "#a4d5dd",
        transparent: true,
        opacity: 0.09,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.lockFan.frustumCulled = false;
    this.lockFan.renderOrder = 4;
    this.overlayScene.add(this.lockFan);
    this.targetRing = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 0.86, 32),
      new THREE.MeshBasicMaterial({
        color: "#a4d5dd",
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.targetRing.rotation.x = -Math.PI / 2;
    this.targetRing.renderOrder = 6;
    this.overlayScene.add(this.targetRing);
    const lineMat = new THREE.LineDashedMaterial({
      color: "#f4d89c",
      dashSize: 0.3,
      gapSize: 0.3,
      transparent: true,
      opacity: 0.7,
    });
    const pathGeometry = new THREE.BufferGeometry();
    pathGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(new Float32Array(17 * 3), 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    this.bombPath = new THREE.Line(pathGeometry, lineMat);
    this.bombPath.frustumCulled = false;
    this.bombPath.visible = false;
    this.overlayScene.add(this.bombPath);
    this.overlayScene.add(...this.bombs);
    for (let i = 0; i < RULES.maxTotal; i++) {
      const marker = new THREE.Mesh(
        new THREE.RingGeometry(1.2, 1.25, 24),
        new THREE.MeshBasicMaterial({
          color: "#f0c985",
          transparent: true,
          opacity: 0.6,
          depthWrite: false,
        }),
      );
      marker.rotation.x = -Math.PI / 2;
      marker.visible = false;
      this.groundMarkers.push(marker);
      this.scene.add(marker);
    }
    this.vegetation = new VegetationField(this.scene, this.vegetationWind, 491);
    this.setQuality("standard");
    this.resize();
  }
  setPlayer(p: Player | ReferenceAircraft) {
    if (this.aircraft?.actor === p) return this.aircraft.contentError;
    this.crashTime = 0;
    this.effects.reset();
    if (this.aircraft) {
      this.overlayScene.remove(this.aircraft.group);
      this.aircraft.dispose();
    }
    for (const actor of this.enemies.values()) actor.dispose();
    this.enemies.clear();
    this.aircraft = new ProceduralAircraft(p, this.content);
    this.overlayScene.add(this.aircraft.group);
    this.displayAnchor.set(p.x, 0, p.z);
    return this.aircraft.contentError;
  }
  setDisplayOrbit(yaw: number, pitch = this.displayOrbitPitch) {
    this.displayView = "orbit";
    this.displayOrbitYaw = yaw;
    this.displayOrbitPitch = clamp(pitch, -0.35, 0.55);
  }
  setDisplayView(view: "front" | "side" | "top") {
    this.displayView = view;
  }
  setQuality(q: Quality) {
    this.quality = q;
    const { vegetation } = QUALITIES[q];
    this.terrainMat.uniforms.waveDetail.value = vegetation.waveDetail;
    this.terrainMat.uniforms.waveStrength.value = vegetation.waveStrength;
    this.terrainChunks.setShadows(QUALITIES[q].shadows);
    this.resolution = QUALITIES[q].scale;
    this.slowFrames = 0;
    this.fastFrames = 0;
    this.resize(true);
  }
  resize(force = false) {
    const w = this.host.clientWidth,
      h = this.host.clientHeight;
    if (!force && w === this.width && h === this.height) return;
    if (!w || !h) return;
    this.width = w;
    this.height = h;
    this.renderer.setPixelRatio(
      Math.min(devicePixelRatio || 1, 2) * this.resolution,
    );
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  private createEnemy(enemy: Enemy) {
    const actor = enemy.layer === "air"
      ? new ProceduralAircraft(enemy, this.content)
      : createSurfaceActor(enemy, this.content);
    this.scene.add(actor.group);
    this.enemies.set(enemy.id, actor);
    return actor;
  }
  render(
    world: World | undefined,
    dt: number,
    options: { display: boolean; showroom?: boolean; missionEra?: ReturnType<typeof eraOf>; highlight?: string; launching?: number; events?: readonly WorldEvent[] },
  ) {
    if (!this.aircraft) return;
    const sceneDt =
      world && !options.display && world.clock.timeScale === 0 ? 0 : dt;
    this.time += sceneDt;
    this.resize();
    const p = this.aircraft.actor as Player | ReferenceAircraft;
    const era = world?.era ?? options.missionEra ?? p.frame.missionEra ?? p.frame.era ?? "jet";
    if (era !== this.era) {
      this.era = era;
      const { colors } = ERAS[era];
      this.renderer.setClearColor(colors.skyHorizon);
      (this.scene.fog as THREE.Fog).color.set(colors.skyHorizon);
      this.terrainMat.uniforms.grass.value.set(colors.grass);
      this.terrainMat.uniforms.road.value.set(colors.accent);
      this.terrainMat.uniforms.haze.value.set(colors.skyHorizon);
      this.terrainMat.uniforms.valleyFog.value.set(colors.valleyFog);
      this.terrainMat.uniforms.sunTint.value.set(colors.sunTint);
      this.terrainMat.uniforms.cloudShadowColor.value.set(colors.cloudShadow);
      this.skyDome.material.uniforms.zenith.value.set(colors.skyZenith);
      this.skyDome.material.uniforms.horizon.value.set(colors.skyHorizon);
      this.skyDome.material.uniforms.sun.value.set(colors.sunTint);
      this.skyDome.material.uniforms.haze.value.set(colors.skyHorizon);
      this.skyDome.material.uniforms.valleyFog.value.set(colors.valleyFog);
      this.skyDome.material.uniforms.sunTint.value.set(colors.sunTint);
      this.cloudscape.setPalette(colors);
      this.terrainChunks.setWaterColor(colors.water);
      this.terrainChunks.setHaze(colors.skyHorizon, colors.valleyFog, colors.sunTint, colors.skyZenith, colors.skyHorizon);
    }
    const display = options.display,
      launch = options.launching ?? 0;
    const alpha = world ? clamp(world.clock.accumulator / RULES.step) : 1;
    const x = display ? p.x : p.prevX + (p.x - p.prevX) * alpha;
    const z = display ? p.z : p.prevZ + (p.z - p.prevZ) * alpha;
    if (display && !options.showroom) {
      this.cameraBombing = 0;
      this.displayAnchor.x = damp(this.displayAnchor.x, x, 7, dt);
      this.displayAnchor.z = damp(this.displayAnchor.z, z, 7, dt);
      if (this.camera.fov !== RULES.camera.fov) {
        this.camera.fov = RULES.camera.fov;
        this.camera.updateProjectionMatrix();
      }
      const displayDistance = 26 * Math.max(1, p.stats.wingspan / 9, p.stats.length / 10);
      const aspectScale = this.camera.aspect < 0.55 ? 1.12 : 1;
      const distance = (displayDistance - launch * 3) * aspectScale;
      const pitch = RULES.camera.displayPitch * RAD;
      const cameraBase = RULES.flightAltitude - 9;
      this.camera.position.set(
        this.displayAnchor.x,
        cameraBase + Math.sin(pitch) * distance,
        this.displayAnchor.z - Math.cos(pitch) * distance,
      );
      this.camera.lookAt(
        this.displayAnchor.x,
        cameraBase + 2,
        this.displayAnchor.z - 2 - (displayDistance - 26) * 0.17,
      );
      this.camera.updateMatrixWorld();
    } else if (display && options.showroom) {
      this.cameraBombing = 0;
      this.displayAnchor.x = damp(this.displayAnchor.x, x, 7, dt);
      this.displayAnchor.z = damp(this.displayAnchor.z, z, 7, dt);
      // Fixed views look at the center body. Fit the longer half of a unilateral refit.
      const extraWidth = p.frame.geometryProfile === "ho229V2"
        ? Math.abs(lineExtension(p.parts, "left-wing-0") - lineExtension(p.parts, "right-wing-0")) : 0;
      const displaySpan = p.stats.wingspan + extraWidth;
      const distance = 16 * Math.max(1, displaySpan / 9, p.stats.length / 10) *
        (this.camera.aspect < 0.55 ? 1.12 : 1);
      const targetY = RULES.flightAltitude + .05;
      const targetZ = this.displayAnchor.z;
      if (this.displayView === "front" || this.displayView === "side" || this.displayView === "top") {
        const viewHeight = Math.max(9.2, p.stats.length * 1.2, displaySpan * 1.12 / this.camera.aspect);
        const viewWidth = viewHeight * this.camera.aspect;
        this.camera.projectionMatrix.makeOrthographic(
          -viewWidth * .5,
          viewWidth * .5,
          viewHeight * .5,
          -viewHeight * .5,
          RULES.camera.near,
          RULES.camera.far,
        );
        this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
        if (this.displayView === "top") {
          this.camera.up.set(0, 0, 1);
          this.camera.position.set(this.displayAnchor.x, targetY + distance, targetZ);
        } else if (this.displayView === "side") {
          this.camera.up.set(0, 1, 0);
          this.camera.position.set(this.displayAnchor.x + distance, targetY, targetZ);
        } else {
          this.camera.up.set(0, 1, 0);
          this.camera.position.set(this.displayAnchor.x, targetY, targetZ + distance);
        }
        this.camera.lookAt(this.displayAnchor.x, targetY, targetZ);
      } else {
        this.camera.fov = RULES.camera.fov;
        this.camera.updateProjectionMatrix();
        this.camera.up.set(0, 1, 0);
        const yaw = this.displayOrbitYaw;
        const pitch = this.displayOrbitPitch;
        const inspection = p.frame.geometryProfile === "pioneerReview";
        const orbitDistance = inspection
          ? Math.max(displaySpan / this.camera.aspect, p.stats.length * .80, displaySpan * .54)
              * .84 / Math.tan(this.camera.fov * RAD / 2)
          : distance;
        const horizontal = Math.cos(pitch) * orbitDistance;
        const cameraBase = RULES.flightAltitude + (inspection ? orbitDistance * .28 : 5);
        this.camera.position.set(
          this.displayAnchor.x + Math.sin(yaw) * horizontal,
          cameraBase + Math.sin(pitch) * orbitDistance,
          this.displayAnchor.z - Math.cos(yaw) * horizontal,
        );
        this.camera.lookAt(this.displayAnchor.x, RULES.flightAltitude, this.displayAnchor.z - (inspection ? 0 : 2));
      }
      this.camera.updateMatrixWorld();
    } else {
      this.cameraBombing = damp(this.cameraBombing, world?.isBombing ? 1 : 0, 10, dt);
      frameBattleCamera(this.camera, x, z, this.cameraBombing);
    }
    const fixture = import.meta.env.DEV ? environmentFixture.get(this) : undefined;
    if (fixture?.camera && fixture.lookAt) {
      this.camera.position.copy(fixture.camera);
      this.camera.lookAt(fixture.lookAt);
      this.camera.updateMatrixWorld();
    }
    this.skyDome.position.copy(this.camera.position);
    this.viewProjection.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this.viewFrustum.setFromProjectionMatrix(this.viewProjection);
    this.aircraft.update(this.time, sceneDt, options.highlight, display);
    this.aircraft.group.position.x = x;
    this.aircraft.group.position.y = RULES.flightAltitude;
    this.aircraft.group.position.z = z;
    if (display && (options.showroom === true && this.displayView !== "orbit")) {
      this.aircraft.group.rotation.set(0, 0, 0);
    } else if (display) {
      this.aircraft.group.rotation.z = Math.sin(this.time * 0.8) * 0.045;
      this.aircraft.group.rotation.x = Math.sin(this.time * 0.6) * 0.015;
    }
    if (world?.phase === "dying") {
      this.crashTime += sceneDt;
      this.aircraft.group.position.y -= this.crashTime * this.crashTime * 2;
      this.aircraft.group.rotation.z += this.crashTime * 0.9;
    }
    this.aircraft.syncLiftPivot();
    const showroom = options.showroom === true;
    if (showroom) {
      this.skyDome.visible = false;
      this.showroomBackdrop.setVisible(true);
      this.showroomBackdrop.update(this.displayAnchor.x, this.displayAnchor.z);
      this.terrainChunks.setVisible(false);
      this.vegetation.setVisible(false);
    } else {
      this.skyDome.visible = true;
      this.showroomBackdrop.setVisible(false);
      this.terrainChunks.setVisible(true);
      this.vegetation.setVisible(true);
      this.terrainChunks.update(x, z);
      this.vegetation.update(x, z, this.quality);
    }
    const wind = display ? undefined : world?.wind;
    updateVegetationWind(this.vegetationWind, this.time, wind, x, z);
    if (!showroom) this.terrainChunks.updateTime(this.time);
    const cloudsEnabled = !showroom && (fixture?.clouds ?? true);
    const cloudWind = wind?.sample(x, z);
    if (!showroom) this.cloudscape.update(
      sceneDt,
      cloudWind?.x ?? 0,
      cloudWind?.z ?? 0,
      wind?.gust ?? 0,
      this.camera.position,
      x,
      RULES.flightAltitude,
      z,
      p.vx,
      p.vz,
      cloudsEnabled,
    );
    const activeColors = ERAS[era].colors;
    const cloudWrap = cloudsEnabled && !showroom
      ? clamp(Math.max(this.cloudscape.cameraDensity * .35, this.cloudscape.playerDensity * .42), 0, .32)
      : 0;
    this.aircraft.setCloudAtmosphere(cloudWrap, activeColors.cloudLit);
    if (import.meta.env.DEV && fixture) {
      environmentState.set(this, {
        sceneTime: this.time,
        windTime: this.vegetationWind.windTime.value,
        gust: this.vegetationWind.windGust.value,
        direction: this.vegetationWind.windDirection.value.toArray(),
        trees: this.vegetation.treeCount,
        tufts: this.vegetation.tuftCount,
      });
    }
    this.aircraftShadows.clear();
    this.aircraftShadows.add(
      x, this.aircraft.group.position.y, z, this.aircraft.group.rotation.y,
      p.stats.wingspan, p.stats.length, .68, p.frame.shape === "airship",
    );
    if (world && !display) {
      this.updateBattle(world, sceneDt);
      this.effects.update(
        sceneDt, this.camera, this.quality, world.projectiles.items, world.wind, options.events,
        [world.player, ...world.enemies].map((actor) => ({ id: actor.id, pose: world.actorPose(actor), parts: actor.parts })),
        world.fires.map((zone) => ({ zone, y: world.surfaceHeight(zone.x, zone.z) + .2 })),
      );
    } else if (world && options.showroom) {
      this.hideBattle(false);
      this.effects.update(
        sceneDt, this.camera, this.quality, [], undefined, options.events,
        [{ id: world.player.id, pose: world.actorPose(world.player), parts: world.player.parts }],
        [],
      );
    } else {
      this.hideBattle();
    }
    this.renderer.info.reset();
    if (!showroom) this.cloudscape.begin(this.renderer, this.camera, this.quality, fixture?.cloudShadows);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    const cloudStart = import.meta.env.DEV ? performance.now() : 0;
    let cloudMarchMs = 0;
    if (!showroom && cloudsEnabled) {
      this.cloudscape.renderClouds(this.renderer, this.camera, this.quality);
      if (import.meta.env.DEV) cloudMarchMs = performance.now() - cloudStart;
    }
    if (!showroom) this.cloudscape.compositeWorld(this.renderer, this.camera);
    if (import.meta.env.DEV) {
      const diagnostics = cloudDiagnostics.get(this)!;
      diagnostics.enabled = cloudsEnabled;
      diagnostics.resolution[0] = cloudsEnabled ? this.cloudscape.width : 0;
      diagnostics.resolution[1] = cloudsEnabled ? this.cloudscape.height : 0;
      diagnostics.samples = cloudsEnabled ? QUALITIES[this.quality].cloud.samples : 0;
      diagnostics.cameraDensity = this.cloudscape.cameraDensity;
      const flow = this.cloudscape.flow;
      diagnostics.windDirection = [flow.x, flow.z];
      diagnostics.windSpeed = flow.speed;
      diagnostics.drift = flow.drift;
      diagnostics.morphTime = flow.selfTime;
      diagnostics.rayMarchCpuMs = cloudMarchMs;
      diagnostics.cpuMs = cloudsEnabled ? performance.now() - cloudStart : 0;
    }
    this.renderer.clearDepth();
    this.renderer.render(this.overlayScene, this.camera);
    this.frameMetrics.calls = this.renderer.info.render.calls;
    this.frameMetrics.triangles = this.renderer.info.render.triangles;
    this.fpsTime += dt;
    this.fpsFrames++;
    if (this.fpsTime >= 1) {
      this.fps = Math.round(this.fpsFrames / this.fpsTime);
      if (this.fps < 38) {
        this.slowFrames++;
        this.fastFrames = 0;
      } else if (this.fps > 55) {
        this.fastFrames++;
        this.slowFrames = 0;
      }
      if (this.slowFrames >= 3 && this.resolution > 0.55) {
        this.resolution = Math.max(0.55, this.resolution - 0.08);
        this.resize(true);
        this.slowFrames = 0;
      }
      if (
        this.fastFrames >= 10 &&
        this.resolution < QUALITIES[this.quality].scale
      ) {
        this.resolution = Math.min(
          QUALITIES[this.quality].scale,
          this.resolution + 0.04,
        );
        this.resize(true);
        this.fastFrames = 0;
      }
      this.fpsTime = 0;
      this.fpsFrames = 0;
    }
  }
  private updateBattle(world: World, dt: number) {
    const p = world.player;
    let gi = 0;
    const living = new Set(world.enemies.map((e) => e.id));
    for (const [id, actor] of this.enemies) {
      if (living.has(id)) continue;
      actor.dispose();
      this.enemies.delete(id);
    }
    for (const e of world.enemies) {
      const actor = this.enemies.get(e.id) ?? this.createEnemy(e);
      if (actor instanceof ProceduralAircraft) actor.update(this.time, dt);
      const mesh = actor.group;
      const route = world.routes.find((candidate) => candidate.id === e.routeId);
      const surface = route ? routeHeight(route, e.x, e.z) : world.surfaceHeight(e.x, e.z);
      const height = e.layer === "air" ? RULES.flightAltitude : surface + .2;
      mesh.visible = this.isSpawnVisible(e.x, height, e.z, e.radius * 2 + 2);
      mesh.position.set(
        e.x,
        height,
        e.z,
      );
      mesh.rotation.set(0, e.heading, e.bank);
      if (e.layer !== "air") {
        const marker = this.groundMarkers[gi++];
        marker.visible = world.isBombing;
        marker.position.set(e.x, surface + 0.12, e.z);
        marker.scale.setScalar(e.radius * 1.25);
      }
      if (e.layer === "air" && QUALITIES[this.quality].shadows) {
        this.aircraftShadows.add(e.x, height, e.z, e.heading, e.radius * 4, e.radius * 3, .56);
      }
    }
    for (let i = gi; i < this.groundMarkers.length; i++)
      this.groundMarkers[i].visible = false;
    for (const batch of this.bulletBatches) batch.count = 0;
    for (const projectile of world.projectiles.items) {
      if (!projectile.active || !this.isSpawnVisible(projectile.x, projectile.y, projectile.z, 2)) continue;
      const missile = projectile.kind === "missile";
      const batch = this.bulletBatches[(missile ? 2 : 0) + (projectile.team === "enemy" ? 1 : 0)];
      this.dummy.position.set(projectile.x, projectile.y, projectile.z);
      this.dummy.rotation.set(0, projectile.heading, 0);
      this.dummy.scale.setScalar(missile ? 2 : 1);
      this.dummy.updateMatrix();
      batch.setMatrixAt(batch.count++, this.dummy.matrix);
    }
    for (const batch of this.bulletBatches) batch.instanceMatrix.needsUpdate = true;
    this.pickups.count = 0;
    this.repairKits.count = 0;
    for (const item of world.pickups.items) {
      if (!item.active) continue;
      const isCoin = item.kind === "coin";
      const batch = isCoin ? this.pickups : this.repairKits;
      this.dummy.position.set(item.x, RULES.flightAltitude + Math.sin(this.time * 3 + item.x) * .15, item.z);
      if (isCoin) this.dummy.rotation.set(0, this.time * 2, 0);
      else this.dummy.quaternion.copy(this.camera.quaternion);
      this.dummy.scale.setScalar(isCoin ? 1 : item.kind === "repairLarge" ? 2.9 : 2.15);
      this.dummy.updateMatrix();
      batch.setMatrixAt(batch.count++, this.dummy.matrix);
    }
    this.pickups.instanceMatrix.needsUpdate = true;
    this.repairKits.instanceMatrix.needsUpdate = true;
    const aimMat = this.crosshair.material as THREE.ShaderMaterial;
    this.crosshair.visible = world.isBombing;
    this.crosshair.position.set(world.aim.x, surfaceHeight(world.aim.x, world.aim.z, 491) + 0.3, world.aim.z);
    aimMat.uniforms.progress.value = world.stability;
    aimMat.uniforms.ready.value = world.canBomb ? 1 : 0;
    const lock = world.mainLock;
    const progress = lock?.lockProgress ?? 0;
    const color = new THREE.Color(
      progress > 0.85 ? "#f18e71" : progress > 0.5 ? "#f5d887" : "#a1d6df",
    );
    const fanMaterial = this.lockFan.material as THREE.MeshBasicMaterial;
    fanMaterial.color.copy(color);
    fanMaterial.opacity = world.lockPulse ? 0.3 : 0.035 + progress * 0.1;
    this.lockFan.visible = Boolean(lock?.targetId) && !world.isBombing;
    const arc =
      (lock ? lock.config.arc + p.stats.lockArc : 24) *
      RAD *
      (1 - progress * 0.65);
    const fanAttr = this.lockFan.geometry.getAttribute("position");
    for (let i = 0; i < 16; i++) {
      const a = p.heading - arc / 2 + (i / 16) * arc,
        b = a + arc / 16;
      fanAttr.setXYZ(i * 3, 0, 0, 0);
      fanAttr.setXYZ(i * 3 + 1, Math.sin(a) * 13, 0, Math.cos(a) * 13);
      fanAttr.setXYZ(i * 3 + 2, Math.sin(b) * 13, 0, Math.cos(b) * 13);
    }
    fanAttr.needsUpdate = true;
    this.lockFan.position.set(p.x, RULES.flightAltitude, p.z);
    const target = world.enemies.find((e) => e.id === lock?.targetId);
    this.targetRing.visible = Boolean(target);
    if (target) {
      this.targetRing.position.set(
        target.x,
        target.layer === "air" ? RULES.flightAltitude : surfaceHeight(target.x, target.z, 491) + 0.5,
        target.z,
      );
      this.targetRing.scale.setScalar(1.3 - progress * 0.35);
      (this.targetRing.material as THREE.MeshBasicMaterial).color.copy(color);
    }
    this.bombs.forEach((mesh, i) => {
      const bomb = world.bombs[i];
      mesh.visible = Boolean(bomb);
      if (bomb) {
        const t = clamp(bomb.age / RULES.bombFallTime);
        const startY = bomb.startY;
        const endY = surfaceHeight(bomb.x, bomb.z, 491) + 0.1;
        mesh.position.set(
          THREE.MathUtils.lerp(bomb.startX, bomb.x, t),
          THREE.MathUtils.lerp(startY, endY, t * t),
          THREE.MathUtils.lerp(bomb.startZ, bomb.z, t),
        );
      }
    });
    this.bombPath.visible = world.isBombing;
    if (world.isBombing) {
      const attr = this.bombPath.geometry.getAttribute("position");
      const startY = RULES.flightAltitude;
      const endY = surfaceHeight(world.aim.x, world.aim.z, 491) + 0.1;
      for (let i = 0; i < 17; i++) {
        const t = i / 16;
        attr.setXYZ(
          i,
          THREE.MathUtils.lerp(p.x, world.aim.x, t),
          THREE.MathUtils.lerp(startY, endY, t * t),
          THREE.MathUtils.lerp(p.z, world.aim.z, t),
        );
      }
      attr.needsUpdate = true;
      this.bombPath.computeLineDistances();
    }
  }
  private hideBattle(resetEffects = true) {
    for (const batch of this.bulletBatches) batch.count = 0;
    if (resetEffects) this.effects.reset();
    this.enemies.forEach((actor) => (actor.group.visible = false));
    this.groundMarkers.forEach((m) => (m.visible = false));
    this.bombs.forEach((m) => (m.visible = false));
    this.pickups.count = 0;
    this.repairKits.count = 0;
    this.crosshair.visible = false;
    this.lockFan.visible = false;
    this.targetRing.visible = false;
    this.bombPath.visible = false;
  }
  isSpawnVisible(x: number, y: number, z: number, radius: number) {
    this.spawnBounds.center.set(x, y, z);
    this.spawnBounds.radius = radius;
    return this.viewFrustum.intersectsSphere(this.spawnBounds);
  }
  project(x: number, y: number, z: number) {
    this.projected.set(x, y, z).project(this.camera);
    return {
      x: (this.projected.x * 0.5 + 0.5) * this.width,
      y: (-this.projected.y * 0.5 + 0.5) * this.height,
      visible:
        this.projected.z < 1 &&
        Math.abs(this.projected.x) < 1 &&
        Math.abs(this.projected.y) < 1,
    };
  }
  isCloudOccluded(x: number, y: number, z: number) {
    this.projected.set(x, y, z);
    return this.cloudscape.occludes(this.camera.position, this.projected);
  }
  get diagnostics() {
    return {
      fps: this.fps,
      resolution: Math.round(this.resolution * 100),
      calls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      geometries: this.renderer.info.memory.geometries,
      effects: this.effects.active,
      content: {
        shared: this.content.stats,
        effects: this.effects.diagnostics,
        projectileBatches: this.bulletBatches.length,
      },
    };
  }
  dispose() {
    this.aircraft?.dispose();
    for (const actor of this.enemies.values()) actor.dispose();
    this.enemies.clear();
    this.projectileContent.dispose();
    this.bombContent.dispose();
    this.effects.dispose();
    this.showroomBackdrop.dispose();
    this.terrainChunks.dispose();
    this.terrainMat.dispose();
    this.terrainDetail.dispose();
    this.vegetation.dispose();
    this.cloudscape.dispose();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
        o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => m.dispose());
      }
    });
    this.overlayScene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
        o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => m.dispose());
      }
    });
    this.repairKits.material.map?.dispose();
    this.repairKits.dispose();
    this.renderer.dispose();
    this.canvas.remove();
  }
}
