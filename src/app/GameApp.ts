import { AIRFRAMES, STARTER_FRAME_ID, airframeById, eraOf, type EraId } from "../data/aircrafts";
import { ERAS } from "../data/eras";
import { combatantById } from "../data/combatants";
import { QUALITIES, RULES, type Quality } from "../data/config";
import { World, requiredXp } from "../simulation/World";
import { Renderer } from "../rendering/Renderer";
import { cloudDiagnostics } from "../rendering/RenderDiagnostics";
import { SaveStore } from "../services/Save";
import { GameAudio } from "../services/Audio";
import { VirtualStick } from "../input/VirtualStick";

import { icon } from "../content/2d/icons";
import { CombatHud, type NameplateView } from "../content/2d/CombatHud";
import { BattleStatus, resolveBombAvailability } from "../content/2d/BattleStatus";
import { button, dialog } from "../content/2d/components";
import {
  META_TABS,
  formatCount,
  renderBottomNav,
  renderEquipmentBody,
  renderPlaceholderBody,
  renderSortieBody,
  renderTopBar,
  updateEquipmentPartHighlight,
  type MetaTab,
} from "../content/2d/HangarView";
import {
  patchShowroomPanel,
  renderShowroomAircraftPicker,
  renderShowroomBody,
} from "../content/2d/ShowroomView";
import {
  formatClock,
  renderHelpModal,
  renderMissionModal,
  renderPauseModal,
  renderResultPage,
  renderSettingsModal,
  renderUpgradeModal,
} from "../content/2d/ModalViews";
import type { ThreatView } from "../content/2d/combatHints";
import { resolveAircraftModel } from "../content/3d/aircraftModels";

type Modal = "" | "settings" | "help" | "pause" | "upgrade" | "showroomAircraft" | "mission";
const missionEras = Object.keys(ERAS) as EraId[];

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
  private tab: MetaTab = "sortie";
  private sortieEra: EraId = "pioneer";
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
  private combatHud?: CombatHud;
  private battleStatus?: BattleStatus;

  constructor(private root: HTMLElement) {
    this.displayWorld = new World(this.sortieFrame, 1);
    this.audio.enabled = this.save.data.sound;
    this.audio.vibration = this.save.data.vibration;
    root.innerHTML = `<section class="game-shell" aria-label="云端骑士游戏"><div class="scene-host"></div><div class="scene-vignette"></div><div class="world-labels" aria-hidden="true"></div><div class="ui-layer"></div><div class="overlay-layer"></div><div class="toast" role="status" aria-live="polite"></div></section>`;
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
            get cloud() {
              return cloudDiagnostics.get(this.renderer);
            },
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
      this.sceneHost.innerHTML = `<div class="render-fallback">${icon("plane")}<h2>让天空重新亮起来</h2><p>当前浏览器无法创建 WebGL 场景。<br>请开启硬件加速，或使用支持 WebGL 的浏览器。</p><button type="button" class="btn btn-md btn-primary" data-action="reload">重新加载</button></div>`;
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
    const valid = META_TABS.find((t) => t.id === (value === "reservedB" ? "showroom" : value));
    this.tab = valid?.id ?? "sortie";
    this.preview = AIRFRAMES.findIndex((f) => f.id === this.save.data.equipped);
    this.showMeta();
  }

  private setTab(tab: MetaTab) {
    if (this.screen !== "meta") return;
    if (tab !== "showroom" && this.showroom) {
      this.showroom.dispose();
      this.showroom = undefined;
      this.showroomBuild = [];
    }
    this.tab = tab;
    this.highlight = "";
    if (tab === "equipment" || tab === "showroom") {
      this.preview = AIRFRAMES.findIndex((f) => f.id === this.save.data.equipped);
    }
    if (tab === "showroom") this.rebuildShowroom(undefined, []);
    history.replaceState(null, "", `#${tab}`);
    this.showMeta();
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
        : this.sortieFrame;

    if (this.tab === "showroom") {
      if (!this.showroom || this.showroom.player.frame.id !== frame.id) {
        this.rebuildShowroom(frame.id, []);
      }
      this.renderer?.setPlayer(this.showroom!.player);
      this.renderer?.setDisplayOrbit(this.showroomOrbitYaw, this.showroomOrbitPitch);
    } else {
      if (this.displayWorld.player.frame.id !== frame.id) {
        this.displayWorld.dispose();
        this.displayWorld = new World(frame, 1);
      }
      this.renderer?.setPlayer(this.displayWorld.player);
    }

    this.root
      .querySelector(".game-shell")!
      .classList.toggle("equipment-view", this.tab === "equipment");

    const modelError = resolveAircraftModel(frame).error;
    const mission = ERAS[this.sortieEra];
    const missionNumber = String(missionEras.indexOf(this.sortieEra) + 1).padStart(2, "0");

    let body = "";
    if (this.tab === "sortie") {
      body = renderSortieBody({
        frame,
        sortieEra: this.sortieEra,
        missionNumber,
        missionName: mission.mission,
        eraLabel: mission.label,
        bestScore: this.save.data.bestScore,
        canLaunch: Boolean(this.renderer && !modelError),
        modelError,
      });
    } else if (this.tab === "equipment") {
      body = renderEquipmentBody({
        frame,
        unlocked: this.save.data.unlocked,
        equippedId: this.save.data.equipped,
        highlight: this.highlight,
        modelError,
      });
    } else if (this.tab === "showroom") {
      body = renderShowroomBody({
        frame,
        world: this.showroom,
        build: this.showroomBuild,
        modelError,
      });
    } else {
      body = renderPlaceholderBody(this.tab);
    }

    this.ui.innerHTML = `${renderTopBar(this.save.playerLevel, this.save.data.currency)}${body}${renderBottomNav(this.tab)}`;
    if (this.tab === "equipment") {
      this.ui.querySelector(".roster-chip.active")?.scrollIntoView({ inline: "nearest", block: "nearest" });
    }
  }

  private rebuildShowroom(frameId = AIRFRAMES[this.preview]?.id, build = this.showroomBuild) {
    const frame = frameId
      ? airframeById(frameId)
      : this.showroom?.player.frame ?? airframeById(this.save.data.equipped);
    this.showroom?.dispose();
    this.showroomBuild = [...build];
    this.showroom = new World(frame, 1, { director: false, supply: false, showroom: true });
    for (const id of this.showroomBuild) {
      const upgrade = this.showroom.legalUpgradeOptions.find((option) => option.id === id);
      if (upgrade) this.showroom.installUpgrade(upgrade);
    }
    this.renderer?.setPlayer(this.showroom.player);
    this.renderer?.setDisplayOrbit(this.showroomOrbitYaw, this.showroomOrbitPitch);
  }

  private updateShowroomPanel() {
    if (!this.showroom || !patchShowroomPanel(this.ui, this.showroom, this.showroomBuild)) {
      this.showMeta();
    }
  }

  private showShowroomAircraftPicker() {
    this.showroomPointer = undefined;
    this.modal = "showroomAircraft";
    const close = button("close-modal", icon("close"), "icon-button modal-close", 'aria-label="关闭"');
    this.overlays.innerHTML = dialog(
      "选择展厅机体",
      close + renderShowroomAircraftPicker(this.showroom?.player.frame.id),
      "showroom-aircraft-modal",
    );
    this.ui.setAttribute("inert", "");
  }

  private onShowroomPointerDown(e: PointerEvent) {
    const target = e.target as HTMLElement;
    if (
      this.screen !== "meta" ||
      this.tab !== "showroom" ||
      !this.renderer ||
      target.closest("button,.showroom-controls,.showroom-stage-actions")
    )
      return;
    this.showroomPointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  private onShowroomPointerMove(e: PointerEvent) {
    if (!this.showroomPointer || this.showroomPointer.id !== e.pointerId) return;
    const dx = e.clientX - this.showroomPointer.x;
    const dy = e.clientY - this.showroomPointer.y;
    this.showroomPointer.x = e.clientX;
    this.showroomPointer.y = e.clientY;
    this.showroomOrbitYaw += dx * 0.012;
    this.showroomOrbitPitch = Math.max(-0.35, Math.min(0.55, this.showroomOrbitPitch + dy * 0.008));
    this.renderer?.setDisplayOrbit(this.showroomOrbitYaw, this.showroomOrbitPitch);
  }

  private onShowroomPointerUp(e: PointerEvent) {
    if (this.showroomPointer?.id === e.pointerId) this.showroomPointer = undefined;
  }

  private get sortieFrame() {
    return airframeById(this.sortieEra === "pioneer" ? STARTER_FRAME_ID : this.save.data.equipped);
  }

  private launch() {
    if (this.screen !== "meta" || !this.renderer || resolveAircraftModel(this.sortieFrame).error) return;
    this.tab = "sortie";
    this.showMeta();
    this.screen = "launching";
    this.launchTime = 0;
    this.modal = "";
    this.overlays.innerHTML = "";
    this.root.classList.add("launching");
    const launchBtn = this.ui.querySelector<HTMLButtonElement>('[data-action="launch"]')!;
    launchBtn.disabled = true;
    launchBtn.innerHTML = `<span>准备起飞</span><span class="loading-spinner"></span>`;
    this.audio.play("upgrade");
  }

  private startBattle() {
    this.screen = "battle";
    this.world = new World(this.sortieFrame, undefined, { missionEra: this.sortieEra });
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
    const bomb = resolveBombAvailability({
      hasWeapon: Boolean(weapon),
      bombing: w.isBombing,
      bombFactor: p.damage.bombFactor,
      cooldown: w.bombCooldown,
      validAim: w.validBombAim,
      stability: w.stability,
      canBomb: w.canBomb,
    });

    this.battleStatus?.update({
      text: {
        "health-text": `${Math.ceil(p.health)}/${Math.round(maxHealth)}`,
        "energy-text": `${Math.round(energy * 100)}%`,
        "battle-time": formatClock(w.elapsed),
        "battle-score": `${formatCount(w.score)} PTS`,
        "level-label": `LV.${String(w.level).padStart(2, "0")}`,
        "kills-label": `击毁 ${w.kills} · 金币 ${w.coins}`,
        "combo-label": w.combo > 1.1 ? `连击 ×${w.combo.toFixed(1)}` : "",
        "wind-label": w.wind.gust > 0.8 ? "⚑ 强风" : "↗ 微风",
        "upgrade-count": String(w.upgradesAvailable),
        "flight-mode": w.isBombing ? `稳定 ${Math.round(w.stability * 100)}%` : "空战巡航",
        "speed-value": p.speed.toFixed(1),
        "energy-state": p.boostLocked
          ? "回充中"
          : p.boosting
            ? `加力 ${Math.round(energy * 100)}%`
            : energy < 0.4
              ? "储备偏低"
              : "加力就绪",
        "bomb-label": bomb.label,
        "bomb-state": bomb.state,
        "quality-readout": `${QUALITIES[this.save.data.quality].label} ${this.renderer?.fps ?? 0}FPS`,
        "battle-notice": w.notice,
      },
      meters: {
        "health-fill": p.health / maxHealth,
        "energy-fill": energy,
        "xp-fill": w.xp / requiredXp(w.level),
      },
      bombing: w.isBombing,
      upgradeAvailable: w.upgradesAvailable > 0,
      bombAvailable: bomb.canToggleBombing,
      bombReady: w.canBomb,
      bombStatus: bomb.status,
      bombModeTitle: bomb.modeTitle,
      bombProgress: w.bombCooldown > 0 ? 1 - w.bombCooldown / cooldownTotal : w.stability,
      noticeVisible: w.noticeTime > 0,
    });
    this.root.classList.toggle("low-health", p.health / maxHealth < 0.3);
    this.root.classList.toggle("low-energy", p.boostLocked || p.energy < 8);
    if (w.lockPulse > 0 && this.lastLock === 0) this.audio.play("lock");
    this.lastLock = w.lockPulse;
  }

  private updateCombatHud(dt: number) {
    const w = this.world!;
    const r = this.renderer;
    const hud = this.combatHud;
    if (!r || !hud) return;
    const p = w.player;
    const contacts: ThreatView[] = [];
    const labels: NameplateView[] = [];
    for (const e of w.enemies) {
      if (e.health <= 0) continue;
      const pose = w.actorPose(e);
      const y = pose.y + (e.layer === "air" ? 0 : 0.8);
      const pos = r.project(e.x, y, e.z);
      const dx = e.x - p.x;
      const dz = e.z - p.z;
      contacts.push({
        id: e.id,
        x: e.x,
        y,
        z: e.z,
        layer: e.layer,
        distance: Math.hypot(dx, dz),
        bearing: Math.atan2(dx, dz) - p.heading,
        firing: e.warning > 0,
        chasing: e.state === "attacking",
        breaking: e.state === "breaking",
        onScreen: pos.visible,
        elite: e.kind === "elite",
        kind: e.kind,
      });
      if (pos.visible) {
        labels.push({
          id: e.id,
          x: pos.x,
          y: pos.y,
          layer: e.layer,
          health: e.health / e.maxHealth,
          quality: r.isCloudOccluded(e.x, y, e.z) ? 0.16 : 1,
          label: `${e.kind === "elite" ? "◆ " : ""}${combatantById(e.configId ?? e.kind)?.name ?? e.kind}`,
        });
      }
    }
    const lock = w.mainLock;
    const target = w.enemies.find((e) => e.id === lock?.targetId);
    const targetPose = target && w.actorPose(target);
    const lockPos = targetPose && r.project(targetPose.x, targetPose.y, targetPose.z);
    const lockLabel =
      lock && lockPos?.visible
        ? {
            ...lockPos,
            y: lockPos.y + 18,
            text: lock.cooldown > 0 ? "导弹装填" : `锁定 ${Math.round(lock.lockProgress * 100)}%`,
          }
        : undefined;
    const aimPos = w.isBombing
      ? r.project(w.aim.x, w.surfaceHeight(w.aim.x, w.aim.z) + 0.2, w.aim.z)
      : undefined;
    const aimLabel = aimPos?.visible
      ? {
          ...aimPos,
          y: aimPos.y + 32,
          ready: w.canBomb,
          text: w.canBomb
            ? "准许投弹"
            : w.player.damage.bombFactor <= 0
              ? "弹舱损毁"
              : !w.validBombAim
                ? "超出包线"
                : `稳定 ${Math.round(w.stability * 100)}%`,
        }
      : undefined;
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
    this.ui.innerHTML = renderResultPage({
      world: w,
      sorties: this.save.data.sorties,
      previousBest,
      bestScore: this.save.data.bestScore,
      bestTime: this.save.data.bestTime,
      unlocked,
    });
    this.save.persist();
  }

  private showModal(kind: Modal) {
    if (!kind) {
      this.closeModal();
      return;
    }
    if (kind === "settings" || kind === "help") {
      this.settingsReturn = this.modal === "pause" ? "pause" : "";
      if (this.world && this.screen === "battle" && this.world.pause()) this.settingsReturn = "pause";
    }
    this.stick.reset();
    this.stick.enabled = false;
    this.previousFocus = document.activeElement as HTMLElement;
    this.modal = kind;

    let content = "";
    if (kind === "settings") {
      content = renderSettingsModal({
        quality: this.save.data.quality,
        sound: this.save.data.sound,
        vibration: this.save.data.vibration,
        bestScore: this.save.data.bestScore,
        sorties: this.save.data.sorties,
        storageAvailable: this.save.available,
      });
    } else if (kind === "help") {
      content = renderHelpModal();
    } else if (kind === "pause") {
      content = renderPauseModal();
    } else if (kind === "mission") {
      content = renderMissionModal(missionEras, this.sortieEra, this.save.data.equipped);
    } else if (kind === "upgrade" && this.world) {
      content = renderUpgradeModal(this.world);
    }

    const label =
      {
        settings: "飞行设置",
        help: "飞行指南",
        pause: "暂停游戏",
        upgrade: "选择升级",
        showroomAircraft: "选择展厅机体",
        mission: "选择关卡",
      }[kind] ?? "页面";
    const close =
      kind === "settings" || kind === "help" || kind === "mission"
        ? button("close-modal", icon("close"), "icon-button modal-close", 'aria-label="关闭"')
        : "";
    this.overlays.innerHTML = dialog(label, close + content, kind === "upgrade" ? "upgrade-modal" : "");
    this.ui.setAttribute("inert", "");
    requestAnimationFrame(() =>
      this.overlays.querySelector<HTMLElement>("button, select, input")?.focus(),
    );
  }

  private closeModal() {
    if (this.modal === "upgrade") return;
    if ((this.modal === "settings" || this.modal === "help") && this.settingsReturn === "pause") {
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
    if (this.screen === "battle" && this.world?.pause()) this.showModal("pause");
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
    this.toastTimer = setTimeout(() => this.toastElement.classList.remove("show"), 2500);
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
    const el = (e.target as HTMLElement).closest<HTMLElement>("button,[data-tab]");
    if (!el || (el as HTMLButtonElement).disabled || el.closest("[inert]")) return;
    this.audio.unlock();
    this.audio.play("click");

    if (el.dataset.tab) {
      this.setTab(el.dataset.tab as MetaTab);
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
      this.highlight = this.highlight === el.dataset.part ? "" : el.dataset.part;
      const frame = AIRFRAMES[this.preview];
      updateEquipmentPartHighlight(this.ui, frame, this.highlight, resolveAircraftModel(frame).error);
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
      const upgrade = this.showroom.legalUpgradeOptions.find(
        (candidate) => candidate.id === el.dataset.showroomUpgrade,
      );
      if (upgrade) {
        this.showroomBuild.push(upgrade.id);
        this.rebuildShowroom(undefined, this.showroomBuild);
        this.updateShowroomPanel();
      }
      return;
    }

    switch (el.dataset.action) {
      case "missions":
        if (this.screen === "meta" && this.tab === "sortie") this.showModal("mission");
        break;
      case "select-mission": {
        const selected = missionEras.find((id) => id === el.dataset.mission);
        if (this.screen !== "meta" || this.modal !== "mission" || !selected) break;
        this.sortieEra = selected;
        this.showMeta();
        this.ui.querySelector<HTMLElement>(".mission-select")?.focus();
        break;
      }
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
        if (resolveAircraftModel(AIRFRAMES[this.preview]).model && this.save.equip(AIRFRAMES[this.preview].id)) {
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
      case "reference":
        location.href = `${location.pathname}?reference=1`;
        break;
      case "showroom-undo":
        if (this.showroomBuild.length) {
          this.rebuildShowroom(undefined, this.showroomBuild.slice(0, -1));
          this.updateShowroomPanel();
        }
        break;
      case "showroom-reset":
        if (this.showroomBuild.length) {
          this.rebuildShowroom(undefined, []);
          this.updateShowroomPanel();
        }
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
        this.overlays.querySelectorAll<HTMLElement>("button:not(:disabled), select, input"),
      );
      const first = focusables[0];
      const last = focusables.at(-1);
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
      if (this.modal || /INPUT|SELECT|TEXTAREA/.test((e.target as HTMLElement).tagName)) return;
      e.preventDefault();
      this.stick.key(e.code, down);
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
    if (e.code === "KeyU" && this.world?.openUpgrades()) this.showModal("upgrade");
  }

  private loop(timestamp: number) {
    const dt = this.previous ? Math.min(0.12, (timestamp - this.previous) / 1000) : 1 / 60;
    this.previous = timestamp;
    if (!document.hidden) {
      if (this.screen === "meta" || this.screen === "launching") {
        const previewWorld = this.tab === "showroom" ? this.showroom : undefined;
        const p = previewWorld?.player ?? this.displayWorld.player;
        if (!previewWorld) p.z += (this.screen === "launching" ? 8 + this.launchTime * 20 : 2) * dt;
        if (this.screen === "launching") this.launchTime += dt;
        const events = previewWorld?.consumeEvents();
        this.renderer?.render(previewWorld, dt, {
          display: true,
          missionEra: this.tab === "sortie" ? this.sortieEra : undefined,
          showroom: !!previewWorld,
          highlight: this.highlight,
          launching: this.launchTime,
          events,
        });
        if (this.screen === "launching" && this.launchTime >= 0.8) this.startBattle();
      }
      if (this.screen === "battle" && this.world) {
        const world = this.world;
        world.frame(dt, () => {
          this.stick.setFlightState(world.player.energy > 0, world.isBombing, world.player.boostLocked);
          return this.stick.read(RULES.step);
        });
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
      } else if (this.screen === "result" && this.world) {
        this.renderer?.render(this.world, dt, { display: false });
      }
    }
    requestAnimationFrame((t) => this.loop(t));
  }
}
