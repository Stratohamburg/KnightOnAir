import * as THREE from "three";
import type { Player, Enemy, Part, RuntimeWeapon } from "../../simulation/types";
import { engineOutlet, muzzleAnchor, partAnchor, type ActorPose } from "./anchors";
import { AircraftEffectSites, outlineVertex, type AircraftEffectSite } from "./aircraftEffectSites";
import { aircraftMaterial } from "../../rendering/ShaderMaterials";
import type { AircraftLivery } from "../../data/aircraftLiveries";
import { aircraftLivery, liveryBaseColor, liveryForValues } from "../../data/aircraftLiveries";
import { combatantById, NPC_PROFILES, type CombatantConfig } from "../../data/combatants";
import { AIRFRAMES } from "../../data/aircrafts";
import { buildAircraftFitting } from "./aircraftFittings";
import { FUSELAGE_SECTIONS, npcAirframeShape } from "./airframeShape";
import { NpcAircraftBatch } from "./NpcAircraftBatch";
import { ContentCatalog, geometryKey } from "./ContentCatalog";
import { resolveAircraftModel, type AircraftModelContext, type AircraftVisualFrame } from "./aircraftModels";

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
  readonly effectSites = new AircraftEffectSites();
  private readonly leases: (() => void)[] = [];
  private readonly acquired = new Map<string, THREE.BufferGeometry>();
  private readonly finish = new Map<string, THREE.ShaderMaterial>();
  readonly group = new THREE.Group();
  private npcBatch?: NpcAircraftBatch;
  private modelRoot?: THREE.Group;
  private readonly liftPivot = new THREE.Vector3();
  private readonly inverseRotation = new THREE.Quaternion();
  private materials = new Map<string, THREE.ShaderMaterial>();
  private partFinishes = new Map<string, THREE.ShaderMaterial>();
  private parts = new Map<string, THREE.Group>();
  private propellers: { mesh: THREE.Mesh; part: Part; direction?: number }[] = [];
  private turretHeads = new Map<string, THREE.Group>();
  private turretSites: { site: AircraftEffectSite; part: Part; weapon: RuntimeWeapon; index: number }[] = [];
  private livery?: AircraftLivery;
  private cloudShadowUniforms?: THREE.ShaderMaterial["uniforms"];
  contentError?: string;
  revision = -1;
  get liveryId() { return this.livery?.id; }
  get materialCount() { return this.materials.size + this.partFinishes.size; }
  partNode(id: string) { return this.parts.get(id); }
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
  private bindCloudShadows(material: THREE.ShaderMaterial) {
    if (!this.cloudShadowUniforms) return;
    for (const name of ["cloudShadowMap", "cloudShadowCenter", "cloudShadowStrength", "cloudShadowSun"])
      if (this.cloudShadowUniforms[name]) material.uniforms[name] = this.cloudShadowUniforms[name];
  }
  private paint(color: string, accent = false, applyLivery = color === this.livery?.primary) {
    const key = color + (accent ? ":accent" : "") + (applyLivery ? `:${this.livery?.id ?? "legacy"}` : "");
    const cached = this.finish.get(key);
    if (cached) return cached;
    const materialLivery = applyLivery && this.livery ? { ...this.livery, primary: color } : undefined;
    const lease = this.catalog.material(key, () => aircraftMaterial(color, accent, materialLivery));
    this.leases.push(lease.release);
    this.bindCloudShadows(lease.value);
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
    this.ensureModelRoot().add(root);
    this.parts.set(part.id, root);
    const baseColor = liveryBaseColor(this.livery, part.role, color);
    const material = this.paint(baseColor, false, Boolean(this.livery)).clone();
    this.bindCloudShadows(material);
    this.materials.set(part.id, material);
    return { root, material };
  }

  private ensureModelRoot() {
    if (!this.modelRoot) {
      this.modelRoot = new THREE.Group();
      this.modelRoot.name = "aircraft-model";
      this.group.add(this.modelRoot);
    }
    return this.modelRoot;
  }

  rebuild() {
    this.disposeContents();
    this.contentError = undefined;
    const actor = this.actor;
    this.revision = "revision" in actor ? actor.revision : 0;
    const frame = "frame" in actor ? actor.frame : AIRFRAMES.find(({ id }) => id === actor.configId);
    if (frame) {
      this.livery = aircraftLivery(frame);
      const { model, error } = resolveAircraftModel(frame);
      if (!model) {
        this.contentError = error;
        return;
      }
      const context: AircraftModelContext = {
        effectSites: this.effectSites,
        actor,
        frame,
        handledParts: new Set(),
        partRoot: (part) => this.partRoot(part, frame.color),
        partPaint: (part, color) => {
          const key = part.id + "/" + color;
          const cached = this.partFinishes.get(key);
          if (cached) return cached;
          const finish = this.paint(color, false, color === this.livery?.primary).clone();
          this.bindCloudShadows(finish);
          const owner = this.partRoot(part, frame.color).material;
          for (const uniform of ["time", "damage", "heat", "highlight", "cloudTint", "cloudVeil"])
            finish.uniforms[uniform] = owner.uniforms[uniform];
          this.partFinishes.set(key, finish);
          return finish;
        },
        geometry: (key, create) => this.geometry(key, create),
        paint: (color, accent) => this.paint(color, accent),
        mesh: (geometry, material, parent, x, y, z) => this.mesh(geometry, material, parent, x, y, z),
        registerPropeller: (mesh, part, direction) => this.registerPropeller(mesh, part, direction),
      };
      model.build(context);
      if (model.buildFittings) {
        const baseParts = combatantById(frame.id)?.parts ?? [];
        for (const part of actor.parts) {
          if (this.parts.has(part.id)) continue;
          if (!baseParts.some(base => base.id === part.id) || part.id === "service_gun")
            buildAircraftFitting(context, part);
        }
      }
      const missing = actor.parts.filter(({ id }) => !this.parts.has(id));
      if (missing.length) {
        this.contentError = `Dedicated aircraft model ${frame.id} is missing parts: ${missing.map(({ id }) => id).join(", ")}`;
        this.disposeContents();
      } else this.finishEffectSites();
      return;
    }

    if (!("frame" in actor)) {
      const config = actor.configId && combatantById(actor.configId);
      const npc = actor.profileId && NPC_PROFILES[actor.profileId];
      if (config && npc && npc.combatantId === config.id && npcAirModelKeys.has(config.visual.modelKey)) {
        this.livery = liveryForValues(config.visual.liveryId ?? `legacy:${config.visual.modelKey}`, config.visual.color, config.visual.accent);
        this.buildNpcAircraft(config);
        this.finishEffectSites();
        this.npcBatch = NpcAircraftBatch.create(this.ensureModelRoot(),config.id,this.catalog);
        return;
      }
    }
    this.contentError = `Unregistered aircraft model: ${"frame" in actor ? actor.frame.id : actor.configId ?? "unknown"}`;
  }

  private registerPropeller(mesh: THREE.Mesh, part: Part, direction = 1) {
    const index = this.propellers.filter(prop => prop.part.id === part.id).length;
    this.propellers.push({ mesh, part, direction });
    mesh.updateWorldMatrix(true,true);
    const inverse = mesh.matrixWorld.clone().invert();
    // Measure the full disk in the shaft plane, including blades parented to a hub.
    let radius = 0;
    const point = new THREE.Vector3();
    mesh.traverse(child => {
      if (!(child instanceof THREE.Mesh)) return;
      const pos = child.geometry.getAttribute("position");
      for (let i = 0; i < pos.count; i++) {
        point.fromBufferAttribute(pos, i).applyMatrix4(child.matrixWorld).applyMatrix4(inverse);
        radius = Math.max(radius, Math.hypot(point.x * mesh.scale.x, point.y * mesh.scale.y));
      }
    });
    this.effectSites.add(part.id, "propeller-" + index, "propeller", mesh, [0,0,0],
      { radius, rotationSign: direction });
  }

  private finishEffectSites() {
    const model = this.modelRoot!;
    for (const part of this.actor.parts) {
      if (part.role === "bay")
        this.effectSites.add(part.id, "release", "ordnanceRelease", model, [part.x, (part.y ?? 0) - .22, part.z], {direction: [0,-1,0]});
      if (this.propellers.some(prop => prop.part === part) && !this.effectSites.sources.some(site => site.partId === part.id && site.kind === "exhaust")) {
        const outlet = engineOutlet(part);
        this.effectSites.add(part.id, "configured-exhaust", "exhaust", model, [outlet.x, outlet.y, outlet.z],
          {basis: "configuredFallback", direction: [Math.sin(outlet.yaw), 0, Math.cos(outlet.yaw)]});
      }
    }
    for (const weapon of this.actor.weapons) {
      const part = this.actor.parts.find(p => p.id === weapon.partId);
      if (!part || weapon.config.category === "area") continue;
      for (let i = 0; i < weapon.config.count; i++) {
        const muzzle = muzzleAnchor(part, weapon, this.actor.heading, i);
        const guided = weapon.config.homing > 0 || weapon.config.id.includes("rocket");
        const site = this.effectSites.add(part.id, weapon.anchorId + "-" + i, guided ? "ordnanceRelease" : "muzzle", model, [muzzle.x, muzzle.y, muzzle.z],
          {direction: [Math.sin(muzzle.yaw),0,Math.cos(muzzle.yaw)]});
        if (weapon.config.category === "turret") this.turretSites.push({site, part, weapon, index: i});
      }
    }
    // Locate the forward and aft silhouette stations in aircraft space, even for mirrored meshes.
    model.updateWorldMatrix(true, true);
    const inverse = model.matrixWorld.clone().invert();
    let front = -Infinity, back = Infinity;
    const point = new THREE.Vector3();
    for (const { mesh } of this.effectSites.surfaces) {
      const pos = mesh.geometry.getAttribute("position");
      const local = inverse.clone().multiply(mesh.matrixWorld);
      for (let i = 0; i < pos.count; i++) {
        point.fromBufferAttribute(pos,i).applyMatrix4(local);
        front = Math.max(front, point.z);
        back = Math.min(back, point.z);
      }
    }
    if (Number.isFinite(front)) {
      this.effectSites.add("center_body", "nose-wave", "noseWave", model, [0,0,front], {direction: [0,0,1]});
      this.effectSites.add("center_body", "wake", "wake", model, [0,0,back]);
    }
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
          this.effectSites.surfaces.push({partId: part.id, mesh: hull});
          this.mesh(this.geometry(geometryKey("box", shape.length * .10, .9, shape.length * .36), () => new THREE.BoxGeometry(shape.length * .10, .9, shape.length * .36)), this.paint(accent, true), root);
        } else {
          const { length, width } = shape;
          const mesh = this.mesh(this.geometry(geometryKey("npc-fuselage", length, width), () => fuselageGeometry(length, width)), material, root);
          this.effectSites.surfaces.push({partId: part.id, mesh});
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
          const mesh = this.mesh(this.geometry(key, () => wingVolume(positions, side)), material, root);
          const segment = part.silhouette.indexOf(corners);
          this.effectSites.surfaces.push({partId: part.id, mesh});
          if (!part.visual?.detachable) this.effectSites.addWingFlow(part.id, "surface-"+segment, mesh);
          if (part.visual?.detachable) this.effectSites.add(part.id, "tip-"+segment, "wingTip", mesh, outlineVertex(mesh,"x",side));
        }
      } else if (part.kind === "engine") {
        const anchor = partAnchor(part);
        root.position.set(anchor.x, anchor.y, anchor.z);
        const engine = this.mesh(
          this.geometry("npc-engine", () => new THREE.CylinderGeometry(.28, .34, 1.3, 8)),
          material, root,
        );
        engine.rotation.x = Math.PI / 2;
        this.effectSites.surfaces.push({partId: part.id, mesh: engine});
        this.effectSites.add(part.id, "casing-rim", "protrusion", root, [0,.34,-.65]);
        if (config.era === "pioneer" || config.era === "ww1" || config.era === "ww2") {
          const propeller = this.mesh(
            this.geometry(geometryKey("npc-propeller", Number(shape.buoyant)), () => new THREE.BoxGeometry(.14, shape.buoyant ? 2.3 : 1.7, .07)),
            this.paint(accent, true), root, 0, 0, part.engineInstallation === "pusher" ? -.75 : .75,
          );
          this.registerPropeller(propeller, part);
        } else {
          this.effectSites.add(part.id, "outlet", "jetOutlet", root, [0,0,-.65], {radius: .34});
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

  setCloudAtmosphere(veil: number, tint: THREE.ColorRepresentation) {
    const clamped = THREE.MathUtils.clamp(veil, 0, .32);
    for (const mat of this.materials.values()) {
      if (mat.uniforms.cloudVeil) mat.uniforms.cloudVeil.value = clamped;
      if (mat.uniforms.cloudTint) mat.uniforms.cloudTint.value.set(tint);
    }
    for (const mat of this.partFinishes.values()) {
      if (mat.uniforms.cloudVeil) mat.uniforms.cloudVeil.value = clamped;
      if (mat.uniforms.cloudTint) mat.uniforms.cloudTint.value.set(tint);
    }
    this.npcBatch?.setCloudAtmosphere(clamped, tint);
  }

  setCloudShadows(uniforms: THREE.ShaderMaterial["uniforms"]) {
    this.cloudShadowUniforms = uniforms;
    const apply = (material: THREE.ShaderMaterial) => this.bindCloudShadows(material);
    this.materials.forEach(apply);
    this.finish.forEach(apply);
    this.partFinishes.forEach(apply);
    this.npcBatch?.setCloudShadows(uniforms);
  }

  setQualityDetail(detail: number) {
    const apply = (material: THREE.ShaderMaterial) => {
      if (material.uniforms.liveryDetail) material.uniforms.liveryDetail.value = detail;
    };
    this.materials.forEach(apply);
    this.partFinishes.forEach(apply);
    this.npcBatch?.setQualityDetail(detail);
  }

  setSceneLighting(viewDirection: THREE.Vector3, ambient: number, direct: number) {
    const apply = (material: THREE.ShaderMaterial) => {
      if (!material.uniforms.sceneSun) return;
      material.uniforms.sceneSun.value.copy(viewDirection);
      material.uniforms.sceneAmbient.value = ambient;
      material.uniforms.sceneDirect.value = direct;
    };
    this.materials.forEach(apply);
    this.finish.forEach(apply);
    this.partFinishes.forEach(apply);
    if (this.npcBatch) apply(this.npcBatch.mesh.material);
  }

  update(time: number, dt: number, highlight = "", display = false, refitParts?: ReadonlySet<string>) {
    const p = this.actor;
    if ("revision" in p && p.revision !== this.revision) this.rebuild();
    for (const { mesh, part, direction = 1 } of this.propellers)
      if (part.health > 0) mesh.rotation.z += direction * dt * (display ? 19 : 14 + p.speed * 3);
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
        refitParts?.has(part.id) || highlight === part.slot ||
        (highlight === "engines" && part.kind === "engine")
          ? 1
          : 0;
    }
    for (const [id, head] of this.turretHeads) {
      const weapon: RuntimeWeapon | undefined = p.weapons.find(
        (w) => w.partId === id,
      );
      if (weapon) head.rotation.y = weapon.heading - p.heading;
    }
    for (const {site, part, weapon, index} of this.turretSites) {
      const anchor = muzzleAnchor(part, weapon, p.heading, index);
      site.position = [anchor.x, anchor.y, anchor.z];
      site.direction = [Math.sin(anchor.yaw), 0, Math.cos(anchor.yaw)];
    }
    this.group.rotation.set(0, p.heading, p.bank);
    this.syncLiftPivot();
    this.npcBatch?.update(time);
  }
  /** Resolve an installed node at a fixed-step pose, independently of presentation interpolation. */
  matrixAtPose(node: THREE.Object3D, pose: ActorPose) {
    const root = this.ensureModelRoot();
    node.updateWorldMatrix(true,false);
    const frame = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0,pose.heading,pose.bank,"YXZ"));
    const pivot = this.liftPivot;
    frame.setPosition(pose.x + pivot.x, pose.y + pivot.y, pose.z + pivot.z);
    frame.multiply(new THREE.Matrix4().makeTranslation(-pivot.x,-pivot.y,-pivot.z));
    return frame.multiply(root.matrixWorld.clone().invert()).multiply(node.matrixWorld);
  }
  /** Reapply the pivot after a presentation-only pitch or orbit rotation. */
  syncLiftPivot() {
    if (!this.modelRoot) return;
    const frame = "frame" in this.actor
      ? this.actor.frame
      : this.actor.configId
        ? combatantById(this.actor.configId)?.frame
        : undefined;
    this.liftPivot.set(
      0,
      frame && "liftCenterY" in frame ? frame.liftCenterY ?? 0 : 0,
      frame && "liftCenterZ" in frame ? frame.liftCenterZ ?? 0 : 0,
    );
    this.inverseRotation.copy(this.group.quaternion).invert();
    // Keep the actor datum at the simulation position while rotating the
    // visual assembly around its configured three-dimensional lift resultant.
    this.modelRoot.position.copy(this.liftPivot)
      .applyQuaternion(this.inverseRotation)
      .sub(this.liftPivot);
  }
  private disposeContents() {
    this.npcBatch?.dispose();
    this.npcBatch = undefined;
    this.effectSites.clear();
    this.parts.clear();
    this.turretHeads.clear();
    this.turretSites.length = 0;
    this.propellers = [];
    for (const release of this.leases.splice(0)) release();
    this.acquired.clear();
    this.finish.clear();
    this.group.clear();
    this.modelRoot = undefined;
    for (const mat of this.materials.values()) mat.dispose();
    this.materials.clear();
    for (const finish of this.partFinishes.values()) finish.dispose();
    this.partFinishes.clear();
    this.livery = undefined;
  }
  dispose() {
    this.group.removeFromParent();
    this.disposeContents();
  }
}
