import type { EraId } from "./aircrafts";

interface Era {
  label: string;
  mission: string;
  opening: string[];
  air: string[];
  surface: string[];
  elite: string[];
  caps: { air: number; surface: number };
  colors: { grass: string; accent: string; water: string; haze: string };
}

export const ERAS: Record<EraId, Era> = {
  pioneer: {
    label: "萌芽期", mission: "黎明草甸",
    opening: ["scout", "hunter"], air: ["scout", "hunter", "recon_balloon"],
    surface: ["resource", "depot", "mobile_artillery"], elite: [],
    caps: { air: 5, surface: 4 },
    colors: { grass: "#84984e", accent: "#c2b561", water: "#429fb5", haze: "#bde7ed" },
  },
  ww1: {
    label: "一战", mission: "堑壕天空",
    opening: ["scout", "hunter"], air: ["hunter", "scout", "striker", "bomber", "escort", "recon_balloon"],
    surface: ["resource", "supply_train", "armored_train", "patrol_boat", "seaplane_patrol", "mobile_artillery"], elite: ["elite"],
    caps: { air: 6, surface: 5 },
    colors: { grass: "#727a4a", accent: "#a59460", water: "#467d86", haze: "#c3c8b0" },
  },
  ww2: {
    label: "二战", mission: "铁翼海峡",
    opening: ["hunter", "interceptor"], air: ["hunter", "interceptor", "striker", "bomber", "heavy_fighter", "torpedo_bomber", "gunship", "escort"],
    surface: ["aa_truck", "fuel_truck", "supply_train", "armored_train", "radar_truck", "mobile_artillery", "patrol_boat", "landing_ship", "seaplane_patrol"], elite: ["elite", "ace"],
    caps: { air: 7, surface: 6 },
    colors: { grass: "#5b8457", accent: "#87a26b", water: "#2c839f", haze: "#a8d2e2" },
  },
  jet: {
    label: "初代喷气", mission: "翡翠海岸",
    opening: ["scout", "hunter"], air: ["scout", "hunter", "striker", "bomber", "escort", "interceptor", "jet_bomber", "heavy_fighter"],
    surface: ["resource", "aa_truck", "missile_truck", "depot", "fuel_truck", "armored_train", "gunboat", "radar_truck", "mobile_artillery", "patrol_boat", "landing_ship"], elite: ["elite", "ace"],
    caps: { air: 7, surface: 6 },
    colors: { grass: "#68ad76", accent: "#94c779", water: "#399db4", haze: "#a9e4ed" },
  },
};
