import type { AircraftTraceStudy } from "../../data/aircraft-references/types";

const colors = ["#21657c", "#a44425", "#6450a0", "#42723b", "#a23b62", "#67521e", "#217467", "#3a589e", "#864a25", "#523c72"];

export function aircraftTracePlate(study: AircraftTraceStudy) {
  const parts = [...new Set(study.panels.flatMap(panel => panel.traces.map(([part]) => part)))];
  const panels = study.panels.map(panel => {
    const source = panel.detail ?? study;
    const paths = panel.traces.map(([part, d]) => {
      const color = colors[parts.indexOf(part) % colors.length];
      return `<path d="${d}" stroke="${color}" fill="${d.includes("Z") ? color : "none"}"
        fill-opacity=".24" stroke-width="1.8" vector-effect="non-scaling-stroke"><title>${part}</title></path>`;
    }).join("");
    const legend = panel.traces.map(([part]) =>
      `<span style="--trace-color:${colors[parts.indexOf(part) % colors.length]}">${part}</span>`
    ).join("");
    let datum = "";
    if (panel.datum) {
      const { axis, at, points } = panel.datum;
      const [x, y, width, height] = panel.crop;
      const line = axis === "x" ? `M${at} ${y}v${height}` : `M${x} ${at}h${width}`;
      datum = `<g stroke="#262f36"><title>图纸中心线与独立读点（px）</title>
        <path d="${line}" fill="none" stroke-dasharray="5 4" vector-effect="non-scaling-stroke"/>
        ${points.map(([px, py]) => `<circle cx="${px}" cy="${py}" r="3" fill="white"><title>(${px}, ${py}) px</title></circle>`).join("")}</g>`;
    }
    return `<figure><figcaption>${panel.label}</figcaption>
      <svg viewBox="${panel.crop.join(" ")}" role="img" aria-label="${panel.label}结构描线">
        <image class="trace-original" href="${source.image}" width="${source.size[0]}" height="${source.size[1]}" opacity=".60"/>
        ${paths}${datum}
      </svg><div class="trace-legend">${legend}</div>
      ${panel.detail ? `<a href="${source.source}" target="_blank" rel="noreferrer">${source.credit} ↗</a>` : ""}</figure>`;
  }).join("");
  return `<section class="reference-feature-plate aircraft-trace-plate">
    <div class="reference-section-head"><h2>结构描线初稿</h2><label><input type="checkbox" checked> 叠加原稿</label></div>
    <div class="trace-panels">${panels}</div>
    <a href="${study.source}" target="_blank" rel="noreferrer">${study.credit} ↗</a>
    <div><h3>量测与构型记录</h3><ul>${study.readings.map(row => `<li>${row}</li>`).join("")}</ul></div>
    <p class="reference-feature-blocked-note"><strong>生成待核对</strong> · ${study.pending}</p>
  </section>`;
}
