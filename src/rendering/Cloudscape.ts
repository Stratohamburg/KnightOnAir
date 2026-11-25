import * as THREE from "three";
import { QUALITIES, type Quality } from "../data/config";
import type { EraColors } from "../data/eras";
import {
  bakeBillowNoise, bakeCloudMap, bakeCloudNoise, cloudBase, cloudMapSize, cloudMapSpan,
  cloudNoiseSize, cloudSun, cloudTop, estimateCloudDensity,
} from "./CloudscapeLayout";
import { bakeCloudWall, cloudWall, cloudWallWeight, sampleCloudWall } from "./CloudWall";
import {
  billowFineRiseRate, billowRiseRate, cloudBillowOffset, cloudFlowGLSL, cloudMorph,
  cloudSelfMorphSpeed, cloudVelocity, distantCoverageMorph, distantRoofMorph,
  distantVerticalMorph, morphWallDensity, smoothCloudFlow,
} from "./CloudFlow";

const shadowSpan = 352;
// Leave a view of the estuary while keeping the banks dense away from its opening.
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
  uniform sampler3D detailNoise, billowNoise, wallVolume;
  uniform vec2 drift;
  uniform float detailStrength;
  uniform vec3 playerPosition, playerVelocity;
  uniform float playerRadius, wakeStrength;
  uniform vec3 sunDirection;

  ${cloudFlowGLSL}

  const vec3 wallMin = vec3(${cloudWall.min.map(value => value.toFixed(1)).join(", ")});
  const vec3 wallMax = vec3(${cloudWall.max.map(value => value.toFixed(1)).join(", ")});

  // Returns vec4(density, heightFraction, macroSun, ridgeBoost) for seamless 3D billowing clouds.
  vec4 sampleDistantBillow(vec3 advected, vec2 morph, vec3 warp, float detailLod) {
    vec2 cell = fract(advected.xz / ${cloudMapSpan.toFixed(1)} + .5);
    vec4 column = texture2D(columns, cell);

    // Layer 1: Low-altitude billowing cloud sea below flight level (y ~ 12.5..22.8).
    float seaDensity = 0.;
    float seaHeight = 0.;
    if (advected.y < 24.5) {
      vec3 seaUv = vec3(advected.x + warp.x * .85, (advected.y + warp.y * .55 - selfTime * ${(billowRiseRate * .7).toFixed(2)}) * 1.45, advected.z + warp.z * .85) * .018;
      vec3 seaNoise = texture(billowNoise, seaUv).rgb;
      float seaBase = ${cloudBase.toFixed(1)} + .5 + (seaNoise.r - .5) * 3.0;
      float seaTop = 19.8 + (seaNoise.r - .40) * 6.4 + (seaNoise.g - .48) * 3.2 * detailLod + morph.x * .35;
      float seaSpan = max(seaTop - seaBase, 2.5);
      seaHeight = clamp((advected.y - seaBase) / seaSpan, 0., 1.);
      float seaProfile = smoothstep(0., .24, seaHeight) * (1. - smoothstep(.56, 1., seaHeight));
      float seaMask = smoothstep(.32, .70, seaNoise.r * .62 + seaNoise.g * .38 + column.b * .24 + morph.y * .06);
      float fineErode = (1. - seaNoise.b) * .28 * detailLod;
      seaDensity = clamp((seaMask * seaProfile - fineErode) * 1.05, 0., 1.);
    }

    // Layer 2: Mid/high 3D cumulus ridges & billowing towers across the entire world.
    float bankDensity = 0.;
    float bankHeight = 0.;
    if (column.b >= .18) {
      float floorY = mix(${cloudBase.toFixed(1)}, ${cloudTop.toFixed(1)}, column.r) + morph.x * ${distantVerticalMorph};
      float ceilingY = mix(${cloudBase.toFixed(1)}, ${cloudTop.toFixed(1)}, column.g);
      if (advected.y >= floorY - 4. && advected.y <= ceilingY + 14.) {
        vec3 macroUv = vec3(
          advected.x + warp.x,
          (advected.y + warp.y - selfTime * ${billowRiseRate}) * 1.05,
          advected.z + warp.z
        ) * .022;
        vec3 macro = texture(billowNoise, macroUv).rgb;
        vec3 fineUv = vec3(
          advected.x + warp.x * 1.35,
          (advected.y + warp.y * 1.2 - selfTime * ${billowFineRiseRate}) * 1.15,
          advected.z + warp.z * 1.35
        ) * .054;
        vec3 fine = texture(billowNoise, fineUv).rgb;

        float erode = (macro.r - .50) * 9.5 + (fine.g - .45) * 4.4 * detailLod;
        float roof = ceilingY + erode + morph.x * ${distantVerticalMorph} + morph.y * ${distantRoofMorph};
        float span = max(roof - floorY, 4.);
        bankHeight = clamp((advected.y - floorY) / span, 0., 1.);

        // Rounded cumulus dome profile: fuller mid-belly, crisp cauliflower puffs, flat-ish bottom shelf.
        float bottomProfile = smoothstep(-2.4, 5.0, advected.y - floorY);
        float topDome = 1. - smoothstep(.52, 1.02, bankHeight + (1. - macro.r) * .28);
        float domeCoverage = smoothstep(
          .22, .62,
          column.b + (macro.r - .48) * .32 + morph.y * ${distantCoverageMorph}
        );
        float billowCarve = mix(1., macro.r * .54 + macro.g * .46, .52 + .42 * detailLod);
        float edgeErosion = (1. - fine.b) * (.25 + .26 * bankHeight) * detailLod;
        bankDensity = clamp((domeCoverage * bottomProfile * topDome * billowCarve - edgeErosion) * 1.55, 0., 1.);
      }
    }

    float density = max(bankDensity, seaDensity);
    float heightFrac = bankDensity >= seaDensity ? bankHeight : seaHeight * .55;
    float macroSun = mix(.55 + .45 * seaHeight, column.a, step(seaDensity, bankDensity + .02));
    return vec4(density, heightFrac, macroSun, 0.);
  }

  vec4 sampleCloudField(vec3 at, float distance, bool applyPlayer) {
    float interaction = 1.;
    float cavityRim = 0.;
    if (applyPlayer) {
      vec2 playerVelocityXZ = playerVelocity.xz;
      float playerSpeed = length(playerVelocityXZ);
      vec2 playerDirection = playerSpeed > .01
        ? playerVelocityXZ / playerSpeed
        : vec2(.0, 1.0);
      vec3 playerDelta = at - playerPosition;
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
      // Compressed billowing cloud rim around the displaced aircraft cavity.
      cavityRim = smoothstep(.05, .34, bodyInfluence) * (1. - smoothstep(.34, .82, bodyInfluence)) * verticalInfluence;
      interaction = clamp(1. - bodyInfluence * .98 - wakeInfluence * .44, .025, 1.);
    }

    vec3 advected = at - vec3(drift.x, 0., drift.y);
    float detailLod = detailStrength * (1. - smoothstep(130., 340., distance));
    vec2 morph = cloudMorph(advected);
    vec3 warp = billowWarp(billowNoise, advected) * (.55 + .45 * detailLod);

    vec2 edge = min(advected.xz - wallMin.xz, wallMax.xz - advected.xz);
    vec2 fade = smoothstep(vec2(0.), vec2(${cloudWall.edgeFade.map(value => value.toFixed(1)).join(", ")}), edge);
    float wallLod = 1. - smoothstep(${cloudWall.detailDistance[0].toFixed(1)}, ${cloudWall.detailDistance[1].toFixed(1)}, distance);
    float wallWeight = fade.x * fade.y * wallLod;

    vec4 distant = wallWeight < .995 ? sampleDistantBillow(advected, morph, warp, detailLod) : vec4(0.);
    vec4 result = distant;

    if (wallWeight > 0.) {
      vec3 wallPos = advected + vec3(warp.x * .65, -morph.x + warp.y * .5, warp.z * .65);
      vec3 wallUv = (wallPos - wallMin) / (wallMax - wallMin);
      vec2 voxel = texture(wallVolume, clamp(wallUv, 0., 1.)).rg;
      vec3 billow = texture(billowNoise, vec3(
        advected.x + warp.x * 1.1,
        (advected.y + warp.y - selfTime * ${billowFineRiseRate}) * 1.1,
        advected.z + warp.z * 1.1
      ) * .048).rgb;
      float baseDensity = morphWallDensity(voxel.r, morph.y);
      float edgeBand = smoothstep(0., .55, baseDensity) * (1. - smoothstep(.55, 1., baseDensity));
      float carved = clamp(baseDensity + (billow.r - .46) * .42 * edgeBand - (1. - billow.b) * .22 * edgeBand * detailLod, 0., 1.);
      float wallHeight = clamp((advected.y - ${cloudBase.toFixed(1)}) / ${(cloudTop - cloudBase).toFixed(1)}, 0., 1.);
      float bakedSun = exp(-voxel.g * ${cloudWall.maxOpticalDepth.toFixed(1)} * .82);
      vec4 wallSample = vec4(carved, wallHeight, bakedSun, 0.);
      result = mix(distant, wallSample, wallWeight);
    }

    // Apply estuary opening in world coordinates so the river mouth stays navigable and dramatic.
    float across = 1. - smoothstep(${estuaryOpening.inner}., ${estuaryOpening.outer}., abs(at.x - (${estuaryOpening.centerX}.)));
    float along = 1. - smoothstep(${estuaryOpening.length}., ${estuaryOpening.fade}., abs(at.z - (${estuaryOpening.centerZ}.)));
    float openingMask = 1. - ${estuaryOpening.clearance} * across * along;

    float baseBeforeRim = result.r * openingMask;
    float pushedDensity = clamp(baseBeforeRim * interaction + cavityRim * smoothstep(.04, .28, baseBeforeRim) * .28, 0., 1.);
    return vec4(pushedDensity, result.g, result.b, cavityRim);
  }
`;

const cloudFragment = `
  ${cloudSampling}
  uniform sampler2D worldDepth;
  uniform mat4 inverseProjection, cameraWorld;
  uniform int sampleCount, sunSteps;
  uniform vec3 distanceColor, cloudLit, cloudShadow, cloudRim, valleyFog;
  varying vec2 vUv;
  out vec4 cloudColor;

  // Deterministic per-pixel Interleaved Gradient Noise (static when paused, eliminates raymarch slicing).
  float ign(vec2 pixel) {
    return fract(52.9829189 * fract(dot(pixel, vec2(.06711056, .00583715))));
  }

  float hgPhase(float cosTheta, float g) {
    float g2 = g * g;
    return (1. - g2) / (4. * 3.14159265 * pow(max(1. + g2 - 2. * g * cosTheta, .001), 1.5));
  }

  float marchSunLight(vec3 pos, float dist, float macroSun) {
    float optical = 0.;
    float stepDist = 2.4;
    for (int s = 0; s < 3; s++) {
      if (s >= sunSteps) break;
      vec3 sunPos = pos + sunDirection * stepDist;
      if (sunPos.y >= ${cloudTop.toFixed(1)}) break;
      float d = sampleCloudField(sunPos, dist + stepDist, true).r;
      optical += d * stepDist * .22;
      stepDist *= 2.1;
    }
    // Combine local real-time self-shadowing with macro ridge occlusion for crisp 3D cauliflower depth.
    float localBeer = exp(-optical * 1.35);
    float localMulti = .48 * exp(-optical * .34);
    float localEnergy = max(localBeer, localMulti);
    return mix(macroSun, localEnergy, .82) * (.44 + .56 * macroSun);
  }

  void integrateCloud(vec3 eye, vec3 ray, float travel, float stepSize, float phase, float forwardGlow,
      inout float transmittance, inout vec3 scatter) {
    vec3 samplePos = eye + ray * travel;
    vec4 cloud = sampleCloudField(samplePos, travel, true);
    float density = cloud.r;
    if (density < .004) return;

    float heightFrac = cloud.g;
    float macroSun = cloud.b;
    float cavityRim = cloud.a;

    float lightEnergy = marchSunLight(samplePos, travel, macroSun);
    // Powder effect gives fluffy cauliflower lobes clear dark-crease vs bright-ridge contrast.
    float powder = 1. - .68 * exp(-density * 3.1);
    float directSun = clamp(lightEnergy * mix(1., powder, .68) * phase, 0., 1.85);

    // Sky-like luminous palette: rich pastel blue/lavender shadows, valley bounce at base, creamy sunlit crowns.
    vec3 deepShadow = cloudShadow * .68;
    vec3 bottomBounce = mix(deepShadow, valleyFog * .84, .24);
    vec3 ambientColor = mix(bottomBounce, mix(cloudShadow * .9, cloudLit, .38), smoothstep(.04, .92, heightFrac));
    vec3 directColor = cloudLit * (1.36 + .28 * smoothstep(.22, .95, heightFrac));
    vec3 color = mix(ambientColor, directColor, smoothstep(.08, .92, directSun));

    // Dual-lobe silver lining + pushed wingtip rim highlight.
    float rim = forwardGlow * (1. - density * .65) * (.22 + .78 * lightEnergy);
    color += cloudRim * (rim * .82 + cavityRim * .32 * (.4 + .6 * lightEnergy));

    // Aerial perspective blends distant cloud banks softly into the glowing horizon while preserving near relief.
    float aerial = (1. - exp(-max(0., travel - 35.) * .0026)) * .62;
    vec3 horizonMix = mix(distanceColor, cloudRim, forwardGlow * .24);
    color = mix(color, horizonMix, aerial);

    float opacity = 1. - exp(-density * stepSize * .175);
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
    float end = min(min(surface, 440.), max(bottom, top));
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
    float jitter = ign(gl_FragCoord.xy);
    float travel = start + jitter * stride;
    float transmittance = 1.;
    vec3 scatter = vec3(0.);
    float cosTheta = dot(ray, sunDirection);
    float phase = clamp(.72 + .52 * (hgPhase(cosTheta, .68) * .65 + hgPhase(cosTheta, -.24) * .35) * 4. * 3.14159265, .75, 1.55);
    float forwardGlow = pow(max(0., cosTheta), 4.);

    for (int i = 0; i < 24; i++) {
      if (i >= sampleCount || transmittance < .018 || travel >= end) break;
      if (wallEnd > wallStart && travel < wallEnd && travel + stride > wallStart) {
        integrateCloud(eye, ray, travel + stride * .25, stride * .5, phase, forwardGlow, transmittance, scatter);
        if (transmittance >= .018) {
          integrateCloud(eye, ray, travel + stride * .75, stride * .5, phase, forwardGlow, transmittance, scatter);
        }
      } else {
        integrateCloud(eye, ray, travel, stride, phase, forwardGlow, transmittance, scatter);
      }
      travel += stride;
    }
    // Pack radiance into an RGBA8 target with headroom for luminous highlights.
    cloudColor = vec4(scatter * .5, 1. - transmittance);
  }
`;

const cloudShadowFragment = `
  ${cloudSampling}
  uniform vec2 cloudShadowCenter;
  varying vec2 vUv;
  out vec4 shadowColor;

  void main() {
    // sampleCloudField applies the world-to-field drift exactly once.
    vec2 receiver = cloudShadowCenter + (vUv - .5) * ${shadowSpan}.;
    vec2 solarSlope = sunDirection.xz / sunDirection.y;
    const float stride = ${(cloudTop - cloudBase) / 14};
    vec2 depth = vec2(0.);
    for (int i = 0; i < 14; i++) {
      float height = ${cloudBase}. + (float(i) + .5) * stride;
      float density = sampleCloudField(vec3(receiver.x + solarSlope.x * height, height,
        receiver.y + solarSlope.y * height), 0., false).r;
      depth += density * vec2(1., smoothstep(15., 28., height));
    }
    vec2 sunlight = exp(-depth * stride * .115 / sunDirection.y);
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
  private readonly detail: THREE.Data3DTexture;
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
    this.detail = new THREE.Data3DTexture(this.noise, cloudNoiseSize, cloudNoiseSize, cloudNoiseSize);
    this.detail.format = THREE.RGFormat;
    this.detail.minFilter = this.detail.magFilter = THREE.LinearFilter;
    this.detail.wrapR = this.detail.wrapS = this.detail.wrapT = THREE.RepeatWrapping;
    this.detail.needsUpdate = true;

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
      cloudShadowStrength: { value: .67 },
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
        detailNoise: { value: this.detail },
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
        sunSteps: { value: 2 },
        sunDirection: { value: new THREE.Vector3(...cloudSun).normalize() },
        distanceColor: { value: new THREE.Color("#dff5f0") },
        cloudLit: { value: new THREE.Color("#fff9ed") },
        cloudShadow: { value: new THREE.Color("#7ea8d8") },
        cloudRim: { value: new THREE.Color("#ffe8b8") },
        valleyFog: { value: new THREE.Color("#d9f3f2") },
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
    this.march.uniforms.valleyFog.value.set(colors.valleyFog);
  }

  get palette(): CloudAtmospherePalette {
    return {
      cloudLit: `#${(this.march.uniforms.cloudLit.value as THREE.Color).getHexString()}`,
      cloudShadow: `#${(this.march.uniforms.cloudShadow.value as THREE.Color).getHexString()}`,
      cloudRim: `#${(this.march.uniforms.cloudRim.value as THREE.Color).getHexString()}`,
      skyHorizon: `#${(this.march.uniforms.distanceColor.value as THREE.Color).getHexString()}`,
      valleyFog: `#${(this.march.uniforms.valleyFog.value as THREE.Color).getHexString()}`,
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
    const distantBank = weight < 1 ? estimateCloudDensity(
      this.map, wrappedX + billow.dx, y - lift * distantVerticalMorph + billow.dy * .5, wrappedZ + billow.dz,
      pulse * distantRoofMorph + (billow.tuft - .5) * 5.2, pulse * distantCoverageMorph + (billow.tuft - .5) * .16,
    ) : 0;
    let sea = 0;
    if (y < 23.5) {
      const seaTop = 19.6 + (billow.tuft - .42) * 5.8 + lift * .35;
      const seaH = (y - (cloudBase + .5)) / Math.max(seaTop - (cloudBase + .5), 2.5);
      if (seaH > 0 && seaH < 1) {
        const profile = THREE.MathUtils.smoothstep(seaH, 0, .28) * (1 - THREE.MathUtils.smoothstep(seaH, .52, 1));
        sea = THREE.MathUtils.clamp(THREE.MathUtils.smoothstep(billow.tuft, .34, .74) * profile * .85, 0, 1);
      }
    }
    const distant = Math.max(distantBank, sea);
    const wall = weight > 0 ? sampleCloudWall(this.wallData, cloudX + billow.dx * .65, y - lift + billow.dy * .5, cloudZ + billow.dz * .65) : 0;
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
    this.shadowUniforms.cloudShadowStrength.value = castShadows ? .74 : 0;
    if (castShadows) {
      const size = quality === "high" ? 192 : quality === "standard" ? 160 : 96;
      const texel = shadowSpan / size;
      const x = Math.round(camera.position.x / texel) * texel;
      const z = Math.round(camera.position.z / texel) * texel;
      const center = this.shadowUniforms.cloudShadowCenter.value;
      if (this.shadowMap.width !== size || center.x !== x || center.y !== z ||
        this.selfTime - this.shadowMorphTime >= .24 ||
        this.shadowDrift.distanceToSquared(this.drift) >= .16 ** 2) {
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
    uniforms.sunSteps.value = quality === "high" ? 3 : quality === "standard" ? 2 : 1;
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
    this.detail.dispose();
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
