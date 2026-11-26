import {
  DAY_PERIODS, WEATHER_PRESETS, type DayPeriodId, type SortieEnvironmentConfig, type WeatherId,
} from "../data/sortieEnvironment";
import { clamp, lerp } from "../services/Random";

function progress(elapsed: number, start: number, duration: number) {
  const t = clamp((elapsed - start) / duration);
  return t * t * (3 - 2 * t);
}

const weatherFields = ["windScale", "gustScale", "windX", "windZ", "cloud", "visibility", "rain"] as const;

export class SortieEnvironment {
  weatherId: WeatherId;
  period: DayPeriodId;
  weather: Record<(typeof weatherFields)[number], number>;
  hour: number;
  private weatherStarted?: number;
  private periodStarted?: number;
  private readonly entered = new Set<string>();

  constructor(readonly config: SortieEnvironmentConfig = { weather: "patrol", period: "day" }) {
    this.weatherId = config.weather;
    const { windScale, gustScale, windX, windZ, cloud, visibility, rain } = WEATHER_PRESETS[config.weather];
    this.weather = { windScale, gustScale, windX, windZ, cloud, visibility, rain };
    this.period = config.period;
    this.hour = DAY_PERIODS[this.period].hour;
  }

  update(elapsed: number, stage?: string) {
    if (stage) this.entered.add(stage);
    const notices: string[] = [];
    const weather = this.config.weatherTransition;
    if (weather) {
      const trigger = weather.trigger;
      if (this.weatherStarted === undefined && ("stage" in trigger ? this.entered.has(trigger.stage) : elapsed >= trigger.elapsed)) {
        this.weatherStarted = "elapsed" in trigger ? trigger.elapsed : elapsed;
        this.weatherId = weather.to;
        notices.push(WEATHER_PRESETS[weather.to].label);
      }
      if (this.weatherStarted !== undefined) {
        const t = progress(elapsed, this.weatherStarted, weather.duration);
        const from = WEATHER_PRESETS[this.config.weather], to = WEATHER_PRESETS[weather.to];
        for (const key of weatherFields) this.weather[key] = lerp(from[key], to[key], t);
      }
    }

    const timing = this.config.periodTransition;
    if (timing) {
      const trigger = timing.trigger;
      if (this.periodStarted === undefined && ("stage" in trigger ? this.entered.has(trigger.stage) : elapsed >= trigger.elapsed))
        this.periodStarted = "elapsed" in trigger ? trigger.elapsed : elapsed;
      if (this.periodStarted !== undefined) {
        const t = progress(elapsed, this.periodStarted, timing.duration);
        const from = DAY_PERIODS[this.config.period].hour, to = DAY_PERIODS[timing.to].hour;
        this.hour = lerp(from, to < from ? to + 24 : to, t);
        if (t >= 1 && this.period !== timing.to) {
          this.period = timing.to;
          notices.push(DAY_PERIODS[timing.to].label);
        }
      }
    }
    return notices;
  }
}
