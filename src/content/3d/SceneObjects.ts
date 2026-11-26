import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Enemy } from "../../simulation/types";
import { combatantById } from "../../data/combatants";
import { RULES } from "../../data/config";
import { aircraftMaterial, projectileMaterial } from "../../rendering/ShaderMaterials";
import { fuselageGeometry } from "./AircraftFactory";
import { ContentCatalog } from "./ContentCatalog";

export interface SceneActor {
  group: THREE.Group;
  cloudContactSites?: readonly THREE.Vector3[];
  dispose(): void;
}

export function createSurfaceActor(e: Enemy, catalog: ContentCatalog): SceneActor {
  const group = new THREE.Group();
  const config = combatantById(e.configId ?? e.kind);
  const paint = catalog.material(`surface:${config.id}`, () => aircraftMaterial(config.visual.color));
  const trim = catalog.material("surface:trim", () => new THREE.MeshStandardMaterial({ color: "#3b4c43", flatShading: true }));
  const cargo = catalog.material("surface:cargo", () => new THREE.MeshStandardMaterial({ color: "#e5c480", emissive: "#5b4926" }));
  const material = paint.value;
  const dark = trim.value;
  const model = catalog.geometry(`surface:${config.id}`, () => {
    const meshes: THREE.Mesh[] = [];
    const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      meshes.push(mesh);
      return mesh;
    };
    if (e.layer === "water") {
      const length = e.radius * 2.65;
      add(fuselageGeometry(length, e.radius * .52), material, 0, .19);
      add(new THREE.BoxGeometry(e.radius * .67, .32, length * .37), dark, 0, .54, -.3);
      if (e.weapons.length)
        add(new THREE.BoxGeometry(.13, .13, length * .25), material, 0, .65, length * .24);
    } else if (config.capabilities.routeKinds.includes("rail")) {
      for (let car = -1; car <= 1; car++) {
        add(new THREE.BoxGeometry(e.radius * .78, .75, 1.75), material, 0, .55, car * 1.89);
        add(new THREE.BoxGeometry(e.radius * .6, .31, 1.52), dark, 0, .17, car * 1.89);
      }
    } else {
      add(
        new THREE.BoxGeometry(
          e.radius * 1.7,
          0.6,
          e.kind === "depot" ? 2.8 : 1.8,
        ),
        material,
        0,
        0.3,
      );
      if (e.kind === "aa_truck") {
        add(new THREE.CylinderGeometry(0.4, 0.6, 0.3, 8), dark, 0, 0.7);
        const barrel = add(
          new THREE.BoxGeometry(0.16, 0.16, 1.5),
          material,
          0,
          0.9,
          0.65,
        );
        barrel.rotation.x = -0.3;
      } else if (e.kind === "depot") {
        for (const x of [-0.6, 0.6])
          add(new THREE.CylinderGeometry(0.55, 0.55, 1.6, 8), material, x, 1.1);
      } else {
        for (const x of [-0.65, 0.65])
          for (const z of [-0.55, 0.55])
            add(new THREE.BoxGeometry(0.2, 0.4, 0.45), dark, x, 0.15, z);
        add(
          new THREE.BoxGeometry(0.9, 0.5, 0.7),
          e.kind === "resource" ? cargo.value : material,
          0,
          0.8,
          0,
        );
      }
    }

    const materials = [material, dark, cargo.value];
    const geometries = meshes.map((mesh) => {
      mesh.updateMatrix();
      const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
      if (geometry !== mesh.geometry) mesh.geometry.dispose();
      geometry.applyMatrix4(mesh.matrix);
      for (const attribute of Object.keys(geometry.attributes)) {
        if (attribute !== "position" && attribute !== "normal") geometry.deleteAttribute(attribute);
      }
      return { geometry, material: materials.indexOf(mesh.material as typeof material) };
    }).sort((a, b) => a.material - b.material);
    const merged = mergeGeometries(geometries.map(({ geometry }) => geometry), true)!;
    merged.groups.forEach((group, index) => { group.materialIndex = geometries[index].material; });
    for (const { geometry } of geometries) geometry.dispose();
    return merged;
  });
  group.add(new THREE.Mesh(model.value, [material, dark, cargo.value]));
  if (!model.value.boundingBox) model.value.computeBoundingBox();
  const hull = model.value.boundingBox!;
  const center = hull.getCenter(new THREE.Vector3());
  const roof = (center.y + hull.max.y) * .5;
  return {
    group,
    cloudContactSites: config.frame.maxSpeed > 0 ? [
      new THREE.Vector3(center.x, roof, (hull.min.z + center.z) * .5),
      new THREE.Vector3(center.x, roof, (hull.max.z + center.z) * .5),
      new THREE.Vector3(center.x, roof, center.z),
    ] : [],
    dispose() {
      group.removeFromParent();
      group.clear();
      model.release();
      paint.release();
      trim.release();
      cargo.release();
    },
  };
}

export function createProjectileBatches(catalog: ContentCatalog) {
  const geometry = catalog.geometry("projectile:tracer", () => new THREE.CylinderGeometry(.06, .06, .8, 4).rotateX(Math.PI / 2));
  const materials = ["#ffe5a1", "#f98769", "#c6f4d4", "#ff9c7d"].map((color) =>
    catalog.material(`projectile:${color}`, () => projectileMaterial(color)),
  );
  const batches = materials.map(({ value }) => {
    const batch = new THREE.InstancedMesh(geometry.value, value, RULES.maxProjectiles);
    batch.count = 0;
    batch.frustumCulled = false;
    batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    return batch;
  });
  return {
    batches,
    dispose() {
      for (const batch of batches) {
        batch.removeFromParent();
        batch.dispose();
      }
      for (const material of materials) material.release();
      geometry.release();
    },
  };
}

export function createBombs(catalog: ContentCatalog, count: number) {
  const geometry = catalog.geometry("bomb:body", () => new THREE.SphereGeometry(.18, 6, 4));
  const material = catalog.material("bomb:paint", () => new THREE.MeshStandardMaterial({ color: "#3b4540" }));
  const meshes = Array.from({ length: count }, () => {
    const bomb = new THREE.Mesh(geometry.value, material.value);
    bomb.scale.set(1, 1.8, 1);
    bomb.visible = false;
    return bomb;
  });
  return {
    meshes,
    dispose() {
      for (const bomb of meshes) bomb.removeFromParent();
      geometry.release();
      material.release();
    },
  };
}
