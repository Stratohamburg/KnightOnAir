import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RULES, QUALITIES, type Quality } from "../data/config";
import { combatantById } from "../data/combatants";
import { eraOf } from "../data/aircrafts";
import { ERAS } from "../data/eras";
import { routeHeight } from "../simulation/Routes";
import { clamp, damp, RAD } from "../services/Random";
import { World } from "../simulation/World";
import { surfaceHeight } from "../simulation/Terrain";
import type { WindField } from "../simulation/WindField";
import type { Player, Enemy } from "../simulation/types";
import {
  ProceduralAircraft,
  fuselageGeometry,
  wingGeometry,
} from "./ProceduralAircraft";
import {
  aircraftMaterial,
  terrainMaterial,
  skyDomeMaterial,
  crosshairMaterial,
  effectMaterial,
  projectileMaterial,
} from "./ShaderMaterials";
import { TerrainChunks } from "./TerrainChunks";
import { Cloudscape } from "./Cloudscape";
import { cloudSun } from "./CloudscapeLayout";
import { cloudDiagnostics, environmentFixture, environmentState } from "./RenderDiagnostics";
import { frameBattleCamera } from "./BattleCamera";
import { updateVegetationWind, vegetationWindUniforms } from "./VegetationWind";
import { VegetationField } from "./VegetationField";

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
  private terrainMat = terrainMaterial(this.vegetationWind);
  private enemies = new Map<number, THREE.Group>();
  private bulletBatches: THREE.InstancedMesh[];
  private pickups: THREE.InstancedMesh;
  private repairKits: THREE.InstancedMesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private effects: THREE.Mesh[] = [];
  private bombs: THREE.Mesh[] = [];
  private bombPath: THREE.Line;
  private crosshair: THREE.Mesh;
  private lockFan: THREE.Mesh;
  private targetRing: THREE.Mesh;
  private groundMarkers: THREE.Mesh[] = [];
  private shadows: THREE.Mesh[] = [];
  private smoke: THREE.Mesh[] = [];
  private fireMeshes: THREE.Mesh[] = [];
  private readonly vegetation: VegetationField;
  private dummy = new THREE.Object3D();
  private projected = new THREE.Vector3();
  private displayAnchor = new THREE.Vector3();
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
  private materialCache = new Map<string, THREE.Material>();
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
    this.skyDome = new THREE.Mesh(
      new THREE.SphereGeometry(420, 24, 16),
      skyDomeMaterial(),
    );
    this.skyDome.renderOrder = -1000;
    this.skyDome.frustumCulled = false;
    this.scene.add(this.skyDome);
    this.overlayScene.add(new THREE.HemisphereLight("#fff6e5", "#526b61", 2.2));
    this.overlayScene.add(new THREE.DirectionalLight("#fff1ca", 2.4));
    this.scene.fog = new THREE.Fog("#cfefff", 70, 240);
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
        windDirection: [-0.36, 0.93295],
        windSpeed: 0,
      });
    }
    this.cloudscape = new Cloudscape(this.renderer, 491);
    Object.assign(this.terrainMat.uniforms, this.cloudscape.shadowUniforms);
    this.terrainChunks = new TerrainChunks(this.scene, this.terrainMat, 491, this.cloudscape.shadowUniforms);
    const playerBullet = projectileMaterial("#ffe5a1"),
      enemyBullet = projectileMaterial("#f98769"),
      missileMat = projectileMaterial("#c6f4d4");
    this.materialCache.set("playerBullet", playerBullet);
    this.materialCache.set("enemyBullet", enemyBullet);
    this.materialCache.set("missile", missileMat);
    const bulletGeometry = new THREE.CylinderGeometry(0.06, 0.06, 0.8, 4);
    bulletGeometry.rotateX(Math.PI / 2);
    this.bulletBatches = [playerBullet, enemyBullet, missileMat, missileMat].map((material, index) => {
      const batch = new THREE.InstancedMesh(bulletGeometry, material, RULES.maxProjectiles);
      batch.count = 0;
      batch.frustumCulled = false;
      batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      (index % 2 === 0 ? this.overlayScene : this.scene).add(batch);
      return batch;
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
    for (let i = 0; i < RULES.maxEffects; i++) {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        effectMaterial(),
      );
      mesh.visible = false;
      this.effects.push(mesh);
      this.scene.add(mesh);
    }
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
    for (let i = 0; i < 8; i++) {
      const bomb = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 6, 4),
        new THREE.MeshStandardMaterial({ color: "#3b4540" }),
      );
      bomb.scale.set(1, 1.8, 1);
      bomb.visible = false;
      this.bombs.push(bomb);
      this.overlayScene.add(bomb);
    }
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
    const shadowMat = effectMaterial();
    shadowMat.uniforms.color.value.set("#182e2b");
    shadowMat.uniforms.opacity.value = 0.45;
    for (let i = 0; i < 40; i++) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shadowMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      this.shadows.push(mesh);
      this.scene.add(mesh);
    }
    for (let i = 0; i < 12; i++) {
      const mat = effectMaterial();
      mat.uniforms.color.value.set("#334440");
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      mesh.visible = false;
      this.smoke.push(mesh);
      this.overlayScene.add(mesh);
    }
    for (let i = 0; i < 8; i++) {
      const mat = effectMaterial();
      mat.uniforms.color.value.set("#f19c45");
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      this.fireMeshes.push(mesh);
      this.scene.add(mesh);
    }
    this.vegetation = new VegetationField(this.scene, this.vegetationWind, 491);
    this.setQuality("standard");
    this.resize();
  }
  setPlayer(p: Player) {
    if (this.aircraft?.player === p) return;
    this.crashTime = 0;
    if (this.aircraft) {
      this.overlayScene.remove(this.aircraft.group);
      this.aircraft.dispose();
    }
    for (const mesh of this.enemies.values()) {
      this.scene.remove(mesh);
      mesh.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
    }
    this.enemies.clear();
    this.aircraft = new ProceduralAircraft(p);
    this.overlayScene.add(this.aircraft.group);
    this.displayAnchor.set(p.x, 0, p.z);
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
  private createEnemy(e: Enemy) {
    const root = new THREE.Group(),
      config = combatantById(e.configId ?? e.kind);
    if (!config) return root;
    let material = this.materialCache.get(e.configId ?? e.kind);
    if (!material) {
      material = aircraftMaterial(config.visual.color);
      this.materialCache.set(e.configId ?? e.kind, material);
    }
    const dark =
      this.materialCache.get("dark") ??
      new THREE.MeshStandardMaterial({ color: "#3b4c43", flatShading: true });
    this.materialCache.set("dark", dark);
    const add = (
      g: THREE.BufferGeometry,
      mat: THREE.Material,
      x = 0,
      y = 0,
      z = 0,
    ) => {
      const m = new THREE.Mesh(g, mat);
      m.position.set(x, y, z);
      root.add(m);
      return m;
    };
    if (e.layer === "air") {
      const balloon = e.kind === "recon_balloon" || (e.kind === "elite" && config.era === "ww1");
      const heavy = ["elite", "bomber", "gunship", "jet_bomber", "heavy_fighter"].includes(e.kind);
      const propeller = config.era !== "jet";
      const biplane = config.era === "pioneer" || config.era === "ww1";
      if (balloon) {
        const envelope = add(new THREE.IcosahedronGeometry(1, 1), material, 0, .7);
        envelope.scale.set(.9, .85, e.kind === "elite" ? 2.45 : 1.1);
        add(new THREE.BoxGeometry(.42, .31, .82), dark, 0, -.2);
      } else {
        add(fuselageGeometry(heavy ? 3.45 : 2.5, heavy ? .48 : .27), material);
        if (biplane)
          for (const side of [-1, 1])
            add(wingGeometry(1.55, side, 1.02, .24), material, side * .2, .49);
        if (propeller)
          add(new THREE.BoxGeometry(.06, .84, .06), dark, 0, .04, heavy ? 1.71 : 1.29);
      }
      for (const side of [-1, 1]) {
        add(
          wingGeometry(e.kind === "bomber" ? 2.6 : 1.8, side, 1.2, 0.45),
          material,
          side * 0.2,
        );
        add(
          wingGeometry(0.8, side, 0.55, 0.18),
          material,
          side * 0.1,
          0.05,
          -0.8,
        );
        add(
          new THREE.BoxGeometry(0.23, 0.2, 0.9),
          dark,
          side * 0.7,
          -0.06,
          -0.4,
        );
      }
      add(new THREE.SphereGeometry(0.23, 5, 3), dark, 0, 0.23, 0.25);
      if (e.kind === "scout")
        add(new THREE.SphereGeometry(0.2, 5, 3), material, 0, 0.5, 0);
    } else if (e.layer === "water") {
      const length = e.radius * 2.65;
      add(fuselageGeometry(length, e.radius * .52), material, 0, .19);
      add(new THREE.BoxGeometry(e.radius * .67, .32, length * .37), dark, 0, .54, -.3);
      if (e.weapons.length)
        add(new THREE.BoxGeometry(.13, .13, length * .25), material, 0, .65, length * .24);
    } else if (config.capabilities.routeKinds.includes("rail")) {
      for (let car = -1; car <= 1; car++) {
        add(new THREE.BoxGeometry(e.radius * .78, .75, 1.75), material, 0, .55, car * 1.89);
        add(new THREE.BoxGeometry(e.radius * .6, .31, 1.52), dark, 0, .17, car * 1.89);
      }
    } else {
      add(
        new THREE.BoxGeometry(
          e.radius * 1.7,
          0.6,
          e.kind === "depot" ? 2.8 : 1.8,
        ),
        material,
        0,
        0.3,
      );
      if (e.kind === "aa_truck") {
        add(new THREE.CylinderGeometry(0.4, 0.6, 0.3, 8), dark, 0, 0.7);
        const barrel = add(
          new THREE.BoxGeometry(0.16, 0.16, 1.5),
          material,
          0,
          0.9,
          0.65,
        );
        barrel.rotation.x = -0.3;
      } else if (e.kind === "depot") {
        for (const x of [-0.6, 0.6])
          add(new THREE.CylinderGeometry(0.55, 0.55, 1.6, 8), material, x, 1.1);
      } else {
        for (const x of [-0.65, 0.65])
          for (const z of [-0.55, 0.55])
            add(new THREE.BoxGeometry(0.2, 0.4, 0.45), dark, x, 0.15, z);
        let cargo = this.materialCache.get("cargo");
        if (!cargo) {
          cargo = new THREE.MeshStandardMaterial({
            color: "#e5c480",
            emissive: "#5b4926",
          });
          this.materialCache.set("cargo", cargo);
        }
        add(
          new THREE.BoxGeometry(0.9, 0.5, 0.7),
          e.kind === "resource" ? cargo : material,
          0,
          0.8,
          0,
        );
      }
    }
    // NPC meshes have fixed local transforms, so submit one batch per material.
    const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
    for (const child of [...root.children] as THREE.Mesh<THREE.BufferGeometry, THREE.Material>[]) {
      child.updateMatrix();
      const geometry = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry;
      geometry.applyMatrix4(child.matrix);
      for (const attribute of Object.keys(geometry.attributes))
        if (attribute !== "position" && attribute !== "normal") geometry.deleteAttribute(attribute);
      const batch = batches.get(child.material) ?? [];
      batch.push(geometry);
      batches.set(child.material, batch);
      root.remove(child);
      if (geometry !== child.geometry) child.geometry.dispose();
    }
    for (const [mat, geometries] of batches) {
      const geometry = mergeGeometries(geometries);
      if (geometry) root.add(new THREE.Mesh(geometry, mat));
      for (const original of geometries) original.dispose();
    }
    root.scale.setScalar(e.layer === "air" ? config.visual.scale : 1);
    this.scene.add(root);
    this.enemies.set(e.id, root);
    return root;
  }
  render(
    world: World | undefined,
    dt: number,
    options: { display: boolean; highlight?: string; launching?: number },
  ) {
    if (!this.aircraft) return;
    const sceneDt =
      world && !options.display && world.clock.timeScale === 0 ? 0 : dt;
    this.time += sceneDt;
    this.resize();
    const p = this.aircraft.player;
    const era = eraOf(p.frame);
    if (era !== this.era) {
      this.era = era;
      const { colors } = ERAS[era];
      this.renderer.setClearColor(colors.haze);
      (this.scene.fog as THREE.Fog).color.set(colors.haze);
      this.terrainMat.uniforms.grass.value.set(colors.grass);
      this.terrainMat.uniforms.road.value.set(colors.accent);
      this.terrainMat.uniforms.haze.value.set(colors.haze);
      this.skyDome.material.uniforms.horizon.value.set(colors.haze);
      this.terrainChunks.setWaterColor(colors.water);
      this.terrainChunks.setHaze(colors.haze);
    }
    const display = options.display,
      launch = options.launching ?? 0;
    const alpha = world ? clamp(world.clock.accumulator / RULES.step) : 1;
    const x = display ? p.x : p.prevX + (p.x - p.prevX) * alpha;
    const z = display ? p.z : p.prevZ + (p.z - p.prevZ) * alpha;
    if (display) {
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
    if (display) {
      this.aircraft.group.rotation.z = Math.sin(this.time * 0.8) * 0.045;
      this.aircraft.group.rotation.x = Math.sin(this.time * 0.6) * 0.015;
    }
    if (world?.phase === "dying") {
      this.crashTime += dt;
      this.aircraft.group.position.y -= this.crashTime * this.crashTime * 2;
      this.aircraft.group.rotation.z += this.crashTime * 0.9;
    }
    this.terrainChunks.update(x, z);
    this.vegetation.update(x, z, this.quality);
    const wind = display ? undefined : world?.wind;
    updateVegetationWind(this.vegetationWind, this.time, wind, x, z);
    this.terrainChunks.updateTime(this.time);
    const cloudsEnabled = fixture?.clouds ?? true;
    const cloudWind = wind?.sample(x, z) ?? { x: -0.36, z: 0.93295 };
    this.cloudscape.update(
      sceneDt,
      cloudWind.x,
      cloudWind.z,
      wind?.gust ?? 0,
      this.camera.position,
      cloudsEnabled,
    );
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
    this.shadows.forEach((s) => (s.visible = false));
    if (QUALITIES[this.quality].shadows) {
      const shadow = this.shadows[0];
      shadow.visible = true;
      shadow.position.set(x + 1.4, surfaceHeight(x, z, 491) + 0.05, z + 0.5);
      shadow.scale.set(p.stats.wingspan * 1.25, p.stats.length * 1.2, 1);
    }
    if (world && !display) this.updateBattle(world);
    else this.hideBattle();
    this.updateSmoke(p, x, z, wind);
    this.renderer.info.reset();
    this.cloudscape.begin(this.renderer);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    const cloudStart = import.meta.env.DEV ? performance.now() : 0;
    let cloudMarchMs = 0;
    if (cloudsEnabled) {
      this.cloudscape.renderClouds(this.renderer, this.camera, this.quality);
      if (import.meta.env.DEV) cloudMarchMs = performance.now() - cloudStart;
    }
    this.cloudscape.compositeWorld(this.renderer, this.camera);
    if (import.meta.env.DEV) {
      const diagnostics = cloudDiagnostics.get(this)!;
      diagnostics.enabled = cloudsEnabled;
      diagnostics.resolution[0] = cloudsEnabled ? this.cloudscape.width : 0;
      diagnostics.resolution[1] = cloudsEnabled ? this.cloudscape.height : 0;
      diagnostics.samples = cloudsEnabled ? QUALITIES[this.quality].cloud.samples : 0;
      diagnostics.cameraDensity = this.cloudscape.cameraDensity;
      diagnostics.windDirection = [this.cloudscape.flow.x, this.cloudscape.flow.z];
      diagnostics.windSpeed = this.cloudscape.flow.speed;
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
  private updateBattle(world: World) {
    const p = world.player;
    let gi = 0,
      si = 1;
    const living = new Set(world.enemies.map((e) => e.id));
    for (const [id, mesh] of this.enemies)
      if (!living.has(id)) {
        this.scene.remove(mesh);
        mesh.traverse((o) => {
          if (o instanceof THREE.Mesh) o.geometry.dispose();
        });
        this.enemies.delete(id);
      }
    for (const e of world.enemies) {
      const mesh = this.enemies.get(e.id) ?? this.createEnemy(e);
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
      if (e.layer === "air" && QUALITIES[this.quality].shadows && si < 40) {
        const shadow = this.shadows[si++];
        shadow.visible = true;
        shadow.position.set(e.x + 1.4, surfaceHeight(e.x, e.z, 491) + 0.05, e.z + 0.5);
        shadow.scale.set(e.radius * 4, e.radius * 3, 1);
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
    world.effects.items.forEach((e, i) => {
      const mesh = this.effects[i];
      mesh.visible = e.active && i < QUALITIES[this.quality].particles;
      if (!mesh.visible) return;
      const t = 1 - e.life / e.maxLife;
      mesh.position.set(e.x, e.y + t * (e.kind === "ground" ? 1 : 0.3), e.z);
      mesh.quaternion.copy(this.camera.quaternion);
      mesh.scale.setScalar(e.radius * (0.3 + t * 1.8));
      const mat = mesh.material as THREE.ShaderMaterial;
      mat.uniforms.time.value = this.time + e.seed * 10;
      mat.uniforms.opacity.value = (1 - t) * 0.95;
      mat.uniforms.color.value.set(
        e.kind === "coin"
          ? "#f8e3a5"
          : e.kind === "hit"
            ? "#fff1c9"
            : "#f8af66",
      );
      mat.uniforms.mode.value = e.kind === "ground" && t > 0.3 ? 1 : 0;
    });
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
    this.lockFan.visible = Boolean(lock) && !world.isBombing;
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
    this.fireMeshes.forEach((mesh, i) => {
      const fire = world.fires[i];
      mesh.visible = Boolean(fire);
      if (fire) {
        mesh.position.set(fire.x, surfaceHeight(fire.x, fire.z, 491) + 0.2, fire.z);
        mesh.scale.setScalar(fire.radius * 2);
        const mat = mesh.material as THREE.ShaderMaterial;
        mat.uniforms.time.value = this.time;
        mat.uniforms.opacity.value = Math.min(1, fire.life);
      }
    });
  }
  private updateSmoke(p: Player, x: number, z: number, wind: WindField | undefined) {
    const damaged = p.parts.filter(
      (part) => part.health < part.maxHealth * 0.45,
    );
    const drift = damaged.length ? wind?.sample(x, z) : undefined;
    this.smoke.forEach((mesh, i) => {
      const part = damaged[i % Math.max(1, damaged.length)];
      mesh.visible = Boolean(part) && i < (this.quality === "low" ? 3 : 12);
      if (!part) return;
      const t = (this.time * 0.8 + i / 12) % 1,
        sin = Math.sin(p.heading),
        cos = Math.cos(p.heading);
      mesh.position.set(
        x + part.x * cos + part.z * sin - p.vx * t * 0.3 + (drift?.x ?? 0) * t,
        RULES.flightAltitude + .3 + t * 2,
        z - part.x * sin + part.z * cos - p.vz * t * 0.3 + (drift?.z ?? 0) * t,
      );
      mesh.scale.setScalar(0.5 + t * 1.9);
      mesh.quaternion.copy(this.camera.quaternion);
      const mat = mesh.material as THREE.ShaderMaterial;
      mat.uniforms.time.value = this.time + i;
      mat.uniforms.opacity.value = (1 - t) * 0.8;
      mat.uniforms.color.value.set(
        part.health < part.maxHealth * 0.2 && i % 3 === 0
          ? "#ff9b4e"
          : "#344440",
      );
    });
  }
  private hideBattle() {
    for (const batch of this.bulletBatches) batch.count = 0;
    this.effects.forEach((m) => (m.visible = false));
    this.enemies.forEach((m) => (m.visible = false));
    this.groundMarkers.forEach((m) => (m.visible = false));
    this.bombs.forEach((m) => (m.visible = false));
    this.fireMeshes.forEach((m) => (m.visible = false));
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
    };
  }
  dispose() {
    this.aircraft?.dispose();
    this.terrainChunks.dispose();
    this.terrainMat.dispose();
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
