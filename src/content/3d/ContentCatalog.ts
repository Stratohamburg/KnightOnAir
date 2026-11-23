import type { BufferGeometry, Material, Texture } from "three";

type Resource = BufferGeometry | Material | Texture;

class ResourceCatalog<T extends Resource> {
  private readonly entries = new Map<string, { value: T; references: number }>();
  creations = 0;

  acquire<U extends T>(key: string, create: () => U) {
    let entry = this.entries.get(key);
    if (!entry) {
      entry = { value: create(), references: 0 };
      this.entries.set(key, entry);
      this.creations++;
    }
    entry.references++;
    const value = entry.value as U;
    let released = false;
    return {
      value,
      release: () => {
        if (released) return;
        released = true;
        if (--entry.references === 0) {
          this.entries.delete(key);
          value.dispose();
        }
      },
    };
  }

  get size() { return this.entries.size; }
}

export const geometryKey = (name: string, ...dimensions: number[]) => [name, ...dimensions].join("/");

export class ContentCatalog {
  private readonly geometries = new ResourceCatalog<BufferGeometry>();
  private readonly materials = new ResourceCatalog<Material>();
  private readonly textures = new ResourceCatalog<Texture>();

  geometry<T extends BufferGeometry>(id: string, create: () => T) { return this.geometries.acquire(id, create); }
  material<T extends Material>(id: string, create: () => T) { return this.materials.acquire(id, create); }
  texture<T extends Texture>(id: string, create: () => T) { return this.textures.acquire(id, create); }

  get stats() {
    return {
      geometries: this.geometries.size,
      materials: this.materials.size,
      textures: this.textures.size,
      creations: this.geometries.creations + this.materials.creations + this.textures.creations,
    };
  }
}
