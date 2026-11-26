import { button } from "../content/2d/components";
import { previewAircraftCatalog } from "../content/3d/previewAircraftCatalog";
import { EffectsWorkbench } from "./EffectsWorkbench";
import { ReferenceApp } from "./ReferenceApp";

type Tab = "prototype" | "effects";
const tabs: readonly Tab[] = ["prototype", "effects"];

export class DebugWorkbench {
  private readonly listeners = new AbortController();
  private readonly catalog = previewAircraftCatalog();
  private readonly prototype?: ReferenceApp;
  private effects?: EffectsWorkbench;
  private readonly panels: Record<Tab, HTMLElement>;
  private readonly buttons: Record<Tab, HTMLButtonElement>;
  private readonly catalogButton: HTMLButtonElement;
  private active: Tab = "prototype";
  private source: Tab = "prototype";
  private pendingMapping = true;
  private readonly fromShowroom: boolean;

  constructor(root: HTMLElement, query = new URLSearchParams(location.search)) {
    this.fromShowroom = query.get("from") === "showroom";
    root.className = "reference-root workbench-root";
    root.innerHTML = `
      <header class="reference-header workbench-header">
        <nav class="workbench-tabs" role="tablist" aria-label="校验工具">
          <button type="button" id="workbench-prototype-tab" role="tab" aria-controls="workbench-prototype" data-tab="prototype">原型</button>
          <button type="button" id="workbench-effects-tab" role="tab" aria-controls="workbench-effects" data-tab="effects">特效</button>
        </nav>
        <div class="reference-header-actions">
          ${button("prototype-catalog", "机型目录", "reference-back reference-catalog-toggle", 'aria-controls="reference-catalog-dialog" aria-expanded="false"')}
          ${button("workbench-back", this.fromShowroom ? "返回展台" : "返回游戏", "reference-back")}
        </div>
      </header>
      <section id="workbench-prototype" class="reference-pane" role="tabpanel" aria-labelledby="workbench-prototype-tab"></section>
      <section id="workbench-effects" role="tabpanel" aria-labelledby="workbench-effects-tab" hidden></section>`;
    this.buttons = {
      prototype: root.querySelector("#workbench-prototype-tab")!,
      effects: root.querySelector("#workbench-effects-tab")!,
    };
    this.panels = {
      prototype: root.querySelector("#workbench-prototype")!,
      effects: root.querySelector("#workbench-effects")!,
    };
    this.catalogButton = root.querySelector('[data-action="prototype-catalog"]')!;
    const reference = this.catalog.prototype(query.get("frame") ?? undefined) ?? this.catalog.initialPrototype;
    if (reference) {
      this.prototype = new ReferenceApp(this.panels.prototype, reference, this.catalog, () => {
        this.source = "prototype";
        this.pendingMapping = true;
      }, open => this.catalogButton.setAttribute("aria-expanded", String(open)));
    } else {
      this.panels.prototype.textContent = "暂无原型档案";
    }
    this.updateTabs();
    const { signal } = this.listeners;
    root.querySelector(".workbench-header")!.addEventListener("click", event => {
      const target = (event.target as HTMLElement).closest("button");
      const tab = target?.dataset.tab as Tab | undefined;
      if (tab) this.switchTo(tab);
      else if (target === this.catalogButton) this.prototype?.toggleCatalog();
      else if (target?.dataset.action === "workbench-back") {
        const destination = new URL(location.href);
        if (this.fromShowroom) {
          destination.searchParams.delete("reference");
          destination.searchParams.delete("frame");
          destination.searchParams.delete("from");
          destination.searchParams.set("debug", "1");
          destination.hash = "showroom";
        } else {
          destination.search = "";
          destination.hash = "";
        }
        this.dispose();
        location.assign(destination);
      }
    }, { signal });
    root.querySelector(".workbench-tabs")!.addEventListener("keydown", event => {
      const keyboard = event as KeyboardEvent;
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(keyboard.key)) return;
      keyboard.preventDefault();
      const tab = keyboard.key === "Home" ? "prototype" : keyboard.key === "End" ? "effects"
        : this.active === "prototype" ? "effects" : "prototype";
      this.switchTo(tab);
      this.buttons[tab].focus();
    }, { signal });
    window.addEventListener("pagehide", event => {
      if (event.persisted) {
        this.prototype?.setActive(false);
        this.effects?.hide();
      } else {
        this.dispose();
      }
    }, { signal });
    window.addEventListener("pageshow", event => {
      if (!event.persisted) return;
      if (this.active === "prototype") this.prototype?.setActive(true);
      else this.effects?.show();
    }, { signal });
  }

  get diagnostics() { return { tab: this.active, effects: this.effects?.diagnostics }; }

  private updateTabs() {
    for (const tab of tabs) {
      const selected = this.active === tab;
      this.buttons[tab].setAttribute("aria-selected", String(selected));
      this.buttons[tab].tabIndex = selected ? 0 : -1;
      this.panels[tab].hidden = !selected;
    }
    this.catalogButton.hidden = this.active !== "prototype" || !this.prototype;
  }

  private switchTo(tab: Tab) {
    if (tab === this.active) return;
    this.active = tab;
    this.updateTabs();
    if (tab === "effects") {
      this.prototype?.setActive(false);
      this.effects ??= new EffectsWorkbench(this.panels.effects, this.catalog.aircraft, () => {
        this.source = "effects";
        this.pendingMapping = true;
      });
      const synchronize = this.source === "prototype" && this.pendingMapping;
      this.effects.show(this.catalog.aircraftForPrototype(this.prototype?.selected)?.id, synchronize);
      if (synchronize) this.pendingMapping = false;
    } else {
      this.effects?.hide();
      if (this.source === "effects" && this.pendingMapping) {
        this.prototype?.followSelection(this.catalog.prototypeForAircraft(this.effects?.selectedFrame));
        this.pendingMapping = false;
      }
      this.prototype?.setActive(true);
    }
  }

  dispose() {
    this.listeners.abort();
    this.effects?.dispose();
    this.prototype?.dispose();
  }
}
