import { PioneerAssembly, sides, wingId, type Rib, type Point3, wood, iron, linen } from "./pioneerAssembly";

const body = "center_body",
  tail = "tail",
  engine = "engine_0";
export function bleriot(a: PioneerAssembly) {
  a.hull(
    body,
    [
      [2.94, 0.25, -0.48, 0.03],
      [2.73, 0.32, -0.53, 0.31],
      [2.39, 0.33, -0.53, 0.29],
      [1.95, 0.32, -0.51, 0.22],
      [1.6, 0.31, -0.51, 0.18],
    ],
    linen,
    false,
    [2, 3],
  );
  const stations = [1.6, 0.94, 0.27, -0.42, -1.06, -1.72, -2.32, -2.82];
  for (const s of sides) {
    const part = wingId(s);
    a.wing(
      part,
      s,
      [
        [0.31, 2.78, 0.98, 0.12],
        [2.99, 2.78, 0.98, 0.265],
        [3.36, 2.77, 1.09, 0.285],
        [3.62, 2.7, 1.39, 0.297],
        [3.83, 2.51, 1.82, 0.305],
        [3.895, 2.26, 2.02, 0.31],
      ],
      "wing-cover",
      0.072,
      0.184,
      0.025,
    );
    for (let i = 1; i < stations.length; i++) {
      const section = (i: number): [Point3, Point3] => {
        const z = stations[i],
          t = (1.6 - z) / 4.42;
        return [
          [s * (0.31 - 0.28 * t), 0.18 - 0.37 * t, z],
          [s * (0.31 - 0.28 * t), -0.51 + 0.04 * t, z],
        ];
      };
      const [u, l] = section(i - 1),
        [v, b] = section(i);
      a.rod(body, u, v, 0.022);
      a.rod(body, l, b, 0.022);
      a.rod(body, v, b, 0.019);
      a.wire(body, u, b, 0.01);
      a.wire(body, l, v, 0.01);
      a.rod(body, b, [-b[0], b[1], b[2]], 0.015);
      a.wire(body, u, [-v[0], v[1], v[2]], 0.01);
    }
    for (const z of [2.51, 1.61]) {
      a.rod(body, [s * 0.32, 0.18, z], [0, 0.92, z]);
      a.rod(body, [s * 0.32, -0.48, z], [0, -0.97, z]);
      for (const x of [1.42, 2.93]) {
        a.wire(part, [0, 0.92, z], [s * x, 0.12 + (0.19 * x) / 3.895 + (z - 2.5) * 0.18, z]);
        a.wire(part, [0, -0.97, z], [s * x, 0.105 + (0.19 * x) / 3.895 + (z - 2.5) * 0.18, z]);
      }
    }
    a.wing(
      tail,
      s,
      [
        [0, -1.98, -2.75, -0.31],
        [1.37, -1.97, -2.76, -0.31],
        [1.58, -2.06, -2.69, -0.31],
        [1.67, -2.27, -2.53, -0.31],
      ],
      "tailplane",
    );
  }
  a.rod(body, [0, 0.92, 1.61], [0, 0.92, 2.51]);
  a.fin(tail, 0, [
    [-2.76, 0.1],
    [-2.86, 0.22],
    [-3.21, 0.2],
    [-3.23, -0.54],
    [-2.76, -0.54],
  ]);
  a.gear(body, 0.69, -1.29, 2.5, 0.36, [0.27, -0.23, 2.93], [0.29, -0.49, 2.16]);
  a.wheel(tail, [0, -0.99, -1.32], 0.25);
  for (const z of [-0.41, -1.72]) a.rod(tail, [0, -0.48, z], [0, -0.99, -1.32]);
  for (const angle of [-1, 0, 1])
    a.rod(
      engine,
      [0, 0.0, 2.93],
      [0.37 * Math.sin(angle), 0.37 * Math.cos(angle), 2.93],
      0.091,
      iron,
      "fan-cylinders",
    );
  a.prop(engine, [0, 0.03, 3.05], 1.02);
}

export function taube(a: PioneerAssembly) {
  // Keimel April 1910: de-rotate the plan about the fuselage, excluding the bridge and its fan wires.
  const wing: Rib[] = [
    [0.23, 3.7, 0.97, 0.15],
    [1.8, 3.68, 0.84, 0.16],
    [3.07, 3.67, 0.87, 0.17],
    [3.75, 3.69, 0.91, 0.17],
    [4.51, 3.71, 0.49, 0.18],
    [5.07, 3.31, 0.13, 0.18],
    [5.83, 2.5, -0.13, 0.18],
    [6.31, 1.76, -0.2, 0.18],
    [6.67, 1.27, -0.23, 0.18],
    [6.98, 0.79, 0.08, 0.17],
    [7.15, 0.58, 0.48, 0.16],
  ];
  a.hull(
    body,
    [
      [4.68, 0.28, -0.67, 0.22],
      [3.83, 0.4, -0.95, 0.31],
      [3.05, 0.4, -0.92, 0.27],
      [2.03, 0.37, -0.8, 0.24],
      [0.68, 0.32, -0.63, 0.2],
      [-3.35, 0.1, -0.17, 0.16],
      [-4.9, 0.035, 0.07, 0.13],
    ],
    linen,
    false,
    [2, 3],
  );
  for (const s of sides) {
    const part = wingId(s);
    a.wing(part, s, wing);
    const pier: Point3 = [s * 4.88, 1.55, 2.28];
    const base: Point3 = [s * 4.88, -0.53, 2.28];
    a.rod(part, base, pier, 0.031, wood, "outer-post");
    let last: Point3 = [s * 0.39, -0.75, 2.42],
      lastTop: Point3 = [s * 0.39, 0.15, 2.42];
    for (const [x, d, z] of [
      [1.82, -0.72, 2.39],
      [3.38, -0.62, 2.32],
      [4.88, -0.53, 2.28],
      [7.01, 0.16, 2.46],
    ]) {
      const low: Point3 = [s * x, d, z],
        high: Point3 = [s * x, 0.17, z];
      a.rod(part, last, low, 0.03, wood, "underwing-bridge");
      if (x < 4.8) a.rod(part, low, high, 0.029);
      a.wire(part, last, high);
      a.wire(part, lastTop, low);
      last = low;
      lastTop = high;
    }
    // The outer bridge node lies forward of the swept cloth tip in plan.
    const outrigger: Point3 = [s * 7.01, 0.16, 2.46];
    for (const [x, z] of [
      [5.07, 3.31],
      [6.67, 1.17],
      [7.1, 0.58],
    ])
      a.wire(part, outrigger, [s * x, 0.17, z]);
    for (const [x, z] of [
      [7.01, 2.46],
      [7.1, 0.58],
      [4.51, 3.63],
      [3.38, 2.32],
      [5.0, 0.28],
    ])
      a.wire(part, pier, [s * x, 0.18, z]);
    for (const x of [1.82, 3.38, 4.88]) a.wire(part, [0, 1.63, 3.6], [s * x, 0.18, 2.35]);
    a.rod(body, [s * 0.34, 0.2, 3.1], [0, 1.63, 3.6]);
    a.wheel(part, [s * 4.88, -0.71, 2.28], 0.18);
    a.wing(
      tail,
      s,
      [
        [0, -2.93, -5.71, 0.12],
        [1.3, -2.73, -5.68, 0.12],
        [1.65, -2.64, -5.57, 0.12],
      ],
      "fan-tail",
    );
    a.wire(tail, [s * 2.0, 0.16, 0.91], [s * 1.59, 0.14, -3.9]);
  }
  for (const sign of sides) {
    a.fin(
      tail,
      0,
      [
        [-1.69, 0.13],
        [-3.0, 0.13 + sign * 0.68],
        [-3.98, 0.13 + sign * 0.3],
        [-3.0, 0.13],
      ],
      "split-rudder",
    );
    a.rod(tail, [0, 0.13, -3.0], [0, 0.13 + sign * 0.98, -3.0], 0.027);
    a.wire(tail, [0, 0.13 + sign * 0.98, -3.0], [0, 0.13, -4.92]);
  }
  a.gear(body, 0.95, -1.57, 3.76, 0.37, [0.34, -0.44, 4.48], [0.31, -0.69, 3.0]);
  a.box(engine, [0, 0.13, 4.32], [0.49, 0.39, 0.72], iron, "engine");
  a.prop(engine, [0, 0.13, 4.94], 1.15);
}

export function demoiselle(a: PioneerAssembly) {
  for (const s of sides) {
    const part = wingId(s);
    a.wing(
      part,
      s,
      [
        [0, 2.69, 0.94, 0.39],
        [1.14, 2.69, 0.94, 0.52],
        [1.15, 2.95, 0.94, 0.52],
        [2.745, 2.95, 0.96, 0.72],
      ],
      "wing-cover",
      0.072,
      0.11,
    );
    for (const x of [1.15, 2.26])
      for (const z of [1.18, 2.61]) a.wire(part, [s * 0.52, -0.64, 2.4], [s * x, 0.4 + 0.12 * x, z]);
    a.wing(
      tail,
      s,
      [
        [0, -1.95, -3.05, -0.19],
        [0.42, -1.58, -2.73, -0.19],
        [0.95, -1.99, -2.15, -0.19],
      ],
      "all-moving-tail",
    );
    a.wire(tail, [s * 0.2, -0.41, -0.35], [s * 0.95, -0.19, -2.08]);
  }
  // Single upper longeron, paired lower longerons, triangular transverse frames.
  let previous: Point3[] = [];
  for (const z of [2.83, 1.35, 0.48, -0.37, -1.27, -1.99]) {
    const t = (2.83 - z) / 4.82,
      w = 0.38 * (1 - t) + 0.03;
    const frame: Point3[] = [
      [0, 0.38 - 0.49 * t, z],
      [-w, -0.73 + 0.51 * t, z],
      [w, -0.73 + 0.51 * t, z],
    ];
    for (let j = 0; j < 3; j++) {
      const k = (j + 1) % 3;
      a.rod(body, frame[j], frame[k], 0.019);
      if (previous.length) {
        a.rod(body, previous[j], frame[j], 0.033, wood, "bamboo-longerons");
        a.wire(body, previous[j], frame[k], 0.01);
        a.wire(body, previous[k], frame[j], 0.01);
      }
    }
    previous = frame;
  }
  a.fin(
    tail,
    0,
    [
      [-1.99, -0.17],
      [-1.62, 0.17],
      [-2.02, 0.35],
      [-2.52, 0.16],
      [-3.05, -0.17],
      [-2.48, -0.5],
      [-2.02, -0.72],
      [-1.6, -0.5],
    ],
    "all-moving-fin",
  );
  a.rod(tail, [0, -0.67, -1.99], [0, 0.32, -1.99], 0.024, iron, "tail-pivot");
  for (const y of [-0.67, 0.32]) a.wire(tail, [0, -0.34, 0.97], [0, y, -1.99]);
  a.gear(body, 0.54, -0.83, 2.37, 0.28, [0.2, 0.36, 2.63], [0.33, -0.59, 1.55]);
  a.box(body, [0, -0.65, 1.99], [0.37, 0.08, 0.42], wood, "seat");
  for (const s of sides) a.rod(engine, [0, 0.43, 2.77], [s * 0.35, 0.62, 2.77], 0.11, iron, "opposed-cylinders");
  a.prop(engine, [0, 0.45, 2.98], 0.98);
}

export function deperdussin(a: PioneerAssembly) {
  a.hull(
    body,
    [
      [2.94, 0.2, -0.2, 0.23],
      [2.73, 0.37, -0.34, 0.35],
      [2.25, 0.405, -0.45, 0.45],
      [1.13, 0.43, -0.48, 0.51],
      [0.57, 0.39, -0.45, 0.48],
      [0.46, 0.38, -0.44, 0.64],
      [-0.3, 0.32, -0.36, 0.5],
      [-1.66, 0.2, -0.24, 0.39],
      [-2.81, 0.045, -0.08, 0.35],
    ],
    "#aa6941",
    true,
    [3],
  );
  for (const s of sides) {
    const part = wingId(s);
    a.wing(part, s, [
      [0.31, 2.47, 0.72, 0.06],
      [0.92, 2.29, 0.72, 0.06],
      [2.92, 2.29, 0.72, 0.08],
      [3.13, 2.29, 0.79, 0.08],
      [3.2, 2.12, 1.96, 0.08],
    ]);
    for (const z of [2.08, 0.87]) {
      a.rod(body, [s * 0.3, 0.37, z], [s * 0.26, 0.98, 1.89]);
      for (const x of [1.31, 2.79]) {
        a.wire(part, [s * 0.26, 0.98, 1.89], [s * x, 0.075, z]);
        a.wire(part, [s * 0.62, -0.9, 1.79], [s * x, 0.055, z]);
      }
    }
    a.wing(
      tail,
      s,
      [
        [0.0, -1.33, -2.84, 0.26],
        [0.26, -1.39, -2.94, 0.26],
        [0.7, -1.77, -3.0, 0.26],
        [0.98, -2.13, -3.04, 0.26],
        [1.03, -2.54, -3.01, 0.26],
      ],
      "tailplane",
    );
  }
  a.fin(tail, 0, [
    [-1.6, 0.34],
    [-2.31, 0.71],
    [-2.94, 0.83],
    [-3.02, 0.7],
    [-2.99, 0.0],
    [-2.76, -0.06],
  ]);
  a.gear(body, 0.66, -1.0, 1.75, 0.36, [0.28, -0.26, 2.33], [0.33, -0.31, 0.87]);
  a.ball(engine, [0, 0.04, 2.76], [0.41, 0.41, 0.3], "#b7aca2", "spinner");
  a.prop(engine, [0, 0.04, 2.73], 1.12);
}
