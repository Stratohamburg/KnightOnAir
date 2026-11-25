import { RULES } from "../data/config";
import { angleDelta, clamp, damp, RAD } from "../services/Random";
import type { ContinuousTurn, Intent } from "../simulation/types";
export class VirtualStick {
  private pointer: number | null = null;
  private rawX = 0;
  private rawZ = 0;
  private smoothX = 0;
  private smoothZ = 0;
  private pointerAngle?: number;
  private angularTravel = 0;
  private continuousTurn?: ContinuousTurn;
  private keys = new Set<string>();
  private acceptingInput = false;
  private surface?: HTMLElement;
  private knob?: HTMLElement;
  private base?: HTMLElement;
  private label?: HTMLElement;
  private energyAvailable = true;
  private boostLocked = false;
  private bombing = false;
  private abort?: AbortController;
  get enabled() {
    return this.acceptingInput;
  }
  set enabled(enabled: boolean) {
    this.acceptingInput = enabled;
    if (!enabled) this.reset();
  }
  attach(surface: HTMLElement) {
    this.abort?.abort();
    this.resetPointer();
    this.abort = new AbortController();
    this.surface = surface;
    this.knob = surface.querySelector<HTMLElement>(".stick-knob")!;
    this.base = surface.querySelector<HTMLElement>(".stick-base") ?? surface;
    this.label =
      surface.querySelector<HTMLElement>(".stick-label") ?? undefined;
    this.surface.dataset.bombing = String(this.bombing);
    this.surface.style.setProperty("--outer-ratio", String(RULES.boost.outerRadius));
    this.feedback(0, 0, 0, 0);
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
        if (e.pointerId !== this.pointer) return;
        const samples = e.getCoalescedEvents?.();
        if (samples?.length) {
          for (const sample of samples) this.move(sample);
        } else {
          this.move(e);
        }
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
    if (down && this.enabled) this.keys.add(code);
    else this.keys.delete(code);
  }
  setFlightState(energyAvailable: boolean, bombing: boolean, boostLocked = false) {
    this.energyAvailable = energyAvailable;
    this.boostLocked = boostLocked;
    if (this.bombing === bombing) return;
    this.bombing = bombing;
    this.resetPointer();
    if (this.surface) {
      this.surface.dataset.bombing = String(bombing);
      this.surface.setAttribute("aria-label", bombing ? "轰炸微调摇杆" : "飞行摇杆，外圈加力");
    }
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
    const outer = this.bombing ? 1 : RULES.boost.outerRadius;
    const len = Math.max(1, Math.hypot(x, z) / outer);
    this.rawX = x / len;
    this.rawZ = z / len;
    this.trackAngle();
    this.knob!.style.transform = `translate(${this.rawX * radius}px, ${-this.rawZ * radius}px)`;
  }
  private trackAngle() {
    const { deadZone, maxSweepStepDegrees, turnLockDegrees, turnReverseDegrees } = RULES.joystick;
    if (Math.hypot(this.rawX, this.rawZ) <= deadZone) {
      this.resetGesture();
      return;
    }

    const angle = Math.atan2(-this.rawX, this.rawZ);
    const previous = this.pointerAngle;
    this.pointerAngle = angle;
    if (previous === undefined) return;

    const delta = angleDelta(angle, previous);
    if (Math.abs(delta) > maxSweepStepDegrees * RAD) {
      this.resetGesture();
      this.pointerAngle = angle;
      return;
    }

    if (this.continuousTurn === undefined) {
      const continuesSweep = delta * this.angularTravel > 0;
      this.angularTravel += delta;
      if (!continuesSweep || Math.abs(this.angularTravel) < turnLockDegrees * RAD) return;
      this.continuousTurn = this.angularTravel < 0 ? -1 : 1;
    } else {
      this.angularTravel = Math.max(0, this.angularTravel - delta * this.continuousTurn);
      if (this.angularTravel < turnReverseDegrees * RAD) return;
      this.continuousTurn = this.continuousTurn === 1 ? -1 : 1;
    }
    this.angularTravel = 0;
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
    const rawLength = Math.hypot(x, z);
    const length = Math.hypot(this.smoothX, this.smoothZ);
    const isKeyboard = Boolean(kx || kz);
    const { deadZone } = RULES.joystick;
    const travel = isKeyboard ? 1 : clamp((length - deadZone) / (1 - deadZone));
    const active = rawLength > deadZone;
    const magnitude = active ? travel : 0;
    const shift = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    const boost = !active || this.bombing ? 0 : isKeyboard
      ? Number(shift)
      : clamp((length - 1) / (RULES.boost.outerRadius - 1));
    this.feedback(magnitude, this.boostLocked || !this.energyAvailable ? 0 : boost, x, z);
    return {
      // The fixed camera looks toward +Z, so screen right is world -X.
      x: -this.smoothX / (length || 1),
      z: this.smoothZ / (length || 1),
      active,
      magnitude,
      boost,
      travel,
      continuousTurn: active && !isKeyboard ? this.continuousTurn : undefined,
    };
  }
  private feedback(magnitude: number, boost: number, x: number, z: number) {
    if (!this.surface || !this.knob) return;
    const percent = Math.round(magnitude * (this.bombing ? 45 : 100));
    const mode = magnitude === 0
      ? "cruise"
      : this.bombing
        ? "trim"
        : this.boostLocked || !this.energyAvailable
          ? "locked"
          : boost > 0
            ? "boost"
            : percent === 100
              ? "full"
              : "accelerating";
    this.surface.dataset.mode = mode;
    this.surface.style.setProperty("--throttle", String(percent));
    this.surface.setAttribute("aria-valuenow", String(percent));
    const message = mode === "locked"
      ? "加力回充 · 油门 " + percent + "%"
      : mode === "cruise"
        ? (this.bombing ? "松杆稳定准心" : "巡航 · 油门 0%")
        : mode === "trim"
          ? "轰炸微调 · 油门 " + percent + "%"
          : mode === "boost"
            ? "加力 " + Math.round(boost * 100) + "%"
            : mode === "full"
              ? "满油门 · 外拉加力"
              : "油门 " + percent + "%";
    this.surface.setAttribute("aria-valuetext", message);
    if (this.label && this.label.textContent !== message)
      this.label.textContent = message;
    const radius = this.radius();
    this.knob.style.transform =
      x || z ? `translate(${x * radius}px, ${-z * radius}px)` : "";
  }
  private resetGesture() {
    this.pointerAngle = undefined;
    this.angularTravel = 0;
    this.continuousTurn = undefined;
  }
  private resetPointer() {
    const pointer = this.pointer;
    this.pointer = null;
    if (pointer !== null && this.surface?.hasPointerCapture(pointer))
      this.surface.releasePointerCapture(pointer);
    this.rawX = 0;
    this.rawZ = 0;
    this.smoothX = 0;
    this.smoothZ = 0;
    this.resetGesture();
    this.feedback(0, 0, 0, 0);
    this.surface?.classList.remove("active");
    if (this.knob) this.knob.style.transform = "";
  }
  reset() {
    this.resetPointer();
    this.keys.clear();
    this.energyAvailable = true;
    this.boostLocked = false;
    this.feedback(0, 0, 0, 0);
  }
}
