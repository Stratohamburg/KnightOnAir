import { bodyRadius, baseLength, hull, sheetLength, sheetSpan, stationZ, unit, wings } from "../../data/fokkerDr1Sheet";
import type { AircraftGeometryProfileId } from "../../data/aircrafts";
import { hoUnit, hoZ } from "../../data/ho229V2Sheet";

export interface WingShape {
  rootX: number;
  y: number;
  z: number;
  span: number;
  chord: number;
  sweep: number;
  tipChord?: number;
  planform?: "tapered" | "nearRectangular" | "elliptical" | "swept" | "flyingWing";
  profile?: "straight" | "up" | "down" | "gull" | "inverted-gull";
}

export interface WingLayerProfile {
  /** Vertical station in the local aircraft space. */
  y: number;
  /** Longitudinal root station in the local aircraft space. */
  z: number;
  /** Lateral root seam in model units, measured from the fuselage centerline. */
  rootOffset?: number;
  spanScale?: number;
  chord?: number;
  tipChord?: number;
  sweep?: number;
  planform?: WingShape["planform"];
  profile?: WingShape["profile"];
  edge?: {
    leading: "straight" | "swept" | "elliptical";
    trailing: "straight" | "tapered" | "elliptical";
    root: "upper" | "center" | "lower" | "integrated";
  };
  /** Source-facing structural record used by the reference lab. */
  edgeNote?: string;
}

export interface AircraftGeometryProfile {
  id: AircraftGeometryProfileId;
  layout: "conventional" | "twinBoom" | "flyingWing";
  fuselage: {
    construction: "tube" | "integratedWing";
    width: number;
    cockpitZ: number;
    sections: readonly (readonly [number, number, number])[];
  };
  wing: {
    rootZ: number;
    chord: number;
    tipChord: number;
    sweep: number;
    planform: WingShape["planform"];
    profile: WingShape["profile"];
    tierGap: number;
    spanScale: number;
    layers?: readonly WingLayerProfile[];
  };
  tail: {
    kind: "single" | "twin" | "none";
    z: number;
    span: number;
    chord: number;
  };
  engine: {
    style: "propeller" | "jet";
    pusher: boolean;
  };
}

export function wingSection(shape: WingShape, from = 0, to = 1) {
  const chordAt = (t: number) => {
    const tipChord = shape.tipChord ?? shape.chord * .62;
    if (shape.planform === "elliptical") {
      return tipChord + (shape.chord - tipChord) * Math.sqrt(Math.max(0, 1 - t * t));
    }
    if (shape.planform === "flyingWing") {
      return tipChord + (shape.chord - tipChord) * (1 - Math.pow(t, 1.35));
    }
    if (shape.planform === "nearRectangular") {
      const terminalStart = .82;
      if (t <= terminalStart) return shape.chord;
      return shape.chord + (tipChord - shape.chord) * ((t - terminalStart) / (1 - terminalStart));
    }
    return shape.chord + (tipChord - shape.chord) * t;
  };
  const edge = (t: number, leading: boolean) => ({
    x: shape.rootX + shape.span * t,
    y: shape.y + profileLift(shape.profile, t),
    // Keep the trailing edge tied to the local chord. The previous version
    // used the root chord for the whole span, which made tapered and
    // elliptical wings grow a thick rectangular tip.
    z: shape.z + (leading ? chordAt(t) * .46 : -chordAt(t) * .54) - shape.sweep * t,
  });
  if (shape.planform === "elliptical") {
    const steps = 6;
    const leading = Array.from({ length: steps + 1 }, (_, index) =>
      edge(from + (to - from) * index / steps, true));
    const trailing = Array.from({ length: steps + 1 }, (_, index) =>
      edge(to - (to - from) * index / steps, false));
    return [...leading, ...trailing];
  }
  return [edge(from, true), edge(to, true), edge(to, false), edge(from, false)];
}

function profileLift(profile: WingShape["profile"], t: number) {
  if (profile === "up") return t * t * .7;
  if (profile === "down") return -t * t * .7;
  if (profile === "gull") return t < .42 ? t * .9 : .38 - (t - .42) * .35;
  if (profile === "inverted-gull") return t < .42 ? -t * .9 : -.38 + (t - .42) * .35;
  return 0;
}

export function mainWing(span: number, length: number, side: number): WingShape {
  return { rootX: side * .3, y: -.02, z: .12, span: (span / 2 - .3) * side, chord: length * .37, tipChord: length * .16, sweep: length * .13, planform: "tapered" };
}

export const WING_TIP_START = .78;

export const FUSELAGE_SECTIONS = [
  [-.5, .22, .2], [-.32, .75, .72], [-.1, 1, 1], [.15, .83, .92], [.34, .46, .55], [.5, .025, .05],
] as const;

const FOKKER_DR1_SECTIONS = hull.map(({s, w, deck, belly}) =>
  [stationZ(s) / baseLength, w / bodyRadius, (deck - belly) / (2 * bodyRadius)] as const);
const AIRCRAFT_GEOMETRY_PROFILES: Record<AircraftGeometryProfileId, AircraftGeometryProfile> = {
  ho229V2: {
    id: "ho229V2", layout: "flyingWing",
    // The integrated center uses spanwise ribs instead of fuselage rings.
    fuselage: { construction: "integratedWing", width: 109 * hoUnit, cockpitZ: hoZ(342), sections: [] },
    wing: { rootZ: hoZ(469), chord: 312 / 523, tipChord: 0, sweep: 351 / 523,
      planform: "flyingWing", profile: "straight", tierGap: 0, spanScale: 1 },
    tail: { kind: "none", z: 0, span: 0, chord: 0 },
    engine: { style: "jet", pusher: false },
  },
  fokkerDr1: {
    id: "fokkerDr1",
    layout: "conventional",
    fuselage: { construction: "tube", width: bodyRadius * unit, cockpitZ: stationZ(97), sections: FOKKER_DR1_SECTIONS },
    wing: {
      rootZ: stationZ((wings[0].leading + wings[0].trailing) / 2),
      chord: (wings[0].trailing - wings[0].leading) / sheetLength,
      tipChord: (wings[0].trailing - wings[0].leading) / sheetLength,
      sweep: 0, planform: "nearRectangular", profile: "straight",
      tierGap: bodyRadius * 2 * unit, spanScale: wings[0].span / sheetSpan,
      layers: wings.map(w => ({
        y: w.height * unit, z: stationZ((w.leading + w.trailing) / 2),
        rootOffset: 0, spanScale: w.span / sheetSpan,
        chord: (w.trailing - w.leading) / sheetLength,
        sweep: 0, planform: "nearRectangular", profile: "straight",
      })),
    },
    tail: { kind: "single", z: stationZ(175) / baseLength, span: 116 / sheetSpan, chord: 69 / sheetLength },
    engine: { style: "propeller", pusher: false },
  },
};

export function aircraftGeometryProfile(id?: string) {
  if (!id) return undefined;
  return Object.values(AIRCRAFT_GEOMETRY_PROFILES).find((candidate) => candidate.id === id);
}

export function npcAirframeShape(kind: string, era: string) {
  const heavy = ["elite", "bomber", "gunship", "jet_bomber", "heavy_fighter"].includes(kind);
  const buoyant = kind === "recon_balloon" || (kind === "elite" && era === "ww1");
  return {
    buoyant,
    wingspan: kind === "bomber" ? 5.6 : 4,
    length: buoyant ? kind === "elite" ? 4.9 : 2.2 : heavy ? 3.45 : 2.5,
    width: buoyant ? .9 : heavy ? .48 : .27,
    tiers: era === "pioneer" || era === "ww1" ? 2 : 1,
    wingLength: 3.25,
  };
}
