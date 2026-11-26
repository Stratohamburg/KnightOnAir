import { QUALITIES } from "../../data/config";
import { previewPower, previewTracks } from "../../simulation/AircraftPreview";
import type { DisplayCategory } from "../../rendering/EffectsPreviewScene";
import { button } from "./components";

const choices = (values: Record<string, { name: string }>) => Object.entries(values)
  .map(([id, value]) => `<option value="${id}">${value.name}</option>`).join("");
const categoryNames: Record<DisplayCategory, string> = {
  wingFlow: "翼中气流", wingTip: "主翼尖气流", airflow: "其他气流", engines: "发动机", damage: "破损", fire: "开火",
};

export function effectsWorkbench() {
  return `<div class="effects-workbench">
    <div class="effects-stage" aria-label="特效预览画面"></div>
    <section class="effects-controls" aria-label="特效控制">
      <div class="effects-control-row"><label>预览方式
        <select data-control="mode"><option value="library">特效库</option><option value="aircraft">机型表现</option></select>
      </label><label><span data-label="selection">特效</span><select data-control="selection"></select></label></div>
      <p data-value="notice" role="status" hidden></p>
      <p data-value="description" hidden></p>
      <div class="effects-control-row" data-group="library">
        ${button("trigger-effect", "播放", "reference-back")}
        ${button("stop-effect", "停止发射", "reference-back")}
      </div>
      <div class="effects-aircraft-controls" data-group="aircraft" hidden>
        <div class="effects-control-row">
          <label>航迹 <select data-control="track">${choices(previewTracks)}</select></label>
          <label>动力 <select data-control="power">${choices(previewPower)}</select></label>
          <label>镜头 <select data-control="camera"><option value="follow">跟随</option><option value="fixed">固定</option></select></label>
        </div>
        <div class="effects-control-row effects-categories" aria-label="特效类别">
          ${Object.entries(categoryNames).map(([id, label]) =>
            `<button type="button" class="reference-back" data-category="${id}" aria-pressed="true">${label}</button>`).join("")}
        </div>
        <div class="effects-control-row">
          <label class="effects-check"><input type="checkbox" data-control="solo"> 单显</label>
          ${button("all-effects", "显示全部", "reference-back")}
          ${button("fire-preview", "齐射", "reference-back")}
          ${button("point-damage", "点选破损", "reference-back", 'aria-pressed="false"')}
        </div>
        <div class="effects-control-row">
          <label>部件 <select data-control="part"></select></label>
          ${button("damage-part", "制造破损", "reference-back")}
          ${button("engine-fault", "发动机故障", "reference-back")}
          ${button("detach-part", "脱落", "reference-back")}
        </div>
        <div class="effects-control-row">
          <label>破损点 <select data-control="damageSite"></select></label>
          ${button("repair-site", "维修选中点", "reference-back")}
        </div>
      </div>
      <details class="effects-observation" open>
        <summary>播放与观察</summary>
        <div class="effects-control-row">
          ${button("pause-preview", "继续", "reference-back")}
          ${button("step-preview", "单步", "reference-back")}
          ${button("reset-preview", "重置", "reference-back")}
          ${button("replay-preview", "重播", "reference-back")}
          <output data-value="step" aria-label="模拟步">0</output>
        </div>
        <div class="effects-control-row">
          <label>速度 <select data-control="rate"><option value="1">1×</option><option value="0.5">½×</option><option value="0.25">¼×</option></select></label>
          <label>种子 <input type="number" data-control="seed" value="491" step="1"></label>
          <label>画质 <select data-control="quality">${Object.entries(QUALITIES).map(([id, q]) => `<option value="${id}">${q.label}</option>`).join("")}</select></label>
          <label>背景 <select data-control="background"><option value="dark">深色</option><option value="light">浅色</option></select></label>
          <label class="effects-check"><input type="checkbox" data-control="anchors"> 挂点</label>
        </div>
      </details>
    </section>
  </div>`;
}
