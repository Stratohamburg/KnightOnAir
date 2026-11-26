import * as THREE from "three";
import { buildCloudGeometry, cloudViewRay } from "../content/3d/CloudGeometry";
import type { ContentCatalog } from "../content/3d/ContentCatalog";
import { VehicleCloudWakes, cloudCutGLSL, cloudWakeGLSL, maxCloudCuts } from "./CloudWake";
import type { EraColors } from "../data/eras";
import { billowRiseRate, cloudFlowGLSL } from "./CloudFlow";
import { MAX_RASTER_LOBES, MAX_RASTER_GROUP_LOBES, type ActiveCloudField } from "./CloudLobes";
import { cloudSun } from "./CloudscapeLayout";

const cloudVertex = `
  precision highp sampler3D;
  uniform sampler3D billowNoise;
  uniform vec2 drift;
  ${cloudWakeGLSL}
  attribute vec4 cloudLighting;
  varying vec3 vWorldPos, vRestWorldPos, vNormal;
  varying vec4 vLighting;
  varying float vHeight, vWake;
  ${cloudFlowGLSL}

  float billow(vec3 local, vec3 shift) {
    vec3 at = local + shift;
    at.y -= selfTime * ${billowRiseRate.toFixed(2)};
    vec2 puffs = texture(billowNoise, at * vec3(.027, .029, .027)).rg - .5;
    return dot(puffs, vec2(11., 2.6)) * selfStrength;
  }

  vec3 billowPosition(vec3 world, vec3 n) {
    vec3 local = world - vec3(drift.x, 0., drift.y);
    vec3 shift = localBillowShift(local);
    float puff = billow(local, shift);
    float crown = mix(.42, 1., smoothstep(-.22, .86, n.y));
    world += n * puff * crown + shift * .29;
    return world;
  }

  void main() {
    vec3 world = (modelMatrix * vec4(position, 1.)).xyz;
    vec3 n = normalize(normal);
    vec3 axis = abs(n.y) < .92 ? vec3(0., 1., 0.) : vec3(1., 0., 0.);
    vec3 tangent = normalize(cross(axis, n));
    vec3 bitangent = cross(n, tangent);
    vRestWorldPos = world;
    vWorldPos = billowPosition(world, n);
    vec3 t = billowPosition(world + tangent, n) - vWorldPos;
    vec3 b = billowPosition(world + bitangent, n) - vWorldPos;
    // Keep the normal in the original hemisphere at the center of strong displacements.
    vec3 deformedNormal = cross(t, b);
    vec3 rolledNormal = normalize(deformedNormal * sign(dot(deformedNormal, n)) + n * .22);
    vNormal = normalize(mix(n, rolledNormal, .16));
    vec3 gradient;
    float offset = wakeOffset(vWorldPos - vec3(drift.x, 0., drift.y), vWake, gradient);
    float depthScale = mix(.53, 1., cloudLighting.z);
    vWorldPos += n * offset * depthScale;
    vNormal = normalize(vNormal - depthScale * (gradient - n * dot(n, gradient)));
    vLighting = cloudLighting;
    vHeight = world.y;
    gl_Position = projectionMatrix * viewMatrix * vec4(vWorldPos, 1.);
  }
`;

const cloudFragment = `
  precision highp sampler3D;
  #include <packing>
  uniform sampler2D worldDepth;
  uniform sampler3D billowNoise;
  uniform vec2 resolution, drift;
  uniform float cameraNear, cameraFar, selfTime, detailStrength, cameraDensity;
  uniform vec3 lightDir, distanceColor, cloudLit, cloudShadow, cloudRim;
  varying vec3 vWorldPos, vRestWorldPos, vNormal;
  varying vec4 vLighting;
  varying float vHeight, vWake;
  out vec4 fragColor;

  ${cloudCutGLSL}
  uniform int groupStart, groupCount;
  uniform vec4 lobePosRad[${MAX_RASTER_LOBES}], lobeMeta[${MAX_RASTER_LOBES}];
  uniform mat4 projectionMatrix;

  // Gradient in xyz and signed distance in w for the bank that produced this mesh.
  vec4 bankField(vec3 p) {
    vec4 field = vec4(0., 0., 0., 1e4);
    for (int i = 0; i < ${MAX_RASTER_GROUP_LOBES}; ++i) {
      if (i >= groupCount) break;
      vec4 l = lobePosRad[groupStart + i], m = lobeMeta[groupStart + i];
      vec3 q = p - l.xyz;
      q.y /= m.x;
      float len = length(q);
      vec4 lobe = vec4(q * vec3(m.x, 1., m.x) / max(len, .0001), (len - l.w) * m.x);
      float h = clamp(.5 + .5 * (field.w - lobe.w) / m.y, 0., 1.);
      field = mix(field, lobe, h);
      field.w -= m.y * h * (1. - h);
    }
    return field;
  }

  void main() {
    vec3 P = vWorldPos;
    vec3 N = normalize(vNormal);
    float viewZ = perspectiveDepthToViewZ(gl_FragCoord.z, cameraNear, cameraFar);
    gl_FragDepth = gl_FragCoord.z;
    float wallBlend = 0.;
    if (cutCount > 0 && all(greaterThanEqual(P, cutMin)) && all(lessThanEqual(P, cutMax))) {
      vec3 ray = normalize(P - cameraPosition);
      vec4 sphere;
      float cutter = nearestCloudCutter(P, sphere);
      if (cutter < cutBlend) {
        // Anchor the group's field value and slope to the animated, wake-deformed
        // raster surface. Its curvature still comes from the original fused lobes.
        vec4 origin = bankField(vRestWorldPos);
        float scale = 1. / max(length(origin.xyz), .12);
        vec3 slope = N - origin.xyz * scale;
        float t = 0.;
        bool hit = false;
        // A point inside any cutter cannot be solid. Skip its open chord, then
        // solve the rounded lip locally, including contacts outside the hard sphere.
        for (int step = 0; step < ${maxCloudCuts + 24}; ++step) {
          vec3 offset = ray * t;
          P = vWorldPos + offset;
          if (step > 0) cutter = nearestCloudCutter(P, sphere);
          vec3 q = P - sphere.xyz;
          if (cutter < -.002) {
            float b = dot(q, ray);
            t += -b + sqrt(max(0., b*b - dot(q, q) + sphere.w*sphere.w));
            continue;
          }
          vec4 bank = bankField(vRestWorldPos + offset);
          float bankD = (bank.w - origin.w) * scale + dot(slope, offset);
          float d = subtractCloudCut(bankD, cutter, wallBlend);
          vec3 cutNormal = -q / max(length(q), .0001);
          vec3 grad = mix(bank.xyz * scale + slope, cutNormal, wallBlend);
          if (d <= .002) {
            N = normalize(grad);
            hit = true;
            break;
          }
          if (cutter >= cutBlend) break;
          // A small tangential step avoids stalling at a grazing root.
          t += clamp(d / max(.12, -dot(grad, ray)), .006, .12);
        }
        if (!hit) discard;
        vec4 clip = projectionMatrix * viewMatrix * vec4(P, 1.);
        gl_FragDepth = .5 + .5 * clip.z / clip.w;
        viewZ = -clip.w;
      }
    }
    float sceneZ = perspectiveDepthToViewZ(texture(worldDepth, gl_FragCoord.xy / resolution).r, cameraNear, cameraFar);
    float contact = smoothstep(0., 3.4, viewZ - sceneZ);
    vec3 local = P - vec3(drift.x, selfTime * ${billowRiseRate.toFixed(2)}, drift.y);
    vec3 uv = local * vec3(.033, .046, .032);
    vec4 fibers = texture(billowNoise, uv);

    vec3 view = cameraPosition - P;
    float viewDistance = length(view);
    vec3 V = view / max(viewDistance, .001);
    float facing = abs(dot(N, V));
    float incidence = dot(N, lightDir);
    float direct = max(incidence, 0.) * vLighting.y;
    // Keep the form terminator attached to the lit slope even as the camera moves.
    float penumbra = max(.042, fwidth(direct));
    float sunlit = smoothstep(.70 - penumbra, .70 + penumbra, direct);
    float skyFill = smoothstep(-.32, .90, N.y) * mix(.45, 1., vLighting.x);
    vec3 shade = cloudShadow * mix(.57, .82, smoothstep(14., 52., vHeight));
    shade = mix(shade, mix(cloudShadow, cloudLit, .58), .73 * skyFill);
    shade = mix(shade, cloudLit * .82, .15 * smoothstep(.10, .69, direct));
    vec3 cream = mix(cloudRim, cloudLit, .79) * mix(.79, 1.12, smoothstep(.68, .98, direct));
    // The bowl receives skylight from its opening and less direct sun.
    vec3 color = mix(shade, cream, sunlit * mix(1., .52, wallBlend));

    float fresnel = pow(1. - facing, 2.5);
    float transmission = pow(max(0., dot(-V, lightDir)), 2.2) * (1. - sunlit);
    color += cloudRim * (fresnel * .035 * sunlit + transmission * .12 * (1. - vLighting.z));
    color = mix(color, distanceColor, smoothstep(95., 205., viewDistance) * .30);

    float column = facing * mix(.36, 1.6, vLighting.z);
    vec3 cruiseRay = vec3(0., ${cloudViewRay.y.toFixed(5)}, ${cloudViewRay.z.toFixed(5)});
    float alignment = smoothstep(.76, .97, dot(-V, cruiseRay));
    column = max(column, vLighting.w * alignment);
    float erosion = .10 + (.66 - fibers.g) * .82 + (.51 - fibers.b) * .24 * detailStrength;
    float alpha = mix(.15, 1., smoothstep(erosion - .12, erosion + .40, column)) * contact;
    alpha *= smoothstep(0., 6., viewDistance) * (1. - smoothstep(.16, .90, vWake) * (1. - vLighting.z) * .43);
    if (!gl_FrontFacing) alpha *= cameraDensity * .45;
    fragColor = vec4(color * alpha * .5, alpha);
  }
`;

export class CloudMeshRenderer {
  private readonly scene = new THREE.Scene();
  private readonly material: THREE.ShaderMaterial;
  private readonly clearColor = new THREE.Color();
  private readonly meshes = new Map<string, { mesh: THREE.Mesh; release: () => void }>();
  private readonly frustum = new THREE.Frustum();
  private readonly viewProjection = new THREE.Matrix4();
  private readonly sphere = new THREE.Sphere();
  readonly wake = new VehicleCloudWakes();
  groupCount = 0;
  triangleCount = 0;

  constructor(private readonly catalog: ContentCatalog, private readonly seed: number,
    private readonly worldDepth: THREE.DepthTexture, billowNoise: THREE.Data3DTexture, lobePosRad: THREE.Vector4[], lobeMeta: THREE.Vector4[]) {
    const lightDir = new THREE.Vector3(cloudSun[0] * 1.55, cloudSun[1] * .52, cloudSun[2] * 1.55).normalize();
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        worldDepth: { value: worldDepth },
        billowNoise: { value: billowNoise },
        resolution: { value: new THREE.Vector2() },
        drift: { value: new THREE.Vector2() },
        cameraNear: { value: 0 },
        cameraFar: { value: 0 },
        selfTime: { value: 0 },
        selfStrength: { value: .72 },
        detailStrength: { value: .72 },
        cameraDensity: { value: 0 },
        cutters: { value: this.wake.cuts },
        cutCount: { value: 0 },
        cutMin: { value: this.wake.cutBounds.min },
        cutMax: { value: this.wake.cutBounds.max },
        lobePosRad: { value: lobePosRad },
        lobeMeta: { value: lobeMeta },
        groupStart: { value: 0 },
        groupCount: { value: 0 },
        wakeCount: { value: 0 },
        wakeStart: { value: this.wake.starts },
        wakeEnd: { value: this.wake.ends },
        wakeMin: { value: this.wake.bounds.min },
        wakeMax: { value: this.wake.bounds.max },
        lightDir: { value: lightDir },
        distanceColor: { value: new THREE.Color("#dff5f0") },
        cloudLit: { value: new THREE.Color("#fff9ed") },
        cloudShadow: { value: new THREE.Color("#7ea8d8") },
        cloudRim: { value: new THREE.Color("#ffe8b8") },
      },
      vertexShader: cloudVertex,
      fragmentShader: cloudFragment,
    });

  }

  setLight(sun: THREE.Vector3) {
    this.material.uniforms.lightDir.value.set(sun.x * 1.55, sun.y * .52, sun.z * 1.55).normalize();
  }

  setPalette(colors: Pick<EraColors, "cloudLit" | "cloudShadow" | "cloudRim" | "skyHorizon">) {
    this.material.uniforms.cloudLit.value.set(colors.cloudLit);
    this.material.uniforms.cloudShadow.value.set(colors.cloudShadow);
    this.material.uniforms.cloudRim.value.set(colors.cloudRim);
    this.material.uniforms.distanceColor.value.set(colors.skyHorizon);
  }

  update(field: ActiveCloudField, drift: THREE.Vector2, time: number, strength: number, cameraDensity: number) {
    const { uniforms } = this.material;
    uniforms.drift.value.copy(drift);
    uniforms.selfTime.value = time;
    uniforms.selfStrength.value = strength;
    uniforms.cameraDensity.value = cameraDensity;
    const side = cameraDensity > .005 ? THREE.DoubleSide : THREE.FrontSide;
    if (this.material.side !== side) {
      this.material.side = side;
      this.material.needsUpdate = true;
    }
    for (const entry of this.meshes.values()) entry.mesh.visible = false;
    for (const group of field.clusters) {
      let entry = this.meshes.get(group.id);
      if (!entry) {
        const lease = this.catalog.geometry(`cloud/${this.seed}/${group.id}`, () => {
          const localLobes = field.lobes.slice(group.start, group.start + group.count).map(lobe => ({
            ...lobe, x: lobe.x - group.originX, z: lobe.z - group.originZ,
          }));
          return buildCloudGeometry(localLobes);
        });
        const mesh = new THREE.Mesh(lease.value, this.material);
        mesh.onBeforeRender = () => {
          this.material.uniforms.groupStart.value = mesh.userData.lobeStart;
          this.material.uniforms.groupCount.value = mesh.userData.lobeCount;
          this.material.uniformsNeedUpdate = true;
        };
        this.scene.add(mesh);
        entry = { mesh, release: lease.release };
      }
      // Retain the most recently used groups across view boundaries.
      this.meshes.delete(group.id);
      this.meshes.set(group.id, entry);
      entry.mesh.userData.lobeStart = group.start;
      entry.mesh.userData.lobeCount = group.count;
      entry.mesh.visible = true;
      entry.mesh.position.set(group.originX, 0, group.originZ);
    }
    for (const [id, entry] of this.meshes) {
      if (this.meshes.size <= 8) break;
      entry.mesh.removeFromParent();
      entry.release();
      this.meshes.delete(id);
    }
  }

  render(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera, target: THREE.WebGLRenderTarget,
    detailStrength: number) {
    const { uniforms } = this.material;
    uniforms.resolution.value.set(target.width, target.height);
    uniforms.cameraNear.value = camera.near;
    uniforms.cameraFar.value = camera.far;
    uniforms.detailStrength.value = detailStrength;
    uniforms.wakeCount.value = this.wake.count;
    uniforms.cutCount.value = this.wake.cutCount;

    this.frustum.setFromProjectionMatrix(this.viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    this.groupCount = 0;
    this.triangleCount = 0;
    for (const { mesh } of this.meshes.values()) {
      if (!mesh.visible) continue;
      this.sphere.copy(mesh.geometry.boundingSphere!);
      this.sphere.center.add(mesh.position);
      if (!this.frustum.intersectsSphere(this.sphere)) continue;
      this.groupCount++;
      this.triangleCount += mesh.geometry.index!.count / 3;
    }

    renderer.getClearColor(this.clearColor);
    const alpha = renderer.getClearAlpha();
    renderer.setRenderTarget(target);
    renderer.setClearColor(0, 0);
    renderer.clear(true, false, false);
    renderer.setClearColor(this.clearColor, alpha);
    if (this.groupCount) {
      renderer.copyTextureToTexture(this.worldDepth, target.depthTexture!);
      renderer.setRenderTarget(target);
      renderer.render(this.scene, camera);
    }
  }

  dispose() {
    for (const { mesh, release } of this.meshes.values()) {
      mesh.removeFromParent();
      release();
    }
    this.meshes.clear();
    this.material.dispose();
  }
}

