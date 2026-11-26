import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { riverZ, surfaceHeight } from "../simulation/Terrain";
import { cloudShadowGLSL } from "./CloudShadowShader";
import { landscapeLight } from "./ShaderMaterials";

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

export class TerrainLandmarks {
  private readonly rocks: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  private readonly water;
  private readonly shadows;

  constructor(private readonly scene: THREE.Scene, seed: number, cloudShadows: THREE.ShaderMaterial["uniforms"]) {
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
    scene.add(this.rocks, this.water, this.shadows);
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
  }

  dispose() {
    for (const mesh of [this.rocks, this.water, this.shadows]) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
  }
}
