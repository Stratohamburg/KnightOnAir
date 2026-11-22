export const defaultCloudWind = [-.36, .93295] as const;
const roll = { along: .205, across: .061, height: .086, horizontal: 2.35, vertical: 3.35 };
const eddies = { along: .37, across: -.24, height: .19, rate: .8, horizontal: 1.05, vertical: 1.1 };

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

// Both the volume shader and CPU visibility trace use this backward mapping.
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
  const along = x * windX + z * windZ;
  const across = x * windZ - z * windX;
  const crest = (along - distance) * roll.along + across * roll.across + y * roll.height + selfTime * .12;
  const eddy = (along - distance * eddies.rate) * eddies.along + across * eddies.across + y * eddies.height + selfTime * .17;
  const downstream = Math.cos(crest) * roll.horizontal;
  const lateral = Math.sin(eddy) * eddies.horizontal;
  return {
    x: x - (windX * downstream + windZ * lateral),
    y: y - (Math.sin(crest) * roll.vertical + Math.cos(eddy) * eddies.vertical),
    z: z - (windZ * downstream - windX * lateral),
  };
}

export const cloudFlowGLSL = `
  uniform vec2 flowDirection;

  uniform float selfTime;

  vec3 cloudFlowPosition(vec3 position, float distance) {
    vec2 wind = flowDirection;
    vec2 acrossWind = vec2(wind.y, -wind.x);
    float along = dot(position.xz, wind);
    float across = dot(position.xz, acrossWind);
    float crest = (along - distance) * ${roll.along} + across * ${roll.across} + position.y * ${roll.height} + selfTime * .12;
    float eddy = (along - distance * ${eddies.rate}) * ${eddies.along} + across * ${eddies.across} + position.y * ${eddies.height} + selfTime * .17;
    vec2 horizontal = wind * (cos(crest) * ${roll.horizontal}) + acrossWind * (sin(eddy) * ${eddies.horizontal});
    float lift = sin(crest) * ${roll.vertical} + cos(eddy) * ${eddies.vertical};
    return position - vec3(horizontal.x, lift, horizontal.y);
  }
`;
