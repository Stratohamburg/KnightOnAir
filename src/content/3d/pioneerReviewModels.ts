import type { Airframe } from "../../data/aircrafts";
import { PLAYER_COMBATANTS } from "../../data/combatants";
import { partFromRecipe } from "../../simulation/parts";
import type { ReferenceAircraft } from "./AircraftFactory";
import type { AircraftModelContext } from "./aircraftModels";
import { PioneerAssembly } from "./pioneerAssembly";
import { flyer } from "./wrightFlyerModel";
import { bleriot, taube, demoiselle, deperdussin } from "./pioneerMonoplanes";
import { voisin, farman, caudron, boxKite, muromets } from "./pioneerBiplanes";

const models = new Map<string, (assembly: PioneerAssembly) => void>([
  ["reference_wright_flyer_1903", flyer],
  ["reference_bleriot_xi", bleriot],
  ["reference_etrich_taube", taube],
  ["reference_voisin_iii", voisin],
  ["reference_farman_mf11", farman],
  ["reference_santos_14bis", boxKite],
  ["reference_santos_demoiselle", demoiselle],
  ["reference_deperdussin_monocoque", deperdussin],
  ["reference_caudron_g3", caudron],
  ["reference_ilya_muromets", muromets],
]);

export function pioneerReviewModel(frame: Airframe) {
  const assemble = models.get(frame.id);
  if (!assemble || !frame.pioneerLayout) return;
  const create = (): ReferenceAircraft => ({
    frame,
    parts: PLAYER_COMBATANTS[frame.id].parts
      .filter(part => part.id !== "service_gun")
      .map(({ id, ...recipe }) => partFromRecipe(id, recipe)),
    weapons: [],
    x: 0,
    z: 0,
    prevX: 0,
    prevZ: 0,
    vx: 0,
    vz: 0,
    heading: 0,
    bank: 0,
    speed: 0,
    energy: 0,
    stats: { length: frame.length, wingspan: frame.wingspan, maxSpeed: 1 },
  });
  return {
    preview: { frame, create },
    model: {
      profileId: "pioneerReview" as const,
      buildFittings: true,
      build: (ctx: AircraftModelContext) => {
        const assembly = new PioneerAssembly(ctx);
        assemble(assembly);
        assembly.finish();
      },
    },
  };
}
