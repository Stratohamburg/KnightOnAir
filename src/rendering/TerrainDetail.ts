import * as THREE from "three";
import { Random, clamp, lerp } from "../services/Random";

const size = 256;

function tiledNoise(cells: number, random: Random) {
  const grid = Float32Array.from({ length: cells * cells }, () => random.next());
  return (x: number, y: number) => {
    const ix = Math.floor(x * cells), iy = Math.floor(y * cells);
    const fx = x * cells - ix, fy = y * cells - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const at = (cx: number, cy: number) => grid[((cy % cells + cells) % cells) * cells + (cx % cells + cells) % cells];
    return lerp(lerp(at(ix, iy), at(ix + 1, iy), sx), lerp(at(ix, iy + 1), at(ix + 1, iy + 1), sx), sy);
  };
}

// Pack three seamless material masks plus a broad region mask into one mipmapped lookup.
export function createTerrainDetail() {
  const random = new Random(491);
  const coarse = tiledNoise(11, random);
  const clusters = tiledNoise(27, random);
  const grain = tiledNoise(99, random);
  const data = new Uint8Array(size * size * 4);
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const x = col / size, y = row / size;
      const patch = coarse(x, y);
      const grit = grain(x, y);
      const blades = clusters(x * 2, y + .17 * Math.sin(x * Math.PI * 2));
      const rock = clusters(x + .18 * patch, y * 2);
      const strata = 1 - Math.abs(Math.sin((y * 14 + x * 2 + patch * 1.4) * Math.PI));
      const offset = (row * size + col) * 4;
      data[offset] = Math.round(clamp(.13 + .71 * blades + .17 * grit + .18 * patch) * 255);
      data[offset + 1] = Math.round(clamp(.24 + .42 * patch + .24 * rock + .26 * strata ** 4) * 255);
      data[offset + 2] = Math.round(clamp(.22 + .52 * grit + .26 * clusters(y, x)) * 255);
      data[offset + 3] = Math.round(clamp(.18 + .76 * patch + .12 * strata) * 255);
    }
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
