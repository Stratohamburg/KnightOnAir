import * as THREE from "three";
import {
  TERRAIN,
  isWater,
  sampleTerrain,
  surfaceHeight,
  terrainNormal,
} from "../simulation/Terrain";
import { createDefaultRoutes, routeHeading, routePosition } from "../simulation/Routes";
import { waterMaterial } from "./ShaderMaterials";

interface ChunkMesh {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  cellX: number;
  cellZ: number;
  segments: number;
}

const chunkKey = (x: number, z: number) => `${x}:${z}`;

export class TerrainChunks {
  private readonly chunks = new Map<string, ChunkMesh>();
  private readonly water: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private readonly routeObjects: THREE.Object3D[] = [];
  private readonly farMountains = new THREE.Group();
  private centerX = Number.NaN;
  private centerZ = Number.NaN;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly material: THREE.ShaderMaterial,
    private readonly seed = 491,
  ) {
    this.water = new THREE.Mesh(
      new THREE.PlaneGeometry(384, 384, 1, 1),
      waterMaterial(),
    );
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = TERRAIN.waterLevel - 0.02;
    this.water.renderOrder = -1;
    this.water.frustumCulled = false;
    this.scene.add(this.water);
    this.buildRouteProps(seed);
    this.buildFarMountains(seed);
    this.scene.add(this.farMountains);
  }

  setWaterColor(color: string) {
    this.water.material.uniforms.tint.value.set(color);
  }

  private buildRouteProps(seed: number) {
    const routes = createDefaultRoutes(seed);
    const sleeper = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1.6, 0.12, 0.18),
      new THREE.MeshStandardMaterial({ color: "#725a45", roughness: 1, flatShading: true }),
      640,
    );
    const rail = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.08, 0.08, 1.6),
      new THREE.MeshStandardMaterial({ color: "#526b7d", metalness: 0.3, roughness: 0.7, flatShading: true }),
      1280,
    );
    const bridge = new THREE.InstancedMesh(
      new THREE.BoxGeometry(2.4, 0.18, 0.9),
      new THREE.MeshStandardMaterial({ color: "#9b7655", roughness: 1, flatShading: true }),
      40,
    );
    const roadside = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.22, 0.75, 0.18),
      new THREE.MeshStandardMaterial({ color: "#d7b777", roughness: 1, flatShading: true }),
      256,
    );
    const facility = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1.6, 0.35, 0.8),
      new THREE.MeshStandardMaterial({ color: "#c98a4a", roughness: 1, flatShading: true }),
      112,
    );
    const object = new THREE.Object3D();
    let sleeperCount = 0;
    let railCount = 0;
    let bridgeCount = 0;
    let roadsideCount = 0;
    let facilityCount = 0;
    for (const route of routes) {
      if (route.kind === "water") continue;
      const spacing = route.kind === "rail" ? 1.4 : 8;
      for (let at = 0; at < route.length; at += spacing) {
        const point = routePosition(route, at);
        const y = point.y;
        const heading = routeHeading(route, at);
        if (route.kind === "rail") {
          object.position.set(point.x, y + .1, point.z);
          object.rotation.set(0, heading, 0);
          object.scale.set(1, 1, 1);
          object.updateMatrix();
          if (sleeperCount < sleeper.count) sleeper.setMatrixAt(sleeperCount++, object.matrix);
          for (const side of [-0.55, 0.55]) {
            object.position.set(point.x + Math.cos(heading) * side, y + 0.28, point.z - Math.sin(heading) * side);
            object.rotation.set(0, heading, 0);
            object.updateMatrix();
            if (railCount < rail.count) rail.setMatrixAt(railCount++, object.matrix);
          }
          if (isWater(point.x, point.z, seed) && bridgeCount < bridge.count) {
            object.position.set(point.x, y - .05, point.z);
            object.rotation.set(0, heading, 0);
            object.updateMatrix();
            bridge.setMatrixAt(bridgeCount++, object.matrix);
          }
        }
        if (route.kind === "road") {
          for (const side of [-4, 4]) {
            object.position.set(point.x + Math.cos(heading) * side, y + 0.38, point.z - Math.sin(heading) * side);
            object.rotation.set(0, heading, 0);
            object.updateMatrix();
            if (roadsideCount < roadside.count) roadside.setMatrixAt(roadsideCount++, object.matrix);
          }
          if (at % 32 === 0 && facilityCount < facility.count) {
            object.position.set(point.x + Math.cos(heading) * 5, y + 0.18, point.z - Math.sin(heading) * 5);
            object.rotation.set(0, heading, 0);
            object.updateMatrix();
            facility.setMatrixAt(facilityCount++, object.matrix);
          }
        }
      }
    }
    sleeper.count = sleeperCount;
    rail.count = railCount;
    bridge.count = bridgeCount;
    roadside.count = roadsideCount;
    facility.count = facilityCount;
    for (const mesh of [sleeper, rail, bridge, roadside, facility]) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false;
      this.routeObjects.push(mesh);
      this.scene.add(mesh);
    }
  }

  private buildFarMountains(seed: number) {
    const geometry = new THREE.ConeGeometry(30, 18, 6, 1, false);
    const material = new THREE.MeshStandardMaterial({ color: "#78b59b", roughness: 1, flatShading: true });
    for (let i = 0; i < 12; i++) {
      const mountain = new THREE.Mesh(geometry, material);
      const angle = (i / 12) * Math.PI * 2;
      const height = 0.7 + ((Math.sin(seed * 0.017 + i * 2.7) + 1) * 0.22);
      mountain.position.set(Math.sin(angle) * 260, 8 * height, Math.cos(angle) * 260);
      mountain.scale.set(1.2 + height * 0.4, height, 1.2 + height * 0.4);
      mountain.rotation.y = angle + 0.4;
      this.farMountains.add(mountain);
    }
    this.farMountains.frustumCulled = false;
  }

  update(x: number, z: number) {
    const centerX = Math.round(x / TERRAIN.chunk);
    const centerZ = Math.round(z / TERRAIN.chunk);
    if (centerX === this.centerX && centerZ === this.centerZ) return;
    this.centerX = centerX;
    this.centerZ = centerZ;
    this.water.position.x = centerX * TERRAIN.chunk;
    this.water.position.z = centerZ * TERRAIN.chunk;
    this.farMountains.position.set(centerX * TERRAIN.chunk, 0, centerZ * TERRAIN.chunk);

    const wanted = new Set<string>();
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cellX = centerX + dx;
        const cellZ = centerZ + dz;
        const key = chunkKey(cellX, cellZ);
        wanted.add(key);
        const distance = Math.hypot(dx * TERRAIN.chunk, dz * TERRAIN.chunk);
        const segments = distance < 110 ? TERRAIN.nearSegments : TERRAIN.farSegments;
        const current = this.chunks.get(key);
        if (!current || current.segments !== segments) {
          if (current) this.remove(current);
          const next = this.create(cellX, cellZ, segments);
          this.chunks.set(key, next);
        }
      }
    }

    for (const [key, chunk] of this.chunks) {
      if (!wanted.has(key)) {
        this.remove(chunk);
        this.chunks.delete(key);
      }
    }
  }

  private create(cellX: number, cellZ: number, segments: number): ChunkMesh {
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const normals: number[] = [];
    const heights: number[] = [];
    const surfaceMasks: number[] = [];
    const roadMasks: number[] = [];
    const shoreMasks: number[] = [];
    const originX = cellX * TERRAIN.chunk;
    const originZ = cellZ * TERRAIN.chunk;
    for (let iz = 0; iz <= segments; iz++) {
      for (let ix = 0; ix <= segments; ix++) {
        const localX = (ix / segments - 0.5) * TERRAIN.chunk;
        const localZ = (iz / segments - 0.5) * TERRAIN.chunk;
        const worldX = originX + localX;
        const worldZ = originZ + localZ;
        const sample = sampleTerrain(worldX, worldZ, this.seed);
        const normal = terrainNormal(worldX, worldZ, this.seed);
        positions.push(localX, sample.height, localZ);
        normals.push(normal.x, normal.y, normal.z);
        heights.push(sample.height);
        surfaceMasks.push(sample.surfaceMask);
        roadMasks.push(sample.roadMask);
        shoreMasks.push(sample.shoreMask);
      }
    }

    const indices: number[] = [];
    const row = segments + 1;
    for (let iz = 0; iz < segments; iz++) {
      for (let ix = 0; ix < segments; ix++) {
        const a = iz * row + ix;
        const b = a + 1;
        const c = a + row;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute("height", new THREE.Float32BufferAttribute(heights, 1));
    geometry.setAttribute("surfaceMask", new THREE.Float32BufferAttribute(surfaceMasks, 1));
    geometry.setAttribute("roadMask", new THREE.Float32BufferAttribute(roadMasks, 1));
    geometry.setAttribute("shoreMask", new THREE.Float32BufferAttribute(shoreMasks, 1));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, this.material);
    mesh.position.set(originX, 0, originZ);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    return { mesh, cellX, cellZ, segments };
  }

  private remove(chunk: ChunkMesh) {
    this.scene.remove(chunk.mesh);
    chunk.mesh.geometry.dispose();
  }

  dispose() {
    this.scene.remove(this.water);
    this.water.geometry.dispose();
    this.water.material.dispose();
    this.scene.remove(this.farMountains);
    const mountainGeometry = this.farMountains.children[0] instanceof THREE.Mesh ? this.farMountains.children[0].geometry : undefined;
    const mountainMaterial = this.farMountains.children[0] instanceof THREE.Mesh ? this.farMountains.children[0].material : undefined;
    mountainGeometry?.dispose();
    if (Array.isArray(mountainMaterial)) mountainMaterial.forEach((material) => material.dispose());
    else mountainMaterial?.dispose();
    for (const object of this.routeObjects) {
      this.scene.remove(object);
      if (object instanceof THREE.Mesh || object instanceof THREE.InstancedMesh) {
        object.geometry.dispose();
        const material = object.material;
        if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
        else material.dispose();
      }
    }
    for (const chunk of this.chunks.values()) this.remove(chunk);
    this.chunks.clear();
  }

  get heightAt() {
    return surfaceHeight;
  }

  updateTime(time: number) {
    this.material.uniforms.time.value = time;
    this.water.material.uniforms.time.value = time;
  }
}
