import { AIRFRAMES, STARTER_FRAME_ID, airframeById } from "../data/aircrafts";
import type { Quality } from "../data/config";
import type { World } from "../simulation/World";
import { campaignMissionById } from "../data/campaignMissions";
export interface SaveData {
  version: 2;
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
  clearedMissions: string[];
  missionBestScores: Record<string, number>;
}
const defaults = (): SaveData => ({
  version: 2,
  equipped: STARTER_FRAME_ID,
  unlocked: AIRFRAMES.filter((frame) => frame.unlockScore === 0).map((frame) => frame.id),
  bestScore: 0,
  bestTime: 0,
  currency: 0,
  totalXp: 0,
  sorties: 0,
  quality: "standard",
  sound: true,
  vibration: true,
  clearedMissions: [],
  missionBestScores: {},
});
export class SaveStore {
  private readonly recorded = new WeakSet<World>();
  data = defaults();
  available = true;
  constructor(
    private storage:
      (Pick<Storage, "getItem" | "setItem"> &
        Partial<Pick<Storage, "removeItem">>) | undefined = undefined,
  ) {
    try {
      this.storage ??=
        typeof localStorage === "undefined" ? undefined : localStorage;
      if (!this.storage) this.available = false;
      this.storage?.removeItem?.("knight-on-air.v1");
      const raw = this.storage?.getItem("knight-on-air.v2");
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved || saved.version !== 2) return;
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
        : STARTER_FRAME_ID;
      if (["low", "standard", "high"].includes(saved.quality))
        base.quality = saved.quality;
      if (typeof saved.sound === "boolean") base.sound = saved.sound;
      if (typeof saved.vibration === "boolean")
        base.vibration = saved.vibration;
      if (Array.isArray(saved.clearedMissions))
        base.clearedMissions = [...new Set<string>(saved.clearedMissions.filter(
          (id: unknown): id is string => typeof id === "string" && !!campaignMissionById(id),
        ))];
      if (saved.missionBestScores && typeof saved.missionBestScores === "object") {
        for (const [id, score] of Object.entries(saved.missionBestScores))
          if (campaignMissionById(id) && typeof score === "number" && Number.isFinite(score) && score >= 0)
            base.missionBestScores[id] = score;
      }
      this.data = base;
    } catch {
      this.available = false;
    }
  }
  persist() {
    try {
      this.storage?.setItem("knight-on-air.v2", JSON.stringify(this.data));
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
    if (this.recorded.has(world)) return [];
    this.recorded.add(world);
    const s = this.data;
    const result = world.mission?.result;
    if (result && campaignMissionById(result.missionId))
      s.missionBestScores[result.missionId] = Math.max(s.missionBestScores[result.missionId] ?? 0, world.score);
    if (result?.outcome === "victory" && campaignMissionById(result.missionId) && !s.clearedMissions.includes(result.missionId))
      s.clearedMissions.push(result.missionId);
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
