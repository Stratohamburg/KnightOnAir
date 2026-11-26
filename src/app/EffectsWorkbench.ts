import type { Airframe } from "../data/aircrafts";
import type { Quality } from "../data/config";
import { effectsWorkbench } from "../content/2d/effectsWorkbench";
import { previewEffectsCatalog } from "../content/fx/previewEffectsCatalog";
import { EffectsPreviewScene, categories, type DisplayCategory } from "../rendering/EffectsPreviewScene";
import { PreviewStage } from "../rendering/PreviewStage";
import type { Power, Track } from "../simulation/AircraftPreview";

type Mode = "library" | "aircraft";
type Observation = { quality: Quality; rate: number; seed: number; dark: boolean; anchors: boolean };
const defaults = (): Observation => ({ quality: "standard", rate: 1, seed: 491, dark: true, anchors: false });

export class EffectsWorkbench {
  private readonly listener = new AbortController();
  private readonly entries = previewEffectsCatalog();
  private readonly stageHost: HTMLElement;
  private stage?: PreviewStage;
  private mode: Mode = "library";
  private readonly sessions: Partial<Record<Mode, EffectsPreviewScene>> = {};
  private readonly settings = { library: defaults(), aircraft: defaults() };
  private frameId?: string;
  private effectId?: string;
  private animation?: number;
  private previous = 0;
  private unmapped = false;
  private active = false;
  private clickingSurface = false;
  private renderedParts = "";
  private renderedSites = "";
  private orbit?: { x: number; y: number; moved: boolean; pointer: number };
  private error = "";

  constructor(private readonly root: HTMLElement, private readonly aircraft: readonly Airframe[],
    private readonly onFrameSelected: () => void) {
    this.frameId = aircraft[0]?.id;
    this.effectId = this.entries[0]?.id;
    root.innerHTML = effectsWorkbench();
    this.stageHost = root.querySelector(".effects-stage")!;
    const { signal } = this.listener;
    root.addEventListener("change", this.change, { signal });
    root.addEventListener("click", this.click, { signal });
    this.stageHost.addEventListener("pointerdown", this.pointerDown, { signal });
    this.stageHost.addEventListener("pointermove", this.pointerMove, { signal });
    this.stageHost.addEventListener("pointerup", this.pointerUp, { signal });
    this.stageHost.addEventListener("lostpointercapture", () => { this.orbit = undefined; }, { signal });
  }

  get selectedFrame() { return this.frameId; }
  get diagnostics() { return { active: this.active, mode: this.mode, library: this.sessions.library?.diagnostics, aircraft: this.sessions.aircraft?.diagnostics }; }
  private get session() { return this.sessions[this.mode]; }
  private get observation() { return this.settings[this.mode]; }
  private get selectedEffect() { return this.entries.find(({ id }) => id === this.effectId); }

  show(frameId?: string, synchronize = false) {
    if (synchronize) {
      this.unmapped = !frameId;
      if (frameId && frameId !== this.frameId) this.replaceSelection("aircraft", frameId);
    }
    this.active = true;
    this.ensureSession();
    this.refresh();
    this.draw();
    const animate = (time: number) => {
      if (!this.active) return;
      if (this.stage && this.session && !(this.mode === "aircraft" && this.unmapped) && !this.session.clock.paused) {
        this.session.advance(this.previous ? (time - this.previous) / 1000 : 0, this.stage);
        this.draw();
        this.updateStatus();
      }
      this.previous = time;
      this.animation = requestAnimationFrame(animate);
    };
    if (this.animation === undefined) this.animation = requestAnimationFrame(animate);
  }

  hide() {
    this.active = false;
    if (this.animation !== undefined) cancelAnimationFrame(this.animation);
    this.animation = undefined;
    this.previous = 0;
  }

  private ensureSession() {
    if (this.session || (this.mode === "aircraft" && this.unmapped)) return;
    const frame = this.aircraft.find(({ id }) => id === this.frameId);
    const effect = this.selectedEffect;
    const selection = this.mode === "aircraft" ? frame && { frame } : effect && { effect };
    if (!selection) return;
    try {
      this.stage ??= new PreviewStage(this.stageHost, () => this.draw());
      const session = new EffectsPreviewScene(selection, this.observation.seed);
      this.sessions[this.mode] = session;
      session.clock.rate = this.observation.rate;
      session.dark = this.observation.dark;
      session.anchors = this.observation.anchors;
    } catch (error) {
      this.error = error instanceof Error ? error.message : "预览初始化失败";
    }
  }

  private replaceSelection(mode: Mode, id: string) {
    this.sessions[mode]?.dispose();
    delete this.sessions[mode];
    if (mode === "aircraft") this.frameId = id;
    else this.effectId = id;
    this.error = "";
    this.renderedParts = this.renderedSites = "";
  }

  private field<T extends HTMLSelectElement | HTMLInputElement = HTMLSelectElement>(name: string) {
    return this.root.querySelector<T>(`[data-control="${name}"]`)!;
  }
  private action(name: string) {
    return this.root.querySelector<HTMLButtonElement>(`[data-action="${name}"]`)!;
  }
  private value(name: string, value: string) {
    const field = this.root.querySelector<HTMLElement>(`[data-value="${name}"]`)!;
    field.textContent = value;
    field.hidden = !value;
  }

  private options(select: HTMLSelectElement, items: readonly { id: string; name: string }[], selected?: string, blank?: string) {
    const previous = selected ?? select.value;
    const options = items.map(({ id, name }) => new Option(name, id));
    if (blank) options.unshift(new Option(blank, ""));
    select.replaceChildren(...options);
    if (previous && options.some(option => option.value === previous)) select.value = previous;
    else if (!selected && blank) select.value = "";
  }

  private refresh() {
    const single = this.mode === "library";
    const effect = this.selectedEffect;
    const session = this.session;
    const emptyMapping = !single && this.unmapped;
    this.field("mode").value = this.mode;
    this.root.querySelector('[data-label="selection"]')!.textContent = single ? "特效" : "机型";
    this.options(this.field("selection"), single ? this.entries : this.aircraft,
      single ? this.effectId : emptyMapping ? "" : this.frameId,
      emptyMapping ? "选择机型" : undefined);
    this.field("selection").disabled = single ? !this.entries.length : !this.aircraft.length;
    for (const mode of ["library", "aircraft"] as const)
      this.root.querySelector<HTMLElement>(`[data-group="${mode}"]`)!.hidden = this.mode !== mode;
    this.value("notice", this.error || (this.unmapped ? "当前原型没有对应的飞行预览机型，可另选机型。" : "")
      || (!session ? single ? "特效目录为空" : "机型目录为空" : session.missing.map(({ action, id }) => `${action} 缺少 ${id}`).join(" · ")));
    this.value("description", single && effect ? `${effect.id} · ${effect.trigger}` : "");
    this.action("trigger-effect").textContent = effect?.playback === "continuous" ? "开始发射" : "播放一次";
    this.action("stop-effect").hidden = effect?.playback !== "continuous";
    this.field("quality").value = this.observation.quality;
    this.field("rate").value = String(this.observation.rate);
    this.field<HTMLInputElement>("seed").value = String(this.observation.seed);
    this.field("background").value = session?.dark === false ? "light" : "dark";
    this.field<HTMLInputElement>("anchors").checked = !!session?.anchors;
    this.field("camera").value = session?.following === false ? "fixed" : "follow";
    this.updateStatus();
  }

  private updateStatus() {
    const session = this.mode === "aircraft" && this.unmapped ? undefined : this.session;
    const aircraft = session?.aircraft;
    this.value("step", String(session?.clock.step ?? 0));
    this.action("pause-preview").textContent = session?.clock.paused === false ? "暂停" : "继续";
    for (const name of ["pause-preview", "step-preview", "reset-preview", "replay-preview", "trigger-effect"])
      this.action(name).disabled = !session;
    this.action("step-preview").disabled ||= session?.clock.paused === false;
    this.action("stop-effect").disabled = !session?.isEmitting;
    this.field("track").value = aircraft?.track ?? "straight";
    this.field("power").value = aircraft?.power ?? "cruise";
    this.field("power").querySelector<HTMLOptionElement>('option[value="boost"]')!.disabled = !aircraft?.canBoost;
    for (const control of this.root.querySelectorAll<HTMLButtonElement>("[data-category]")) {
      const category = control.dataset.category as DisplayCategory;
      control.setAttribute("aria-pressed", String(!!session?.visible.has(category)));
      control.disabled = !aircraft || !!session?.missing.some(({ action }) => action === category);
    }
    const parts = aircraft?.actor.parts.filter(part => !part.destroyed && session?.hasSurface(part.id)) ?? [];
    const key = parts.map(part => part.id).join("/");
    if (key !== this.renderedParts) {
      this.renderedParts = key;
      this.options(this.field("part"), parts.map(part => ({ id: part.id, name: part.id })));
    }
    const sites = [...(aircraft?.damageSites ?? [])];
    const siteKey = sites.map(([id]) => id).join("/");
    if (siteKey !== this.renderedSites) {
      this.renderedSites = siteKey;
      this.options(this.field("damageSite"), sites.map(([id, site]) => ({ id: String(id), name: `${site.partId} · ${id}` })));
    }
    const part = parts.find(({ id }) => id === this.field("part").value);
    this.action("fire-preview").disabled = !aircraft?.actor.weapons.some(w =>
      !session?.missing.some(({ action }) => action === w.anchorId) &&
      aircraft.actor.parts.some(p => p.id === w.partId && !p.destroyed && p.health > 0));
    this.action("point-damage").disabled = !parts.length;
    this.action("point-damage").setAttribute("aria-pressed", String(this.clickingSurface));
    this.action("damage-part").disabled = !part || part.health <= 0;
    this.action("engine-fault").disabled = part?.role !== "engine" || part.health <= 0;
    this.action("detach-part").disabled = !part?.visual?.detachable;
    this.action("repair-site").disabled = !sites.length;
  }

  private draw() {
    const session = this.mode === "aircraft" && this.unmapped ? undefined : this.session;
    if (!this.stage || !this.active) return;
    this.stage.renderer.domElement.hidden = !session;
    session?.draw(this.stage, this.observation.quality);
  }

  private change = (event: Event) => {
    const element = event.target as HTMLInputElement | HTMLSelectElement;
    const { value } = element;
    const session = this.session;
    switch (element.dataset.control) {
      case "mode":
        this.mode = value as Mode;
        this.error = "";
        this.ensureSession();
        this.refresh();
        break;
      case "selection":
        if (!value) break;
        this.replaceSelection(this.mode, value);
        if (this.mode === "aircraft") {
          this.unmapped = false;
          this.onFrameSelected();
        }
        this.ensureSession();
        this.refresh();
        break;
      case "track": session?.queue({ type: "track", value: value as Track }); break;
      case "power": session?.queue({ type: "power", value: value as Power }); break;
      case "quality": this.observation.quality = value as Quality; break;
      case "rate":
        this.observation.rate = Number(value);
        if (session) session.clock.rate = this.observation.rate;
        break;
      case "seed":
        if (value && Number.isSafeInteger(Number(value))) {
          this.observation.seed = Number(value);
          session?.reset(false, this.observation.seed);
          this.refresh();
        }
        break;
      case "background":
        this.observation.dark = value === "dark";
        if (session) session.dark = this.observation.dark;
        break;
      case "anchors":
        this.observation.anchors = (element as HTMLInputElement).checked;
        if (session) session.anchors = this.observation.anchors;
        break;
      case "camera": session?.setFollowing(value === "follow"); break;
      case "part": this.updateStatus(); break;
    }
    this.draw();
  };

  private click = (event: MouseEvent) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
    const session = this.session;
    const stage = this.stage;
    if (!target || !session || !stage || (this.mode === "aircraft" && this.unmapped)) return;
    const category = target.dataset.category as DisplayCategory | undefined;
    if (category) {
      if (this.field<HTMLInputElement>("solo").checked || event.shiftKey) { session.visible.clear(); session.visible.add(category); }
      else if (session.visible.has(category)) session.visible.delete(category);
      else session.visible.add(category);
    }
    const partId = this.field("part").value;
    switch (target.dataset.action) {
      case "trigger-effect": session.queue({ type: "trigger" }); session.clock.paused = false; break;
      case "stop-effect": session.queue({ type: "stop" }); break;
      case "pause-preview": session.clock.paused = !session.clock.paused; break;
      case "step-preview": session.singleStep(stage); break;
      case "reset-preview": session.reset(false); session.clock.paused = true; break;
      case "replay-preview": session.reset(true); session.clock.paused = false; break;
      case "all-effects": for (const key of categories) session.visible.add(key); break;
      case "fire-preview": session.queue({ type: "fire" }); break;
      case "point-damage": this.clickingSurface = !this.clickingSurface; break;
      case "damage-part": session.damage(partId); break;
      case "engine-fault": session.damage(partId, undefined, true); break;
      case "detach-part": session.queue({ type: "detach", partId }); break;
      case "repair-site": session.queue({ type: "repair", siteId: Number(this.field("damageSite").value) }); break;
    }
    this.draw();
    this.updateStatus();
  };

  private pointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || !this.session || this.orbit) return;
    this.orbit = { x: event.clientX, y: event.clientY, pointer: event.pointerId, moved: false };
    this.stageHost.setPointerCapture(event.pointerId);
  };
  private pointerMove = (event: PointerEvent) => {
    const orbit = this.orbit;
    const session = this.session;
    if (!orbit || !session || event.pointerId !== orbit.pointer) return;
    const dx = event.clientX - orbit.x, dy = event.clientY - orbit.y;
    if (!orbit.moved && Math.hypot(dx, dy) < 5) return;
    orbit.moved = true;
    orbit.x = event.clientX;
    orbit.y = event.clientY;
    session.yaw -= dx * .012;
    session.pitch = Math.max(-.2, Math.min(1.5, session.pitch + dy * .01));
    this.draw();
  };
  private pointerUp = (event: PointerEvent) => {
    if (this.orbit?.pointer !== event.pointerId) return;
    if (!this.orbit.moved && this.clickingSurface && this.stage && this.mode === "aircraft") {
      const rect = this.stageHost.getBoundingClientRect();
      this.session?.pointAt(this.stage.camera, (event.clientX - rect.left) / rect.width * 2 - 1,
        1 - (event.clientY - rect.top) / rect.height * 2);
    }
    this.orbit = undefined;
  };
  dispose() {
    this.hide();
    this.listener.abort();
    for (const session of Object.values(this.sessions)) session.dispose();
    this.stage?.dispose();
    this.root.replaceChildren();
  }
}
