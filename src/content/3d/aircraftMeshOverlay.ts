import { Mesh, Vector3 } from "three";
import { ProceduralAircraft, type ReferenceAircraft } from "./AircraftFactory";
import type { AircraftTraceStudy } from "../../data/aircraft-references/types";

// Each panel is independently registered in source pixels. Photographs and
// perspective sketches deliberately have no orthographic registration.
export type OverlayPanel = Pick<AircraftTraceStudy["panels"][number], "crop" | "projection">;
export function addMeshOverlays(host: HTMLElement, panels: readonly OverlayPanel[], actor: ReferenceAircraft) {
  const model = new ProceduralAircraft(actor);
  try {
    if (model.contentError) throw new Error(model.contentError);
    model.group.updateMatrixWorld(true);
    const figures = host.querySelectorAll<SVGSVGElement>("figure > svg");
    for (const [i, panel] of panels.entries()) {
      if (!panel.projection) continue;
      const { origin, view, scale, angle = 0 } = panel.projection;
      const [cx, cy, w, h] = panel.crop;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      const rotation = (angle * Math.PI) / 180,
        cos = Math.cos(rotation),
        sin = Math.sin(rotation);
      ctx.setTransform(scale * cos, scale * sin, -scale * sin, scale * cos, origin[0] - cx, origin[1] - cy);
      const v = new Vector3();
      model.group.traverse((node) => {
        if (!(node instanceof Mesh)) return;
        const positions = node.geometry.getAttribute("position"),
          indices = node.geometry.index;
        const count = indices?.count ?? positions.count;
        ctx.beginPath();
        // Fill visible triangle coverage in a single winding direction to avoid
        // cancellation where front and rear faces overlap in the projection.
        for (let t = 0; t < count; t += 3) {
          const points = [];
          for (let j = t; j < t + 3; j++) {
            v.fromBufferAttribute(positions, indices ? indices.getX(j) : j).applyMatrix4(node.matrixWorld);
            const u = view === "side" ? -v.z : view === "front" ? v.x : -v.x;
            points.push([u, view === "top" ? -v.z : -v.y]);
          }
          const [a, b, c] = points;
          if ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) <= 0) continue;
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
          ctx.lineTo(c[0], c[1]);
          ctx.closePath();
        }
        ctx.fillStyle = node.name === "rigging" ? "#143c64" : "#1668c4";
        ctx.fill();
      });
      const image = document.createElementNS("http://www.w3.org/2000/svg", "image");
      image.setAttribute("class", "trace-mesh");
      for (const [key, num] of Object.entries({ x: cx, y: cy, width: w, height: h }))
        image.setAttribute(key, String(num));
      image.setAttribute("opacity", ".46");
      image.setAttribute("href", canvas.toDataURL());
      const svg = figures[i];
      const original = [...svg.children].find(layer => layer.tagName === "image" || layer.querySelector("image"));
      original?.after(image);
    }
  } finally {
    model.dispose();
  }
}
