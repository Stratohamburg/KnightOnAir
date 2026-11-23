import { describe, expect, it } from "vitest";
import { AIRFRAMES, STARTER_FRAME_ID } from "../src/data/aircrafts";
import {
  COMBATANT_CONFIGS,
  CONFIG_DIAGNOSTICS,
  NPC_PROFILES,
  validateCombatantConfig,
  validateNpcProfile,
} from "../src/data/combatants";
import { SaveStore } from "../src/services/Save";
import { World } from "../src/simulation/World";

describe("configuration v3", () => {
  it("loads every combatant and NPC profile without diagnostics", () => {
    expect(CONFIG_DIAGNOSTICS).toEqual([]);
    expect(AIRFRAMES).toHaveLength(17);
    expect(Object.keys(COMBATANT_CONFIGS)).toHaveLength(AIRFRAMES.length + Object.keys(NPC_PROFILES).length);
    for (const frame of AIRFRAMES) {
      const config = COMBATANT_CONFIGS[frame.id];
      expect(config.parts.some((part) => part.role === "body")).toBe(true);
      expect(config.parts.some((part) => (part.lift ?? 0) > 0)).toBe(true);
      expect(validateCombatantConfig(config)).toBeUndefined();
    }
  });

  it("creates NPC parts and weapons from the selected profile", () => {
    const world = new World(AIRFRAMES[0], 20261120, { director: false, supply: false });
    world.enemies = [];
    const enemy = world.spawnEnemy("missile_truck", 0, 40, false)!;
    expect(enemy.configId).toBe("missile_truck");
    expect(enemy.profileId).toBe("missile_truck");
    expect(enemy.parts.map((part) => part.id)).toEqual(["center_body", "mobility", "weapon"]);
    expect(enemy.weapons[0].partId).toBe("weapon");
    expect(enemy.weapons[0].config.homing).toBeGreaterThan(0);
  });

  it("reports incomplete air attack profiles", () => {
    const profile = NPC_PROFILES.interceptor;
    expect(validateNpcProfile({ ...profile, airAttack: undefined }, COMBATANT_CONFIGS)?.errors)
      .toContain("invalid air attack, breakaway or reentry profile");
  });

  it("ignores version one saves and persists only the new save key", () => {
    let stored = new Map<string, string>([["knight-on-air.v1", JSON.stringify({ version: 1, equipped: "mastodon_03", bestScore: 9999 })]]);
    const storage = {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
      removeItem: (key: string) => {
        stored.delete(key);
      },
    };
    const fresh = new SaveStore(storage);
    expect(fresh.data.equipped).toBe(STARTER_FRAME_ID);
    expect(stored.has("knight-on-air.v1")).toBe(false);
    fresh.persist();
    expect(stored.has("knight-on-air.v2")).toBe(true);
    expect(JSON.parse(stored.get("knight-on-air.v2")!).version).toBe(2);
  });
});
