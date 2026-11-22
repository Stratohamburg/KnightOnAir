import * as THREE from "three";

const densityShader = `
float hash3(vec3 p) {
  p = fract(p * .3183099 + vec3(.1, .22, .37));
  p *= 17.;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f *= f * (3. - 2. * f);
  vec2 a = mix(vec2(hash3(i), hash3(i + vec3(0,0,1))),
               vec2(hash3(i + vec3(1,0,0)), hash3(i + vec3(1,0,1))), f.x);
  vec2 b = mix(vec2(hash3(i + vec3(0,1,0)), hash3(i + vec3(0,1,1))),
               vec2(hash3(i + vec3(1,1,0)), hash3(i + vec3(1,1,1))), f.x);
  vec2 c = mix(a, b, f.y);
  return mix(c.x, c.y, f.z);
}

float density(vec3 p) {
  vec3 seedOffset = vec3(seed, seed * .37, seed * .71);
  float coverage = noise3(p * vec3(2.8, 1.7, 2.8) + seedOffset + vec3(time * .025, 0, time * .012));
  float erosion = noise3(p * 7. + seedOffset - vec3(0, time * .016, 0));
  float bank = 1. - length(p * vec3(1.2, .97, 1.2));
  float base = smoothstep(-.71, -.51, p.y + coverage * .09);
  return base * smoothstep(-.05, .27, bank + (coverage - .46) * .58 - erosion * .13);
}
`;

export function cloudVolumeMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      center: { value: new THREE.Vector3() },
      radii: { value: new THREE.Vector3(1, 1, 1) },
      seed: { value: 0 },
      time: { value: 0 },
      steps: { value: 0 },
      sunSteps: { value: 0 },
      worldDepth: { value: null },
      viewport: { value: new THREE.Vector2() },
      cameraNear: { value: 0 },
      cameraFar: { value: 0 },
      topColor: { value: new THREE.Color("#fff6e5") },
      middleColor: { value: new THREE.Color("#f3ebdd") },
      shadowColor: { value: new THREE.Color("#8cb6dc") },
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      #include <packing>
      uniform vec3 center, radii, topColor, middleColor, shadowColor;
      uniform vec2 viewport;
      uniform float seed, time, cameraNear, cameraFar;
      uniform int steps, sunSteps;
      uniform sampler2D worldDepth;
      varying vec3 vWorld;
      ${densityShader}
      void main() {
        vec3 direction = normalize(vWorld - cameraPosition);
        vec3 origin = (cameraPosition - center) / radii;
        vec3 localRay = direction / radii;
        vec3 safeRay = mix(vec3(-1.), vec3(1.), step(vec3(0.), localRay)) * max(abs(localRay), vec3(1e-6));
        vec3 slabA = (-1. - origin) / safeRay;
        vec3 slabB = (1. - origin) / safeRay;
        vec3 entry = min(slabA, slabB), exit = max(slabA, slabB);
        float forward = -(viewMatrix * vec4(direction, 0.)).z;
        float depth = texture2D(worldDepth, gl_FragCoord.xy / viewport).x;
        float surface = -perspectiveDepthToViewZ(depth, cameraNear, cameraFar) / forward;
        float start = max(max(max(entry.x, entry.y), entry.z), cameraNear / forward);
        float end = min(min(min(exit.x, exit.y), exit.z), surface);
        if (end <= start || steps == 0) discard;

        float stride = (end - start) / float(steps);
        float transmittance = 1.;
        vec3 color = vec3(0.);
        for (int i = 0; i < 16; i++) {
          if (i >= steps || transmittance < .018) break;
          vec3 p = origin + localRay * (start + (float(i) + .5) * stride);
          float d = density(p);
          if (d < .008) continue;
          float shade = 0.;
          for (int j = 0; j < 4; j++) {
            if (j >= sunSteps) break;
            shade += density(p + vec3(-.11, .22, .13) * float(j + 1));
          }
          float light = smoothstep(-.48, .72, p.y - .25 * p.x + .2 * p.z) - shade * .13;
          vec3 band = mix(shadowColor, middleColor, smoothstep(.19, .35, light));
          band = mix(band, topColor, smoothstep(.51, .68, light));
          band += vec3(1., .76, .5) * (1. - d) * smoothstep(.15, .65, light) * .08;
          float opacity = 1. - exp(-d * stride * .38);
          color += band * (opacity * transmittance);
          transmittance *= 1. - opacity;
        }
        float alpha = 1. - transmittance;
        if (alpha < .003) discard;
        gl_FragColor = vec4(color / alpha, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
}

export function cloudCameraDensity(x: number, y: number, z: number) {
  const height = THREE.MathUtils.smoothstep(y, -.71, -.44);
  const radius = Math.hypot(x * 1.2, y * .97, z * 1.2);
  return height * (1 - THREE.MathUtils.smoothstep(radius, .44, .95));
}

export class CloudDepthPass {
  private readonly target: THREE.WebGLRenderTarget;
  private readonly copy = new THREE.Scene();
  private readonly camera = new THREE.Camera();
  private readonly geometry = new THREE.PlaneGeometry(2, 2);
  private readonly material: THREE.ShaderMaterial;

  constructor(renderer: THREE.WebGLRenderer) {
    this.target = new THREE.WebGLRenderTarget(1, 1, {
      type: renderer.extensions.has("EXT_color_buffer_float") ? THREE.HalfFloatType : THREE.UnsignedByteType,
      depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedIntType),
    });
    this.material = new THREE.ShaderMaterial({
      uniforms: { color: { value: this.target.texture } },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
      fragmentShader: `
        uniform sampler2D color;
        varying vec2 vUv;
        void main() {
          gl_FragColor = texture2D(color, vUv);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(this.geometry, this.material);
    quad.frustumCulled = false;
    this.copy.add(quad);
  }

  begin(renderer: THREE.WebGLRenderer) {
    const { width, height } = renderer.domElement;
    this.target.setSize(width, height);
    renderer.setRenderTarget(this.target);
  }

  finish(renderer: THREE.WebGLRenderer) {
    renderer.setRenderTarget(null);
    renderer.render(this.copy, this.camera);
  }

  get depth() {
    return this.target.depthTexture!;
  }

  dispose() {
    this.target.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}
