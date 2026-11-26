import type { Airframe, EraId } from "../../data/aircrafts";
import type { CampaignMission } from "../../data/campaignMissions";
import { QUALITIES, type Quality } from "../../data/config";
import { ERAS } from "../../data/eras";
import type { World } from "../../simulation/World";
import { actionButton } from "./components";
import { formatCount } from "./HangarView";
import { icon, planePreview } from "./icons";
import { formatRefitDelta } from "./ShowroomView";
import { upgradeById, upgradePrice } from "../../data/upgrades";

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
    <div class="help-step">${icon("target")}<div><b>把敌机带进射界</b><p>用摇杆控制航向。敌机进入炮位射界后，武器会预估提前量并自动开火。</p></div></div>
    <div class="help-step">${icon("bomb")}<div><b>轰炸模式与松杆稳定</b><p>开启右上轰炸开关，松杆等待准心变绿后点击右下投弹环。</p></div></div>
    <div class="help-step">${icon("wrench")}<div><b>局内改装</b><p>点击改装预览三项升级，确认后支付本局金币。也可以返回战斗，保留升级次数和候选。</p></div></div>
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

export function renderMissionModal(
  missions: readonly { mission: CampaignMission; unlocked: boolean; cleared: boolean }[],
  currentMission: string | undefined,
  patrolEra: EraId,
) {
  const option = (action: string, id: string, title: string, subtitle: string, selected: boolean, locked = false, number = "") =>
    actionButton(action, `${number ? `<span class="mission-number">${number}</span>` : ""}
      <span><strong>${title}</strong><small>${subtitle}</small></span>${icon(selected ? "check" : "chevron")}`, {
      size: "sm", variant: "secondary", extraClass: "mission-option",
      attributes: `data-mission="${id}" aria-pressed="${selected}"${locked ? " disabled" : ""}`,
    });
  const choices = missions.map(({ mission, unlocked, cleared }) => option(
    "select-mission", mission.id, mission.name,
    `${ERAS[mission.era].label}${cleared ? " · 已通关" : unlocked ? "" : " · 待解锁"}`,
    mission.id === currentMission, !unlocked, String(mission.order).padStart(2, "0"),
  )).join("");
  const patrols = (Object.keys(ERAS) as EraId[]).map((id) =>
    option("select-patrol", id, ERAS[id].mission, ERAS[id].label, !currentMission && id === patrolEra)).join("");
  return `<div class="modal-heading">
      <h2>战役选关</h2>
    </div>
    <div class="mission-options">${choices}<h3>自由巡航</h3>${patrols}</div>`;
}

export function renderUpgradeModal(world: World) {
  const isDr1 = world.player.frame.geometryProfile === "fokkerDr1";
  const choices = world.choices.map((upgrade) => {
    const price = upgradePrice(upgrade);
    return `<div class="upgrade-option" data-upgrade-option="${upgrade.id}">
      <button type="button" class="upgrade-card ${upgrade.rarity}" data-upgrade="${upgrade.id}"
        aria-pressed="false" aria-label="${upgrade.name}，${price} 金币" aria-describedby="refit-delta-${upgrade.id}">
        ${planePreview(upgrade.preview, isDr1 ? upgrade.id : undefined)}
        <span class="upgrade-card-copy">
          <strong>${upgrade.name}</strong>
          <span id="refit-delta-${upgrade.id}" class="upgrade-delta">${formatRefitDelta(upgrade, world)}</span>
        </span>
        <span class="upgrade-price">${price} 金币</span>
      </button>
      <button type="button" data-action="confirm-upgrade" class="upgrade-confirm" hidden disabled
        aria-label="确认安装${upgrade.name}，支付 ${price} 金币" aria-describedby="upgrade-payment">确认安装</button>
    </div>`;
  }).join("");
  const installed = world.upgradeInstallation && upgradeById(world.upgradeInstallation.upgradeId);
  return `<div class="upgrade-heading">
      <h2>局内改装</h2>
      <p class="upgrade-balance">${world.coins} 金币 · ${world.upgradesAvailable} 次</p>
      <button type="button" data-action="return-from-upgrade" class="upgrade-return" ${installed ? "hidden" : ""}>返回战斗</button>
    </div>
    <p class="upgrade-payment" id="upgrade-payment" role="status">${installed ? "已支付 · 正在安装 " + installed.name : ""}</p>
    <div class="upgrade-choices">${choices}</div>`;
}

export function updateUpgradeSelection(sheet: ParentNode, world: World) {
  const selected = world.choices.find(choice => choice.id === world.selectedUpgradeId);
  const shortfall = selected ? Math.max(0, upgradePrice(selected) - world.coins) : 0;
  for (const option of sheet.querySelectorAll<HTMLElement>("[data-upgrade-option]")) {
    const pressed = selected?.id === option.dataset.upgradeOption;
    option.querySelector("[data-upgrade]")?.setAttribute("aria-pressed", String(pressed));
    const confirm = option.querySelector<HTMLButtonElement>(".upgrade-confirm");
    if (confirm) {
      confirm.hidden = !pressed;
      confirm.disabled = !pressed || shortfall > 0;
    }
  }
  const payment = sheet.querySelector("#upgrade-payment");
  if (payment && !world.upgradeInstallation) {
    payment.textContent = selected
      ? shortfall > 0 ? `还需 ${shortfall} 金币` : `将支付 ${upgradePrice(selected)} 金币`
      : "选择一项预览";
  }
}

export interface ResultViewModel {
  world: World;
  sorties: number;
  previousBest: number;
  bestScore: number;
  bestTime: number;
  unlocked: readonly Airframe[];
  nextMission?: CampaignMission;
}

export function renderResultPage({ world, sorties, previousBest, bestScore, bestTime, unlocked, nextMission }: ResultViewModel) {
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

  const mission = world.mission?.mission;
  const outcome = world.mission?.result;
  const outcomeLabel = outcome && {
    victory: "任务完成", mission_failed: "任务失败", aircraft_destroyed: "座机坠毁", retreat: "主动返航",
  }[outcome.outcome];
  return `<div class="result-page">
    <section class="result-sheet panel-surface">
      <span class="eyebrow">FLIGHT REPORT · #${String(sorties).padStart(3, "0")}</span>
      <h1>${outcomeLabel ?? (survived ? "平安返航" : "航迹永不消失")}<span>.</span></h1>
      <p class="result-lead">${mission && outcome
        ? `${mission.name} · 已完成阶段 ${outcome.completedStages}/${mission.stages.length}${outcome.detail ? ` · ${outcome.detail}` : ""}`
        : `自由巡航 · ${ERAS[world.era].mission}`}</p>
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
        ${actionButton("retry", mission ? "重试" : "再次出击", { size: "md", variant: nextMission ? "secondary" : "primary", block: true })}
        ${nextMission ? actionButton("next-mission", `下一关 ${icon("arrow")}`, { size: "md", variant: "primary", block: true }) : ""}
      </div>
      <small class="result-best">历史最高 ${formatCount(bestScore)} PTS · 最长巡航 ${formatClock(bestTime)}</small>
    </section>
  </div>`;
}
