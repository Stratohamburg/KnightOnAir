import { fighterReviewRegistration, type FighterModule, type FighterSheet, type FighterView } from "../../data/pistonFighterSheets";

const viewNames = { front: "正视", side: "侧视", plan: "俯视" };
const views = ["front", "side", "plan"] as const;

const moduleColors: Record<FighterModule, string> = {
  "机身": "#386764", "主翼": "#477b99", "发动机罩": "#9a7435", "桨毂": "#915837", "三叶桨": "#b17a18",
  "风挡": "#237b96", "滑动舱盖": "#31998b", "后窗": "#547bba", "平尾": "#765a89", "升降舵": "#b37254",
  "垂尾": "#875a77", "方向舵": "#b05b37", "副翼": "#995f32", "襟翼": "#817b32", "折叠翼尖": "#478453",
  "右翼散热器": "#ac4835", "左翼油冷器": "#548340", "左翼空速管": "#903e6b", "翼内炮整流罩": "#5b6183",
  "尾轮": "#53606a", "尾钩": "#796342",
};
const modules = Object.keys(moduleColors) as FighterModule[];

function wingEdges(sheet: FighterSheet, view: "front" | "plan", mirrorFit: boolean) {
  return (["imageLeft", "imageRight"] as const).map(side => {
    const right = side === "imageRight";
    const upper: string[] = [], lower: string[] = [];
    for (const [x, lu, ll, ru, rl] of sheet.readings[view]) {
      const px = right ? 2 * fighterReviewRegistration.centerlineX - x : x;
      upper.push(`${px},${mirrorFit ? (lu + ru) / 2 : right ? ru : lu}`);
      lower.push(`${px},${mirrorFit ? (ll + rl) / 2 : right ? rl : ll}`);
    }
    const root = mirrorFit ? sheet.wingRoot[view][side].map(([x, y]) => `${x},${y}`) : [];
    const points = upper.reverse().concat(lower, root.reverse()).join(" ");
    return mirrorFit ? `<polygon points="${points}"><title>主翼</title></polygon>` : `<polyline points="${points}"/>`;
  }).join("");
}

function panel(sheet: FighterSheet, view: FighterView) {
  const [width, height] = sheet.sizes[view];
  const src = new URL(`../../assets/reference/${sheet.asset}/${view}.png`, import.meta.url).href;
  const { centerlineX, sideDatumY } = fighterReviewRegistration;
  const datum = view === "side" ? `M0 ${sideDatumY}H${width}` : `M${centerlineX} 0V${height}`;
  const contours = view === "side" ? "" : wingEdges(sheet, view, true);
  const raw = view === "side" ? "" : wingEdges(sheet, view, false);
  const regions = Object.entries(sheet.outlines[view]).map(([name,d]) => {
    const color = moduleColors[name as FighterModule];
    return `<path data-module="${name}" d="${d}" stroke="${color}" fill="${d.includes("Z") ? color : "none"}"><title>${name}</title></path>`;
  }).join("");
  const locators = sheet.markers[view].map(([name,x,y,lx,ly,label = name]) =>
    `<g class="meteor-locator" data-module="${name}" style="color:${moduleColors[name]}"><path d="M${x} ${y}L${lx} ${ly}" fill="none" stroke="currentColor" stroke-width=".8"/><circle cx="${x}" cy="${y}" r="2"/><text x="${lx}" y="${ly}" text-anchor="middle">${label}</text></g>`
  ).join("");
  return `<figure class="reference-feature-view"><figcaption>${viewNames[view]}</figcaption>
    <svg role="img" aria-label="${sheet.title}${viewNames[view]}" viewBox="0 0 ${width} ${height}">
      <image href="${src}" width="${width}" height="${height}"/>
      <path class="meteor-datum" d="${datum}"/>
      <g class="fighter-regions"><g data-module="主翼" stroke="${moduleColors.主翼}" fill="${moduleColors.主翼}">${contours}</g>${regions}</g>
      <g class="meteor-raw-contours">${raw}</g>
      <g class="meteor-locators">${locators}</g>
    </svg></figure>`;
}

function measurements(sheet: FighterSheet) {
  const { centerlineX, span, pixelsPerUnit, pairTolerance } = fighterReviewRegistration;
  const rows = (["front","plan"] as const).flatMap(view => sheet.readings[view].map(([x, lu, ll, ru, rl]) =>
    `<tr><th scope="row">${viewNames[view]} · ${centerlineX - x}</th><td>${lu} / ${ll}</td><td>${ru} / ${rl}</td><td>${Math.abs(lu-ru).toFixed(1)} / ${Math.abs(ll-rl).toFixed(1)}</td></tr>`
  ));
  return `<details class="meteor-symmetry"><summary>左右机翼原始读数与差值</summary>
    <p>全翼展为 ${span} 图板单位。以桨毂和机身尾端确定中心线。下表依图面左右排列，正视读上下缘，俯视读前后缘。每单位对应本地裁图的 ${pixelsPerUnit} 像素。边线宽约 0.5–1 单位，加上两侧取线和配准误差，配对容差取 ${pairTolerance} 单位。主翼色块含原图可见的翼根整流段，双侧原始描线显示表内的外翼读数。</p>
    <div class="meteor-symmetry-scroll"><table><thead><tr><th>视图 · 距中线</th><th>图左双缘</th><th>图右双缘</th><th>双缘差值</th></tr></thead><tbody>${rows.join("")}</tbody></table></div></details>`;
}

function sectionDetail(sheet: FighterSheet) {
  const sections = sheet.aftSections.map(({ station, left, right, deck, belly }, index) => {
    const width = right - left;
    const height = belly - deck;
    const x = 60 + 130 * index;
    const y = 15 + height / 2;
    const marks = [[x - width / 2, y], [x + width / 2, y], [x, 15], [x, 15 + height]];
    return `<g><ellipse cx="${x}" cy="${y}" rx="${width / 2}" ry="${height / 2}" fill="none" stroke="#aa4028" stroke-dasharray="2 2"/>
      ${marks.map(([cx,cy]) => `<circle cx="${cx}" cy="${cy}" r="1.7" fill="#226159"/>`).join("")}
      <text x="${x}" y="87" text-anchor="middle" font-size="9">站位 ${station} · ${width.toFixed(1)} × ${height.toFixed(1)}</text></g>`;
  }).join("");
  return `<details class="meteor-symmetry"><summary>后机身横截面与翼型资料</summary>
    <p>站位从桨毂尖向后量取。四个点标出俯视宽度与侧视高度，虚线椭圆为已采用的机身截面。</p>
    <svg viewBox="0 0 250 96" width="100%" height="130" role="img" aria-label="后机身两处横截面的实测宽高与已确认椭圆">${sections}</svg>
    <p>${sheet.wingSectionSource} <a href="https://m-selig.ae.illinois.edu/ads/aircraft.html" target="_blank" rel="noreferrer">翼型资料 ↗</a></p></details>`;
}

export function pistonFighterReviewPlate(sheet: FighterSheet, blockedReason?: string) {
  return `<div class="reference-feature-plate meteor-plate">
    <div class="reference-feature-heading"><div><strong>${sheet.title} · 三视图</strong><small>${sheet.pose}</small></div></div>
    <div class="fighter-region-key" aria-label="模块颜色图例">${modules.filter(name =>
      name === "主翼" || views.some(view => sheet.outlines[view][name])).map(name =>
        `<span><i style="background:${moduleColors[name]}"></i>${name}</span>`).join("")}</div>
    <div class="meteor-controls" role="group" aria-label="图板图层">
      <label><input type="checkbox" data-meteor-layer="source" checked> 配准原图</label>
      <label><input type="checkbox" data-meteor-layer="locators" checked> 部件定位</label>
      <label><input type="checkbox" data-meteor-layer="raw"> 双侧原始描线</label>
    </div>
    <div class="meteor-views">${views.map(v => panel(sheet,v)).join("")}</div>
    <p class="meteor-legend"><strong>已确认</strong> · ${sheet.acceptedAsymmetry}</p>
    <p class="meteor-legend">${sheet.review}</p>
    ${measurements(sheet)}
    ${sectionDetail(sheet)}
    <p class="meteor-legend">${sheet.credit} <a href="${sheet.source}" target="_blank" rel="noreferrer">原图 ↗</a>
    ${sheet.frontSource !== sheet.source ? `<a href="${sheet.frontSource}" target="_blank" rel="noreferrer">正视原图 ↗</a>` : '<a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noreferrer">许可 ↗</a>'}</p>
    <p class="meteor-legend">${sheet.sectionDecision}</p>
    ${blockedReason ? `<p class="reference-feature-blocked-note">${blockedReason}</p>` : ""}
  </div>`;
}
