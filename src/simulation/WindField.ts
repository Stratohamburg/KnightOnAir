import { WEATHER_PRESETS } from "../data/sortieEnvironment";
import type { SortieEnvironment } from "./SortieEnvironment";

export class WindField {
  time = 0;
  gust = 0;
  scale = 1;
  direction = { x: 0, z: 0 };
  update(dt: number, weather: SortieEnvironment["weather"] = WEATHER_PRESETS.patrol) {
    this.time += dt;
    this.scale = weather.windScale;
    this.direction.x = weather.windX;
    this.direction.z = weather.windZ;
    this.gust =
      Math.max(0, Math.sin(this.time * 0.12)) * Math.min(1.5, this.time / 180) * weather.gustScale;
  }
  sample(x: number, z: number) {
    const strength = (0.28 + Math.min(0.8, this.time / 240)) * this.scale;
    return {
      x: Math.sin(z * 0.018 + this.time * 0.075) * strength + this.gust * 0.5 + this.direction.x,
      z: Math.cos(x * 0.02 - this.time * 0.055) * strength * 0.6 + this.direction.z,
    };
  }
}
