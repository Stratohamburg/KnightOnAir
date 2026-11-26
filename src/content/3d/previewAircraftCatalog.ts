import { AIRFRAMES, type Airframe } from "../../data/aircrafts";
import { AIRCRAFT_REFERENCES, DEFAULT_AIRCRAFT_REFERENCE, type AircraftReference } from "../../data/aircraftReferences";
import { resolveAircraftModel } from "./aircraftModels";

export function previewAircraftCatalog(
  frames: readonly Airframe[] = AIRFRAMES,
  prototypes: readonly AircraftReference[] = AIRCRAFT_REFERENCES,
  hasModel = (frame: Airframe) => !!resolveAircraftModel(frame).model,
) {
  const aircraft = frames.filter(hasModel);
  const prototype = (id: string | undefined) => id === undefined ? undefined : prototypes.find(reference =>
    reference.id === id || reference.frameId === id || reference.legacyFrameId === id);
  return {
    prototypes: Object.freeze([...prototypes]),
    aircraft: Object.freeze(aircraft),
    prototype,
    initialPrototype: prototype(DEFAULT_AIRCRAFT_REFERENCE.id) ?? prototypes[0],
    aircraftForPrototype: (reference: AircraftReference | undefined) =>
      aircraft.find(frame => frame.id === reference?.frameId),
    prototypeForAircraft: (id: string | undefined) => id === undefined ? undefined :
      prototypes.find(reference => reference.frameId === id),
  };
}
