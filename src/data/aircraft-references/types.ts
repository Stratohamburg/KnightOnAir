export const REFERENCE_ERAS = {
  pioneer: "航空萌芽期",
  ww1: "一战",
  ww2: "二战",
  earlyJet: "早期喷气",
} as const;

export type ReferenceEra = keyof typeof REFERENCE_ERAS;

/** Source-pixel paths on a qualified drawing. Crops retain its orientation and datum. */
export interface AircraftTraceStudy {
  source: string;
  credit: string;
  image: string;
  size: [number, number];
  panels: Array<{
    label: string;
    crop: [number, number, number, number];
    projection?: { view: "top" | "side" | "front"; origin: [number, number]; scale: number; angle?: number };
    datum?: { axis: "x" | "y"; at: number; points: Array<[number, number]> };
    traces: Array<[part: string, path: string, kind: "skin" | "body" | "strut" | "wire" | "opening"]>;
    detail?: { image: string; size: [number, number]; source: string; credit: string };
  }>;
  readings: string[];
  pending: string;
  /** Reviewer-authorized approximation for the inspection mesh. */
  modelNote?: string;
}

export interface ReferencePhoto {
  src: string;
  alt: string;
  caption: string;
  credit: string;
  source: string;
}

export interface ReferenceModule {
  key: string;
  label: string;
  slot: string;
  detail: string;
}

export interface ReferenceEvidenceRow {
  module: string;
  decision: string;
  primarySource: "three-view" | "photo" | "reviewer-constraint";
  sourceLocation: string;
  confirmingViews: Array<"front" | "side" | "top">;
  value: string;
  status: "measured" | "photo-supported" | "review-constrained" | "estimate" | "unresolved";
  note?: string;
}

export interface AircraftReference {
  id: string;
  era: ReferenceEra;
  frameId?: string;
  legacyFrameId?: string;
  prototype: string;
  chineseName: string;
  period: string;
  role: string;
  match: number | null;
  matchLabel: string;
  summary: string;
  structuralNotes: string[];
  modules: ReferenceModule[];
  build?: {
    quality: string;
    quantity: string;
    headline: string;
    detail: string;
  };
  threeView?: {
    src: string;
    alt: string;
    source: string;
    note: string;
    fileName?: string;
    variant?: string;
    viewCoverage?: string;
    dimensions?: string;
    loading?: "verified" | "pending";
  };
  photos: ReferencePhoto[];
  study?: AircraftTraceStudy;
  pipeline?: {
    generatedFromApprovedSheet?: boolean;
    envelope: {
      length: number;
      wingspanToLength: number;
      maxFuselageWidthToLength: number;
      maxFuselageHeightToLength: number;
      cockpitStationToLength: number;
      wingRootStationToLength: number;
      tailStationToLength: number;
    };
    architecture: {
      layout: "conventional" | "twinBoom" | "flyingWing";
      fuselage: "tube" | "integratedWing";
      mainCenterline: string;
      secondaryCenterlines: string[];
      wingRelation: "branch" | "parallel" | "vertical" | "longitudinal";
      tailRelation: string;
    };
    edgeRecords: Array<{
      module: string;
      leading: string;
      trailing: string;
      seam: string;
      span: number;
      rootChord: number;
      tipChord?: number;
      sweep: number;
      station: string;
      clearance: string;
    }>;
    evidenceMatrix?: ReferenceEvidenceRow[];
    discrepancyLog: Array<{
      view: "front" | "side" | "top";
      mismatch: string;
      classification: "source" | "silhouette" | "topology" | "module" | "assembly" | "camera";
      change: string;
      evidence: string;
    }>;
  };
}
