import * as THREE from "three";
import { QUALITIES, type Quality } from "../data/config";
import { Random } from "../services/Random";
import { surfaceHeight } from "../simulation/Terrain";
import { cloudMaterial } from "./ShaderMaterials";
import { cloudCameraDensity, cloudVolumeMaterial } from "./CloudVolume";

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
export const cloudCapacity = Math.max(...Object.values(QUALITIES).map((quality) => quality.clouds));
const puffCapacity = Math.max(...Object.values(QUALITIES).map((quality) => quality.cloud.puffs));
const puffKinds = ["ico", "box"] as const;
const volumeCapacity = Math.max(...Object.values(QUALITIES).map((quality) => quality.cloud.volumes));
const volumeRange = 60;

export class CloudField {
  private readonly clusters: CloudClusterData[] = [];
  private readonly groups: THREE.Group[] = [];
  private readonly batches: THREE.InstancedMesh[][] = [];
  private quality?: Quality;
  private readonly volumeScene = new THREE.Scene();
  private readonly volumeGeometry = new THREE.BoxGeometry(2, 2, 2);
  private readonly volumes: THREE.Mesh<THREE.BoxGeometry, THREE.ShaderMaterial>[] = [];
  private readonly volumeCandidates: number[] = [];
  private readonly volumeDistances = new Float32Array(cloudCapacity);
  private readonly nearestFirst = (a: number, b: number) => this.volumeDistances[a] - this.volumeDistances[b];
  private readonly volumeBounds = new THREE.Sphere();
  private volumeCount = 0;
  private readonly veilScene = new THREE.Scene();
  private readonly veilCamera = new THREE.Camera();
  private readonly veil = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: { opacity: { value: 0 }, tint: { value: new THREE.Color("#e1f1ff") } },
    vertexShader: "void main() { gl_Position = vec4(position.xy, 0., 1.); }",
    fragmentShader: `uniform float opacity; uniform vec3 tint;
      void main() {
        gl_FragColor = vec4(tint, opacity);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  }));
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

  constructor(
    private readonly scene: THREE.Scene,
    private readonly seed = 491,
    private readonly shadowScene = scene,
  ) {
    this.shadows = new THREE.InstancedMesh(this.shadowGeometry, this.shadowMaterial, cloudCapacity);
    this.shadowMatrix.rotation.x = -Math.PI / 2;
    this.shadows.frustumCulled = false;
    this.shadowScene.add(this.shadows);
    this.build(cloudCapacity);
    for (let i = 0; i < volumeCapacity; i++) {
      const volume = new THREE.Mesh(this.volumeGeometry, cloudVolumeMaterial());
      volume.visible = false;
      volume.frustumCulled = false;
      this.volumes.push(volume);
      this.volumeScene.add(volume);
    }
    this.veil.frustumCulled = false;
    this.veilScene.add(this.veil);
    this.setQuality("standard");
  }

  get activeCount() {
    return QUALITIES[this.quality ?? "standard"].clouds;
  }

  get activeVolumes() {
    return this.volumeCount;
  }

  get veilOpacity() {
    return this.veil.material.uniforms.opacity.value as number;
  }

  private build(count: number) {
    const random = new Random(this.seed + 801);
    const tint = new THREE.Color();
    for (let id = 0; id < count; id++) {
      const layer = (id % 3) as 0 | 1 | 2;
      const puffs: CloudPuff[] = [];
      const radius = random.range(12, 22);
      const main = radius * random.range(0.38, 0.46);
      puffs.push({ x: 0, y: radius * 0.42, z: 0, radius: main, kind: "ico", rotation: random.range(0, Math.PI * 2), tint: random.range(0, 1) });
      for (let i = 1; i < puffCapacity; i++) {
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
      const batches = puffKinds.map((kind) => {
        const members = puffs.filter((puff) => puff.kind === kind);
        const geometry = kind === "ico" ? this.icoGeometry : this.boxGeometry;
        const batch = new THREE.InstancedMesh(geometry, this.material, members.length);
        const transform = new THREE.Object3D();
        members.forEach((puff, index) => {
          transform.position.set(puff.x, puff.y, puff.z);
          transform.scale.set(puff.radius * 1.25, puff.radius * .65, puff.radius);
          transform.rotation.y = puff.rotation;
          transform.updateMatrix();
          batch.setMatrixAt(index, transform.matrix);
          batch.setColorAt(index, tint.setScalar(THREE.MathUtils.lerp(0.91, 1.05, puff.tint)));
        });
        batch.computeBoundingSphere();
        group.add(batch);
        return batch;
      });
      this.batches.push(batches);
      this.groups.push(group);
      this.scene.add(group);
    }
  }

  setQuality(quality: Quality) {
    if (this.quality === quality) return;
    this.quality = quality;
    const { clouds, cloud } = QUALITIES[quality];
    this.material.uniforms.shell.value = Number(cloud.shell);
    for (let i = 0; i < this.groups.length; i++) {
      this.groups[i].visible = i < clouds;
      const puffs = this.clusters[i].puffs.slice(0, cloud.puffs);
      this.batches[i].forEach((batch, index) => {
        batch.count = puffs.filter((puff) => puff.kind === puffKinds[index]).length;
      });
    }
  }

  update(
    time: number,
    playerX: number,
    playerZ: number,
    camera?: THREE.Vector3,
    frustum?: THREE.Frustum,
    volumeEnabled = true,
    fixture?: THREE.Vector3 | false,
  ) {
    this.material.uniforms.time.value = time;
    const { cloud } = QUALITIES[this.quality ?? "standard"];
    const clusterCount = this.activeCount;
    this.volumeCandidates.length = 0;
    let cameraDensity = 0;
    const shadowMatrix = this.shadowMatrix;
    let shadowCount = 0;
    for (let i = 0; i < this.groups.length; i++) {
      const data = this.clusters[i];
      const group = this.groups[i];
      group.visible = fixture === undefined ? i < clusterCount : fixture !== false && i === 0;
      const x = playerX + ((((data.baseX + time * data.driftX - playerX) % 160) + 240) % 160) - 80;
      const z = playerZ + ((((data.baseZ + time * data.driftZ - playerZ) % 160) + 240) % 160) - 80;
      const ground = surfaceHeight(x, z, this.seed);
      group.position.set(x, ground + layerHeight[data.layer], z);
      const distance = Math.hypot(x - playerX, z - playerZ);
      const edgeFade = 1 - THREE.MathUtils.smoothstep(distance, 62, 80);
      group.scale.setScalar(edgeFade);
      if (fixture && i === 0) {
        group.position.copy(fixture);
        group.position.y -= data.radius * .39;
        group.scale.setScalar(1);
      }
      for (const batch of this.batches[i]) batch.visible = true;
      if (group.visible && group.scale.x > 0.01 && shadowCount < this.shadows.instanceMatrix.count) {
        const shadowX = group.position.x + 2.5, shadowZ = group.position.z + 1;
        shadowMatrix.position.set(shadowX, surfaceHeight(shadowX, shadowZ, this.seed) + 0.06, shadowZ);
        shadowMatrix.scale.set(data.radius * 1.6, data.radius * 1.2, 1);
        shadowMatrix.updateMatrix();
        this.shadows.setMatrixAt(shadowCount++, shadowMatrix.matrix);
      }
      if (!group.visible || !camera || group.scale.x < .05) continue;
      const radius = data.radius * group.scale.x;
      const centerY = group.position.y + radius * .39;
      const dx = camera.x - group.position.x, dy = camera.y - centerY, dz = camera.z - group.position.z;
      cameraDensity = Math.max(cameraDensity, cloudCameraDensity(dx / radius, dy / (radius * .57), dz / radius));
      if (!volumeEnabled || !cloud.volumes) continue;
      const distanceSq = dx * dx + dy * dy + dz * dz;
      if (distanceSq > volumeRange * volumeRange) continue;
      this.volumeBounds.center.set(group.position.x, centerY, group.position.z);
      this.volumeBounds.radius = radius * 1.53;
      if (frustum && !frustum.intersectsSphere(this.volumeBounds)) continue;
      this.volumeDistances[i] = distanceSq;
      this.volumeCandidates.push(i);
    }
    this.shadows.count = shadowCount;
    this.shadows.instanceMatrix.needsUpdate = true;
    this.volumeCandidates.sort(this.nearestFirst);
    this.volumeCount = Math.min(cloud.volumes, this.volumeCandidates.length);
    this.volumes.forEach((mesh, index) => {
      mesh.visible = index < this.volumeCount;
      if (!mesh.visible) return;
      const id = this.volumeCandidates[index];
      const group = this.groups[id];
      const radius = this.clusters[id].radius * group.scale.x;
      mesh.position.copy(group.position);
      mesh.position.y += radius * .39;
      mesh.scale.set(radius, radius * .57, radius);
      mesh.renderOrder = this.volumeCount - index;
      const { uniforms } = mesh.material;
      uniforms.center.value.copy(mesh.position);
      uniforms.radii.value.copy(mesh.scale);
      uniforms.seed.value = (this.seed % 977) * .029 + id * 3.17;
      uniforms.time.value = time;
      uniforms.steps.value = cloud.steps;
      uniforms.sunSteps.value = cloud.sunSteps;
      for (const batch of this.batches[id]) batch.visible = false;
    });
    this.veil.material.uniforms.opacity.value = cameraDensity * cloud.veil;
  }

  renderVolumes(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera, depth: THREE.DepthTexture) {
    for (let i = 0; i < this.volumeCount; i++) {
      const { uniforms } = this.volumes[i].material;
      uniforms.worldDepth.value = depth;
      uniforms.viewport.value.set(renderer.domElement.width, renderer.domElement.height);
      uniforms.cameraNear.value = camera.near;
      uniforms.cameraFar.value = camera.far;
    }
    renderer.render(this.volumeScene, camera);
  }

  renderVeil(renderer: THREE.WebGLRenderer) {
    if (this.veilOpacity > 0) renderer.render(this.veilScene, this.veilCamera);
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
      const radius = this.clusters[i].radius * group.scale.x;
      const center = group.position;
      const ox = camera.x - center.x;
      const oy = (camera.y - center.y - radius * .39) / .55;
      const oz = camera.z - center.z;
      const scaledDy = dy / .55;
      const t = THREE.MathUtils.clamp(-(ox * dx + oy * scaledDy + oz * dz) / (dx * dx + scaledDy * scaledDy + dz * dz), 0, 1);
      if (Math.hypot(ox + dx * t, oy + scaledDy * t, oz + dz * t) < radius * .78) return true;
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
    this.volumeGeometry.dispose();
    this.volumes.forEach((mesh) => mesh.material.dispose());
    this.volumeScene.clear();
    this.veil.geometry.dispose();
    this.veil.material.dispose();
    this.veilScene.clear();
    this.shadowScene.remove(this.shadows);
    this.shadows.dispose();
    for (const group of this.groups)
      for (const mesh of group.children)
        if (mesh instanceof THREE.InstancedMesh) mesh.dispose();
  }
}
