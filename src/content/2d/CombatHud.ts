import { RULES } from "../../data/config";
import type { Phase, WorldEvent } from "../../simulation/types";
import { edgeAnchors, radarPoint, type EdgeRect, type ThreatView } from "./combatHints";
import { NodePool, setMeter } from "./components";

export interface NameplateView {
  id: number;
  layer: string;
  label: string;
  x: number;
  y: number;
  quality: number;
  health: number;
  mission?: boolean;
  friendly?: boolean;
}

type ProjectedLabel = { text: string; x: number; y: number; ready?: boolean };

const RADAR_DIAMETER = 84;
const EDGE_INSET = { left: 14, right: 14, top: 124, bottom: 156 };

export class CombatHud {
  readonly root = document.createElement("div");
  private readonly radar = document.createElement("div");
  private readonly edges = document.createElement("div");
  private readonly feed = document.createElement("div");
  private readonly feedSlots = Array.from({ length: 3 }, () => document.createElement("div"));
  private readonly radarPool = this.pool(this.radar, RULES.maxTotal + 2);
  private readonly edgePool = this.pool(this.edges, RULES.edgeMax);
  private readonly nameplates: NodePool<{ node: HTMLDivElement; label: HTMLSpanElement; fill: HTMLElement }>;
  private readonly lock = document.createElement("div");
  private readonly aim = document.createElement("div");
  private readonly resizeObserver?: ResizeObserver;
  private alertTimer = 0;
  private viewportWidth = 390;
  private viewportHeight = 844;

  constructor(host: HTMLElement, private readonly labels: HTMLElement) {
    this.root.className = "combat-hud";
    this.root.setAttribute("aria-hidden", "true");
    this.radar.className = "combat-radar";
    this.edges.className = "combat-edges";
    this.feed.className = "combat-feed";
    this.root.append(this.radar, this.edges, this.feed);
    host.append(this.root);

    this.lock.className = "lock-label";
    this.aim.className = "aim-label";
    this.lock.hidden = this.aim.hidden = true;
    labels.append(this.lock, this.aim);

    this.nameplates = new NodePool(
      RULES.maxTotal + 2,
      () => {
        const node = document.createElement("div");
        const label = document.createElement("span");
        const track = document.createElement("div");
        const fill = document.createElement("i");
        track.append(fill);
        node.append(label, track);
        labels.prepend(node);
        return { node, label, fill };
      },
      ({ node }, visible) => {
        node.hidden = !visible;
      },
    );

    this.syncViewport(this.root.clientWidth || host.clientWidth, this.root.clientHeight || host.clientHeight);
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver((entries) => {
        const box = entries[0]?.contentRect;
        if (box) this.syncViewport(box.width, box.height);
      });
      this.resizeObserver.observe(this.root);
    }
  }

  setViewportSize(width: number, height: number) {
    this.syncViewport(width, height);
  }

  private syncViewport(width: number, height: number) {
    if (width > 0) this.viewportWidth = width;
    if (height > 0) this.viewportHeight = height;
  }

  private edgeBounds(): EdgeRect {
    const left = EDGE_INSET.left;
    const right = Math.max(left + 32, this.viewportWidth - EDGE_INSET.right);
    const top = EDGE_INSET.top;
    const bottom = Math.max(top + 32, this.viewportHeight - EDGE_INSET.bottom);
    return { left, right, top, bottom };
  }

  private pool(host: HTMLElement, capacity: number) {
    return new NodePool(
      capacity,
      () => {
        const node = document.createElement("i");
        host.append(node);
        return node;
      },
      (node, visible) => {
        node.hidden = !visible;
      },
    );
  }

  consume(events: readonly WorldEvent[]) {
    for (const event of events) {
      if (event.type === "enemy_fire" || event.type === "ground_attack" || event.type === "missile_lock_warning") {
        this.alertTimer = 0.45;
        this.root.classList.add("combat-alert");
      }
      const text =
        event.type === "enemy_destroyed"
          ? `${event.kind} · +${event.score}`
          : event.type === "part_disabled"
            ? `${event.label}损毁`
            : "";
      if (text) {
        const item = this.feedSlots.pop()!;
        item.textContent = text;
        this.feed.prepend(item);
        this.feedSlots.unshift(item);
      }
    }
  }

  update(phase: Phase, player: { x: number; z: number; heading: number }, contacts: readonly ThreatView[], dt: number) {
    this.root.dataset.phase = phase;
    this.root.hidden = phase === "result";
    if (phase !== "paused" && phase !== "upgrade") this.alertTimer = Math.max(0, this.alertTimer - dt);
    if (!this.alertTimer) this.root.classList.remove("combat-alert");

    this.radarPool.update(contacts, (dot, contact) => {
      const point = radarPoint(contact, player, RADAR_DIAMETER);
      const threat = contact.firing || contact.chasing;
      dot.className = `radar-contact ${contact.layer}${threat ? " firing" : ""}${contact.breaking ? " breaking" : ""}${contact.missionName ? " mission-marker" : ""}${contact.friendly ? " friendly" : ""}`;
      dot.style.transform = `translate3d(${point.x.toFixed(1)}px, ${point.y.toFixed(1)}px, 0)`;
    });

    this.edgePool.update(edgeAnchors(contacts, this.edgeBounds()), (arrow, anchor) => {
      arrow.className = `edge-indicator${anchor.breaking ? " breaking" : ""}${anchor.missionName ? " mission-marker" : ""}${anchor.friendly ? " friendly" : ""}`;
      const x = anchor.missionName ? Math.max(75, Math.min(this.viewportWidth - 75, anchor.x)) : anchor.x;
      const angle = anchor.missionName ? "" : ` rotate(${anchor.angle.toFixed(1)}deg)`;
      arrow.style.transform = `translate3d(${x.toFixed(1)}px, ${anchor.y.toFixed(1)}px, 0) translate(-50%, -50%)${angle}`;
      const direction = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"][(Math.round(anchor.angle / 45) + 8) % 8];
      const text = anchor.missionName ? `${direction} ◇ ${anchor.missionName}` : anchor.count > 1 ? `×${anchor.count}` : "◆";
      if (arrow.textContent !== text) arrow.textContent = text;
    });
  }

  updateLabels(contacts: readonly NameplateView[], lock?: ProjectedLabel, aim?: ProjectedLabel) {
    const occupied: { x: number; y: number }[] = [];
    this.nameplates.update(contacts, ({ node, label, fill }, contact) => {
      let y = contact.y;
      if (contact.mission) {
        while (occupied.some((point) => Math.abs(point.x - contact.x) < 80 && Math.abs(point.y - y) < 23))
          y += 23;
        occupied.push({ x: contact.x, y });
      }
      node.className = `enemy-label ${contact.layer}${contact.quality < 1 ? " cloud-occluded" : ""}${contact.mission ? " mission-marker" : ""}${contact.friendly ? " friendly" : ""}`;
      node.style.transform = `translate3d(${contact.x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -100%)`;
      node.style.opacity = String(contact.quality);
      if (label.textContent !== contact.label) label.textContent = contact.label;
      setMeter(fill, contact.health);
    });
    this.placeLabel(this.lock, lock);
    this.placeLabel(this.aim, aim);
  }

  private placeLabel(node: HTMLElement, label?: ProjectedLabel) {
    node.hidden = !label;
    if (!label) return;
    node.style.transform = `translate3d(${label.x.toFixed(1)}px, ${label.y.toFixed(1)}px, 0) translateX(-50%)`;
    node.classList.toggle("ready", !!label.ready);
    if (node.textContent !== label.text) node.textContent = label.text;
  }

  get diagnostics() {
    return {
      radar: this.radarPool.diagnostics,
      threats: this.edgePool.diagnostics,
      nameplates: this.nameplates.diagnostics,
      feed: { capacity: this.feedSlots.length, active: this.feed.children.length },
      viewport: { width: this.viewportWidth, height: this.viewportHeight },
    };
  }

  dispose() {
    this.resizeObserver?.disconnect();
    this.root.remove();
    this.labels.replaceChildren();
  }
}
