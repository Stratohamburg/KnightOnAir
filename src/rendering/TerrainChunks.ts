import * as THREE from "three";
import {
  TERRAIN,
  sampleTerrain,
  terrainHeight,
  surfaceHeight,
} from "../simulation/Terrain";
import { createDefaultRoutes, routeHeading, routePosition } from "../simulation/Routes";
import { waterMaterial } from "./ShaderMaterials";
import { TerrainLandmarks } from "./TerrainLandmarks";
import { routeBridges } from "./RouteBridges";
import type { VegetationWindUniforms } from "./VegetationWind";

interface ChunkMesh {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  water?: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
}

const chunkKey = (x: number, z: number) => `${x}:${z}`;

export class TerrainChunks {
  private readonly chunks = new Map<string, ChunkMesh>();
  private readonly water: THREE.ShaderMaterial;
  private readonly landmarks: TerrainLandmarks;
  private readonly routeObjects: THREE.Object3D[] = [];
  private centerX = Number.NaN;
  private centerZ = Number.NaN;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly material: THREE.ShaderMaterial,
    private readonly seed: number,
    lighting: THREE.ShaderMaterial["uniforms"],
    wind?: VegetationWindUniforms,
  ) {
    this.water = waterMaterial(wind);
    Object.assign(this.water.uniforms, lighting);
    this.landmarks = new TerrainLandmarks(scene, seed, lighting);
    this.buildRouteProps(seed, lighting);
  }

  setWaterColor(color: string) {
    this.water.uniforms.tint.value.set(color);
  }

  setHaze(color: string, valleyFog = color, sunTint = "#fff3cc", skyZenith = "#4d9ed6", skyHorizon = color) {
    this.water.uniforms.haze.value.set(color);
    this.water.uniforms.valleyFog.value.set(valleyFog);
    this.water.uniforms.sunTint.value.set(sunTint);
    this.water.uniforms.skyZenith.value.set(skyZenith);
    this.water.uniforms.skyHorizon.value.set(skyHorizon);
    this.landmarks.setHaze(color, valleyFog, sunTint);
  }

  setShadows(visible: boolean) {
    this.landmarks.setShadows(visible);
  }

  private buildRouteProps(seed: number, lighting: THREE.ShaderMaterial["uniforms"]) {
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
    const bridge = routeBridges(routes, lighting);
    this.routeObjects.push(bridge);
    this.scene.add(bridge);
    const roadside = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(.075, .18, .6, 6).translate(0, .29, 0),
      new THREE.MeshStandardMaterial({ color: "#afaa8a", roughness: 1, flatShading: true }),
      256,
    );
    const object = new THREE.Object3D();
    let sleeperCount = 0;
    let railCount = 0;
    let roadsideCount = 0;
    for (const route of routes) {
      if (route.kind === "water") continue;
      const spacing = route.kind === "rail" ? 1.4 : 8;
      for (let at = 0; at < route.length; at += spacing) {
        const point = routePosition(route, at);
        const y = point.y;
        const heading = routeHeading(route, at);
        if (route.kind === "rail") {
          const from = routePosition(route, at - spacing / 2);
          const to = routePosition(route, at + spacing / 2);
          const pitch = -Math.atan2(to.y - from.y, Math.hypot(to.x - from.x, to.z - from.z));
          object.rotation.set(pitch, heading, 0, "YXZ");
          object.position.set(point.x, y + .18, point.z);
          object.updateMatrix();
          if (sleeperCount < sleeper.count) sleeper.setMatrixAt(sleeperCount++, object.matrix);
          for (const side of [-0.55, 0.55]) {
            object.position.set(point.x + Math.cos(heading) * side, y + 0.31, point.z - Math.sin(heading) * side);
            object.updateMatrix();
            if (railCount < rail.count) rail.setMatrixAt(railCount++, object.matrix);
          }
        }
        if (route.kind === "road") {
          for (const side of [-4, 4]) {
            const postX = point.x + Math.cos(heading) * side;
            const postZ = point.z - Math.sin(heading) * side;
            const postY = terrainHeight(postX, postZ, seed);
            if (postY <= TERRAIN.waterLevel) continue;
            object.position.set(postX, postY, postZ);
            object.rotation.set(0, heading, 0);
            object.updateMatrix();
            if (roadsideCount < roadside.count) roadside.setMatrixAt(roadsideCount++, object.matrix);
          }
        }
      }
    }
    sleeper.count = sleeperCount;
    rail.count = railCount;
    roadside.count = roadsideCount;
    for (const mesh of [sleeper, rail, roadside]) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      this.routeObjects.push(mesh);
      this.scene.add(mesh);
    }
  }

  update(x: number, z: number) {
    const centerX = Math.round(x / TERRAIN.chunk);
    const centerZ = Math.round(z / TERRAIN.chunk);
    if (centerX === this.centerX && centerZ === this.centerZ) return;
    this.centerX = centerX;
    this.centerZ = centerZ;
    const wanted = new Set<string>();
    const radius = TERRAIN.chunkRadius;
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const cellX = centerX + dx;
        const cellZ = centerZ + dz;
        const key = chunkKey(cellX, cellZ);
        wanted.add(key);
        if (!this.chunks.has(key)) {
          this.chunks.set(key, this.create(cellX, cellZ));
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

  private create(cellX: number, cellZ: number): ChunkMesh {
    const segments = TERRAIN.segments;
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const normals: number[] = [];
    const roadMasks: number[] = [];
    const originX = cellX * TERRAIN.chunk;
    const originZ = cellZ * TERRAIN.chunk;
    for (let iz = 0; iz <= segments; iz++) {
      for (let ix = 0; ix <= segments; ix++) {
        const localX = (ix / segments - 0.5) * TERRAIN.chunk;
        const localZ = (iz / segments - 0.5) * TERRAIN.chunk;
        const worldX = originX + localX;
        const worldZ = originZ + localZ;
        const sample = sampleTerrain(worldX, worldZ, this.seed);
        const length = Math.hypot(sample.slopeX, 1, sample.slopeZ);
        positions.push(localX, sample.bedHeight, localZ);
        normals.push(-sample.slopeX / length, 1 / length, -sample.slopeZ / length);
        roadMasks.push(sample.roadMask);
      }
    }

    const indices: number[] = [];
    const waterIndices: number[] = [];
    const belowWater = (index: number) => positions[index * 3 + 1] < TERRAIN.waterLevel;
    const row = segments + 1;
    for (let iz = 0; iz < segments; iz++) {
      for (let ix = 0; ix < segments; ix++) {
        const a = iz * row + ix;
        const b = a + 1;
        const c = a + row;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
        if (belowWater(a) || belowWater(c) || belowWater(b)) waterIndices.push(a, c, b);
        if (belowWater(b) || belowWater(c) || belowWater(d)) waterIndices.push(b, c, d);
      }
    }
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute("roadMask", new THREE.Float32BufferAttribute(roadMasks, 1));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, this.material);
    mesh.position.set(originX, 0, originZ);
    this.scene.add(mesh);
    if (waterIndices.length === 0) return { mesh };

    // The water shader projects the same triangles onto the surface and clips
    // them against the interpolated bed, so the river follows the actual shore.
    const waterGeometry = new THREE.BufferGeometry();
    waterGeometry.setAttribute("position", geometry.attributes.position);
    waterGeometry.setIndex(waterIndices);
    waterGeometry.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(0, TERRAIN.waterLevel, 0),
      TERRAIN.chunk / Math.SQRT2,
    );
    const water = new THREE.Mesh(waterGeometry, this.water);
    water.position.copy(mesh.position);
    this.scene.add(water);
    return { mesh, water };
  }

  private remove(chunk: ChunkMesh) {
    this.scene.remove(chunk.mesh);
    if (chunk.water) {
      this.scene.remove(chunk.water);
      chunk.water.geometry.dispose();
    }
    chunk.mesh.geometry.dispose();
  }

  dispose() {
    this.water.dispose();
    this.landmarks.dispose();
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
    this.water.uniforms.time.value = time;
    this.landmarks.updateTime(time);
  }

  setVisible(visible: boolean) {
    for (const chunk of this.chunks.values()) {
      chunk.mesh.visible = visible;
      if (chunk.water) chunk.water.visible = visible;
    }
    for (const object of this.routeObjects) object.visible = visible;
    this.landmarks.setVisible(visible);
  }
}
