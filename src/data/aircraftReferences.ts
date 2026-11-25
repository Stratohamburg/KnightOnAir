import { AIRCRAFT_REFERENCES } from "./aircraft-references";

export { AIRCRAFT_REFERENCES, DEFAULT_AIRCRAFT_REFERENCE } from "./aircraft-references";
export { REFERENCE_ERAS } from "./aircraft-references/types";
export type { AircraftReference, ReferenceEvidenceRow, ReferenceModule, ReferencePhoto } from "./aircraft-references/types";

export const aircraftReferenceByFrameId = (id: string) =>
  AIRCRAFT_REFERENCES.find((reference) => reference.id === id || reference.frameId === id || reference.legacyFrameId === id);
