import { eraOf, type Airframe, type EraId } from "./aircrafts";

export const missionEraOf = (frame: Airframe) => frame.missionEra ?? eraOf(frame);

export interface EraColors {
  grass: string;
  accent: string;
  water: string;
  haze: string;
  skyZenith: string;
  skyHorizon: string;
  sunTint: string;
  cloudLit: string;
  cloudShadow: string;
  cloudRim: string;
  valleyFog: string;
}

interface Era {
  label: string;
  mission: string;
  opening: string[];
  air: string[];
  surface: string[];
  elite: string[];
  caps: { air: number; surface: number };
  colors: EraColors;
}

export const ERAS: Record<EraId, Era> = {
  pioneer: {
    label: "萌芽期", mission: "黎明草甸",
    opening: ["scout", "hunter"], air: ["scout", "hunter", "recon_balloon"],
    surface: ["resource", "depot", "mobile_artillery"], elite: [],
    caps: { air: 5, surface: 4 },
    colors: {
      grass: "#84984e", accent: "#c2b561", water: "#429fb5", haze: "#bde7ed",
      skyZenith: "#5695c9", skyHorizon: "#f2dfce", sunTint: "#ffe3b0",
      cloudLit: "#fff2dd", cloudShadow: "#8d9ec9", cloudRim: "#ffd8a6", valleyFog: "#e8eae1",
    },
  },
  ww1: {
    label: "一战", mission: "堑壕天空",
    opening: ["scout", "hunter"], air: ["hunter", "scout", "striker", "bomber", "escort", "recon_balloon"],
    surface: ["resource", "supply_train", "armored_train", "patrol_boat", "seaplane_patrol", "mobile_artillery"], elite: ["elite"],
    caps: { air: 6, surface: 5 },
    colors: {
      grass: "#727a4a", accent: "#a59460", water: "#467d86", haze: "#c3c8b0",
      skyZenith: "#5a8aa8", skyHorizon: "#dce3cf", sunTint: "#ffe8bc",
      cloudLit: "#f8f3e3", cloudShadow: "#7a95ad", cloudRim: "#f6d7a0", valleyFog: "#d6e0d2",
    },
  },
  ww2: {
    label: "二战", mission: "铁翼海峡",
    opening: ["hunter", "interceptor"], air: ["hunter", "interceptor", "striker", "bomber", "heavy_fighter", "torpedo_bomber", "gunship", "escort"],
    surface: ["aa_truck", "fuel_truck", "supply_train", "armored_train", "radar_truck", "mobile_artillery", "patrol_boat", "landing_ship", "seaplane_patrol"], elite: ["elite", "ace"],
    caps: { air: 7, surface: 6 },
    colors: {
      grass: "#5b8457", accent: "#87a26b", water: "#2c839f", haze: "#a8d2e2",
      skyZenith: "#4c7fb8", skyHorizon: "#f2cda9", sunTint: "#ffd596",
      cloudLit: "#fff0d6", cloudShadow: "#7a88ba", cloudRim: "#ffc484", valleyFog: "#d9dfd8",
    },
  },
  jet: {
    label: "初代喷气", mission: "翡翠海岸",
    opening: ["scout", "hunter"], air: ["scout", "hunter", "striker", "bomber", "escort", "interceptor", "jet_bomber", "heavy_fighter"],
    surface: ["resource", "aa_truck", "missile_truck", "depot", "fuel_truck", "armored_train", "gunboat", "radar_truck", "mobile_artillery", "patrol_boat", "landing_ship"], elite: ["elite", "ace"],
    caps: { air: 7, surface: 6 },
    colors: {
      grass: "#68ad76", accent: "#94c779", water: "#399db4", haze: "#a9e4ed",
      skyZenith: "#4d9ed6", skyHorizon: "#dff5f0", sunTint: "#fff3cc",
      cloudLit: "#fff9ed", cloudShadow: "#7ea8d8", cloudRim: "#ffe8b8", valleyFog: "#d9f3f2",
    },
  },
};
