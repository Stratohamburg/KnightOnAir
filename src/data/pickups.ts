import type { PickupKind } from "../simulation/types";

export interface PickupSpec {
  healRatio: number;
  coinValue: number;
  xp: number;
  life: number;
  magnetRadius: number;
  pickupRadius: number;
  partHealRatio?: number;
}

export const PICKUP: Record<PickupKind, PickupSpec> = {
  coin: {
    healRatio: 0,
    coinValue: 1,
    xp: 9,
    life: 28,
    magnetRadius: 5.2,
    pickupRadius: 1.6,
  },
  repairSmall: {
    healRatio: 0.12,
    coinValue: 2,
    xp: 15,
    life: 26,
    magnetRadius: 3.6,
    pickupRadius: 2,
    partHealRatio: 0.18,
  },
  repairLarge: {
    healRatio: 0.28,
    coinValue: 5,
    xp: 35,
    life: 26,
    magnetRadius: 3.6,
    pickupRadius: 2,
    partHealRatio: 0.35,
  },
};

export const HEALTH_SUPPLY = {
  firstDelay: [8, 12],
  interval: [18, 26],
  low: 0.45,
  lowFactor: 0.55,
  critical: 0.25,
  criticalFactor: 0.35,
  minInterval: 6,
  pityDelay: 4,
  capRetry: 2,
  fieldCap: 3,
  bearingMax: 2.2,
  smallDistance: [12, 22],
  largeDistance: [18, 28],
  largeChance: 0.25,
  largeChanceLow: 0.4,
  lowChanceThreshold: 0.5,
} as const;
