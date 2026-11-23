import { RULES } from "../../data/config";
import type { Phase, WorldEvent } from "../../simulation/types";
import { edgeAnchors, radarPoint, type ThreatView } from "./combatHints";
import { NodePool, setMeter } from "./components";

export interface NameplateView {
  id: number;
  layer: string;
  label: string;
  x: number;
  y: number;
  quality: number;
  health: number;
}

type ProjectedLabel = { text: string; x: number; y: number; ready?: boolean };

export class CombatHud {
  readonly root = document.createElement("div");
  private readonly radar = document.createElement("div");
  private readonly edges = document.createElement("div");
  private readonly feed = document.createElement("div");
  private readonly feedSlots = Array.from({ length: 3 }, () => document.createElement("div"));
  private readonly radarPool = this.pool(this.radar, RULES.maxTotal);
  private readonly edgePool = this.pool(this.edges, RULES.edgeMax);
  private readonly nameplates: NodePool<{ node: HTMLDivElement; label: HTMLSpanElement; fill: HTMLElement }>;
  private readonly lock = document.createElement("div");
  private readonly aim = document.createElement("div");
  private alertTimer = 0;

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
    this.nameplates = new NodePool(RULES.maxTotal, () => {
      const node = document.createElement("div");
      const label = document.createElement("span");
      const track = document.createElement("div");
      const fill = document.createElement("i");
      track.append(fill);
      node.append(label, track);
      labels.prepend(node);
      return { node, label, fill };
    }, ({ node }, visible) => { node.hidden = !visible; });
  }

  private pool(host: HTMLElement, capacity: number) {
    return new NodePool(capacity, () => {
      const node = document.createElement("i");
      host.append(node);
      return node;
    }, (node, visible) => { node.hidden = !visible; });
  }

  consume(events: readonly WorldEvent[]) {
    for (const event of events) {
      if (event.type === "enemy_fire" || event.type === "ground_attack" || event.type === "missile_lock_warning") {
        this.alertTimer = .45;
        this.root.classList.add("combat-alert");
      }
      const text = event.type === "enemy_destroyed" ? `${event.kind} · +${event.score}` :
        event.type === "part_disabled" ? `${event.label}损毁` : "";
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
      const point = radarPoint(contact, player, 112);
      const threat = contact.firing || contact.chasing;
      dot.className = `radar-contact ${contact.layer}${threat ? " firing" : ""}${contact.breaking ? " breaking" : ""}`;
      dot.style.transform = `translate(${point.x}px, ${point.y}px)`;
    });
    const rect = this.root.getBoundingClientRect();
    this.edgePool.update(edgeAnchors(contacts, { left: 12, right: rect.width - 12, top: 12, bottom: rect.height - 64 }), (arrow, anchor) => {
      arrow.className = anchor.breaking ? "edge-indicator breaking" : "edge-indicator";
      arrow.style.left = `${anchor.x}px`;
      arrow.style.top = `${anchor.y}px`;
      arrow.style.transform = `translate(-50%, -50%) rotate(${anchor.angle}deg)`;
      arrow.textContent = anchor.count > 1 ? `×${anchor.count}` : "◆";
    });
  }

  updateLabels(contacts: readonly NameplateView[], lock?: ProjectedLabel, aim?: ProjectedLabel) {
    this.nameplates.update(contacts, ({ node, label, fill }, contact) => {
      node.className = `enemy-label ${contact.layer}${contact.quality < 1 ? " cloud-occluded" : ""}`;
      node.style.left = `${contact.x}px`;
      node.style.top = `${contact.y}px`;
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
    node.style.left = `${label.x}px`;
    node.style.top = `${label.y}px`;
    node.classList.toggle("ready", !!label.ready);
    node.textContent = label.text;
  }

  get diagnostics() {
    return { radar: this.radarPool.diagnostics, threats: this.edgePool.diagnostics, nameplates: this.nameplates.diagnostics,
      feed: { capacity: this.feedSlots.length, active: this.feed.children.length } };
  }

  dispose() {
    this.root.remove();
    this.labels.replaceChildren();
  }
}
