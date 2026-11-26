import type { Airframe } from "./aircrafts";

export type AircraftLiveryPattern =
  | "band"
  | "panel"
  | "solid"
  | "checker"
  | "cross"
  | "stripe"
  | "tailband"
  | "anchor";

export interface AircraftLivery {
  id: string;
  primary: string;
  secondary: string;
  trim: string;
  pattern: AircraftLiveryPattern;
  stripeCenter: number;
  stripeWidth: number;
  panelContrast: number;
  /** Optional per-module base colors. These remain pure data and are applied by the aircraft factory. */
  wing?: string;
  tail?: string;
  nose?: string;
}

const clampByte = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

function hexColor(value: string) {
  const normalized = value.replace("#", "");
  const number = Number.parseInt(normalized.length === 3
    ? normalized.split("").map((digit) => digit + digit).join("")
    : normalized, 16);
  return Number.isFinite(number) ? number : 0x808080;
}

function colorFrom(value: string, amount: number) {
  const color = hexColor(value);
  const r = clampByte((color >> 16 & 0xff) * amount);
  const g = clampByte((color >> 8 & 0xff) * amount);
  const b = clampByte((color & 0xff) * amount);
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

export const AIRCRAFT_LIVERIES: Record<string, AircraftLivery> = {
  // Fokker Dr.I reference sheet. The motifs are generated in the aircraft shader
  // from local coordinates so the same material works in the hangar and battle.
  "dr1-01-olive-checker": {
    id: "dr1-01-olive-checker", primary: "#707b57", secondary: "#eee7cf", trim: "#263034",
    pattern: "checker", stripeCenter: .5, stripeWidth: .09, panelContrast: .14,
    wing: "#879466", tail: "#eee7cf",
  },
  "dr1-02-jade-checker": {
    id: "dr1-02-jade-checker", primary: "#6f9b8f", secondary: "#dbe8d3", trim: "#253f42",
    pattern: "checker", stripeCenter: .5, stripeWidth: .09, panelContrast: .13,
    wing: "#88b8a8", tail: "#e6ead7",
  },
  "dr1-03-vermilion-cross": {
    id: "dr1-03-vermilion-cross", primary: "#78805a", secondary: "#d7c76d", trim: "#bf4a38",
    pattern: "cross", stripeCenter: .5, stripeWidth: .1, panelContrast: .12,
    wing: "#8c956b", tail: "#efe5c8",
  },
  "dr1-04-coral-crossband": {
    id: "dr1-04-coral-crossband", primary: "#c87954", secondary: "#f0d2a9", trim: "#b43d37",
    pattern: "stripe", stripeCenter: .5, stripeWidth: .1, panelContrast: .1,
    wing: "#e0a171", tail: "#f3e1bd",
  },
  "dr1-05-whitewing-redbody": {
    id: "dr1-05-whitewing-redbody", primary: "#b64a3f", secondary: "#f2ead8", trim: "#a73232",
    pattern: "solid", stripeCenter: .5, stripeWidth: .1, panelContrast: .08,
    wing: "#eee8d8", tail: "#f1eadb",
  },
  "dr1-06-twilight-violet": {
    id: "dr1-06-twilight-violet", primary: "#8a7898", secondary: "#d8c9d7", trim: "#6b3d5e",
    pattern: "band", stripeCenter: .48, stripeWidth: .12, panelContrast: .15,
    wing: "#b6a5bd", tail: "#efe1d1",
  },
  "dr1-07-olive-letterwing": {
    id: "dr1-07-olive-letterwing", primary: "#788357", secondary: "#e9dfbd", trim: "#283231",
    pattern: "tailband", stripeCenter: .58, stripeWidth: .12, panelContrast: .16,
    wing: "#9aa36d", tail: "#e5dcc1",
  },
  "dr1-08-midnight-gold": {
    id: "dr1-08-midnight-gold", primary: "#4a5874", secondary: "#e6c486", trim: "#d6b46b",
    pattern: "stripe", stripeCenter: .43, stripeWidth: .1, panelContrast: .14,
    wing: "#56647f", tail: "#ead7b1",
  },
  "dr1-09-gold-anchor": {
    id: "dr1-09-gold-anchor", primary: "#78865d", secondary: "#edc54c", trim: "#c8a343",
    pattern: "anchor", stripeCenter: .5, stripeWidth: .12, panelContrast: .14,
    wing: "#a0a468", tail: "#e4d3a2",
  },
  "dr1-10-apricot-teal-anchor": {
    id: "dr1-10-apricot-teal-anchor", primary: "#d6a16f", secondary: "#4f8187", trim: "#e4d4af",
    pattern: "anchor", stripeCenter: .52, stripeWidth: .12, panelContrast: .12,
    wing: "#f0d8b1", tail: "#f4e6cb",
  },
  "dr1-11-charcoal-tail": {
    id: "dr1-11-charcoal-tail", primary: "#7e8b69", secondary: "#e8e1cf", trim: "#292c39",
    pattern: "tailband", stripeCenter: .68, stripeWidth: .16, panelContrast: .16,
    wing: "#7e8c6e", tail: "#242837",
  },
  "dr1-12-deepsea-copper": {
    id: "dr1-12-deepsea-copper", primary: "#6f9c9c", secondary: "#dce5cf", trim: "#293c4f",
    pattern: "cross", stripeCenter: .5, stripeWidth: .1, panelContrast: .15,
    wing: "#7aa9a3", tail: "#31465c",
  },
  // Kept as a compatibility ID for saved previews created before the DR1 set.
  "heron-09-violet": {
    id: "heron-09-violet", primary: "#9263a5", secondary: "#c7a9d0", trim: "#f4ac65",
    pattern: "band", stripeCenter: .46, stripeWidth: .11, panelContrast: .12,
  },
  "falcon-13-olive": {
    id: "falcon-13-olive", primary: "#67775e", secondary: "#aebc9c", trim: "#d8c27b",
    pattern: "band", stripeCenter: .52, stripeWidth: .08, panelContrast: .16,
  },
  "dragonfly-06-jade": {
    id: "dragonfly-06-jade", primary: "#b7bbaa", secondary: "#e1dfc5", trim: "#384343",
    pattern: "panel", stripeCenter: .38, stripeWidth: .09, panelContrast: .14,
  },
  "stingray-16-slate": {
    id: "stingray-16-slate", primary: "#81929c", secondary: "#bfcfd0", trim: "#3f4b52",
    pattern: "panel", stripeCenter: .58, stripeWidth: .1, panelContrast: .18,
  },
};

export const DR1_LIVERY_IDS = [
  "dr1-01-olive-checker", "dr1-02-jade-checker", "dr1-03-vermilion-cross",
  "dr1-04-coral-crossband", "dr1-05-whitewing-redbody", "dr1-06-twilight-violet",
  "dr1-07-olive-letterwing", "dr1-08-midnight-gold", "dr1-09-gold-anchor",
  "dr1-10-apricot-teal-anchor", "dr1-11-charcoal-tail", "dr1-12-deepsea-copper",
] as const;

export const DR1_LIVERY_NAMES: Record<string, string> = {
  "dr1-01-olive-checker": "橄榄棋盘",
  "dr1-02-jade-checker": "翡翠棋盘",
  "dr1-03-vermilion-cross": "朱砂金叉",
  "dr1-04-coral-crossband": "珊瑚十字带",
  "dr1-05-whitewing-redbody": "白翼红身",
  "dr1-06-twilight-violet": "薄暮藤紫",
  "dr1-07-olive-letterwing": "橄榄字翼",
  "dr1-08-midnight-gold": "午夜鎏金",
  "dr1-09-gold-anchor": "金尾海锚",
  "dr1-10-apricot-teal-anchor": "蜜杏青锚",
  "dr1-11-charcoal-tail": "炭黑尾翼",
  "dr1-12-deepsea-copper": "深海铜绿",
};

const liveryIdForFrame = (frame: Pick<Airframe, "id" | "color" | "accent" | "liveryId">) =>
  frame.liveryId ?? `legacy:${frame.id}`;

function legacyLivery(frame: Pick<Airframe, "id" | "color" | "accent" | "liveryId">): AircraftLivery {
  return {
    id: `legacy:${frame.id}`,
    primary: frame.color,
    secondary: colorFrom(frame.color, 1.28),
    trim: frame.accent,
    pattern: "panel",
    stripeCenter: .5,
    stripeWidth: .08,
    panelContrast: .1,
  };
}

export function liveryBaseColor(
  livery: AircraftLivery | undefined,
  role: string | undefined,
  fallback: string,
) {
  if (!livery) return fallback;
  if (role === "wing" && livery.wing) return livery.wing;
  if (role === "tail" && livery.tail) return livery.tail;
  if (role === "engine" && livery.nose) return livery.nose;
  return fallback;
}

export function aircraftLivery(frame: Pick<Airframe, "id" | "color" | "accent" | "liveryId">): AircraftLivery {
  const id = liveryIdForFrame(frame);
  return AIRCRAFT_LIVERIES[id] ?? legacyLivery(frame);
}

export function liveryForValues(
  id: string,
  primary: string,
  trim: string,
): AircraftLivery {
  return AIRCRAFT_LIVERIES[id] ?? {
    id: `runtime:${id}`,
    primary,
    secondary: colorFrom(primary, 1.25),
    trim,
    pattern: "panel",
    stripeCenter: .5,
    stripeWidth: .08,
    panelContrast: .1,
  };
}

export function validateAircraftLivery(frame: Pick<Airframe, "id" | "color" | "accent" | "liveryId">) {
  if (!frame.liveryId || frame.liveryId.startsWith("legacy:")) return undefined;
  const livery = AIRCRAFT_LIVERIES[frame.liveryId];
  if (!livery) return { id: frame.id, errors: [`unknown aircraft livery ${frame.liveryId}`] };
  if ([livery.primary, livery.secondary, livery.trim].some((color) => !/^#[0-9a-f]{6}$/i.test(color)))
    return { id: frame.id, errors: [`invalid aircraft livery colors ${frame.liveryId}`] };
  return undefined;
}
