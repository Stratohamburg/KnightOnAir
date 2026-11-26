import * as THREE from "three";
import type { Point3 } from "../3d/anchors";

export interface Particle {
  generation?: number;
  orientation?: THREE.Quaternion;
  opacity?: number;
  drag?: number;
  width?: number;
  thickness?: number;
  position: Point3;
  velocity: Point3;
  color: string;
  size: number;
  length: number;
  life: number;
  age: number;
  priority: number;
  hold: number;
  heading: number;
  bank: number;
}

export type WindSampler = { sample(x: number, z: number): { x: number; z: number } };
type Style = "glow" | "smoke" | "ring" | "debris" | "wing" | "facet" | "arc" | "cone" | "casing" | "mark";

export class EffectBatch {
  readonly mesh: THREE.InstancedMesh;
  private readonly fullGeometry: THREE.BufferGeometry;
  private readonly lowGeometry?: THREE.BufferGeometry;
  private readonly slots: Particle[];
  private readonly alpha: THREE.InstancedBufferAttribute;
  private readonly transform = new THREE.Object3D();
  private readonly tint = new THREE.Color();
  private readonly direction = new THREE.Vector3();
  private readonly inverseCamera = new THREE.Quaternion();
  private readonly roll = new THREE.Quaternion();
  private readonly normal = new THREE.Vector3(0, 0, 1);
  private readonly opacity: { value: number };
  dropped = 0;
  recycled = 0;
  get stats() {
    return { capacity: this.capacity, active: this.mesh.count, dropped: this.dropped, recycled: this.recycled };
  }

  constructor(scene: THREE.Scene, readonly capacity: number, private readonly style: Style) {
    this.slots = Array.from({ length: capacity }, () => ({
      position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 },
      color: "#fff", size: 0, length: 0, life: 0, age: 0, priority: 0, hold: 0, heading: 0, bank: 0,
    }));
    const geometry = style === "wing" ? new THREE.BoxGeometry(.85, .13, .48).rotateY(.3) :
      style === "arc" ? new THREE.RingGeometry(.43, .5, 9, 1, Math.PI * .12, Math.PI * .76) :
      style === "cone" ? new THREE.ConeGeometry(.5, 1, 6).rotateX(Math.PI / 2) :
      style === "casing" ? new THREE.CylinderGeometry(.26, .3, 1, 5) :
      style === "mark" ? new THREE.CircleGeometry(.5, 7) :
      style === "smoke" || style === "facet" || style === "debris" ? new THREE.IcosahedronGeometry(.5, 0) :
      new THREE.PlaneGeometry(1, 1);
    this.alpha = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    geometry.setAttribute("instanceOpacity", this.alpha);
    this.fullGeometry = geometry;
    if (style === "smoke" || style === "facet") {
      this.lowGeometry = new THREE.OctahedronGeometry(.5);
      this.lowGeometry.setAttribute("instanceOpacity", this.alpha);
    }
    this.opacity = { value: 1 };
    const fragment = style === "glow"
      ? "float opacity = (exp(-dot(p,p)*4.5)*.32 + exp(-dot(p,p)*76.)*.98);"
      : style === "ring"
        ? "float opacity = exp(-pow((length(p)-.66)*15.,2.));"
        : style === "smoke"
          ? "float opacity = .68;"
          : "float opacity = 1.;";
    const material = new THREE.ShaderMaterial({
      uniforms: { qualityOpacity: this.opacity },
      vertexShader: `
        attribute float instanceOpacity;
        varying float vLight;
        varying vec2 vUv;
        varying vec3 vColor;
        varying float vOpacity;
        void main() {
          vLight = .8 + .2 * dot(normalize(mat3(instanceMatrix) * normal), normalize(vec3(-.4,.8,.3)));
          vUv = uv;
          vColor = instanceColor;
          vOpacity = instanceOpacity;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.);
        }`,
      fragmentShader: `
        varying float vLight;
        varying vec2 vUv;
        varying vec3 vColor;
        varying float vOpacity;
        uniform float qualityOpacity;
        void main() {
          vec2 p = 2. * vUv - 1.;
          ${fragment}
          gl_FragColor = vec4(vColor * ${style === "smoke" || style === "facet" ? "vLight" : "1."}, vOpacity * opacity * qualityOpacity);
          #include <colorspace_fragment>
        }`,
      blending: style === "glow" || style === "ring" ? THREE.AdditiveBlending : THREE.NormalBlending,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      forceSinglePass: true,
    });
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.name = style;
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < capacity; i++) this.mesh.setColorAt(i, this.tint);
    this.mesh.instanceColor?.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.mesh);
  }

  spawn(particle: Omit<Particle, "age">) {
    let slot: Particle | undefined;
    for (const candidate of this.slots) {
      if (candidate.age >= candidate.life) {
        slot = candidate;
        break;
      }
      if (candidate.priority < particle.priority &&
          (!slot || candidate.priority < slot.priority ||
            (candidate.priority === slot.priority && candidate.age > slot.age))) slot = candidate;
    }
    if (!slot) {
      this.dropped++;
      return;
    }
    if (slot.life > 0) this.recycled++;
    const { position, velocity, orientation, ...style } = particle;
    slot.position.x = position.x;
    slot.position.y = position.y;
    slot.position.z = position.z;
    slot.velocity.x = velocity.x;
    slot.velocity.y = velocity.y;
    slot.velocity.z = velocity.z;
    slot.orientation = orientation ? (slot.orientation ?? new THREE.Quaternion()).copy(orientation) : undefined;
    Object.assign(slot, { width: undefined, thickness: undefined, opacity: undefined, drag: undefined }, style, { age: 0 });
    slot.generation = (slot.generation ?? 0) + 1;
    return slot;
  }

  tick(dt: number, wind?: WindSampler) {
    for (const slot of this.slots) {
      if (slot.age >= slot.life) continue;
      const previousAge = slot.age;
      slot.age += dt;
      const travel = Math.max(0, slot.age - Math.max(previousAge, slot.hold));
      if (!travel) continue;
      const drift = this.style === "smoke" ? wind?.sample(slot.position.x, slot.position.z) : undefined;
      if (this.style === "debris" || this.style === "wing" || this.style === "casing") slot.velocity.y -= 8.5 * travel;
      if (slot.drag) {
        const decay = Math.exp(-slot.drag * travel);
        slot.velocity.x *= decay; slot.velocity.z *= decay;
      }
      slot.position.x += (slot.velocity.x + (drift?.x ?? 0) * .7) * travel;
      slot.position.y += slot.velocity.y * travel;
      slot.position.z += (slot.velocity.z + (drift?.z ?? 0) * .7) * travel;
    }
  }

  write(camera: THREE.Camera, opacity = 1, low = false) {
    this.mesh.count = 0;
    this.mesh.geometry = low && this.lowGeometry ? this.lowGeometry : this.fullGeometry;
    this.opacity.value = opacity;
    this.inverseCamera.copy(camera.quaternion).invert();
    for (const slot of this.slots) {
      if (slot.age >= slot.life) continue;
      const t = slot.age / slot.life;
      const { x, y, z } = slot.position;
      this.transform.position.set(x, y, z);
      this.transform.quaternion.copy(camera.quaternion);
      if (this.style === "debris" || this.style === "wing" || this.style === "casing") {
        this.transform.rotation.set(slot.age * 2.1, slot.heading + slot.age * 2.7, slot.bank + slot.age * 3.4);
      } else if (slot.orientation) {
        this.transform.quaternion.copy(slot.orientation);
      } else if (slot.length > 1) {
        this.direction.set(slot.velocity.x, slot.velocity.y, slot.velocity.z).applyQuaternion(this.inverseCamera);
        this.roll.setFromAxisAngle(this.normal, Math.atan2(this.direction.y, this.direction.x));
        this.transform.quaternion.multiply(this.roll);
      }
      const expansion = this.style === "smoke" ? 1 + t * 1.5 : this.style === "ring" ? .4 + t * 1.6 : 1 + t * .27;
      const size = slot.size * expansion;
      this.transform.scale.set(size * slot.length, size * (slot.width ?? 1), size * (slot.thickness ?? (this.style === "facet" ? 1 : .6)));
      this.transform.updateMatrix();
      const index = this.mesh.count++;
      this.mesh.setMatrixAt(index, this.transform.matrix);
      this.mesh.setColorAt(index, this.tint.set(slot.color));
      this.alpha.setX(index, (slot.opacity ?? 1) * (this.style === "smoke" ? .75 * (1 - Math.max(0, (slot.age - slot.hold) / Math.max(.01, slot.life - slot.hold))) : (1 - t) ** .85));
    }
    this.mesh.visible = this.mesh.count > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor!.needsUpdate = true;
    this.alpha.needsUpdate = true;
  }

  reset() {
    for (const slot of this.slots) slot.life = slot.age = 0;
    this.mesh.visible = false;
    this.mesh.count = this.dropped = this.recycled = 0;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.fullGeometry.dispose();
    this.lowGeometry?.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.dispose();
  }
}
