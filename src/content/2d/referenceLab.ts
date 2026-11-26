import { AIRCRAFT_REFERENCES, REFERENCE_ERAS, type AircraftReference } from "../../data/aircraftReferences";
import { button } from "./components";

export interface ReferencePart {
  x: number;
  z: number;
  role?: string;
  kind: string;
  slot: string;
  side?: number;
}

interface ReferenceStructure {
  length: number;
  wingspan: number;
  parts: readonly ReferencePart[];
}

interface ReferenceRefit {
  engines: number;
  cannonCount: number;
  bays: readonly { id: string; name: string }[];
}

function roleLabel(part: ReferencePart) {
  if (part.kind === "landingGear") return "起落架";
  if (part.role === "engine") return "发动机";
  if (part.role === "gun" || part.role === "turret") return "武器";
  if (part.role === "bay") return "挂舱";
  if (part.role === "wing") return "翼面";
  if (part.role === "tail") return "尾翼";
  return part.slot === "center" ? "机身" : part.slot;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function referenceCatalog(references = AIRCRAFT_REFERENCES) {
  const entries = references.map(item =>
    `<li><button type="button" class="reference-roster-item" data-frame="${item.id}">
      <span>${item.prototype}</span><small class="reference-era" data-era="${item.era}">${REFERENCE_ERAS[item.era]}</small>
    </button></li>`,
  ).join("");
  return `<nav class="reference-roster" aria-label="机型目录"><ul>${entries || "<li>暂无原型档案</li>"}</ul></nav>`;
}

export function referenceHeading(reference: AircraftReference, showMatch: boolean) {
  const { match } = reference;
  const score = showMatch && match != null ? `
    <div class="reference-score"><strong>${match}</strong><small>匹配度</small></div>
  ` : "";
  const scoreDetails = score ? `
    <div class="reference-score-track" role="meter" aria-label="匹配度" aria-valuemin="0"
      aria-valuemax="100" aria-valuenow="${match}"><i style="width:${match}%"></i></div>
    <p class="reference-score-label">${reference.matchLabel}</p>
  ` : "";
  return `<div class="reference-heading"><div>
    <span class="reference-period">${reference.period}</span>
    <h1 id="reference-title">${reference.prototype}</h1>
    <p class="reference-title-meta">${reference.chineseName} · ${reference.role}</p>
    <p>${reference.summary}</p>
  </div>${score}</div>${scoreDetails}`;
}

export function referenceModelTools(refit?: ReferenceRefit) {
  const refitControls = refit ? `<div class="reference-model-refits">
    <span>试装 · ${refit.engines} 台发动机 · ${refit.cannonCount} 门机炮</span>
    <div class="reference-view-buttons">${refit.bays.map(bay =>
      `<button type="button" data-wing-bay="${bay.id}">＋${bay.name}</button>`,
    ).join("")}</div>
  </div>` : "";
  return `<div class="reference-model-actions">
    <div class="reference-view-buttons" aria-label="模型视角">
      <button type="button" data-view="front">正视</button>
      <button type="button" data-view="side">侧视</button>
      <button type="button" data-view="top">俯视</button>
      ${button("reset-view", "重置")}
    </div>
    <span>拖动模型环绕观察</span>
  </div>${refitControls}`;
}

function structureMap({ length, wingspan, parts }: ReferenceStructure) {
  const nodes = parts.map(part => {
    const x = clamp(50 + (part.x / Math.max(1, wingspan)) * 82, 6, 94);
    const y = clamp(50 - (part.z / Math.max(1, length)) * 86, 7, 93);
    const target = part.role === "engine" ? "engines" : part.slot;
    return `<button type="button" class="reference-node" data-highlight="${target}" style="left:${x}%;top:${y}%"
      aria-label="${roleLabel(part)}"><span>${roleLabel(part)}</span></button>`;
  }).join("");
  const wings = parts.filter(part => part.role === "wing").map(part => {
    const x = clamp(50 + (part.x / Math.max(1, wingspan)) * 82, 15, 85);
    const y = clamp(50 - (part.z / Math.max(1, length)) * 86, 8, 92);
    const tip = part.side === -1 ? 8 : part.side === 1 ? 92 : x;
    return `<span class="reference-wing-line" style="left:${Math.min(x, tip)}%;top:${y}%;width:${Math.abs(x - tip)}%"></span>`;
  }).join("");
  return `<div class="reference-structure-map">
    <p>俯视 · 机头朝上</p>
    <div class="reference-skeleton"><span class="reference-axis"></span>${wings}${nodes}<span class="reference-axis-label nose">NOSE</span><span class="reference-axis-label tail">TAIL</span></div>
    <div class="reference-skeleton-legend"><span><i class="axis"></i>中心线</span><span><i class="wing"></i>翼根支线</span><span><i class="node"></i>模块锚点</span></div>
  </div>`;
}

function structureCard(reference: AircraftReference, structure?: ReferenceStructure) {
  if (!structure && !reference.modules.length && !reference.structuralNotes.length) return "";
  const modules = reference.modules.map(module => {
    const target = module.key === "engine" ? "engines" : module.slot;
    const glyph = `<span class="reference-module-glyph" aria-hidden="true">${module.key.slice(0, 1).toUpperCase()}</span>`;
    const content = `${glyph}<span><strong>${module.label}</strong><small>${module.detail}</small></span>`;
    return structure
      ? `<button type="button" class="reference-module" data-highlight="${target}">${content}</button>`
      : `<div class="reference-module">${content}</div>`;
  }).join("");
  return `<section class="reference-module-card">
    <div class="reference-section-head"><h2>结构校验</h2>${structure ? "<span>点击节点或模块可高亮模型部件</span>" : ""}</div>
    ${structure ? structureMap(structure) : ""}
    ${modules ? `<div class="reference-module-list">${modules}</div>` : ""}
    ${reference.structuralNotes.length ? `<div class="reference-notes"><h3>照片比对清单</h3>
      <ul>${reference.structuralNotes.map(note => `<li>${note}</li>`).join("")}</ul></div>` : ""}
  </section>`;
}

function pipelineCard({ pipeline }: AircraftReference) {
  if (!pipeline) return "";
  const edgeRows = pipeline.edgeRecords.map(edge =>
    `<li><strong>${edge.module}</strong><span>${edge.station} · 翼展 ${edge.span.toFixed(2)} · 后掠 ${edge.sweep.toFixed(2)}</span>
      <small>${edge.seam} · ${edge.clearance}</small></li>`,
  ).join("");
  const discrepancies = pipeline.discrepancyLog.map(entry =>
    `<li><b>${entry.view}</b><span>${entry.change}</span><small>${entry.evidence}</small></li>`,
  ).join("");
  const evidence = pipeline.evidenceMatrix?.map(row =>
    `<li><strong>${row.module}</strong><span>${row.decision} · ${row.value}</span><small>${row.sourceLocation}${row.note ? ` · ${row.note}` : ""}</small></li>`,
  ).join("") ?? "";
  return `<section class="reference-pipeline-card">
    <div class="reference-section-head"><h2>审核记录</h2><span>${pipeline.architecture.layout} · ${pipeline.architecture.wingRelation}</span></div>
    <div class="reference-pipeline-envelope"><span>翼展/机长 ${pipeline.envelope.wingspanToLength.toFixed(2)}</span>
      <span>机身宽/机长 ${pipeline.envelope.maxFuselageWidthToLength.toFixed(2)}</span><span>翼根站位 ${pipeline.envelope.wingRootStationToLength.toFixed(2)}</span></div>
    ${edgeRows ? `<h3>模块边缘</h3><ul>${edgeRows}</ul>` : ""}
    ${discrepancies ? `<h3>差异记录</h3><ul>${discrepancies}</ul>` : ""}
    ${evidence ? `<details><summary>几何证据</summary><ul>${evidence}</ul></details>` : ""}
  </section>`;
}

function refitCard({ build }: AircraftReference) {
  if (!build) return "";
  return `<section class="reference-build-card">
    <div class="reference-section-head"><h2>改装参考</h2><span>${build.quality} / ${build.quantity}</span></div>
    <h3>${build.headline}</h3><p>${build.detail}</p>
  </section>`;
}

export function referenceDetails(reference: AircraftReference, structure?: ReferenceStructure) {
  const { threeView, photos } = reference;
  return `
    ${threeView?.src ? `<section class="reference-three-view">
      <div class="reference-section-head"><h2>${reference.study ? "结构描线原稿" : "参考三视图原稿"}</h2><a href="${threeView.source}" target="_blank" rel="noreferrer">线稿来源 ↗</a></div>
      <figure><img src="${threeView.src}" alt="${threeView.alt}" loading="lazy"><figcaption>
        ${threeView.note}${threeView.loading === "pending" ? " · 待核对" : ""}
      </figcaption></figure>
    </section>` : ""}
    ${photos.length ? `<section class="reference-photos">
      <div class="reference-section-head"><h2>实拍参考</h2></div>
      <div class="reference-photo-grid">${photos.map(photo =>
        `<figure><img src="${photo.src}" alt="${photo.alt}" loading="lazy"><figcaption><span>${photo.caption}</span>
          <small><a href="${photo.source}" target="_blank" rel="noreferrer">${photo.credit} ↗</a></small></figcaption></figure>`,
      ).join("")}</div>
    </section>` : ""}
    ${structureCard(reference, structure)}
    ${pipelineCard(reference)}
    ${refitCard(reference)}
  `;
}

