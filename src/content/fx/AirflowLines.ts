import {
  BufferAttribute, BufferGeometry, Color, DoubleSide, DynamicDrawUsage, LineSegments, Mesh, ShaderMaterial, Vector3, type Scene,
} from "three";
import type { AircraftEffectSite } from "../3d/aircraftEffectSites";
import type { WindSampler } from "./EffectBatch";

const samples = 24;

class Strand {
  readonly halfSpan = new Vector3();
  readonly spans: Vector3[];
  constructor(wide: boolean) {
    this.spans = wide ? Array.from({length: samples}, () => new Vector3()) : [];
  }
  readonly points = Array.from({length: samples}, () => new Vector3());
  readonly times = new Float64Array(samples);
  readonly root = new Vector3();
  readonly lead = new Vector3();
  readonly velocities = Array.from({length: samples}, () => new Vector3());
  count = 0;
  newest = 0;
  seen = false;
  hasLead = false;
  life = 0;
  opacity = 0;
}

/** Samples are ordered from the moving root back along its world-space path.
 * Each pair of consecutive segments shares the exact same endpoint and opacity. */
export class AirflowLines {
  readonly visibleStrands: Partial<Record<AircraftEffectSite["kind"], number>> = {};
  readonly mesh: LineSegments<BufferGeometry, ShaderMaterial> | Mesh<BufferGeometry, ShaderMaterial>;
  private readonly positions: BufferAttribute;
  private readonly alphas: BufferAttribute;
  private readonly strands = new Map<AircraftEffectSite, Strand>();
  private readonly free: Strand[] = [];
  private time = 0;
  private vertices = 0;

  constructor(scene: Scene, private readonly capacity: number, private readonly wide = false) {
    const segments = capacity * (samples + 1);
    const vertices = segments * (wide ? 4 : 2);
    this.positions = new BufferAttribute(new Float32Array(vertices * 3), 3).setUsage(DynamicDrawUsage);
    this.alphas = new BufferAttribute(new Float32Array(vertices), 1).setUsage(DynamicDrawUsage);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", this.positions);
    geometry.setAttribute("alpha", this.alphas);
    if (wide) {
      const indices = new Uint16Array(segments * 6);
      const side = new Float32Array(vertices);
      for (let i = 0; i < segments; i++) {
        const base = i * 4;
        indices.set([base,base+1,base+2,base+2,base+1,base+3],i*6);
        side.set([-1,1,-1,1],base);
      }
      geometry.setIndex(new BufferAttribute(indices,1));
      geometry.setAttribute("across",new BufferAttribute(side,1));
    }
    geometry.setDrawRange(0, 0);
    const material = new ShaderMaterial({
      transparent: true, depthWrite: false, side: DoubleSide, forceSinglePass: true,
      defines: wide ? {WING_BAND:1} : {},
      uniforms: { tint: { value: new Color("#e2f2ef") } },
      vertexShader: `attribute float alpha; varying float opacity;
        #ifdef WING_BAND
        attribute float across; varying float edge;
        #endif
        void main(){
          #ifdef WING_BAND
          edge=across;
          #endif
          opacity=alpha; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `uniform vec3 tint; varying float opacity;
        #ifdef WING_BAND
        varying float edge;
        #endif
        void main(){
          float a=opacity;
          #ifdef WING_BAND
          a*=1.-smoothstep(.50,1.,abs(edge));
          #endif
          gl_FragColor=vec4(tint,a);
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = wide ? new Mesh(geometry, material) : new LineSegments(geometry, material);
    this.mesh.name = wide ? "wing-surface-bands" : "aircraft-airflow-lines";
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  advance(dt: number, wind?: WindSampler) {
    this.time += dt;
    for (const [site, strand] of this.strands) {
      strand.seen = false;
      const flow = dt > 0 ? wind?.sample(strand.root.x, strand.root.z) : undefined;
      for (let i = 0; i < strand.count; i++) {
        const index = (strand.newest - i + samples) % samples;
        if (this.time - strand.times[index] > strand.life) {
          strand.count = i;
          break;
        }
        const point = strand.points[index];
        point.addScaledVector(strand.velocities[index], dt);
        point.x += (flow?.x ?? 0) * dt * .4;
        point.z += (flow?.z ?? 0) * dt * .4;
      }
      if (!strand.count) {
        this.strands.delete(site);
        this.free.push(strand);
      }
    }
  }

  follow(site: AircraftEffectSite, root: Vector3, aft: Vector3, life: number, opacity: number,
    interval: number, lead?: Vector3, halfSpan?: Vector3) {
    let strand = this.strands.get(site);
    if (!strand) {
      if (this.strands.size >= this.capacity) return;
      strand = this.free.pop() ?? new Strand(this.wide);
      strand.count = 0;
      this.strands.set(site, strand);
    }
    if (strand.root.distanceToSquared(root) > 36) strand.count = 0;
    strand.seen = true;
    strand.root.copy(root);
    strand.hasLead = !!lead;
    if (lead) strand.lead.copy(lead);
    if (halfSpan) strand.halfSpan.copy(halfSpan);
    strand.life = life;
    strand.opacity = opacity;
    if (!strand.count || this.time - strand.times[strand.newest] >= interval - 1e-8) {
      strand.newest = (strand.newest + 1) % samples;
      strand.points[strand.newest].copy(root);
      if (halfSpan) strand.spans[strand.newest].copy(halfSpan);
      // Retain the outflow direction at release, including in a stationary preview.
      strand.velocities[strand.newest].copy(aft).multiplyScalar(site.kind === "propeller" ? 6 : 2.8);
      strand.times[strand.newest] = this.time;
      strand.count = Math.min(samples, strand.count + 1);
    }
  }

  private vertex(point: Vector3, alpha: number) {
    this.positions.setXYZ(this.vertices, point.x, point.y, point.z);
    this.alphas.setX(this.vertices++, alpha);
  }

  private section(point: Vector3, span: Vector3, alpha: number, scale: number) {
    for (const sign of [-scale,scale]) {
      this.positions.setXYZ(this.vertices,point.x+span.x*sign,point.y+span.y*sign,point.z+span.z*sign);
      this.alphas.setX(this.vertices++,alpha);
    }
  }

  write(visible: (site: AircraftEffectSite) => boolean = () => true) {
    this.vertices = 0;
    for (const kind of Object.keys(this.visibleStrands) as AircraftEffectSite["kind"][]) this.visibleStrands[kind] = 0;
    for (const [site, strand] of this.strands) {
      if (!visible(site)) continue;
      const start = this.vertices;
      let last = strand.seen ? strand.root : undefined;
      let alpha = strand.opacity;
      let span = strand.halfSpan, scale = 1;
      if (strand.seen && strand.hasLead) {
        if (this.wide) {
          this.section(strand.lead,span,0,.85);
          this.section(strand.root,span,alpha,1);
        } else {
          this.vertex(strand.lead, alpha * .12);
          this.vertex(strand.root, alpha);
        }
      }
      for (let i = 0; i < strand.count; i++) {
        const index = (strand.newest - i + samples) % samples;
        const point = strand.points[index];
        const fade = Math.max(0, 1 - (this.time - strand.times[index]) / strand.life);
        const nextAlpha = strand.opacity * fade * fade;
        if (last && point.distanceToSquared(last) > 1e-10) {
          if (this.wide) {
            this.section(last,span,alpha,scale);
            this.section(point,strand.spans[index],nextAlpha,.6+.4*fade);
          } else {
            this.vertex(last,alpha);
            this.vertex(point,nextAlpha);
          }
        }
        last = point;
        alpha = nextAlpha;
        if (this.wide) span = strand.spans[index];
        scale = .6+.4*fade;
      }
      if (this.vertices > start) this.visibleStrands[site.kind] = (this.visibleStrands[site.kind] ?? 0) + 1;
    }
    for (const buffer of [this.positions, this.alphas]) {
      buffer.clearUpdateRanges();
      buffer.addUpdateRange(0, this.vertices * buffer.itemSize);
      buffer.needsUpdate = this.vertices > 0;
    }
    this.mesh.geometry.setDrawRange(0, this.wide ? this.vertices / 4 * 6 : this.vertices);
    this.mesh.visible = this.vertices > 0;
  }

  get active() { return this.mesh.geometry.drawRange.count / (this.wide ? 6 : 2); }
  reset() {
    for (const kind of Object.keys(this.visibleStrands) as AircraftEffectSite["kind"][]) this.visibleStrands[kind] = 0;
    this.free.push(...this.strands.values());
    this.strands.clear();
    this.time = 0;
    this.write();
  }
  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.strands.clear();
    this.free.length = 0;
  }
}
