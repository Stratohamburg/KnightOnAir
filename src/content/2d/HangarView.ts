import { AIRFRAMES, eraOf, type Airframe, type EraId } from "../../data/aircrafts";
import { combatantById } from "../../data/combatants";
import { ERAS } from "../../data/eras";
import { WEAPONS } from "../../data/weapons";
import { actionButton } from "./components";
import { icon } from "./icons";

export type MetaTab = "sortie" | "equipment" | "shop" | "reservedA" | "showroom";

export interface MetaTabDef {
  id: MetaTab;
  name: string;
  icon: string;
  placeholder?: boolean;
}

export const META_TABS: readonly MetaTabDef[] = [
  { id: "shop", name: "商店", icon: "crate", placeholder: true },
  { id: "equipment", name: "装备", icon: "wrench" },
  { id: "sortie", name: "出击", icon: "plane" },
  { id: "reservedA", name: "活动", icon: "compass", placeholder: true },
  { id: "showroom", name: "展台", icon: "plane" },
];

export const PART_SLOTS: readonly [string, string][] = [
  ["nose", "机头"],
  ["leftWing", "左翼"],
  ["rightWing", "右翼"],
  ["center", "机身"],
  ["top", "机背"],
  ["bottom", "机腹"],
  ["tail", "机尾"],
];

const PART_DESCRIPTIONS: Record<string, string> = {
  nose: "机头 · 前向机炮与雷达，损坏后火力和锁定减弱",
  leftWing: "左翼 · 可安装发动机或武器，影响左侧转向与迎弹面",
  rightWing: "右翼 · 可安装发动机或武器，影响右侧转向与迎弹面",
  center: "机身 · 核心生命与能量系统，核心归零即坠毁",
  top: "机背 · 自动炮塔挂点，拥有独立旋转与生命",
  bottom: "机腹 · 炸弹舱，损坏后装填变慢或停止",
  tail: "机尾 · 推进器与尾翼，影响极速、惯性与巡航稳定",
};

export function partDescription(id: string) {
  return PART_DESCRIPTIONS[id] ?? "";
}

export function formatCount(n: number) {
  return Math.floor(n).toLocaleString("en-US");
}

export function renderTopBar(playerLevel: number, currency: number) {
  const levelText = String(playerLevel).padStart(2, "0");
  return `<header class="meta-top">
    <div class="pilot-pill">${icon("shield")}<span>飞行员</span><b>LV.${levelText}</b></div>
    <span class="meta-spacer" aria-hidden="true"></span>
    <div class="currency">${icon("coin")}<span>${formatCount(currency)}</span></div>
    <button type="button" class="icon-button" data-action="settings" aria-label="设置">${icon("gear")}</button>
  </header>`;
}

export function renderBottomNav(activeTab: MetaTab, showDebug = false) {
  return `<nav class="bottom-nav" aria-label="主导航">${META_TABS.filter(tab => showDebug || tab.id !== "showroom").map(
    (tab) =>
      `<button type="button" data-tab="${tab.id}"${tab.id === "showroom" ? ' data-reserved-slot="reservedB"' : ""} class="nav-item${tab.placeholder ? " placeholder-slot" : ""}${activeTab === tab.id ? " selected" : ""}"${activeTab === tab.id ? ' aria-current="page"' : ""}>${tab.id === "showroom" ? icon(tab.icon) : '<i class="nav-slice" aria-hidden="true"></i>'}<span>${tab.name}</span></button>`,
  ).join("")}</nav>`;
}

function renderStats(frame: Airframe, detailed = false) {
  const values: [string, number, number, string][] = [
    ["生命", frame.health, 250, ""],
    ["极速", frame.maxSpeed, 18, "m/s"],
    ["加速", frame.acceleration, 14, ""],
    ["转向", frame.turnRate, 340, "°/s"],
  ];
  const grid = `<div class="stat-grid">${values
    .map(
      ([name, value, max, unit]) =>
        `<div class="stat"><span>${name}</span><strong>${value}<small>${unit}</small></strong><div class="stat-track"><i style="width:${Math.min(100, (value / max) * 100)}%"></i></div></div>`,
    )
    .join("")}</div>`;
  if (!detailed) return grid;
  const footprint = frame.footprint < 0.8 ? "小" : frame.footprint > 1.2 ? "大" : "中";
  const wingspan = Number(frame.wingspan.toFixed(2));
  return `${grid}<div class="spec-row"><span>能量<b>${frame.energyMax}</b></span><span>翼展<b>${wingspan}m</b></span><span>受弹<b>${footprint}</b></span><span>挂点<b>${frame.hardpoints}</b></span></div>`;
}

function renderWeapons(frame: Airframe) {
  const loadout = new Set(combatantById(frame.id)?.mounts.map((mount) => mount.weaponId));
  return `<div class="weapon-tags">${[...loadout]
    .map((id) => `<span>${icon(id === frame.bomb ? "bomb" : "target")}${WEAPONS[id].name}</span>`)
    .join("")}</div>`;
}

export interface SortieViewModel {
  frame: Airframe;
  sortieEra: EraId;
  missionNumber: string;
  missionName: string;
  eraLabel: string;
  bestScore: number;
  canLaunch: boolean;
  modelError?: string;
  briefing?: { objective: string; equipment: string; environment: string; preset: boolean };
}

export function renderSortieBody(model: SortieViewModel) {
  const { frame, missionNumber, missionName, eraLabel, bestScore, canLaunch, modelError, briefing } = model;
  const switchButton =
    briefing?.preset
      ? ""
      : `<button type="button" class="btn btn-xs btn-secondary" data-tab="equipment">更换 ${icon("arrow")}</button>`;
  return `<section class="home-card panel-surface">
    <div class="ticket-brief">
      <div class="ticket-tools">
        <span class="ticket-series">${missionNumber ? `战役 ${missionNumber}` : "自由巡航"} · ${eraLabel}</span>
        ${actionButton("missions", "选关 ›", { size: "xs", variant: "secondary", extraClass: "mission-select", attributes: 'aria-haspopup="dialog"' })}
        ${actionButton("help", icon("help"), { size: "xs", variant: "ghost", attributes: 'aria-label="飞行指南"' })}
      </div>
      <h2>${missionName}</h2>
      <p class="ticket-objective">${briefing?.objective ?? "应对遭遇，收集补给并积累积分。"}</p>
      <div class="ticket-details"><span>${briefing?.environment ?? "晴朗 · 白天"}</span><span>${frame.name}</span>${switchButton}</div>
      <div class="ticket-record">${briefing?.equipment ? `<span>${briefing.equipment}</span>` : ""}<span>最高积分 ${formatCount(bestScore)}</span></div>
      ${modelError ? `<p role="status">${modelError}</p>` : ""}
    </div>
    ${actionButton("launch", `<span>${modelError ? "暂不可出击" : "出击"}</span>`, {
      size: "lg", variant: "primary", extraClass: "launch-button ticket-stub",
      attributes: canLaunch ? "" : "disabled",
    })}
  </section>`;
}

export interface EquipmentViewModel {
  frame: Airframe;
  unlocked: readonly string[];
  equippedId: string;
  highlight: string;
  modelError?: string;
}

export function renderEquipmentBody(model: EquipmentViewModel) {
  const { frame, unlocked, equippedId, highlight, modelError } = model;
  const era = eraOf(frame);
  const eraFrames = AIRFRAMES.filter((candidate) => eraOf(candidate) === era);
  const eraIndex = eraFrames.indexOf(frame);
  const isUnlocked = unlocked.includes(frame.id);
  const isEquipped = equippedId === frame.id;

  const eraButtons = (Object.entries(ERAS) as [EraId, (typeof ERAS)[EraId]][])
    .flatMap(([id, group]) => {
      const first = AIRFRAMES.findIndex((candidate) => eraOf(candidate) === id);
      return first < 0 ? [] : [`<button type="button" data-preview="${first}" aria-pressed="${id === era}">${group.label}</button>`];
    })
    .join("");

  const rosterChips = eraFrames
    .map((candidate) => {
      const active = candidate.id === frame.id;
      const equipped = candidate.id === equippedId;
      const locked = !unlocked.includes(candidate.id);
      const badge = equipped ? icon("check") : locked ? icon("lock") : "";
      const stateClass = `${active ? " active" : ""}${equipped ? " equipped" : ""}${locked ? " locked" : ""}`;
      return `<button type="button" class="roster-chip${stateClass}" data-preview="${AIRFRAMES.indexOf(candidate)}" aria-pressed="${active}">${badge}<span>${candidate.name}</span></button>`;
    })
    .join("");

  const partButtons = PART_SLOTS.map(
    ([id, name]) =>
      `<button type="button" class="${highlight === id ? "selected" : ""}" data-part="${id}" aria-pressed="${highlight === id}">${name}</button>`,
  ).join("");

  const equipLabel = modelError
    ? "暂不可出击"
    : isEquipped
      ? "当前已装备"
      : isUnlocked
        ? `装备此机体 ${icon("arrow")}`
        : `${icon("lock")} ${frame.unlockText}`;

  return `<div class="equipment-badge">
    <span>HANGAR · ${ERAS[era].label}</span>
    <span><strong>${String(eraIndex + 1).padStart(2, "0")}</strong> / ${String(eraFrames.length).padStart(2, "0")}</span>
  </div>
  <section class="equipment-card panel-surface">
    <div class="era-tabs" role="group" aria-label="机体时代">${eraButtons}</div>
    <div class="roster-strip-row">
      <button type="button" class="icon-button" data-action="previous" aria-label="上一架飞机">${icon("chevron", "flipped")}</button>
      <div class="roster-strip" role="listbox" aria-label="同年代机体">${rosterChips}</div>
      <button type="button" class="icon-button" data-action="next" aria-label="下一架飞机">${icon("chevron")}</button>
    </div>
    <div class="card-heading">
      <div class="card-title-group">
        <span class="eyebrow">${frame.role}</span>
        <h2>${frame.name}</h2>
      </div>
      <span class="status-chip${isUnlocked ? "" : " locked"}">${icon(isEquipped ? "check" : isUnlocked ? "shield" : "lock")}${isEquipped ? "当前装备" : isUnlocked ? "已解锁" : "未解锁"}</span>
    </div>
    <p class="frame-description">${frame.description}</p>
    ${renderStats(frame, true)}
    ${renderWeapons(frame)}
    <div class="part-selector" role="group" aria-label="部件预览">${partButtons}</div>
    <p class="part-hint" id="equipment-part-hint">${equipmentPartHint(frame, highlight, modelError)}</p>
    ${actionButton("equip", equipLabel, {
      size: "md",
      variant: "primary",
      block: true,
      extraClass: "equip-button",
      attributes: !isUnlocked || isEquipped || modelError ? "disabled" : "",
    })}
  </section>`;
}

export function equipmentPartHint(frame: Airframe, highlight: string, modelError?: string) {
  if (modelError) return modelError;
  const length = Number(frame.length.toFixed(2));
  return highlight ? partDescription(highlight) : `机身 ${length}m · 点击部位查看挂点与损伤影响`;
}

/** Update equipment part highlight chips & hint text in place without tearing down the panel DOM. */
export function updateEquipmentPartHighlight(
  host: HTMLElement,
  frame: Airframe,
  highlight: string,
  modelError?: string,
) {
  for (const button of host.querySelectorAll<HTMLButtonElement>(".part-selector button[data-part]")) {
    const selected = button.dataset.part === highlight;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  }
  const hint = host.querySelector<HTMLElement>("#equipment-part-hint");
  if (hint) hint.textContent = equipmentPartHint(frame, highlight, modelError);
}

export function renderPlaceholderBody(tab: MetaTab) {
  const back = actionButton("return-sortie", `返回出击 ${icon("arrow")}`, {
    size: "sm", variant: "secondary", attributes: 'data-tab="sortie"',
  });
  if (tab === "shop") {
    return `<div class="shop-backdrop" aria-hidden="true"></div>
      <section class="placeholder-page shop-ticket panel-surface">
        <fieldset class="shop-sections"><legend>商店</legend>
          <label><input type="radio" name="shop-section" value="draw" checked>抽奖</label>
          <label><input type="radio" name="shop-section" value="currency">货币直购</label>
        </fieldset>
        <div class="shop-offer draw-offer"><h1>涂装补给券</h1><p>涂装抽奖即将开放。</p></div>
        <div class="shop-offer currency-offer"><h1>货币直购</h1><p>货币购买即将开放。</p></div>
        ${back}
      </section>`;
  }
  return `<section class="placeholder-page panel-surface">
    <h1>活动即将开放</h1>
    <p>后续活动与奖励将在这里开放。</p>
    ${back}
  </section>`;
}
