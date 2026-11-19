export const RULES = {
  step: 1 / 60,
  maxFrame: 0.12,
  maxSteps: 8,
  playerHeight: 4,
  boundary: 380,
  maxEnemies: 24,
  maxGround: 14,
  maxProjectiles: 140,
  maxPickups: 56,
  maxEffects: 80,
  invulnerability: 0.65,
  bombThreshold: 0.82,
  bombSettleRate: 0.64,
  bombFallTime: 0.85,
  pickupRadius: 1.6,
  magnetRadius: 5.2,
  comboTimeout: 5,
  camera: { fov: 48, pitch: 62, distance: 32, near: 0.1, far: 180, yaw: 0 },
} as const;
export type Quality = "low" | "standard" | "high";
export const QUALITIES = {
  low: { label: "省电", scale: 0.7, clouds: 5, particles: 24, shadows: false },
  standard: {
    label: "标准",
    scale: 0.85,
    clouds: 9,
    particles: 48,
    shadows: true,
  },
  high: { label: "高", scale: 1, clouds: 14, particles: 80, shadows: true },
} as const;
