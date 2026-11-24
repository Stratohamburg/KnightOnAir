import * as THREE from "three";
import type { Player, Enemy, Part, RuntimeWeapon } from "../../simulation/types";
import { partAnchor } from "./anchors";
import { aircraftMaterial, effectMaterial } from "../../rendering/ShaderMaterials";
import { combatantById } from "../../data/combatants";
import { airframeById } from "../../data/aircrafts";
import { aircraftGeometryProfile, FUSELAGE_SECTIONS, npcAirframeShape, type AircraftGeometryProfile } from "./airframeShape";
import { ContentCatalog, geometryKey } from "./ContentCatalog";
import { aircraftModelBuilder } from "./aircraftModels";

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
export function wingGeometry(
  span: number,
  side: number,
  chord = 1.5,
  sweep = 0.65,
  thickness = 0.12,
) {
  const p = [
    [0, thickness, chord * 0.48],
    [span * side, thickness * 0.3, -sweep],
    [span * side, thickness * 0.3, -sweep - chord * 0.36],
    [0, thickness, -chord * 0.6],
    [0, -thickness, chord * 0.48],
    [span * side, -thickness * 0.3, -sweep],
    [span * side, -thickness * 0.3, -sweep - chord * 0.36],
    [0, -thickness, -chord * 0.6],
  ];
  return wingVolume(p, side);
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
  revision = -1;
  constructor(readonly actor: Player | Enemy, private readonly catalog = defaultCatalog) {
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
  rebuild() {
    this.disposeContents();
    this.flames = [];
    this.propellers = [];
    this.parts.clear();
    this.turretHeads.clear();
    const p = this.actor;
    const config = combatantById(p.configId ?? "");
    const playerFrame = "frame" in p ? p.frame : airframeById(p.configId ?? "");
    const npc = !("frame" in p) && playerFrame.id !== p.configId;
    const geometry: AircraftGeometryProfile | undefined = npc ? undefined : aircraftGeometryProfile(playerFrame.geometryProfile);
    const shape = npc ? npcAirframeShape(config.visual.modelKey, config.era) : undefined;
    const f = shape ? {
      ...playerFrame, color: config.visual.color, accent: config.visual.accent, era: config.era,
      shape: shape.buoyant ? "airship" : undefined,
    } : playerFrame;
    const s = "stats" in p ? p.stats : shape ?? f;
    const trim = this.paint(f.accent, true),
      metal = this.paint("#46535a"),
      glass = this.paint("#29464b");
    const handledParts = new Set<string>();
    const dedicatedBuilder = !npc ? aircraftModelBuilder(geometry?.id) : undefined;
    if (dedicatedBuilder && geometry) {
      dedicatedBuilder({
        actor: p,
        frame: playerFrame,
        stats: { length: s.length, wingspan: s.wingspan },
        profile: geometry,
        group: this.group,
        handledParts,
        partRoot: (part) => {
          const existing = this.parts.get(part.id);
          if (existing) return { root: existing, material: this.materials.get(part.id)! };
          const root = new THREE.Group();
          root.name = part.id;
          this.group.add(root);
          this.parts.set(part.id, root);
          const material = this.paint(f.color).clone();
          this.materials.set(part.id, material);
          return { root, material };
        },
        geometry: (key, create) => this.geometry(key, create),
        paint: (color, accent = false) => this.paint(color, accent),
        mesh: (meshGeometry, material, parent, x = 0, y = 0, z = 0) => this.mesh(meshGeometry, material, parent, x, y, z),
        registerPropeller: (mesh, part) => this.propellers.push({ mesh, part }),
      });
    }
    for (const part of p.parts) {
      if (handledParts.has(part.id)) continue;
      const root = new THREE.Group();
      root.name = part.id;
      this.group.add(root);
      this.parts.set(part.id, root);
      const mat = this.paint(f.color).clone();
      this.materials.set(part.id, mat);
      const side = part.slot === "leftWing" ? -1 : 1;
      if (part.id === "center_body") {
        if (geometry?.layout === "flyingWing") {
          const integrated = geometry.fuselage.construction === "integratedWing";
          const pod = this.mesh(
            this.geometry(geometryKey(`fuselage:${geometry.id}`, s.length * (integrated ? .24 : .28), geometry.fuselage.width), () => fuselageGeometry(s.length * (integrated ? .24 : .28), geometry.fuselage.width, geometry.fuselage.sections)),
            mat,
            root,
            0,
            .08,
            s.length * (integrated ? .02 : .04),
          );
          pod.scale.set(integrated ? 1.12 : .92, integrated ? .84 : .76, 1);
        } else if (f.shape === "airship") {
          const hull = this.mesh(this.geometry(geometryKey("icosahedron", 1, 2), () => new THREE.IcosahedronGeometry(1, 2)), mat, root, 0, s.length * .14, 0);
          hull.scale.set(shape?.width ?? s.length * .14, s.length * .15, s.length * .5);
          this.mesh(this.geometry(geometryKey("box", s.length * .10, .9, s.length * .36), () => new THREE.BoxGeometry(s.length * .10, .9, s.length * .36)), trim, root);
        } else {
          const bodyWidth = geometry?.fuselage.width ?? shape?.width ?? (f.engines === 4 ? .75 : .48);
          this.mesh(this.geometry(geometryKey(`fuselage:${geometry?.id ?? "default"}`, s.length, bodyWidth), () => fuselageGeometry(s.length, bodyWidth, geometry?.fuselage.sections)), mat, root);
          if (f.shape === "flyingBoat") {
            const hull = this.mesh(this.geometry(geometryKey("fuselage", s.length * .96, s.length * .11), () => fuselageGeometry(s.length * .96, s.length * .11)), trim, root, 0, -.55);
            hull.scale.y = .64;
          }
        }
        if (!npc) {
          const cockpit = this.mesh(
            this.geometry(geometryKey("sphere", 0.45, 6, 4), () => new THREE.SphereGeometry(0.45, 6, 4)),
            glass,
            root,
            0,
            0.36,
            geometry?.fuselage.cockpitZ ?? s.length * 0.11,
          );
          cockpit.scale.set(geometry?.layout === "flyingWing" ? .58 : .68, geometry?.layout === "flyingWing" ? .6 : .75, geometry?.layout === "twinBoom" ? 1.2 : 1.65);
          const stripe = this.mesh(
            this.geometry(geometryKey("box", 0.065, 0.025, s.length * 0.3), () => new THREE.BoxGeometry(0.065, 0.025, s.length * 0.3)),
            trim,
            root,
            0,
            0.43,
            -s.length * 0.12,
          );
          stripe.rotation.x = 0.05;
          if (geometry?.layout === "twinBoom") {
            for (const dir of [-1, 1]) {
              const intake = this.mesh(
                this.geometry(geometryKey("vampire-intake", .18, .22, dir), () => new THREE.BoxGeometry(.18, .22, .5)),
                metal,
                root,
                dir * s.wingspan * .13,
                .04,
                s.length * .08,
              );
              intake.rotation.y = dir * .2;
            }
          }
          if (geometry?.id === "spitfire") {
            // The Mk Vb radiator fairings sit below the inner wing roots.
            for (const dir of [-1, 1]) {
              const radiator = this.mesh(
                this.geometry(geometryKey("spitfire-radiator", dir), () => new THREE.BoxGeometry(.34, .16, .72)),
                metal,
                root,
                dir * s.wingspan * .17,
                -.2,
                -.02,
              );
              radiator.rotation.y = dir * .08;
            }
          }
          if (geometry?.id === "fokkerDr1") {
            // The Dr.I's interplane struts are part of the airframe silhouette.
            // They bridge the measured lower, middle and upper wing seams and
            // keep the three layers readable in the fixed front view.
            const strut = this.geometry(
              geometryKey("fokker-strut", .88, .05),
              () => new THREE.CylinderGeometry(.026, .038, .88, 6),
            );
            for (const dir of [-1, 1]) {
              for (const x of [1.08, 2.45]) {
                this.mesh(strut, trim, root, dir * x, .01, 1.78);
              }
            }
            const cabane = this.geometry(
              geometryKey("fokker-cabane", .34, .045),
              () => new THREE.CylinderGeometry(.024, .034, .34, 6),
            );
            for (const dir of [-1, 1])
              this.mesh(cabane, trim, root, dir * .22, .28, 1.86);
          }
        }
      } else if (part.role === "wing" && part.silhouette) {
        const anchor = partAnchor(part);
        root.position.set(anchor.x, anchor.y, anchor.z);
        for (const corners of part.silhouette) {
          const positions = [.085, -.085].flatMap((height) =>
            corners.map(({ x, y, z }) => [x - anchor.x, y - anchor.y + height, z - anchor.z]),
          );
          const key = geometryKey("wing-section", ...positions.flat());
          this.mesh(this.geometry(key, () => wingVolume(positions, side)), mat, root);
        }
        if (f.shape === "floatplane" && !part.id.endsWith("_tip")) {
          const x = side * s.wingspan * .21 - anchor.x;
          this.mesh(this.geometry(geometryKey("fuselage", f.length * .62, .38), () => fuselageGeometry(f.length * .62, .38)), trim, root, x, -.9 - anchor.y, -anchor.z).scale.y = .72;
          this.mesh(this.geometry(geometryKey("box", .13, .82, .15), () => new THREE.BoxGeometry(.13, .82, .15)), metal, root, x, -.46 - anchor.y, -anchor.z);
        }
      } else if (part.id === "tail") {
        const tail = geometry?.tail;
        root.position.z = geometry?.id === "ho229"
          ? -s.length * .18
          : tail ? s.length * tail.z : -s.length * 0.34;
        if (tail?.kind === "twin") {
          for (const dir of [-1, 1]) {
            const boom = this.mesh(
              this.geometry(geometryKey("twin-boom", s.length * .76, .16, dir), () => fuselageGeometry(s.length * .76, .16, geometry?.fuselage.sections)),
              mat,
              root,
              dir * s.wingspan * .22,
              .04,
              -s.length * .17,
            );
            boom.scale.set(.72, .72, 1);
            const fin = this.mesh(
              this.geometry(geometryKey("twin-fin", .58, dir), () => wingGeometry(.58, 1, .66, .18, .065)),
              trim,
              root,
              dir * s.wingspan * .22,
              .22,
              -s.length * .54,
            );
            fin.rotation.z = Math.PI / 2;
          }
          for (const dir of [-1, 1]) {
            this.mesh(
              this.geometry(geometryKey("twin-stabilizer", s.wingspan * .28, dir, s.length * .16), () => wingGeometry(s.wingspan * .28, dir, s.length * .16, .12, .07)),
              mat,
              root,
              0,
              .32,
              -s.length * .54,
            );
          }
        } else if (tail?.kind === "none") {
          for (const dir of [-1, 1]) {
            this.mesh(
              this.geometry(geometryKey("flying-wing-elevon", s.wingspan * .22, dir, s.length * .16), () => wingGeometry(s.wingspan * .22, dir, s.length * .16, .38, .055)),
              trim,
              root,
              dir * s.wingspan * .24,
              .02,
              -s.length * .08,
            );
          }
        } else {
          for (const dir of [-1, 1]) {
            this.mesh(
              this.geometry(geometryKey("tail-wing", s.wingspan * (tail?.span ?? .2), dir, s.length * (tail?.chord ?? .19), .3, .08), () => wingGeometry(s.wingspan * (tail?.span ?? .2), dir, s.length * (tail?.chord ?? .19), 0.3, 0.08)),
              mat,
              root,
            );
          }
          const fin = this.mesh(
            this.geometry(geometryKey("tail-fin", .7, 1, .8, .35, .065), () => wingGeometry(.7, 1, .8, .35, .065)),
            trim,
            root,
            0,
            .1,
            -.2,
          );
          fin.rotation.z = Math.PI / 2;
        }
      } else if (part.kind === "landingGear") {
        const anchor = partAnchor(part);
        root.position.set(anchor.x, anchor.y, anchor.z);
        const strutGeometry = this.geometry(
          geometryKey("landing-strut", .42, .06),
          () => new THREE.CylinderGeometry(.045, .06, .42, 6),
        );
        for (const dir of [-1, 1]) {
          const strut = this.mesh(strutGeometry, metal, root, dir * .22, .02, 0);
          strut.rotation.z = dir * .28;
        }
        this.mesh(
          this.geometry(geometryKey("landing-axle", .78, .055), () => new THREE.CylinderGeometry(.045, .055, .78, 6)),
          metal,
          root,
          0,
          -.2,
          0,
        ).rotation.z = Math.PI / 2;
        const wheelGeometry = this.geometry(
          geometryKey("landing-wheel", .16, .1),
          () => new THREE.CylinderGeometry(.16, .16, .1, 10),
        );
        const wheelTrim = this.geometry(
          geometryKey("landing-wheel-trim", .15, .035),
          () => new THREE.TorusGeometry(.15, .035, 6, 12),
        );
        for (const dir of [-1, 1]) {
          const wheel = this.mesh(wheelGeometry, metal, root, dir * .39, -.3, 0);
          wheel.rotation.z = Math.PI / 2;
          const tire = this.mesh(wheelTrim, trim, root, dir * .39, -.3, 0);
          tire.rotation.y = Math.PI / 2;
        }
      } else if (part.kind === "engine") {
        const anchor = partAnchor(part);
        root.position.set(anchor.x, anchor.y, anchor.z);
        const engine = this.mesh(
          this.geometry(geometryKey("cylinder", 0.28, 0.34, 1.3, 8), () => new THREE.CylinderGeometry(0.28, 0.34, 1.3, 8)),
          mat,
          root,
        );
        engine.rotation.x = Math.PI / 2;
        if (!npc) {
          const engineFront = part.engineInstallation === "pusher" ? -.7 : .7;
          const ring = this.mesh(
            this.geometry(geometryKey("torus", 0.24, 0.065, 4, 10), () => new THREE.TorusGeometry(0.24, 0.065, 4, 10)),
            metal,
            root,
            0,
            0,
            engineFront,
          );
          ring.rotation.x = 0;
          this.mesh(
            this.geometry(geometryKey("cylinder", 0.14, 0.16, 0.1, 8), () => new THREE.CylinderGeometry(0.14, 0.16, 0.1, 8)),
            metal,
            root,
            0,
            0,
            engineFront + (part.engineInstallation === "pusher" ? -.04 : .04),
          ).rotation.x = Math.PI / 2;
        }
        if (geometry?.engine.style === "propeller" || (!geometry && f.era && f.era !== "jet")) {
          const propeller = this.mesh(this.geometry(geometryKey("box", .14, f.shape === "airship" ? 2.3 : 1.7, .07), () => new THREE.BoxGeometry(.14, f.shape === "airship" ? 2.3 : 1.7, .07)), trim, root, 0, 0, part.engineInstallation === "pusher" ? -.75 : .75);
          this.propellers.push({ mesh: propeller, part });
          continue;
        }
        const flame = this.mesh(
          this.geometry(geometryKey("plane", 0.6, 2.5), () => new THREE.PlaneGeometry(0.6, 2.5)),
          this.flameMaterial,
          root,
          0,
          -0.06,
          -1.4,
        );
        flame.rotation.x = -Math.PI / 2;
        this.flames.push({ mesh: flame, part });
      } else if (part.kind === "turret") {
        const anchor = partAnchor(part);
        root.position.set(anchor.x, anchor.y, anchor.z);
        this.mesh(this.geometry(geometryKey("cylinder", 0.35, 0.43, 0.2, 8), () => new THREE.CylinderGeometry(0.35, 0.43, 0.2, 8)), metal, root);
        const head = new THREE.Group();
        root.add(head);
        this.turretHeads.set(part.id, head);
        this.mesh(this.geometry(geometryKey("sphere", 0.36, 6, 3), () => new THREE.SphereGeometry(0.36, 6, 3)), mat, head, 0, 0.15, 0);
        for (const x of [-0.15, 0.15])
          this.mesh(
            this.geometry(geometryKey("box", 0.09, 0.09, 0.8), () => new THREE.BoxGeometry(0.09, 0.09, 0.8)),
            metal,
            head,
            x,
            0.18,
            0.5,
          );
      } else if (
        part.kind === "gun" ||
        part.kind === "cannon" ||
        part.kind === "tailGun"
      ) {
        const anchor = partAnchor(part);
        root.position.set(anchor.x, anchor.y, anchor.z);
        root.rotation.y = anchor.yaw;
        const barrelCount = Math.max(1, ...p.weapons
          .filter((weapon) => weapon.partId === part.id)
          .map((weapon) => weapon.config.count));
        for (let index = 0; index < barrelCount; index++) {
          const x = (index - (barrelCount - 1) * .5) * .23;
          this.mesh(
            this.geometry(geometryKey("box", 0.1,
              0.12,
              part.kind === "cannon" ? 1.5 : 0.85), () => new THREE.BoxGeometry(
              0.1,
              0.12,
              part.kind === "cannon" ? 1.5 : 0.85,
            )),
            metal,
            root,
            x,
            0,
            0.4,
          );
        }
        if (part.id !== "nose")
          this.mesh(this.geometry(geometryKey("box", 0.5, 0.26, 0.5), () => new THREE.BoxGeometry(0.5, 0.26, 0.5)), mat, root);
      } else if (part.kind === "radar") {
        root.position.set(part.x, 0.3, part.z);
        this.mesh(this.geometry(geometryKey("sphere", 0.32, 6, 4), () => new THREE.SphereGeometry(0.32, 6, 4)), mat, root).scale.z =
          1.8;
        this.mesh(
          this.geometry(geometryKey("torus", 0.4, 0.035, 4, 16), () => new THREE.TorusGeometry(0.4, 0.035, 4, 16)),
          trim,
          root,
          0,
          0.16,
          0,
        ).rotation.x = Math.PI / 2;
      } else if (part.kind === "wing" || part.kind === "winglet") {
        root.position.set(part.x, 0.12, part.z);
        const mesh = this.mesh(
          this.geometry(geometryKey("wing", part.kind === "wing" ? 1.2 : 0.4, side, 1, 0.4), () => wingGeometry(part.kind === "wing" ? 1.2 : 0.4, side, 1, 0.4)),
          mat,
          root,
        );
        if (part.kind === "winglet") mesh.rotation.z = side * 0.35;
      } else if (part.kind === "reactor") {
        root.position.set(0, 0.5, -0.45);
        this.mesh(this.geometry(geometryKey("sphere", 0.35, 8, 5), () => new THREE.SphereGeometry(0.35, 8, 5)), trim, root);
        this.mesh(
          this.geometry(geometryKey("torus", 0.5, 0.07, 4, 12), () => new THREE.TorusGeometry(0.5, 0.07, 4, 12)),
          metal,
          root,
        ).rotation.x = Math.PI / 2;
      } else if (part.kind === "rocket") {
        root.position.set(part.x, -0.38, part.z);
        for (const x of [-0.17, 0.17])
          for (const y of [-0.12, 0.12])
            this.mesh(
              this.geometry(geometryKey("cylinder", 0.12, 0.12, 0.9, 6), () => new THREE.CylinderGeometry(0.12, 0.12, 0.9, 6)),
              metal,
              root,
              x,
              y,
              0,
            ).rotation.x = Math.PI / 2;
      } else {
        root.position.set(
          part.x,
          part.slot === "bottom" ? -0.4 : part.slot === "top" ? 0.5 : 0.08,
          part.z,
        );
        this.mesh(
          this.geometry(geometryKey("box", part.kind === "armor" ? 1.1 : 0.6,
            0.24,
            part.kind === "frame" ? 2.2 : 0.8), () => new THREE.BoxGeometry(
            part.kind === "armor" ? 1.1 : 0.6,
            0.24,
            part.kind === "frame" ? 2.2 : 0.8,
          )),
          mat,
          root,
        );
        if (["cooler", "frame", "armor"].includes(part.kind))
          for (let i = 0; i < 4; i++)
            this.mesh(
              this.geometry(geometryKey("box", 0.8, 0.12, 0.06), () => new THREE.BoxGeometry(0.8, 0.12, 0.06)),
              metal,
              root,
              0,
              0.18,
              (i - 1.5) * 0.16,
            );
      }
    }
    this.revision = "revision" in p ? p.revision : 0;
  }
  update(time: number, dt: number, highlight = "", display = false) {
    const p = this.actor;
    if ("revision" in p && p.revision !== this.revision) this.rebuild();
    for (const { mesh, part } of this.propellers)
      if (part.health > 0) mesh.rotation.z += dt * (display ? 19 : 14 + p.speed * 3);
    for (const part of p.parts) {
      const root = this.parts.get(part.id)!;
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
