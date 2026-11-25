import * as THREE from "three";
import { QUALITIES, type Quality } from "../data/config";
import type { EraColors } from "../data/eras";
import {
  bakeBillowNoise, bakeCloudMap, bakeCloudNoise, cloudBase, cloudMapSize, cloudMapSpan,
  cloudNoiseSize, cloudSun, cloudTop, estimateCloudDensity,
} from "./CloudscapeLayout";
import { bakeCloudWall, cloudWall, cloudWallWeight, sampleCloudWall } from "./CloudWall";
import {
  billowRiseRate, cloudBillowOffset, cloudFlowGLSL, cloudMorph, cloudSelfMorphSpeed,
  cloudVelocity, distantCoverageMorph, distantRoofMorph, distantVerticalMorph,
  morphWallDensity, smoothCloudFlow,
} from "./CloudFlow";

const shadowSpan = 352;
// Leave a wide sunny view of the estuary while keeping the flanking cloud walls towering and crisp.
const estuaryOpening = { centerX: -8, inner: 16, outer: 36, centerZ: -13, length: 37, fade: 70, clearance: .94 };

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

const cloudSampling = `
  precision highp sampler3D;
  uniform sampler2D columns;
  uniform sampler3D billowNoise, wallVolume;
  uniform vec2 drift;
  uniform float detailStrength;
  uniform vec3 playerPosition, playerVelocity;
  uniform float playerRadius, wakeStrength;
  uniform vec3 sunDirection;

  ${cloudFlowGLSL}

  const vec3 wallMin = vec3(${cloudWall.min.map(value => value.toFixed(1)).join(", ")});
  const vec3 wallMax = vec3(${cloudWall.max.map(value => value.toFixed(1)).join(", ")});
`;

const cloudFragment = `
  ${cloudSampling}
  uniform sampler2D worldDepth;
  uniform mat4 inverseProjection, cameraWorld;
  uniform int sampleCount;
  uniform vec3 distanceColor, cloudLit, cloudShadow, cloudRim;
  varying vec2 vUv;
  out vec4 cloudColor;

  // Deterministic per-pixel Interleaved Gradient Noise (static when paused, eliminates raymarch slicing).
  float ign(vec2 pixel) {
    return fract(52.9829189 * fract(dot(pixel, vec2(.06711056, .00583715))));
  }

  // Returns vec4(density, heightFrac, directSun, cavityRim).
  // Strict 2D early-out guarantees 0 3D texture taps in sunny clear sky between cloud groups.
  vec4 sampleCloudStep(vec3 at, float distance) {
    float interaction = 1.;
    float cavityRim = 0.;

    // Only pay player wake math when sample point is within local interaction radius.
    vec3 playerDelta = at - playerPosition;
    float playerDistSq = dot(playerDelta, playerDelta);
    if (playerDistSq < 340.) {
      vec2 playerVelocityXZ = playerVelocity.xz;
      float playerSpeed = length(playerVelocityXZ);
      vec2 playerDirection = playerSpeed > .01
        ? playerVelocityXZ / playerSpeed
        : vec2(.0, 1.0);
      float verticalInfluence = exp(-pow(playerDelta.y / max(playerRadius * 1.35, .001), 2.));
      vec2 playerOffset = playerDelta.xz;
      float bodyInfluence = exp(-dot(playerOffset, playerOffset) /
        max(playerRadius * playerRadius, .001)) * verticalInfluence;
      float alongWake = dot(playerOffset, playerDirection);
      vec2 sideOffset = playerOffset - playerDirection * alongWake;
      float wakeInfluence = exp(-dot(sideOffset, sideOffset) /
        max(playerRadius * playerRadius * 1.8, .001)) *
        exp(-max(alongWake, 0.) / max(playerRadius * 5.5, .001)) *
        smoothstep(-playerRadius * 1.2, playerRadius * 1.8, alongWake) *
        wakeStrength * smoothstep(.02, .6, playerSpeed);
      vec2 pushDirection = normalize(playerOffset + vec2(.0001));
      vec2 disturbance = pushDirection * bodyInfluence * playerRadius * .76 -
        playerDirection * wakeInfluence * playerRadius * .56;
      at.xz += disturbance;
      cavityRim = smoothstep(.05, .34, bodyInfluence) * (1. - smoothstep(.34, .82, bodyInfluence)) * verticalInfluence;
      interaction = clamp(1. - bodyInfluence * .98 - wakeInfluence * .44, .025, 1.);
    }

    // World-space estuary opening keeps the river mouth sunny and open.
    float across = 1. - smoothstep(${estuaryOpening.inner}., ${estuaryOpening.outer}., abs(at.x - (${estuaryOpening.centerX}.)));
    float along = 1. - smoothstep(${estuaryOpening.length}., ${estuaryOpening.fade}., abs(at.z - (${estuaryOpening.centerZ}.)));
    float openingMask = 1. - ${estuaryOpening.clearance} * across * along;
    if (openingMask <= .065) return vec4(0.);

    // Macro horizontal motion strictly follows WindField drift.
    vec3 advected = at - vec3(drift.x, 0., drift.y);

    // Check 1: local coastal wall bounding box.
    vec2 edge = min(advected.xz - wallMin.xz, wallMax.xz - advected.xz);
    float wallWeight = 0.;
    if (edge.x > 0. && edge.y > 0. && distance < ${cloudWall.detailDistance[1].toFixed(1)}) {
      vec2 fade = smoothstep(vec2(0.), vec2(${cloudWall.edgeFade.map(value => value.toFixed(1)).join(", ")}), edge);
      float wallLod = 1. - smoothstep(${cloudWall.detailDistance[0].toFixed(1)}, ${cloudWall.detailDistance[1].toFixed(1)}, distance);
      wallWeight = fade.x * fade.y * wallLod;
    }

    // Check 2: 2D grouped cloud column map (cheap 2D tap).
    vec2 cell = fract(advected.xz / ${cloudMapSpan.toFixed(1)} + .5);
    vec4 column = wallWeight < .995 ? texture2D(columns, cell) : vec4(0.);

    float floorY = mix(${cloudBase.toFixed(1)}, ${cloudTop.toFixed(1)}, column.r);
    float ceilingY = mix(${cloudBase.toFixed(1)}, ${cloudTop.toFixed(1)}, column.g);
    bool hasBank = wallWeight < .995 && column.b >= .22 && advected.y >= floorY - 3.5 && advected.y <= ceilingY + 11.5;

    // Early-out: sunny clear sky between cloud groups -> 0 3D texture taps!
    if (!hasBank && wallWeight <= 0.) return vec4(0.);

    // Zero-texture analytic slow local shift & morph phase.
    vec2 morph = analyticMorph(advected);
    vec3 shift = localBillowShift(advected);
    float detailLod = detailStrength * (1. - smoothstep(105., 210., distance));

    // Single rising 3D billowing texture tap + single sun-offset directional derivative tap.
    vec3 billowUv = vec3(
      advected.x + shift.x,
      (advected.y + shift.y - selfTime * ${billowRiseRate}) * 1.08,
      advected.z + shift.z
    ) * .031;
    vec3 billow = texture(billowNoise, billowUv).rgb;
    vec2 sunSample = texture(billowNoise, billowUv + sunDirection * .068).rg;
    float lobeRelief = ((billow.r - sunSample.r) * 1.15 + (billow.g - sunSample.g) * .48 * detailLod);

    float bankDensity = 0.;
    float bankHeight = 0.;
    float bankSun = 0.;
    if (hasBank) {
      float localFloor = floorY + morph.x * ${distantVerticalMorph};
      float erode = (billow.r - .50) * 7.8 + (billow.g - .46) * 3.1 * detailLod;
      float roof = ceilingY + erode + morph.x * ${distantVerticalMorph} + morph.y * ${distantRoofMorph};
      float span = max(roof - localFloor, 3.5);
      bankHeight = clamp((advected.y - localFloor) / span, 0., 1.);

      // Plump, solid cumulus silhouette with crisp billowing cauliflower domes on top.
      float bottomShelf = smoothstep(-1.8, 4.4, advected.y - localFloor);
      float topDome = 1. - smoothstep(.58, 1.0, bankHeight + (1. - billow.r) * .22);
      float coverage = smoothstep(.24, .56, column.b + (billow.r - .48) * .26 + morph.y * ${distantCoverageMorph});
      float edgeErode = (1. - billow.b) * (.18 + .20 * bankHeight) * detailLod;
      bankDensity = clamp((coverage * bottomShelf * topDome * mix(.85, 1.28, billow.r) - edgeErode) * 1.48, 0., 1.);

      // Macro sunlight + real-time 3D directional derivative relief + multi-scatter lift.
      float macroEnergy = max(column.a, .38 * sqrt(max(column.a, 0.)));
      bankSun = clamp(macroEnergy * (.42 + .58 * smoothstep(.04, .92, bankHeight)) + lobeRelief * .82 + (billow.r - .46) * .28, 0., 1.35);
    }

    float density = bankDensity;
    float heightFrac = bankHeight;
    float directSun = bankSun;

    if (wallWeight > 0.) {
      vec3 wallPos = advected + vec3(shift.x * .55, -morph.x * .65 + shift.y * .45, shift.z * .55);
      vec3 wallUv = clamp((wallPos - wallMin) / (wallMax - wallMin), 0., 1.);
      vec2 voxel = texture(wallVolume, wallUv).rg;
      float baseWall = morphWallDensity(voxel.r, morph.y);
      // Carve solid billowing cauliflower puffs directly into the towering coastal cloud wall.
      float edgeZone = smoothstep(0., .6, baseWall) * (1. - smoothstep(.65, 1., baseWall));
      float wallDensity = clamp(
        baseWall * 1.18 + (billow.r - .45) * .48 * edgeZone - (1. - billow.b) * .16 * edgeZone * detailLod,
        0., 1.
      );
      float wallHeight = clamp((advected.y - ${cloudBase.toFixed(1)}) / ${(cloudTop - cloudBase).toFixed(1)}, 0., 1.);
      float sunDepth = voxel.g * ${cloudWall.maxOpticalDepth.toFixed(1)};
      // Multi-scattering keeps thick cumulus undersides luminous pastel sky-blue instead of muddy dark gray.
      float wallBeer = exp(-sunDepth * 1.22);
      float wallMulti = .52 * exp(-sunDepth * .28);
      float wallSun = clamp(max(wallBeer, wallMulti) + lobeRelief * .76 + (billow.r - .46) * .22, 0., 1.35);

      density = mix(density, wallDensity, wallWeight);
      heightFrac = mix(heightFrac, wallHeight, wallWeight);
      directSun = mix(directSun, wallSun, wallWeight);
    }

    float baseBeforeRim = density * openingMask;
    float pushedDensity = clamp(baseBeforeRim * interaction + cavityRim * smoothstep(.04, .26, baseBeforeRim) * .32, 0., 1.);
    return vec4(pushedDensity, heightFrac, directSun, cavityRim);
  }

  void integrateCloud(vec3 eye, vec3 ray, float travel, float stepSize, float forwardGlow,
      inout float transmittance, inout vec3 scatter) {
    vec4 cloud = sampleCloudStep(eye + ray * travel, travel);
    float density = cloud.r;
    if (density < .006) return;

    float heightFrac = cloud.g;
    float directSun = cloud.b;
    float cavityRim = cloud.a;

    // Powder effect gives fluffy top-down cumulus puffs strong crease depth and sunny pop.
    float powder = 1. - .58 * exp(-density * 3.2);
    float litFactor = smoothstep(.08, .92, directSun * mix(1., powder, .55));

    // Daylight Prairie sunny cumulus colors: bright cream-white sunlit crowns & clear sky-blue shadows.
    vec3 deepShadow = cloudShadow * .76;
    vec3 midShadow = mix(cloudShadow, cloudLit, .32);
    vec3 shadowCol = mix(deepShadow, midShadow, smoothstep(.06, .92, heightFrac));
    vec3 sunlitCol = cloudLit * (1.38 + .26 * smoothstep(.2, .95, heightFrac));
    vec3 color = mix(shadowCol, sunlitCol, litFactor);

    // Sunlit silver/gold rim + wingtip cavity glow.
    float rim = forwardGlow * (1. - density * .6) * (.25 + .75 * litFactor);
    color += cloudRim * (rim * .72 + cavityRim * .35 * (.45 + .55 * litFactor));

    // Only apply very gentle aerial blend near the far top edge of the top-down view.
    float aerial = smoothstep(125., 225., travel) * .38;
    color = mix(color, distanceColor, aerial);

    // Higher extinction makes each cloud group feel thick, solid, and impactful rather than thin mist.
    float opacity = 1. - exp(-density * stepSize * .21);
    scatter += transmittance * opacity * color;
    transmittance *= 1. - opacity;
  }

  void main() {
    float depth = texture2D(worldDepth, vUv).r;
    vec4 viewPoint = inverseProjection * vec4(vUv * 2. - 1., depth * 2. - 1., 1.);
    vec3 toSurface = (cameraWorld * vec4(viewPoint.xyz / viewPoint.w, 0.)).xyz;
    float surface = length(toSurface);
    vec3 ray = toSurface / surface;
    vec3 eye = cameraWorld[3].xyz;
    float vertical = ray.y < 0. ? min(ray.y, -.0001) : max(ray.y, .0001);
    float bottom = (${cloudBase.toFixed(1)} - eye.y) / vertical;
    float top = (${cloudTop.toFixed(1)} - eye.y) / vertical;
    float start = max(0., min(bottom, top));
    // Tighten integration strictly to the visible top-down frustum depth (0 budget spent off-screen).
    float end = min(min(surface, 220.), max(bottom, top));
    if (end <= start) {
      cloudColor = vec4(0.);
      return;
    }

    vec3 fieldEye = eye - vec3(drift.x, 0., drift.y);
    vec3 safeRay = mix(vec3(-1.), vec3(1.), step(0., ray)) * max(abs(ray), .0001);
    vec3 toMin = (wallMin - fieldEye) / safeRay;
    vec3 toMax = (wallMax - fieldEye) / safeRay;
    vec3 enter = min(toMin, toMax), leave = max(toMin, toMax);
    float wallStart = max(start, max(enter.x, max(enter.y, enter.z)));
    float wallEnd = min(min(end, ${cloudWall.detailDistance[1].toFixed(1)}), min(leave.x, min(leave.y, leave.z)));

    float stride = (end - start) / float(sampleCount);
    float travel = start + ign(gl_FragCoord.xy) * stride;
    float transmittance = 1.;
    vec3 scatter = vec3(0.);
    float forwardGlow = pow(max(0., dot(ray, sunDirection)), 4.);

    for (int i = 0; i < 24; i++) {
      if (i >= sampleCount || transmittance < .02 || travel >= end) break;
      if (wallEnd > wallStart && travel < wallEnd && travel + stride > wallStart) {
        integrateCloud(eye, ray, travel + stride * .25, stride * .5, forwardGlow, transmittance, scatter);
        if (transmittance >= .02) {
          integrateCloud(eye, ray, travel + stride * .75, stride * .5, forwardGlow, transmittance, scatter);
        }
      } else {
        integrateCloud(eye, ray, travel, stride, forwardGlow, transmittance, scatter);
      }
      travel += stride;
    }
    // Pack radiance into an RGBA8 target with headroom for luminous sunny highlights.
    cloudColor = vec4(scatter * .5, 1. - transmittance);
  }
`;

// Fast macro cloud shadow pass: uses 6 vertical samples over 2D columns + local wall volume (zero 3D billow noise).
const cloudShadowFragment = `
  ${cloudSampling}
  uniform vec2 cloudShadowCenter;
  varying vec2 vUv;
  out vec4 shadowColor;

  float macroDensity(vec3 at) {
    float across = 1. - smoothstep(${estuaryOpening.inner}., ${estuaryOpening.outer}., abs(at.x - (${estuaryOpening.centerX}.)));
    float along = 1. - smoothstep(${estuaryOpening.length}., ${estuaryOpening.fade}., abs(at.z - (${estuaryOpening.centerZ}.)));
    float openingMask = 1. - ${estuaryOpening.clearance} * across * along;
    if (openingMask <= .065) return 0.;

    vec3 advected = at - vec3(drift.x, 0., drift.y);
    vec2 edge = min(advected.xz - wallMin.xz, wallMax.xz - advected.xz);
    float wallWeight = 0.;
    if (edge.x > 0. && edge.y > 0.) {
      vec2 fade = smoothstep(vec2(0.), vec2(${cloudWall.edgeFade.map(value => value.toFixed(1)).join(", ")}), edge);
      wallWeight = fade.x * fade.y;
    }

    float bank = 0.;
    if (wallWeight < .995) {
      vec2 cell = fract(advected.xz / ${cloudMapSpan.toFixed(1)} + .5);
      vec4 column = texture2D(columns, cell);
      if (column.b >= .22) {
        float floorY = mix(${cloudBase.toFixed(1)}, ${cloudTop.toFixed(1)}, column.r);
        float ceilingY = mix(${cloudBase.toFixed(1)}, ${cloudTop.toFixed(1)}, column.g);
        float verticalFade = smoothstep(-2., 5., advected.y - floorY) * (1. - smoothstep(-6., 2., advected.y - ceilingY));
        bank = smoothstep(.24, .58, column.b) * verticalFade;
      }
    }

    float density = bank;
    if (wallWeight > 0.) {
      vec3 wallUv = clamp((advected - wallMin) / (wallMax - wallMin), 0., 1.);
      density = mix(density, texture(wallVolume, wallUv).r, wallWeight);
    }
    return density * openingMask;
  }

  void main() {
    vec2 receiver = cloudShadowCenter + (vUv - .5) * ${shadowSpan}.;
    vec2 solarSlope = sunDirection.xz / sunDirection.y;
    const float stride = ${((cloudTop - cloudBase) / 6).toFixed(4)};
    vec2 depth = vec2(0.);
    for (int i = 0; i < 6; i++) {
      float height = ${cloudBase}. + (float(i) + .5) * stride;
      float density = macroDensity(vec3(receiver.x + solarSlope.x * height, height,
        receiver.y + solarSlope.y * height));
      depth += density * vec2(1., smoothstep(15., 28., height));
    }
    vec2 sunlight = exp(-depth * stride * .118 / sunDirection.y);
    shadowColor = vec4(sunlight, 0., 1.);
  }
`;

const compositeFragment = `
  #include <packing>
  uniform sampler2D worldColor, worldDepth, clouds;
  uniform vec2 cloudSize;
  uniform float cameraNear, cameraFar;
  uniform bool enabled;
  varying vec2 vUv;

  float linearDepth(vec2 uv) {
    return -perspectiveDepthToViewZ(texture2D(worldDepth, uv).r, cameraNear, cameraFar);
  }

  vec4 upsampleCloud() {
    vec4 cloud = vec4(0.);
    vec2 point = vUv * cloudSize - .5;
    vec2 corner = floor(point);
    vec2 blend = fract(point);
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

  void main() {
    vec3 world = texture2D(worldColor, vUv).rgb;
    vec4 cloud = enabled ? upsampleCloud() : vec4(0.);
    gl_FragColor = vec4(world * (1. - cloud.a) + cloud.rgb * 2., 1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export const cloudShadowGLSL = `
  uniform sampler2D cloudShadowMap;
  uniform vec2 cloudShadowCenter;
  uniform float cloudShadowStrength;

  float cloudLightAt(vec3 world) {
    const vec3 sun = vec3(${cloudSun.join(", ")});
    vec2 lightSpace = world.xz - sun.xz * (world.y / sun.y);
    vec2 fromCenter = (lightSpace - cloudShadowCenter) / ${shadowSpan}.;
    float edge = max(abs(fromCenter.x), abs(fromCenter.y));
    if (cloudShadowStrength <= 0. || edge >= .5) return 1.;
    vec2 sunlight = texture2D(cloudShadowMap, fromCenter + .5).rg;
    float groundLight = mix(sunlight.x, sunlight.y, smoothstep(12., 24., world.y));
    return 1. - (1. - groundLight) * cloudShadowStrength * (1. - smoothstep(.42, .5, edge));
  }
`;

export class Cloudscape {
  private readonly map: Uint8Array;
  private readonly columns: THREE.DataTexture;
  private readonly noise: Uint8Array;
  private readonly billowData: Uint8Array;
  private readonly billowTexture: THREE.Data3DTexture;
  private readonly wallData: Uint8Array;
  private readonly wallVolume: THREE.Data3DTexture;
  private readonly drift = new THREE.Vector2();
  private readonly world: THREE.WebGLRenderTarget;
  private readonly buffer = new THREE.WebGLRenderTarget(1, 1, {
    depthBuffer: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  });
  private readonly camera = new THREE.Camera();
  private readonly geometry = new THREE.PlaneGeometry(2, 2);
  private readonly marchScene = new THREE.Scene();
  private readonly shadowScene = new THREE.Scene();
  private readonly compositeScene = new THREE.Scene();
  private readonly march: THREE.ShaderMaterial;
  private readonly shadowPass: THREE.ShaderMaterial;
  private readonly shadowMap = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
  private shadowMorphTime = Number.NEGATIVE_INFINITY;
  private readonly shadowDrift = new THREE.Vector2();
  private readonly composite: THREE.ShaderMaterial;

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

  constructor(renderer: THREE.WebGLRenderer, seed: number) {
    this.map = bakeCloudMap(seed);
    this.columns = new THREE.DataTexture(this.map, cloudMapSize, cloudMapSize);
    this.columns.minFilter = this.columns.magFilter = THREE.LinearFilter;
    this.columns.wrapS = this.columns.wrapT = THREE.RepeatWrapping;
    this.columns.needsUpdate = true;

    this.noise = bakeCloudNoise(seed);

    this.billowData = bakeBillowNoise(seed);
    this.billowTexture = new THREE.Data3DTexture(this.billowData, cloudNoiseSize, cloudNoiseSize, cloudNoiseSize);
    this.billowTexture.format = THREE.RGBAFormat;
    this.billowTexture.minFilter = this.billowTexture.magFilter = THREE.LinearFilter;
    this.billowTexture.wrapR = this.billowTexture.wrapS = this.billowTexture.wrapT = THREE.RepeatWrapping;
    this.billowTexture.needsUpdate = true;

    this.wallData = bakeCloudWall(this.noise);
    this.wallVolume = new THREE.Data3DTexture(this.wallData, ...cloudWall.size);
    this.wallVolume.format = THREE.RGFormat;
    this.wallVolume.minFilter = this.wallVolume.magFilter = THREE.LinearFilter;
    this.wallVolume.needsUpdate = true;

    this.shadowUniforms = {
      cloudShadowMap: { value: this.shadowMap.texture },
      cloudShadowCenter: { value: new THREE.Vector2() },
      cloudShadowStrength: { value: .72 },
    };
    this.world = new THREE.WebGLRenderTarget(1, 1, {
      type: renderer.extensions.has("EXT_color_buffer_float") ? THREE.HalfFloatType : THREE.UnsignedByteType,
      depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedIntType),
    });
    this.march = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        columns: { value: this.columns },
        worldDepth: { value: this.world.depthTexture },
        billowNoise: { value: this.billowTexture },
        wallVolume: { value: this.wallVolume },
        inverseProjection: { value: new THREE.Matrix4() },
        cameraWorld: { value: new THREE.Matrix4() },
        drift: { value: this.drift },
        selfTime: { value: 0 },
        selfStrength: { value: this.selfStrength },
        playerPosition: { value: new THREE.Vector3() },
        playerVelocity: { value: new THREE.Vector3() },
        playerRadius: { value: 2.5 },
        wakeStrength: { value: 1 },
        detailStrength: { value: 0 },
        sampleCount: { value: 0 },
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
      uniforms: { ...this.march.uniforms, cloudShadowCenter: this.shadowUniforms.cloudShadowCenter },
      vertexShader: quadVertex,
      fragmentShader: cloudShadowFragment,
      depthTest: false,
      depthWrite: false,
    });
    this.composite = new THREE.ShaderMaterial({
      uniforms: {
        worldColor: { value: this.world.texture },
        worldDepth: { value: this.world.depthTexture },
        clouds: { value: this.buffer.texture },
        cloudSize: { value: new THREE.Vector2(1, 1) },
        cameraNear: { value: 0 },
        cameraFar: { value: 0 },
        enabled: { value: true },
      },
      vertexShader: quadVertex,
      fragmentShader: compositeFragment,
      depthTest: false,
      depthWrite: false,
    });
    const marchQuad = new THREE.Mesh(this.geometry, this.march);
    const compositeQuad = new THREE.Mesh(this.geometry, this.composite);
    const shadowQuad = new THREE.Mesh(this.geometry, this.shadowPass);
    marchQuad.frustumCulled = compositeQuad.frustumCulled = shadowQuad.frustumCulled = false;
    this.marchScene.add(marchQuad);
    this.compositeScene.add(compositeQuad);
    this.shadowScene.add(shadowQuad);
  }

  setPalette(colors: Pick<EraColors, "cloudLit" | "cloudShadow" | "cloudRim" | "skyHorizon" | "valleyFog">) {
    this.march.uniforms.cloudLit.value.set(colors.cloudLit);
    this.march.uniforms.cloudShadow.value.set(colors.cloudShadow);
    this.march.uniforms.cloudRim.value.set(colors.cloudRim);
    this.march.uniforms.distanceColor.value.set(colors.skyHorizon);
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
    playerVelocityX: number,
    playerVelocityZ: number,
    enabled: boolean,
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
    this.march.uniforms.playerPosition.value.set(playerX, playerY, playerZ);
    this.march.uniforms.playerVelocity.value.set(playerVelocityX, 0, playerVelocityZ);
    this.march.uniforms.playerRadius.value = 2.5;
    this.march.uniforms.wakeStrength.value = THREE.MathUtils.clamp(
      .55 + Math.hypot(playerVelocityX, playerVelocityZ) * .08,
      .55,
      1.25,
    );
    if (!enabled) this.shadowMorphTime = Number.NEGATIVE_INFINITY;
    this.cameraDensity = enabled ? this.density(camera.x, camera.y, camera.z, 0) : 0;
    this.playerDensity = enabled ? this.density(playerX, playerY, playerZ, 0) : 0;
  }

  sampleDensityAt(x: number, y: number, z: number, distance = 0) {
    return this.density(x, y, z, distance);
  }

  private density(x: number, y: number, z: number, distance: number) {
    if (y <= cloudBase || y >= cloudTop) return 0;
    const cloudX = x - this.drift.x, cloudZ = z - this.drift.y;
    const wrappedX = ((cloudX + cloudMapSpan * .5) % cloudMapSpan + cloudMapSpan) % cloudMapSpan - cloudMapSpan * .5;
    const wrappedZ = ((cloudZ + cloudMapSpan * .5) % cloudMapSpan + cloudMapSpan) % cloudMapSpan - cloudMapSpan * .5;
    const weight = cloudWallWeight(cloudX, cloudZ, distance);
    const { lift, pulse } = cloudMorph(this.noise, cloudX, y, cloudZ, this.selfTime, this.selfStrength);
    const billow = cloudBillowOffset(this.billowData, cloudX, y, cloudZ, this.selfTime, this.selfStrength);
    // Grouped sunny-prairie clouds only (no full-map low cloud sea).
    const distant = weight < 1 ? estimateCloudDensity(
      this.map, wrappedX + billow.dx, y - lift * distantVerticalMorph + billow.dy * .45, wrappedZ + billow.dz,
      pulse * distantRoofMorph + (billow.tuft - .5) * 4.6, pulse * distantCoverageMorph + (billow.tuft - .5) * .12,
    ) : 0;
    const wall = weight > 0 ? sampleCloudWall(this.wallData, cloudX + billow.dx * .55, y - lift * .65 + billow.dy * .45, cloudZ + billow.dz * .55) : 0;
    const density = THREE.MathUtils.lerp(distant, morphWallDensity(wall, pulse), weight);
    const opening = estuaryOpening;
    const across = 1 - THREE.MathUtils.smoothstep(Math.abs(x - opening.centerX), opening.inner, opening.outer);
    const along = 1 - THREE.MathUtils.smoothstep(Math.abs(z - opening.centerZ), opening.length, opening.fade);
    return density * (1 - opening.clearance * across * along);
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
      opticalDepth += this.density(camera.x + dx * t, camera.y + dy * t, camera.z + dz * t, distance * t) * distance / 12;
      if (opticalDepth > 13) return true;
    }
    return false;
  }

  begin(renderer: THREE.WebGLRenderer, camera: THREE.Camera, quality: Quality, shadows = true) {
    const castShadows = this.enabled && shadows;
    this.shadowUniforms.cloudShadowStrength.value = castShadows ? .72 : 0;
    if (castShadows) {
      const size = quality === "high" ? 192 : quality === "standard" ? 160 : 96;
      const texel = shadowSpan / size;
      const x = Math.round(camera.position.x / texel) * texel;
      const z = Math.round(camera.position.z / texel) * texel;
      const center = this.shadowUniforms.cloudShadowCenter.value;
      if (this.shadowMap.width !== size || center.x !== x || center.y !== z ||
        this.selfTime - this.shadowMorphTime >= .35 ||
        this.shadowDrift.distanceToSquared(this.drift) >= .2 ** 2) {
        this.shadowMap.setSize(size, size);
        center.set(x, z);
        this.shadowMorphTime = this.selfTime;
        this.shadowDrift.copy(this.drift);
        this.march.uniforms.detailStrength.value = QUALITIES[quality].cloud.detail;
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
    this.width = Math.max(1, Math.round(this.world.width * budget.resolution));
    this.height = Math.max(1, Math.round(this.world.height * budget.resolution));
    this.buffer.setSize(this.width, this.height);
    const { uniforms } = this.march;
    uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);
    uniforms.cameraWorld.value.copy(camera.matrixWorld);
    uniforms.sampleCount.value = budget.samples;
    uniforms.detailStrength.value = budget.detail;
    renderer.setRenderTarget(this.buffer);
    renderer.render(this.marchScene, this.camera);
  }

  compositeWorld(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera) {
    const { uniforms } = this.composite;
    uniforms.cloudSize.value.set(this.width, this.height);
    uniforms.cameraNear.value = camera.near;
    uniforms.cameraFar.value = camera.far;
    uniforms.enabled.value = this.enabled;
    renderer.setRenderTarget(null);
    renderer.render(this.compositeScene, this.camera);
  }

  dispose() {
    this.columns.dispose();
    this.billowTexture.dispose();
    this.wallVolume.dispose();
    this.world.dispose();
    this.buffer.dispose();
    this.shadowMap.dispose();
    this.geometry.dispose();
    this.march.dispose();
    this.shadowPass.dispose();
    this.composite.dispose();
  }
}
