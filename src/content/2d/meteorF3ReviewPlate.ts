import {
  meteorF3Drawing, meteorF3Locators, meteorF3PairedLandmarks,
  meteorF3RegisteredPoint, meteorF3ReviewContours, meteorF3ReviewDatums, meteorF3SymmetryTolerance, meteorF3Views,
  type MeteorF3View,
} from "../../data/meteorF3Sheet";

import { meteorUnit } from "../../data/meteorF3ModelSheet";
import type { OverlayPanel } from "../3d/aircraftMeshOverlay";

const views = ["front", "side", "plan"] as const;
const regions = [
  {label: "机身", match: /机身/, color: "#206477"},
  {label: "座舱罩", match: /座舱罩/, color: "#78528d"},
  {label: "主翼", match: /主翼|内翼|外翼/, color: "#536d37"},
  {label: "短舱与唇口", match: /短舱|唇口/, color: "#a4472c"},
  {label: "进气开口", match: /开口/, color: "#27495c"},
  {label: "平尾", match: /水平尾翼/, color: "#366c67"},
  {label: "垂尾", match: /垂尾/, color: "#875c36"},
];
export const meteorOverlayPanels = views.map((key): OverlayPanel => ({
  crop: [...meteorF3Views[key].bounds],
  projection: {view: key === "plan" ? "top" : key, scale: 1 / meteorUnit,
    origin: [key === "side" ? 150.5 : 0, key === "plan" ? 150.5 : 0]},
}));
const precision = (value: number) => value.toFixed(1);

// The inlet and outlet are visible in both source panels. Project each reading
// into both views without forcing the endpoints of either trace to move.
function stationOverlay(view: MeteorF3View) {
  if (view === "front") return "";
  const side = [[248, 325], [364, 335]] as const;
  const plan = meteorF3Locators.plan.find(locator => locator.contour === "左短舱")!.marks!;
  const ends = [
    { label: "侧视", color: "#9b421e", stations: side.map(point => meteorF3RegisteredPoint("side", point)[0]) },
    { label: "俯视", color: "#156680", stations: plan.map(mark => mark.point[1]) },
  ];
  return `<g class="meteor-stations" fill="none" stroke-width="1.2" stroke-dasharray="3 2">
    ${ends.flatMap(({ label, color, stations }) => stations.map((s, index) => {
      const d = view === "side" ? `M${s} -24v48` : `M-77 ${s}h43 M34 ${s}h43`;
      return `<path stroke="${color}" d="${d}"><title>${label} · ${index ? "后端" : "前端"} ${precision(s)}</title></path>`;
    })).join("")}</g>`;
}

function nacelleSections() {
  const plan = meteorF3ReviewContours.plan.find(edge => edge.name === "左短舱")!;
  const side = meteorF3ReviewContours.side.find(edge => edge.name === "短舱外轮廓可见段")!;
  function crossings(points: typeof side.points, axis: 0 | 1, station: number) {
    return points.slice(1).flatMap((b, i) => {
      const a = points[i];
      if (station < Math.min(a[axis], b[axis]) || station >= Math.max(a[axis], b[axis])) return [];
      const t = (station - a[axis]) / (b[axis] - a[axis]);
      const other = axis === 0 ? 1 : 0;
      return [a[other] + t * (b[other] - a[other])];
    }).sort((a, b) => a - b);
  }
  const rows = [85, 100, 120, 145, 165].map(station => {
    const lateral = crossings([...plan.points, plan.points[0]], 1, station);
    const vertical = crossings(side.points, 0, station);
    const span = (values: number[]) => values.length >= 2 ? precision(values.at(-1)! - values[0]) : "遮挡";
    return `<tr><th scope="row">${station}</th><td>${span(lateral)}</td><td>${span(vertical)}</td></tr>`;
  }).join("");
  return `<details class="meteor-symmetry"><summary>短舱同站位截面 · 俯视宽度与侧视高度</summary>
    <p>每行在两个视图中取同一距机鼻站位，单位为图板像素。侧视只计可见轮廓的交点。截面外接宽高能限定壳体包络，圆角和翼舱接缝仍待核对。</p>
    <table><thead><tr><th>站位</th><th>俯视宽</th><th>侧视高</th></tr></thead><tbody>${rows}</tbody></table></details>`;
}

function renderLocators(view: MeteorF3View) {
  return meteorF3Locators[view].map(locator => {
    const { points } = meteorF3ReviewContours[view].find(({ name }) => name === locator.contour)!;
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    const padding = 2;
    const x = Math.min(...xs) - padding;
    const y = Math.min(...ys) - padding;
    const width = Math.max(...xs) - x + padding;
    const height = Math.max(...ys) - y + padding;
    const marks = locator.marks?.map(({ name, point: [mx, my] }) =>
      `<circle cx="${precision(mx)}" cy="${precision(my)}" r="2.8"><title>${name}</title></circle>`).join("") ?? "";
    const [labelX, labelY] = locator.labelAt;
    return `<g class="meteor-locator${locator.engine ? " meteor-locator-engine" : ""}">
      <rect x="${precision(x)}" y="${precision(y)}" width="${precision(width)}" height="${precision(height)}" rx="2"/>
      ${marks}<text x="${labelX}" y="${labelY}">${locator.label}</text>
    </g>`;
  }).join("");
}

function renderSymmetryCheck() {
  const comparisons = (["front", "plan"] as const).flatMap(view => meteorF3PairedLandmarks[view].map(landmark => {
    const [lx, ly] = meteorF3RegisteredPoint(view, landmark.points[0]);
    const [rx, ry] = meteorF3RegisteredPoint(view, landmark.points[1]);
    return {
      view: view === "front" ? "正视" : "俯视",
      name: landmark.name,
      left: `${precision(lx)} / ${precision(ly)}`,
      right: `${precision(rx)} / ${precision(ry)}`,
      lateralDiff: Math.abs(lx + rx),
      otherDiff: Math.abs(ly - ry),
    };
  }));
  const tolerance = meteorF3SymmetryTolerance;
  const maxDiff = Math.max(...comparisons.map(row => Math.max(row.lateralDiff, row.otherDiff)));
  const result = maxDiff <= tolerance ? "测点在容差内" : "测点超差待复核";
  const rows = comparisons.map(row => `<tr>
    <th scope="row"><small>${row.view}</small>${row.name}</th>
    <td>${row.left}</td><td>${row.right}</td>
    <td>${precision(row.lateralDiff)} / ${precision(row.otherDiff)}</td>
  </tr>`).join("");
  return `<details class="meteor-symmetry">
    <summary>原始描线左右校验 · ${result}（最大差 ${precision(maxDiff)} / 容差 ${tolerance}）</summary>
    <p>下表为镜像校正前的读数。正视为横向和向下高度，俯视为横向和距机鼻站位。每单位相当于俯视图的 1 像素。</p>
    <div class="meteor-symmetry-scroll"><table>
      <thead><tr><th scope="col">测点</th><th scope="col">左侧</th><th scope="col">右侧</th><th scope="col">两轴差值</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </details>`;
}

function renderContours(contours: typeof meteorF3ReviewContours[MeteorF3View], corrected = false) {
  return contours.map(({ name, points, closed }) => {
    const coordinates = points.map(point => point.map(value => value.toFixed(3)).join(",")).join(" L ");
    const region = corrected && regions.find(({match}) => match.test(name));
    const color = region ? `stroke="${region.color}" fill="${closed ? region.color : "none"}" fill-opacity=".16"` : "";
    return `<path ${color} d="M ${coordinates}${closed ? " Z" : ""}"><title>${name}</title></path>`;
  }).join("");
}

export function meteorF3ReviewPlate(blockedReason?: string) {
  const panels = views.map(key => {
    const view = meteorF3Views[key];
    const rawContours = key === "side" ? "" : renderContours(view.contour);
    const datum = meteorF3ReviewDatums[key];
    const crop = view.sourceCrop.map(point => point.join(",")).join(" ");
    const transform = `matrix(${view.sourceTransform.join(" ")})`;
    return `<figure class="reference-feature-view">
      <figcaption>${view.title}</figcaption>
      <svg role="img" aria-label="${view.title}" viewBox="${view.bounds.join(" ")}">
        <defs><clipPath id="meteor-source-${key}"><polygon points="${crop}"/></clipPath></defs>
        <g transform="${transform}">
          <image href="${meteorF3Drawing.src}" width="${meteorF3Drawing.width}" height="${meteorF3Drawing.height}"
            clip-path="url(#meteor-source-${key})"/>
          <g class="meteor-raw-contours">${rawContours}</g>
        </g>
        <g class="meteor-contours">${renderContours(meteorF3ReviewContours[key], true)}</g>
        <path class="meteor-datum" d="${datum}"/>
        ${stationOverlay(key)}
        <g class="meteor-locators">${renderLocators(key)}</g>
      </svg>
    </figure>`;
  }).join("");
  return `<div class="reference-feature-plate meteor-plate">
    <div class="reference-feature-heading"><strong>流星 F.3 三视图</strong></div>
    <div class="meteor-controls" role="group" aria-label="图板图层">
      <label><input type="checkbox" data-meteor-layer="source"> 叠合参考原图</label>
      <label><input type="checkbox" data-meteor-layer="locators" checked> 部件定位</label>
      <label><input type="checkbox" data-meteor-layer="raw"> 对照原始描线</label>
      <label><input type="checkbox" data-meteor-layer="stations"> 对照短舱前后站位</label>
      ${blockedReason ? "" : '<label><input type="checkbox" class="mesh-toggle"> 叠加模型投影</label>'}
    </div>
    <div class="meteor-views">${panels}</div>
    <div class="fighter-region-key">${regions.map(({label,color}) => `<span><i style="background:${color}"></i>${label}</span>`).join("")}</div>
    <div class="meteor-legend">彩线为校正轮廓，紫色虚线为原始描线。圆点标出进气口中心、短舱端点和翼尖。校验模型采用俯视短舱站位 77–173。</div>
    ${renderSymmetryCheck()}
    <p class="meteor-legend meteor-stations">橙线为侧视读数 64.4–179.2，蓝线为俯视读数 77–173。两组线均从同一机鼻基准投影。补充 F Mk.III 图的前端约为 73，短舱批次待核。</p>
    ${nacelleSections()}
    ${blockedReason ? `<p class="reference-feature-blocked-note">已认可镜像轮廓。${blockedReason}。</p>` : ""}
  </div>`;
}
