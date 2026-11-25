import * as THREE from "three";

export type Vertex = [number, number, number];

export function loft(rings: Vertex[][], capStart = true, capEnd = true, trailingSeam?: number) {
  const vertices = rings.flat();
  const sides = rings[0].length;
  const indices: number[] = [];
  for (let row = 0; row < rings.length - 1; row++) {
    for (let i = 0; i < sides; i++) {
      if (i === trailingSeam) continue;
      const a = row * sides + i;
      const b = row * sides + (i + 1) % sides;
      indices.push(a, a + sides, b, b, a + sides, b + sides);
    }
  }
  function cap(ring: Vertex[], reverse: boolean) {
    const offset = vertices.length;
    vertices.push(...ring);
    for (let i = 1; i < sides - 1; i++) {
      indices.push(offset, offset + (reverse ? i + 1 : i), offset + (reverse ? i : i + 1));
    }
  }
  if (capStart) cap(rings[0], false);
  if (capEnd) cap(rings[rings.length - 1], true);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices.flat(), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
