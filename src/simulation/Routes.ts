import { clamp } from "../services/Random";
import { railX, riverZ, roadX, surfaceHeight } from "./Terrain";

export type RouteKind = "road" | "rail" | "water";
export interface Route {
  id: string;
  kind: RouteKind;
  seed: number;
  points: { x: number; z: number }[];
  offsets: number[];
  length: number;
  loop: boolean;
}

function route(seed: number, kind: RouteKind, id: string): Route {
  const spacing = kind === "rail" ? 1.4 : 2;
  const points = Array.from({ length: Math.floor(840 / spacing) + 1 }, (_, index) => {
    const coordinate = index * spacing - 420;
    if (kind === "water") return { x: coordinate, z: riverZ(coordinate, seed) };
    const x = kind === "rail" ? railX(coordinate, seed) : roadX(coordinate, seed);
    return { x, z: coordinate };
  });
  const offsets = [0];
  for (let index = 1; index < points.length; index++) {
    const current = points[index], previous = points[index - 1];
    offsets.push(offsets[index - 1] + Math.hypot(current.x - previous.x, current.z - previous.z));
  }
  return { id, kind, seed, points, offsets, loop: false, length: offsets.at(-1)! };
}

export function createDefaultRoutes(seed = 491): Route[] {
  return [route(seed, "road", "road-" + seed), route(seed, "rail", "rail-" + (seed + 1)),
    route(seed, "water", "water-" + seed)];
}

function segmentAt(route: Route, distance: number) {
  let low = 0, high = route.offsets.length - 1;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (route.offsets[middle] <= distance) low = middle;
    else high = middle;
  }
  return low;
}

export function routePosition(route: Route, distance: number) {
  const at = clamp(distance, 0, route.length);
  const segment = segmentAt(route, at);
  const from = route.points[segment], to = route.points[segment + 1];
  const t = (at - route.offsets[segment]) / (route.offsets[segment + 1] - route.offsets[segment]);
  const x = from.x + (to.x - from.x) * t, z = from.z + (to.z - from.z) * t;
  return { x, z, y: routeHeight(route, x, z) };
}

export function routeHeight(route: Route, x: number, z: number) {
  const y = surfaceHeight(x, z, route.seed);
  return route.kind === "water" ? y : Math.max(y, .2);
}

export function routeHeading(route: Route, distance: number) {
  const segment = segmentAt(route, distance);
  const from = route.points[segment], to = route.points[segment + 1];
  return Math.atan2(to.x - from.x, to.z - from.z);
}

export function nearestRouteDistance(route: Route, x: number, z: number) {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < route.points.length - 1; index++) {
    const point = route.points[index], next = route.points[index + 1];
    const dx = next.x - point.x, dz = next.z - point.z;
    const t = clamp(((x - point.x) * dx + (z - point.z) * dz) / (dx * dx + dz * dz), 0, 1);
    const distance = (point.x + dx * t - x) ** 2 + (point.z + dz * t - z) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = route.offsets[index] + (route.offsets[index + 1] - route.offsets[index]) * t;
    }
  }
  return best;
}
