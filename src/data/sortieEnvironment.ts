export const WEATHER_PRESETS = {
  patrol: { label: "晴朗", windScale: 1, gustScale: 1, windX: 0, windZ: 0, cloud: 1, visibility: 1, rain: 0 },
  clear: { label: "晴朗 · 低风", windScale: .2, gustScale: .12, windX: 0, windZ: 0, cloud: .65, visibility: 1, rain: 0 },
  overcast: { label: "多云", windScale: .7, gustScale: .65, windX: .18, windZ: .1, cloud: 1.45, visibility: .79, rain: 0 },
  gusts: { label: "阵风", windScale: 1.4, gustScale: 2, windX: .45, windZ: -.2, cloud: 1, visibility: .91, rain: 0 },
  mist: { label: "薄雾", windScale: .38, gustScale: .25, windX: .04, windZ: .08, cloud: 1.05, visibility: .46, rain: 0 },
  drizzle: { label: "小雨", windScale: .74, gustScale: .6, windX: -.12, windZ: .24, cloud: 1.3, visibility: .64, rain: .45 },
} as const;

export const DAY_PERIODS = {
  dawn: { label: "黎明", hour: 6.6 },
  day: { label: "白天", hour: 12 },
  dusk: { label: "黄昏", hour: 17.8 },
  night: { label: "夜间", hour: 21 },
} as const;

export type WeatherId = keyof typeof WEATHER_PRESETS;
export type DayPeriodId = keyof typeof DAY_PERIODS;

type EnvironmentTrigger = { elapsed: number } | { stage: string };
type EnvironmentTransition = { trigger: EnvironmentTrigger; duration: number };

export interface SortieEnvironmentConfig {
  weather: WeatherId;
  period: DayPeriodId;
  weatherTransition?: EnvironmentTransition & { to: WeatherId };
  periodTransition?: EnvironmentTransition & { to: DayPeriodId };
}
