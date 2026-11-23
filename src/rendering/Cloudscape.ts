import * as THREE from "three";
import { QUALITIES, type Quality } from "../data/config";
import {
  bakeCloudMap, bakeCloudNoise, cloudBase, cloudMapSize, cloudMapSpan,
  cloudNoiseSize, cloudSun, cloudTop, estimateCloudDensity,
} from "./CloudscapeLayout";
import { bakeCloudWall, cloudWall, cloudWallWeight, sampleCloudWall } from "./CloudWall";
import {
  cloudFlowGLSL, cloudFlowSpeed, cloudSelfMorphSpeed, cloudSelfShapePosition,
  smoothCloudFlow,
  defaultCloudWind,
} from "./CloudFlow";

const distantFlowWeight = .44;
const shadowSpan = 352;
// Leave a view of the estuary while keeping the banks dense away from its opening.
const estuaryOpening = { centerX: -8, inner: 16, outer: 36, centerZ: -13, length: 37, fade: 70, clearance: .94 };

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
  uniform sampler3D detailNoise, wallVolume;
  uniform vec2 drift;
  uniform float flowDistance, selfMorphSpeed, selfStrength, detailStrength;
  uniform vec3 playerPosition, playerVelocity;
  uniform float playerRadius, wakeStrength;
  uniform vec3 sunDirection;

  ${cloudFlowGLSL}

  // Blend fixed samples to morph the volume without scrolling its noise
  // coordinates. This keeps the cloud anchored in world space while still
  // allowing the interior to breathe in calm air.
  vec2 sampleSelfNoise(vec3 at) {
    vec2 base = texture(detailNoise, at).rg;
    vec2 alternate = texture(detailNoise, at + vec3(.37, .17, .53)).rg;
    float phase = .5 + .5 * sin(selfTime * .37 + dot(at, vec3(.011, .017, .013)));
    return mix(base, alternate, phase * .32);
  }

  // RGB stores density and the density-weighted ambient and direct light.
  vec3 sampleDistantCloud(vec3 at) {
    vec2 cell = at.xz / ${cloudMapSpan.toFixed(1)} + .5;
    if (any(greaterThan(abs(cell - .5), vec2(.499)))) return vec3(0.);
    vec4 column = texture2D(columns, cell);
    if (column.b < .22) return vec3(0.);
    float floorY = mix(${cloudBase.toFixed(1)}, ${cloudTop.toFixed(1)}, column.r);
    float ceilingY = mix(${cloudBase.toFixed(1)}, ${cloudTop.toFixed(1)}, column.g);
    if (at.y < floorY - 3. || at.y > ceilingY + 4.) return vec3(0.);
    vec3 noiseAt = vec3(at.x, at.y * 1.22, at.z) * .045;
    vec2 detail = texture(detailNoise, noiseAt).rg;
    vec3 morphAt = vec3(at.x * .018, at.y * .031, at.z * .018);
    vec2 morph = sampleSelfNoise(morphAt);
    float erode = (detail.x - .54) * 7. +
      (detail.y - .4) * 2.6 * detailStrength +
      (morph.y - .5) * 1.8 * selfStrength;
    float roof = ceilingY + erode;
    float height = (at.y - floorY) / max(roof - floorY, 1.);
    float coverage = smoothstep(
      .25, .63,
      column.b + erode * .024 + (morph.x - .5) * .16 * selfStrength
    );
    float verticalFade = smoothstep(-3., 6., at.y - floorY) *
      (1. - smoothstep(-5.0, 2.2, at.y - roof));
    float density = coverage * verticalFade * mix(.56, 1.04, detail.x) *
      mix(.86, 1.14, morph.x * selfStrength);
    if (density < .004) return vec3(0.);
    float ambient = smoothstep(.02, .95, height);
    float sunwardDensity = texture(detailNoise, noiseAt + sunDirection * .073).r;
    float relief = (detail.x - sunwardDensity) * detailStrength;
    float sun = smoothstep(.14, .90, column.a * (.35 + .65 * ambient) + relief * .8 + (detail.x - .56) * .21);
    return vec3(1., ambient, sun) * density;
  }

  const vec3 wallMin = vec3(${cloudWall.min.map(value => value.toFixed(1)).join(", ")});
  const vec3 wallMax = vec3(${cloudWall.max.map(value => value.toFixed(1)).join(", ")});

  vec3 sampleCloud(vec3 at, float distance) {
    vec2 playerVelocityXZ = playerVelocity.xz;
    float playerSpeed = length(playerVelocityXZ);
    vec2 playerDirection = playerSpeed > .01
      ? playerVelocityXZ / playerSpeed
      : vec2(.0, 1.0);
    vec3 playerDelta = at - playerPosition;
    float verticalInfluence = exp(-pow(playerDelta.y / max(playerRadius * 1.35, .001), 2.));
    vec2 playerOffset = playerDelta.xz;
    float bodyInfluence = exp(-dot(playerOffset, playerOffset) /
      max(playerRadius * playerRadius, .001));
    bodyInfluence *= verticalInfluence;
    float alongWake = dot(playerOffset, playerDirection);
    vec2 sideOffset = playerOffset - playerDirection * alongWake;
    float wakeInfluence = exp(-dot(sideOffset, sideOffset) /
      max(playerRadius * playerRadius * 1.8, .001)) *
      exp(-max(alongWake, 0.) / max(playerRadius * 5.5, .001)) *
      smoothstep(-playerRadius * 1.2, playerRadius * 1.8, alongWake) *
      wakeStrength * smoothstep(.02, .6, playerSpeed);
    vec2 pushDirection = normalize(playerOffset + vec2(.0001));
    vec2 disturbance = pushDirection * bodyInfluence * playerRadius * .72 -
      playerDirection * wakeInfluence * playerRadius * .52;
    at.xz += disturbance;
    vec3 advected = at - vec3(drift.x, 0., drift.y);
    vec2 edge = min(advected.xz - wallMin.xz, wallMax.xz - advected.xz);
    vec2 fade = smoothstep(vec2(0.), vec2(${cloudWall.edgeFade.map(value => value.toFixed(1)).join(", ")}), edge);
    float lod = 1. - smoothstep(${cloudWall.detailDistance[0].toFixed(1)}, ${cloudWall.detailDistance[1].toFixed(1)}, distance);
    float wallWeight = fade.x * fade.y * lod;
    vec3 flowing = cloudSelfShapePosition(advected);
    vec3 distant = wallWeight < 1. ? sampleDistantCloud(mix(advected, flowing, ${distantFlowWeight})) : vec3(0.);
    float interaction = clamp(1. - bodyInfluence * .98 - wakeInfluence * .42, .025, 1.);
    if (wallWeight <= 0.) return distant * interaction;
    vec3 wallUv = (flowing - wallMin) / (wallMax - wallMin);
    vec3 wallStep = vec3(.014, .018, .014);
    vec2 voxel = texture(wallVolume, wallUv).rg * .46;
    voxel += texture(wallVolume, clamp(wallUv + vec3(wallStep.x, 0., 0.), 0., 1.)).rg * .135;
    voxel += texture(wallVolume, clamp(wallUv - vec3(wallStep.x, 0., 0.), 0., 1.)).rg * .135;
    voxel += texture(wallVolume, clamp(wallUv + vec3(0., wallStep.y, 0.), 0., 1.)).rg * .135;
    voxel += texture(wallVolume, clamp(wallUv - vec3(0., wallStep.y, 0.), 0., 1.)).rg * .135;
    vec3 wallMorphAt = flowing * .021;
    vec2 wallMorph = sampleSelfNoise(wallMorphAt);
    voxel.r = clamp(voxel.r * mix(.88, 1.12, wallMorph.x * selfStrength) +
      (wallMorph.y - .5) * .08 * selfStrength, 0., 1.);
    float sunDepth = voxel.g * ${cloudWall.maxOpticalDepth.toFixed(1)};
    float sunlight = exp(-sunDepth * 1.55);
    float skylight = mix(.22, .58, smoothstep(20., 66., at.y)) * exp(-sunDepth * .22);
    return mix(distant, vec3(1., skylight, sunlight) * voxel.r, wallWeight) * interaction;
  }

  vec3 cloudInEstuary(vec3 at, float distance) {
    float across = 1. - smoothstep(${estuaryOpening.inner}., ${estuaryOpening.outer}., abs(at.x - (${estuaryOpening.centerX}.)));
    float along = 1. - smoothstep(${estuaryOpening.length}., ${estuaryOpening.fade}., abs(at.z - (${estuaryOpening.centerZ}.)));
    return sampleCloud(at, distance) * (1. - ${estuaryOpening.clearance} * across * along);
  }
`;

const cloudFragment = `
  ${cloudSampling}
  uniform sampler2D worldDepth;
  uniform mat4 inverseProjection, cameraWorld;
  uniform int sampleCount;
  uniform vec3 distanceColor;
  varying vec2 vUv;
  out vec4 cloudColor;

  void integrateCloud(vec3 eye, vec3 ray, float travel, float stepSize, float towardSun,
      inout float transmittance, inout vec3 scatter) {
    vec3 cloud = cloudInEstuary(eye + ray * travel, travel);
    if (cloud.r < .004) return;
    float density = cloud.r;
    float ambient = cloud.g / density;
    float sun = cloud.b / density;
    float rim = towardSun * (1. - density) * (.15 + .55 * sun);
    vec3 color = mix(vec3(.10, .20, .38), vec3(.25, .43, .72), ambient);
    color = mix(color, vec3(1.75, 1.56, 1.34), sun);
    color += vec3(.85, .68, .43) * rim;
    float aerial = (1. - exp(-travel * .006)) * .65;
    color = mix(color, distanceColor, aerial);
    float opacity = 1. - exp(-density * stepSize * .146);
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
    float end = min(surface, max(bottom, top));
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
    float travel = start;
    float transmittance = 1.;
    vec3 scatter = vec3(0.);
    float towardSun = pow(max(0., dot(ray, sunDirection)), 5.);
    for (int i = 0; i < 24; i++) {
      if (i >= sampleCount || transmittance < .015) break;
      // Resolve thin lips and grooves with a second midpoint only where
      // the base interval crosses the local cloud wall.
      if (wallEnd > wallStart && travel < wallEnd && travel + stride > wallStart) {
        integrateCloud(eye, ray, travel + stride * .25, stride * .5, towardSun, transmittance, scatter);
        integrateCloud(eye, ray, travel + stride * .75, stride * .5, towardSun, transmittance, scatter);
      } else {
        integrateCloud(eye, ray, travel + stride * .5, stride, towardSun, transmittance, scatter);
      }
      travel += stride;
    }
    // Pack radiance into an RGBA8 target with headroom for warm highlights.
    cloudColor = vec4(scatter * .5, 1. - transmittance);
  }
`;

const cloudShadowFragment = `
  ${cloudSampling}
  uniform vec2 cloudShadowCenter;
  varying vec2 vUv;
  out vec4 shadowColor;

  void main() {
    // sampleCloud applies the world-to-field drift exactly once.
    vec2 receiver = cloudShadowCenter + (vUv - .5) * ${shadowSpan}.;
    vec2 solarSlope = sunDirection.xz / sunDirection.y;
    const float stride = ${(cloudTop - cloudBase) / 16};
    vec2 depth = vec2(0.);
    for (int i = 0; i < 16; i++) {
      float height = ${cloudBase}. + (float(i) + .5) * stride;
      float density = cloudInEstuary(vec3(receiver.x + solarSlope.x * height, height,
        receiver.y + solarSlope.y * height), 0.).r;
      depth += density * vec2(1., smoothstep(15., 28., height));
    }
    vec2 sunlight = exp(-depth * stride * .108 / sunDirection.y);
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
    return cloud / max(total, .001);
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
  private readonly detail: THREE.Data3DTexture;
  private readonly wallData: Uint8Array;
  private readonly wallVolume: THREE.Data3DTexture;
  private readonly drift = new THREE.Vector2();
  private readonly world: THREE.WebGLRenderTarget;
  private readonly buffer = new THREE.WebGLRenderTarget(1, 1, {
    depthBuffer: false,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
  });
  private readonly camera = new THREE.Camera();
  private readonly geometry = new THREE.PlaneGeometry(2, 2);
  private readonly marchScene = new THREE.Scene();
  private readonly shadowScene = new THREE.Scene();
  private readonly compositeScene = new THREE.Scene();
  private readonly march: THREE.ShaderMaterial;
  private readonly shadowPass: THREE.ShaderMaterial;
  private readonly shadowMap = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
  private shadowTime = Number.NEGATIVE_INFINITY;
  private shadowDirection = new THREE.Vector2();
  private readonly composite: THREE.ShaderMaterial;

  readonly shadowUniforms;
  width = 1;
  height = 1;
  cameraDensity = 0;
  private enabled = true;
  private flowDistance = 0;
  private selfTime = 0;
  private flowX: number = defaultCloudWind[0];
  private flowZ: number = defaultCloudWind[1];
  private flowSpeed = cloudFlowSpeed(this.flowX, this.flowZ, 0);
  private selfMorphSpeed = cloudSelfMorphSpeed(this.flowX, this.flowZ, 0);
  private selfStrength = .72;

  constructor(renderer: THREE.WebGLRenderer, seed: number) {
    this.map = bakeCloudMap(seed);
    this.columns = new THREE.DataTexture(this.map, cloudMapSize, cloudMapSize);
    this.columns.minFilter = this.columns.magFilter = THREE.LinearFilter;
    this.columns.needsUpdate = true;
    const noise = bakeCloudNoise(seed);
    this.detail = new THREE.Data3DTexture(noise, cloudNoiseSize, cloudNoiseSize, cloudNoiseSize);
    this.detail.format = THREE.RGFormat;
    this.detail.minFilter = this.detail.magFilter = THREE.LinearFilter;
    this.detail.wrapR = this.detail.wrapS = this.detail.wrapT = THREE.RepeatWrapping;
    this.detail.needsUpdate = true;
    this.wallData = bakeCloudWall(noise);
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
        wallVolume: { value: this.wallVolume },
        inverseProjection: { value: new THREE.Matrix4() },
        cameraWorld: { value: new THREE.Matrix4() },
        drift: { value: this.drift },
        flowDistance: { value: 0 },
        flowSpeed: { value: this.flowSpeed },
        selfTime: { value: 0 },
        selfMorphSpeed: { value: this.selfMorphSpeed },
        selfStrength: { value: this.selfStrength },
        flowDirection: { value: new THREE.Vector2(this.flowX, this.flowZ) },
        playerPosition: { value: new THREE.Vector3() },
        playerVelocity: { value: new THREE.Vector3() },
        playerRadius: { value: 2.5 },
        wakeStrength: { value: 1 },
        detailStrength: { value: 0 },
        sampleCount: { value: 0 },
        sunDirection: { value: new THREE.Vector3(...cloudSun).normalize() },
        distanceColor: { value: new THREE.Color("#87bfdd") },
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
    const length = Math.hypot(windX, windZ);
    if (length > .001) {
      const targetX = windX / length, targetZ = windZ / length;
      this.flowX = smoothCloudFlow(this.flowX, targetX, sceneDelta);
      this.flowZ = smoothCloudFlow(this.flowZ, targetZ, sceneDelta);
      const directionLength = Math.hypot(this.flowX, this.flowZ);
      this.flowX /= directionLength;
      this.flowZ /= directionLength;
    }
    this.flowSpeed = smoothCloudFlow(
      this.flowSpeed,
      cloudFlowSpeed(windX, windZ, gust),
      sceneDelta,
    );
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
    this.flowDistance += sceneDelta * this.flowSpeed;
    this.drift.set(
      this.flowX * this.flowDistance * .42,
      this.flowZ * this.flowDistance * .42,
    );
    this.march.uniforms.flowDistance.value = this.flowDistance;
    this.march.uniforms.flowSpeed.value = this.flowSpeed;
    this.march.uniforms.selfTime.value = this.selfTime;
    this.march.uniforms.selfMorphSpeed.value = this.selfMorphSpeed;
    this.march.uniforms.selfStrength.value = this.selfStrength;
    this.march.uniforms.playerPosition.value.set(playerX, playerY, playerZ);
    this.march.uniforms.playerVelocity.value.set(playerVelocityX, 0, playerVelocityZ);
    this.march.uniforms.playerRadius.value = 2.5;
    this.march.uniforms.wakeStrength.value = THREE.MathUtils.clamp(
      .55 + Math.hypot(playerVelocityX, playerVelocityZ) * .08,
      .55,
      1.25,
    );
    this.march.uniforms.flowDirection.value.set(this.flowX, this.flowZ);
    if (!enabled) this.shadowTime = Number.NEGATIVE_INFINITY;
    this.cameraDensity = enabled ? this.density(camera.x, camera.y, camera.z, 0) : 0;
  }

  private density(x: number, y: number, z: number, distance: number) {
    if (y <= cloudBase || y >= cloudTop) return 0;
    const cloudX = x - this.drift.x, cloudZ = z - this.drift.y;
    const weight = cloudWallWeight(cloudX, cloudZ, distance);
    const flowing = cloudSelfShapePosition(cloudX, y, cloudZ, this.selfTime);
    const distant = weight < 1 ? estimateCloudDensity(
      this.map,
      THREE.MathUtils.lerp(cloudX, flowing.x, distantFlowWeight),
      THREE.MathUtils.lerp(y, flowing.y, distantFlowWeight),
      THREE.MathUtils.lerp(cloudZ, flowing.z, distantFlowWeight),
    ) : 0;
    const density = weight > 0
      ? distant * (1 - weight) + sampleCloudWall(this.wallData, flowing.x, flowing.y, flowing.z) * weight
      : distant;
    const opening = estuaryOpening;
    const across = 1 - THREE.MathUtils.smoothstep(Math.abs(cloudX - opening.centerX), opening.inner, opening.outer);
    const along = 1 - THREE.MathUtils.smoothstep(Math.abs(cloudZ - opening.centerZ), opening.length, opening.fade);
    return density * (1 - opening.clearance * across * along);
  }

  get flow() {
    return {
      x: this.flowX,
      z: this.flowZ,
      speed: this.flowSpeed,
      distance: this.flowDistance,
      selfTime: this.selfTime,
      selfSpeed: this.selfMorphSpeed,
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
    this.shadowUniforms.cloudShadowStrength.value = castShadows ? .67 : 0;
    if (castShadows) {
      const size = quality === "high" ? 192 : quality === "standard" ? 160 : 96;
      const texel = shadowSpan / size;
      const x = Math.round(camera.position.x / texel) * texel;
      const z = Math.round(camera.position.z / texel) * texel;
      const center = this.shadowUniforms.cloudShadowCenter.value;
      if (this.shadowMap.width !== size || center.x !== x || center.y !== z ||
        this.flowDistance - this.shadowTime >= .3 ||
        this.shadowDirection.distanceToSquared(this.march.uniforms.flowDirection.value) >= .012) {
        this.shadowMap.setSize(size, size);
        center.set(x, z);
        this.shadowTime = this.flowDistance;
        this.shadowDirection.set(this.flowX, this.flowZ);
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
    this.detail.dispose();
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
