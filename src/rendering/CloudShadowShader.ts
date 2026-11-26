export const cloudShadowSpan = 352;

export const cloudShadowGLSL = `
  uniform sampler2D cloudShadowMap;
  uniform vec2 cloudShadowCenter;
  uniform float cloudShadowStrength;
  uniform vec3 cloudShadowSun;

  float cloudLightAt(vec3 world) {
    vec3 sun = cloudShadowSun;
    vec2 lightSpace = world.xz - sun.xz * (world.y / max(.17, sun.y));
    vec2 fromCenter = (lightSpace - cloudShadowCenter) / ${cloudShadowSpan}.;
    float edge = max(abs(fromCenter.x), abs(fromCenter.y));
    if (cloudShadowStrength <= 0. || edge >= .5) return 1.;
    vec2 sunlight = texture2D(cloudShadowMap, fromCenter + .5).rg;
    float groundLight = mix(sunlight.x, sunlight.y, smoothstep(12., 24., world.y));
    return 1. - (1. - groundLight) * cloudShadowStrength * (1. - smoothstep(.42, .5, edge));
  }
`;
