import * as THREE from "three";
import { ContentCatalog, geometryKey } from "./ContentCatalog";

export class ShowroomBackdrop {
  readonly group = new THREE.Group();
  private readonly releases: (() => void)[] = [];

  constructor(private readonly catalog: ContentCatalog) {
    const floorMaterial = this.material("showroom:floor", () => new THREE.MeshStandardMaterial({
      color: "#172f31", roughness: .88, metalness: .08,
    }));
    const wallMaterial = this.material("showroom:wall", () => new THREE.MeshStandardMaterial({
      color: "#294b4b", roughness: .8, metalness: .12,
    }));
    const trimMaterial = this.material("showroom:trim", () => new THREE.MeshStandardMaterial({
      color: "#648b79", roughness: .55, metalness: .35,
    }));
    const lightMaterial = this.material("showroom:light", () => new THREE.MeshBasicMaterial({
      color: "#f5d993", toneMapped: false,
    }));
    const floor = this.mesh("box", [90, .7, 90], floorMaterial.value);
    floor.position.y = 8;
    this.group.add(floor);

    for (const [x, z, width, depth] of [
      [0, -42, 90, .6],
      [-45, 0, .6, 84],
      [45, 0, .6, 84],
    ] as const) {
      const wall = this.mesh("box", [width, 32, depth], wallMaterial.value);
      wall.position.set(x, 24, z);
      this.group.add(wall);
    }
    const ceiling = this.mesh("box", [90, .5, 90], wallMaterial.value);
    ceiling.position.y = 40.5;
    this.group.add(ceiling);

    for (const x of [-34, -17, 0, 17, 34]) {
      const beam = this.mesh("box", [2.2, .38, 78], trimMaterial.value);
      beam.position.set(x, 39, 0);
      this.group.add(beam);
      const strip = this.mesh("box", [1.1, .08, 42], lightMaterial.value);
      strip.position.set(x, 38.72, -2);
      this.group.add(strip);
    }

    const platform = this.geometry("platform", [10, 10, .35]);
    const platformMesh = new THREE.Mesh(platform.value, trimMaterial.value);
    platformMesh.position.y = 8.55;
    this.group.add(platformMesh);
    const ring = this.geometry("ring", [8.4, .08]);
    const ringMesh = new THREE.Mesh(ring.value, lightMaterial.value);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = 8.76;
    this.group.add(ringMesh);

    const fill = new THREE.PointLight("#f5d993", 18, 58, 1.6);
    fill.position.set(0, 35, 3);
    this.group.add(fill);
    const rim = new THREE.PointLight("#77c4ad", 10, 46, 1.8);
    rim.position.set(0, 19, -28);
    this.group.add(rim);
  }

  private material(id: string, create: () => THREE.Material) {
    const lease = this.catalog.material(id, create);
    this.releases.push(lease.release);
    return lease;
  }

  private geometry(kind: string, dimensions: number[]) {
    const key = geometryKey(`showroom:${kind}`, ...dimensions);
    const lease = this.catalog.geometry(key, () => {
      if (kind === "platform") return new THREE.CylinderGeometry(dimensions[0], dimensions[1], dimensions[2], 48);
      if (kind === "ring") return new THREE.TorusGeometry(dimensions[0], dimensions[1], 8, 64);
      return new THREE.BoxGeometry(dimensions[0], dimensions[1], dimensions[2]);
    });
    this.releases.push(lease.release);
    return lease;
  }

  private mesh(kind: string, dimensions: number[], material: THREE.Material) {
    const geometry = this.geometry(kind, dimensions);
    const mesh = new THREE.Mesh(geometry.value, material);
    return mesh;
  }

  setVisible(visible: boolean) {
    this.group.visible = visible;
  }

  update(x: number, z: number) {
    this.group.position.set(x, 0, z);
  }

  dispose() {
    this.group.removeFromParent();
    this.group.clear();
    for (const release of this.releases.splice(0)) release();
  }
}
