export class GameAudio {
  enabled = true;
  vibration = true;
  private context?: AudioContext;
  private voices = 0;
  unlock() {
    if (!this.enabled) return;
    try {
      this.context ??= new AudioContext();
      if (this.context.state === "suspended") void this.context.resume();
    } catch {
      /* Silent play is supported. */
    }
  }
  play(kind: "click" | "coin" | "hit" | "bomb" | "upgrade" | "lock" | "alert" | "kill" | "part" | "heal" | "boost") {
    if (
      !this.enabled ||
      !this.context ||
      this.context.state !== "running" ||
      this.voices > 8
    )
      return;
    const ctx = this.context,
      osc = ctx.createOscillator(),
      gain = ctx.createGain(),
      t = ctx.currentTime;
    const tones = {
      click: [480, 320, 0.055],
      coin: [880, 1480, 0.09],
      hit: [150, 45, 0.15],
      bomb: [100, 25, 0.45],
      upgrade: [430, 950, 0.28],
      lock: [760, 1160, 0.18],
      alert: [180, 90, 0.22],
      kill: [420, 1040, 0.2],
      part: [210, 75, 0.24],
      heal: [520, 880, 0.22],
      boost: [180, 620, 0.25],
    };
    const [start, end, duration] = tones[kind];
    osc.type = kind === "hit" || kind === "bomb" || kind === "alert" ? "sawtooth" : "sine";
    osc.frequency.setValueAtTime(start, t);
    osc.frequency.exponentialRampToValueAtTime(end, t + duration);
    gain.gain.setValueAtTime(kind === "bomb" ? 0.07 : 0.035, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(t + duration);
    this.voices++;
    osc.onended = () => {
      this.voices--;
      osc.disconnect();
      gain.disconnect();
    };
    if (this.vibration && ["hit", "bomb", "upgrade", "alert", "part", "heal"].includes(kind))
      navigator.vibrate?.(kind === "hit" ? 35 : kind === "alert" ? 18 : kind === "heal" ? 15 : 20);
  }
}
