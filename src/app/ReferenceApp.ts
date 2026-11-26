import { addMeshOverlays } from "../content/3d/aircraftMeshOverlay";
import { PrototypePreview } from "../rendering/PrototypePreview";
import { aircraftOverlayPanels, aircraftReferencePreview, aircraftReviewPlate, resolveAircraftModel } from "../content/3d/aircraftModels";
import { aircraftEffectPlate } from "../content/3d/aircraftEffectPlate";
import type { ReferenceAircraft } from "../content/3d/AircraftFactory";
import { button } from "../content/2d/components";
import {
  referenceCatalog,
  referenceDetails,
  referenceHeading,
  referenceModelTools,
  type ReferencePart,
} from "../content/2d/referenceLab";
import { World } from "../simulation/World";
import { AIRFRAMES } from "../data/aircrafts";
import type { AircraftReference } from "../data/aircraftReferences";
import type { previewAircraftCatalog } from "../content/3d/previewAircraftCatalog";

type ReferenceMode = "outline" | "model";

const defaultYaw = Math.PI + 0.55;
const defaultPitch = 0.14;
const fixedViews = {
  front: [Math.PI, 0.06],
  side: [Math.PI / 2, 0.06],
  top: [Math.PI, 0.55],
} as const;

export class ReferenceApp {
  private renderer?: PrototypePreview;
  private previewWorld?: World;
  private referenceAircraft?: ReferenceAircraft;
  private reference: AircraftReference;
  private active = true;
  private mode: ReferenceMode = "outline";
  private highlight = "";
  private orbitYaw = defaultYaw;
  private orbitPitch = defaultPitch;
  private pointer?: { id: number; x: number; y: number };
  private animation?: number;
  private previous = 0;
  private readonly listeners = new AbortController();
  private readonly narrow = matchMedia("(max-width: 760px)");
  private readonly catalog: HTMLElement;
  private readonly catalogMount: HTMLElement;
  private readonly drawer: HTMLDialogElement;
  private readonly detail: HTMLElement;
  private readonly heading: HTMLElement;
  private readonly outline: HTMLElement;
  private readonly model: HTMLElement;
  private readonly modelHost: HTMLElement;
  private readonly modelTools: HTMLElement;
  private readonly records: HTMLElement;
  private readonly tabs: Record<ReferenceMode, HTMLButtonElement>;

  constructor(private readonly root: HTMLElement, reference: AircraftReference,
    private readonly library: ReturnType<typeof previewAircraftCatalog>,
    private readonly onSelected: () => void,
    private readonly onCatalog: (open: boolean) => void,
  ) {
    this.reference = reference;
    root.innerHTML = this.shell();
    this.catalog = root.querySelector(".reference-roster")!;
    this.catalogMount = root.querySelector(".reference-catalog-mount")!;
    this.drawer = root.querySelector(".reference-drawer")!;
    this.detail = root.querySelector(".reference-detail")!;
    this.heading = root.querySelector(".reference-heading-host")!;
    this.outline = root.querySelector("#reference-outline")!;
    this.model = root.querySelector("#reference-model")!;
    this.modelHost = root.querySelector(".reference-model-host")!;
    this.modelTools = root.querySelector(".reference-model-tools")!;
    this.records = root.querySelector(".reference-records")!;
    this.tabs = {
      outline: root.querySelector("#reference-outline-tab")!,
      model: root.querySelector("#reference-model-tab")!,
    };
    this.bindEvents();
    this.placeCatalog();
    this.mountReference(reference);
    this.revealSelected();
  }

  private shell() {
    return `
      <p class="reference-unmapped" role="status" hidden>当前机型没有对应的原型档案，可保留原选择或另选档案。</p>
      <main class="reference-main">
        <aside class="reference-catalog-mount">${referenceCatalog(this.library.prototypes)}</aside>
        <article class="reference-detail" aria-labelledby="reference-title">
          <div class="reference-heading-host"></div>
          <section class="reference-preview" aria-label="机型预览">
            <div class="reference-mode-tabs" role="tablist" aria-label="预览模式">
              <button type="button" id="reference-outline-tab" data-mode="outline" role="tab" aria-controls="reference-outline">2D 抽象三视图</button>
              <button type="button" id="reference-model-tab" data-mode="model" role="tab" aria-controls="reference-model">3D 模型</button>
            </div>
            <section id="reference-outline" class="reference-outline" role="tabpanel" aria-labelledby="reference-outline-tab" tabindex="0"></section>
            <section id="reference-model" class="reference-model-panel" role="tabpanel" aria-labelledby="reference-model-tab" hidden>
              <div class="reference-model-tools"></div>
              <div class="reference-model-host"></div>
            </section>
          </section>
          <div class="reference-records"></div>
        </article>
      </main>
      <dialog class="reference-drawer" id="reference-catalog-dialog" aria-labelledby="reference-drawer-title">
        <header><h2 id="reference-drawer-title">机型目录</h2>${button("close-catalog", "关闭", "reference-back")}</header>
      </dialog>
    `;
  }

  get selected() { return this.reference; }

  followSelection(reference: AircraftReference | undefined) {
    this.root.querySelector<HTMLElement>(".reference-unmapped")!.hidden = !!reference;
    if (reference && reference !== this.reference) this.mountReference(reference);
  }

  toggleCatalog() {
    if (this.drawer.open) this.closeCatalog();
    else {
      this.drawer.show();
      this.onCatalog(true);
      this.revealSelected();
      this.catalog.querySelector<HTMLButtonElement>("[aria-current]")?.focus({ preventScroll: true });
    }
  }

  private closeCatalog() {
    if (!this.drawer.open) return;
    this.drawer.close();
    this.onCatalog(false);
  }

  setActive(active: boolean) {
    this.active = active;
    if (!active) {
      this.closeCatalog();
      this.stopDrawing();
    } else if (this.mode === "model") {
      this.startDrawing();
    }
  }

  private get preview() {
    const { frameId } = this.reference;
    const registration = frameId ? aircraftReferencePreview(frameId) : undefined;
    const playable = AIRFRAMES.find(({ id }) => id === frameId);
    return { registration, playable, frame: registration?.frame ?? playable };
  }

  private bindEvents() {
    const { signal } = this.listeners;
    this.outline.addEventListener("change", event => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || !input.matches(".mesh-toggle:checked") || this.outline.querySelector(".trace-mesh")) return;
      const { registration } = this.preview;
      const panels = this.reference.study?.panels ?? aircraftOverlayPanels(this.reference.frameId ?? "");
      if (registration && panels) addMeshOverlays(this.outline, panels, registration.create());
    }, { signal });
    this.narrow.addEventListener("change", () => this.placeCatalog(), { signal });
    this.records.addEventListener("error", event => {
      if (!(event.target instanceof HTMLImageElement)) return;
      const status = document.createElement("p");
      status.className = "reference-image-error";
      status.textContent = "图片暂时无法加载，可打开来源链接查看。";
      event.target.replaceWith(status);
    }, { capture: true, signal });
    this.drawer.addEventListener("click", event => {
      if (event.target !== this.drawer) return;
      const { left, top, right, bottom } = this.drawer.getBoundingClientRect();
      if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) this.closeCatalog();
    }, { signal });
    this.root.addEventListener("click", event => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
      if (!target) return;
      const { action, frame, highlight, mode, view, wingBay } = target.dataset;
      if (frame) {
        const reference = this.library.prototype(frame);
        if (reference) {
          this.followSelection(reference);
          this.onSelected();
        }
        this.closeCatalog();
      } else if (mode === "outline") {
        this.showMode("outline");
      } else if (mode === "model") {
        this.openModel();
      } else if (highlight && this.renderer) {
        this.highlight = this.highlight === highlight ? "" : highlight;
        this.updateHighlights();
      } else if (wingBay && this.previewWorld && this.mode === "model") {
        const upgrade = this.previewWorld.legalUpgradeOptions.find(option => option.wingBay && option.id === wingBay);
        if (!upgrade) return;
        this.previewWorld.installUpgrade(upgrade);
        this.renderModelTools();
        this.renderRecords();
        const controls = this.modelTools.querySelectorAll<HTMLButtonElement>("[data-wing-bay]");
        const next = [...controls].find(control => control.dataset.wingBay === wingBay) ?? controls[0];
        (next ?? this.modelTools.querySelector<HTMLButtonElement>("[data-view]"))?.focus({ preventScroll: true });
      } else if (view === "front" || view === "side" || view === "top") {
        [this.orbitYaw, this.orbitPitch] = fixedViews[view];
        this.modelHost.classList.toggle("ho229-plan-view", this.reference.frameId === "stingray_16" && view === "top");
        this.renderer?.setDisplayView(view);
      } else if (action === "reset-view") {
        this.resetOrbit();
      } else if (action === "close-catalog") {
        this.closeCatalog();
      }
    }, { signal });

    this.root.addEventListener("keydown", event => {
      if (event.key === "Escape" && this.drawer.open) {
        this.closeCatalog();
        return;
      }
      if (!(event.target instanceof HTMLButtonElement) || event.target.getAttribute("role") !== "tab") return;
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const mode = this.tabs.model.disabled || event.key === "Home" ? "outline"
        : event.key === "End" || this.mode === "outline" ? "model" : "outline";
      if (mode === "model") this.openModel();
      else this.showMode("outline");
      this.tabs[this.mode].focus();
    }, { signal });

    this.modelHost.addEventListener("pointerdown", event => {
      if (!this.renderer || this.pointer || event.button !== 0) return;
      this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      this.modelHost.setPointerCapture(event.pointerId);
    }, { signal });
    this.modelHost.addEventListener("pointermove", event => {
      if (this.pointer?.id !== event.pointerId) return;
      this.orbitYaw += (event.clientX - this.pointer.x) * 0.012;
      this.orbitPitch = Math.max(-0.35, Math.min(0.55, this.orbitPitch + (event.clientY - this.pointer.y) * 0.008));
      this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      this.modelHost.classList.remove("ho229-plan-view");
      this.renderer?.setDisplayOrbit(this.orbitYaw, this.orbitPitch);
    }, { signal });
    const releasePointer = (event: PointerEvent) => {
      if (this.pointer?.id === event.pointerId) this.pointer = undefined;
    };
    this.modelHost.addEventListener("pointerup", releasePointer, { signal });
    this.modelHost.addEventListener("lostpointercapture", releasePointer, { signal });
    window.addEventListener("pagehide", event => {
      if (!event.persisted) this.dispose();
    }, { signal });
  }

  private placeCatalog() {
    const scroll = this.catalog.scrollTop;
    if (this.narrow.matches) {
      this.drawer.append(this.catalog);
    } else {
      this.closeCatalog();
      this.catalogMount.append(this.catalog);
      this.catalog.scrollTop = scroll;
      this.revealSelected();
    }
  }

  private revealSelected() {
    this.catalog.querySelector("[aria-current]")?.scrollIntoView({ block: "nearest" });
  }

  private mountReference(reference: AircraftReference) {
    this.releasePreview();
    this.reference = reference;
    this.highlight = "";
    this.resetOrbit();
    for (const entry of this.catalog.querySelectorAll<HTMLButtonElement>("[data-frame]")) {
      const selected = entry.dataset.frame === reference.id;
      entry.classList.toggle("selected", selected);
      if (selected) entry.setAttribute("aria-current", "true");
      else entry.removeAttribute("aria-current");
    }
    this.modelHost.dataset.referenceFrame = reference.frameId ?? "";
    const blocked = !!this.previewBlockReason();
    this.tabs.model.disabled = blocked;
    this.heading.innerHTML = referenceHeading(reference, !blocked);
    this.renderOutline();
    this.renderRecords();
    this.showMode("outline");
    this.detail.scrollTop = 0;
  }

  private resetOrbit() {
    this.orbitYaw = defaultYaw;
    this.orbitPitch = defaultPitch;
    this.modelHost.classList.remove("ho229-plan-view");
    this.renderer?.setDisplayOrbit(this.orbitYaw, this.orbitPitch);
  }

  private get reviewPlate() {
    return this.reference.frameId ? aircraftReviewPlate(this.reference.frameId) : undefined;
  }

  private previewBlockReason() {
    const { frame } = this.preview;
    if (!this.reference.threeView?.src) return "待补参考三视图原稿。";
    if (!this.reviewPlate) {
      return this.reference.threeView.loading === "pending"
        ? "参考线稿待核对，待补该变体的抽象三视图。"
        : "待补该变体的抽象三视图。";
    }
    return frame ? resolveAircraftModel(frame).error : "待补该变体的三维配置。";
  }

  private renderOutline() {
    const blocked = this.previewBlockReason();
    this.outline.innerHTML = this.reviewPlate
      ? this.reviewPlate(blocked)
      : `<div class="reference-feature-plate reference-feature-empty"><p>${blocked ?? "待补该变体的抽象三视图。"}</p></div>`;
  }

  private showMode(mode: ReferenceMode) {
    this.mode = mode;
    this.outline.hidden = mode !== "outline";
    this.model.hidden = mode !== "model";
    for (const name of ["outline", "model"] as const) {
      const selected = mode === name;
      this.tabs[name].setAttribute("aria-selected", String(selected));
      this.tabs[name].tabIndex = selected ? 0 : -1;
    }
    if (mode === "model") {
      this.startDrawing();
    } else {
      this.stopDrawing();
    }
  }

  private openModel() {
    if (this.tabs.model.disabled) return;
    if (!this.renderer && !this.createModelPreview()) return;
    this.showMode("model");
    this.tabs.model.focus({ preventScroll: true });
    this.tabs.model.scrollIntoView({ block: "nearest" });
  }

  private createModelPreview() {
    const { registration, playable } = this.preview;
    try {
      if (registration) {
        this.referenceAircraft = registration.create();
      } else if (playable) {
        this.previewWorld = new World(playable, 1, { director: false, supply: false, showroom: true });
      }
      const actor = this.referenceAircraft ?? this.previewWorld?.player;
      if (!actor) return false;
      this.model.hidden = false;
      this.renderer = new PrototypePreview(this.modelHost);
      const error = this.renderer.setPlayer(actor);
      if (error) throw new Error(error);
      this.resetOrbit();
    } catch (error) {
      this.releasePreview();
      this.showMode("outline");
      const message = document.createElement("p");
      message.className = "reference-feature-blocked-note reference-preview-error";
      message.role = "alert";
      message.textContent = `三维预览暂时不可用 · ${error instanceof Error ? error.message : "渲染初始化失败"}`;
      this.outline.querySelector(".reference-preview-error")?.remove();
      this.outline.querySelector(".reference-feature-plate")?.prepend(message);
      return false;
    }
    this.outline.querySelector(".reference-preview-error")?.remove();
    this.renderModelTools();
    this.renderRecords();
    return true;
  }

  private renderModelTools() {
    const world = this.previewWorld;
    const player = world?.player;
    const refit = world && player?.frame.geometryProfile === "ho229V2" ? {
      engines: player.parts.filter(part => part.role === "engine").length,
      cannonCount: player.weapons.reduce((count, weapon) => count + weapon.config.count, 0),
      bays: world.legalUpgradeOptions.filter(option => option.wingBay),
    } : undefined;
    this.modelTools.innerHTML = referenceModelTools(refit);
  }

  private renderRecords() {
    const { frame } = this.preview;
    const actor = this.referenceAircraft ?? this.previewWorld?.player;
    const parts: readonly ReferencePart[] = actor?.parts ?? [];
    this.records.innerHTML = referenceDetails(this.reference, frame && actor ? {
      length: frame.length, wingspan: frame.wingspan, parts,
    } : undefined);
    if (actor) this.records.append(aircraftEffectPlate(actor));
    this.updateHighlights();
  }

  private updateHighlights() {
    for (const control of this.records.querySelectorAll<HTMLButtonElement>("[data-highlight]")) {
      const selected = control.dataset.highlight === this.highlight;
      control.classList.toggle("selected", selected);
      control.setAttribute("aria-pressed", String(selected));
    }
  }

  private startDrawing() {
    if (this.animation !== undefined || !this.active) return;
    const draw = (time: number) => {
      const dt = this.previous ? Math.min(0.05, (time - this.previous) / 1000) : 0.016;
      this.previous = time;
      this.renderer?.draw(dt, this.highlight);
      this.animation = requestAnimationFrame(draw);
    };
    this.animation = requestAnimationFrame(draw);
  }

  private stopDrawing() {
    if (this.animation !== undefined) cancelAnimationFrame(this.animation);
    this.animation = undefined;
    this.previous = 0;
  }

  private releasePreview() {
    this.stopDrawing();
    this.pointer = undefined;
    this.renderer?.dispose();
    this.renderer = undefined;
    this.previewWorld?.dispose();
    this.previewWorld = undefined;
    this.referenceAircraft = undefined;
    this.modelHost.replaceChildren();
    this.modelTools.replaceChildren();
  }

  dispose() {
    this.listeners.abort();
    this.releasePreview();
  }
}
