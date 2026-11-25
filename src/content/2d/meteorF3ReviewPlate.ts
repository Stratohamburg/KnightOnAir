import {
  meteorF3Drawing, meteorF3Locators, meteorF3PairedLandmarks,
  meteorF3RegisteredPoint, meteorF3ReviewContours, meteorF3ReviewDatums, meteorF3SymmetryTolerance, meteorF3Views,
  type MeteorF3View,
} from "../../data/meteorF3Sheet";

const views = ["front", "side", "plan"] as const;
const precision = (value: number) => value.toFixed(1);

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

function renderContours(contours: typeof meteorF3ReviewContours[MeteorF3View]) {
  return contours.map(({ name, points, closed }) => {
    const coordinates = points.map(point => point.map(value => value.toFixed(3)).join(",")).join(" L ");
    return `<path d="M ${coordinates}${closed ? " Z" : ""}"><title>${name}</title></path>`;
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
        <g class="meteor-contours">${renderContours(meteorF3ReviewContours[key])}</g>
        <path class="meteor-datum" d="${datum}"/>
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
    </div>
    <div class="meteor-views">${panels}</div>
    <div class="meteor-legend">红线为校正后的轮廓，紫色虚线为原始描线。圆点标出进气口中心、短舱端点和翼尖。俯视短舱站位为 77–173。</div>
    ${renderSymmetryCheck()}
    ${blockedReason ? `<p class="reference-feature-blocked-note">已认可镜像轮廓。${blockedReason}。</p>` : ""}
  </div>`;
}
