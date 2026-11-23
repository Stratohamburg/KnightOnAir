import { AIRFRAMES, airframeById, eraOf, type Airframe } from "../data/aircrafts";
import { ERAS } from "../data/eras";
import { combatantById } from "../data/combatants";
import { QUALITIES, type Quality } from "../data/config";
import { upgradeById, type Upgrade } from "../data/upgrades";
import type { Stats } from "../simulation/types";
import { WEAPONS } from "../data/weapons";
import { World, requiredXp } from "../simulation/World";
import { Renderer } from "../rendering/Renderer";
import { cloudDiagnostics } from "../rendering/RenderDiagnostics";
import { SaveStore } from "../services/Save";
import { GameAudio } from "../services/Audio";
import { VirtualStick } from "../input/VirtualStick";

import { icon, planePreview } from "../content/2d/icons";
import { CombatHud, type NameplateView } from "../content/2d/CombatHud";
import { BattleStatus } from "../content/2d/BattleStatus";
import { button, dialog } from "../content/2d/components";
import type { ThreatView } from "../content/2d/combatHints";

type Tab = "sortie" | "equipment" | "shop" | "reservedA" | "showroom";
type Modal = "" | "settings" | "help" | "pause" | "upgrade" | "showroomAircraft";
const tabs: { id: Tab; name: string; icon: string }[] = [
  { id: "shop", name: "商店", icon: "crate" },
  { id: "equipment", name: "装备", icon: "wrench" },
  { id: "sortie", name: "出击", icon: "plane" },
  { id: "reservedA", name: "预留", icon: "compass" },
  { id: "showroom", name: "展厅", icon: "plane" },
];
const fmt = (n: number) => Math.floor(n).toLocaleString("en-US");
const timeLabel = (n: number) =>
  `${Math.floor(n / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(n % 60)
    .toString()
    .padStart(2, "0")}`;

export class GameApp {
  readonly save = new SaveStore();
  readonly audio = new GameAudio();
  readonly stick = new VirtualStick();
  renderer?: Renderer;
  world?: World;
  private displayWorld: World;
  private showroom?: World;
  private showroomBuild: string[] = [];
  private showroomPointer?: { id: number; x: number; y: number };
  private showroomOrbitYaw = 0;
  private showroomOrbitPitch = 0.14;
  private tab: Tab = "sortie";
  private preview = 0;
  private highlight = "";
  private screen: "meta" | "launching" | "battle" | "result" = "meta";
  private modal: Modal = "";
  private settingsReturn: Modal = "";
  private launchTime = 0;
  private previous = 0;
  private hudTimer = 0;
  private lastLock = 0;
  private ui: HTMLElement;
  private overlays: HTMLElement;
  private sceneHost: HTMLElement;
  private labels: HTMLElement;
  private toastElement: HTMLElement;
  private toastTimer?: ReturnType<typeof setTimeout>;
  private finished = false;
  private previousFocus?: HTMLElement;
  private keyboardUsed = false;
  private combatHud?: CombatHud;
  private battleStatus?: BattleStatus;

  constructor(private root: HTMLElement) {
    this.displayWorld = new World(airframeById(this.save.data.equipped), 1);
    this.audio.enabled = this.save.data.sound;
    this.audio.vibration = this.save.data.vibration;
    root.innerHTML = `
      <aside class="desktop-intro"><a class="wordmark" href="#sortie"><span class="brand-symbol">${icon("plane")}</span> KNIGHT<br><span class="wordmark-tail">ON AIR.</span></a><div class="edition">A SMALL PLANE.<br>AN ENDLESS SKY.</div><p class="desktop-title">把航线，<br>交给自己。</p><div class="desktop-line"></div><p class="desktop-copy">单手驾驶 · 自动空战 · 自由改装<br>每一次出击，都是新的飞行故事。</p><span class="desktop-stamp">FLIGHT SERIES / VOL. 01<br>翡翠海岸 · 06:24 AM</span></aside>
      <section class="game-shell" aria-label="云端骑士游戏"><div class="scene-host"></div><div class="scene-vignette"></div><div class="world-labels" aria-hidden="true"></div><div class="ui-layer"></div><div class="overlay-layer"></div><div class="toast" role="status" aria-live="polite"></div></section>
      <aside class="desktop-notes"><div class="coordinate">N 24° 38′<br>E 121° 06′</div><div class="note-cross">+</div><p>保持航向。<br>让风成为同伴。</p><div class="key-guide"><span>W A S D</span> 或方向键驾驶<br><span>B</span> 切换轰炸模式<br><span>SPACE</span> 稳定后投弹<br><span>U</span> 安装升级 · <span>P</span> 暂停</div><div class="version">KNIGHT ON AIR<br>PROCEDURAL FLIGHT / 0.3</div></aside>`;
    this.ui = root.querySelector(".ui-layer")!;
    this.overlays = root.querySelector(".overlay-layer")!;
    this.sceneHost = root.querySelector(".scene-host")!;
    this.labels = root.querySelector(".world-labels")!;
    this.toastElement = root.querySelector(".toast")!;
    try {
      this.renderer = new Renderer(this.sceneHost);
      this.renderer.setQuality(this.save.data.quality);
      this.renderer.setPlayer(this.displayWorld.player);
      if (import.meta.env.DEV) {
        Object.assign(window, {
          __koa: {
            renderer: this.renderer,
            get cloud() { return cloudDiagnostics.get(this.renderer); },
          },
        });
      }
      this.renderer.canvas.addEventListener("webglcontextlost", (e) => {
        e.preventDefault();
        this.pause();
        this.toast("图形连接中断，恢复后可继续");
      });
      this.renderer.canvas.addEventListener("webglcontextrestored", () =>
        this.toast("图形连接已恢复"),
      );
    } catch {
      this.sceneHost.innerHTML = `<div class="render-fallback">${icon("plane")}<h2>让天空重新亮起来</h2><p>当前浏览器无法创建 WebGL 场景。<br>请开启硬件加速，或使用支持 WebGL 的浏览器。</p><button class="primary" data-action="reload">重新加载</button></div>`;
    }
    root.addEventListener("click", (e) => this.onClick(e));
    root.addEventListener("change", (e) => this.onChange(e));
    root.addEventListener("pointerdown", (e) => this.onShowroomPointerDown(e));
    root.addEventListener("pointermove", (e) => this.onShowroomPointerMove(e));
    root.addEventListener("pointerup", (e) => this.onShowroomPointerUp(e));
    root.addEventListener("pointercancel", (e) => this.onShowroomPointerUp(e));
    window.addEventListener("keydown", (e) => this.onKey(e, true));
    window.addEventListener("keyup", (e) => this.onKey(e, false));
    window.addEventListener("blur", () => {
      this.stick.reset();
      this.pause();
    });
    window.addEventListener("resize", () => {
      this.stick.reset();
      this.renderer?.resize();
    });
    window.addEventListener("pagehide", () => this.save.persist());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.stick.reset();
        this.pause();
      }
      this.previous = 0;
    });
    window.addEventListener("hashchange", () => {
      if (this.screen === "meta") this.route(location.hash.slice(1));
    });
    this.route(location.hash.slice(1));
    requestAnimationFrame((t) => this.loop(t));
  }
  private route(value: string) {
    const valid = tabs.find((t) => t.id === (value === "reservedB" ? "showroom" : value));
    this.tab = valid?.id ?? "sortie";
    this.preview = AIRFRAMES.findIndex((f) => f.id === this.save.data.equipped);
    this.showMeta();
  }
  private setTab(tab: Tab) {
    if (this.screen !== "meta") return;
    if (tab !== "showroom" && this.showroom) {
      this.showroom.dispose();
      this.showroom = undefined;
      this.showroomBuild = [];
    }
    this.tab = tab;
    this.highlight = "";
    if (tab === "equipment" || tab === "showroom")
      this.preview = AIRFRAMES.findIndex(
        (f) => f.id === this.save.data.equipped,
      );
    if (tab === "showroom") this.rebuildShowroom();
    history.replaceState(null, "", `#${tab}`);
    this.showMeta();
  }
  private topBar() {
    return `<header class="meta-top"><div class="pilot-emblem">${icon("shield")}</div><div class="pilot"><span>飞行员 <b>LV.${this.save.playerLevel.toString().padStart(2, "0")}</b></span><small>自由飞行中队</small></div><div class="currency">${icon("coin")} ${fmt(this.save.data.currency)}</div><button class="icon-button" data-action="settings" aria-label="设置">${icon("gear")}</button></header>`;
  }
  private nav() {
    return `<nav class="bottom-nav" aria-label="主导航">${tabs.map((t) => `<button data-tab="${t.id}"${t.id === "showroom" ? ' data-reserved-slot="reservedB"' : ""} class="nav-item ${this.tab === t.id ? "selected" : ""}" ${this.tab === t.id ? 'aria-current="page"' : ""}>${icon(t.icon)}<span>${t.name}</span>${t.id === "sortie" ? "<i></i>" : ""}</button>`).join("")}</nav>`;
  }
  private stats(frame: Airframe, detailed = false) {
    const values: [string, number, number, string][] = [
      ["生命", frame.health, 250, ""],
      ["极速", frame.maxSpeed, 18, "m/s"],
      ["加速度", frame.acceleration, 14, ""],
      ["转向", frame.turnRate, 340, "°/s"],
    ];
    return `<div class="stat-grid">${values.map(([name, value, max, unit]) => `<div class="stat"><div><span>${name}</span><strong>${value}<small>${unit}</small></strong></div><div class="stat-track"><i style="width:${(value / max) * 100}%"></i></div></div>`).join("")}</div>${detailed ? `<div class="spec-row"><span>能量 <b>${frame.energyMax}</b></span><span>翼展 <b>${frame.wingspan}m</b></span><span>受弹面积 <b>${frame.footprint < 0.8 ? "小" : frame.footprint > 1.2 ? "大" : "中"}</b></span><span>挂点 <b>${frame.hardpoints}</b></span></div>` : ""}`;
  }
  private weapons(frame: Airframe) {
    const loadout = new Set(combatantById(frame.id)?.mounts.map((mount) => mount.weaponId));
    return `<div class="weapon-tags">${[...loadout].map((id) =>
      `<span>${icon(id === frame.bomb ? "bomb" : "target")}${WEAPONS[id].name}</span>`).join("")}</div>`;
  }
  private showMeta() {
    this.screen = "meta";
    this.modal = "";
    this.overlays.innerHTML = "";
    this.stick.enabled = false;
    this.stick.reset();
    this.root.classList.remove("in-battle", "result-active", "launching");
    this.labels.innerHTML = "";
    this.ui.removeAttribute("inert");
    this.launchTime = 0;
    const frame =
      this.tab === "equipment" || this.tab === "showroom"
        ? AIRFRAMES[this.preview]
        : airframeById(this.save.data.equipped);
    if (this.tab === "showroom") {
      if (!this.showroom || this.showroom.player.frame.id !== frame.id)
        this.rebuildShowroom(frame.id);
      this.renderer?.setPlayer(this.showroom!.player);
      this.renderer?.setDisplayOrbit(this.showroomOrbitYaw, this.showroomOrbitPitch);
    } else {
      if (this.displayWorld.player.frame.id !== frame.id)
        this.displayWorld = new World(frame, 1);
      this.renderer?.setPlayer(this.displayWorld.player);
    }
    this.root
      .querySelector(".game-shell")!
      .classList.toggle("equipment-view", this.tab === "equipment");
    const isUnlocked = this.save.data.unlocked.includes(frame.id),
      isEquipped = this.save.data.equipped === frame.id;
    const era = eraOf(frame), mission = ERAS[era];
    const eraFrames = AIRFRAMES.filter((candidate) => eraOf(candidate) === era);
    const eraIndex = Object.keys(ERAS).indexOf(era);
    let body = "";
    if (this.tab === "sortie")
      body = `
      <div class="home-heading"><div class="eyebrow"><span class="live-dot"></span> ALL SYSTEMS READY</div><h1>风起，<br>即刻出发<span>。</span></h1><p>云层之上，下一段航线由你书写。</p></div>
      <div class="plane-caption"><span>01 / ${frame.role}</span><i></i><span>FLYING FREE</span></div>
      <section class="home-card"><div class="card-heading"><div><span class="eyebrow">YOUR AIRCRAFT</span><h2>${frame.name}</h2></div><button class="text-button" data-tab="equipment">更换机体 ${icon("arrow")}</button></div><p class="frame-description">${frame.description}</p>${this.stats(frame)}${this.weapons(frame)}
      <div class="mission-strip"><span class="mission-number">${String(eraIndex + 1).padStart(2, "0")}</span><div><strong>${mission.mission}</strong><small>${mission.label} / 无尽巡航</small></div><span class="weather">晴间多云<br><b>微风 02 kn</b></span></div>
      <button class="launch-button" data-action="launch" ${this.renderer ? "" : "disabled"}><span><small>READY WHEN YOU ARE</small>出击</span>${icon("arrow")}</button>
      <div class="home-footer"><button data-action="help">${icon("help")} 飞行指南</button><span>最高积分 <b>${fmt(this.save.data.bestScore)}</b></span></div></section>`;
    else if (this.tab === "equipment")
      body = `
      <div class="equipment-title"><span class="eyebrow">THE HANGAR</span><h1>选择你的座驾<span>。</span></h1><p>不同的轮廓，不同的飞行方式。</p></div>
      <div class="era-tabs" aria-label="机体时代">${Object.entries(ERAS).map(([id, group]) => {
        const first = AIRFRAMES.findIndex((candidate) => eraOf(candidate) === id);
        return `<button data-preview="${first}" aria-pressed="${id === era}">${group.label}</button>`;
      }).join("")}</div>
      <div class="airframe-carousel"><button class="icon-button" data-action="previous" aria-label="上一架飞机">${icon("chevron", "flipped")}</button><span>${String(eraFrames.indexOf(frame) + 1).padStart(2, "0")} <i>/ ${String(eraFrames.length).padStart(2, "0")}</i></span><button class="icon-button" data-action="next" aria-label="下一架飞机">${icon("chevron")}</button></div>
      <section class="equipment-card"><div class="card-heading"><div><span class="eyebrow">${frame.role}</span><h2>${frame.name}</h2></div><span class="status-chip ${isUnlocked ? "" : "locked"}">${icon(isEquipped ? "check" : isUnlocked ? "shield" : "lock")}${isEquipped ? "当前装备" : isUnlocked ? "已解锁" : "未解锁"}</span></div>
      <p class="frame-description">${frame.description}</p>${this.stats(frame, true)}${this.weapons(frame)}
      <div class="part-selector" aria-label="部件预览">${[
        ["nose", "机头"],
        ["leftWing", "左翼"],
        ["rightWing", "右翼"],
        ["center", "机身"],
        ["top", "机背"],
        ["bottom", "机腹"],
        ["tail", "机尾"],
      ]
        .map(
          ([id, name]) =>
            `<button class="${this.highlight === id ? "selected" : ""}" data-part="${id}">${name}</button>`,
        )
        .join("")}</div>
      <p class="part-hint">${this.highlight ? this.partDescription(this.highlight) : `机身 ${frame.length}m · 点击部位查看挂点与功能`}</p>
      <button class="primary equip-button" data-action="equip" ${!isUnlocked || isEquipped ? "disabled" : ""}>${isEquipped ? "已装备 · 随时出击" : isUnlocked ? `装备这架飞机 ${icon("arrow")}` : `${icon("lock")} ${frame.unlockText}`}</button><div class="carousel-dots">${eraFrames.map((candidate) => `<button aria-label="预览 ${candidate.name}" data-preview="${AIRFRAMES.indexOf(candidate)}" class="${frame.id === candidate.id ? "active" : ""}"></button>`).join("")}</div></section>`;
    else if (this.tab === "showroom")
      body = this.showroomPage(frame);
    else
      body = `<section class="placeholder-page"><span class="eyebrow">COMING SOON</span><div class="placeholder-symbol">${icon(tabs.find((t) => t.id === this.tab)!.icon)}</div><h1>${this.tab === "shop" ? "商店即将开放" : "内容准备中"}<span>。</span></h1><p>${this.tab === "shop" ? "未来将在这里发现更多机体与外观。<br>现在，先去天空里收集一些故事。" : "新的飞行故事正在准备。<br>你的下一次出击，无需等待。"}</p><button class="primary" data-tab="sortie">返回出击 ${icon("arrow")}</button></section>`;
    this.ui.innerHTML = `${this.topBar()}${body}${this.nav()}`;
  }
  private partDescription(id: string) {
    return (
      {
        nose: "机头 · 前向机炮与雷达，损坏后火力和锁定减弱",
        leftWing: "左翼 · 可安装发动机或武器，影响左侧转向与迎弹面",
        rightWing: "右翼 · 可安装发动机或武器，影响右侧转向与迎弹面",
        center: "机身 · 核心生命与能量系统，核心归零即坠毁",
        top: "机背 · 自动炮塔挂点，拥有独立旋转与生命",
        bottom: "机腹 · 炸弹舱，损坏后装填变慢或停止",
        tail: "机尾 · 推进器与尾翼，影响极速、惯性与巡航稳定",
      } as Record<string, string>
    )[id];
  }
  private rebuildShowroom(frameId = AIRFRAMES[this.preview]?.id, build = this.showroomBuild) {
    const frame = frameId ? airframeById(frameId) : this.showroom?.player.frame ?? airframeById(this.save.data.equipped);
    this.showroom?.dispose();
    this.showroomBuild = [...build];
    this.showroom = new World(frame, 1, { director: false, supply: false, showroom: true });
    for (const id of this.showroomBuild) {
      const upgrade = upgradeById(id);
      if (upgrade) this.showroom.installUpgrade(upgrade);
    }
    this.renderer?.setPlayer(this.showroom.player);
    this.renderer?.setDisplayOrbit(this.showroomOrbitYaw, this.showroomOrbitPitch);
  }
  private showroomPage(frame: Airframe) {
    const world = this.showroom!;
    const options = world.legalUpgradeOptions;
    const weaponCount = world.player.weapons.reduce((total, weapon) => total + weapon.config.count, 0);
    const selected = this.showroomBuild.map((id, index) =>
      `<li><span>${String(index + 1).padStart(2, "0")}</span>${upgradeById(id)?.name ?? id}</li>`).join("");
    const cards = options.map((upgrade) =>
      `<button class="upgrade-card showroom-upgrade-card ${upgrade.rarity}" data-showroom-upgrade="${upgrade.id}">${planePreview(upgrade.preview)}<div><span class="upgrade-rarity">${upgrade.rarity === "common" ? "标准" : upgrade.rarity === "rare" ? "稀有" : "史诗"} / ${upgrade.tag}</span><h3>${upgrade.name}</h3><p class="upgrade-gain">${upgrade.benefit}</p><p class="upgrade-delta">${this.upgradeComparison(upgrade, world)}</p><small>${upgrade.description}</small></div>${icon("arrow")}</button>`).join("");
    return `<section class="showroom-page"><div class="showroom-stage"><div class="showroom-stage-caption"><span class="eyebrow">AIRCRAFT SHOWROOM</span><strong>${frame.name}</strong><small>拖动展示区环绕观察</small></div><div class="showroom-stage-stats">部件 ${world.player.parts.length} · 炮位 ${world.player.weapons.length} · 枪管 ${weaponCount}</div></div><section class="showroom-controls"><div class="showroom-active"><div><span class="eyebrow">当前生效构型</span><ol>${selected || "<li class=empty-build>原装构型</li>"}</ol></div><div class="showroom-actions"><button class="secondary" data-action="showroom-aircraft">切换机体</button><button class="secondary" data-action="showroom-undo" ${this.showroomBuild.length ? "" : "disabled"}>撤销</button><button class="secondary" data-action="showroom-reset" ${this.showroomBuild.length ? "" : "disabled"}>重置</button><button class="primary" data-action="showroom-fire">试射 ${icon("target")}</button></div></div><div class="showroom-card-list"><span class="eyebrow">可用强化 · ${options.length}</span>${cards || "<p class=empty-build>当前构型没有更多合法卡牌。</p>"}</div><button class="text-button showroom-return" data-tab="sortie">返回出击 ${icon("arrow")}</button></section></section>`;
  }
  private showShowroomAircraftPicker() {
    this.showroomPointer = undefined;
    this.modal = "showroomAircraft";
    const current = this.showroom?.player.frame.id;
    const choices = AIRFRAMES.map((candidate, index) =>
      `<button class="showroom-aircraft ${candidate.id === current ? "selected" : ""}" data-preview="${index}">${candidate.name}<small>${ERAS[eraOf(candidate)].label}</small></button>`).join("");
    this.overlays.innerHTML = dialog("选择展厅机体", `<div class="modal-heading"><span class="eyebrow">AIRCRAFT ROSTER</span><h2>选择机体</h2><p>只改变展厅预览，当前出击装备保持不变。</p></div><div class="showroom-aircraft-picker">${choices}</div>${button("close-modal", "返回展厅", "secondary")}`, "showroom-aircraft-modal");
    this.ui.setAttribute("inert", "");
  }
  private onShowroomPointerDown(e: PointerEvent) {
    const target = e.target as HTMLElement;
    if (this.screen !== "meta" || this.tab !== "showroom" || !this.renderer || target.closest("button,.showroom-aircraft-list,.showroom-card-list")) return;
    this.showroomPointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  private onShowroomPointerMove(e: PointerEvent) {
    if (!this.showroomPointer || this.showroomPointer.id !== e.pointerId) return;
    const dx = e.clientX - this.showroomPointer.x;
    const dy = e.clientY - this.showroomPointer.y;
    this.showroomPointer.x = e.clientX;
    this.showroomPointer.y = e.clientY;
    this.showroomOrbitYaw += dx * .012;
    this.showroomOrbitPitch = Math.max(-.35, Math.min(.55, this.showroomOrbitPitch + dy * .008));
    this.renderer?.setDisplayOrbit(this.showroomOrbitYaw, this.showroomOrbitPitch);
  }
  private onShowroomPointerUp(e: PointerEvent) {
    if (this.showroomPointer?.id === e.pointerId) this.showroomPointer = undefined;
  }
  private launch() {
    if (this.screen !== "meta" || !this.renderer) return;
    this.tab = "sortie";
    this.showMeta();
    this.screen = "launching";
    this.launchTime = 0;
    this.modal = "";
    this.overlays.innerHTML = "";
    this.root.classList.add("launching");
    const button = this.ui.querySelector<HTMLButtonElement>(
      '[data-action="launch"]',
    )!;
    button.disabled = true;
    button.innerHTML =
      `<span><small>${ERAS[eraOf(airframeById(this.save.data.equipped))].mission}</small>准备起飞</span><span class="loading-spinner"></span>`;
    this.audio.play("upgrade");
  }
  private startBattle() {
    this.screen = "battle";
    this.world = new World(airframeById(this.save.data.equipped));
    if (this.renderer) {
      const renderer = this.renderer;
      this.world.isSpawnVisible = (x, y, z, radius) => renderer.isSpawnVisible(x, y, z, radius);
    }
    this.finished = false;
    this.renderer?.setPlayer(this.world.player);
    this.root.classList.remove("launching");
    this.root.classList.add("in-battle");
    this.audio.resetBattle();
    this.lastLock = 0;
    const { mission, label } = ERAS[this.world.era];
    this.battleStatus = new BattleStatus(this.ui, mission, label);
    this.stick.attach(this.ui.querySelector(".stick-surface")!);
    this.stick.enabled = true;
    this.combatHud?.dispose();
    this.combatHud = new CombatHud(this.sceneHost, this.labels);
    this.hudTimer = 1;
    this.modal = "";
    this.overlays.innerHTML = "";
    this.renderer?.render(this.world, 0, { display: false });
    this.updateHud();
  }
  private updateHud() {
    const w = this.world!;
    const p = w.player;
    const maxHealth = w.playerMaxHealth;
    const energy = p.energy / p.stats.energyMax;
    const weapon = w.bombWeapon;
    const cooldownTotal = Math.max(1, 1 / (weapon?.fireRate ?? 1) + p.stats.bombCooldown);
    this.battleStatus?.update({
      text: {
        "health-text": `${Math.ceil(p.health)} / ${Math.round(maxHealth)}`,
        "energy-text": `${Math.round(energy * 100)}%`,
        "battle-time": timeLabel(w.elapsed),
        "battle-score": `${fmt(w.score)} PTS`,
        "level-label": `LV.${String(w.level).padStart(2, "0")}`,
        "kills-label": `击毁 ${w.kills} / 金币 ${w.coins}`,
        "combo-label": w.combo > 1.1 ? `连击 ×${w.combo.toFixed(1)}` : "",
        "wind-label": w.wind.gust > .8 ? "⚑ 强风带" : "↗ 微风",
        "upgrade-count": String(w.upgradesAvailable),
        "flight-mode": w.isBombing ? `准心稳定 ${Math.round(w.stability * 100)}%` : "空战巡航",
        "speed-value": p.speed.toFixed(1),
        "energy-state": p.boostLocked ? "加力耗尽 · 回充中" :
          p.boosting ? `加力中 · 储备 ${Math.round(energy * 100)}%` : energy < .4 ? "加力储备偏低" : "加力就绪",
        "bomb-label": !weapon ? "未装载" : w.bombCooldown > 0 ? `${w.bombCooldown.toFixed(1)}s` :
          w.canBomb ? "投弹" : w.isBombing ? "稳定中" : "待命",
        "bomb-state": !weapon ? "可通过改装增加弹舱" : w.bombCooldown > 0 ? "装填中" :
          w.canBomb ? "落点已锁定" : w.isBombing ? "松杆稳定准心" : "先开启轰炸",
        "quality-readout": `${QUALITIES[this.save.data.quality].label} / ${this.renderer?.fps ?? 0} FPS`,
        "battle-notice": w.notice,
      },
      meters: { "health-fill": p.health / maxHealth, "energy-fill": energy, "xp-fill": w.xp / requiredXp(w.level) },
      bombing: w.isBombing,
      upgradeAvailable: w.upgradesAvailable > 0,
      bombAvailable: Boolean(weapon),
      bombReady: w.canBomb,
      bombProgress: w.bombCooldown > 0 ? 1 - w.bombCooldown / cooldownTotal : w.stability,
      noticeVisible: w.noticeTime > 0,
    });
    this.root.classList.toggle("low-health", p.health / maxHealth < .3);
    this.root.classList.toggle("low-energy", p.boostLocked || p.energy < 8);
    if (w.lockPulse > 0 && this.lastLock === 0) this.audio.play("lock");
    this.lastLock = w.lockPulse;
  }
  private updateCombatHud(dt: number) {
    const w = this.world!, r = this.renderer, hud = this.combatHud;
    if (!r || !hud) return;
    const p = w.player;
    const contacts: ThreatView[] = [];
    const labels: NameplateView[] = [];
    for (const e of w.enemies) {
      if (e.health <= 0) continue;
      const pose = w.actorPose(e);
      const y = pose.y + (e.layer === "air" ? 0 : .8);
      const pos = r.project(e.x, y, e.z);
      const dx = e.x - p.x, dz = e.z - p.z;
      contacts.push({
        id: e.id, x: e.x, y, z: e.z, layer: e.layer, distance: Math.hypot(dx, dz),
        bearing: Math.atan2(dx, dz) - p.heading, firing: e.warning > 0,
        chasing: e.state === "attacking", breaking: e.state === "breaking", onScreen: pos.visible,
        elite: e.kind === "elite", kind: e.kind,
      });
      if (pos.visible) labels.push({
        id: e.id, x: pos.x, y: pos.y, layer: e.layer, health: e.health / e.maxHealth,
        quality: r.isCloudOccluded(e.x, y, e.z) ? .16 : 1,
        label: `${e.kind === "elite" ? "◆ " : ""}${combatantById(e.configId ?? e.kind)?.name ?? e.kind}`,
      });
    }
    const lock = w.mainLock;
    const target = w.enemies.find((e) => e.id === lock?.targetId);
    const targetPose = target && w.actorPose(target);
    const lockPos = targetPose && r.project(targetPose.x, targetPose.y, targetPose.z);
    const lockLabel = lock && lockPos?.visible ? { ...lockPos, y: lockPos.y + 20,
      text: lock.cooldown > 0 ? "导弹装填" : `锁定 ${Math.round(lock.lockProgress * 100)}%` } : undefined;
    const aimPos = w.isBombing ? r.project(w.aim.x, w.surfaceHeight(w.aim.x, w.aim.z) + .2, w.aim.z) : undefined;
    const aimLabel = aimPos?.visible ? { ...aimPos, y: aimPos.y + 35, ready: w.canBomb,
      text: w.canBomb ? "准许投弹" : `稳定 ${Math.round(w.stability * 100)}%` } : undefined;
    hud.update(w.phase, p, contacts, dt);
    hud.updateLabels(labels, lockLabel, aimLabel);
  }
  private showResult() {
    if (this.finished || !this.world) return;
    this.finished = true;
    const w = this.world;
    const previousBest = this.save.data.bestScore;
    const unlocked = this.save.record(w);
    this.screen = "result";
    this.stick.enabled = false;
    this.stick.reset();
    this.modal = "";
    this.labels.innerHTML = "";
    this.combatHud?.dispose();
    this.combatHud = undefined;
    this.battleStatus = undefined;
    this.ui.removeAttribute("inert");
    this.root.classList.remove("in-battle", "low-health", "low-energy");
    this.root.classList.add("result-active");
    this.overlays.innerHTML = "";
    this.ui.innerHTML = `<div class="result-page"><span class="eyebrow">FLIGHT REPORT / ${String(this.save.data.sorties).padStart(3, "0")}</span><h1>${w.player.health > 0 ? "平安返航" : "航迹永不消失"}<span>。</span></h1><p>${w.player.health > 0 ? "带着新的经验，准备下一次出击。" : "每一次尝试，都让下一次飞行更远。"}</p><div class="result-score"><small>本次积分 ${w.score > previousBest ? "<b>NEW BEST</b>" : ""}</small><strong>${fmt(w.score)}</strong></div><div class="result-grid"><div><span>巡航时间</span><b>${timeLabel(w.elapsed)}</b></div><div><span>击毁目标</span><b>${w.kills}</b></div><div><span>收集金币</span><b>+${w.coins}</b></div><div><span>最终等级</span><b>LV.${w.level}</b></div><div><span>安装部件</span><b>${w.player.upgrades.length}</b></div><div><span>投弹命中</span><b>${w.bombsHit} / ${w.bombsDropped}</b></div></div>${unlocked.map((f) => `<div class="unlock-banner">${icon("shield")}新机体已解锁 · ${f.name}</div>`).join("")}<div class="result-aircraft">${icon("plane")}<div><b>${w.player.frame.name}</b><span>${
      w.player.upgrades.length
        ? w.player.upgrades
            .map((id) => id.replaceAll("_", " "))
            .slice(-3)
            .join(" / ")
        : "初始构型"
    } · 最终构型</span></div></div><button class="primary" data-action="retry">再次出击 ${icon("arrow")}</button><button class="secondary" data-action="home">返回机库</button><small class="result-best">历史最高 ${fmt(this.save.data.bestScore)} PTS · 最长巡航 ${timeLabel(this.save.data.bestTime)}</small></div>`;
    this.save.persist();
  }
  private upgradeComparison(u: Upgrade, source = this.world) {
    const p = source!.player;
    const names: Partial<Record<keyof Stats, string>> = {
      maxSpeed: "极速",
      acceleration: "加速",
      turnRate: "转向",
      energyMax: "加力储备",
      health: "生命",
      wingspan: "翼展",
      length: "机长",
      energyRecover: "恢复",
      lockTime: "锁定修正",
      bombCooldown: "装填修正",
      damage: "火力倍率",
      bombSettle: "稳定倍率",
    };
    const keys = [
      ...new Set([
        ...Object.keys(u.add ?? {}),
        ...Object.keys(u.multiply ?? {}),
      ]),
    ] as (keyof Stats)[];
    const changes = keys
      .filter((key) => names[key])
      .slice(0, 2)
      .map((key) => {
        const before = p.stats[key],
          after = (before + (u.add?.[key] ?? 0)) * (u.multiply?.[key] ?? 1);
        return `${names[key]} ${Number(before.toFixed(1))} → ${Number(after.toFixed(1))}`;
      });
    if (!changes.length)
      changes.push(
        `武器 ${p.weapons.length} → ${p.weapons.length + (u.weapons?.length ?? 0)}`,
      );
    return changes.join(" · ");
  }
  private showModal(kind: Modal) {
    if (!kind) {
      this.closeModal();
      return;
    }
    if (kind === "settings" || kind === "help") {
      this.settingsReturn = this.modal === "pause" ? "pause" : "";
      if (this.world && this.screen === "battle" && this.world.pause())
        this.settingsReturn = "pause";
    }
    this.stick.reset();
    this.stick.enabled = false;
    this.previousFocus = document.activeElement as HTMLElement;
    this.modal = kind;
    let content = "";
    if (kind === "settings")
      content = `<div class="modal-heading"><span class="eyebrow">FLIGHT PREFERENCES</span><h2>飞行设置</h2></div><label class="setting-row"><span><b>画面质量</b><small>自动调节分辨率以保持流畅</small></span><select id="quality-select" aria-label="画面质量">${Object.entries(
        QUALITIES,
      )
        .map(
          ([id, q]) =>
            `<option value="${id}" ${this.save.data.quality === id ? "selected" : ""}>${q.label}</option>`,
        )
        .join(
          "",
        )}</select></label><label class="setting-row"><span><b>音效</b><small>命中、拾取与系统反馈</small></span><input type="checkbox" id="sound-setting" ${this.save.data.sound ? "checked" : ""}></label><label class="setting-row"><span><b>触觉反馈</b><small>在支持的设备上轻微振动</small></span><input type="checkbox" id="vibration-setting" ${this.save.data.vibration ? "checked" : ""}></label><div class="settings-foot">最高积分 ${fmt(this.save.data.bestScore)} · 出击 ${this.save.data.sorties} 次<br>${this.save.available ? "飞行记录已保存在当前浏览器" : "当前浏览器无法持久保存，记录暂存于本次会话"}</div><button class="primary" data-action="close-modal">完成 ${icon("check")}</button>`;
    if (kind === "help")
      content = `<div class="modal-heading"><span class="eyebrow">YOUR FIRST SORTIE</span><h2>让第一次飞行更从容。</h2></div><div class="help-step">${icon("plane")}<div><b>拖动中央摇杆</b><p>方向决定航向，拉得越远加速越快。松手巡航并恢复能量。</p></div></div><div class="help-step">${icon("target")}<div><b>把目标留在前方</b><p>机炮自动开火。导弹需要保持目标在扇形内，直到锁定完成。</p></div></div><div class="help-step">${icon("bomb")}<div><b>切换轰炸，松杆稳定</b><p>准心变绿后点击投弹，清除地面目标。投弹后需要等待装填。</p></div></div><div class="help-step">${icon("wrench")}<div><b>收集金币，改装座驾</b><p>升级次数可以累积。点击改装升级暂停战斗，从三个部件中选择一个。</p></div></div><p class="keyboard-help">电脑：WASD / 方向键驾驶 · B 轰炸模式 · 空格投弹 · U 升级 · P / Esc 暂停</p><button class="primary" data-action="close-modal">明白了 ${icon("arrow")}</button>`;
    if (kind === "pause")
      content = `<div class="pause-emblem">${icon("pause")}</div><div class="modal-heading"><span class="eyebrow">TAKE A BREATH</span><h2>航线已为你保留。</h2><p>战斗、弹道与风场已暂停。</p></div>${button("resume", `继续飞行 ${icon("play")}`, "primary")}${button("settings", `飞行设置 ${icon("gear")}`, "secondary")}${button("retreat", "结束本次飞行并结算", "text-button retreat-button")}`;
    if (kind === "upgrade" && this.world)
      content = `<div class="modal-heading"><span class="eyebrow">FIELD MODIFICATION / LV.${this.world.level}</span><h2>为下一段航线改装<span>。</span></h2><p>选择一个部件 · 战斗已暂停 · 可用 ${this.world.upgradesAvailable} 次</p></div><div class="upgrade-choices">${this.world.choices.map((u) => `<button class="upgrade-card ${u.rarity}" data-upgrade="${u.id}">${planePreview(u.preview)}<div><span class="upgrade-rarity">${u.rarity === "common" ? "标准" : u.rarity === "rare" ? "稀有" : "史诗"} / ${u.tag}</span><h3>${u.name}</h3><p class="upgrade-gain">${u.benefit}</p><p class="upgrade-cost">${u.cost}</p><p class="upgrade-delta">${this.upgradeComparison(u)}</p><small>${u.description}</small></div>${icon("arrow")}</button>`).join("")}</div>`;
    const label = { settings: "飞行设置", help: "飞行指南", pause: "暂停游戏", upgrade: "选择升级", showroomAircraft: "选择展厅机体" }[kind] ?? "页面";
    const close = kind === "settings" || kind === "help"
      ? button("close-modal", icon("close"), "icon-button modal-close", 'aria-label="关闭"')
      : "";
    this.overlays.innerHTML = dialog(label, close + content, kind === "upgrade" ? "upgrade-modal" : "");
    this.ui.setAttribute("inert", "");
    requestAnimationFrame(() =>
      this.overlays
        .querySelector<HTMLElement>("button, select, input")
        ?.focus(),
    );
  }
  private closeModal() {
    if (this.modal === "upgrade") return;
    if (
      (this.modal === "settings" || this.modal === "help") &&
      this.settingsReturn === "pause"
    ) {
      this.settingsReturn = "";
      this.showModal("pause");
      return;
    }
    this.modal = "";
    this.overlays.innerHTML = "";
    this.ui.removeAttribute("inert");
    this.stick.enabled = this.screen === "battle";
    this.previousFocus?.focus();
  }
  private pause() {
    if (this.screen === "battle" && this.world?.pause())
      this.showModal("pause");
  }
  private resume() {
    this.world?.resume();
    this.modal = "";
    this.overlays.innerHTML = "";
    this.ui.removeAttribute("inert");
    this.stick.reset();
    this.stick.enabled = true;
  }
  private toast(text: string) {
    this.toastElement.textContent = text;
    this.toastElement.classList.add("show");
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(
      () => this.toastElement.classList.remove("show"),
      2500,
    );
  }
  private browse(index: number) {
    this.preview = (index + AIRFRAMES.length) % AIRFRAMES.length;
    this.highlight = "";
    this.showMeta();
  }
  private browseEra(step: number) {
    const current = AIRFRAMES[this.preview];
    const group = AIRFRAMES.filter((frame) => eraOf(frame) === eraOf(current));
    const next = group[(group.indexOf(current) + group.length + step) % group.length];
    this.browse(AIRFRAMES.indexOf(next));
  }
  private onClick(e: MouseEvent) {
    const el = (e.target as HTMLElement).closest<HTMLElement>(
      "button,[data-tab]",
    );
    if (!el || (el as HTMLButtonElement).disabled || el.closest("[inert]"))
      return;
    this.audio.unlock();
    this.audio.play("click");
    if (el.dataset.tab) {
      this.setTab(el.dataset.tab as Tab);
      return;
    }
    if (el.dataset.preview) {
      this.browse(Number(el.dataset.preview));
      if (this.modal === "showroomAircraft") {
        this.modal = "";
        this.overlays.innerHTML = "";
        this.ui.removeAttribute("inert");
      }
      return;
    }
    if (el.dataset.part) {
      this.highlight =
        this.highlight === el.dataset.part ? "" : el.dataset.part;
      this.showMeta();
      return;
    }
    if (el.dataset.upgrade) {
      if (this.world?.chooseUpgrade(el.dataset.upgrade)) {
        this.modal = "";
        this.overlays.innerHTML = "";
        this.ui.removeAttribute("inert");
        this.stick.enabled = true;
        this.audio.play("upgrade");
        this.hudTimer = 1;
      }
      return;
    }
    if (el.dataset.showroomUpgrade && this.showroom) {
      const upgrade = upgradeById(el.dataset.showroomUpgrade);
      if (upgrade && this.showroom.legalUpgradeOptions.some((candidate) => candidate.id === upgrade.id)) {
        this.showroomBuild.push(upgrade.id);
        this.rebuildShowroom(undefined, this.showroomBuild);
        this.showMeta();
      }
      return;
    }
    switch (el.dataset.action) {
      case "launch":
        this.launch();
        break;
      case "previous":
        this.browseEra(-1);
        break;
      case "next":
        this.browseEra(1);
        break;
      case "equip":
        if (this.save.equip(AIRFRAMES[this.preview].id)) {
          this.setTab("sortie");
          this.toast(`已装备 ${AIRFRAMES[this.preview].name}`);
        }
        break;
      case "settings":
        this.showModal("settings");
        break;
      case "help":
        this.showModal("help");
        break;
      case "close-modal":
        this.closeModal();
        break;
      case "pause":
        this.pause();
        break;
      case "resume":
        this.resume();
        break;
      case "retreat":
        this.world?.end();
        this.showResult();
        break;
      case "home":
        this.world = undefined;
        this.ui.removeAttribute("inert");
        this.setTabFromResult();
        break;
      case "retry":
        this.world = undefined;
        this.ui.removeAttribute("inert");
        this.screen = "meta";
        this.launch();
        break;
      case "upgrade":
        if (this.world?.openUpgrades()) this.showModal("upgrade");
        break;
      case "bomb-mode":
        this.world?.toggleBombing();
        this.stick.reset();
        this.hudTimer = 1;
        break;
      case "bomb":
        this.world?.dropBomb();
        this.hudTimer = 1;
        break;
      case "reload":
        location.reload();
        break;
      case "showroom-aircraft":
        this.showShowroomAircraftPicker();
        break;
      case "showroom-fire":
        this.showroom?.previewFire();
        break;
      case "showroom-undo":
        if (this.showroomBuild.length) {
          this.rebuildShowroom(undefined, this.showroomBuild.slice(0, -1));
          this.showMeta();
        }
        break;
      case "showroom-reset":
        this.rebuildShowroom();
        this.showMeta();
        break;
    }
  }
  private setTabFromResult() {
    this.screen = "meta";
    this.tab = "sortie";
    this.showMeta();
    history.replaceState(null, "", "#sortie");
  }
  private onChange(e: Event) {
    const el = e.target as HTMLInputElement;
    if (el.id === "quality-select") {
      this.save.data.quality = el.value as Quality;
      this.renderer?.setQuality(this.save.data.quality);
    }
    if (el.id === "sound-setting") {
      this.save.data.sound = el.checked;
      this.audio.enabled = el.checked;
      this.audio.unlock();
    }
    if (el.id === "vibration-setting") {
      this.save.data.vibration = el.checked;
      this.audio.vibration = el.checked;
    }
    this.save.persist();
  }
  private onKey(e: KeyboardEvent, down: boolean) {
    if (down && e.code === "Tab" && this.modal) {
      const focusables = Array.from(
        this.overlays.querySelectorAll<HTMLElement>(
          "button:not(:disabled), select, input",
        ),
      );
      const first = focusables[0],
        last = focusables.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
    if (this.screen !== "battle") {
      if (down && e.code === "Escape" && this.modal) this.closeModal();
      return;
    }
    const movement = [
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
      "ArrowUp",
      "ArrowDown",
      "ShiftLeft",
      "ShiftRight",
      "ArrowLeft",
      "ArrowRight",
    ];
    if (movement.includes(e.code)) {
      if (
        this.modal ||
        /INPUT|SELECT|TEXTAREA/.test((e.target as HTMLElement).tagName)
      )
        return;
      e.preventDefault();
      this.stick.key(e.code, down);
      if (down) this.keyboardUsed = true;
      return;
    }
    if (!down || e.repeat) return;
    if (e.code === "Escape" || e.code === "KeyP") {
      e.preventDefault();
      if (this.modal === "pause") this.resume();
      else if (this.modal && this.modal !== "upgrade") this.closeModal();
      else this.pause();
    }
    if (this.modal) return;
    this.audio.unlock();
    if (e.code === "KeyB") {
      this.world?.toggleBombing();
      this.hudTimer = 1;
    }
    if (e.code === "Space") {
      e.preventDefault();
      this.world?.dropBomb();
    }
    if (e.code === "KeyU" && this.world?.openUpgrades())
      this.showModal("upgrade");
  }
  private loop(timestamp: number) {
    const dt = this.previous
      ? Math.min(0.12, (timestamp - this.previous) / 1000)
      : 1 / 60;
    this.previous = timestamp;
    if (!document.hidden) {
      if (this.screen === "meta" || this.screen === "launching") {
        const previewWorld = this.tab === "showroom" ? this.showroom : undefined;
        const p = previewWorld?.player ?? this.displayWorld.player;
        if (!previewWorld) p.z +=
          (this.screen === "launching" ? 8 + this.launchTime * 20 : 2) * dt;
        if (this.screen === "launching") this.launchTime += dt;
        const events = previewWorld?.consumeEvents();
        this.renderer?.render(previewWorld, dt, {
          display: true,
          showroom: !!previewWorld,
          highlight: this.highlight,
          launching: this.launchTime,
          events,
        });
        if (this.screen === "launching" && this.launchTime >= 0.8)
          this.startBattle();
      }
      if (this.screen === "battle" && this.world) {
        const world = this.world;
        this.stick.setFlightState(world.player.energy > 0, world.isBombing, world.player.boostLocked);
        world.frame(dt, this.stick.read(dt));
        const events = this.world.consumeEvents();
        this.combatHud?.consume(events);
        this.audio.consumeBattle(events);
        this.renderer?.render(this.world, dt, { display: false, events });
        this.updateCombatHud(dt);
        this.hudTimer += dt;
        if (this.hudTimer > 0.09) {
          this.updateHud();
          this.hudTimer = 0;
        }
        if (this.world.phase === "result") this.showResult();
      } else if (this.screen === "result" && this.world)
        this.renderer?.render(this.world, dt, { display: false });
    }
    this.root.classList.toggle("keyboard-controls", this.keyboardUsed);
    requestAnimationFrame((t) => this.loop(t));
  }
}
