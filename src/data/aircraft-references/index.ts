import fokkerDr1 from "./fokker-dr1";
import spitfireVb from "./spitfire-vb";
import a6m2 from "./a6m2-21";
import vampire from "./vampire";
import ho229V2 from "./ho229-v2";
import glosterMeteorF3 from "./gloster-meteor-f3";
import wrightFlyer from "./wright-flyer-1903";
import santos14bis from "./santos-14bis";
import santosDemoiselle from "./santos-demoiselle";
import bleriotXi from "./bleriot-xi";
import etrichTaube from "./etrich-taube";
import deperdussinMonocoque from "./deperdussin-monocoque";
import caudronG3 from "./caudron-g3";
import ilyaMuromets from "./ilya-muromets";
import voisinIii from "./voisin-iii";
import farmanMf11 from "./farman-mf11";
import { REFERENCE_ERAS, type AircraftReference } from "./types";

export const DEFAULT_AIRCRAFT_REFERENCE: AircraftReference = fokkerDr1;

const eraOrder = Object.keys(REFERENCE_ERAS);
const references: AircraftReference[] = [
  wrightFlyer, santos14bis, santosDemoiselle, bleriotXi, etrichTaube,
  deperdussinMonocoque, caudronG3, ilyaMuromets, voisinIii, farmanMf11,
  fokkerDr1,
  spitfireVb, a6m2, ho229V2,
  vampire, glosterMeteorF3,
];

export const AIRCRAFT_REFERENCES: readonly AircraftReference[] = references.sort(
  (first, second) => eraOrder.indexOf(first.era) - eraOrder.indexOf(second.era),
);
