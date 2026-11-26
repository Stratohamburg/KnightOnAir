import { Box3, Vector3 } from "three";
import { ProceduralAircraft, type ReferenceAircraft } from "./AircraftFactory";

/** Render the current installation with its neutral pose. The archive reads the same
 * source coordinates as the effects system, including articulated mesh transforms. */
export function aircraftEffectPlate(actor: ReferenceAircraft) {
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = "特效挂点与可损蒙皮 · 三视图";
  details.append(summary);
  details.addEventListener("toggle", () => {
    if (!details.open || details.childElementCount > 1) return;
    const model = new ProceduralAircraft(actor);
    try {
      model.group.updateMatrixWorld(true);
      const extent = new Box3().setFromObject(model.group);
      const center = extent.getCenter(new Vector3());
      const span = extent.getSize(new Vector3());
      const scale = 208 / Math.max(span.x, span.y, span.z, 1);
      const sites = model.effectSites.sources;
      const point = new Vector3();
      for (const view of ["俯视", "正视", "侧视"]) {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 240;
        canvas.style.maxWidth = "100%";
        canvas.setAttribute("aria-label", view);
        const ctx = canvas.getContext("2d")!;
        const project = (v: Vector3) => {
          const x = view === "侧视" ? -v.z + center.z : v.x - center.x;
          const y = view === "俯视" ? -v.z + center.z : -v.y + center.y;
          return [120 + x * scale, 120 + y * scale] as const;
        };
        ctx.fillStyle = "#edf3f4";
        ctx.fillRect(0, 0, 240, 240);
        ctx.fillStyle = "#687d86";
        for (const {mesh} of model.effectSites.surfaces) {
          const positions = mesh.geometry.getAttribute("position"), indices = mesh.geometry.index;
          ctx.beginPath();
          for (let i = 0; i < (indices?.count ?? positions.count); i += 3) {
            for (let j = 0; j < 3; j++) {
              point.fromBufferAttribute(positions, indices?.getX(i + j) ?? i + j).applyMatrix4(mesh.matrixWorld);
              const xy = project(point);
              if (j === 0) ctx.moveTo(...xy);
              else ctx.lineTo(...xy);
            }
            ctx.closePath();
          }
          ctx.strokeStyle = "#9dabad";
          ctx.lineWidth = .4;
          ctx.stroke();
        }
        ctx.fillStyle = "#852d16";
        sites.forEach((site, i) => {
          const [x,y] = project(point.fromArray(site.position).applyMatrix4(site.node.matrixWorld));
          ctx.fillRect(x-1, y-1, 3, 3);
          ctx.fillText(String(i+1), x+2, y-2);
        });
        ctx.fillText(view, 6, 13);
        details.append(canvas);
      }
      const list = document.createElement("ol");
      for (const site of sites) {
        const row = document.createElement("li");
        row.textContent = [site.id, site.kind, "节点局部 " + site.position.map(n => n.toFixed(2)).join(", "),
          "方向 " + site.direction.map(n => n.toFixed(2)).join(", "), "强度 " + site.strength,
          site.basis === "configuredFallback" ? "配置近似点" : ""].filter(Boolean).join(" · ");
        list.append(row);
      }
      details.append(list);
    } finally { model.dispose(); }
  });
  return details;
}
