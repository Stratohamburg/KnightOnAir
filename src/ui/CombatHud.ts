import type { Renderer } from "../rendering/Renderer";
import type { WorldEvent } from "../simulation/types";
import { edgeAnchors, radarPoint, type ThreatView } from "./combatHints";
import type { World } from "../simulation/World";

export class CombatHud {
  readonly root: HTMLElement;
  private radar: HTMLElement;
  private edges: HTMLElement;
  private feed: HTMLElement;
  private alertTimer = 0;

  constructor(host: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "combat-hud";
    this.root.setAttribute("aria-hidden", "true");
    this.root.innerHTML = '<div class="combat-radar"></div><div class="combat-edges"></div><div class="combat-feed"></div>';
    host.append(this.root);
    this.radar = this.root.querySelector(".combat-radar")!;
    this.edges = this.root.querySelector(".combat-edges")!;
    this.feed = this.root.querySelector(".combat-feed")!;
  }

  consume(events: readonly WorldEvent[]) {
    for (const event of events) {
      if (event.type === "enemy_fire" || event.type === "ground_attack" || event.type === "missile_lock_warning") {
        this.alertTimer = 0.45;
        this.root.classList.add("combat-alert");
      }
      if (event.type === "enemy_destroyed") {
        const item = document.createElement("div");
        item.textContent = `${event.kind} · +${event.score}`;
        this.feed.prepend(item);
        while (this.feed.children.length > 3) this.feed.lastElementChild?.remove();
      }
      if (event.type === "part_disabled") {
        const item = document.createElement("div");
        item.textContent = `${event.label}损毁`;
        this.feed.prepend(item);
        while (this.feed.children.length > 3) this.feed.lastElementChild?.remove();
      }
    }
  }

  update(world: World, renderer: Renderer | undefined, dt: number) {
    if (!renderer || world.phase === "result") {
      this.root.style.display = "none";
      return;
    }
    this.root.style.display = "block";
    this.alertTimer = Math.max(0, this.alertTimer - dt);
    if (!this.alertTimer) this.root.classList.remove("combat-alert");
    const p = world.player;
    const contacts = world.enemies.map<ThreatView>((enemy) => {
      const dx = enemy.x - p.x;
      const dz = enemy.z - p.z;
      const bearing = Math.atan2(dx, dz) - p.heading;
      return {
        id: enemy.id,
        x: enemy.x,
        y: enemy.layer === "air" ? 20 : 0,
        z: enemy.z,
        layer: enemy.layer === "air" ? "air" : "ground",
        distance: Math.hypot(dx, dz),
        bearing,
        firing: enemy.warning > 0,
        chasing: enemy.state === "attacking",
        elite: enemy.kind === "elite",
        onScreen: renderer.project(enemy.x, enemy.layer === "air" ? 20 : 0, enemy.z).visible,
        kind: enemy.kind,
      };
    });
    this.radar.replaceChildren(
      ...contacts.map((contact) => {
        const point = radarPoint(contact, p, 112);
        const dot = document.createElement("i");
        dot.className = `radar-contact ${contact.layer}${contact.firing ? " firing" : ""}`;
        dot.style.transform = `translate(${point.x}px, ${point.y}px)`;
        return dot;
      }),
    );
    const rect = this.root.getBoundingClientRect();
    this.edges.replaceChildren(
      ...edgeAnchors(contacts, { left: 12, right: rect.width - 12, top: 12, bottom: rect.height - 64 }).map((anchor) => {
        const arrow = document.createElement("i");
        arrow.className = "edge-indicator";
        arrow.style.left = `${anchor.x}px`;
        arrow.style.top = `${anchor.y}px`;
        arrow.style.transform = `translate(-50%, -50%) rotate(${anchor.angle}deg)`;
        arrow.textContent = anchor.count > 1 ? `×${anchor.count}` : "◆";
        return arrow;
      }),
    );
  }

  dispose() {
    this.root.remove();
  }
}
