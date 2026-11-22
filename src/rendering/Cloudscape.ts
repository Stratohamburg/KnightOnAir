import * as THREE from "three";
import { QUALITIES, type Quality } from "../data/config";
import {
  bakeCloudMap, bakeCloudNoise, cloudBase, cloudMapSize, cloudMapSpan,
  cloudNoiseSize, cloudSun, cloudTop, estimateCloudDensity,
} from "./CloudscapeLayout";
import { bakeCloudWall, cloudWall, cloudWallWeight, sampleCloudWall } from "./CloudWall";
import {
  cloudFlowAdvance, cloudFlowGLSL, cloudFlowPosition, cloudFlowSpeed,
  defaultCloudWind,
} from "./CloudFlow";

const distantFlowWeight = .44;
// Leave a view of the estuary while keeping the banks dense away from its opening.
const estuaryOpening = { centerX: -8, inner: 16, outer: 36, centerZ: -13, length: 37, fade: 70, clearance: .94 };

const quadVertex = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0., 1.);
  }
`;

const cloudFragment = `
  precision highp sampler3D;
  uniform sampler2D columns, worldDepth;
  uniform sampler3D detailNoise, wallVolume;
  uniform mat4 inverseProjection, cameraWorld;
  uniform vec2 drift;
  uniform float flowDistance, flowSpeed, detailStrength;
  uniform int sampleCount;
  uniform vec3 sunDirection, distanceColor;
  varying vec2 vUv;
  out vec4 cloudColor;

  ${cloudFlowGLSL}

  // RGB stores density and the density-weighted ambient and direct light.
  vec3 sampleDistantCloud(vec3 at) {
    vec2 cell = at.xz / ${cloudMapSpan.toFixed(1)} + .5;
    if (any(greaterThan(abs(cell - .5), vec2(.499)))) return vec3(0.);
    vec4 column = texture2D(columns, cell);
    if (column.b < .22) return vec3(0.);
    float floorY = mix(${cloudBase.toFixed(1)}, ${cloudTop.toFixed(1)}, column.r);
    float ceilingY = mix(${cloudBase.toFixed(1)}, ${cloudTop.toFixed(1)}, column.g);
    if (at.y < floorY - 3. || at.y > ceilingY + 4.) return vec3(0.);
    vec2 flowAcross = vec2(flowDirection.y, -flowDirection.x);
    vec2 noiseDrift = flowDirection * (.011 + flowSpeed * .0012) - flowAcross * .006;
    vec3 noiseAt = vec3(at.x, at.y * 1.22, at.z) * .045 +
      vec3(noiseDrift.x, .009, noiseDrift.y) * flowDistance;
    vec2 detail = texture(detailNoise, noiseAt).rg;
    float erode = (detail.x - .54) * 7. + (detail.y - .4) * 2.6 * detailStrength;
    float roof = ceilingY + erode;
    float height = (at.y - floorY) / max(roof - floorY, 1.);
    float coverage = smoothstep(.25, .63, column.b + erode * .024);
    float verticalFade = smoothstep(-3., 6., at.y - floorY) *
      (1. - smoothstep(-5.0, 2.2, at.y - roof));
    float density = coverage * verticalFade * mix(.59, 1., detail.x);
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
    vec2 edge = min(at.xz - wallMin.xz, wallMax.xz - at.xz);
    vec2 fade = smoothstep(vec2(0.), vec2(${cloudWall.edgeFade.map(value => value.toFixed(1)).join(", ")}), edge);
    float lod = 1. - smoothstep(${cloudWall.detailDistance[0].toFixed(1)}, ${cloudWall.detailDistance[1].toFixed(1)}, distance);
    float wallWeight = fade.x * fade.y * lod;
    vec3 flowing = cloudFlowPosition(at, flowDistance);
    vec3 distant = wallWeight < 1. ? sampleDistantCloud(mix(at, flowing, ${distantFlowWeight})) : vec3(0.);
    if (wallWeight <= 0.) return distant;
    vec2 voxel = texture(wallVolume, (flowing - wallMin) / (wallMax - wallMin)).rg;
    float sunDepth = voxel.g * ${cloudWall.maxOpticalDepth.toFixed(1)};
    float sunlight = exp(-sunDepth * 1.55);
    float skylight = mix(.22, .58, smoothstep(20., 66., at.y)) * exp(-sunDepth * .22);
    return mix(distant, vec3(1., skylight, sunlight) * voxel.r, wallWeight);
  }

  void integrateCloud(vec3 eye, vec3 ray, float travel, float stepSize, float towardSun,
      inout float transmittance, inout vec3 scatter) {
    vec3 at = eye + ray * travel;
    float across = 1. - smoothstep(${estuaryOpening.inner}., ${estuaryOpening.outer}., abs(at.x - (${estuaryOpening.centerX}.)));
    float along = 1. - smoothstep(${estuaryOpening.length}., ${estuaryOpening.fade}., abs(at.z - (${estuaryOpening.centerZ}.)));
    vec3 cloud = sampleCloud(at, travel) * (1. - ${estuaryOpening.clearance} * across * along);
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
        integrateCloud(fieldEye, ray, travel + stride * .25, stride * .5, towardSun, transmittance, scatter);
        integrateCloud(fieldEye, ray, travel + stride * .75, stride * .5, towardSun, transmittance, scatter);
      } else {
        integrateCloud(fieldEye, ray, travel + stride * .5, stride, towardSun, transmittance, scatter);
      }
      travel += stride;
    }
    // Pack radiance into an RGBA8 target with headroom for warm highlights.
    cloudColor = vec4(scatter * .5, 1. - transmittance);
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
  uniform sampler2D cloudColumns;
  uniform vec2 cloudDrift;
  uniform float cloudShadows;

  float cloudLightAt(vec3 world) {
    vec2 sunward = vec2(-.51, -.26) * max(0., 35. - world.y) / .82;
    vec2 uv = (world.xz - cloudDrift + sunward) / ${cloudMapSpan.toFixed(1)} + .5;
    if (cloudShadows == 0. || any(greaterThan(abs(uv - .5), vec2(.499)))) return 1.;
    vec4 column = texture2D(cloudColumns, uv);
    return 1. - smoothstep(.13, .76, column.b) * smoothstep(.08, .52, column.g - column.r) * cloudShadows;
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
  private readonly compositeScene = new THREE.Scene();
  private readonly march: THREE.ShaderMaterial;
  private readonly composite: THREE.ShaderMaterial;

  readonly shadowUniforms;
  width = 1;
  height = 1;
  cameraDensity = 0;
  private enabled = true;
  private flowDistance = 0;
  private flowX: number = defaultCloudWind[0];
  private flowZ: number = defaultCloudWind[1];
  private flowSpeed = cloudFlowSpeed(this.flowX, this.flowZ, 0);

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
      cloudColumns: { value: this.columns },
      cloudDrift: { value: this.drift },
      cloudShadows: { value: 0.24 },
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
        flowDirection: { value: new THREE.Vector2(this.flowX, this.flowZ) },
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
    marchQuad.frustumCulled = compositeQuad.frustumCulled = false;
    this.marchScene.add(marchQuad);
    this.compositeScene.add(compositeQuad);
  }

  update(
    sceneDelta: number,
    windX: number,
    windZ: number,
    gust: number,
    camera: THREE.Vector3,
    enabled: boolean,
  ) {
    this.enabled = enabled;
    const length = Math.hypot(windX, windZ);
    if (length > .001) {
      this.flowX = windX / length;
      this.flowZ = windZ / length;
    }
    this.flowSpeed = cloudFlowSpeed(windX, windZ, gust);
    this.flowDistance += cloudFlowAdvance(sceneDelta, windX, windZ, gust);
    const acrossX = -this.flowZ, acrossZ = this.flowX;
    const eddy = Math.sin(this.flowDistance * .021) * 2.2;
    this.drift.set(
      this.flowX * this.flowDistance * .42 + acrossX * eddy,
      this.flowZ * this.flowDistance * .42 + acrossZ * eddy,
    );
    this.march.uniforms.flowDistance.value = this.flowDistance;
    this.march.uniforms.flowSpeed.value = this.flowSpeed;
    this.march.uniforms.flowDirection.value.set(this.flowX, this.flowZ);
    this.shadowUniforms.cloudShadows.value = enabled ? .24 : 0;
    this.cameraDensity = enabled ? this.density(camera.x, camera.y, camera.z, 0) : 0;
  }

  private density(x: number, y: number, z: number, distance: number) {
    if (y <= cloudBase || y >= cloudTop) return 0;
    const cloudX = x - this.drift.x, cloudZ = z - this.drift.y;
    const weight = cloudWallWeight(cloudX, cloudZ, distance);
    const flowing = cloudFlowPosition(cloudX, y, cloudZ, this.flowDistance, this.flowX, this.flowZ);
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
    return { x: this.flowX, z: this.flowZ, speed: this.flowSpeed, distance: this.flowDistance };
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

  begin(renderer: THREE.WebGLRenderer) {
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
    this.geometry.dispose();
    this.march.dispose();
    this.composite.dispose();
  }
}
