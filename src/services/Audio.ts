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
  play(kind: "click" | "coin" | "hit" | "bomb" | "upgrade" | "lock") {
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
    };
    const [start, end, duration] = tones[kind];
    osc.type = kind === "hit" || kind === "bomb" ? "sawtooth" : "sine";
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
    if (this.vibration && ["hit", "bomb", "upgrade"].includes(kind))
      navigator.vibrate?.(kind === "hit" ? 35 : 20);
  }
}
