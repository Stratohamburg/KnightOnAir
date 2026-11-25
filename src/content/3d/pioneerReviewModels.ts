import type { Airframe } from "../../data/aircrafts";
import { partFromRecipe } from "../../simulation/parts";
import type { ReferenceAircraft } from "./AircraftFactory";
import type { AircraftModelContext, AircraftVisualFrame } from "./aircraftModels";
import { PioneerAssembly, type Point3, linen } from "./pioneerAssembly";
import { flyer } from "./wrightFlyerModel";
import { bleriot, taube, demoiselle, deperdussin } from "./pioneerMonoplanes";
import { voisin, farman, caudron, boxKite, muromets } from "./pioneerBiplanes";

interface StudyModel {
  assemble: (assembly: PioneerAssembly) => void;
  engines: Point3[];
  pusher?: boolean;
  wingZ: number;
  tailZ?: number;
  canardZ?: number;
}

const models = new Map<string, StudyModel>([
  [
    "reference_wright_flyer_1903",
    { assemble: flyer, wingZ: -0.22, tailZ: -2.79, canardZ: 2.82, engines: [[0.4, -0.62, 0.05]], pusher: true },
  ],
  ["reference_bleriot_xi", { assemble: bleriot, wingZ: 1.9, tailZ: -2.35, engines: [[0, 0.03, 2.93]] }],
  ["reference_etrich_taube", { assemble: taube, wingZ: 2.27, tailZ: -3.4, engines: [[0, 0.13, 4.32]] }],
  [
    "reference_voisin_iii",
    { assemble: voisin, wingZ: 1.52, tailZ: -3.9, engines: [[0, 0.28, 0.6]], pusher: true },
  ],
  [
    "reference_farman_mf11",
    { assemble: farman, wingZ: 1.69, tailZ: -4.38, engines: [[0, 0.36, 0.91]], pusher: true },
  ],
  [
    "reference_santos_14bis",
    { assemble: boxKite, wingZ: -3.56, canardZ: 3.71, engines: [[0, 0.36, -4.21]], pusher: true },
  ],
  ["reference_santos_demoiselle", { assemble: demoiselle, wingZ: 1.85, tailZ: -1.99, engines: [[0, 0.43, 2.77]] }],
  [
    "reference_deperdussin_monocoque",
    { assemble: deperdussin, wingZ: 1.58, tailZ: -2.41, engines: [[0, 0.04, 2.57]] },
  ],
  ["reference_caudron_g3", { assemble: caudron, wingZ: 1.68, tailZ: -2.63, engines: [[0, 0.45, 3.02]] }],
  [
    "reference_ilya_muromets",
    {
      assemble: muromets,
      wingZ: 5.72,
      tailZ: -8.14,
      engines: [
        [-6.77, -0.46, 6.17],
        [-3.18, -0.46, 6.17],
        [3.18, -0.46, 6.17],
        [6.77, -0.46, 6.17],
      ],
    },
  ],
]);

export function pioneerReviewModel(airframe: Airframe) {
  const study = models.get(airframe.id);
  if (!study) return;
  const frame: AircraftVisualFrame = { ...airframe, color: linen, geometryProfile: "pioneerReview" };
  const create = (): ReferenceAircraft => {
    const parts = [partFromRecipe("center_body", { role: "body" })];
    for (const side of [-1, 1] as const) {
      parts.push(
        partFromRecipe(side < 0 ? "left_wing" : "right_wing", {
          role: "wing",
          side,
          parentId: "center_body",
          x: side * frame.wingspan * 0.25,
          y: 0,
          z: study.wingZ,
        }),
      );
    }
    if (study.tailZ !== undefined)
      parts.push(partFromRecipe("tail", { role: "tail", slot: "tail", parentId: "center_body", z: study.tailZ }));
    if (study.canardZ !== undefined)
      parts.push(
        partFromRecipe("nose", { role: "body", slot: "nose", parentId: "center_body", z: study.canardZ }),
      );
    study.engines.forEach(([x, y, z], i) => {
      const slot = study.engines.length > 1 ? (x < 0 ? "leftWing" : "rightWing") : study.pusher ? "tail" : "nose";
      parts.push(
        partFromRecipe("engine_" + i, {
          role: "engine",
          slot,
          x,
          y,
          z,
          parentId: study.engines.length > 1 ? (x < 0 ? "left_wing" : "right_wing") : "center_body",
          engineInstallation: study.pusher ? "pusher" : "tractor",
        }),
      );
    });
    return {
      frame,
      parts,
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
    };
  };
  return {
    preview: { frame, create },
    model: {
      profileId: "pioneerReview" as const,
      build: (ctx: AircraftModelContext) => {
        const assembly = new PioneerAssembly(ctx);
        study.assemble(assembly);
        assembly.finish();
      },
    },
  };
}
