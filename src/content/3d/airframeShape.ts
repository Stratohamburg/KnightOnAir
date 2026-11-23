export interface WingShape {
  rootX: number;
  y: number;
  z: number;
  span: number;
  chord: number;
  sweep: number;
}

export function wingSection(shape: WingShape, from = 0, to = 1) {
  const edge = (t: number, root: number, tip: number) => ({
    x: shape.rootX + shape.span * t,
    y: shape.y,
    z: shape.z + root + (tip - root) * t,
  });
  return [
    edge(from, shape.chord * .48, -shape.sweep),
    edge(to, shape.chord * .48, -shape.sweep),
    edge(to, -shape.chord * .6, -shape.sweep - shape.chord * .36),
    edge(from, -shape.chord * .6, -shape.sweep - shape.chord * .36),
  ];
}

export function mainWing(span: number, length: number, side: number): WingShape {
  return { rootX: side * .3, y: -.02, z: .12, span: (span / 2 - .3) * side, chord: length * .37, sweep: length * .13 };
}

export const WING_TIP_START = .78;

export const FUSELAGE_SECTIONS = [
  [-.5, .22, .2], [-.32, .75, .72], [-.1, 1, 1], [.15, .83, .92], [.34, .46, .55], [.5, .025, .05],
] as const;

export function npcAirframeShape(kind: string, era: string) {
  const heavy = ["elite", "bomber", "gunship", "jet_bomber", "heavy_fighter"].includes(kind);
  const buoyant = kind === "recon_balloon" || (kind === "elite" && era === "ww1");
  return {
    buoyant,
    wingspan: kind === "bomber" ? 5.6 : 4,
    length: buoyant ? kind === "elite" ? 4.9 : 2.2 : heavy ? 3.45 : 2.5,
    width: buoyant ? .9 : heavy ? .48 : .27,
    tiers: era === "pioneer" || era === "ww1" ? 2 : 1,
    wingLength: 3.25,
  };
}
