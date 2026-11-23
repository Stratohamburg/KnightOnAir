import { button, meter, setMeter } from "./components";
import { icon } from "./icons";

function markup(mission: string, era: string) {
  return `<header class="battle-top"><div class="health-block"><div class="hud-title">${icon("shield")}<span>机体 <b id="health-text"></b></span></div>${meter("hud-meter health-meter", "health-fill")}<div class="hud-title energy-title">${icon("bolt")}<span>加力储备 <b id="energy-text"></b></span></div>${meter("hud-meter energy-meter", "energy-fill")}</div><div class="battle-clock"><span class="eyebrow">${mission}</span><b id="battle-time">00:00</b><small id="battle-score">0 PTS</small></div>${button("pause", icon("pause"), "icon-button pause-button", 'aria-label="暂停游戏"')}</header>
      <div class="xp-bar"><i id="xp-fill"></i><span id="level-label">LV.01</span></div>
      <div class="battle-announcement" id="battle-notice" role="status" aria-live="polite"></div>
      <div class="battle-status"><span id="kills-label"></span><span id="combo-label"></span><span id="wind-label"></span></div>
      <div class="control-deck" data-bombing="false"><div class="deck-top"><button class="upgrade-button" data-action="upgrade" id="upgrade-button" disabled>${icon("wrench")}<span>改装升级</span><b id="upgrade-count">0</b></button><button class="mode-button" data-action="bomb-mode" id="mode-button" aria-pressed="false">${icon("target")}<span>轰炸模式</span><i></i></button></div>
      <div class="deck-main"><div class="control-readout"><span id="flight-mode">空战巡航</span><strong id="speed-label"><span id="speed-value">0.0</span><small>m/s</small></strong><span id="energy-state">加力就绪</span></div>
      <div class="stick-surface" role="slider" aria-label="飞行摇杆，外圈加力" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="stick-base"><span class="stick-boost-ring" aria-hidden="true"><b>加力</b></span><span class="stick-throttle"></span><span class="stick-half"></span><span class="stick-cross"></span><span class="stick-knob">${icon("plane")}</span></div><span class="stick-label">巡航 · 油门 0%</span></div>
      <button class="bomb-button" data-action="bomb" id="bomb-button" aria-label="投弹" hidden disabled><span class="bomb-progress"></span>${icon("bomb")}<strong id="bomb-label">待命</strong><small id="bomb-state">先开启轰炸</small></button></div>
      <div class="deck-footer"><span>KNIGHT ON AIR <i>${era}</i></span>${button("help", icon("help"), "", 'aria-label="飞行操作帮助"')}<span id="quality-readout"></span></div></div>`;
}

interface BattleStatusView {
  text: Record<string, string>;
  meters: Record<string, number>;
  bombing: boolean;
  bombReady: boolean;
  bombAvailable: boolean;
  bombProgress: number;
  upgradeAvailable: boolean;
  noticeVisible: boolean;
}

export class BattleStatus {
  private readonly nodes: Map<string, HTMLElement>;
  constructor(host: HTMLElement, mission: string, era: string) {
    host.innerHTML = markup(mission, era);
    this.nodes = new Map([...host.querySelectorAll<HTMLElement>("[id], .control-deck")].map((node) => [node.id || "deck", node]));
  }

  update(view: BattleStatusView) {
    for (const [id, value] of Object.entries(view.text)) {
      const node = this.nodes.get(id)!;
      if (node.textContent !== value) node.textContent = value;
    }
    for (const [id, value] of Object.entries(view.meters)) setMeter(this.nodes.get(id)!, value);
    const upgrade = this.nodes.get("upgrade-button") as HTMLButtonElement;
    upgrade.disabled = !view.upgradeAvailable;
    upgrade.classList.toggle("available", view.upgradeAvailable);
    const mode = this.nodes.get("mode-button") as HTMLButtonElement;
    mode.setAttribute("aria-pressed", String(view.bombing));
    mode.title = view.bombAvailable ? "" : "需要安装弹舱";
    mode.disabled = !view.bombAvailable;
    const bomb = this.nodes.get("bomb-button") as HTMLButtonElement;
    bomb.hidden = !view.bombing;
    bomb.disabled = !view.bombReady;
    bomb.classList.toggle("ready", view.bombReady);
    bomb.style.setProperty("--progress", `${view.bombProgress * 100}%`);
    this.nodes.get("deck")!.dataset.bombing = String(view.bombing);
    this.nodes.get("battle-notice")!.classList.toggle("visible", view.noticeVisible);
  }
}
