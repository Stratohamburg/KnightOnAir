import { weaponEffectId } from "../content/fx/profiles";
import type { WorldEvent } from "../simulation/types";
import { WEAPONS } from "../data/weapons";

type Sound = "click" | "coin" | "hit" | "bomb" | "upgrade" | "lock" | "alert" | "kill" | "part" | "heal" | "boost" |
  "machineGun" | "cannon" | "rocket" | "missile" | "impact" | "explosiveImpact";

export class GameAudio {
  enabled = true;
  vibration = true;
  private context?: AudioContext;
  private voices = 0;
  private readonly lastBattleSound = new Map<Sound, number>();

  resetBattle() { this.lastBattleSound.clear(); }

  consumeBattle(events: readonly WorldEvent[]) {
    const cue = (sound: Sound, time: number, interval = .12) => {
      if (time - (this.lastBattleSound.get(sound) ?? -Infinity) < interval) return;
      this.lastBattleSound.set(sound, time);
      this.play(sound);
    };
    for (const event of events) {
      if (event.type === "weapon_fired") {
        const { weaponId, damageType } = event.snapshot;
        const sound = weaponId && WEAPONS[weaponId]?.category === "area" ? "bomb" : weaponEffectId(weaponId, damageType);
        cue(sound, event.time, sound === "machineGun" ? .11 : .19);
      } else if (event.type === "player_hit" || event.type === "enemy_hit") {
        const sound = event.type === "player_hit" ? "hit" :
          event.snapshot.damageType === "explosive" ? "explosiveImpact" : "impact";
        cue(sound, event.time, .13);
      } else if (event.type === "upgrade_installed") {
        this.play("upgrade", false);
        if (this.vibration) globalThis.navigator?.vibrate?.(event.animation === "extension" ? 28 : 16);
      } else if (event.type === "enemy_destroyed") cue("kill", event.time);
      else if (event.type === "part_disabled") cue("part", event.time);
      else if (event.type === "pickup") cue(event.kind === "coin" ? "coin" : "heal", event.time);
      else if (event.type === "enemy_fire" || event.type === "ground_attack" || event.type === "missile_lock_warning")
        cue("alert", event.time, .25);
    }
  }
  unlock() {
    if (!this.enabled) return;
    try {
      this.context ??= new AudioContext();
      if (this.context.state === "suspended") void this.context.resume();
    } catch {
      /* Silent play is supported. */
    }
  }
  play(kind: Sound, haptic = true) {
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
      machineGun: [280, 95, .065],
      cannon: [195, 51, .125],
      rocket: [205, 88, .22],
      missile: [310, 690, .25],
      impact: [445, 140, .08],
      explosiveImpact: [110, 33, .24],
    };
    const [start, end, duration] = tones[kind];
    osc.type = ["hit", "bomb", "alert", "machineGun", "cannon", "rocket", "explosiveImpact"].includes(kind) ? "sawtooth" : "sine";
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
    if (haptic && this.vibration && ["hit", "bomb", "upgrade", "alert", "part", "heal"].includes(kind))
      navigator.vibrate?.(kind === "hit" ? 35 : kind === "alert" ? 18 : kind === "heal" ? 15 : 20);
  }
}
