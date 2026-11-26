import { Vector2 } from "three";
import type { WindField } from "../simulation/WindField";

export function vegetationWindUniforms() {
  return {
    sceneTime: { value: 0 },
    windTime: { value: 0 },
    windGust: { value: 0 },
    windScale: { value: 1 },
    windBias: { value: new Vector2() },
    windDirection: { value: new Vector2(0, 1) },
  };
}

export type VegetationWindUniforms = ReturnType<typeof vegetationWindUniforms>;

export function updateVegetationWind(
  uniforms: VegetationWindUniforms,
  sceneTime: number,
  wind: WindField | undefined,
  x: number,
  z: number,
) {
  uniforms.sceneTime.value = sceneTime;
  uniforms.windTime.value = wind?.time ?? 0;
  uniforms.windGust.value = wind?.gust ?? 0;
  uniforms.windScale.value = wind?.scale ?? 1;
  uniforms.windBias.value.set(wind?.direction.x ?? 0, wind?.direction.z ?? 0);
  const sample = wind?.sample(x, z);
  if (sample && Math.hypot(sample.x, sample.z) > .001) {
    uniforms.windDirection.value.set(sample.x, sample.z).normalize();
  } else {
    uniforms.windDirection.value.set(0, 1);
  }
}

// Matches WindField.sample at the vegetation root or terrain sample.
export const vegetationWindGLSL = `
uniform float sceneTime, windTime, windGust, windScale;
uniform vec2 windDirection, windBias;
vec2 sampleWind(vec2 world) {
  float strength = (.28 + min(.8, windTime / 240.)) * windScale;
  return vec2(sin(world.y * .018 + windTime * .075) * strength + windGust * .5,
              cos(world.x * .02 - windTime * .055) * strength * .6) + windBias;
}
`;
