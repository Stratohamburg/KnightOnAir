import { ho229Drawing, ho229ReviewAnnotations, ho229Views, hoPlateEngineMm, hoSideEngineBody, hoSideOutletLeader } from "../../data/ho229V2Sheet";
import "./ho229ReviewPlate.css";

export function ho229ReviewPlate(blockedReason?: string) {
  const body = hoSideEngineBody;
  const { outletLabel, engineBaySeams, cannonBaySeams } = ho229ReviewAnnotations;
  const panels = Object.entries(ho229Views).map(([id, view]) => {
    const path = (kind: string, d: string) => `<path class="ho-${kind}" d="${d}"/>`;
    return `<figure class="reference-feature-view ho-${id}">
      <figcaption>${view.title}</figcaption>
      <svg viewBox="${view.bounds}" role="img" aria-label="${view.title}">
        <defs><clipPath id="ho229-crop-${id}"><polygon points="${view.crop}"/></clipPath></defs>
        <image href="${ho229Drawing.src}" width="${ho229Drawing.width}" height="${ho229Drawing.height}" clip-path="url(#ho229-crop-${id})"/>
        ${path("skin", view.skin)}${path("joint", view.structure)}${path("canopy", view.cockpit)}
        ${path("engine", view.engines)}${view.controls ? path("control", view.controls) : ""}
        ${view.gear ? path("gear", view.gear) : ""}${path("datum", view.datum)}
        ${id === "side" ? `<rect class="ho-engine-body" transform="translate(${body.x} ${body.centerY}) rotate(${body.angle})"
          y="${-body.diameter / 2}" width="${body.length}" height="${body.diameter}"><title>发动机本体（估计）</title></rect>` : ""}
        ${view.hiddenEngine ? path("engine-hidden", view.hiddenEngine) : ""}${path("engine-position", view.enginePosition)}
        ${id === "side" ? `<g class="ho-outlet-label"><path d="${hoSideOutletLeader}"/><text x="${outletLabel.x}" y="${outletLabel.y}">喷口可见上部</text></g>` : ""}
        ${id === "plan" ? `<g fill="none" stroke-width="3" stroke-dasharray="8 5"><path stroke="#a65833" d="${engineBaySeams}"/><path stroke="#32718b" d="${cannonBaySeams}"/></g>` : ""}
      </svg></figure>`;
  }).join("");
  return `<div class="reference-feature-plate ho229-plate">
    <div class="reference-feature-heading"><strong>V2 三视图</strong>
      <label><input type="checkbox" class="ho-overlay"> 叠合参考原图</label></div>
    <div class="reference-feature-key">
      <span><i style="background:#315c57"></i>翼身轮廓</span>
      <span><i style="background:#32718b"></i>座舱罩</span>
      <span><i style="background:#a65833"></i>发动机</span>
      <span><i class="ho-position-key"></i>推测安装中心线</span>
      <span><i class="ho-hidden-key"></i>推测筒体轮廓</span>
      <span><i class="ho-engine-body-key"></i>发动机本体（估计）</span>
      <span><i style="background:#79618e"></i>后缘舵面</span>
    </div>
    <div class="ho229-views">${panels}</div>
    <small>图板尺寸 · 发动机直径 ${hoPlateEngineMm.diameter} mm，尾喷口上方结构厚 ${hoPlateEngineMm.outletCover} mm。侧视中两台重合，金色矩形的上下边与筒体虚线重合。</small>
    <small>游戏构型 · 机头双机炮。俯视橙色虚线为发动机段接口，蓝色虚线为机炮段接口。</small>
    <small>原图 © Marek Ryś，2001 · Horten Ho 9 V2 · 起落架放下。</small>
    ${blockedReason ? `<p class="reference-feature-blocked-note">${blockedReason}</p>` : ""}
  </div>`;
}
