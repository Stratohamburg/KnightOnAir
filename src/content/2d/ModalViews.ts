import { airframeById, STARTER_FRAME_ID, type Airframe, type EraId } from "../../data/aircrafts";
import { QUALITIES, type Quality } from "../../data/config";
import { ERAS } from "../../data/eras";
import type { World } from "../../simulation/World";
import { actionButton } from "./components";
import { formatCount } from "./HangarView";
import { icon, planePreview } from "./icons";
import { formatUpgradeDelta } from "./ShowroomView";

export function formatClock(seconds: number) {
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
}

export interface SettingsModalModel {
  quality: Quality;
  sound: boolean;
  vibration: boolean;
  bestScore: number;
  sorties: number;
  storageAvailable: boolean;
}

export function renderSettingsModal(model: SettingsModalModel) {
  const qualityOptions = Object.entries(QUALITIES)
    .map(
      ([id, q]) =>
        `<option value="${id}" ${model.quality === id ? "selected" : ""}>${q.label}</option>`,
    )
    .join("");
  return `<div class="modal-heading">
      <span class="eyebrow">FLIGHT PREFERENCES</span>
      <h2>飞行设置</h2>
    </div>
    <label class="setting-row">
      <span><b>画面质量</b><small>自动调节渲染分辨率以保持流畅</small></span>
      <select id="quality-select" aria-label="画面质量">${qualityOptions}</select>
    </label>
    <label class="setting-row">
      <span><b>音效</b><small>开火、命中、拾取与系统提示</small></span>
      <input type="checkbox" id="sound-setting" ${model.sound ? "checked" : ""}>
    </label>
    <label class="setting-row">
      <span><b>触觉反馈</b><small>在支持的移动设备上轻微振动</small></span>
      <input type="checkbox" id="vibration-setting" ${model.vibration ? "checked" : ""}>
    </label>
    <div class="settings-foot">
      最高积分 ${formatCount(model.bestScore)} · 出击 ${model.sorties} 次<br>
      ${model.storageAvailable ? "飞行记录已保存在当前浏览器" : "当前浏览器无法持久保存，记录暂存于本次会话"}
    </div>
    <div class="modal-actions">
      ${actionButton("close-modal", `完成 ${icon("check")}`, { size: "md", variant: "primary", block: true })}
    </div>`;
}

export function renderHelpModal() {
  return `<div class="modal-heading">
      <span class="eyebrow">FLIGHT BRIEFING</span>
      <h2>单手飞行指南</h2>
    </div>
    <div class="help-step">${icon("plane")}<div><b>中央摇杆转向与加速</b><p>内圈控制普通油门，拉入外圈开启加力；松手巡航并恢复加力储备。</p></div></div>
    <div class="help-step">${icon("target")}<div><b>保持敌机在火线</b><p>武器沿机体挂点方向自动开火，命中依靠转向、滚转和提前量。</p></div></div>
    <div class="help-step">${icon("bomb")}<div><b>轰炸模式与松杆稳定</b><p>开启右上轰炸开关，松杆等待准心变绿后点击右下投弹环。</p></div></div>
    <div class="help-step">${icon("wrench")}<div><b>累积改装升级</b><p>升级次数可累积，点击左上改装钮暂停战斗并在三张强化卡中任选其一。</p></div></div>
    <div class="modal-actions">
      ${actionButton("close-modal", `明白了 ${icon("arrow")}`, { size: "md", variant: "primary", block: true })}
    </div>`;
}

export function renderPauseModal() {
  return `<div class="pause-emblem">${icon("pause")}</div>
    <div class="modal-heading">
      <span class="eyebrow">HOLDING PATTERN</span>
      <h2>航线已暂停</h2>
      <p>战斗、弹道与风场均已冻结。</p>
    </div>
    <div class="modal-actions">
      ${actionButton("resume", `继续飞行 ${icon("play")}`, { size: "md", variant: "primary", block: true })}
      ${actionButton("settings", `飞行设置 ${icon("gear")}`, { size: "sm", variant: "secondary", block: true })}
      ${actionButton("help", `飞行指南 ${icon("help")}`, { size: "sm", variant: "secondary", block: true })}
      ${actionButton("retreat", "结束本次飞行并结算", { size: "sm", variant: "ghost", block: true, extraClass: "retreat-button" })}
    </div>`;
}

export function renderMissionModal(missionEras: readonly EraId[], currentEra: EraId, equippedId: string) {
  const choices = missionEras
    .map((id, index) => {
      const mission = ERAS[id];
      const selected = id === currentEra;
      const aircraft = id === "pioneer" ? airframeById(STARTER_FRAME_ID) : airframeById(equippedId);
      return actionButton(
        "select-mission",
        `<span class="mission-number">${String(index + 1).padStart(2, "0")}</span><span><strong>${mission.mission}</strong><small>${mission.label} · ${aircraft.name}</small></span>${icon(selected ? "check" : "chevron")}`,
        {
          size: "sm",
          variant: "secondary",
          extraClass: "mission-option",
          attributes: `data-mission="${id}" aria-pressed="${selected}"`,
        },
      );
    })
    .join("");
  return `<div class="modal-heading">
      <span class="eyebrow">MISSION ROUTE</span>
      <h2>选择出击航线</h2>
    </div>
    <div class="mission-options">${choices}</div>`;
}

export function renderUpgradeModal(world: World) {
  const isDr1 = world.player.frame.geometryProfile === "fokkerDr1";
  const choices = world.choices
    .map((u) => {
      const rarityLabel = u.rarity === "common" ? "标准" : u.rarity === "rare" ? "稀有" : "史诗";
      return `<button type="button" class="upgrade-card ${u.rarity}" data-upgrade="${u.id}">
        ${planePreview(u.preview, isDr1 ? u.id : undefined)}
        <div>
          <span class="upgrade-rarity">${rarityLabel} / ${u.tag}</span>
          <h3>${u.name}</h3>
          <p class="upgrade-gain">${u.benefit}</p>
          <p class="upgrade-cost">${u.cost}</p>
          <p class="upgrade-delta">${formatUpgradeDelta(u, world)}</p>
          <small>${u.description}</small>
        </div>
        ${icon("arrow")}
      </button>`;
    })
    .join("");
  return `<div class="modal-heading">
      <span class="eyebrow">FIELD MODIFICATION · LV.${world.level}</span>
      <h2>选择机身改装</h2>
      <p>战斗已暂停 · 剩余可用 ${world.upgradesAvailable} 次</p>
    </div>
    <div class="upgrade-choices">${choices}</div>`;
}

export interface ResultViewModel {
  world: World;
  sorties: number;
  previousBest: number;
  bestScore: number;
  bestTime: number;
  unlocked: readonly Airframe[];
}

export function renderResultPage({ world, sorties, previousBest, bestScore, bestTime, unlocked }: ResultViewModel) {
  const survived = world.player.health > 0;
  const configSummary = world.player.upgrades.length
    ? world.player.upgrades
        .map((id) => id.replaceAll("_", " "))
        .slice(-3)
        .join(" / ")
    : "初始构型";
  const unlocks = unlocked
    .map((f) => `<div class="unlock-banner">${icon("shield")}新机体已解锁 · ${f.name}</div>`)
    .join("");

  return `<div class="result-page">
    <section class="result-sheet panel-surface">
      <span class="eyebrow">FLIGHT REPORT · #${String(sorties).padStart(3, "0")}</span>
      <h1>${survived ? "平安返航" : "航迹永不消失"}<span>.</span></h1>
      <p class="result-lead">${survived ? "带着新的飞行数据，准备下一段航程。" : "每一次迫降，都让下一次升空更远。"}</p>
      <div class="result-score">
        <small>本次积分${world.score > previousBest ? "<b>NEW BEST</b>" : ""}</small>
        <strong>${formatCount(world.score)}</strong>
      </div>
      <div class="result-grid">
        <div><span>巡航时间</span><b>${formatClock(world.elapsed)}</b></div>
        <div><span>击毁目标</span><b>${world.kills}</b></div>
        <div><span>收集金币</span><b>+${world.coins}</b></div>
        <div><span>最终等级</span><b>LV.${world.level}</b></div>
        <div><span>安装部件</span><b>${world.player.upgrades.length}</b></div>
        <div><span>投弹命中</span><b>${world.bombsHit}/${world.bombsDropped}</b></div>
      </div>
      ${unlocks}
      <div class="result-aircraft">
        ${icon("plane")}
        <div>
          <b>${world.player.frame.name}</b>
          <span>${configSummary}</span>
        </div>
      </div>
      <div class="result-actions">
        ${actionButton("home", "返回机库", { size: "md", variant: "secondary", block: true })}
        ${actionButton("retry", `再次出击 ${icon("arrow")}`, { size: "md", variant: "primary", block: true })}
      </div>
      <small class="result-best">历史最高 ${formatCount(bestScore)} PTS · 最长巡航 ${formatClock(bestTime)}</small>
    </section>
  </div>`;
}
