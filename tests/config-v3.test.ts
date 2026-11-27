import { describe, expect, it } from "vitest";
import { AIRFRAMES, STARTER_FRAME_ID, airframeById, eraOf } from "../src/data/aircrafts";
import { AIRCRAFT_REFERENCES, aircraftReferenceByFrameId } from "../src/data/aircraftReferences";
import { aircraftReferencePreview, aircraftReviewPlate, resolveAircraftModel } from "../src/content/3d/aircraftModels";
import { ProceduralAircraft } from "../src/content/3d/AircraftFactory";
import { ContentCatalog } from "../src/content/3d/ContentCatalog";
import { Box3, Mesh, ShaderMaterial } from "three";
import {
  BALLOON_TARGET_MODEL_ID,
  combatAircraftFrame,
  COMBATANT_CONFIGS,
  CONFIG_DIAGNOSTICS,
  NPC_PROFILES,
  validateCombatantConfig,
  validateNpcProfile,
} from "../src/data/combatants";
import { SaveStore } from "../src/services/Save";
import { World } from "../src/simulation/World";
import { AIRCRAFT_LIVERIES, DR1_LIVERY_IDS, aircraftLivery } from "../src/data/aircraftLiveries";

describe("configuration v3", () => {
  it.each([
    "wright-flyer-1903", "bleriot-xi", "etrich-taube", "voisin-iii", "farman-mf11",
    "santos-14bis", "santos-demoiselle", "deperdussin-monocoque", "caudron-g3", "ilya-muromets",
  ])("resolves the dedicated frame, plate and outstanding geometry for %s", id => {
    const reference = aircraftReferenceByFrameId(id)!;
    const frame = AIRFRAMES.find(candidate => candidate.id === reference.frameId)!;
    expect(aircraftReferenceByFrameId(frame.id)).toBe(reference);
    expect(COMBATANT_CONFIGS[frame.id].visual.modelKey).toBe(frame.id);
    expect(aircraftReviewPlate(frame.id)?.()).toContain(reference.study!.credit);
    const preview = aircraftReferencePreview(frame.id)!;
    const catalog = new ContentCatalog();
    const aircraft = new ProceduralAircraft(preview.create(), catalog);
    expect(aircraft.contentError).toBeUndefined();
    expect(aircraft.group.getObjectByName("rigging")).toBeDefined();
    const propellers = aircraft.group.getObjectsByProperty("name", "propeller");
    expect(propellers.length).toBe(id === "wright-flyer-1903" ? 2 : frame.engines);
    const sites = aircraft.effectSites;
    expect(sites.sources.filter(site => site.kind === "propeller")).toHaveLength(propellers.length);
    expect(sites.sources.filter(site => site.kind === "wingTip").length).toBeGreaterThanOrEqual(2);
    expect(sites.sources.some(site => site.kind === "protrusion" && site.strength < 1)).toBe(true);
    expect(new Set(sites.sources.map(site => site.id)).size).toEqual(sites.sources.length);
    expect(sites.surfaces.some(({mesh}) => /rigging|struts|chain|spokes/.test(mesh.name))).toBe(false);
    expect(sites.surfaces.some(({partId}) => partId === "left_wing")).toBe(true);
    const bounds = new Box3().setFromObject(aircraft.group);
    expect(bounds.max.x - bounds.min.x).toBeCloseTo(frame.wingspan, 1);
    expect(aircraftReviewPlate(frame.id)?.()).toContain(reference.study!.modelNote);
    const creations = catalog.stats.creations;
    const second = new ProceduralAircraft(preview.create(), catalog);
    expect(catalog.stats.creations).toBe(creations);
    aircraft.dispose();
    expect(sites.sources).toHaveLength(0);
    expect(sites.surfaces).toHaveLength(0);
    expect(catalog.stats.geometries).toBeGreaterThan(0);
    second.dispose();
    expect(catalog.stats).toMatchObject({ geometries: 0, materials: 0 });
    expect(resolveAircraftModel(frame).model?.profileId).toBe("pioneerReview");
  });

  it("matches the playable roster to available reference models and assembles every runtime loadout", () => {
    const available = AIRCRAFT_REFERENCES.filter(reference => {
      const frame = AIRFRAMES.find(candidate => candidate.id === reference.frameId);
      const preview = reference.frameId && aircraftReferencePreview(reference.frameId);
      return Boolean(preview ? resolveAircraftModel(preview.frame).model : frame && resolveAircraftModel(frame).model);
    });
    const inspectionIds = ["meteor_18", "vampire-fb5"];
    expect(available.filter(reference => !AIRFRAMES.some(frame => frame.id === reference.frameId))
      .map(reference => reference.frameId).sort()).toEqual(inspectionIds);
    const playable = available.filter(reference => !inspectionIds.includes(reference.frameId!));
    expect(playable).toHaveLength(14);
    expect(AIRFRAMES.map(frame => frame.id).sort()).toEqual(playable.map(reference => reference.frameId).sort());
    for (const frame of AIRFRAMES) {
      expect(eraOf(frame)).toBe(aircraftReferenceByFrameId(frame.id)?.era);
      const world = new World(frame, 42, { director: false, supply: false, showroom: true });
      const aircraft = new ProceduralAircraft(world.player);
      try {
        expect(aircraft.contentError, frame.id).toBeUndefined();
        expect(new Box3().setFromObject(aircraft.group).isEmpty(), frame.id).toBe(false);
        expect(aircraft.effectSites.sources.some(site => site.kind === "muzzle"), frame.id).toBe(true);
        const upgrade = world.legalUpgradeOptions.find(candidate => candidate.parts.length);
        expect(upgrade, frame.id).toBeDefined();
        world.installUpgrade(upgrade!);
        aircraft.rebuild();
        expect(aircraft.contentError, frame.id).toBeUndefined();
      } finally {
        aircraft.dispose();
        world.dispose();
      }
    }
  });

  it("keeps effect IDs and damage surfaces attached to installed air NPC parts on rebuild", () => {
    for (const profile of Object.values(NPC_PROFILES)) {
      const config = COMBATANT_CONFIGS[profile.combatantId];
      if (config.layer !== "air") continue;
      if (config.visual.modelKey === BALLOON_TARGET_MODEL_ID) continue;
      const frame = combatAircraftFrame(config.visual.modelKey) ?? aircraftReferencePreview(config.visual.modelKey)?.frame;
      expect(frame, config.id).toBeDefined();
      expect(resolveAircraftModel(frame!).model, config.id).toBeDefined();
      const world = new World(AIRFRAMES[0], 42, { missionEra: config.era, director: false, supply: false });
      world.enemies = [];
      const actor = world.spawnEnemy(profile.kind ?? profile.id, 0, 4)!;
      expect(actor.configId).toBe(config.id);
      const model = new ProceduralAircraft(actor);
      expect(model.contentError, config.id).toBeUndefined();
      expect(actor.parts.every(part => model.partNode(part.id)), config.id).toBe(true);
      expect(actor.parts.filter(part => part.role === "wing").every(part => part.silhouette?.length), config.id).toBe(true);
      expect(model.effectSites.sources.filter(site => site.kind === "muzzle")).toHaveLength(
        actor.weapons.reduce((count, weapon) => count + weapon.config.count, 0),
      );
      const ids = model.effectSites.sources.map(site => site.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(model.effectSites.surfaces.length).toBeGreaterThan(0);
      for (const source of [...model.effectSites.sources, ...model.effectSites.surfaces]) {
        expect(actor.parts.some(part => part.id === source.partId)).toBe(true);
      }
      model.rebuild();
      expect(model.effectSites.sources.map(site => site.id)).toEqual(ids);
      model.dispose();
      world.dispose();
    }
  });

  it.each(["ww1", "ww2"] as const)("leaves the %s floatplane out until a prototype model is available", era => {
    const world = new World(AIRFRAMES[0], 42, { missionEra: era, director: false, supply: false, showroom: true });
    expect(world.spawnEnemy("seaplane_patrol", 0, 10)).toBeUndefined();
    world.dispose();
  });

  it("keeps the training balloon as an explicit unarmed target", () => {
    const world = new World(AIRFRAMES[0], 42, { missionEra: "pioneer", director: false, supply: false, showroom: true });
    const actor = world.spawnEnemy("recon_balloon", 0, 10)!;
    const model = new ProceduralAircraft(actor);
    expect(COMBATANT_CONFIGS[actor.configId!].visual.modelKey).toBe(BALLOON_TARGET_MODEL_ID);
    expect(actor.weapons).toEqual([]);
    expect(model.contentError).toBeUndefined();
    expect(model.effectSites.surfaces.length).toBeGreaterThan(0);
    model.dispose();
    world.dispose();
  });

  it("shares the mesh for two roles using the same airframe, with independent damage and leases", () => {
    const catalog = new ContentCatalog();
    const world = new World(AIRFRAMES[0], 42, { missionEra: "ww2", director: false, supply: false, showroom: true });
    const hunter = world.spawnEnemy("hunter", -5, 10)!;
    const escort = world.spawnEnemy("escort", 5, 10)!;
    const first = new ProceduralAircraft(hunter, catalog);
    const second = new ProceduralAircraft(escort, catalog);
    const skin = (model: ProceduralAircraft) =>
      model.group.getObjectByName("npc-aircraft-skin") as Mesh<Mesh["geometry"], ShaderMaterial>;
    expect(skin(first).geometry).toBe(skin(second).geometry);
    expect(skin(first).material.uniforms.pieceState.value).not.toBe(skin(second).material.uniforms.pieceState.value);
    const wing = hunter.parts.find(part => part.id === "left_wing")!;
    wing.destroyed = true;
    first.update(1, 0);
    second.update(1, 0);
    expect(first.partNode(wing.id)?.visible).toBe(false);
    expect(second.partNode(wing.id)?.visible).toBe(true);
    first.dispose();
    expect(catalog.stats.geometries).toBeGreaterThan(0);
    second.dispose();
    expect(catalog.stats.geometries).toBe(0);
    world.dispose();
  });

  it("loads every combatant and NPC profile without diagnostics", () => {
    expect(CONFIG_DIAGNOSTICS).toEqual([]);
    expect(AIRFRAMES).toHaveLength(14);
    expect(new Set(AIRFRAMES.map(frame => frame.id)).size).toBe(AIRFRAMES.length);
    expect(Object.keys(COMBATANT_CONFIGS)).toHaveLength(AIRFRAMES.length + Object.keys(NPC_PROFILES).length);
    for (const frame of AIRFRAMES) {
      const config = COMBATANT_CONFIGS[frame.id];
      expect(config.parts.some((part) => part.role === "body")).toBe(true);
      expect(config.parts.some((part) => (part.lift ?? 0) > 0)).toBe(true);
      expect(validateCombatantConfig(config)).toBeUndefined();
    }
  });

  it("resolves a livery for every playable frame and keeps the visual ID in sync", () => {
    for (const frame of AIRFRAMES) {
      const livery = aircraftLivery(frame);
      expect(livery.primary).toBe(frame.color);
      expect(AIRCRAFT_LIVERIES[livery.id] ?? livery.id.startsWith("legacy:")).toBeTruthy();
      expect(COMBATANT_CONFIGS[frame.id].visual.liveryId).toBe(frame.liveryId);
    }
  });

  it("registers the twelve reference DR1 liveries with distinct shader motifs", () => {
    expect(DR1_LIVERY_IDS).toHaveLength(12);
    const liveries = DR1_LIVERY_IDS.map((id) => AIRCRAFT_LIVERIES[id]);
    expect(liveries.every((livery) => livery && livery.primary && livery.secondary && livery.trim)).toBe(true);
    expect(new Set(liveries.map((livery) => livery.pattern)).size).toBeGreaterThanOrEqual(5);
    expect(new Set(liveries.map((livery) => livery.primary)).size).toBe(12);
  });

  it("creates NPC parts and weapons from the selected profile", () => {
    const world = new World(airframeById(STARTER_FRAME_ID), 20261120, { missionEra: "jet", director: false, supply: false });
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
    const config = COMBATANT_CONFIGS[profile.combatantId];
    expect(validateNpcProfile(profile, {
      [config.id]: { ...config, visual: { ...config.visual, modelKey: "undefined-model" } },
    })?.errors).toContain("missing era-appropriate prototype aircraft model");
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
