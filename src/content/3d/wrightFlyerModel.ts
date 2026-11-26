import { PioneerAssembly, sides, wingId, type Rib, type Point3, wood, iron, cable } from "./pioneerAssembly";
const body = "center_body",
  tail = "tail",
  engine = "engine_0";
export function flyer(a: PioneerAssembly) {
  // Engler plan, Kelley plates 1–2. Datum halfway between canard and rudder.
  const ribs: Rib[] = [
    [0, 0.75, -1.23, 0],
    [2.96, 0.75, -1.21, -0.04],
    [4.96, 0.75, -1.17, -0.14],
    [5.65, 0.75, -1.03, -0.21],
    [5.96, 0.72, -0.78, -0.235],
    [6.145, 0.45, -0.26, -0.25],
  ];
  for (const s of sides) {
    const part = wingId(s);
    for (const y of [-0.8, 1.08])
      a.wing(
        part,
        s,
        ribs.map(([x, f, b, h]) => [x, f, b, h + y]),
        "main-wings",
        0.051,
        0.115,
        0.02,
      );
    for (const z of [0.69, -0.55]) {
      let prev: [Point3, Point3] | undefined;
      for (const x of [0.72, 2.48, 4.16, 5.92]) {
        const drop = -0.25 * (x / 6.145) ** 2;
        const h = drop + (z < 0 ? -0.075 : 0);
        const low: Point3 = [s * x, h - 0.8, z],
          high: Point3 = [s * x, h + 1.08, z];
        a.rod(part, low, high, 0.027);
        if (x === 5.92) a.protrusion(part, "outer-strut", high);
        if (prev) {
          a.wire(part, prev[0], high);
          a.wire(part, prev[1], low);
        }
        prev = [low, high];
      }
    }
    const skid = s * 0.7;
    a.rod(body, [skid, -1.34, -0.54], [skid, -1.34, 2.72], 0.045);
    a.rod(body, [skid, -1.34, 2.72], [skid, -1.22, 2.93], 0.045);
    a.rod(body, [skid, -1.22, 2.93], [skid, -0.2, 2.96]);
    a.rod(body, [skid, -1.31, 2.8], [skid, 1.08, 0.69]);
    a.rod(body, [skid, -0.21, 2.96], [skid, -0.8, 0.69]);
    for (const z of [0.69, -0.55]) a.rod(body, [skid, -1.34, z], [skid, -0.8, z]);
    for (const y of [-0.55, 0.015]) {
      a.wing(
        "nose",
        s,
        [
          [0, 3.22, 2.44, y],
          [1.12, 3.2, 2.46, y],
          [1.52, 3.12, 2.56, y],
          [1.81, 2.92, 2.82, y],
        ],
        "front-elevators",
        0.027,
        0.018,
        0.022,
      );
    }
    for (const z of [2.61, 3.05]) a.rod("nose", [s * 1.24, -0.55, z], [s * 1.24, 0.015, z], 0.018);
    a.wire("nose", [s * 4.16, -0.83, 0.69], [s * 1.26, -0.53, 2.62]);
    a.rod(tail, [skid, 1.03, -0.55], [s * 0.21, 0.8, -2.79]);
    a.rod(tail, [skid, -1.3, -0.55], [s * 0.21, -1.21, -2.79]);
    a.wire(tail, [skid, 1.03, -0.55], [s * 0.21, -1.21, -2.79]);
    a.fin(
      tail,
      s * 0.21,
      [
        [-2.79, 0.81],
        [-3.215, 0.71],
        [-3.215, -1.19],
        [-2.79, -1.23],
      ],
      "twin-rudders",
    );
    a.wire(tail, [s * 0.47, -0.67, -0.32], [s * 0.3, -1.12, -2.79]);
    const axle = s * 1.56;
    a.rod(engine, [axle, 0.09, -0.28], [axle, 0.09, -1.43], 0.043, iron);
    a.rod(engine, [skid, -0.8, 0.15], [axle, 0.09, -0.32]);
    for (const edge of sides)
      a.rod(
        engine,
        [0.4, -0.53 + edge * 0.06, -0.28],
        [axle, 0.09 + edge * (s < 0 ? -0.09 : 0.09), -0.3 + edge * 0.014],
        0.017,
        cable,
        s < 0 ? "crossed-chain" : "open-chain",
      );
    a.prop(engine, [axle, 0.09, -1.43], 1.3, s * 0.68, s);
  }
  for (const s of sides)
    a.rod(tail, [s * 0.21, -1.23, -2.79], [s * 0.21, 0.81, -2.79], 0.024, iron, "rudder-pintles");
  for (const y of [-0.55, 0.015]) a.rod("nose", [-1.24, y, 2.82], [1.24, y, 2.82], 0.025);
  for (const y of [-1.21, 0.8]) a.rod(tail, [-0.21, y, -2.79], [0.21, y, -2.79], 0.022);
  a.box(engine, [0.4, -0.62, 0.05], [0.48, 0.3, 0.56], iron, "crankcase");
  for (const z of [-0.18, -0.04, 0.1, 0.24])
    a.rod(engine, [0.42, -0.55, z], [0.7, -0.5, z], 0.074, iron, "cylinders");
  a.box(body, [-0.47, -0.72, 0.17], [0.5, 0.08, 0.68], wood, "hip-cradle");
  a.ball(body, [-0.47, -0.57, 0.12], [0.19, 0.13, 0.41], "#696352", "prone-pilot");
  a.ball(body, [-0.47, -0.42, 0.52], [0.12, 0.13, 0.13], "#a88b70", "prone-pilot");
  for (const s of sides)
    a.ball(body, [-0.47 + s * 0.095, -0.64, -0.4], [0.083, 0.085, 0.32], "#59594d", "prone-pilot");
}
