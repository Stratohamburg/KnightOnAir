import { Box3, MathUtils, Vector2, Vector3, Vector4 } from "three";
import { ProceduralAircraft } from "../content/3d/AircraftFactory";
import type { AircraftEffectSite } from "../content/3d/aircraftEffectSites";

import type { SceneActor } from "../content/3d/SceneObjects";
import { RULES } from "../data/config";

type DensityAt = (x: number, y: number, z: number) => number;
const segmentsPerTrack = 16;
const spacing = 2.5;
export const wakeLifetime = 2.4;
export const wakeRadius = 8;
export const cloudWakeCapacity = segmentsPerTrack * 3;

export const cloudWakeGLSL = `
  uniform vec3 wakeMin, wakeMax;
  uniform int wakeCount;
  uniform vec4 wakeStart[${cloudWakeCapacity}], wakeEnd[${cloudWakeCapacity}];

  float wakeOffset(vec3 p, out float strengthAtPoint, out vec3 gradient) {
    strengthAtPoint = 0.;
    gradient = vec3(0.);
    float offset = 0.;
    if (wakeCount > 0 && all(greaterThanEqual(p, wakeMin)) && all(lessThanEqual(p, wakeMax))) {
      const float radius2 = ${(wakeRadius * wakeRadius).toFixed(1)};
      for (int i = 0; i < ${cloudWakeCapacity}; i++) {
        if (i >= wakeCount) break;
        vec4 a = wakeStart[i], b = wakeEnd[i];
        vec3 edge = b.xyz - a.xyz;
        float edge2 = dot(edge, edge);
        float t = edge2 > .0001 ? clamp(dot(p - a.xyz, edge) / edge2, 0., 1.) : 1.;
        vec3 radial = p - mix(a.xyz, b.xyz, t);
        float q = dot(radial, radial) / radius2;
        if (q >= 1.) continue;
        float strength = mix(a.w, b.w, t);
        float weight = strength * (1. - q) * (1. - q);
        if (weight <= strengthAtPoint) continue;
        strengthAtPoint = weight;
        // Negative at the center, positive at the shoulder, flat at the outer edge.
        offset = weight * (18. * q - 5.8);
        gradient = strength * (1. - q) * (29.6 - 54. * q) * (2. / radius2) * radial;
      }
    }
    return offset;
  }
`;

class ContactTrack {
  readonly segments = Array.from({ length: segmentsPerTrack }, () => ({
    start: new Vector4(), end: new Vector4(), startTime: -Infinity, endTime: -Infinity,
  }));
  private readonly previous = new Vector4();
  private index = -1;
  private connected = false;
  private length = 0;

  sample(x: number, y: number, z: number, strength: number, now: number) {
    if (strength <= .015) {
      this.connected = false;
      return;
    }
    const p = this.previous;
    const distance = Math.hypot(x - p.x, y - p.y, z - p.z);
    const last = this.segments[this.index];
    if (!this.connected || distance > 18 || now - last.endTime > wakeLifetime) {
      this.index = (this.index + 1) % segmentsPerTrack;
      const segment = this.segments[this.index];
      segment.start.set(x, y, z, strength);
      segment.end.copy(segment.start);
      segment.startTime = segment.endTime = now;
      this.length = 0;
    } else {
      let traveled = 0;
      const lastTime = last.endTime;
      while (traveled < distance) {
        if (this.length >= spacing - .0001) {
          const tail = this.segments[this.index];
          this.index = (this.index + 1) % segmentsPerTrack;
          const next = this.segments[this.index];
          next.start.copy(tail.end);
          next.startTime = tail.endTime;
          this.length = 0;
        }
        const advance = Math.min(distance - traveled, spacing - this.length);
        traveled += advance;
        this.length += advance;
        const t = traveled / distance;
        const segment = this.segments[this.index];
        segment.end.set(MathUtils.lerp(p.x, x, t), MathUtils.lerp(p.y, y, t),
          MathUtils.lerp(p.z, z, t), MathUtils.lerp(p.w, strength, t));
        segment.endTime = MathUtils.lerp(lastTime, now, t);
      }
      const current = this.segments[this.index];
      current.end.w = strength;
      current.endTime = now;
      if (this.length < .0001) current.startTime = now;
    }
    this.connected = true;
    p.set(x, y, z, strength);
  }

  reset() {
    this.connected = false;
    for (const segment of this.segments) segment.endTime = -Infinity;
  }
}

export class CloudWake {
  readonly starts = Array.from({ length: cloudWakeCapacity }, () => new Vector4());
  readonly ends = Array.from({ length: cloudWakeCapacity }, () => new Vector4());
  readonly bounds = new Box3();
  readonly contacts = Array.from({ length: 3 }, () => new Vector4(0, 0, 0, 0));
  private readonly tracks = [new ContactTrack(), new ContactTrack(), new ContactTrack()];
  private readonly point = new Vector3();
  private readonly modelPoint = new Vector3();
  private readonly wings: (AircraftEffectSite | undefined)[] = [undefined, undefined];
  private readonly wingExtent = [0, 0];
  private time = 0;
  count = 0;

  update(delta: number, drift: Vector2, aircraft: SceneActor | undefined, densityAt: DensityAt) {
    if (delta <= 0) return;
    this.time += delta;
    this.updateContacts(aircraft, densityAt);
    this.count = 0;
    this.bounds.makeEmpty();
    for (const [i, track] of this.tracks.entries()) {
      const p = this.contacts[i];
      track.sample(p.x - drift.x, p.y, p.z - drift.y, Math.sqrt(p.w), this.time);
      for (const seg of track.segments) {
        if (this.time - seg.endTime >= wakeLifetime) continue;
        const a = this.starts[this.count].copy(seg.start);
        const b = this.ends[this.count++].copy(seg.end);
        a.w *= 1 - MathUtils.smoothstep(this.time - seg.startTime, .18, wakeLifetime);
        b.w *= 1 - MathUtils.smoothstep(this.time - seg.endTime, .18, wakeLifetime);
        this.bounds.expandByPoint(this.point.set(a.x, a.y, a.z));
        this.bounds.expandByPoint(this.point.set(b.x, b.y, b.z));
      }
    }
    if (this.count) this.bounds.expandByScalar(wakeRadius);
    else {
      this.bounds.min.setScalar(0);
      this.bounds.max.setScalar(0);
    }
  }

  reset() {
    this.time = this.count = 0;
    for (const track of this.tracks) track.reset();
    for (const contact of this.contacts) contact.w = 0;
  }

  private updateContacts(aircraft: SceneActor | undefined, densityAt: DensityAt) {
    for (const contact of this.contacts) contact.w = 0;
    if (!aircraft) return;
    if (!(aircraft instanceof ProceduralAircraft)) {
      aircraft.group.updateWorldMatrix(true, false);
      for (const [i, site] of (aircraft.cloudContactSites ?? []).entries()) {
        const p = this.point.copy(site).applyMatrix4(aircraft.group.matrixWorld);
        this.contacts[i].set(p.x, p.y, p.z, densityAt(p.x, p.y, p.z));
      }
      return;
    }
    const center = aircraft.group.position;
    this.contacts[2].set(center.x, center.y, center.z, densityAt(center.x, center.y, center.z));
    const { heading, parts } = aircraft.actor;
    aircraft.group.updateWorldMatrix(true, true);
    const rightX = Math.cos(heading), rightZ = -Math.sin(heading);
    this.wings.fill(undefined);
    this.wingExtent.fill(0);
    for (const site of aircraft.effectSites.sources) {
      if (site.kind !== "wingTip" || !parts.some(part => part.id === site.partId && !part.destroyed)) continue;
      this.point.fromArray(site.position).applyMatrix4(site.node.matrixWorld);
      const lateral = (this.point.x - center.x) * rightX + (this.point.z - center.z) * rightZ;
      const side = Number(lateral > 0);
      if (Math.abs(lateral) > this.wingExtent[side]) {
        this.wings[side] = site;
        this.wingExtent[side] = Math.abs(lateral);
      }
    }

    for (let i = 0; i < 2; i++) {
      const sign = i === 0 ? -1 : 1;
      const site = this.wings[i];
      if (site) {
        this.modelPoint.fromArray(site.position).applyMatrix4(site.node.matrixWorld);
      } else {
        // Hulls without a generated tip still use a configured wing part.
        const wing = parts.find(part => part.role === "wing" && part.x * sign > 0 && !part.destroyed);
        if (!wing) continue;
        this.modelPoint.set(wing.x, wing.y ?? 0, wing.z).applyMatrix4(aircraft.group.matrixWorld);
      }
      const density = densityAt(this.modelPoint.x, this.modelPoint.y, this.modelPoint.z);
      this.contacts[i].set(this.modelPoint.x, this.modelPoint.y, this.modelPoint.z, density);
    }
  }

}

export const maxCloudCuts = (RULES.maxTotal + 1) * 3;
const cutBlendWidth = .18;

export const cloudCutGLSL = `
  uniform int cutCount;
  uniform vec3 cutMin, cutMax;
  uniform vec4 cutters[${maxCloudCuts}];
  const float cutBlend = ${cutBlendWidth.toFixed(2)};

  float nearestCloudCutter(vec3 p, out vec4 sphere) {
    float d = 1e4;
    sphere = vec4(0.);
    for (int i = 0; i < ${maxCloudCuts}; ++i) {
      if (i >= cutCount) break;
      float sd = length(p - cutters[i].xyz) - cutters[i].w;
      if (sd < d) {
        d = sd;
        sphere = cutters[i];
      }
    }
    return d;
  }

  // Polynomial smooth maximum of the bank distance and negated cutter distance.
  // The derivative with respect to the negated cutter is its normal weight.
  float subtractCloudCut(float bank, float cutter, out float normalWeight) {
    normalWeight = clamp(.5 - .5 * (cutter + bank) / cutBlend, 0., 1.);
    return mix(bank, -cutter, normalWeight) + cutBlend * normalWeight * (1. - normalWeight);
  }
`;
const bodyCutRadius = 2.1;
const outerCutRadius = 1.4;

// Keep CPU history per vehicle. Share the bounded GPU history across active
// owners, from the strongest remaining segments of each owner's trail.
export class VehicleCloudWakes {
  readonly starts = Array.from({ length: cloudWakeCapacity }, () => new Vector4());
  readonly ends = Array.from({ length: cloudWakeCapacity }, () => new Vector4());
  readonly cuts = Array.from({ length: maxCloudCuts }, () => new Vector4());
  readonly bounds = new Box3();
  readonly cutBounds = new Box3();
  private readonly owners = new Map<SceneActor, CloudWake>();
  private readonly living = new Set<SceneActor>();
  private readonly point = new Vector3();
  count = 0;
  cutCount = 0;

  update(delta: number, drift: Vector2, player: SceneActor | undefined, others: Iterable<SceneActor>,
    densityAt: DensityAt) {
    if (delta <= 0) return;
    this.living.clear();
    if (player) this.living.add(player);
    for (const actor of others) this.living.add(actor);
    for (const actor of this.living) {
      if (!this.owners.has(actor)) this.owners.set(actor, new CloudWake());
    }
    this.cutCount = this.count = 0;
    this.bounds.makeEmpty();
    this.cutBounds.makeEmpty();
    const active: { wake: CloudWake; indices: number[] }[] = [];
    for (const [actor, wake] of this.owners) {
      const present = this.living.has(actor);
      wake.update(delta, drift, present ? actor : undefined, densityAt);
      if (!wake.count) {
        if (!present) this.owners.delete(actor);
        continue;
      }
      for (const [i, p] of wake.contacts.entries()) {
        if (p.w <= .015 || this.cutCount >= maxCloudCuts) continue;
        const radius = Math.sqrt(p.w) * (i === 2 ? bodyCutRadius : outerCutRadius);
        this.cuts[this.cutCount++].set(p.x, p.y, p.z, radius);
        this.cutBounds.expandByPoint(this.point.set(p.x, p.y, p.z));
      }
      this.bounds.union(wake.bounds);
      active.push({ wake, indices: Array.from({ length: wake.count }, (_, i) => i) });
    }
    if (active.reduce((n, entry) => n + entry.indices.length, 0) > cloudWakeCapacity) {
      for (const { wake, indices } of active) {
        indices.sort((a, b) => Math.max(wake.starts[b].w, wake.ends[b].w) - Math.max(wake.starts[a].w, wake.ends[a].w));
      }
    }
    for (let i = 0; i < cloudWakeCapacity && this.count < cloudWakeCapacity; i++) {
      let copied = false;
      for (const { wake, indices } of active) {
        if (i >= indices.length || this.count === cloudWakeCapacity) continue;
        this.starts[this.count].copy(wake.starts[indices[i]]);
        this.ends[this.count++].copy(wake.ends[indices[i]]);
        copied = true;
      }
      if (!copied) break;
    }
    if (this.cutCount) this.cutBounds.expandByScalar(bodyCutRadius + cutBlendWidth);
    else {
      this.cutBounds.min.setScalar(0);
      this.cutBounds.max.setScalar(0);
    }
  }

  reset() {
    this.owners.clear();
    this.living.clear();
    this.count = this.cutCount = 0;
  }
}
