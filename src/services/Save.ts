import { AIRFRAMES, airframeById } from "../data/aircrafts";
import type { Quality } from "../data/config";
import type { World } from "../simulation/World";
export interface SaveData {
  version: 1;
  equipped: string;
  unlocked: string[];
  bestScore: number;
  bestTime: number;
  currency: number;
  totalXp: number;
  sorties: number;
  quality: Quality;
  sound: boolean;
  vibration: boolean;
}
const defaults = (): SaveData => ({
  version: 1,
  equipped: AIRFRAMES[0].id,
  unlocked: [AIRFRAMES[0].id],
  bestScore: 0,
  bestTime: 0,
  currency: 0,
  totalXp: 0,
  sorties: 0,
  quality: "standard",
  sound: true,
  vibration: true,
});
export class SaveStore {
  data = defaults();
  available = true;
  constructor(
    private storage:
      Pick<Storage, "getItem" | "setItem"> | undefined = undefined,
  ) {
    try {
      this.storage ??=
        typeof localStorage === "undefined" ? undefined : localStorage;
      if (!this.storage) this.available = false;
      const raw = this.storage?.getItem("knight-on-air.v1");
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved || saved.version !== 1) return;
      const base = defaults();
      for (const key of [
        "bestScore",
        "bestTime",
        "currency",
        "totalXp",
        "sorties",
      ] as const) {
        if (typeof saved[key] === "number" && Number.isFinite(saved[key]))
          base[key] = Math.max(0, saved[key]);
      }
      base.unlocked = AIRFRAMES.filter(
        (f) =>
          f.unlockScore <= base.bestScore ||
          (Array.isArray(saved.unlocked) && saved.unlocked.includes(f.id)),
      ).map((f) => f.id);
      base.equipped = base.unlocked.includes(saved.equipped)
        ? airframeById(saved.equipped).id
        : AIRFRAMES[0].id;
      if (["low", "standard", "high"].includes(saved.quality))
        base.quality = saved.quality;
      if (typeof saved.sound === "boolean") base.sound = saved.sound;
      if (typeof saved.vibration === "boolean")
        base.vibration = saved.vibration;
      this.data = base;
    } catch {
      this.available = false;
    }
  }
  persist() {
    try {
      this.storage?.setItem("knight-on-air.v1", JSON.stringify(this.data));
    } catch {
      this.available = false;
    }
  }
  equip(id: string) {
    if (this.data.unlocked.includes(id)) {
      this.data.equipped = id;
      this.persist();
      return true;
    }
    return false;
  }
  record(world: World) {
    const s = this.data;
    s.bestScore = Math.max(s.bestScore, world.score);
    s.bestTime = Math.max(s.bestTime, world.elapsed);
    s.currency += world.coins;
    s.totalXp += world.score;
    s.sorties++;
    const unlocks = AIRFRAMES.filter(
      (f) => f.unlockScore <= s.bestScore && !s.unlocked.includes(f.id),
    );
    s.unlocked.push(...unlocks.map((f) => f.id));
    this.persist();
    return unlocks;
  }
  get playerLevel() {
    return 1 + Math.floor(Math.sqrt(this.data.totalXp / 400));
  }
}
