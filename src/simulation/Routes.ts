import { terrainHeight } from "./Terrain";

export type RouteKind = "road" | "rail" | "water";
export interface Route {
  id: string;
  kind: RouteKind;
  points: { x: number; z: number }[];
  loop: boolean;
}

const routePoints = (seed: number, radius: number, count: number) =>
  Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    const wobble = 1 + Math.sin(index * 2.13 + seed) * 0.12;
    return { x: Math.sin(angle) * radius * wobble, z: Math.cos(angle) * radius * wobble };
  });

export function createDefaultRoutes(seed = 491): Route[] {
  return [
    { id: `road-${seed}`, kind: "road", points: routePoints(seed, 46, 16), loop: true },
    { id: `rail-${seed}`, kind: "rail", points: routePoints(seed + 1, 72, 20), loop: true },
    { id: `water-${seed}`, kind: "water", points: routePoints(seed + 2, 92, 24), loop: true },
  ];
}

export function routePosition(route: Route, distance: number) {
  const points = route.points;
  const segments = route.loop ? points.length : points.length - 1;
  const scaled = ((distance % segments) + segments) % segments;
  const index = Math.floor(scaled);
  const next = (index + 1) % points.length;
  const t = scaled - index;
  return {
    x: points[index].x + (points[next].x - points[index].x) * t,
    z: points[index].z + (points[next].z - points[index].z) * t,
    y: terrainHeight(points[index].x, points[index].z),
  };
}

export function routeHeading(route: Route, distance: number) {
  const current = routePosition(route, distance);
  const next = routePosition(route, distance + 0.01);
  return Math.atan2(next.x - current.x, next.z - current.z);
}

export function nearestRouteDistance(route: Route, x: number, z: number) {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < route.points.length; i++) {
    const point = route.points[i];
    const distanceToPoint = Math.hypot(point.x - x, point.z - z);
    if (distanceToPoint < bestDistance) {
      bestDistance = distanceToPoint;
      best = i;
    }
  }
  return best;
}
