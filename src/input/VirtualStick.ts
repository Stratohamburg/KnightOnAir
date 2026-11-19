import { clamp, damp } from "../services/Random";
import type { Intent } from "../simulation/types";
export class VirtualStick {
  private pointer: number | null = null;
  private rawX = 0;
  private rawZ = 0;
  private smoothX = 0;
  private smoothZ = 0;
  private keys = new Set<string>();
  enabled = false;
  private surface?: HTMLElement;
  private knob?: HTMLElement;
  private base?: HTMLElement;
  private label?: HTMLElement;
  private energyAvailable = true;
  private bombing = false;
  private abort?: AbortController;
  attach(surface: HTMLElement) {
    this.abort?.abort();
    this.abort = new AbortController();
    this.surface = surface;
    this.knob = surface.querySelector<HTMLElement>(".stick-knob")!;
    this.base = surface.querySelector<HTMLElement>(".stick-base") ?? surface;
    this.label =
      surface.querySelector<HTMLElement>(".stick-label") ?? undefined;
    this.feedback(0, 0, 0);
    const signal = this.abort.signal;
    surface.addEventListener(
      "pointerdown",
      (e) => {
        if (
          !this.enabled ||
          this.pointer !== null ||
          (e.pointerType === "mouse" && e.button !== 0)
        )
          return;
        this.pointer = e.pointerId;
        surface.setPointerCapture(e.pointerId);
        surface.classList.add("active");
        this.move(e);
      },
      { signal },
    );
    surface.addEventListener(
      "pointermove",
      (e) => {
        if (e.pointerId === this.pointer) this.move(e);
      },
      { signal },
    );
    for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
      surface.addEventListener(
        event,
        (e: Event) => {
          if ((e as PointerEvent).pointerId === this.pointer)
            this.resetPointer();
        },
        { signal },
      );
    surface.addEventListener("contextmenu", (e) => e.preventDefault(), {
      signal,
    });
  }
  key(code: string, down: boolean) {
    if (down) this.keys.add(code);
    else this.keys.delete(code);
  }
  setFlightState(energyAvailable: boolean, bombing: boolean) {
    this.energyAvailable = energyAvailable;
    this.bombing = bombing;
  }
  private radius() {
    const rect = this.base!.getBoundingClientRect();
    return Math.max(1, Math.min(rect.width, rect.height) / 2);
  }
  private move(e: PointerEvent) {
    const rect = this.surface!.getBoundingClientRect();
    const radius = this.radius();
    const x = (e.clientX - rect.left - rect.width / 2) / radius,
      z = -(e.clientY - rect.top - rect.height / 2) / radius;
    const len = Math.max(1, Math.hypot(x, z));
    this.rawX = x / len;
    this.rawZ = z / len;
    this.knob!.style.transform = `translate(${this.rawX * radius}px, ${-this.rawZ * radius}px)`;
  }
  read(dt: number): Intent {
    if (!this.enabled) return { x: 0, z: 1, active: false, magnitude: 0 };
    const kx =
      Number(this.keys.has("KeyD") || this.keys.has("ArrowRight")) -
      Number(this.keys.has("KeyA") || this.keys.has("ArrowLeft"));
    const kz =
      Number(this.keys.has("KeyW") || this.keys.has("ArrowUp")) -
      Number(this.keys.has("KeyS") || this.keys.has("ArrowDown"));
    const x = kx || kz ? kx / (Math.hypot(kx, kz) || 1) : this.rawX;
    const z = kx || kz ? kz / (Math.hypot(kx, kz) || 1) : this.rawZ;
    this.smoothX = damp(this.smoothX, x, 24, dt);
    this.smoothZ = damp(this.smoothZ, z, 24, dt);
    const rawLength = Math.hypot(x, z),
      length = Math.hypot(this.smoothX, this.smoothZ);
    const active = rawLength > 0.12;
    const magnitude = active ? clamp((length - 0.12) / 0.88) ** 0.85 : 0;
    this.feedback(magnitude, x, z);
    return {
      // The fixed camera looks toward +Z, so screen right is world -X.
      x: -this.smoothX / (length || 1),
      z: this.smoothZ / (length || 1),
      active,
      magnitude,
    };
  }
  private feedback(magnitude: number, x: number, z: number) {
    if (!this.surface || !this.knob) return;
    const throttle = this.energyAvailable
      ? magnitude * (this.bombing ? 0.45 : 1)
      : 0;
    const percent = Math.round(throttle * 100);
    const mode =
      magnitude > 0 && !this.energyAvailable
        ? "depleted"
        : magnitude === 0
          ? "cruise"
          : this.bombing
            ? "trim"
            : percent === 100
              ? "full"
              : "accelerating";
    this.surface.dataset.mode = mode;
    this.surface.style.setProperty("--throttle", String(percent));
    this.surface.setAttribute("aria-valuenow", String(percent));
    const message =
      mode === "depleted"
        ? "能量不足 · 松杆恢复"
        : mode === "cruise"
          ? "巡航 · 油门 0%"
          : mode === "trim"
            ? `轰炸微调 · 油门 ${percent}%`
            : mode === "full"
              ? "满油门 · 加速 100%"
              : `加速 · 油门 ${percent}%`;
    this.surface.setAttribute("aria-valuetext", message);
    if (this.label && this.label.textContent !== message)
      this.label.textContent = message;
    const radius = this.radius();
    this.knob.style.transform =
      x || z ? `translate(${x * radius}px, ${-z * radius}px)` : "";
  }
  private resetPointer() {
    if (this.pointer !== null && this.surface?.hasPointerCapture(this.pointer))
      this.surface.releasePointerCapture(this.pointer);
    this.pointer = null;
    this.rawX = 0;
    this.rawZ = 0;
    this.feedback(0, 0, 0);
    this.surface?.classList.remove("active");
    if (this.knob) this.knob.style.transform = "";
  }
  reset() {
    this.resetPointer();
    this.keys.clear();
    this.smoothX = 0;
    this.smoothZ = 0;
  }
}
