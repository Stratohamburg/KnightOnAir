export const defaultCloudWind = [-.36, .93295] as const;
// Keep self morphing smaller than the cloud wall so it breathes locally
// instead of translating the entire volume as a visible wave.
const roll = { horizontal: .72, vertical: .95 };
const eddies = { horizontal: .28, vertical: .34 };
const curl = { horizontal: .18, vertical: .22 };

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
  const curlPhase = x * .012 - z * .017 + y * .061 + selfTime * .071;
  return {
    x: x - Math.cos(crest) * roll.horizontal - Math.sin(eddy) * eddies.horizontal - Math.sin(curlPhase) * curl.horizontal,
    y: y - Math.sin(crest) * roll.vertical - Math.cos(eddy) * eddies.vertical - Math.cos(curlPhase) * curl.vertical,
    z: z - Math.cos(curlPhase) * curl.horizontal * .55,
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
    float curlPhase = position.x * .012 - position.z * .017 + position.y * .061 + selfTime * .071;
    return position - vec3(
      cos(crest) * .72 + sin(eddy) * .28 + sin(curlPhase) * .18,
      sin(crest) * .95 + cos(eddy) * .34 + cos(curlPhase) * .22,
      cos(curlPhase) * .099
    );
  }
`;
