import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { riverZ, surfaceHeight } from "../simulation/Terrain";
import { sampleTerrain, TERRAIN } from "../simulation/Terrain";
import { Random } from "../services/Random";
import { cloudShadowGLSL } from "./CloudShadowShader";
import { landscapeLight } from "./ShaderMaterials";
import { ContentCatalog } from "../content/3d/ContentCatalog";

function stoneArch(x: number, z: number, span: number, rise: number, angle: number, seed: number) {
  const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
  const depthAxis = new THREE.Vector3(-direction.z, 0, direction.x);
  const start = surfaceHeight(x - direction.x * span, z - direction.z * span, seed) - .8;
  const end = surfaceHeight(x + direction.x * span, z + direction.z * span, seed) - .8;
  const positions: number[] = [], indices: number[] = [], colors: number[] = [];
  const pale = new THREE.Color("#a5b8a0"), shade = new THREE.Color("#5d8177");
  const color = new THREE.Color();
  const sections = 15, sides = 7;
  for (let ring = 0; ring <= sections; ring++) {
    const progress = ring / sections;
    const theta = Math.PI * progress;
    const across = -span * Math.cos(theta) + .8 * Math.sin(theta * 3);
    const height = THREE.MathUtils.lerp(start, end, progress) + rise * Math.sin(theta);
    const tangent = new THREE.Vector3(
      span * Math.sin(theta) + 2.4 * Math.cos(theta * 3),
      rise * Math.cos(theta) + (end - start) / Math.PI,
      0,
    ).normalize();
    const thickness = 1.66 + .79 * Math.abs(Math.cos(theta)) + .36 * Math.sin(theta * 5);
    for (let side = 0; side < sides; side++) {
      const phase = side / sides * Math.PI * 2 + .18 * Math.sin(theta * 4);
      const radius = thickness * (1 + .15 * Math.sin(ring * 2.1 + side * 3.4));
      const offset = Math.cos(phase) * radius;
      const along = across + tangent.y * offset;
      const depth = Math.sin(phase) * radius * 1.09;
      positions.push(
        x + direction.x * along + depthAxis.x * depth,
        height - tangent.x * offset,
        z + direction.z * along + depthAxis.z * depth,
      );
      color.copy(shade).lerp(pale, .37 + .32 * Math.sin(theta) + .16 * Math.sin(ring * 2 + side));
      colors.push(color.r, color.g, color.b);
      if (ring < sections) {
        const a = ring * sides + side;
        const b = ring * sides + (side + 1) % sides;
        indices.push(a, a + sides, b, b, a + sides, b + sides);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function cascade(seed: number, cloudShadows: THREE.ShaderMaterial["uniforms"]) {
  const x = -46;
  const river = riverZ(x, seed);
  const geometry = new THREE.PlaneGeometry(1, 1, 4, 24);
  const positions = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < positions.count; i++) {
    const along = uv.getY(i);
    const across = uv.getX(i) - .5;
    const z = river + 9 + along * 16;
    const width = .8 + 2.2 * (1 - along) ** 3;
    const worldX = x + across * width + Math.sin(along * 5) * .65;
    positions.setXYZ(i, worldX, surfaceHeight(worldX, z, seed) + .23, z);
  }
  const material = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      haze: { value: new THREE.Color("#dff5f0") },
      valleyFog: { value: new THREE.Color("#d9f3f2") },
      sunTint: { value: new THREE.Color("#fff3cc") },
      ...cloudShadows,
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        vUv = uv;
        vWorld = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
      }`,
    fragmentShader: `${landscapeLight} ${cloudShadowGLSL}
      varying vec2 vUv;
      varying vec3 vWorld;
      uniform float time;
      void main() {
        float edges = 1. - smoothstep(.2, .47, abs(vUv.x - .5));
        float ends = smoothstep(0., .25, vUv.y) * (1. - smoothstep(.74, 1., vUv.y));
        float flow = sin(vUv.y * 65. + time * 9. + sin(vUv.x * 11.) * 2.);
        vec3 water = mix(vec3(.25, .65, .66), vec3(.73, .93, .85), .75 + .25 * flow);
        gl_FragColor = vec4(aerialPerspective(water * cloudLightAt(vWorld), vWorld), edges * ends * .88);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  return new THREE.Mesh(geometry, material);
}

function archShadows(arches: readonly (readonly [number, number, number, number, number])[], seed: number) {
  const patches = arches.flatMap(([x, z, span, , angle]) => [-1, 1].map((side) => {
    const geometry = new THREE.PlaneGeometry(1, 1, 6, 6);
    const positions = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    const footX = x + Math.cos(angle) * span * side;
    const footZ = z + Math.sin(angle) * span * side;
    for (let i = 0; i < positions.count; i++) {
      const worldX = footX + 1.1 + (uv.getX(i) - .5) * 10;
      const worldZ = footZ + .6 - (uv.getY(i) - .5) * 8;
      positions.setXYZ(i, worldX, surfaceHeight(worldX, worldZ, seed) + .10, worldZ);
    }
    return geometry;
  }));
  const geometry = mergeGeometries(patches);
  patches.forEach((patch) => patch.dispose());
  const material = new THREE.ShaderMaterial({
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        vUv = uv;
        vWorld = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
      }`,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        float edge = 1. - smoothstep(.06, .48, length(vUv - .5));
        float distanceFade = 1. - smoothstep(82., 170., distance(cameraPosition, vWorld));
        gl_FragColor = vec4(.028, .092, .061, edge * distanceFade * .32);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
  });
  return new THREE.Mesh(geometry, material);
}

export type TerrainLandmarkKind = "house" | "rock" | "flower" | "wetland" | "marker";

export interface TerrainLandmarkInstance {
  id: string;
  kind: TerrainLandmarkKind;
  x: number;
  y: number;
  z: number;
  rotation: number;
  scale: number;
  phase: number;
}

/** Deterministic, world-coordinate keyed scenic layout shared by streaming chunks. */
export function placeTerrainLandmarks(cellX: number, cellZ: number, seed: number, density = 1) {
  const random = new Random(seed ^ Math.imul(cellX, 374761393) ^ Math.imul(cellZ, 668265263));
  const items: TerrainLandmarkInstance[] = [];
  const candidates = Math.max(4, Math.round(22 * density));
  for (let index = 0; index < candidates; index++) {
    const x = cellX * TERRAIN.chunk + random.range(-34, 34);
    const z = cellZ * TERRAIN.chunk + random.range(-34, 34);
    const sample = sampleTerrain(x, z, seed);
    const slope = Math.hypot(sample.slopeX, sample.slopeZ);
    if (sample.surface === "water" || sample.roadMask > .35 || slope > .62) continue;
    let kind: TerrainLandmarkKind;
    if (sample.rockWeight > .44) kind = "rock";
    else if (sample.wetlandWeight > .2) kind = "wetland";
    else if (sample.flowerWeight > .28) kind = "flower";
    else if (sample.hillWeight > .2 && random.next() > .42) kind = "house";
    else kind = "marker";
    const worldKey = `${Math.round(x * 16)}:${Math.round(z * 16)}`;
    items.push({
      id: `terrain-${kind}-${seed}-${worldKey}`,
      kind,
      x,
      y: sample.height,
      z,
      rotation: random.range(0, Math.PI * 2),
      scale: kind === "house" ? random.range(.82, 1.18) : random.range(.62, 1.24),
      phase: random.range(0, Math.PI * 2),
    });
  }
  return items;
}

export class TerrainLandmarks {
  private readonly rocks: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  private readonly water;
  private readonly shadows;
  private readonly houses: THREE.InstancedMesh;
  private readonly scenicRocks: THREE.InstancedMesh;
  private readonly flowers: THREE.InstancedMesh;
  private readonly wetland: THREE.InstancedMesh;
  private readonly scenicChunks = new Map<string, TerrainLandmarkInstance[]>();
  private readonly transform = new THREE.Object3D();
  private readonly seed: number;
  private readonly scenicLeases: Array<{ release: () => void }> = [];

  constructor(
    private readonly scene: THREE.Scene,
    seed: number,
    cloudShadows: THREE.ShaderMaterial["uniforms"],
    private readonly catalog = new ContentCatalog(),
  ) {
    this.seed = seed;
    const locations = [[-17, 43, 7, 10, -.26], [-44, 112, 9, 12, .51]] as const;
    const arches = locations.map(([x, z, span, rise, angle]) => stoneArch(x, z, span, rise, angle, seed));
    const geometry = mergeGeometries(arches);
    arches.forEach((arch) => arch.dispose());
    this.rocks = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      side: THREE.DoubleSide,
    }));
    this.water = cascade(seed, cloudShadows);
    this.shadows = archShadows(locations, seed);
    const houseGeometry = this.catalog.geometry("terrain.house.v1.geometry", () => new THREE.BoxGeometry(1.8, 1.2, 1.5));
    const houseMaterial = this.catalog.material("terrain.house.v1.material", () => new THREE.MeshStandardMaterial({ color: "#e9c995", roughness: 1, flatShading: true }));
    const rockGeometry = this.catalog.geometry("terrain.rock.v1.geometry", () => new THREE.DodecahedronGeometry(.75, 0));
    const rockMaterial = this.catalog.material("terrain.rock.v1.material", () => new THREE.MeshStandardMaterial({ color: "#91a39d", roughness: 1, flatShading: true }));
    const flowerGeometry = this.catalog.geometry("terrain.flower.v1.geometry", () => new THREE.ConeGeometry(.12, .5, 5).translate(0, .25, 0));
    const flowerMaterial = this.catalog.material("terrain.flower.v1.material", () => new THREE.MeshStandardMaterial({ color: "#e6b6cf", roughness: 1, flatShading: true }));
    const wetlandGeometry = this.catalog.geometry("terrain.wetland.v1.geometry", () => new THREE.ConeGeometry(.08, .9, 4).translate(0, .45, 0));
    const wetlandMaterial = this.catalog.material("terrain.wetland.v1.material", () => new THREE.MeshStandardMaterial({ color: "#7bb78d", roughness: 1, flatShading: true }));
    this.scenicLeases.push(houseGeometry, houseMaterial, rockGeometry, rockMaterial, flowerGeometry, flowerMaterial, wetlandGeometry, wetlandMaterial);
    this.houses = new THREE.InstancedMesh(houseGeometry.value, houseMaterial.value, 160);
    this.scenicRocks = new THREE.InstancedMesh(rockGeometry.value, rockMaterial.value, 220);
    this.flowers = new THREE.InstancedMesh(flowerGeometry.value, flowerMaterial.value, 220);
    this.wetland = new THREE.InstancedMesh(wetlandGeometry.value, wetlandMaterial.value, 220);
    for (const mesh of [this.houses, this.scenicRocks, this.flowers, this.wetland]) mesh.count = 0;
    scene.add(this.rocks, this.water, this.shadows, this.houses, this.scenicRocks, this.flowers, this.wetland);
  }

  update(x: number, z: number, density = 1) {
    const centerX = Math.round(x / TERRAIN.chunk);
    const centerZ = Math.round(z / TERRAIN.chunk);
    const live = new Set<string>();
    const all: TerrainLandmarkInstance[] = [];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const cellX = centerX + dx, cellZ = centerZ + dz;
      const key = `${cellX}:${cellZ}`;
      live.add(key);
      const distance = Math.hypot(dx, dz);
      const localDensity = density * (distance <= 1 ? 1 : distance <= 2 ? .72 : .45);
      let entries = this.scenicChunks.get(key);
      if (!entries || entries.length > Math.round(22 * localDensity) + 4) {
        entries = placeTerrainLandmarks(cellX, cellZ, this.seed, localDensity);
        this.scenicChunks.set(key, entries);
      }
      all.push(...entries);
    }
    for (const key of this.scenicChunks.keys()) if (!live.has(key)) this.scenicChunks.delete(key);
    const buckets = new Map<TerrainLandmarkKind, TerrainLandmarkInstance[]>([
      ["house", []], ["rock", []], ["flower", []], ["wetland", []], ["marker", []],
    ]);
    for (const item of all) buckets.get(item.kind)!.push(item);
    const write = (mesh: THREE.InstancedMesh, items: TerrainLandmarkInstance[], yOffset: number) => {
      mesh.count = Math.min(mesh.instanceMatrix.count, items.length);
      items.slice(0, mesh.count).forEach((item, index) => {
        this.transform.position.set(item.x, item.y + yOffset, item.z);
        this.transform.rotation.set(0, item.rotation, 0);
        this.transform.scale.setScalar(item.scale);
        this.transform.updateMatrix();
        mesh.setMatrixAt(index, this.transform.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    };
    write(this.houses, buckets.get("house")!, .6);
    write(this.scenicRocks, buckets.get("rock")!, .28);
    write(this.flowers, buckets.get("flower")!, 0);
    write(this.wetland, buckets.get("wetland")!, 0);
  }

  updateTime(time: number) {
    this.water.material.uniforms.time.value = time;
  }

  setHaze(color: string, valleyFog = color, sunTint = "#fff3cc") {
    this.water.material.uniforms.haze.value.set(color);
    this.water.material.uniforms.valleyFog.value.set(valleyFog);
    this.water.material.uniforms.sunTint.value.set(sunTint);
  }

  setShadows(visible: boolean) {
    this.shadows.visible = visible;
  }

  setVisible(visible: boolean) {
    this.rocks.visible = visible;
    this.water.visible = visible;
    this.shadows.visible = visible;
    for (const mesh of [this.houses, this.scenicRocks, this.flowers, this.wetland]) mesh.visible = visible;
  }

  dispose() {
    for (const mesh of [this.rocks, this.water, this.shadows]) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
      else material.dispose();
    }
    for (const mesh of [this.houses, this.scenicRocks, this.flowers, this.wetland]) this.scene.remove(mesh);
    for (const lease of this.scenicLeases) lease.release();
    this.scenicChunks.clear();
  }

  get diagnostics() {
    return {
      houseInstances: this.houses.count,
      scenicInstances: this.scenicRocks.count + this.flowers.count + this.wetland.count,
    };
  }
}
