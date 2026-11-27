import {
  BufferGeometry, Float32BufferAttribute, Group, Matrix4, Mesh, ShaderMaterial, Vector3, Vector4, type ColorRepresentation,
} from "three";
import { ContentCatalog } from "./ContentCatalog";
import { aircraftMaterial } from "../../rendering/ShaderMaterials";

type Piece = Mesh<BufferGeometry, ShaderMaterial>;
// Nine vertex uniform vectors per piece, with room for the scene uniforms.
const MAX_PIECES_PER_BATCH = 24;

/** Keep the assembly graph for articulated effect sites and damage surfaces while
 * submitting the visible NPC skin in bounded draws. Vertex positions remain mesh-local. */
export class NpcAircraftBatch {
  readonly mesh: Mesh<BufferGeometry, ShaderMaterial>;
  private readonly transforms: Matrix4[];
  private readonly states: Vector4[];
  private readonly inverse = new Matrix4();
  private readonly release: () => void;

  private constructor(private readonly root: Group, private readonly pieces: Piece[], catalog: ContentCatalog) {
    const rootIsMirrored = root.matrixWorld.determinant() < 0;
    const mirrored = pieces.map(piece => (piece.matrixWorld.determinant() < 0) !== rootIsMirrored);
    // Roles with the same authored pieces can share the joined vertex buffers.
    const key = pieces.map((piece, index) => piece.geometry.uuid + (mirrored[index] ? "-" : "+")).join("/");
    const geometry = catalog.geometry("npc-effect-skin/" + key, () => {
      const positions: number[] = [], normals: number[] = [], ids: number[] = [], indices: number[] = [];
      pieces.forEach((piece,id) => {
        const source = piece.geometry;
        const p = source.getAttribute("position"), n = source.getAttribute("normal");
        const offset = ids.length;
        for (let i = 0; i < p.count; i++) {
          positions.push(p.getX(i),p.getY(i),p.getZ(i));
          normals.push(n.getX(i),n.getY(i),n.getZ(i));
          ids.push(id);
        }
        const index = source.getIndex();
        const vertex = (i: number) => offset + (index?.getX(i) ?? i);
        const reverse = mirrored[id];
        for (let i = 0; i < (index?.count ?? p.count); i += 3)
          indices.push(vertex(i), vertex(i + (reverse ? 2 : 1)), vertex(i + (reverse ? 1 : 2)));
      });
      const joined = new BufferGeometry();
      joined.setIndex(indices);
      joined.setAttribute("position",new Float32BufferAttribute(positions,3));
      joined.setAttribute("normal",new Float32BufferAttribute(normals,3));
      joined.setAttribute("pieceId",new Float32BufferAttribute(ids,1));
      return joined;
    });
    this.release = geometry.release;
    this.transforms = pieces.map(() => new Matrix4());
    this.states = pieces.map(() => new Vector4());
    const material = aircraftMaterial("#ffffff");
    material.defines = { AIRCRAFT_PIECES: pieces.length };
    material.uniforms.pieceTransform = {value:this.transforms};
    material.uniforms.pieceState = {value:this.states};
    material.uniforms.pieceFinish = {value:pieces.map(({material:m}) => {
      const color = m.uniforms.baseColor.value;
      return new Vector4(color.r,color.g,color.b,m.uniforms.accent.value);
    })};
    material.uniforms.pieceLivery = {value:pieces.map(({material:m}) => {
      const color = m.uniforms.liverySecondary.value;
      return new Vector4(color.r,color.g,color.b,m.uniforms.liveryEnabled.value);
    })};
    material.uniforms.pieceTrim = {value:pieces.map(({material:m}) => {
      const color = m.uniforms.liveryTrim.value;
      return new Vector3(color.r,color.g,color.b);
    })};
    material.uniforms.piecePattern = {value:pieces.map(({material:m}) =>
      new Vector4(m.uniforms.liveryPattern.value, m.uniforms.liveryStripeCenter.value,
        m.uniforms.liveryStripeWidth.value, m.uniforms.liveryPanelContrast.value))};
    this.mesh = new Mesh(geometry.value,material);
    this.mesh.name = "npc-aircraft-skin";
    // The actor-level frustum check covers the transformed local positions.
    this.mesh.frustumCulled = false;
    for (const piece of pieces) piece.layers.disable(0);
    root.add(this.mesh);
  }
  static create(root: Group, catalog: ContentCatalog) {
    const pieces: Piece[] = [];
    root.traverse(node => {
      if (node instanceof Mesh && node.material instanceof ShaderMaterial && node.material.uniforms.baseColor) {
        pieces.push(node as Piece);
      }
    });
    root.updateWorldMatrix(true, true);
    const batches: NpcAircraftBatch[] = [];
    for (let index = 0; index < pieces.length; index += MAX_PIECES_PER_BATCH) {
      const batch = new NpcAircraftBatch(root, pieces.slice(index, index + MAX_PIECES_PER_BATCH), catalog);
      batch.update(0);
      batches.push(batch);
    }
    return batches;
  }
  update(time: number) {
    this.inverse.copy(this.root.matrixWorld).invert();
    this.pieces.forEach((piece,i) => {
      this.transforms[i].multiplyMatrices(this.inverse,piece.matrixWorld);
      let visible = piece.visible;
      for (let parent = piece.parent; parent && parent !== this.root; parent = parent.parent) visible &&= parent.visible;
      const u = piece.material.uniforms;
      this.states[i].set(u.damage.value,u.heat.value,u.highlight.value,visible ? 1 : 0);
    });
    const uniforms = this.mesh.material.uniforms;
    uniforms.time.value = time;
    uniforms.cloudVeil.value = this.pieces[0].material.uniforms.cloudVeil.value;
    uniforms.cloudTint.value.copy(this.pieces[0].material.uniforms.cloudTint.value);
  }
  setCloudAtmosphere(veil: number, tint: ColorRepresentation) {
    this.mesh.material.uniforms.cloudVeil.value = veil;
    this.mesh.material.uniforms.cloudTint.value.set(tint);
  }
  setCloudShadows(uniforms: ShaderMaterial["uniforms"]) {
    for (const name of ["cloudShadowMap", "cloudShadowCenter", "cloudShadowStrength", "cloudShadowSun"])
      if (uniforms[name]) this.mesh.material.uniforms[name] = uniforms[name];
  }
  setQualityDetail(detail: number) {
    this.mesh.material.uniforms.liveryDetail.value = detail;
  }
  dispose() {
    this.mesh.removeFromParent();
    this.release();
    this.mesh.material.dispose();
  }
}
