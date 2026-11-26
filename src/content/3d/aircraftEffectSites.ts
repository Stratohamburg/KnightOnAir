import { Mesh, Object3D, Vector3 } from "three";

export type SiteKind = "wingTip" | "tailTip" | "wingFlow" | "protrusion" | "propeller" | "exhaust" | "jetOutlet" | "muzzle" | "casing" | "ordnanceRelease" | "noseWave" | "wake";
type XYZ = readonly [number, number, number];
export interface AircraftEffectSite {
  id: string;
  partId: string;
  kind: SiteKind;
  profileId?: string;
  /** Position and direction in the named node's coordinates, including articulated nodes. */
  node: Object3D;
  position: XYZ;
  direction: XYZ;
  end?: XYZ;
  /** Half of the emitting trailing edge, in node coordinates. */
  halfSpan?: XYZ;
  strength: number;
  radius?: number;
  rotationSign?: number;
  basis?: "configuredFallback";
}

/** Per assembly. Surface meshes provide the triangles and normals for contact and fallback sampling. */
export class AircraftEffectSites {
  readonly sources: AircraftEffectSite[] = [];
  readonly surfaces: { partId: string; mesh: Mesh }[] = [];

  add(partId: string, name: string, kind: SiteKind, node: Object3D, position: XYZ,
    options: Partial<Pick<AircraftEffectSite, "end" | "halfSpan" | "direction" | "strength" | "radius" | "rotationSign" | "basis">> = {}) {
    const site: AircraftEffectSite = { id: partId + "/" + name, partId, kind, node, position,
      strength: kind === "protrusion" ? .35 : kind === "tailTip" ? .6 : 1, direction: [0, 0, -1], ...options };
    this.sources.push(site);
    return site;
  }

  addWingFlow(partId: string, name: string, mesh: Mesh) {
    // Intersect the actual skin at two span stations. This also follows swept
    // trailing edges, where the aftmost vertex alone would place flow at the tip.
    const geometry = mesh.geometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const {min, max} = geometry.boundingBox!;
    const vertices = geometry.getAttribute("position");
    const index = geometry.index;
    const section = (fraction: number) => {
      const x = min.x + (max.x - min.x) * fraction;
      const front = new Vector3(x, 0, -Infinity), rear = new Vector3(x, 0, Infinity);
      for (let i = 0; i < (index?.count ?? vertices.count); i += 3) {
        for (let edge = 0; edge < 3; edge++) {
          const a = index?.getX(i + edge) ?? i + edge;
          const next = i + (edge + 1) % 3;
          const b = index?.getX(next) ?? next;
          const dx = vertices.getX(b) - vertices.getX(a);
          if (!dx) continue;
          const t = (x - vertices.getX(a)) / dx;
          if (t < 0 || t > 1) continue;
          const z = vertices.getZ(a) + t * (vertices.getZ(b) - vertices.getZ(a));
          const y = vertices.getY(a) + t * (vertices.getY(b) - vertices.getY(a));
          if (z > front.z) front.set(x,y,z);
          if (z < rear.z) rear.set(x,y,z);
        }
      }
      return {front,rear};
    };
    const left = section(.18), right = section(.82);
    if (!Number.isFinite(left.rear.z + right.rear.z)) return;
    const halfSpan = right.rear.clone().sub(left.rear).multiplyScalar(.5);
    return this.add(partId, name, "wingFlow", mesh, left.front.lerp(right.front,.5).toArray(), {
      end: left.rear.lerp(right.rear,.5).toArray(), halfSpan: halfSpan.toArray(),
    });
  }

  clear() {
    this.sources.length = 0;
    this.surfaces.length = 0;
  }
}

/** A real surface vertex at an extremum. Ties favor the trailing edge for tip vortices. */
export function outlineVertex(mesh: Mesh, axis: "x" | "y" | "z", sign: number): [number, number, number] {
  const positions = mesh.geometry.getAttribute("position");
  const point = new Vector3(), best = new Vector3().fromBufferAttribute(positions, 0);
  for (let index = 1; index < positions.count; index++) {
    point.fromBufferAttribute(positions, index);
    if (sign * (point[axis] - best[axis]) > 0 || (point[axis] === best[axis] && point.z < best.z)) best.copy(point);
  }
  return best.toArray();
}
