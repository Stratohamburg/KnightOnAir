import * as THREE from "three";
import type { Player, Part, RuntimeWeapon } from "../simulation/types";
import { aircraftMaterial, effectMaterial } from "./ShaderMaterials";
import { clamp } from "../services/Random";

// Flat normals are generated from actual sections; no imported mesh or texture is used.
export function fuselageGeometry(length: number, width = 0.48) {
  const sections = [
    [-0.5, 0.22, 0.2],
    [-0.32, 0.75, 0.72],
    [-0.1, 1, 1],
    [0.15, 0.83, 0.92],
    [0.34, 0.46, 0.55],
    [0.5, 0.025, 0.05],
  ];
  const vertices: number[] = [];
  const point = (s: number[], a: number) => [
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
  const indices =
    side > 0
      ? [
          0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6,
          2, 1, 2, 6, 1, 6, 5, 0, 4, 7, 0, 7, 3,
        ]
      : [
          0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 5, 1, 0, 4, 5, 3, 6, 7, 3, 2,
          6, 1, 6, 2, 1, 5, 6, 0, 7, 4, 0, 3, 7,
        ];
  for (let i = 0; i < indices.length; i += 3)
    [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p.flat(), 3));
  g.setIndex(indices);
  const flat = g.toNonIndexed();
  flat.computeVertexNormals();
  g.dispose();
  return flat;
}
export class ProceduralAircraft {
  readonly group = new THREE.Group();
  private materials = new Map<string, THREE.ShaderMaterial>();
  private parts = new Map<string, THREE.Group>();
  private flames: { mesh: THREE.Mesh; part: Part }[] = [];
  private turretHeads = new Map<string, THREE.Group>();
  private flameMaterial = effectMaterial();
  revision = -1;
  private buildTime = 0;
  constructor(public player: Player) {
    this.rebuild();
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
    this.parts.clear();
    this.turretHeads.clear();
    const p = this.player,
      s = p.stats,
      f = p.frame;
    const trim = aircraftMaterial(f.accent, true),
      metal = aircraftMaterial("#46535a"),
      glass = aircraftMaterial("#29464b");
    this.materials.set("_trim", trim);
    this.materials.set("_metal", metal);
    this.materials.set("_glass", glass);
    for (const part of p.parts) {
      const root = new THREE.Group();
      root.name = part.id;
      this.group.add(root);
      this.parts.set(part.id, root);
      const mat = aircraftMaterial(f.color);
      this.materials.set(part.id, mat);
      const side = part.slot === "leftWing" ? -1 : 1;
      if (part.id === "core") {
        this.mesh(
          fuselageGeometry(s.length, f.engines === 4 ? 0.75 : 0.48),
          mat,
          root,
        );
        const cockpit = this.mesh(
          new THREE.SphereGeometry(0.45, 6, 4),
          glass,
          root,
          0,
          0.36,
          s.length * 0.11,
        );
        cockpit.scale.set(0.68, 0.75, 1.65);
        const stripe = this.mesh(
          new THREE.BoxGeometry(0.065, 0.025, s.length * 0.3),
          trim,
          root,
          0,
          0.43,
          -s.length * 0.12,
        );
        stripe.rotation.x = 0.05;
      } else if (part.id === "left_wing" || part.id === "right_wing") {
        root.position.set(side * 0.3, -0.02, 0.12);
        this.mesh(
          wingGeometry(
            s.wingspan / 2 - 0.3,
            side,
            f.length * 0.37,
            f.length * 0.13,
          ),
          mat,
          root,
        );
        this.mesh(
          wingGeometry(
            s.wingspan * 0.1,
            side,
            f.length * 0.17,
            f.length * 0.03,
            0.125,
          ),
          trim,
          root,
          side * s.wingspan * 0.36,
          0.01,
          -f.length * 0.1,
        );
        const insignia = this.mesh(
          new THREE.CylinderGeometry(0.2, 0.2, 0.025, 12),
          metal,
          root,
          side * s.wingspan * 0.27,
          0.14,
          -0.45,
        );
        this.mesh(
          new THREE.CylinderGeometry(0.105, 0.105, 0.029, 8),
          trim,
          insignia,
        );
      } else if (part.id === "tail") {
        root.position.z = -s.length * 0.34;
        for (const dir of [-1, 1]) {
          this.mesh(
            wingGeometry(s.wingspan * 0.2, dir, s.length * 0.19, 0.3, 0.08),
            mat,
            root,
          );
          const fin = this.mesh(
            wingGeometry(0.7, 1, 0.8, 0.35, 0.065),
            trim,
            root,
            dir * 0.4,
            0.1,
            -0.2,
          );
          fin.rotation.z = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        }
      } else if (part.kind === "engine") {
        root.position.set(part.x, -0.13, part.z);
        const engine = this.mesh(
          new THREE.CylinderGeometry(0.28, 0.34, 1.3, 8),
          mat,
          root,
        );
        engine.rotation.x = Math.PI / 2;
        const ring = this.mesh(
          new THREE.TorusGeometry(0.24, 0.065, 4, 10),
          metal,
          root,
          0,
          0,
          -0.7,
        );
        ring.rotation.x = 0;
        this.mesh(
          new THREE.CylinderGeometry(0.14, 0.16, 0.1, 8),
          metal,
          root,
          0,
          0,
          -0.74,
        ).rotation.x = Math.PI / 2;
        const flame = this.mesh(
          new THREE.PlaneGeometry(0.6, 2.5),
          this.flameMaterial,
          root,
          0,
          -0.06,
          -1.4,
        );
        flame.rotation.x = -Math.PI / 2;
        this.flames.push({ mesh: flame, part });
      } else if (part.kind === "turret") {
        root.position.set(part.x, 0.6, part.z);
        this.mesh(new THREE.CylinderGeometry(0.35, 0.43, 0.2, 8), metal, root);
        const head = new THREE.Group();
        root.add(head);
        this.turretHeads.set(part.id, head);
        this.mesh(new THREE.SphereGeometry(0.36, 6, 3), mat, head, 0, 0.15, 0);
        for (const x of [-0.15, 0.15])
          this.mesh(
            new THREE.BoxGeometry(0.09, 0.09, 0.8),
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
        root.position.set(part.x, 0.02, part.z);
        if (part.kind === "tailGun") root.rotation.y = Math.PI;
        for (const x of [-0.23, 0.23])
          this.mesh(
            new THREE.BoxGeometry(
              0.1,
              0.12,
              part.kind === "cannon" ? 1.5 : 0.85,
            ),
            metal,
            root,
            x,
            0,
            0.4,
          );
        if (part.id !== "nose")
          this.mesh(new THREE.BoxGeometry(0.5, 0.26, 0.5), mat, root);
      } else if (part.kind === "radar") {
        root.position.set(part.x, 0.3, part.z);
        this.mesh(new THREE.SphereGeometry(0.32, 6, 4), mat, root).scale.z =
          1.8;
        this.mesh(
          new THREE.TorusGeometry(0.4, 0.035, 4, 16),
          trim,
          root,
          0,
          0.16,
          0,
        ).rotation.x = Math.PI / 2;
      } else if (part.kind === "wing" || part.kind === "winglet") {
        root.position.set(part.x, 0.12, part.z);
        const mesh = this.mesh(
          wingGeometry(part.kind === "wing" ? 1.2 : 0.4, side, 1, 0.4),
          mat,
          root,
        );
        if (part.kind === "winglet") mesh.rotation.z = side * 0.35;
      } else if (part.kind === "reactor") {
        root.position.set(0, 0.5, -0.45);
        this.mesh(new THREE.SphereGeometry(0.35, 8, 5), trim, root);
        this.mesh(
          new THREE.TorusGeometry(0.5, 0.07, 4, 12),
          metal,
          root,
        ).rotation.x = Math.PI / 2;
      } else if (part.kind === "rocket") {
        root.position.set(part.x, -0.38, part.z);
        for (const x of [-0.17, 0.17])
          for (const y of [-0.12, 0.12])
            this.mesh(
              new THREE.CylinderGeometry(0.12, 0.12, 0.9, 6),
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
          new THREE.BoxGeometry(
            part.kind === "armor" ? 1.1 : 0.6,
            0.24,
            part.kind === "frame" ? 2.2 : 0.8,
          ),
          mat,
          root,
        );
        if (["cooler", "frame", "armor"].includes(part.kind))
          for (let i = 0; i < 4; i++)
            this.mesh(
              new THREE.BoxGeometry(0.8, 0.12, 0.06),
              metal,
              root,
              0,
              0.18,
              (i - 1.5) * 0.16,
            );
      }
    }
    this.revision = p.revision;
    this.buildTime = 0;
  }
  update(time: number, dt: number, highlight = "", display = false) {
    const p = this.player;
    if (p.revision !== this.revision) this.rebuild();
    this.buildTime += dt;
    for (const part of p.parts) {
      const root = this.parts.get(part.id)!;
      root.visible = !part.destroyed;
      const mat = this.materials.get(part.id)!;
      mat.uniforms.time.value = time;
      mat.uniforms.damage.value = 1 - part.health / part.maxHealth;
      mat.uniforms.heat.value = Math.max(
        p.hitFlash * 0.65,
        part.health < part.maxHealth * 0.3 ? 0.3 : 0,
      );
      mat.uniforms.highlight.value =
        highlight === part.slot ||
        (highlight === "engines" && part.kind === "engine")
          ? 1
          : 0;
      if (
        part.id.includes("_") &&
        !["left_wing", "right_wing"].includes(part.id)
      )
        root.scale.setScalar(Math.min(1, 0.6 + this.buildTime * 1.1));
    }
    for (const { mesh, part } of this.flames) {
      mesh.visible = part.health > 0;
      mesh.scale.y =
        (display ? 0.7 : 0.3 + (p.speed / p.stats.maxSpeed) * 0.7) *
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
    this.group.position.y = 4 + Math.sin(time * 3) * (display ? 0.08 : 0.025);
    this.group.scale.setScalar(clamp(this.buildTime * 2.5, 0.05, 1));
  }
  private disposeContents() {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    this.group.clear();
    for (const mat of this.materials.values()) mat.dispose();
    this.materials.clear();
  }
  dispose() {
    this.disposeContents();
    this.flameMaterial.dispose();
  }
}
