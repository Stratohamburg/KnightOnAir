import * as THREE from "three";
import type { ProceduralAircraft } from "../content/3d/AircraftFactory";
import { ContentCatalog } from "../content/3d/ContentCatalog";
import { QUALITIES, type Quality } from "../data/config";
import type { EraColors } from "../data/eras";
import {
  bakeBillowNoise, bakeCloudMap, bakeCloudNoise, cloudBase, cloudNoiseSize, cloudSun, cloudTop, sampleBillowNoise,
} from "./CloudscapeLayout";
import {
  billowRiseRate, cloudSelfMorphSpeed, cloudVelocity, localBillowShift, smoothCloudFlow,
} from "./CloudFlow";
import {
  evaluateActiveClouds, evaluateCloudSdfCpu, MAX_ACTIVE_LOBES, MAX_CLOUD_CLUSTERS, MAX_RASTER_GROUP_LOBES, MAX_RASTER_LOBES,
  sdfToDensity, type ActiveCloudField,
} from "./CloudLobes";
import type { SceneActor } from "../content/3d/SceneObjects";
import { cloudCutGLSL, cloudWakeGLSL } from "./CloudWake";
import { CloudMeshRenderer } from "./CloudMeshRenderer";
import { cloudShadowSpan as shadowSpan } from "./CloudShadowShader";
export { cloudShadowGLSL } from "./CloudShadowShader";

export type CloudRenderMode = "sdf" | "mesh";

export interface CloudAtmospherePalette {
  cloudLit: string;
  cloudShadow: string;
  cloudRim: string;
  skyHorizon: string;
  valleyFog: string;
}

const quadVertex = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0., 1.);
  }
`;

// Analytical SDF Sphere-Tracing Cloud Renderer (Route A — Sky: Children of the Light Daylight Prairie)
// Zero fixed-step horizontal slicing, 100% crisp whipped-cream lobes, real 3D normals,
// soft SDF self-shadowing, crevice AO, creamy SSS translucency, and smooth-max aircraft carving.
const cloudFragment = `
  precision highp sampler3D;
  uniform sampler2D worldDepth;
  uniform sampler3D billowNoise;
  uniform mat4 inverseProjection, cameraWorld;
  uniform vec4 clusterBounds[${MAX_CLOUD_CLUSTERS}];
  uniform vec2 clusterRange[${MAX_CLOUD_CLUSTERS}];
  uniform int clusterCount;
  uniform vec4 lobePosRad[${MAX_ACTIVE_LOBES}];
  uniform vec4 lobeMeta[${MAX_ACTIVE_LOBES}]; // x: yScale, y: blend, z: phase, w: crownBias
  uniform float selfTime, selfStrength, detailStrength;
  uniform vec2 drift;
  ${cloudCutGLSL}
  ${cloudWakeGLSL}
  uniform int maxSteps, shadowSteps;
  uniform vec3 sunDirection, distanceColor, cloudLit, cloudShadow, cloudRim;
  varying vec2 vUv;
  out vec4 cloudColor;

  // Smooth continuous 3D surface billowing displacement (strictly zero-mean & Lipschitz-bounded).
  // Macro drift already lives in lobePosRad, so clouds move strictly with WindField while
  // boiling/rolling organically in place with lush multi-scale cauliflower puffs.
  float billowSurface(vec3 p, float detailScale) {
    vec3 local = p - vec3(drift.x, 0., drift.y);
    vec3 uv1 = vec3(local.x, local.y - selfTime * ${billowRiseRate.toFixed(2)}, local.z) * .030;
    vec4 n1 = texture(billowNoise, uv1);
    float macro = (n1.r - .5) * 3.5 + (n1.g - .5) * 1.15;
    if (detailScale <= .01) return macro;
    float warp = (n1.a - .5) * 3.1 * selfStrength;
    vec3 uv2 = vec3(
      local.x + warp,
      local.y - selfTime * ${(billowRiseRate * 1.65).toFixed(2)},
      local.z - warp * .85
    ) * .064;
    vec4 n2 = texture(billowNoise, uv2);
    return macro + ((n2.r - .5) * 1.35 + (n2.g - .5) * .65) * detailScale;
  }

  // Evaluates the fused SDF only across clusters intersecting the current ray (bitmask).
  // Returns vec2(signedDistance, heightHint).
  vec2 mapCloud(vec3 p, int activeMask, float detailScale, bool withCarve) {
    float d = 1e4;
    float heightHint = .5;

    for (int c = 0; c < ${MAX_CLOUD_CLUSTERS}; c++) {
      if (c >= clusterCount) break;
      if ((activeMask & (1 << c)) == 0) continue;
      vec4 cb = clusterBounds[c];
      float boundD = length(p - cb.xyz) - cb.w;
      if (boundD > d + 4.) continue;

      int start = int(clusterRange[c].x);
      int count = int(clusterRange[c].y);
      float groupD = 1e4;
      float groupH = .5;

      for (int j = 0; j < 8; j++) {
        if (j >= count) break;
        int idx = start + j;
        vec4 lr = lobePosRad[idx];
        vec4 lm = lobeMeta[idx];
        vec3 q = p - lr.xyz;
        float yScale = lm.x;
        float sd = (length(vec3(q.x, q.y / yScale, q.z)) - lr.w) * yScale;
        if (j == 0) {
          groupD = sd;
          groupH = clamp((q.y / max(lr.w * yScale, 1.)) * .5 + .5, 0., 1.) * .68 + lm.w * .32;
        } else {
          float k = lm.y;
          float h = clamp(.5 + .5 * (sd - groupD) / k, 0., 1.);
          float lobeH = clamp((q.y / max(lr.w * yScale, 1.)) * .5 + .5, 0., 1.) * .68 + lm.w * .32;
          groupD = mix(sd, groupD, h) - k * h * (1. - h);
          groupH = mix(lobeH, groupH, h);
        }
      }

      if (groupD < d) {
        d = groupD;
        heightHint = groupH;
      }
    }

    // Add organic 3D billowing cauliflower relief only when close to the cloud surface.
    if (d < 6.0) {
      float dispWeight = 1. - smoothstep(1.4, 6.0, d);
      d -= billowSurface(p, detailScale) * dispWeight;
    }

    if (withCarve && wakeCount > 0) {
      float weight;
      vec3 gradient;
      d -= .55 * wakeOffset(p - vec3(drift.x, 0., drift.y), weight, gradient);
    }
    // Smooth-subtract the much smaller current vehicle contacts.
    if (withCarve && cutCount > 0 && all(greaterThanEqual(p, cutMin)) && all(lessThanEqual(p, cutMax))) {
      vec4 sphere;
      float weight;
      d = subtractCloudCut(d, nearestCloudCutter(p, sphere), weight);
    }

    return vec2(d, heightHint);
  }

  // Tetrahedral 4-tap analytical SDF normal (exact 3D curved surface normal -> silky smooth cream lighting).
  vec3 calcNormal(vec3 p, int activeMask, float detailScale) {
    const float h = .36;
    const vec2 k = vec2(1., -1.);
    return normalize(
      k.xyy * mapCloud(p + k.xyy * h, activeMask, detailScale, true).x +
      k.yyx * mapCloud(p + k.yyx * h, activeMask, detailScale, true).x +
      k.yxy * mapCloud(p + k.yxy * h, activeMask, detailScale, true).x +
      k.xxx * mapCloud(p + k.xxx * h, activeMask, detailScale, true).x
    );
  }

  // Soft SDF self-shadowing along artistic raking sun direction (runs ONCE at hit surface!).
  float calcSoftShadow(vec3 ro, vec3 lightDir, int activeMask) {
    float res = 1.;
    float t = 1.6;
    for (int i = 0; i < 4; i++) {
      if (i >= shadowSteps) break;
      float d = mapCloud(ro + lightDir * t, activeMask, 0., true).x;
      res = min(res, clamp(1.10 * d / t + .10, 0., 1.));
      t += clamp(d, 2.0, 7.0);
      if (res < .05) break;
    }
    return smoothstep(0., 1., res);
  }

  // Ray-sphere intersection returning vec2(tEnter, tExit); tEnter > tExit means miss.
  vec2 intersectSphere(vec3 ro, vec3 rd, vec4 sph) {
    vec3 oc = ro - sph.xyz;
    float b = dot(oc, rd);
    float c = dot(oc, oc) - sph.w * sph.w;
    float h = b * b - c;
    if (h < 0.) return vec2(1e5, -1e5);
    h = sqrt(h);
    return vec2(-b - h, -b + h);
  }

  void main() {
    float depth = texture2D(worldDepth, vUv).r;
    vec4 viewPoint = inverseProjection * vec4(vUv * 2. - 1., depth * 2. - 1., 1.);
    vec3 toSurface = (cameraWorld * vec4(viewPoint.xyz / viewPoint.w, 0.)).xyz;
    float surface = length(toSurface);
    vec3 ray = toSurface / surface;
    vec3 eye = cameraWorld[3].xyz;
    float maxDist = min(surface, 235.);

    // 1. Intersect ray with active cluster bounding spheres -> 0 SDF evaluations in sunny clear sky!
    int activeMask = 0;
    float tStart = 1e5;
    float tEnd = 0.;
    for (int c = 0; c < ${MAX_CLOUD_CLUSTERS}; c++) {
      if (c >= clusterCount) break;
      vec2 hit = intersectSphere(eye, ray, clusterBounds[c]);
      if (hit.y > 0. && hit.x < maxDist) {
        activeMask |= (1 << c);
        tStart = min(tStart, max(2.2, hit.x));
        tEnd = max(tEnd, min(maxDist, hit.y));
      }
    }

    if (activeMask == 0 || tEnd <= tStart) {
      cloudColor = vec4(0.);
      return;
    }

    // 2. Sphere Tracing to exact smooth 3D cloud surface (ZERO horizontal slicing!).
    float t = tStart;
    bool hitSurface = false;
    float hitHeight = .5;
    float minSigned = 1e4;
    float closestT = tStart;
    float insideDepth = 0.;

    for (int i = 0; i < 40; i++) {
      if (i >= maxSteps || t >= tEnd) break;
      vec3 pos = eye + ray * t;
      vec2 res = mapCloud(pos, activeMask, detailStrength * .90, true);
      float d = res.x;
      if (d < minSigned) {
        minSigned = d;
        closestT = t;
        hitHeight = res.y;
      }
      if (d < .08) {
        if (i == 0 && d < -.15) {
          // Ray starts inside cloud: track soft interior veil rather than hard wall face.
          insideDepth = clamp(-d * .085, 0., .65);
        }
        hitSurface = true;
        hitHeight = res.y;
        break;
      }
      // Conservative Lipschitz step (0.62) guarantees zero overshoot over billowing cauliflower domes.
      t += max(d * .62, .28);
    }

    // Soft wispy halo for near-miss grazing rays so silhouettes feel airy rather than hard plastic.
    if (!hitSurface) {
      if (minSigned < 1.55) {
        float wisp = pow(1. - clamp(minSigned / 1.55, 0., 1.), 2.2);
        float softDepth = smoothstep(0., 5.0, surface - closestT);
        float alpha = wisp * .30 * softDepth;
        vec3 wispCol = mix(cloudShadow * .86, cloudLit * .96, .58 + .32 * hitHeight);
        cloudColor = vec4(wispCol * alpha * .5, alpha);
      } else {
        cloudColor = vec4(0.);
      }
      return;
    }

    // 3. Sky: Children of the Light (Daylight Prairie) Whipped-Cream Volumetric Surface Shading!
    // Tilt cloud shading sun lower along the exact same horizontal azimuth so top-down domes show
    // unmistakable 3D sunlit-cream vs. pastel periwinkle-blue volume instead of flat overhead white.
    vec3 lightDir = normalize(vec3(sunDirection.x * 1.55, sunDirection.y * .52, sunDirection.z * 1.55));
    vec3 hitPos = eye + ray * t;
    float detailLod = detailStrength * (1. - smoothstep(115., 220., t));
    vec3 N = calcNormal(hitPos, activeMask, detailLod);
    vec3 V = -ray;
    float NdotV = clamp(dot(N, V), 0., 1.);
    float NdotL = dot(N, lightDir);

    // Painterly velvet diffuse + soft SDF self-shadowing (calibrated for ACES exposure 1.25).
    float halfLambert = NdotL * .5 + .5;
    float diffuse = smoothstep(.24, .86, halfLambert);
    float shadow = calcSoftShadow(hitPos + N * .65, lightDir, activeMask);

    // 2-tap SDF Ambient Occlusion + cauliflower valley darkening -> signature pastel sky-blue folds!
    float ao1 = clamp(mapCloud(hitPos + N * 1.5, activeMask, detailLod * .5, true).x / 1.5, 0., 1.);
    float ao2 = clamp(mapCloud(hitPos + N * 4.4, activeMask, 0., true).x / 4.4, 0., 1.);
    float puffVal = billowSurface(hitPos, detailLod);
    float puffCrease = smoothstep(-2.6, 2.2, puffVal);
    float ao = clamp((.18 + .82 * (ao1 * .55 + ao2 * .45)) * mix(.72, 1.05, puffCrease), .16, 1.);

    // Subsurface scattering (SSS): thin cloud lips & sun-grazing puffs glow with warm sunlit translucency.
    float backProbe = mapCloud(hitPos + lightDir * 3.5, activeMask, 0., true).x;
    float thickness = smoothstep(-5.0, 1.4, backProbe);
    float forwardScatter = pow(max(0., dot(ray, lightDir)), 3.2);
    float sss = clamp((thickness * .55 + forwardScatter * .45) * (.30 + .70 * hitHeight), 0., 1.0);

    // Three-band Daylight Prairie palette calibrated for ACESFilmic @ exposure 1.25 (zero flat-white clip!):
    // - Deep lobe crevices & undersides: rich pastel sky-blue / periwinkle
    // - Shaded flanks & curving mid-tones: soft sky-lavender to warm milky pearl
    // - Sunlit crowns: luminous whipped-cream white peaking gently above 1.0 for subtle Bloom halo
    vec3 deepShadow = cloudShadow * .50;
    vec3 shadedFlank = mix(deepShadow, cloudShadow * .88, smoothstep(.10, .92, hitHeight) * (.35 + .65 * ao));
    vec3 midPearl = mix(cloudShadow * .88, cloudLit * .86, .56);
    vec3 sunlitCream = cloudLit * (.90 + .22 * smoothstep(.28, .96, hitHeight) * smoothstep(.25, .85, puffCrease));

    float directLight = clamp(diffuse * mix(.22, 1., shadow) * mix(.52, 1.06, ao), 0., 1.);
    vec3 col = mix(shadedFlank, midPearl, smoothstep(.04, .52, directLight));
    col = mix(col, sunlitCream, smoothstep(.42, .94, directLight));

    // Subtle warm sunlit SSS translucency + luminous grazing rim ONLY on sunlit crests/edges.
    float fresnel = pow(1. - NdotV, 2.4);
    float rimMask = smoothstep(.18, .90, halfLambert) * mix(.35, 1., shadow);
    col += cloudRim * (sss * .16 * (.35 + .65 * directLight) + fresnel * .20 * rimMask);

    // Very soft aerial blend only at the far top edge of the top-down view.
    float aerial = smoothstep(135., 235., t) * .24;
    col = mix(col, distanceColor, aerial);

    // Soft grazing edge alpha & smooth depth fusion against terrain/water (eliminates hard clipping!).
    float grazingSoft = smoothstep(.02, .32, NdotV);
    float terrainBlend = smoothstep(0., 3.8, surface - t);
    float alpha = clamp(mix(.76, 1., grazingSoft) * terrainBlend, 0., 1.);
    if (insideDepth > 0.) {
      // Soft translucent mist when camera grazes inside a tall spire.
      alpha = mix(alpha, .52 + insideDepth * .32, smoothstep(0., .25, insideDepth));
      col = mix(col, mix(cloudShadow * .85, cloudLit * .92, .65), insideDepth * .50);
    }

    // Premultiplied radiance packed with 0.5 headroom for HDR highlights & Kawase Bloom.
    cloudColor = vec4(col * alpha * .5, alpha);
  }
`;

// Fast analytical SDF cloud shadow pass matching the active metaball clusters 1:1.
const cloudShadowFragment = `
  precision highp float;
  uniform vec4 clusterBounds[${MAX_CLOUD_CLUSTERS}];
  uniform vec2 clusterRange[${MAX_CLOUD_CLUSTERS}];
  uniform int clusterCount;
  uniform vec4 lobePosRad[${MAX_RASTER_LOBES}];
  uniform vec4 lobeMeta[${MAX_RASTER_LOBES}];
  uniform vec3 sunDirection;
  uniform vec2 cloudShadowCenter;
  varying vec2 vUv;
  out vec4 shadowColor;

  float smin(float a, float b, float k) {
    float h = clamp(.5 + .5 * (b - a) / k, 0., 1.);
    return mix(b, a, h) - k * h * (1. - h);
  }

  float evalShadowSdf(vec3 p) {
    float d = 1e4;
    for (int c = 0; c < ${MAX_CLOUD_CLUSTERS}; c++) {
      if (c >= clusterCount) break;
      vec4 cb = clusterBounds[c];
      if (length(p - cb.xyz) - cb.w > 6.) continue;
      int start = int(clusterRange[c].x);
      int count = int(clusterRange[c].y);
      float groupD = 1e4;
      for (int j = 0; j < ${MAX_RASTER_GROUP_LOBES}; j++) {
        if (j >= count) break;
        int idx = start + j;
        vec4 lr = lobePosRad[idx];
        vec4 lm = lobeMeta[idx];
        vec3 q = p - lr.xyz;
        float sd = (length(vec3(q.x, q.y / lm.x, q.z)) - lr.w) * lm.x;
        groupD = j == 0 ? sd : smin(groupD, sd, lm.y);
      }
      d = min(d, groupD);
    }
    return d;
  }

  void main() {
    vec2 receiver = cloudShadowCenter + (vUv - .5) * ${shadowSpan}.;
    vec2 solarSlope = sunDirection.xz / max(.17, sunDirection.y);
    // Sample 4 representative cloud heights along the sun ray -> crisp, soft-edged prairie shadows.
    float occLow = 0.;
    float occHigh = 0.;
    for (int i = 0; i < 4; i++) {
      float height = 22.0 + float(i) * 9.5;
      vec3 p = vec3(receiver.x + solarSlope.x * height, height, receiver.y + solarSlope.y * height);
      float sd = evalShadowSdf(p);
      float cov = 1. - smoothstep(-3.5, 4.5, sd);
      occLow += cov * .34;
      occHigh += cov * smoothstep(20., 34., height) * .34;
    }
    vec2 sunlight = exp(-vec2(occLow, occHigh) * 1.15);
    shadowColor = vec4(sunlight, 0., 1.);
  }
`;

// Lightweight Kawase Bloom extract (1/2-res): combines world + clouds and softly isolates bright sunlit peaks.
const bloomExtractFragment = `
  uniform sampler2D worldColor, clouds;
  uniform vec2 texelSize;
  uniform bool cloudsEnabled;
  varying vec2 vUv;

  vec3 sampleCombined(vec2 uv) {
    vec3 w = texture2D(worldColor, uv).rgb;
    if (!cloudsEnabled) return w;
    vec4 c = texture2D(clouds, uv);
    return w * (1. - c.a) + c.rgb * 2.;
  }

  void main() {
    vec2 o = texelSize * .5;
    vec3 c = (
      sampleCombined(vUv + vec2(-o.x, -o.y)) +
      sampleCombined(vUv + vec2(o.x, -o.y)) +
      sampleCombined(vUv + vec2(-o.x, o.y)) +
      sampleCombined(vUv + vec2(o.x, o.y))
    ) * .25;
    float lum = max(c.r, max(c.g, c.b));
    float threshold = 1.08;
    float knee = .34;
    float soft = clamp(lum - threshold + knee, 0., 2. * knee);
    soft = (soft * soft) / (4. * knee + .0001);
    float contrib = max(soft, lum - threshold) / max(lum, .0001);
    gl_FragColor = vec4(c * contrib, 1.);
  }
`;

// 4-tap dual Kawase blur pass used for both downsample and upsample bloom passes.
const bloomBlurFragment = `
  uniform sampler2D source;
  uniform vec2 texelSize;
  uniform float radius;
  varying vec2 vUv;

  void main() {
    vec2 o = texelSize * radius;
    vec3 sum = (
      texture2D(source, vUv + vec2(-o.x, -o.y)).rgb +
      texture2D(source, vUv + vec2(o.x, -o.y)).rgb +
      texture2D(source, vUv + vec2(-o.x, o.y)).rgb +
      texture2D(source, vUv + vec2(o.x, o.y)).rgb
    ) * .25;
    gl_FragColor = vec4(sum, 1.);
  }
`;

const compositeFragment = `
  #include <packing>
  uniform sampler2D worldColor, worldDepth, clouds, bloomTex;
  uniform vec2 cloudSize;
  uniform float cameraNear, cameraFar, bloomStrength, interiorMist;
  uniform vec3 mistTint;
  uniform bool enabled, fullResClouds;
  varying vec2 vUv;

  float linearDepth(vec2 uv) {
    return -perspectiveDepthToViewZ(texture2D(worldDepth, uv).r, cameraNear, cameraFar);
  }

  #ifndef NATIVE_CLOUD
  vec4 upsampleCloud() {
    if (fullResClouds) return texture2D(clouds, vUv);
    vec4 cloud = vec4(0.);
    vec2 point = vUv * cloudSize - .5;
    vec2 corner = floor(point);
    vec2 rawBlend = fract(point);
    vec2 blend = rawBlend * rawBlend * (3. - 2. * rawBlend);
    float depth = linearDepth(vUv);
    float total = 0.;
    for (int y = 0; y < 2; y++) {
      for (int x = 0; x < 2; x++) {
        vec2 offset = vec2(float(x), float(y));
        vec2 weight = mix(1. - blend, blend, offset);
        vec2 tap = clamp(corner + offset, vec2(0.), cloudSize - 1.);
        vec2 uv = (tap + .5) / cloudSize;
        float difference = abs(linearDepth(uv) - depth);
        float matchDepth = 1. - smoothstep(.8 + depth * .018, 3. + depth * .06, difference);
        float w = weight.x * weight.y * matchDepth;
        cloud += texture2D(clouds, uv) * w;
        total += w;
      }
    }
    return total > .001 ? cloud / total : texture2D(clouds, vUv);
  }
  #endif

  void main() {
    vec3 world = texture2D(worldColor, vUv).rgb;
    vec4 cloud = vec4(0.);
    if (enabled) {
      #ifdef NATIVE_CLOUD
      cloud = texture2D(clouds, vUv);
      #else
      cloud = upsampleCloud();
      #endif
    }
    vec3 color = world * (1. - cloud.a) + cloud.rgb * 2.;
    if (interiorMist > .001) {
      float worldDistance = -perspectiveDepthToViewZ(texture2D(worldDepth, vUv).r, cameraNear, cameraFar);
      color = mix(color, mistTint, interiorMist * smoothstep(1.5, 33., worldDistance));
    }
    if (bloomStrength > 0.) {
      color += texture2D(bloomTex, vUv).rgb * bloomStrength;
    }
    gl_FragColor = vec4(color, 1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class Cloudscape {
  private readonly seed: number;
  private readonly billowData: Uint8Array;
  private readonly billowTexture: THREE.Data3DTexture;
  private readonly drift = new THREE.Vector2();
  private readonly contactDensityAt = (x: number, y: number, z: number) => this.density(x, y, z);
  private readonly world: THREE.WebGLRenderTarget;
  private readonly buffer = new THREE.WebGLRenderTarget(1, 1, {
    depthBuffer: false,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
  });
  private readonly meshBuffer = new THREE.WebGLRenderTarget(1, 1, {
    depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedIntType),
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
  });
  private readonly meshRenderer: CloudMeshRenderer;
  private mode: CloudRenderMode = "mesh";
  private readonly bloomA: THREE.WebGLRenderTarget;
  private readonly bloomB: THREE.WebGLRenderTarget;
  private readonly camera = new THREE.Camera();
  private readonly geometry = new THREE.PlaneGeometry(2, 2);
  private readonly marchScene = new THREE.Scene();
  private readonly shadowScene = new THREE.Scene();
  private readonly bloomExtractScene = new THREE.Scene();
  private readonly bloomBlurScene = new THREE.Scene();
  private readonly compositeScene = new THREE.Scene();
  private readonly march: THREE.ShaderMaterial;
  private readonly shadowPass: THREE.ShaderMaterial;
  private readonly bloomExtract: THREE.ShaderMaterial;
  private readonly bloomBlur: THREE.ShaderMaterial;
  private readonly shadowMap = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
  private shadowMorphTime = Number.NEGATIVE_INFINITY;
  private shadowStrength = .72;
  private readonly shadowDrift = new THREE.Vector2();
  private readonly composite: THREE.ShaderMaterial;

  private readonly clusterBounds = Array.from({ length: MAX_CLOUD_CLUSTERS }, () => new THREE.Vector4());
  private readonly clusterRange = Array.from({ length: MAX_CLOUD_CLUSTERS }, () => new THREE.Vector2());
  private readonly lobePosRad = Array.from({ length: MAX_RASTER_LOBES }, () => new THREE.Vector4());
  private readonly lobeMeta = Array.from({ length: MAX_RASTER_LOBES }, () => new THREE.Vector4());
  private activeField: ActiveCloudField;

  readonly shadowUniforms;
  width = 1;
  height = 1;
  cameraDensity = 0;
  playerDensity = 0;
  private enabled = true;
  private selfTime = 0;
  private velocity = { x: 0, z: 0 };
  private selfMorphSpeed = cloudSelfMorphSpeed(0, 0, 0);
  private selfStrength = .72;

  constructor(renderer: THREE.WebGLRenderer, seed: number, catalog = new ContentCatalog()) {
    this.seed = seed;
    const hdrType = renderer.extensions.has("EXT_color_buffer_float") ? THREE.HalfFloatType : THREE.UnsignedByteType;
    // Keep layout helpers exercised/warmed cleanly for compatibility while using 32^3 RGBA billow texture.
    void bakeCloudMap;
    void bakeCloudNoise;

    this.billowData = bakeBillowNoise(seed);
    this.billowTexture = new THREE.Data3DTexture(this.billowData, cloudNoiseSize, cloudNoiseSize, cloudNoiseSize);
    this.billowTexture.format = THREE.RGBAFormat;
    this.billowTexture.minFilter = this.billowTexture.magFilter = THREE.LinearFilter;
    this.billowTexture.wrapR = this.billowTexture.wrapS = this.billowTexture.wrapT = THREE.RepeatWrapping;
    this.billowTexture.needsUpdate = true;

    this.activeField = evaluateActiveClouds(0, 0, 0, 0, 0, 0, seed, true);

    this.shadowUniforms = {
      cloudShadowMap: { value: this.shadowMap.texture },
      cloudShadowCenter: { value: new THREE.Vector2() },
      cloudShadowStrength: { value: .72 },
      cloudShadowSun: { value: new THREE.Vector3(...cloudSun).normalize() },
    };
    this.world = new THREE.WebGLRenderTarget(1, 1, {
      type: hdrType,
      depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedIntType),
    });
    this.meshRenderer = new CloudMeshRenderer(catalog, seed, this.world.depthTexture!, this.billowTexture, this.lobePosRad, this.lobeMeta);
    this.bloomA = new THREE.WebGLRenderTarget(1, 1, {
      type: hdrType,
      depthBuffer: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });
    this.bloomB = new THREE.WebGLRenderTarget(1, 1, {
      type: hdrType,
      depthBuffer: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });

    this.march = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        worldDepth: { value: this.world.depthTexture },
        billowNoise: { value: this.billowTexture },
        inverseProjection: { value: new THREE.Matrix4() },
        cameraWorld: { value: new THREE.Matrix4() },
        clusterBounds: { value: this.clusterBounds },
        clusterRange: { value: this.clusterRange },
        clusterCount: { value: 0 },
        lobePosRad: { value: this.lobePosRad },
        lobeMeta: { value: this.lobeMeta },
        drift: { value: this.drift },
        selfTime: { value: 0 },
        selfStrength: { value: this.selfStrength },
        detailStrength: { value: .72 },
        wakeCount: { value: 0 },
        wakeMin: { value: this.meshRenderer.wake.bounds.min },
        wakeMax: { value: this.meshRenderer.wake.bounds.max },
        wakeStart: { value: this.meshRenderer.wake.starts },
        wakeEnd: { value: this.meshRenderer.wake.ends },
        cutters: { value: this.meshRenderer.wake.cuts },
        cutMin: { value: this.meshRenderer.wake.cutBounds.min },
        cutMax: { value: this.meshRenderer.wake.cutBounds.max },
        cutCount: { value: 0 },
        maxSteps: { value: 26 },
        shadowSteps: { value: 3 },
        sunDirection: { value: new THREE.Vector3(...cloudSun).normalize() },
        distanceColor: { value: new THREE.Color("#dff5f0") },
        cloudLit: { value: new THREE.Color("#fffbf0") },
        cloudShadow: { value: new THREE.Color("#79ace3") },
        cloudRim: { value: new THREE.Color("#ffe9b8") },
      },
      vertexShader: quadVertex,
      fragmentShader: cloudFragment,
      depthTest: false,
      depthWrite: false,
    });
    this.shadowPass = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        clusterBounds: { value: this.clusterBounds },
        clusterRange: { value: this.clusterRange },
        clusterCount: this.march.uniforms.clusterCount,
        lobePosRad: { value: this.lobePosRad },
        lobeMeta: { value: this.lobeMeta },
        sunDirection: this.march.uniforms.sunDirection,
        cloudShadowCenter: this.shadowUniforms.cloudShadowCenter,
      },
      vertexShader: quadVertex,
      fragmentShader: cloudShadowFragment,
      depthTest: false,
      depthWrite: false,
    });
    this.bloomExtract = new THREE.ShaderMaterial({
      uniforms: {
        worldColor: { value: this.world.texture },
        clouds: { value: this.buffer.texture },
        texelSize: { value: new THREE.Vector2(1, 1) },
        cloudsEnabled: { value: true },
      },
      vertexShader: quadVertex,
      fragmentShader: bloomExtractFragment,
      depthTest: false,
      depthWrite: false,
    });
    this.bloomBlur = new THREE.ShaderMaterial({
      uniforms: {
        source: { value: this.bloomA.texture },
        texelSize: { value: new THREE.Vector2(1, 1) },
        radius: { value: 1 },
      },
      vertexShader: quadVertex,
      fragmentShader: bloomBlurFragment,
      depthTest: false,
      depthWrite: false,
    });
    this.composite = new THREE.ShaderMaterial({
      defines: { NATIVE_CLOUD: 1 },
      uniforms: {
        worldColor: { value: this.world.texture },
        worldDepth: { value: this.world.depthTexture },
        clouds: { value: this.buffer.texture },
        bloomTex: { value: this.bloomA.texture },
        cloudSize: { value: new THREE.Vector2(1, 1) },
        cameraNear: { value: 0 },
        cameraFar: { value: 0 },
        bloomStrength: { value: 0 },
        enabled: { value: true },
        fullResClouds: { value: false },
        interiorMist: { value: 0 },
        mistTint: { value: new THREE.Color("#edf5fb") },
      },
      vertexShader: quadVertex,
      fragmentShader: compositeFragment,
      depthTest: false,
      depthWrite: false,
    });

    this.uploadActiveField(this.activeField);

    const marchQuad = new THREE.Mesh(this.geometry, this.march);
    const compositeQuad = new THREE.Mesh(this.geometry, this.composite);
    const shadowQuad = new THREE.Mesh(this.geometry, this.shadowPass);
    const extractQuad = new THREE.Mesh(this.geometry, this.bloomExtract);
    const blurQuad = new THREE.Mesh(this.geometry, this.bloomBlur);
    marchQuad.frustumCulled = compositeQuad.frustumCulled = shadowQuad.frustumCulled =
      extractQuad.frustumCulled = blurQuad.frustumCulled = false;
    this.marchScene.add(marchQuad);
    this.compositeScene.add(compositeQuad);
    this.shadowScene.add(shadowQuad);
    this.bloomExtractScene.add(extractQuad);
    this.bloomBlurScene.add(blurQuad);
  }

  private uploadActiveField(field: ActiveCloudField) {
    this.march.uniforms.clusterCount.value = field.clusters.length;
    for (let i = 0; i < field.clusters.length; i++) {
      const c = field.clusters[i];
      this.clusterBounds[i].set(c.cx, c.cy, c.cz, c.radius);
      this.clusterRange[i].set(c.start, c.count);
    }
    for (let i = 0; i < field.lobes.length; i++) {
      const l = field.lobes[i];
      this.lobePosRad[i].set(l.x, l.y, l.z, l.radius);
      this.lobeMeta[i].set(l.yScale, l.blend, l.phase, l.crownBias);
    }
  }

  setMode(mode: CloudRenderMode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.composite.defines = mode === "mesh" ? { NATIVE_CLOUD: 1 } : {};
    this.composite.needsUpdate = true;
    this.shadowMorphTime = Number.NEGATIVE_INFINITY;
    this.resetWake();
  }

  get renderMode(): CloudRenderMode {
    return this.mode;
  }

  setPalette(colors: Pick<EraColors, "cloudLit" | "cloudShadow" | "cloudRim" | "skyHorizon" | "valleyFog">) {
    this.march.uniforms.cloudLit.value.set(colors.cloudLit);
    this.march.uniforms.cloudShadow.value.set(colors.cloudShadow);
    this.march.uniforms.cloudRim.value.set(colors.cloudRim);
    this.march.uniforms.distanceColor.value.set(colors.skyHorizon);
    this.meshRenderer.setPalette(colors);
    this.composite.uniforms.mistTint.value.set(colors.cloudLit).lerp(new THREE.Color(colors.cloudShadow), .24);
  }

  get palette(): CloudAtmospherePalette {
    return {
      cloudLit: `#${(this.march.uniforms.cloudLit.value as THREE.Color).getHexString()}`,
      cloudShadow: `#${(this.march.uniforms.cloudShadow.value as THREE.Color).getHexString()}`,
      cloudRim: `#${(this.march.uniforms.cloudRim.value as THREE.Color).getHexString()}`,
      skyHorizon: `#${(this.march.uniforms.distanceColor.value as THREE.Color).getHexString()}`,
      valleyFog: `#${(this.march.uniforms.distanceColor.value as THREE.Color).getHexString()}`,
    };
  }

  update(
    sceneDelta: number,
    windX: number,
    windZ: number,
    gust: number,
    camera: THREE.Vector3,
    playerX: number,
    playerY: number,
    playerZ: number,
    _playerVelocityX: number,
    _playerVelocityZ: number,
    enabled: boolean,
    coverage = 1,
  ) {
    this.enabled = enabled;
    this.velocity = cloudVelocity(windX, windZ, gust);
    this.drift.x += this.velocity.x * sceneDelta;
    this.drift.y += this.velocity.z * sceneDelta;
    this.selfMorphSpeed = smoothCloudFlow(
      this.selfMorphSpeed,
      cloudSelfMorphSpeed(windX, windZ, gust),
      sceneDelta,
    );
    this.selfStrength = smoothCloudFlow(
      this.selfStrength,
      THREE.MathUtils.clamp(.72 + Math.hypot(windX, windZ) * .38 + gust * .12, .72, 1.16),
      sceneDelta,
    );
    this.selfTime += sceneDelta * this.selfMorphSpeed;
    this.march.uniforms.selfTime.value = this.selfTime;
    this.march.uniforms.selfStrength.value = this.selfStrength;
    // Focus active clusters around the player and the forward top-down view center.
    const raster = this.mode === "mesh";
    this.activeField = evaluateActiveClouds(
      playerX,
      playerZ + 18,
      this.drift.x,
      this.drift.y,
      this.selfTime,
      raster ? 0 : this.selfStrength,
      this.seed,
      raster,
      coverage,
    );
    this.uploadActiveField(this.activeField);

    if (!enabled) this.shadowMorphTime = Number.NEGATIVE_INFINITY;
    this.cameraDensity = enabled ? this.density(camera.x, camera.y, camera.z) : 0;
    this.playerDensity = enabled ? this.density(playerX, playerY, playerZ) : 0;
    if (enabled && this.mode === "mesh") {
      this.meshRenderer.update(this.activeField, this.drift, this.selfTime, this.selfStrength, this.cameraDensity);
    }
  }

  setLighting(sun: THREE.Vector3, strength: number) {
    const light = this.shadowUniforms.cloudShadowSun.value;
    if (light.distanceToSquared(sun) >= .015 ** 2) {
      this.shadowMorphTime = Number.NEGATIVE_INFINITY;
      light.copy(sun);
    }
    this.march.uniforms.sunDirection.value.copy(sun);
    this.meshRenderer.setLight(sun);
    this.shadowStrength = strength * .72;
  }

  updateWake(delta: number, aircraft: ProceduralAircraft | undefined, others: Iterable<SceneActor>) {
    if (!this.enabled) {
      this.resetWake();
      return;
    }
    this.meshRenderer.wake.update(delta, this.drift, aircraft, others, this.contactDensityAt);
  }

  resetWake() {
    this.meshRenderer.wake.reset();
  }

  get meshStats() {
    return {
      groups: this.meshRenderer.groupCount,
      triangles: this.meshRenderer.triangleCount,
      wakeSegments: this.meshRenderer.wake.count,
    };
  }

  sampleDensityAt(x: number, y: number, z: number) {
    return this.density(x, y, z);
  }

  private density(x: number, y: number, z: number) {
    if (y <= cloudBase || y >= cloudTop) return 0;
    let sdf = evaluateCloudSdfCpu(this.activeField, x, y, z);
    if (this.mode === "mesh" && Math.abs(sdf) < 8) {
      // Flattened lobes use a conservative distance bound. Convert back to
      // world units so a thin shelf does not trigger contact out in clear air.
      const dx = evaluateCloudSdfCpu(this.activeField, x + .2, y, z) - sdf;
      const dy = evaluateCloudSdfCpu(this.activeField, x, y + .2, z) - sdf;
      const dz = evaluateCloudSdfCpu(this.activeField, x, y, z + .2) - sdf;
      const gradient = Math.max(.04, Math.hypot(dx, dy, dz));
      sdf *= .2 / gradient;
      const px = x - this.drift.x;
      const pz = z - this.drift.y;
      const shift = localBillowShift(px, y, pz, this.selfTime, this.selfStrength);
      const nx = (px + shift.dx) * .027 * cloudNoiseSize - .5;
      const ny = (y + shift.dy - this.selfTime * billowRiseRate) * .029 * cloudNoiseSize - .5;
      const nz = (pz + shift.dz) * .027 * cloudNoiseSize - .5;
      const broad = sampleBillowNoise(this.billowData, nx, ny, nz, 0) - .5;
      const detail = sampleBillowNoise(this.billowData, nx, ny, nz, 1) - .5;
      const crown = THREE.MathUtils.lerp(.42, 1, THREE.MathUtils.smoothstep(dy / gradient, -.22, .86));
      sdf -= (broad * 11 + detail * 2.6) * this.selfStrength * crown;
      sdf -= (shift.dx * dx + shift.dy * dy + shift.dz * dz) / gradient * .29;
    }
    return sdfToDensity(sdf);
  }

  get flow() {
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    return {
      x: speed > 0 ? this.velocity.x / speed : 0,
      z: speed > 0 ? this.velocity.z / speed : 0,
      speed,
      drift: this.drift.toArray(),
      selfTime: this.selfTime,
    };
  }

  occludes(camera: THREE.Vector3, target: THREE.Vector3) {
    if (!this.enabled) return false;
    const dx = target.x - camera.x, dy = target.y - camera.y, dz = target.z - camera.z;
    const distance = Math.hypot(dx, dy, dz);
    let opticalDepth = 0;
    for (let i = 0; i < 12; i++) {
      const t = (i + .5) / 12;
      opticalDepth += this.density(camera.x + dx * t, camera.y + dy * t, camera.z + dz * t) * distance / 12;
      if (opticalDepth > 13) return true;
    }
    return false;
  }

  begin(renderer: THREE.WebGLRenderer, camera: THREE.Camera, quality: Quality, shadows = true) {
    const castShadows = this.enabled && shadows && this.shadowStrength > 0;
    this.shadowUniforms.cloudShadowStrength.value = castShadows ? this.shadowStrength : 0;
    if (castShadows) {
      const size = quality === "high" ? 192 : quality === "standard" ? 160 : 96;
      const texel = shadowSpan / size;
      const x = Math.round(camera.position.x / texel) * texel;
      const z = Math.round(camera.position.z / texel) * texel;
      const center = this.shadowUniforms.cloudShadowCenter.value;
      if (this.shadowMap.width !== size || center.x !== x || center.y !== z ||
        this.selfTime - this.shadowMorphTime >= .25 ||
        this.shadowDrift.distanceToSquared(this.drift) >= .18 ** 2) {
        this.shadowMap.setSize(size, size);
        center.set(x, z);
        this.shadowMorphTime = this.selfTime;
        this.shadowDrift.copy(this.drift);
        renderer.setRenderTarget(this.shadowMap);
        renderer.render(this.shadowScene, this.camera);
      }
    }
    const { width, height } = renderer.domElement;
    this.world.setSize(width, height);
    renderer.setRenderTarget(this.world);
  }

  renderClouds(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera, quality: Quality) {
    const budget = QUALITIES[quality].cloud;
    if (this.mode === "mesh") {
      // Route B: 100% native world resolution hardware-rasterized sculpted cloud meshes.
      this.width = this.world.width;
      this.height = this.world.height;
      this.meshBuffer.setSize(this.width, this.height);
      this.meshRenderer.render(renderer, camera, this.meshBuffer, budget.detail);
      return;
    }
    // Route A: Analytical smooth-min metaball SDF sphere tracing.
    this.width = Math.max(1, Math.round(this.world.width * budget.resolution));
    this.height = Math.max(1, Math.round(this.world.height * budget.resolution));
    this.buffer.setSize(this.width, this.height);
    const { uniforms } = this.march;
    uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);
    uniforms.cameraWorld.value.copy(camera.matrixWorld);
    uniforms.wakeCount.value = this.meshRenderer.wake.count;
    uniforms.cutCount.value = this.meshRenderer.wake.cutCount;
    uniforms.maxSteps.value = this.sdfSteps(quality);
    uniforms.shadowSteps.value = quality === "high" ? 4 : quality === "standard" ? 3 : 2;
    uniforms.detailStrength.value = budget.detail;
    renderer.setRenderTarget(this.buffer);
    renderer.render(this.marchScene, this.camera);
  }

  sdfSteps(quality: Quality) {
    return quality === "high" ? 40 : quality === "standard" ? 32 : 22;
  }

  compositeWorld(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera, quality: Quality = "standard") {
    const activeCloudTexture = this.mode === "mesh" ? this.meshBuffer.texture : this.buffer.texture;
    const bloomStrength = this.mode === "sdf" ? (quality === "high" ? .15 : quality === "standard" ? .10 : 0) : 0;
    if (bloomStrength > 0) {
      const halfW = Math.max(1, Math.round(this.world.width * .5));
      const halfH = Math.max(1, Math.round(this.world.height * .5));
      const quarterW = Math.max(1, Math.round(halfW * .5));
      const quarterH = Math.max(1, Math.round(halfH * .5));
      this.bloomA.setSize(halfW, halfH);
      this.bloomB.setSize(quarterW, quarterH);

      this.bloomExtract.uniforms.clouds.value = activeCloudTexture;
      this.bloomExtract.uniforms.texelSize.value.set(1 / this.world.width, 1 / this.world.height);
      this.bloomExtract.uniforms.cloudsEnabled.value = this.enabled;
      renderer.setRenderTarget(this.bloomA);
      renderer.render(this.bloomExtractScene, this.camera);

      this.bloomBlur.uniforms.source.value = this.bloomA.texture;
      this.bloomBlur.uniforms.texelSize.value.set(1 / halfW, 1 / halfH);
      this.bloomBlur.uniforms.radius.value = 1.25;
      renderer.setRenderTarget(this.bloomB);
      renderer.render(this.bloomBlurScene, this.camera);

      this.bloomBlur.uniforms.source.value = this.bloomB.texture;
      this.bloomBlur.uniforms.texelSize.value.set(1 / quarterW, 1 / quarterH);
      this.bloomBlur.uniforms.radius.value = 1.85;
      renderer.setRenderTarget(this.bloomA);
      renderer.render(this.bloomBlurScene, this.camera);
    }

    const { uniforms } = this.composite;
    uniforms.clouds.value = activeCloudTexture;
    uniforms.cloudSize.value.set(this.width, this.height);
    uniforms.cameraNear.value = camera.near;
    uniforms.cameraFar.value = camera.far;
    uniforms.bloomStrength.value = bloomStrength;
    uniforms.enabled.value = this.enabled;
    uniforms.interiorMist.value = this.mode === "mesh" && this.enabled ? this.cameraDensity * .32 : 0;
    uniforms.fullResClouds.value = this.mode === "mesh" || (this.width === this.world.width && this.height === this.world.height);
    renderer.setRenderTarget(null);
    renderer.render(this.compositeScene, this.camera);
  }

  dispose() {
    this.billowTexture.dispose();
    this.world.dispose();
    this.buffer.dispose();
    this.meshBuffer.dispose();
    this.meshRenderer.dispose();
    this.bloomA.dispose();
    this.bloomB.dispose();
    this.shadowMap.dispose();
    this.geometry.dispose();
    this.march.dispose();
    this.shadowPass.dispose();
    this.bloomExtract.dispose();
    this.bloomBlur.dispose();
    this.composite.dispose();
  }
}
