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
    life: 34,
    magnetRadius: 5.2,
    pickupRadius: 2.6,
    partHealRatio: 0.18,
  },
  repairLarge: {
    healRatio: 0.28,
    coinValue: 5,
    xp: 35,
    life: 34,
    magnetRadius: 5.8,
    pickupRadius: 3,
    partHealRatio: 0.35,
  },
};

export const HEALTH_SUPPLY = {
  firstDelay: [3, 5],
  interval: [7, 10],
  low: 0.45,
  lowFactor: 0.55,
  critical: 0.25,
  criticalFactor: 0.35,
  minInterval: 3,
  pityDelay: 3,
  capRetry: 1,
  fieldCap: 6,
  keepDistance: 38,
  bearingMax: 1.15,
  smallDistance: [8, 15],
  largeDistance: [12, 20],
  largeChance: 0.25,
  largeChanceLow: 0.4,
  lowChanceThreshold: 0.5,
} as const;
