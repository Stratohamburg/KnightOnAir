import * as THREE from "three";
import type { Player, Enemy, Part, RuntimeWeapon } from "../../simulation/types";
import { partAnchor } from "./anchors";
import { aircraftMaterial, effectMaterial } from "../../rendering/ShaderMaterials";
import { combatantById, NPC_PROFILES, type CombatantConfig } from "../../data/combatants";
import { AIRFRAMES } from "../../data/aircrafts";
import { FUSELAGE_SECTIONS, npcAirframeShape } from "./airframeShape";
import { ContentCatalog, geometryKey } from "./ContentCatalog";
import { resolveAircraftModel, type AircraftVisualFrame } from "./aircraftModels";

export type ReferenceAircraft = Pick<Player,
  "parts" | "weapons" | "heading" | "bank" | "speed" | "energy" | "x" | "z" | "prevX" | "prevZ" | "vx" | "vz"
> & { frame: AircraftVisualFrame; stats: Pick<Player["stats"], "length" | "wingspan" | "maxSpeed"> };

// Flat normals are generated from actual sections; no imported mesh or texture is used.
export function fuselageGeometry(length: number, width = 0.48, sections: readonly (readonly [number, number, number])[] = FUSELAGE_SECTIONS) {
  const vertices: number[] = [];
  const point = (s: readonly number[], a: number) => [
    Math.cos(a) * s[1] * width,
    Math.sin(a) * s[2] * width * 0.85,
    s[0] * length,
  ];
  for (let i = 0; i < sections.length - 1; i++)
    for (let j = 0; j < 8; j++) {
      const a = (j / 8) * Math.PI * 2,
        b = ((j + 1) / 8) * Math.PI * 2;
      const v0 = point(sections[i], a),
        v1 = point(sections[i], b),
        v2 = point(sections[i + 1], a),
        v3 = point(sections[i + 1], b);
      vertices.push(...v0, ...v1, ...v2, ...v1, ...v3, ...v2);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  g.computeVertexNormals();
  return g;
}
function wingVolume(p: number[][], side: number) {
  const corners = p.length / 2;
  const indices: number[] = [];
  const forward = side > 0;
  for (let index = 1; index < corners - 1; index++) {
    indices.push(0, forward ? index : index + 1, forward ? index + 1 : index);
    indices.push(corners, forward ? corners + index + 1 : corners + index, forward ? corners + index : corners + index + 1);
  }
  for (let index = 0; index < corners; index++) {
    const next = (index + 1) % corners;
    indices.push(index, next, corners + index, next, corners + next, corners + index);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p.flat(), 3));
  g.setIndex(indices);
  const flat = g.toNonIndexed();
  flat.computeVertexNormals();
  g.dispose();
  return flat;
}
const defaultCatalog = new ContentCatalog();
const npcAirModelKeys = new Set([
  "scout", "hunter", "bomber", "escort", "striker", "elite", "recon_balloon",
  "interceptor", "heavy_fighter", "torpedo_bomber", "gunship", "ace", "jet_bomber",
]);

export class ProceduralAircraft {
  private readonly leases: (() => void)[] = [];
  private readonly acquired = new Map<string, THREE.BufferGeometry>();
  private readonly finish = new Map<string, THREE.ShaderMaterial>();
  readonly group = new THREE.Group();
  private materials = new Map<string, THREE.ShaderMaterial>();
  private parts = new Map<string, THREE.Group>();
  private propellers: { mesh: THREE.Mesh; part: Part }[] = [];
  private flames: { mesh: THREE.Mesh; part: Part }[] = [];
  private turretHeads = new Map<string, THREE.Group>();
  private flameMaterial = effectMaterial();
  contentError?: string;
  revision = -1;
  constructor(readonly actor: Player | Enemy | ReferenceAircraft, private readonly catalog = defaultCatalog) {
    this.rebuild();
  }
  private geometry<T extends THREE.BufferGeometry>(key: string, create: () => T): T {
    const cached = this.acquired.get(key);
    if (cached) return cached as T;
    const lease = this.catalog.geometry(key, create);
    this.leases.push(lease.release);
    this.acquired.set(key, lease.value);
    return lease.value;
  }
  private paint(color: string, accent = false) {
    const key = color + (accent ? ':accent' : '');
    const cached = this.finish.get(key);
    if (cached) return cached;
    const lease = this.catalog.material(key, () => aircraftMaterial(color, accent));
    this.leases.push(lease.release);
    this.finish.set(key, lease.value);
    return lease.value;
  }
  private mesh(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    parent: THREE.Object3D,
    x = 0,
    y = 0,
    z = 0,
  ) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  private partRoot(part: Part, color: string) {
    const existing = this.parts.get(part.id);
    if (existing) return { root: existing, material: this.materials.get(part.id)! };
    const root = new THREE.Group();
    root.name = part.id;
    this.group.add(root);
    this.parts.set(part.id, root);
    const material = this.paint(color).clone();
    this.materials.set(part.id, material);
    return { root, material };
  }

  rebuild() {
    this.disposeContents();
    this.contentError = undefined;
    const actor = this.actor;
    this.revision = "revision" in actor ? actor.revision : 0;
    const frame = "frame" in actor ? actor.frame : AIRFRAMES.find(({ id }) => id === actor.configId);
    if (frame) {
      const { model, error } = resolveAircraftModel(frame);
      if (!model) {
        this.contentError = error;
        return;
      }
      model.build({
        actor,
        frame,
        handledParts: new Set(),
        partRoot: (part) => this.partRoot(part, frame.color),
        geometry: (key, create) => this.geometry(key, create),
        paint: (color, accent) => this.paint(color, accent),
        mesh: (geometry, material, parent, x, y, z) => this.mesh(geometry, material, parent, x, y, z),
        registerPropeller: (mesh, part) => this.propellers.push({ mesh, part }),
      });
      const missing = actor.parts.filter(({ id }) => !this.parts.has(id));
      if (missing.length) {
        this.contentError = `Dedicated aircraft model ${frame.id} is missing parts: ${missing.map(({ id }) => id).join(", ")}`;
        this.disposeContents();
      }
      return;
    }

    if (!("frame" in actor)) {
      const config = actor.configId && combatantById(actor.configId);
      const npc = actor.profileId && NPC_PROFILES[actor.profileId];
      if (config && npc && npc.combatantId === config.id && npcAirModelKeys.has(config.visual.modelKey)) {
        this.buildNpcAircraft(config);
        return;
      }
    }
    this.contentError = `Unregistered aircraft model: ${"frame" in actor ? actor.frame.id : actor.configId ?? "unknown"}`;
  }

  private buildNpcAircraft(config: CombatantConfig) {
    const { color, accent, modelKey } = config.visual;
    const shape = npcAirframeShape(modelKey, config.era);
    const metal = this.paint("#46535a");
    for (const part of this.actor.parts) {
      const { root, material } = this.partRoot(part, color);
      if (part.id === "center_body") {
        if (shape.buoyant) {
          const hull = this.mesh(this.geometry(geometryKey("icosahedron", 1, 2), () => new THREE.IcosahedronGeometry(1, 2)), material, root, 0, shape.length * .14);
          hull.scale.set(shape.width, shape.length * .15, shape.length * .5);
          this.mesh(this.geometry(geometryKey("box", shape.length * .10, .9, shape.length * .36), () => new THREE.BoxGeometry(shape.length * .10, .9, shape.length * .36)), this.paint(accent, true), root);
        } else {
          const { length, width } = shape;
          this.mesh(this.geometry(geometryKey("npc-fuselage", length, width), () => fuselageGeometry(length, width)), material, root);
        }
      } else if (part.role === "wing" && part.silhouette) {
        const anchor = partAnchor(part);
        root.position.set(anchor.x, anchor.y, anchor.z);
        for (const corners of part.silhouette) {
          const positions = [.085, -.085].flatMap((height) =>
            corners.map(({ x, y, z }) => [x - anchor.x, y - anchor.y + height, z - anchor.z]),
          );
          const key = geometryKey("npc-wing-section", ...positions.flat());
          const side = part.slot === "leftWing" ? -1 : 1;
          this.mesh(this.geometry(key, () => wingVolume(positions, side)), material, root);
        }
      } else if (part.kind === "engine") {
        const anchor = partAnchor(part);
        root.position.set(anchor.x, anchor.y, anchor.z);
        const engine = this.mesh(
          this.geometry("npc-engine", () => new THREE.CylinderGeometry(.28, .34, 1.3, 8)),
          material, root,
        );
        engine.rotation.x = Math.PI / 2;
        if (config.era === "pioneer" || config.era === "ww1" || config.era === "ww2") {
          const propeller = this.mesh(
            this.geometry(geometryKey("npc-propeller", Number(shape.buoyant)), () => new THREE.BoxGeometry(.14, shape.buoyant ? 2.3 : 1.7, .07)),
            this.paint(accent, true), root, 0, 0, part.engineInstallation === "pusher" ? -.75 : .75,
          );
          this.propellers.push({ mesh: propeller, part });
        } else {
          const flame = this.mesh(this.geometry("npc-jet-flame", () => new THREE.PlaneGeometry(.6, 2.5)), this.flameMaterial, root, 0, -.06, -1.4);
          flame.rotation.x = -Math.PI / 2;
          this.flames.push({ mesh: flame, part });
        }
      } else if (part.kind === "turret") {
        const anchor = partAnchor(part);
        root.position.set(anchor.x, anchor.y, anchor.z);
        this.mesh(this.geometry("npc-turret-base", () => new THREE.CylinderGeometry(.35, .43, .2, 8)), metal, root);
        const head = new THREE.Group();
        root.add(head);
        this.turretHeads.set(part.id, head);
        this.mesh(this.geometry("npc-turret-head", () => new THREE.SphereGeometry(.36, 6, 3)), material, head, 0, .15);
        for (const x of [-.15, .15]) {
          this.mesh(this.geometry("npc-turret-barrel", () => new THREE.BoxGeometry(.09, .09, .8)), metal, head, x, .18, .5);
        }
      }
    }
  }

  update(time: number, dt: number, highlight = "", display = false) {
    const p = this.actor;
    if ("revision" in p && p.revision !== this.revision) this.rebuild();
    for (const { mesh, part } of this.propellers)
      if (part.health > 0) mesh.rotation.z += dt * (display ? 19 : 14 + p.speed * 3);
    for (const part of p.parts) {
      const root = this.parts.get(part.id);
      if (!root) continue;
      const parent = part.parentId ? p.parts.find((candidate) => candidate.id === part.parentId) : undefined;
      root.visible = !part.destroyed && (!parent || (!parent.destroyed && parent.health > 0));
      const mat = this.materials.get(part.id)!;
      mat.uniforms.time.value = time;
      mat.uniforms.damage.value = 1 - part.health / part.maxHealth;
      mat.uniforms.heat.value = part.health < part.maxHealth * 0.3 ? .18 : 0;
      mat.uniforms.highlight.value =
        highlight === part.slot ||
        (highlight === "engines" && part.kind === "engine")
          ? 1
          : 0;
    }
    for (const { mesh, part } of this.flames) {
      mesh.visible = part.health > 0;
      mesh.scale.y =
        (display ? 0.7 : 0.3 + (p.speed / ("stats" in p ? p.stats.maxSpeed : Math.max(1, p.speed))) * 0.7) *
        (0.85 + Math.sin(time * 47) * 0.12);
    }
    this.flameMaterial.uniforms.time.value = time;
    this.flameMaterial.uniforms.color.value.set(
      p.energy < 8 ? "#efac57" : "#a9e9de",
    );
    for (const [id, head] of this.turretHeads) {
      const weapon: RuntimeWeapon | undefined = p.weapons.find(
        (w) => w.partId === id,
      );
      if (weapon) head.rotation.y = weapon.heading - p.heading;
    }
    this.group.rotation.set(0, p.heading, p.bank);

  }
  private disposeContents() {
    this.parts.clear();
    this.turretHeads.clear();
    this.flames = [];
    this.propellers = [];
    for (const release of this.leases.splice(0)) release();
    this.acquired.clear();
    this.finish.clear();
    this.group.clear();
    for (const mat of this.materials.values()) mat.dispose();
    this.materials.clear();
  }
  dispose() {
    this.group.removeFromParent();
    this.disposeContents();
    this.flameMaterial.dispose();
  }
}
