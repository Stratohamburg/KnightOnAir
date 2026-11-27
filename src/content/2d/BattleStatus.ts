import { RULES } from "../../data/config";
import { button, meter, setMeter } from "./components";
import { icon } from "./icons";

export type BombStatusCode =
  | "no_bay"
  | "damaged"
  | "reloading"
  | "out_of_envelope"
  | "stabilizing"
  | "ready"
  | "standby";

export interface BombAvailabilityInput {
  hasWeapon: boolean;
  bombing: boolean;
  bombFactor: number;
  cooldown: number;
  validAim: boolean;
  stability: number;
  canBomb: boolean;
}

export interface BombAvailabilityView {
  status: BombStatusCode;
  label: string;
  state: string;
  modeTitle: string;
  canToggleBombing: boolean;
}

export function resolveBombAvailability(input: BombAvailabilityInput): BombAvailabilityView {
  if (!input.hasWeapon) {
    return {
      status: "no_bay",
      label: "无弹舱",
      state: "需改装安装弹舱",
      modeTitle: "需要安装弹舱",
      canToggleBombing: false,
    };
  }
  if (input.bombFactor <= 0) {
    return {
      status: "damaged",
      label: "弹舱损毁",
      state: "修复后可投弹",
      modeTitle: "弹舱损毁无法投弹",
      canToggleBombing: input.bombing,
    };
  }
  if (input.cooldown > 0) {
    return {
      status: "reloading",
      label: `${input.cooldown.toFixed(1)}s`,
      state: "装填中",
      modeTitle: "",
      canToggleBombing: true,
    };
  }
  if (input.canBomb) {
    return {
      status: "ready",
      label: "投弹",
      state: "落点锁定",
      modeTitle: "",
      canToggleBombing: true,
    };
  }
  if (input.bombing && !input.validAim) {
    return {
      status: "out_of_envelope",
      label: "超包线",
      state: "修正航向入锥",
      modeTitle: "",
      canToggleBombing: true,
    };
  }
  if (input.bombing && input.stability < RULES.bombThreshold) {
    return {
      status: "stabilizing",
      label: `${Math.round(input.stability * 100)}%`,
      state: "松杆稳定",
      modeTitle: "",
      canToggleBombing: true,
    };
  }
  return {
    status: "standby",
    label: "待命",
    state: "开启轰炸",
    modeTitle: "",
    canToggleBombing: true,
  };
}

function markup(mission: string, era: string) {
  return `<header class="battle-top">
      <div class="health-block">
        <div class="hud-title">${icon("shield")}<span>机体 <b id="health-text"></b></span></div>
        ${meter("hud-meter health-meter", "health-fill")}
        <div class="hud-title energy-title">${icon("bolt")}<span>加力 <b id="energy-text"></b></span></div>
        ${meter("hud-meter energy-meter", "energy-fill")}
      </div>
      <div class="battle-clock">
        <span class="eyebrow">${mission} · ${era}</span>
        <div class="battle-clock-row"><b id="battle-time">00:00</b><small id="battle-score">0 PTS</small></div>
        <div id="mission-objective" class="mission-objective"></div>
      </div>
      <div class="battle-top-actions">
        ${button("pause", icon("pause"), "icon-button pause-button", 'aria-label="暂停游戏"')}
      </div>
    </header>
    <div class="xp-bar"><i id="xp-fill"></i><span id="level-label">LV.01</span><small class="quality-chip" id="quality-readout"></small></div>
    <div class="battle-announcement" id="battle-notice" role="status" aria-live="polite"></div>
    <div class="battle-status">
      <div class="control-readout">
        <span id="flight-mode">空战巡航</span>
        <strong id="speed-label"><span id="speed-value">0.0</span><small>m/s</small></strong>
        <span id="energy-state">加力就绪</span>
      </div>
      <span id="kills-label"></span><span id="combo-label"></span><span id="wind-label"></span><span id="environment-notice" role="status"></span></div>
    <div class="control-deck" data-bombing="false">
      <div class="deck-top">
        <button type="button" class="upgrade-button" data-action="upgrade" id="upgrade-button" disabled>${icon("wrench")}<span>改装</span><b id="upgrade-count">0</b></button>
        <button type="button" class="mode-button" data-action="bomb-mode" id="mode-button" aria-pressed="false">${icon("target")}<span>轰炸</span><i></i></button>
        <span id="mission-prompt" class="mission-prompt"></span>
      </div>
      <div class="deck-main">
        <div class="stick-surface" role="slider" aria-label="飞行摇杆，外圈加力" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
          <div class="stick-base">
            <span class="stick-boost-ring" aria-hidden="true"></span>
            <span class="stick-throttle"></span>
            <span class="stick-knob"></span>
          </div>
          <span class="stick-label">巡航 · 油门 0%</span>
        </div>
        <button type="button" class="bomb-button" data-action="bomb" id="bomb-button" aria-label="投弹" hidden disabled>
          <span class="bomb-progress"></span>
          ${icon("bomb")}
          <strong id="bomb-label">待命</strong>
          <small id="bomb-state">开启轰炸</small>
        </button>
      </div>
    </div>`;
}

export interface BattleStatusView {
  text: Record<string, string>;
  meters: Record<string, number>;
  bombing: boolean;
  bombReady: boolean;
  bombAvailable: boolean;
  bombStatus: BombStatusCode;
  bombModeTitle: string;
  bombProgress: number;
  upgradeAvailable: boolean;
  noticeVisible: boolean;
}

export class BattleStatus {
  private readonly nodes: Map<string, HTMLElement>;

  constructor(host: HTMLElement, mission: string, era: string) {
    host.innerHTML = markup(mission, era);
    this.nodes = new Map(
      [...host.querySelectorAll<HTMLElement>("[id], .control-deck")].map((node) => [node.id || "deck", node]),
    );
  }

  update(view: BattleStatusView) {
    for (const [id, value] of Object.entries(view.text)) {
      const node = this.nodes.get(id);
      if (node && node.textContent !== value) node.textContent = value;
    }
    for (const [id, value] of Object.entries(view.meters)) {
      const node = this.nodes.get(id);
      if (node) setMeter(node, value);
    }
    const upgrade = this.nodes.get("upgrade-button") as HTMLButtonElement;
    upgrade.disabled = !view.upgradeAvailable;
    upgrade.classList.toggle("available", view.upgradeAvailable);

    const mode = this.nodes.get("mode-button") as HTMLButtonElement;
    mode.setAttribute("aria-pressed", String(view.bombing));
    mode.title = view.bombModeTitle;
    mode.disabled = !view.bombAvailable;
    mode.dataset.bombStatus = view.bombStatus;

    const bomb = this.nodes.get("bomb-button") as HTMLButtonElement;
    bomb.hidden = !view.bombing;
    bomb.disabled = !view.bombReady;
    bomb.classList.toggle("ready", view.bombReady);
    bomb.dataset.bombStatus = view.bombStatus;
    bomb.style.setProperty("--progress", `${view.bombProgress * 100}%`);

    this.nodes.get("deck")!.dataset.bombing = String(view.bombing);
    this.nodes.get("battle-notice")!.classList.toggle("visible", view.noticeVisible);
  }
}
