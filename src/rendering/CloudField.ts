import * as THREE from "three";
import { Random } from "../services/Random";
import { surfaceHeight } from "../simulation/Terrain";
import { cloudMaterial } from "./ShaderMaterials";

export interface CloudPuff {
  x: number;
  y: number;
  z: number;
  radius: number;
  kind: "ico" | "box";
  rotation: number;
  tint: number;
}

export interface CloudClusterData {
  id: number;
  layer: 0 | 1 | 2;
  baseX: number;
  baseZ: number;
  radius: number;
  driftX: number;
  driftZ: number;
  puffs: CloudPuff[];
}

const layerHeight = [14, 28, 42] as const;
const layerSpeed = [0.8, 1.1, 1.4] as const;

export class CloudField {
  private readonly clusters: CloudClusterData[] = [];
  private readonly groups: THREE.Group[] = [];
  private readonly icoGeometry = new THREE.IcosahedronGeometry(1, 1);
  private readonly boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  private readonly material = cloudMaterial();
  private readonly shadowMatrix = new THREE.Object3D();
  private readonly shadowGeometry = new THREE.PlaneGeometry(1, 1);
  private readonly shadowMaterial = new THREE.MeshBasicMaterial({
    color: "#57758b",
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  private readonly shadows: THREE.InstancedMesh;

  constructor(private readonly scene: THREE.Scene, private readonly seed = 491) {
    this.shadows = new THREE.InstancedMesh(this.shadowGeometry, this.shadowMaterial, 10);
    this.shadows.rotation.x = -Math.PI / 2;
    this.shadows.frustumCulled = false;
    this.scene.add(this.shadows);
    this.build(7);
  }

  private build(count: number) {
    const random = new Random(this.seed + 801);
    for (let id = 0; id < count; id++) {
      const layer = (id % 3) as 0 | 1 | 2;
      const puffs: CloudPuff[] = [];
      const radius = random.range(12, 22);
      const main = radius * random.range(0.38, 0.46);
      puffs.push({ x: 0, y: radius * 0.42, z: 0, radius: main, kind: "ico", rotation: random.range(0, Math.PI * 2), tint: random.range(0, 1) });
      for (let i = 1; i < 7; i++) {
        const angle = random.range(0, Math.PI * 2);
        const distance = random.range(radius * 0.12, radius * 0.56);
        puffs.push({
          x: Math.cos(angle) * distance,
          y: random.range(radius * 0.2, radius * 0.62),
          z: Math.sin(angle) * distance,
          radius: radius * random.range(0.18, 0.34),
          kind: i % 3 === 0 ? "box" : "ico",
          rotation: random.range(0, Math.PI * 2),
          tint: random.range(0, 1),
        });
      }
      const data: CloudClusterData = {
        id,
        layer,
        baseX: random.range(-70, 70),
        baseZ: random.range(-70, 70),
        radius,
        driftX: layerSpeed[layer] * random.range(0.7, 1.2),
        driftZ: layerSpeed[layer] * random.range(-0.35, 0.35),
        puffs,
      };
      this.clusters.push(data);
      const group = new THREE.Group();
      for (const kind of ["ico", "box"] as const) {
        const members = puffs.filter((puff) => puff.kind === kind);
        if (!members.length) continue;
        const geometry = kind === "ico" ? this.icoGeometry : this.boxGeometry;
        const batch = new THREE.InstancedMesh(geometry, this.material, members.length);
        const transform = new THREE.Object3D();
        members.forEach((puff, index) => {
          transform.position.set(puff.x, puff.y, puff.z);
          transform.scale.set(puff.radius * 1.25, puff.radius * .65, puff.radius);
          transform.rotation.y = puff.rotation;
          transform.updateMatrix();
          batch.setMatrixAt(index, transform.matrix);
        });
        batch.computeBoundingSphere();
        group.add(batch);
      }
      group.visible = id < 7;
      this.groups.push(group);
      this.scene.add(group);
    }
  }

  setQuality(count: number) {
    for (let i = 0; i < this.groups.length; i++) this.groups[i].visible = i < count;
  }

  update(time: number, playerX: number, playerZ: number) {
    const shadowMatrix = this.shadowMatrix;
    let shadowCount = 0;
    for (let i = 0; i < this.groups.length; i++) {
      const data = this.clusters[i];
      const group = this.groups[i];
      const x = playerX + ((((data.baseX + time * data.driftX - playerX) % 160) + 240) % 160) - 80;
      const z = playerZ + ((((data.baseZ + time * data.driftZ - playerZ) % 160) + 240) % 160) - 80;
      const ground = surfaceHeight(x, z, this.seed);
      group.position.set(x, ground + layerHeight[data.layer], z);
      const distance = Math.hypot(x - playerX, z - playerZ);
      const nearFade = THREE.MathUtils.smoothstep(distance, 8, 18);
      const edgeFade = 1 - THREE.MathUtils.smoothstep(distance, 62, 80);
      group.scale.setScalar(Math.max(0, Math.min(1, nearFade * edgeFade)));
      if (group.visible && group.scale.x > 0.01 && shadowCount < this.shadows.instanceMatrix.count) {
        shadowMatrix.position.set(x + 2.5, surfaceHeight(x, z, this.seed) + 0.06, z + 1);
        shadowMatrix.scale.set(data.radius * 1.6, data.radius * 1.2, 1);
        shadowMatrix.updateMatrix();
        this.shadows.setMatrixAt(shadowCount++, shadowMatrix.matrix);
      }
    }
    this.shadows.count = shadowCount;
    this.shadows.instanceMatrix.needsUpdate = true;
  }

  occludes(camera: THREE.Vector3, target: THREE.Vector3) {
    const dx = target.x - camera.x;
    const dy = target.y - camera.y;
    const dz = target.z - camera.z;
    const lengthSq = dx * dx + dy * dy + dz * dz;
    if (lengthSq <= 0.001) return false;
    for (let i = 0; i < this.groups.length; i++) {
      const group = this.groups[i];
      if (!group.visible || group.scale.x < 0.05) continue;
      const center = group.position;
      const t = THREE.MathUtils.clamp(((center.x - camera.x) * dx + (center.y - camera.y) * dy + (center.z - camera.z) * dz) / lengthSq, 0, 1);
      const closest = new THREE.Vector3(camera.x + dx * t, camera.y + dy * t, camera.z + dz * t);
      const radius = this.clusters[i].radius * group.scale.x * 0.78;
      if (closest.distanceTo(center) < radius) return true;
    }
    return false;
  }

  dispose() {
    this.groups.forEach((group) => this.scene.remove(group));
    this.icoGeometry.dispose();
    this.boxGeometry.dispose();
    this.shadowGeometry.dispose();
    this.shadowMaterial.dispose();
    this.material.dispose();
    this.scene.remove(this.shadows);
    this.shadows.dispose();
    for (const group of this.groups)
      for (const mesh of group.children)
        if (mesh instanceof THREE.InstancedMesh) mesh.dispose();
  }
}
