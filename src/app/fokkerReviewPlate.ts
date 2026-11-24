import { bodyRadius, elevatorHalf, finOutline, hull, hullAt, hullBays, mirroredOutline, rib, rudderPivot, tailplaneHalf, wingBays, wingOutline, wingPanels, wings } from "../data/fokkerDr1Sheet";

const wingPaths = (view: "front" | "side" | "top") => wings.map(w => {
  const x = -w.span / 2;
  const chord = w.trailing - w.leading;
  let path: string;
  if (view === "front") {
    const depth = Math.max(...rib.map(([,top]) => top)) * chord;
    path = `M ${x} ${-w.height} h ${w.span} v ${-depth} h ${-w.span} Z`;
  } else if (view === "side") {
    const upper = rib.map(([f,y]) => [w.leading + f*chord, -w.height-y*chord]);
    const lower = [...rib].reverse().map(([f,,y]) => [w.leading + f*chord, -w.height-y*chord]);
    path = "M" + [...upper,...lower].join(" L") + " Z";
  } else {
    path = "M" + mirroredOutline(wingOutline(w)).join(" L") + " Z";
  }
  const seams = view === "side" ? "" : wingBays(w).slice(1).flatMap(bay =>
    [-1, 1].map(side => {
      const lateral = side * bay.start;
      const d = view === "top" ? `M${lateral} ${w.leading}V${w.trailing}`
        : `M${lateral} ${-w.height}v${-.138*chord}`;
      return `<path d="${d}" fill="none" stroke="${w.ink}" stroke-width="1" stroke-dasharray="3 2"/>`;
    })).join("");
  return `<path data-wing="${w.id}" d="${path}" stroke="${w.ink}" stroke-width="1.25" fill="${w.ink}" fill-opacity=".08"><title>${w.label}</title></path>${seams}`;
}).join("");

export function fokkerReviewPlate(approved = false) {
  const reverse = [...hull].reverse();
  const sideHull = [...hull.map(p => [p.s, -p.deck]), ...reverse.map(p => [p.s, -p.belly])].join(" ");
  const topHull = [...hull.map(p => [-p.w, p.s]), ...reverse.map(p => [p.w, p.s])].join(" ");
  const bays = hullBays.slice(1).map(({start}) => {
    const {deck, belly} = hullAt(start);
    return `<path d="M${start} ${-deck}V${-belly}" stroke="#745b47" stroke-width="1" stroke-dasharray="3 2"/>`;
  }).join("");
  const movable = (outline: readonly (readonly [number,number])[]) => [-1,1].map(side =>
    `<path d="M${outline.map(([x,s]) => [side*x,s]).join(" L")}Z" fill="#bb7250" fill-opacity=".36" stroke="#784827" stroke-width="1.1"/>`).join("");
  const ailerons = movable(wingPanels(wings[2])[1].outline);
  const front = `<path class="datum" d="M0 -73V70"/>
    <path class="tail" d="M-58 -6H58 M0 -6V-41"/>
    <path class="detail" d="M-109 -63V21 M109 -63V21 M-38 -63L-16 -19 M38 -63L16 -19 M-15 17L-34 57H34L15 17"/>
    <path class="wheel" d="M-34 45v24 M34 45v24"/>
    <circle class="hull" r="${bodyRadius}"/><circle class="detail" r="17"/>
    <path class="prop" d="M-36 46L36 -46"/><circle class="hub" r="3"/>
    ${wingPaths("front")}`;
  const side = `<path class="datum" d="M-10 0H260"/>
    <polygon class="hull" points="${sideHull}"/>${bays}<path class="detail" d="M18 -21V21 M50 -63L74 21 M17 18L42 55L78 17"/>
    <circle class="detail" cx="42" cy="55" r="13"/>
    <path class="tail" d="M178 -6H244"/><path fill="#bb7250" fill-opacity=".35" stroke="#784827" stroke-width="1" d="M${finOutline.map(([s,h]) => [s,-h]).join(" L")}Z"/><circle cx="${rudderPivot.station}" cy="${-rudderPivot.foot}" r="1.8" fill="#784827"/>
    <path class="prop" d="M0 -58V58 M0 0H8"/>${wingPaths("side")}`;
  const top = `<path class="datum" d="M0 -9V261"/>
    <path class="tail" d="M${mirroredOutline(tailplaneHalf).join(" L")}Z"/>
    <polygon class="hull" points="${topHull}"/><path class="detail" d="M-21 18H21"/>
    <ellipse class="detail" cx="0" cy="97" rx="10" ry="12"/>
    <path class="tail" d="M0 215V253"/><path class="prop" d="M-58 0H58 M0 0V8"/>${wingPaths("top")}${ailerons}${movable(elevatorHalf)}`;
  const panel = (title: string, box: string, drawing: string) =>
    `<figure class="reference-feature-view"><figcaption>${title}</figcaption><svg role="img" aria-label="${title}" viewBox="${box}">${drawing}</svg></figure>`;
  const maxSpan = Math.max(...wings.map(w => w.span));
  return `<div class="reference-feature-plate dr1-plate">
    <div class="reference-feature-heading"><strong>三视图关键线</strong></div>
    <div class="reference-feature-key" aria-label="翼展相对上翼的比例">${[...wings].reverse().map(w =>
      `<span><i style="background:${w.ink}"></i>${w.label} ${Math.round(100 * w.span / maxSpan)}%</span>`).join("")}</div>
    <div class="dr1-views">${panel("正视 · 翼根高度", "-170 -80 340 160", front)}
      ${panel("侧视 · 机头朝左", "-40 -80 340 160", side)}
      ${panel("俯视 · 机头朝上", "-170 -15 340 280", top)}</div>
    <small>俯视翼面虚线分出翼根、承力段和翼尖，延长段接在翼尖内侧。棕色面为副翼、升降舵和方向舵。侧视虚线标记机身分段，由前至后为${hullBays.map(b => b.label).join("、")}。</small>
    <button class="reference-feature-approve" data-action="approve-feature-map">${approved ? "查看已生成模型" : "确认特征抽象，进入生成模型"}</button></div>`;
}
