import { Vector4 } from "three";
import { RULES } from "../data/config";
import { cloudSun } from "./CloudscapeLayout";

const maxCasters = 1 + RULES.maxEnemies + RULES.maxElite;

export class AircraftShadows {
  readonly uniforms = {
    aircraftShadowCount: { value: 0 },
    aircraftShadowPose: { value: Array.from({ length: maxCasters }, () => new Vector4()) },
    aircraftShadowShape: { value: Array.from({ length: maxCasters }, () => new Vector4()) },
  };

  clear() {
    this.uniforms.aircraftShadowCount.value = 0;
  }

  add(x: number, y: number, z: number, heading: number, width: number, length: number, strength: number, hull = false) {
    const index = this.uniforms.aircraftShadowCount.value;
    if (index >= maxCasters) return;
    this.uniforms.aircraftShadowPose.value[index].set(x, y, z, heading);
    this.uniforms.aircraftShadowShape.value[index].set(width / 2, length / 2, strength, Number(hull));
    this.uniforms.aircraftShadowCount.value++;
  }
}

export const aircraftShadowGLSL = `
  uniform int aircraftShadowCount;
  uniform vec4 aircraftShadowPose[${maxCasters}];
  uniform vec4 aircraftShadowShape[${maxCasters}];

  float shadowEllipse(vec2 p, vec2 radius) {
    return (length(p / radius) - 1.) * min(radius.x, radius.y);
  }

  float aircraftSunlightAt(vec3 world) {
    const vec3 direction = vec3(${cloudSun.join(", ")});
    float shade = 0.;
    for (int i = 0; i < ${maxCasters}; i++) {
      if (i >= aircraftShadowCount) break;
      vec4 pose = aircraftShadowPose[i];
      vec4 shape = aircraftShadowShape[i];
      float height = pose.y - world.y;
      if (height < .08) continue;
      vec2 offset = world.xz + direction.xz * (height / direction.y) - pose.xz;
      float softness = .14 + height * .022;
      if (max(abs(offset.x), abs(offset.y)) > max(shape.x, shape.y) * 1.5 + softness) continue;
      float c = cos(pose.w), s = sin(pose.w);
      vec2 p = vec2(dot(offset, vec2(c, -s)), dot(offset, vec2(s, c)));
      float bodyWidth = shape.w > .5 ? shape.x * .82 : max(.35, shape.x * .13);
      float body = shadowEllipse(p, vec2(bodyWidth, shape.y));
      if (shape.w < .5) {
        float wingSpan = clamp(abs(p.x) / shape.x, 0., 1.);
        float wingChord = shape.y * mix(.39, .13, wingSpan);
        float wing = max(abs(p.x) - shape.x, abs(p.y - shape.y * (.16 - wingSpan * .28)) - wingChord);
        float tail = shadowEllipse(p + vec2(0., shape.y * .73), vec2(shape.x * .32, shape.y * .19));
        body = min(body, min(wing, tail));
      }
      shade = max(shade, (1. - smoothstep(-softness * .45, softness, body)) * shape.z);
    }
    return 1. - shade;
  }
`;
