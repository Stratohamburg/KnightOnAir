import * as THREE from "three";
import { RULES, QUALITIES, type Quality } from "../data/config";
import { combatantById } from "../data/combatants";
import { Random, clamp, damp, RAD } from "../services/Random";
import { World } from "../simulation/World";
import { actorAltitude, sampleTerrain, surfaceHeight } from "../simulation/Terrain";
import type { Player, Enemy } from "../simulation/types";
import {
  ProceduralAircraft,
  fuselageGeometry,
  wingGeometry,
} from "./ProceduralAircraft";
import {
  aircraftMaterial,
  terrainMaterial,
  crosshairMaterial,
  effectMaterial,
  projectileMaterial,
} from "./ShaderMaterials";
import { TerrainChunks } from "./TerrainChunks";
import { CloudField } from "./CloudField";

export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly overlayScene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly canvas: HTMLCanvasElement;
  private aircraft?: ProceduralAircraft;
  private terrainChunks: TerrainChunks;
  private cloudField: CloudField;
  private terrainMat = terrainMaterial();
  private enemies = new Map<number, THREE.Group>();
  private bulletMeshes: THREE.Mesh[] = [];
  private pickups: THREE.InstancedMesh;
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
  private forest: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private projected = new THREE.Vector3();
  private viewTarget = new THREE.Vector3();
  private anchor = new THREE.Vector3();
  private time = 0;
  private crashTime = 0;
  private cameraBombing = 0;
  private fpsTime = 0;
  private fpsFrames = 0;
  private slowFrames = 0;
  private fastFrames = 0;
  fps = 60;
  resolution = 1;
  quality: Quality = "standard";
  private width = 0;
  private height = 0;
  private battleView = false;
  private groundOrigin = { x: -99999, z: -99999 };
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
    sun.position.set(-15, 28, -8);
    this.scene.add(sun);
    this.overlayScene.add(new THREE.HemisphereLight("#fff6e5", "#526b61", 2.2));
    this.overlayScene.add(new THREE.DirectionalLight("#fff1ca", 2.4));
    this.scene.fog = new THREE.Fog("#cfefff", 70, 240);
    this.overlayScene.fog = this.scene.fog;
    this.renderer.autoClear = false;
    this.terrainChunks = new TerrainChunks(this.scene, this.terrainMat, 491);
    this.cloudField = new CloudField(this.scene, 491);
    const playerBullet = projectileMaterial("#ffe5a1"),
      enemyBullet = projectileMaterial("#f98769"),
      missileMat = projectileMaterial("#c6f4d4");
    this.materialCache.set("playerBullet", playerBullet);
    this.materialCache.set("enemyBullet", enemyBullet);
    this.materialCache.set("missile", missileMat);
    const bulletGeometry = new THREE.CylinderGeometry(0.06, 0.06, 0.8, 4);
    bulletGeometry.rotateX(Math.PI / 2);
    for (let i = 0; i < RULES.maxProjectiles; i++) {
      const mesh = new THREE.Mesh(bulletGeometry, playerBullet);
      mesh.visible = false;
      this.bulletMeshes.push(mesh);
      this.scene.add(mesh);
    }
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
    this.forest = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.65, 2.4, 5),
      new THREE.MeshStandardMaterial({
        color: "#415b45",
        flatShading: true,
        roughness: 1,
      }),
      210,
    );
    this.forest.frustumCulled = false;
    this.scene.add(this.forest);
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
    this.anchor.set(p.x, 0, p.z);
    this.viewTarget.copy(this.anchor);
  }
  setQuality(q: Quality) {
    this.quality = q;
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
    let material = this.materialCache.get(e.kind);
    if (!material) {
      material = aircraftMaterial(config.visual.color);
      this.materialCache.set(e.kind, material);
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
      add(
        fuselageGeometry(
          e.kind === "elite" ? 3.6 : 2.5,
          e.kind === "elite" ? 0.8 : 0.27,
        ),
        material,
      );
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
    root.scale.setScalar(e.layer === "air" ? config.visual.scale : 1);
    this.scene.add(root);
    this.enemies.set(e.id, root);
    return root;
  }
  private updateTerrain(x: number, z: number) {
    const cx = Math.round(x / 64) * 64,
      cz = Math.round(z / 64) * 64;
    if (cx === this.groundOrigin.x && cz === this.groundOrigin.z) return;
    this.groundOrigin = { x: cx, z: cz };
    this.terrainChunks.update(x, z);
    const random = new Random(89 + cx * 13 + cz * 11);
    for (let i = 0; i < 210; i++) {
      const cluster = Math.floor(i / 14),
        bx = Math.sin(cluster * 12.7) * 70 + cx,
        bz = Math.cos(cluster * 6.5) * 70 + cz;
      const treeX = bx + random.range(-5, 5);
      const treeZ = bz + random.range(-5, 5);
      const terrain = sampleTerrain(treeX, treeZ, 491);
      this.dummy.position.set(
        treeX,
        terrain.height + 1.2,
        treeZ,
      );
      const blocked = terrain.surface === "water" || terrain.roadMask > 0.3 || Math.abs(terrain.slopeX) + Math.abs(terrain.slopeZ) > 0.85;
      this.dummy.scale.setScalar(blocked ? 0.001 : random.range(0.65, 1.3));
      this.dummy.rotation.set(0, random.range(0, 6.28), 0);
      this.dummy.updateMatrix();
      this.forest.setMatrixAt(i, this.dummy.matrix);
    }
    this.forest.instanceMatrix.needsUpdate = true;
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
    const display = options.display,
      launch = options.launching ?? 0;
    const alpha = world ? clamp(world.clock.accumulator / RULES.step) : 1;
    const x = display ? p.x : p.prevX + (p.x - p.prevX) * alpha;
    const z = display ? p.z : p.prevZ + (p.z - p.prevZ) * alpha;
    if (this.battleView === display) {
      this.anchor.set(x, 0, z);
      this.battleView = !display;
    }
    this.anchor.x = damp(this.anchor.x, x + (display ? 0 : p.vx * 0.09), 7, dt);
    this.anchor.z = damp(this.anchor.z, z + (display ? 0 : p.vz * 0.09), 7, dt);
    this.cameraBombing = damp(this.cameraBombing, world?.isBombing ? 1 : 0, 10, dt);
    const displayDistance = 26 * Math.max(1, p.stats.wingspan / 7.8);
    const dist = display
      ? displayDistance - launch * 3
      : RULES.camera.distance + this.cameraBombing * 4;
    const pitch = (RULES.camera.pitch + this.cameraBombing * 10) * RAD;
    const fov = RULES.camera.fov - this.cameraBombing * 14;
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    const aspectZoom = this.camera.aspect < 0.55 ? 1.12 : 1;
    const groundY = surfaceHeight(this.anchor.x, this.anchor.z);
    this.camera.position.set(
      this.anchor.x,
      groundY + 10 + Math.sin(pitch) * dist * aspectZoom,
      this.anchor.z - Math.cos(pitch) * dist * aspectZoom,
    );
    const aimX = world?.aim.x ?? this.anchor.x;
    const aimZ = world?.aim.z ?? this.anchor.z + 1.5;
    this.viewTarget.set(
      display ? this.anchor.x : this.anchor.x * (1 - this.cameraBombing * 0.55) + aimX * this.cameraBombing * 0.55,
      display ? 0 : 2,
      display
        ? this.anchor.z - 2 - (displayDistance - 26) * 0.17
        : this.anchor.z * (1 - this.cameraBombing * 0.55) + aimZ * this.cameraBombing * 0.55,
    );
    this.camera.lookAt(this.viewTarget);
    this.aircraft.update(this.time, sceneDt, options.highlight, display);
    this.aircraft.group.position.x = x;
    this.aircraft.group.position.y = actorAltitude(x, z, 20);
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
    this.updateTerrain(x, z);
    this.terrainMat.uniforms.time.value = this.time;
    this.terrainChunks.updateTime(this.time);
    this.cloudField.setQuality(QUALITIES[this.quality].clouds);
    this.cloudField.update(this.time, x, z);
    this.shadows.forEach((s) => (s.visible = false));
    if (QUALITIES[this.quality].shadows) {
      const shadow = this.shadows[0];
      shadow.visible = true;
      shadow.position.set(x + 1.4, surfaceHeight(x, z, 491) + 0.05, z + 0.5);
      shadow.scale.set(p.stats.wingspan * 1.25, p.stats.length * 1.2, 1);
    }
    if (world && !display) this.updateBattle(world);
    else this.hideBattle();
    this.updateSmoke(p, x, z, world?.wind.gust ?? 0);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.clearDepth();
    this.renderer.render(this.overlayScene, this.camera);
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
      mesh.visible = true;
      mesh.position.set(
        e.x,
        e.layer === "air" ? actorAltitude(e.x, e.z, 20) : surfaceHeight(e.x, e.z) + 0.2,
        e.z,
      );
      mesh.rotation.set(0, e.heading, e.bank);
      if (e.layer !== "air") {
        const marker = this.groundMarkers[gi++];
        marker.visible = world.isBombing;
        marker.position.set(e.x, surfaceHeight(e.x, e.z, 491) + 0.12, e.z);
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
    world.projectiles.items.forEach((v, i) => {
      const mesh = this.bulletMeshes[i];
      const targetScene = v.team === "player" ? this.overlayScene : this.scene;
      if (mesh.parent !== targetScene) targetScene.add(mesh);
      mesh.visible = v.active;
      if (!v.active) return;
      mesh.position.set(v.x, v.y, v.z);
      mesh.rotation.y = v.heading;
      mesh.scale.setScalar(v.kind === "missile" ? 2 : 1);
      mesh.material = this.materialCache.get(
        v.team === "enemy"
          ? "enemyBullet"
          : v.kind === "missile"
            ? "missile"
            : "playerBullet",
      )!;
    });
    let ci = 0;
    for (const item of world.pickups.items) {
      if (!item.active) continue;
      this.dummy.position.set(
        item.x,
        surfaceHeight(item.x, item.z, 491) + 1.5 + Math.sin(this.time * 3 + item.x) * 0.12,
        item.z,
      );
      this.dummy.rotation.set(0, this.time * 2, 0);
      this.dummy.scale.setScalar(item.kind === "repairLarge" ? 1.35 : item.kind === "repairSmall" ? 1.05 : 1);
      this.dummy.updateMatrix();
      this.pickups.setMatrixAt(ci++, this.dummy.matrix);
    }
    this.pickups.count = ci;
    this.pickups.instanceMatrix.needsUpdate = true;
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
    this.lockFan.position.set(p.x, actorAltitude(p.x, p.z, 20, 491), p.z);
    const target = world.enemies.find((e) => e.id === lock?.targetId);
    this.targetRing.visible = Boolean(target);
    if (target) {
      this.targetRing.position.set(
        target.x,
        target.layer === "air" ? actorAltitude(target.x, target.z, 20, 491) : surfaceHeight(target.x, target.z, 491) + 0.5,
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
        const startY = actorAltitude(bomb.startX, bomb.startZ, 20, 491);
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
      const startY = actorAltitude(p.x, p.z, 20, 491);
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
  private updateSmoke(p: Player, x: number, z: number, wind: number) {
    const damaged = p.parts.filter(
      (part) => part.health < part.maxHealth * 0.45,
    );
    this.smoke.forEach((mesh, i) => {
      const part = damaged[i % Math.max(1, damaged.length)];
      mesh.visible = Boolean(part) && i < (this.quality === "low" ? 3 : 12);
      if (!part) return;
      const t = (this.time * 0.8 + i / 12) % 1,
        sin = Math.sin(p.heading),
        cos = Math.cos(p.heading);
      mesh.position.set(
        x + part.x * cos + part.z * sin - p.vx * t * 0.3 + wind * t,
        4.3 + t * 2,
        z - part.x * sin + part.z * cos - p.vz * t * 0.3,
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
    this.bulletMeshes.forEach((m) => (m.visible = false));
    this.effects.forEach((m) => (m.visible = false));
    this.enemies.forEach((m) => (m.visible = false));
    this.groundMarkers.forEach((m) => (m.visible = false));
    this.bombs.forEach((m) => (m.visible = false));
    this.fireMeshes.forEach((m) => (m.visible = false));
    this.pickups.count = 0;
    this.crosshair.visible = false;
    this.lockFan.visible = false;
    this.targetRing.visible = false;
    this.bombPath.visible = false;
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
    return this.cloudField.occludes(this.camera.position, this.projected);
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
    this.cloudField.dispose();
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
    this.renderer.dispose();
    this.canvas.remove();
  }
}
