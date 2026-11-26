import { Color, Vector3 } from "three";
import type { EraColors } from "../data/eras";
import { clamp, lerp } from "../services/Random";
import { cloudSun } from "./CloudscapeLayout";

const duskPalette = {
  skyZenith: "#6d739b", skyHorizon: "#e3a181", sunTint: "#ffb278",
  cloudLit: "#e5b69b", cloudShadow: "#8a86ad", cloudRim: "#ffd0a0", valleyFog: "#ad99a4",
};
const nightPalette: typeof duskPalette = {
  skyZenith: "#17234d", skyHorizon: "#3e506d", sunTint: "#7895cd",
  cloudLit: "#7b92b5", cloudShadow: "#37465f", cloudRim: "#a8b8d4", valleyFog: "#40576d",
};

function smooth(start: number, end: number, value: number) {
  const t = clamp((value - start) / (end - start));
  return t * t * (3 - 2 * t);
}

export function sortieLighting(hour: number, cloud: number, visibility: number, base: EraColors) {
  const phase = (hour - 12) * Math.PI / 12;
  const sun = new Vector3(
    cloudSun[0] * Math.cos(phase) - Math.sin(phase) * .86,
    cloudSun[1] * Math.cos(phase),
    cloudSun[2],
  ).normalize();
  const night = 1 - smooth(-.50, .19, sun.y);
  const twilight = (1 - smooth(.12, .64, sun.y)) * (1 - night);
  const direct = smooth(.04, .36, sun.y) * (1 - clamp((cloud - 1) * .44));
  const shade = smooth(.08, .36, sun.y);
  const colors = { ...base };
  for (const key of Object.keys(duskPalette) as (keyof typeof duskPalette)[]) {
    const color = new Color(base[key]).lerp(new Color(duskPalette[key]), twilight).lerp(new Color(nightPalette[key]), night);
    if (key === "skyHorizon" || key === "valleyFog")
      color.lerp(new Color("#77818d"), (1 - visibility) * .40 * (1 - night));
    colors[key] = `#${color.getHexString()}`;
  }
  return { sun, colors, direct, shade, ambient: lerp(1, .43, night) * lerp(.84, 1, visibility), night };
}

export function landscapeLightUniforms() {
  return {
    landscapeSun: { value: new Vector3(...cloudSun).normalize() },
    sunlightAmount: { value: 1 },
    ambientAmount: { value: 1 },
    weatherVisibility: { value: 1 },
  };
}
