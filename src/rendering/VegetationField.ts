import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { QUALITIES, type Quality } from "../data/config";
import { Random } from "../services/Random";
import { sampleTerrain, TERRAIN } from "../simulation/Terrain";
import { vegetationWindGLSL, type VegetationWindUniforms } from "./VegetationWind";

const candidatesPerChunk = 24;
const palette = ["#a7bd69", "#70a777", "#c2d579", "#85a56c"];
const chunkCapacity = 9 * candidatesPerChunk;

export interface VegetationPlant {
  x: number;
  y: number;
  z: number;
  rotation: number;
  phase: number;
  stiffness: number;
  scale: number;
  color: number;
}

export function placeVegetation(cellX: number, cellZ: number, seed: number, tree: boolean) {
  const random = new Random(seed ^ Math.imul(cellX, 374761393) ^ Math.imul(cellZ, 668265263) ^ Number(tree) * 801);
  const plants: VegetationPlant[] = [];
  const groupSize = tree ? 8 : 6;
  const groups = candidatesPerChunk / groupSize;
  let groveX = 0, groveZ = 0;
  for (let index = 0; index < candidatesPerChunk; index++) {
    if (index % groupSize === 0) {
      groveX = random.range(-29, 29);
      groveZ = -26 + 52 * (index / groupSize) / (groups - 1) + random.range(-3, 3);
    }
    const angle = random.range(0, Math.PI * 2);
    const radius = random.range(1, tree ? 10 : 11);
    const x = cellX * TERRAIN.chunk + groveX + Math.cos(angle) * radius;
    const z = cellZ * TERRAIN.chunk + groveZ + Math.sin(angle) * radius;
    const surface = sampleTerrain(x, z, seed);
    if (surface.surfaceMask !== 0 || surface.roadMask >= .3 || Math.hypot(surface.slopeX, surface.slopeZ) > (tree ? .48 : .4)) continue;
    const plant = new Random(seed ^ Math.imul(Math.round(x * 1024), 1274126177) ^ Math.imul(Math.round(z * 1024), 1597334677));
    plants.push({
      x, y: surface.height, z,
      rotation: plant.range(0, Math.PI * 2),
      phase: plant.range(0, Math.PI * 2),
      stiffness: plant.range(.55, 1),
      scale: plant.range(.68, 1.32),
      color: Math.floor(plant.next() * palette.length),
    });
  }
  return plants;
}

function treeGeometry() {
  const components = [
    new THREE.CylinderGeometry(.09, .14, 1.44, 5, 2).translate(0, .72, 0),
    new THREE.ConeGeometry(.68, 1.55, 6, 2).translate(0, 1.53, 0),
    new THREE.ConeGeometry(.48, 1.23, 6, 2).translate(0, 2.07, 0),
  ];
  const bark = new THREE.Color("#8c6543");
  const canopy = new THREE.Color("#b4da92");
  components.forEach((geometry, index) => {
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    for (let vertex = 0; vertex < colors.length; vertex += 3) {
      (index === 0 ? bark : canopy).toArray(colors, vertex);
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  });
  const geometry = mergeGeometries(components);
  components.forEach((component) => component.dispose());
  return geometry;
}

function tuftGeometry() {
  const vertices: number[] = [];
  const colors: number[] = [];
  const root = new THREE.Color("#83ac55");
  const tip = new THREE.Color("#dee6a2");
  const flower = new THREE.Color("#fff5c7");
  for (const angle of [0, Math.PI * .66, Math.PI * 1.33]) {
    const x = Math.cos(angle) * .25, z = Math.sin(angle) * .25;
    vertices.push(x, 0, z, -x, 0, -z, z * .7, .62, -x * .7);
    colors.push(...root.toArray(), ...root.toArray(), ...tip.toArray());
    vertices.push(z * .7 - x * .26, .53, -x * .7 - z * .26,
      z * .7 + x * .26, .54, -x * .7 + z * .26, z * .7, .62, -x * .7);
    colors.push(...flower.toArray(), ...flower.toArray(), ...flower.toArray());
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function vegetationBatch(tree: boolean, wind: VegetationWindUniforms, frequency: {value: number}, flutter: {value: number}) {
  const geometry = tree ? treeGeometry() : tuftGeometry();
  const positions = geometry.attributes.position;
  const weights = new Float32Array(positions.count);
  for (let i = 0; i < positions.count; i++) weights[i] = (Math.max(0, positions.getY(i)) / (tree ? 2.685 : .62)) ** 2;
  geometry.setAttribute("bendWeight", new THREE.BufferAttribute(weights, 1));
  const motion = new THREE.InstancedBufferAttribute(new Float32Array(chunkCapacity * 2), 2);
  motion.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("plantMotion", motion);
  const material = new THREE.MeshStandardMaterial({
    color: tree ? "#bbc5a5" : "#d1d5a8",
    flatShading: true,
    roughness: 1,
    vertexColors: true,
    side: tree ? THREE.FrontSide : THREE.DoubleSide,
  });
  material.customProgramCacheKey = () => tree ? "wind-tree" : "wind-tuft";
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, wind, { bendFrequency: frequency, crownFlutter: flutter });
    shader.vertexShader = `
      attribute float bendWeight;
      attribute vec2 plantMotion;
      uniform float bendFrequency, crownFlutter;
      ${vegetationWindGLSL}
    ` + shader.vertexShader.replace("#include <begin_vertex>", `
      #include <begin_vertex>
      vec2 root = (modelMatrix * instanceMatrix[3]).xz;
      vec2 flow = sampleWind(root);
      float phase = sceneTime * ${tree ? 'bendFrequency' : '1.7'} + plantMotion.x + dot(root, vec2(.049, .062));
      float sway;
      ${tree ? `if (bendFrequency < 1.) {
        float cycle = abs(fract(phase * .159155) * 2. - 1.);
        sway = 1. - 2. * cycle * cycle * (3. - 2. * cycle);
      } else` : ''}
      sway = sin(phase);
      float bend = (.62 + .38 * sway) * bendWeight / plantMotion.y;
      ${tree ? 'if (crownFlutter > 0.) bend += crownFlutter * bendWeight * bendWeight * sin(phase * 3.4);' : ''}
      vec2 shift = flow * bend * ${tree ? '1.15' : '.85'};
      vec3 axisX = instanceMatrix[0].xyz, axisZ = instanceMatrix[2].xyz;
      transformed.x += dot(axisX.xz, shift) / dot(axisX, axisX);
      transformed.z += dot(axisZ.xz, shift) / dot(axisZ, axisZ);
    `);
  };
  const mesh = new THREE.InstancedMesh(geometry, material, chunkCapacity);
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  return mesh;
}

export class VegetationField {
  private readonly trees;
  private readonly tufts;
  private readonly frequency = { value: 1 };
  private readonly flutter = { value: 0 };
  private readonly transform = new THREE.Object3D();
  private readonly color = new THREE.Color();
  private readonly chunks = new Map<string, { trees: VegetationPlant[]; tufts: VegetationPlant[] }>();
  private quality?: Quality;
  private x = NaN;
  private z = NaN;

  constructor(private readonly scene: THREE.Scene, wind: VegetationWindUniforms, private readonly seed: number) {
    this.trees = vegetationBatch(true, wind, this.frequency, this.flutter);
    this.tufts = vegetationBatch(false, wind, this.frequency, this.flutter);
    scene.add(this.trees, this.tufts);
  }

  get treeCount() { return this.trees.count; }
  get tuftCount() { return this.tufts.count; }

  update(x: number, z: number, quality: Quality) {
    const cellX = Math.round(x / TERRAIN.chunk), cellZ = Math.round(z / TERRAIN.chunk);
    if (cellX === this.x && cellZ === this.z && quality === this.quality) return;
    const { vegetation } = QUALITIES[quality];
    this.frequency.value = vegetation.bendFrequency;
    this.flutter.value = vegetation.flutter;
    this.x = cellX;
    this.z = cellZ;
    this.quality = quality;

    const live = new Set<string>();
    let treeCount = 0, tuftCount = 0;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cx = cellX + dx, cz = cellZ + dz;
        const key = `${cx}:${cz}`;
        live.add(key);
        let chunk = this.chunks.get(key);
        if (!chunk) {
          chunk = { trees: placeVegetation(cx, cz, this.seed, true), tufts: placeVegetation(cx, cz, this.seed, false) };
          this.chunks.set(key, chunk);
        }
        for (const tree of chunk.trees) this.write(this.trees, tree, treeCount++);
        for (const tuft of chunk.tufts.slice(0, vegetation.tufts)) this.write(this.tufts, tuft, tuftCount++);
      }
    }
    for (const key of this.chunks.keys()) if (!live.has(key)) this.chunks.delete(key);
    this.trees.count = treeCount;
    this.tufts.count = tuftCount;
    for (const mesh of [this.trees, this.tufts]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.geometry.attributes.plantMotion.needsUpdate = true;
    }
  }

  setVisible(visible: boolean) {
    this.trees.visible = visible;
    this.tufts.visible = visible;
  }

  private write(mesh: typeof this.trees, plant: VegetationPlant, index: number) {
    this.transform.position.set(plant.x, plant.y, plant.z);
    this.transform.rotation.y = plant.rotation;
    this.transform.scale.setScalar(plant.scale);
    this.transform.updateMatrix();
    mesh.setMatrixAt(index, this.transform.matrix);
    mesh.setColorAt(index, this.color.set(palette[plant.color]));
    mesh.geometry.attributes.plantMotion.setXY(index, plant.phase, plant.stiffness);
  }

  dispose() {
    for (const mesh of [this.trees, this.tufts]) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
      mesh.dispose();
    }
    this.chunks.clear();
  }
}
