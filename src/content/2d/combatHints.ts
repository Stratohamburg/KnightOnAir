export interface ThreatView {
  id: number;
  x: number;
  y: number;
  z: number;
  layer: "air" | "ground" | "water";
  distance: number;
  bearing: number;
  firing?: boolean;
  chasing?: boolean;
  breaking?: boolean;
  elite?: boolean;
  onScreen?: boolean;
  kind?: string;
  count?: number;
}

export interface RadarPoint {
  x: number;
  y: number;
  distance: number;
  outOfRange: boolean;
  bearing: number;
}

export function radarPoint(
  threat: { x: number; z: number },
  player: { x: number; z: number; heading: number },
  size = 120,
  range = 60,
): RadarPoint {
  const dx = threat.x - player.x;
  const dz = threat.z - player.z;
  const distance = Math.hypot(dx, dz);
  const bearing = normalizeAngle(Math.atan2(dx, dz) - player.heading);
  const factor = Math.min(1, distance / range);
  const radius = size * 0.5 - 6;
  return {
    x: Math.sin(bearing) * radius * factor,
    y: -Math.cos(bearing) * radius * factor,
    distance,
    outOfRange: distance > range,
    bearing,
  };
}

export interface EdgeRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
export interface EdgeAnchor {
  id: number;
  x: number;
  y: number;
  angle: number;
  count: number;
  distance: number;
  kind: string;
  breaking?: boolean;
}

const normalizeAngle = (angle: number) => {
  let result = angle;
  while (result > Math.PI) result -= Math.PI * 2;
  while (result < -Math.PI) result += Math.PI * 2;
  return result;
};

const rank = (threat: ThreatView) =>
  (threat.firing ? 3 : threat.chasing ? 2 : 1) + (threat.elite ? 0.25 : 0);

export function mergeSameBearing(threats: readonly ThreatView[], threshold = (8 * Math.PI) / 180) {
  const result: ThreatView[] = [];
  for (const threat of threats) {
    const found = result.find(
      (value) => value.kind === threat.kind && Math.abs(normalizeAngle(value.bearing - threat.bearing)) < threshold,
    );
    if (!found) result.push({ ...threat, count: threat.count ?? 1 });
    else {
      found.distance = Math.min(found.distance, threat.distance);
      found.x = (found.x + threat.x) * 0.5;
      found.z = (found.z + threat.z) * 0.5;
      found.count = (found.count ?? 1) + (threat.count ?? 1);
    }
  }
  return result;
}

export function edgeAnchors(threats: readonly ThreatView[], rect: EdgeRect, max = 4): EdgeAnchor[] {
  const selected = mergeSameBearing(
    threats
      .filter((threat) => threat.layer === "air" && !threat.onScreen && threat.distance <= 80)
      .sort((a, b) => rank(b) - rank(a) || a.distance - b.distance),
  ).slice(0, max);
  const centerX = (rect.left + rect.right) * 0.5;
  const centerY = (rect.top + rect.bottom) * 0.5;
  return selected.map((threat) => {
    const angle = threat.bearing;
    const dx = Math.sin(angle);
    const dy = -Math.cos(angle);
    const tx = Math.abs(dx) > 0.0001 ? (dx > 0 ? rect.right - centerX : rect.left - centerX) / dx : Number.POSITIVE_INFINITY;
    const ty = Math.abs(dy) > 0.0001 ? (dy > 0 ? rect.bottom - centerY : rect.top - centerY) / dy : Number.POSITIVE_INFINITY;
    const t = Math.min(Math.abs(tx), Math.abs(ty));
    return {
      id: threat.id,
      x: centerX + dx * t,
      y: centerY + dy * t,
      angle: (angle * 180) / Math.PI,
      count: threat.count ?? 1,
      distance: threat.distance,
      kind: threat.kind ?? "plane",
      breaking: threat.breaking,
    };
  });
}

export interface KillFeedItem {
  id: string;
  kind: string;
  count: number;
  score: number;
  coins: number;
  time: number;
}

export function killFeedReducer(items: readonly KillFeedItem[], event: Omit<KillFeedItem, "id" | "count">, now: number) {
  const next = items.map((item) => ({ ...item }));
  const existing = next.find((item) => item.kind === event.kind && now - item.time <= 0.8);
  if (existing) {
    existing.count += 1;
    existing.score += event.score;
    existing.coins += event.coins;
    existing.time = now;
  } else {
    next.unshift({ ...event, id: `${event.kind}-${now}`, count: 1 });
  }
  return next.slice(0, 3);
}
