export const defaultCloudWind = [-.36, .93295] as const;
const roll = { horizontal: 2.35, vertical: 3.35 };
const eddies = { horizontal: 1.05, vertical: 1.1 };

export function cloudFlowSpeed(windX: number, windZ: number, gust: number) {
  const magnitude = Math.hypot(windX, windZ);
  return magnitude * 2.4 + Math.max(0, gust) * .65;
}

export function cloudFlowAdvance(delta: number, windX: number, windZ: number, gust: number) {
  return delta * cloudFlowSpeed(windX, windZ, gust);
}

export function cloudSelfMorphSpeed(windX: number, windZ: number, gust: number) {
  return .24 + Math.hypot(windX, windZ) * .75 + Math.max(0, gust) * .24;
}

export function smoothCloudFlow(current: number, target: number, delta: number, response = 2.4) {
  return current + (target - current) * (1 - Math.exp(-Math.max(0, delta) * response));
}

function flowDirection(windX: number, windZ: number): [number, number] {
  const length = Math.hypot(windX, windZ);
  return length > .001
    ? [windX / length, windZ / length]
    : [defaultCloudWind[0], defaultCloudWind[1]];
}

export function cloudSelfShapePosition(x: number, y: number, z: number, selfTime = 0) {
  const crest = x * .021 + z * .014 + y * .086 + selfTime * .12;
  const eddy = x * .031 - z * .019 + y * .19 + selfTime * .17;
  return {
    x: x - Math.cos(crest) * roll.horizontal - Math.sin(eddy) * eddies.horizontal,
    y: y - Math.sin(crest) * roll.vertical - Math.cos(eddy) * eddies.vertical,
    z,
  };
}

// Wind controls the translation offset. The shape basis stays in world space.
export function cloudFlowPosition(
  x: number,
  y: number,
  z: number,
  distance: number,
  windX: number = defaultCloudWind[0],
  windZ: number = defaultCloudWind[1],
  selfTime = 0,
) {
  [windX, windZ] = flowDirection(windX, windZ);
  return cloudSelfShapePosition(
    x - windX * distance * .42,
    y,
    z - windZ * distance * .42,
    selfTime,
  );
}

export const cloudFlowGLSL = `
  uniform float selfTime;

  vec3 cloudSelfShapePosition(vec3 position) {
    float crest = position.x * .021 + position.z * .014 + position.y * .086 + selfTime * .12;
    float eddy = position.x * .031 - position.z * .019 + position.y * .19 + selfTime * .17;
    return position - vec3(
      cos(crest) * 2.35 + sin(eddy) * 1.05,
      sin(crest) * 3.35 + cos(eddy) * 1.1,
      0.
    );
  }
`;
