import * as THREE from "three";
import { TERRAIN } from "../simulation/Terrain";
import { aircraftShadowGLSL } from "./AircraftShadows";
import { cloudShadowGLSL } from "./Cloudscape";
import { cloudSun } from "./CloudscapeLayout";
import { vegetationWindGLSL, vegetationWindUniforms } from "./VegetationWind";
const noise = `
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y); }
float fbm(vec2 p) { return noise(p)*.55+noise(p*2.03)*.28+noise(p*4.01)*.17; }
`;
export const landscapeLight = `
  uniform vec3 haze;
  const vec3 landscapeSun = normalize(vec3(${cloudSun.join(", ")}));
  vec3 aerialPerspective(vec3 color, vec3 world) {
    float range = distance(cameraPosition, world);
    float lowland = 1. - smoothstep(-1., 19., world.y);
    float fog = smoothstep(70., 220., range) * mix(.73, 1., lowland);
    return mix(color, haze, fog);
  }
`;
export function aircraftMaterial(
  color: THREE.ColorRepresentation,
  accent = false,
) {
  return new THREE.ShaderMaterial({
    uniforms: {
      baseColor: { value: new THREE.Color(color) },
      damage: { value: 0 },
      heat: { value: 0 },
      time: { value: 0 },
      highlight: { value: 0 },
      accent: { value: accent ? 1 : 0 },
    },
    vertexShader: `varying vec3 vNormal; varying vec3 vView; varying vec3 vLocal;
      void main(){vLocal=position; vec4 mv=modelViewMatrix*vec4(position,1.); vNormal=normalize(normalMatrix*normal); vView=-mv.xyz; gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `${noise}
      uniform vec3 baseColor; uniform float damage,heat,time,highlight,accent;
      varying vec3 vNormal,vView,vLocal;
      void main(){vec3 n=normalize(vNormal); float light=max(0.,dot(n,normalize(vec3(-.6,1.,.8))));
        float grain=fbm(vLocal.xz*12.); float burn=smoothstep(.45,.72,grain+damage*.5)*damage;
        vec3 col=baseColor*(.52+light*.55)*(1.-burn*.8);
        float rim=pow(1.-max(0.,dot(n,normalize(vView))),3.);
        col+=vec3(.68,.86,.78)*rim*.24; col+=vec3(1.,.23,.08)*heat*(.6+sin(time*22.)*.15);
        col=mix(col,vec3(.76,1.,.85),highlight*(.35+.2*sin(time*5.)));
        col+=accent*.035; gl_FragColor=vec4(col,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
export function terrainMaterial(detailTexture: THREE.Texture, wind = vegetationWindUniforms()) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...wind,
      detailTexture: { value: detailTexture },
      grass: { value: new THREE.Color("#68ad76") },
      road: { value: new THREE.Color("#94c779") },
      sand: { value: new THREE.Color("#d8c78d") },
      stone: { value: new THREE.Color("#839e8e") },
      haze: { value: new THREE.Color("#a9e4ed") },
      waveDetail: { value: 0 },
      waveStrength: { value: 0 },
    },
    vertexShader: `attribute float roadMask;
      varying vec3 vWorld, vNormal;
      varying float vRoad;
      void main(){
        vec4 world=modelMatrix*vec4(position,1.);
        vWorld=world.xyz;
        vNormal=normalize(mat3(modelMatrix)*normal);
        vRoad=roadMask;
        gl_Position=projectionMatrix*viewMatrix*world;
      }`,
    fragmentShader: `${noise} ${vegetationWindGLSL} ${cloudShadowGLSL} ${aircraftShadowGLSL} ${landscapeLight}
      varying vec3 vWorld, vNormal;
      varying float vRoad;
      uniform vec3 grass, road, sand, stone;
      uniform sampler2D detailTexture;
      uniform float waveDetail, waveStrength;
      void main(){
        vec3 normalWorld = normalize(vNormal);
        vec2 at = vWorld.xz;
        float broad = fbm(at * .036);
        vec2 grainUv = at * .064;
        vec3 grain = texture2D(detailTexture, grainUv).rgb;
        vec2 rotated = vec2(dot(at, vec2(.81, .59)), dot(at, vec2(-.59, .81)));
        vec3 relief = texture2D(detailTexture, rotated * .023 + .37).rgb;
        float detail = mix(grain.r, relief.r, .43);
        float bankHeight = vWorld.y - (${TERRAIN.waterLevel});
        float shore = 1. - smoothstep(.15, 2.35, bankHeight + (detail - .5) * .54);
        float track = smoothstep(.24, .88, vRoad) * (1. - shore);
        float slope = 1. - normalWorld.y;
        float rock = smoothstep(.075, .29, slope + (broad - .5) * .09);
        vec3 meadow = grass * mix(vec3(.66, .85, .79), vec3(1.42, 1.25, .83), broad);
        meadow *= mix(vec3(.71, .82, .78), vec3(1.34, 1.23, .88), smoothstep(.25, .82, detail));
        float grassWeight = (1. - rock) * (1. - track) * (1. - shore);
        if (grassWeight > .05) {
          vec2 localWind = sampleWind(at);
          float gustSpeed = .9 + length(localWind) * .9 + windGust * .22;
          float phase = dot(at, windDirection) * .32 + broad * 3. - sceneTime * gustSpeed;
          float wave = sin(phase) * .78;
          if (waveDetail > 0.)
            wave += sin(phase * 1.7 + broad * 4.) * .22 * waveDetail;
          meadow *= 1. + wave * waveStrength;
        }
        float strata = texture2D(detailTexture, vec2(rotated.x * .061, vWorld.y * .14 + relief.g * .13)).g;
        vec3 col = mix(meadow, stone * (.66 + .52 * strata + .16 * grain.g), rock);
        col = mix(col, mix(road, sand, .49) * (.82 + .36 * grain.b), track * .76);
        float drySand = smoothstep(.15, 1.35, bankHeight);
        vec3 beach = sand * (.70 + .26 * drySand + .25 * grain.b + .13 * relief.b);
        col = mix(col, beach, shore);
        float diffuse = smoothstep(-.1, .93, dot(normalWorld, landscapeSun));
        float valleyShade = 1. - smoothstep(0., 6., vWorld.y);
        vec3 lighting = mix(vec3(.68, .81, .88), vec3(1.25, 1.16, .96), diffuse);
        float surfaceLight = cloudLightAt(vWorld);
        float planeLight = aircraftSunlightAt(vWorld);
        vec3 shade = mix(vec3(.67, .82, .89), vec3(1.), surfaceLight);
        col *= lighting * (1. - .12 * valleyShade) * shade * surfaceLight * mix(1., planeLight, surfaceLight);
        gl_FragColor=vec4(aerialPerspective(col, vWorld),1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.FrontSide,
  });
}
export function skyDomeMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      zenith: { value: new THREE.Color("#72b8d2") },
      horizon: { value: new THREE.Color("#d9f0e5") },
      sun: { value: new THREE.Color("#fff0c7") },
    },
    vertexShader: `varying vec3 vDirection;
      void main(){
        vec4 world=modelMatrix*vec4(position,1.);
        vDirection=normalize(world.xyz-cameraPosition);
        gl_Position=projectionMatrix*viewMatrix*world;
        gl_Position.z=gl_Position.w;
      }`,
    fragmentShader: `${landscapeLight}
      varying vec3 vDirection; uniform vec3 zenith,horizon,sun;
      void main(){
        vec3 direction=normalize(vDirection);
        float height=smoothstep(-.06,.68,direction.y);
        vec3 col=mix(horizon,zenith,height);
        float sunGlow=pow(max(0.,dot(direction,landscapeSun)),18.);
        col+=sun*sunGlow*.18;
        gl_FragColor=vec4(col,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
  });
}
export function waterMaterial(wind = vegetationWindUniforms()) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...wind,
      time: { value: 0 },
      tint: { value: new THREE.Color("#399db4") },
      haze: { value: new THREE.Color("#a9e4ed") },
      shallows: { value: new THREE.Color("#8ddabd") },
      foamColor: { value: new THREE.Color("#e7f7dc") },
    },
    vertexShader: `varying vec3 vWorld; varying float vDepth;
      void main(){
        vec4 world = modelMatrix * vec4(position, 1.);
        vDepth = ${TERRAIN.waterLevel} - world.y;
        world.y = ${TERRAIN.waterLevel};
        vWorld = world.xyz;
        gl_Position=projectionMatrix*viewMatrix*world;
      }`,
    fragmentShader: `${noise} ${vegetationWindGLSL} ${cloudShadowGLSL} ${aircraftShadowGLSL} ${landscapeLight}
      varying vec3 vWorld;
      varying float vDepth;
      uniform float time;
      uniform vec3 tint, shallows, foamColor;
      void main(){
        if (vDepth <= 0.) discard;
        vec2 at = vWorld.xz;
        vec2 localWind = sampleWind(at);
        float flow = .035 + length(localWind) * .045 + windGust * .018;
        vec2 windOffset = windDirection * time * flow;
        float wave = noise(at * vec2(.23, .58) + windOffset + localWind * .07);
        float ripple = sin(dot(at, windDirection) * .27 + at.y * 1.65 + wave * 2. - time * (.72 + length(localWind) * .5));
        float shallow = 1. - smoothstep(.05, 2.5, vDepth);
        vec3 col = mix(tint * (.80 + .28 * wave), shallows, shallow * .92);
        vec3 view = normalize(cameraPosition - vWorld);
        vec3 normalWorld = normalize(vec3((wave - .5) * .17, 1., ripple * .105));
        float fresnel = pow(1. - clamp(dot(view, normalWorld), 0., 1.), 4.);
        col = mix(col, haze, fresnel * .64);
        float sunlight = pow(max(0., dot(reflect(-landscapeSun, normalWorld), view)), 20.);
        col += foamColor * sunlight * .28;
        float edge = 1. - smoothstep(.05, .34, vDepth + ripple * .11);
        float streak = (1. - smoothstep(.04, .18, abs(vDepth - .52 + ripple * .13))) * smoothstep(.56, .82, wave);
        col = mix(col, foamColor, max(edge * .72, streak * .32));
        float surfaceLight = cloudLightAt(vWorld);
        col *= surfaceLight * mix(1., aircraftSunlightAt(vWorld), surfaceLight * .88);
        gl_FragColor=vec4(aerialPerspective(col, vWorld),1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>}`,
  });
}
export function effectMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      color: { value: new THREE.Color("#f6ca7a") },
      opacity: { value: 1 },
      mode: { value: 0 },
    },
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `${noise} varying vec2 vUv; uniform float time,opacity,mode; uniform vec3 color;
      void main(){vec2 p=vUv*2.-1.;float d=length(p);float n=fbm(p*5.+time);float a=pow(max(0.,1.-d),1.5)*(0.7+n*.6);
        if(mode>0.5) a=(1.-smoothstep(.7,.97,d))*smoothstep(.45,.7,d);
        gl_FragColor=vec4(color,a*opacity);}`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}
export function crosshairMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      progress: { value: 0 },
      time: { value: 0 },
      ready: { value: 0 },
    },
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec2 vUv;uniform float progress,time,ready;
      void main(){vec2 p=vUv*2.-1.;float d=length(p);float r=mix(.87,.42,progress);
        float ring=1.-smoothstep(.018,.04,abs(d-r));float inner=1.-smoothstep(.006,.018,abs(d-.16));
        float ticks=(1.-smoothstep(.012,.025,min(abs(p.x),abs(p.y))))*step(.2,d)*(1.-step(.95,d));
        float disk=(1.-smoothstep(0.,.95,d))*.12;
        vec3 col=mix(vec3(1.,.65,.27),vec3(.42,1.,.63),ready);
        gl_FragColor=vec4(col,max(max(ring,inner*.7),ticks*.8)*.9+disk);}`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}
export function projectileMaterial(color: THREE.ColorRepresentation) {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(color) }, time: { value: 0 } },
    vertexShader: `varying vec3 vP;void main(){vP=position; vec4 local=vec4(position,1.);
      #ifdef USE_INSTANCING
        local=instanceMatrix*local;
      #endif
      gl_Position=projectionMatrix*modelViewMatrix*local;}`,
    fragmentShader: `uniform vec3 color;uniform float time;varying vec3 vP;void main(){gl_FragColor=vec4(color*(1.+.18*sin(vP.z*8.+time*20.)),1.);}`,
  });
}
