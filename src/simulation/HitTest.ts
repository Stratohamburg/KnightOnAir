import { angleDelta } from "../services/Random";
import type { Part } from "./types";

export interface SweptProjectile {
  prevX: number;
  prevZ: number;
  x: number;
  z: number;
  radius?: number;
  y?: number;
  prevY?: number;
}

interface Point { x: number; z: number }
interface Target extends Point {
  heading: number;
  bank?: number;
  prevX?: number;
  prevZ?: number;
  prevHeading?: number;
  prevBank?: number;
  hitExtent?: number;
  parts: readonly Part[];
}

export interface HitPart extends Point {
  part?: Part;
  t: number;
}

export function silhouetteExtent(parts: readonly Part[]) {
  let extent = 0;
  for (const part of parts) {
    for (const polygon of part.silhouette ?? []) {
      for (const { x, y, z } of polygon) extent = Math.max(extent, Math.hypot(x, y, z));
    }
    for (const { x, z, r } of part.hitCircles ?? [{ x: part.x, z: part.z, r: part.radius }]) {
      extent = Math.max(extent, Math.hypot(x, part.y ?? 0, z) + r);
    }
  }
  return extent;
}

function circleEntry(start: Point, dx: number, dz: number, x: number, z: number, radius: number) {
  const sx = start.x - x, sz = start.z - z;
  const c = sx * sx + sz * sz - radius * radius;
  if (c <= 0) return 0;
  const a = dx * dx + dz * dz;
  const b = sx * dx + sz * dz;
  const discriminant = b * b - a * c;
  if (a === 0 || discriminant < 0) return Infinity;
  const root = (-b - Math.sqrt(discriminant)) / a;
  return root >= 0 && root <= 1 ? root : Infinity;
}

function polygonEntry(start: Point, dx: number, dz: number, points: Point[], radius: number, entry = 0, exit = 1) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    area += a.x * b.z - a.z * b.x;
  }
  if (Math.abs(area) < 1e-9) return Infinity;
  const sign = Math.sign(area);
  if (entry > exit) return Infinity;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const ex = b.x - a.x, ez = b.z - a.z;
    const offset = sign * (ex * (start.z - a.z) - ez * (start.x - a.x)) + radius * Math.hypot(ex, ez);
    const rate = sign * (ex * dz - ez * dx);
    if (Math.abs(rate) < 1e-10) {
      if (offset < 0) return Infinity;
      continue;
    }
    const crossing = -offset / rate;
    if (rate > 0) entry = Math.max(entry, crossing);
    else exit = Math.min(exit, crossing);
    if (entry > exit) return Infinity;
  }
  return entry;
}

export function hitEntity(entity: Target, projectile: SweptProjectile, altitude?: number): HitPart | undefined {
  // Keep the projectile relative to the target at both step endpoints. The
  // midpoint orientation represents the bank and heading over this fixed step.
  const heading = entity.heading - angleDelta(entity.heading, entity.prevHeading ?? entity.heading) * .5;
  const cos = Math.cos(heading), sin = Math.sin(heading);
  const bank = ((entity.bank ?? 0) + (entity.prevBank ?? entity.bank ?? 0)) * .5;
  const rollCos = Math.max(.018, Math.cos(bank)), rollSin = Math.sin(bank);
  const local = (x: number, z: number) => ({ x: x * cos - z * sin, z: x * sin + z * cos });
  const start = local(projectile.prevX - (entity.prevX ?? entity.x), projectile.prevZ - (entity.prevZ ?? entity.z));
  const end = local(projectile.x - entity.x, projectile.z - entity.z);
  const dx = end.x - start.x, dz = end.z - start.z;
  const radius = projectile.radius ?? .1;
  const extent = (entity.hitExtent ?? silhouetteExtent(entity.parts)) + radius * 2;
  if (Math.min(start.x, end.x) > extent || Math.max(start.x, end.x) < -extent ||
      Math.min(start.z, end.z) > extent || Math.max(start.z, end.z) < -extent) return;
  // Multi-deck wings have open space between skins in the same plan footprint.
  // When the projectile carries altitude, unroll the sweep and clip each deck independently.
  const hasHeight = altitude !== undefined && projectile.y !== undefined;
  const sy = (projectile.prevY ?? projectile.y ?? 0) - (altitude ?? 0);
  const ey = (projectile.y ?? 0) - (altitude ?? 0);
  const deckStart = {x:start.x*rollCos + sy*rollSin, z:start.z};
  const deckEndX = end.x*rollCos + ey*rollSin;
  const y0 = sy*rollCos - start.x*rollSin;
  const dy = ey*rollCos - end.x*rollSin - y0;
  function deckEntry(polygon: NonNullable<Part["silhouette"]>[number], r: number) {
    const heights = polygon.map(p => p.y);
    const bottom = Math.min(...heights) - .085 - r, top = Math.max(...heights) + .085 + r;
    if (Math.abs(dy) < 1e-8 && (y0 < bottom || y0 > top)) return Infinity;
    const t0 = dy ? (bottom-y0)/dy : 0, t1 = dy ? (top-y0)/dy : 1;
    return polygonEntry(deckStart,deckEndX-deckStart.x,dz,polygon,r,Math.max(0,Math.min(t0,t1)),Math.min(1,Math.max(t0,t1)));
  }
  let envelope = Infinity;
  let attribution = Infinity;
  let attributed: Part | undefined;
  const supported = (part: Part) => {
    let parentId = part.parentId;
    while (parentId) {
      const parent = entity.parts.find((candidate) => candidate.id === parentId);
      if (!parent || parent.destroyed || parent.state === "destroyed") return false;
      parentId = parent.parentId;
    }
    return true;
  };
  for (const part of entity.parts) {
    if (part.destroyed || part.state === "destroyed" || !supported(part)) continue;
    const projectedX = part.x * rollCos - (part.y ?? 0) * rollSin;
    const zones = part.hitCircles ?? [{ x: part.x, z: part.z, r: part.radius }];
    let contact = Infinity;
    if (part.silhouette) {
      for (const polygon of part.silhouette) {
        if (hasHeight && part.layeredWing) {
          contact = Math.min(contact,deckEntry(polygon,radius));
          continue;
        }
        const projected = polygon.map(({ x, y, z }) => ({ x: x * rollCos - y * rollSin, z }));
        contact = Math.min(contact, polygonEntry(start, dx, dz, projected, radius));
      }
    } else {
      for (const zone of zones) {
        const x = projectedX + (zone.x - part.x) * rollCos;
        contact = Math.min(contact, circleEntry(start, dx, dz, x, zone.z, zone.r + radius));
      }
    }
    envelope = Math.min(envelope, contact);
    // The outer projectile radius can graze the silhouette without its center
    // crossing a part. That retains the airframe contact without attribution.
    if (!Number.isFinite(contact)) continue;
    let partEntry = Infinity;
    if (part.silhouette) {
      for (const polygon of part.silhouette) {
        if (hasHeight && part.layeredWing) {
          partEntry = Math.min(partEntry,deckEntry(polygon,0));
          continue;
        }
        const projected = polygon.map(({ x, y, z }) => ({ x: x * rollCos - y * rollSin, z }));
        partEntry = Math.min(partEntry, polygonEntry(start, dx, dz, projected, 0));
      }
    } else {
      for (const zone of zones) {
        const x = projectedX + (zone.x - part.x) * rollCos;
        partEntry = Math.min(partEntry, circleEntry(start, dx, dz, x, zone.z, zone.r));
      }
    }
    if (partEntry < attribution || (partEntry === attribution && attributed && part.id < attributed.id)) {
      attribution = partEntry;
      attributed = part;
    }
  }
  if (!Number.isFinite(envelope)) return;
  return {
    part: attributed,
    t: envelope,
    x: projectile.prevX + (projectile.x - projectile.prevX) * envelope,
    z: projectile.prevZ + (projectile.z - projectile.prevZ) * envelope,
  };
}
