import { Renderer } from "../rendering/Renderer";
import { fokkerReviewPlate } from "./fokkerReviewPlate";
import { World } from "../simulation/World";
import { airframeById } from "../data/aircrafts";
import {
  AIRCRAFT_REFERENCES,
  aircraftReferenceByFrameId,
  type AircraftReference,
} from "../data/aircraftReferences";
import type { Part } from "../simulation/types";

type ReferenceMode = "outline" | "model" | "skeleton" | "build";

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const roleLabel = (part: Part) => {
  if (part.kind === "landingGear") return "起落架";
  if (part.role === "engine") return "发动机";
  if (part.role === "gun" || part.role === "turret") return "武器";
  if (part.role === "bay") return "挂舱";
  if (part.role === "wing") return "翼面";
  if (part.role === "tail") return "尾翼";
  return part.slot === "center" ? "机身" : part.slot;
};

const modeCopy: Record<ReferenceMode, { label: string; copy: string }> = {
  outline: {
    label: "2D特征抽象",
    copy: "先看关键线和模块相对位置。确认这张三视图抽象后，才会生成三维模型。",
  },
  model: {
    label: "生成式模型",
    copy: "拖动模型检查轮廓。点击模块标签，会让对应部件在模型中发光。",
  },
  skeleton: {
    label: "中心线校验",
    copy: "中心线决定机身、翼根、尾段和挂点的相对关系，先校准这里再增加爆改件。",
  },
  build: {
    label: "爆改方向",
    copy: "质量与数量是两条不同的构筑曲线。每个原型都保留一条最容易读懂的起手路线。",
  },
};

export class ReferenceApp {
  private renderer?: Renderer;
  private previewWorld?: World;
  private reference: AircraftReference = AIRCRAFT_REFERENCES[0];
  private mode: ReferenceMode = "outline";
  private featureApproved = false;
  private highlight = "";
  private orbitYaw = Math.PI + 0.55;
  private orbitPitch = 0.14;
  private pointer?: { id: number; x: number; y: number };
  private previous = 0;
  private readonly modelHost: HTMLElement;
  private readonly sideHost: HTMLElement;
  private readonly modelMeta: HTMLElement;

  constructor(private readonly root: HTMLElement) {
    root.className = "reference-root";
    root.innerHTML = this.shell();
    this.modelHost = root.querySelector<HTMLElement>(".reference-model-host")!;
    this.sideHost = root.querySelector<HTMLElement>(".reference-side")!;
    this.modelMeta = root.querySelector<HTMLElement>(".reference-model-meta")!;
    this.bindEvents();
    this.mountFrame(AIRCRAFT_REFERENCES[0].frameId);
    requestAnimationFrame((time) => this.loop(time));
  }

  private shell() {
    return `
      <header class="reference-header">
        <div class="reference-brand"><span class="reference-mark">✦</span><div><small>AIRFRAME REFERENCE LAB</small><strong>原型校验台</strong></div></div>
        <p>真实照片负责校准，生成式模型负责试错，中心线负责让两者说同一种结构语言。</p>
        <button class="reference-back" data-action="back">返回游戏 <span>↗</span></button>
      </header>
      <main class="reference-main">
        <section class="reference-model-panel" aria-label="原型特征抽象与生成式飞机模型">
          <div class="reference-model-toolbar">
            <div class="reference-model-meta"></div>
            <div class="reference-model-actions"><div class="reference-view-buttons"><button data-view="front">正视</button><button data-view="side">侧视</button><button data-view="top">俯视</button><button data-action="reset-view">重置</button></div><span>三视图核对 · 拖动环绕</span></div>
          </div>
          <div class="reference-model-host"></div>
          <div class="reference-model-foot"><span>PROCEDURAL AIRFRAME / CONTENT CATALOG</span><span data-render-metrics>共享几何 · 模块化锚点</span></div>
        </section>
        <aside class="reference-side" aria-live="polite"></aside>
      </main>
      <footer class="reference-footer"><span>校验顺序 · 中心线 → 翼根 → 发动机 → 武器 → 爆改层</span><span>照片来源标注在卡片底部</span></footer>
    `;
  }

  private bindEvents() {
    this.root.addEventListener("click", (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>("button,a");
      if (!target) return;
      if (target.dataset.frame) {
        this.mountFrame(target.dataset.frame);
        return;
      }
      if (target.dataset.mode) {
        if (target.dataset.mode === "model" && !this.featureApproved) return;
        this.mode = target.dataset.mode as ReferenceMode;
        this.renderUi();
        return;
      }
      if (target.dataset.action === "approve-feature-map") {
        this.approveFeatureMap();
        return;
      }
      if (target.dataset.highlight) {
        this.highlight = this.highlight === target.dataset.highlight ? "" : target.dataset.highlight;
        this.renderUi();
        return;
      }
      if (target.dataset.action === "reset-view") {
        this.orbitYaw = Math.PI + 0.55;
        this.orbitPitch = 0.14;
        this.renderer?.setDisplayOrbit(this.orbitYaw, this.orbitPitch);
        return;
      }
      if (target.dataset.view) {
        const views: Record<string, [number, number]> = {
          front: [Math.PI, 0.06],
          side: [Math.PI / 2, 0.06],
          top: [Math.PI, 0.55],
        };
        const view = views[target.dataset.view];
        if (view) {
          [this.orbitYaw, this.orbitPitch] = view;
          this.renderer?.setDisplayView(target.dataset.view as "front" | "side" | "top");
        }
        return;
      }
      if (target.dataset.action === "back") {
        location.href = location.pathname;
      }
    });
    this.root.addEventListener("pointerdown", (event) => {
      const target = event.target as HTMLElement;
      if (target.closest("button,a,.reference-scroll,.reference-side,.reference-header,.reference-footer")) return;
      this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      this.root.setPointerCapture?.(event.pointerId);
    });
    this.root.addEventListener("pointermove", (event) => {
      if (!this.pointer || this.pointer.id !== event.pointerId) return;
      const dx = event.clientX - this.pointer.x;
      const dy = event.clientY - this.pointer.y;
      this.pointer.x = event.clientX;
      this.pointer.y = event.clientY;
      this.orbitYaw += dx * 0.012;
      this.orbitPitch = clamp(this.orbitPitch + dy * 0.008, -0.35, 0.55);
      this.renderer?.setDisplayOrbit(this.orbitYaw, this.orbitPitch);
    });
    const releasePointer = (event: PointerEvent) => {
      if (this.pointer?.id === event.pointerId) this.pointer = undefined;
    };
    this.root.addEventListener("pointerup", releasePointer);
    this.root.addEventListener("pointercancel", releasePointer);
  }

  private mountFrame(frameId: string) {
    const reference = aircraftReferenceByFrameId(frameId);
    this.reference = reference;
    this.mode = "outline";
    this.featureApproved = false;
    this.highlight = "";
    this.previewWorld?.dispose();
    this.renderer?.dispose();
    this.renderer = undefined;
    this.modelHost.innerHTML = "";
    this.modelHost.classList.remove("ready", "reference-render-fallback");
    this.previewWorld = new World(airframeById(reference.frameId), 1, {
      director: false,
      supply: false,
      showroom: true,
    });
    if (reference.pipeline?.generatedFromApprovedSheet) this.approveFeatureMap();
    else this.renderUi();
  }

  private approveFeatureMap() {
    if (!this.previewWorld || !this.reference.pipeline?.evidenceMatrix?.length) return;
    this.mode = "model";
    if (this.renderer) { this.renderUi(); return; }
    this.featureApproved = true;
    this.modelHost.innerHTML = "";
    this.modelHost.classList.remove("reference-feature-gate");
    try {
      this.renderer = new Renderer(this.modelHost);
      this.renderer.setQuality("standard");
      this.renderer.setPlayer(this.previewWorld.player);
      this.renderer.setDisplayOrbit(this.orbitYaw, this.orbitPitch);
      this.modelHost.classList.add("ready");
    } catch {
      this.modelHost.classList.add("reference-render-fallback");
      this.modelHost.insertAdjacentHTML(
        "beforeend",
        `<div class="reference-fallback-copy"><strong>三维预览暂时不可用</strong><span>中心线、照片和模块数据仍然可以继续核对。</span></div>`,
      );
    }
    this.renderUi();
  }

  private renderUi() {
    const frame = airframeById(this.reference.frameId);
    const world = this.previewWorld;
    if (!world) return;
    const metric = this.renderer?.diagnostics;
    this.modelMeta.innerHTML = `<span class="reference-kicker">${this.reference.period}</span><strong>${this.reference.chineseName}</strong><small>${frame.name} · ${frame.role}</small>`;
    const viewButtons = this.root.querySelectorAll<HTMLButtonElement>("[data-view], [data-action='reset-view']");
    viewButtons.forEach((button) => { button.disabled = !this.featureApproved; });
    const toolbarHint = this.root.querySelector<HTMLElement>(".reference-model-actions > span");
    if (toolbarHint) toolbarHint.textContent = this.featureApproved ? "三视图核对 · 拖动环绕" : "先确认 2D 特征抽象";
    const showPlate = !this.featureApproved || this.mode === "outline";
    this.modelHost.classList.toggle("reference-feature-gate", showPlate);
    const plate = this.modelHost.querySelector(".reference-feature-plate");
    if (showPlate && !plate) {
      this.modelHost.insertAdjacentHTML("beforeend", this.featurePlate(frame.length, frame.wingspan, world.player.parts));
    } else if (!showPlate) plate?.remove();
    const metrics = this.root.querySelector<HTMLElement>("[data-render-metrics]");
    if (metrics) metrics.textContent = metric
      ? `共享几何 ${metric.content.shared.geometries} · 绘制 ${metric.calls}`
      : this.featureApproved ? "等待三维渲染指标" : "二维关键线 · 等待确认";
    this.sideHost.innerHTML = `
      <div class="reference-roster" aria-label="原型机体列表">
        ${AIRCRAFT_REFERENCES.map((item) => `<button class="reference-roster-item ${item.frameId === this.reference.frameId ? "selected" : ""}" data-frame="${item.frameId}"><span>${item.prototype}</span><small>${item.match}% · ${item.role}</small></button>`).join("")}
      </div>
      <div class="reference-heading"><div><span class="reference-kicker">REFERENCE TARGET</span><h1>${this.reference.prototype}</h1><p>${this.reference.summary}</p></div><div class="reference-score"><strong>${this.reference.match}</strong><small>匹配度</small></div></div>
      <div class="reference-score-track"><i style="width:${this.reference.match}%"></i></div><p class="reference-score-label">${this.reference.matchLabel}</p>
      <div class="reference-mode-tabs">${(["outline", "model", "skeleton", "build"] as ReferenceMode[]).map((key) => `<button class="${this.mode === key ? "selected" : ""}" data-mode="${key}" ${key === "model" && !this.featureApproved ? "disabled" : ""}>${modeCopy[key].label}</button>`).join("")}</div>
      <p class="reference-mode-copy">${modeCopy[this.mode].copy}</p>
      <section class="reference-three-view"><div class="reference-section-head"><span class="reference-kicker">THREE-VIEW SOURCE</span><a href="${this.reference.threeView.source}" target="_blank" rel="noreferrer">Wiki 线稿 ↗</a></div><figure><img src="${this.reference.threeView.src}" alt="${this.reference.threeView.alt}" loading="lazy"><figcaption>${this.reference.threeView.note}</figcaption></figure></section>
      ${this.skeletonCard(frame.length, frame.wingspan, world.player.parts)}
      ${this.pipelineCard()}
      ${this.moduleCard()}
      ${this.mode === "build" ? this.buildCard() : ""}
      <section class="reference-photos"><div class="reference-section-head"><span class="reference-kicker">PHOTO CHECK</span><span>三张实拍视角</span></div><div class="reference-photo-grid">${this.reference.photos.map((photo) => `<figure><img src="${photo.src}" alt="${photo.alt}" loading="lazy"><figcaption><span>${photo.caption}</span><small><a href="${photo.source}" target="_blank" rel="noreferrer">${photo.credit} ↗</a></small></figcaption></figure>`).join("")}</div></section>
      <section class="reference-notes"><div class="reference-section-head"><span class="reference-kicker">STRUCTURE NOTES</span><span>照片比对清单</span></div><ul>${this.reference.structuralNotes.map((note) => `<li>${note}</li>`).join("")}</ul></section>
    `;
  }

  private featurePlate(length: number, wingspan: number, parts: readonly Part[]) {
    const frame = airframeById(this.reference.frameId);
    if (frame.geometryProfile === "fokkerDr1") return fokkerReviewPlate(this.featureApproved);
    const evidenceReady = Boolean(this.reference.pipeline?.evidenceMatrix?.length);
    const jet = frame.geometryProfile === "vampire" || frame.geometryProfile === "ho229";
    const layerCount = Math.max(1, frame.wingCount ?? 1);
    const frontWings = Array.from({ length: layerCount }, (_, index) => {
      const y = 29 + index * (42 / Math.max(1, layerCount - 1));
      const inset = 12;
      return `<line class="feature-structure" x1="${inset}" y1="${y}" x2="${100 - inset}" y2="${y}"/><line class="feature-edge" x1="${inset + 2}" y1="${y + 3}" x2="${100 - inset - 2}" y2="${y + 3}"/>`;
    }).join("");
    const sideWings = Array.from({ length: layerCount }, (_, index) => {
      const y = 38 + index * (24 / Math.max(1, layerCount - 1));
      return `<line class="feature-structure" x1="28" y1="${y}" x2="59" y2="${y}"/>`;
    }).join("");
    const topWings = Array.from({ length: layerCount }, (_, index) => {
      const y = 20 + index * (60 / Math.max(1, layerCount - 1));
      const width = 62;
      const x = (100 - width) / 2;
      return `<path class="feature-surface" d="M ${x + 3} ${y} H ${x + width - 3} Q ${x + width} ${y} ${x + width} ${y + 3} V ${y + 9} Q ${x + width} ${y + 12} ${x + width - 3} ${y + 12} H ${x + 3} Q ${x} ${y + 12} ${x} ${y + 9} V ${y + 3} Q ${x} ${y} ${x + 3} ${y}"/>`;
    }).join("");
    const frontTail = `<line class="feature-tail" x1="41" y1="53" x2="59" y2="53"/><line class="feature-tail" x1="50" y1="38" x2="50" y2="24"/>`;
    const sideTail = `<line class="feature-tail" x1="70" y1="50" x2="86" y2="50"/><path class="feature-tail" d="M 74 45 Q 78 39 80 33 L 84 43"/>`;
    const topTail = `<path class="feature-tail" d="M 42 76 H 58 Q 60 76 60 79 V 83 Q 60 86 58 86 H 42 Q 40 86 40 83 V 79 Q 40 76 42 76"/><line class="feature-tail" x1="50" y1="76" x2="50" y2="88"/>`;
    const sidePropulsion = jet
      ? `<path class="feature-propulsion" d="M 75 45 L 85 50 L 75 55"/><text class="feature-label" x="74" y="68">尾喷口</text>`
      : `<line class="feature-propulsion" x1="22" y1="37" x2="22" y2="63"/><circle class="feature-propulsion" cx="22" cy="50" r="7"/><text class="feature-label" x="13" y="68">螺旋桨盘</text>`;
    const topPropulsion = jet
      ? `<path class="feature-propulsion" d="M 45 16 L 50 8 L 55 16"/><text class="feature-label" x="57" y="15">尾喷口</text>`
      : `<line class="feature-propulsion" x1="42" y1="12" x2="58" y2="12"/><circle class="feature-propulsion" cx="50" cy="12" r="6"/><text class="feature-label" x="58" y="11">螺旋桨盘</text>`;
    const gear = parts.some((part) => part.kind === "landingGear")
      ? `<path class="feature-structure" d="M 47 68 L 43 82 M 53 68 L 57 82"/><line class="feature-edge" x1="40" y1="84" x2="60" y2="84"/>`
      : "";
    return `<div class="reference-feature-plate">
      <div class="reference-feature-heading"><div><span class="reference-kicker">FEATURE ABSTRACTION</span><strong>简易三视图关键线</strong><small>从图纸提炼模块相对位置，不进行像素级描摹</small></div><span class="reference-feature-scale">${length.toFixed(1)}L · ${wingspan.toFixed(1)}W</span></div>
      <div class="reference-feature-grid">
        <figure class="reference-feature-view"><figcaption>正视 · 翼层与垂向间距</figcaption><svg viewBox="0 0 100 100" role="img" aria-label="正视关键线"><line class="feature-axis" x1="50" y1="10" x2="50" y2="90"/>${frontWings}<circle class="feature-body" cx="50" cy="50" r="11"/>${frontTail}<circle class="feature-propulsion" cx="50" cy="50" r="10"/>${gear}<text class="feature-label" x="52" y="15">中心线</text><text class="feature-label" x="6" y="95">下翼</text><text class="feature-label" x="76" y="95">上翼</text><text class="feature-label" x="52" y="25">垂直尾翼</text></svg></figure>
        <figure class="reference-feature-view"><figcaption>侧视 · 机身、短舱与站位</figcaption><svg viewBox="0 0 100 100" role="img" aria-label="侧视关键线"><line class="feature-axis" x1="10" y1="50" x2="90" y2="50"/><path class="feature-body" d="M 22 45 Q 37 38 58 42 Q 72 43 82 50 Q 72 57 58 58 Q 37 62 22 55 Z"/>${sideWings}${sidePropulsion}${sideTail}<line class="feature-edge" x1="59" y1="42" x2="59" y2="58"/><text class="feature-label" x="60" y="36">尾段</text><text class="feature-label" x="38" y="75">翼根站位</text><text class="feature-label" x="74" y="30">垂尾</text></svg></figure>
        <figure class="reference-feature-view"><figcaption>俯视 · 前后缘与横向位置</figcaption><svg viewBox="0 0 100 100" role="img" aria-label="俯视关键线"><line class="feature-axis" x1="50" y1="8" x2="50" y2="92"/>${topWings}<path class="feature-body" d="M 46 12 Q 50 8 54 12 L 56 78 Q 54 88 50 92 Q 46 88 44 78 Z"/>${topPropulsion}${topTail}<text class="feature-label" x="53" y="14">机头</text><text class="feature-label" x="53" y="90">机尾</text><text class="feature-label" x="61" y="82">水平尾翼</text></svg></figure>
      </div>
      <div class="reference-feature-key"><span><i class="axis"></i>中心线</span><span><i class="structure"></i>模块关键线</span><span><i class="edge"></i>轮廓边界</span><span><i class="propulsion"></i>螺旋桨盘 / 尾喷口</span></div>
      <div class="reference-feature-notes"><span>确认翼层的前后缘、根部和末端形状</span><span>确认机身与短舱在三视图中的相对站位</span><span>确认动力装置与尾段的纵向关系</span></div>
      ${evidenceReady ? "" : `<p class="reference-feature-preset-note">当前仅有通用关键线兜底。先补齐图纸证据矩阵和至少两个视图的定位记录，才能进入生成模型。</p>`}
      <button class="reference-feature-approve" data-action="approve-feature-map" ${evidenceReady ? "" : "disabled"}>${evidenceReady ? "确认特征抽象，进入生成模型" : "等待图纸证据矩阵"}</button>
    </div>`;
  }

  private skeletonCard(length: number, wingspan: number, parts: readonly Part[]) {
    const nodes = parts.map((part) => {
      const x = clamp(50 + (part.x / Math.max(1, wingspan)) * 82, 6, 94);
      const y = clamp(50 - (part.z / Math.max(1, length)) * 86, 7, 93);
      const target = part.role === "engine" ? "engines" : part.slot;
      return `<button class="reference-node ${this.highlight === target ? "selected" : ""}" data-highlight="${target}" style="left:${x}%;top:${y}%" aria-label="${roleLabel(part)}"><span>${roleLabel(part)}</span></button>`;
    }).join("");
    const wings = parts.filter((part) => part.role === "wing").map((part) => {
      const x = clamp(50 + (part.x / Math.max(1, wingspan)) * 82, 15, 85);
      const y = clamp(50 - (part.z / Math.max(1, length)) * 86, 8, 92);
      const tip = part.side === -1 ? 8 : part.side === 1 ? 92 : x;
      return `<span class="reference-wing-line" style="left:${Math.min(x, tip)}%;top:${y}%;width:${Math.abs(x - tip)}%"></span>`;
    }).join("");
    return `<section class="reference-skeleton-card ${this.mode === "skeleton" ? "focus" : ""}"><div class="reference-section-head"><span class="reference-kicker">CENTERLINE MAP</span><span>正视图 / 机头朝上</span></div><div class="reference-skeleton"><span class="reference-axis"></span>${wings}${nodes}<span class="reference-axis-label nose">NOSE</span><span class="reference-axis-label tail">TAIL</span></div><div class="reference-skeleton-legend"><span><i class="axis"></i>中心线</span><span><i class="wing"></i>翼根支线</span><span><i class="node"></i>模块锚点</span></div></section>`;
  }

  private moduleCard() {
    return `<section class="reference-module-card"><div class="reference-section-head"><span class="reference-kicker">MODULE CONTRACT</span><span>点击查看模型部件</span></div><div class="reference-module-list">${this.reference.modules.map((module) => { const target = module.key === "engine" ? "engines" : module.slot; return `<button class="reference-module ${this.highlight === target ? "selected" : ""}" data-highlight="${target}"><span class="reference-module-glyph">${module.key.slice(0, 1).toUpperCase()}</span><span><strong>${module.label}</strong><small>${module.detail}</small></span><b>↗</b></button>`; }).join("")}</div></section>`;
  }

  private pipelineCard() {
    const pipeline = this.reference.pipeline;
    if (!pipeline) return "";
    const edgeRows = pipeline.edgeRecords.map((edge) =>
      `<li><strong>${edge.module}</strong><span>${edge.station} · span ${edge.span.toFixed(2)} · sweep ${edge.sweep.toFixed(2)}</span><small>${edge.seam} · ${edge.clearance}</small></li>`,
    ).join("");
    const discrepancies = pipeline.discrepancyLog.map((entry) =>
      `<li><b>${entry.view}</b><span>${entry.change}</span><small>${entry.evidence}</small></li>`,
    ).join("");
    return `<section class="reference-pipeline-card"><div class="reference-section-head"><span class="reference-kicker">PIPELINE RECORD</span><span>${pipeline.architecture.layout} · ${pipeline.architecture.wingRelation}</span></div><div class="reference-pipeline-envelope"><span>翼展/机长 ${pipeline.envelope.wingspanToLength.toFixed(2)}</span><span>机身宽/机长 ${pipeline.envelope.maxFuselageWidthToLength.toFixed(2)}</span><span>翼根站位 ${pipeline.envelope.wingRootStationToLength.toFixed(2)}</span></div><h3>模块边缘</h3><ul>${edgeRows}</ul><h3>差异记录</h3><ul>${discrepancies}</ul></section>`;
  }

  private buildCard() {
    return `<section class="reference-build-card"><div class="reference-section-head"><span class="reference-kicker">FIRST BUILD</span><span>${this.reference.build.quality} / ${this.reference.build.quantity}</span></div><h2>${this.reference.build.headline}</h2><p>${this.reference.build.detail}</p><div class="reference-build-tags"><span>${this.reference.build.quality}</span><span>${this.reference.build.quantity}</span><span>中心线优先</span></div></section>`;
  }

  private loop(time: number) {
    const dt = this.previous ? Math.min(0.05, (time - this.previous) / 1000) : 0.016;
    this.previous = time;
    if (this.renderer && this.previewWorld) {
      this.renderer.render(this.previewWorld, dt, {
        display: true,
        showroom: true,
        highlight: this.highlight,
      });
    }
    requestAnimationFrame((next) => this.loop(next));
  }

  dispose() {
    this.previewWorld?.dispose();
    this.renderer?.dispose();
  }
}
