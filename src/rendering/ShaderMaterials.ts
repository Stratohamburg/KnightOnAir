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
  uniform vec3 haze, valleyFog, sunTint;
  const vec3 landscapeSun = normalize(vec3(${cloudSun.join(", ")}));
  vec3 aerialPerspective(vec3 color, vec3 world) {
    vec3 toPoint = world - cameraPosition;
    float range = length(toPoint);
    vec3 ray = toPoint / max(range, .0001);
    // Lowland exponential valley mist wraps rivers and hollows in a soft milky veil.
    float lowland = 1. - smoothstep(-2.5, 16., world.y);
    float valleyMist = (1. - exp(-max(0., range - 36.) * .0095)) * lowland * .68;
    // Distance haze dissolves terrain chunks cleanly before the 200-unit streaming horizon.
    float farFog = smoothstep(78., 196., range);
    float fog = clamp(max(farFog, valleyMist), 0., 1.);
    float sunGlow = pow(max(0., dot(ray, landscapeSun)), 5.) * smoothstep(55., 180., range);
    vec3 fogColor = mix(valleyFog, haze, smoothstep(.2, .85, farFog));
    fogColor = mix(fogColor, sunTint, sunGlow * .34);
    return mix(color, fogColor, fog);
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
      cloudVeil: { value: 0 },
      cloudTint: { value: new THREE.Color("#f3f9fc") },
    },
    vertexShader: `varying vec3 vNormal; varying vec3 vView; varying vec3 vLocal;
      void main(){vLocal=position; vec4 mv=modelViewMatrix*vec4(position,1.); vNormal=normalize(normalMatrix*normal); vView=-mv.xyz; gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `${noise}
      uniform vec3 baseColor, cloudTint; uniform float damage,heat,time,highlight,accent,cloudVeil;
      varying vec3 vNormal,vView,vLocal;
      void main(){vec3 n=normalize(vNormal); float light=max(0.,dot(n,normalize(vec3(-.6,1.,.8))));
        float grain=fbm(vLocal.xz*12.); float burn=smoothstep(.45,.72,grain+damage*.5)*damage;
        vec3 col=baseColor*(.54+light*.55)*(1.-burn*.8);
        float rim=pow(1.-max(0.,dot(n,normalize(vView))),3.);
        col+=vec3(.68,.86,.78)*rim*.24; col+=vec3(1.,.23,.08)*heat*(.6+sin(time*22.)*.15);
        col=mix(col,vec3(.76,1.,.85),highlight*(.35+.2*sin(time*5.)));
        // Soft luminous cloud wrap when flying through clouds (bounded so player silhouette stays crisp).
        float veil = clamp(cloudVeil, 0., .32);
        col = mix(col, cloudTint * (1.04 + .16 * light), veil * (.55 + .45 * rim));
        col += cloudTint * rim * veil * .48;
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
      sand: { value: new THREE.Color("#e4d49d") },
      stone: { value: new THREE.Color("#839e8e") },
      haze: { value: new THREE.Color("#dff5f0") },
      valleyFog: { value: new THREE.Color("#d9f3f2") },
      sunTint: { value: new THREE.Color("#fff3cc") },
      cloudShadowColor: { value: new THREE.Color("#7ea8d8") },
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
      uniform vec3 grass, road, sand, stone, cloudShadowColor;
      uniform sampler2D detailTexture;
      uniform float waveDetail, waveStrength;
      void main(){
        vec3 normalWorld = normalize(vNormal);
        vec3 viewDir = normalize(cameraPosition - vWorld);
        vec2 at = vWorld.xz;
        float broad = fbm(at * .028);
        vec2 grainUv = at * .052;
        vec3 grain = texture2D(detailTexture, grainUv).rgb;
        vec2 rotated = vec2(dot(at, vec2(.81, .59)), dot(at, vec2(-.59, .81)));
        vec3 relief = texture2D(detailTexture, rotated * .021 + .37).rgb;
        float detail = mix(grain.r, relief.r, .52);
        float bankHeight = vWorld.y - (${TERRAIN.waterLevel});
        float shore = 1. - smoothstep(.15, 2.35, bankHeight + (detail - .5) * .48);
        float track = smoothstep(.24, .88, vRoad) * (1. - shore);
        float slope = 1. - normalWorld.y;
        float rock = smoothstep(.085, .31, slope + (broad - .5) * .08);

        // Clean painterly meadow gradient: warm sunlit chartreuse slopes to cool jade hollows.
        vec3 meadowCool = grass * vec3(.72, .91, .92);
        vec3 meadowWarm = grass * vec3(1.32, 1.24, .84);
        vec3 meadow = mix(meadowCool, meadowWarm, smoothstep(.22, .78, broad));
        meadow *= mix(.91, 1.09, smoothstep(.24, .82, detail));

        float grassWeight = (1. - rock) * (1. - track) * (1. - shore);
        if (grassWeight > .05) {
          vec2 localWind = sampleWind(at);
          float gustSpeed = .9 + length(localWind) * .9 + windGust * .22;
          float phase = dot(at, windDirection) * .28 + broad * 3.4 - sceneTime * gustSpeed;
          float wave = sin(phase) * .76;
          if (waveDetail > 0.)
            wave += sin(phase * 1.72 + broad * 4.2) * .24 * waveDetail;
          // Two-tone grass wave: golden sunlit crests and cool teal-green troughs.
          vec3 crestTint = vec3(1.18, 1.16, .88);
          vec3 troughTint = vec3(.82, .94, .97);
          meadow *= mix(troughTint, crestTint, clamp(.5 + wave * (.5 + waveStrength * 1.8), 0., 1.));
          meadow *= 1. + wave * waveStrength * .65;
          // Soft velvet rim sheen across wind-swept meadows.
          float velvet = pow(1. - clamp(dot(normalWorld, viewDir), 0., 1.), 2.4);
          meadow += sunTint * velvet * .11 * (.5 + .5 * wave);
        }

        float strata = texture2D(detailTexture, vec2(rotated.x * .055, vWorld.y * .13 + relief.g * .12)).g;
        vec3 col = mix(meadow, stone * (.72 + .42 * strata + .12 * grain.g), rock);
        col = mix(col, mix(road, sand, .52) * (.88 + .24 * grain.b), track * .74);
        float drySand = smoothstep(.15, 1.35, bankHeight);
        vec3 beach = sand * (.78 + .22 * drySand + .16 * grain.b + .1 * relief.b);
        col = mix(col, beach, shore);

        float diffuse = smoothstep(-.12, .92, dot(normalWorld, landscapeSun));
        float valleyShade = 1. - smoothstep(0., 6.5, vWorld.y);
        vec3 coolShadow = mix(vec3(.68, .82, .92), cloudShadowColor, .35);
        vec3 warmLight = mix(vec3(1.18, 1.13, .98), sunTint * 1.15, .42);
        vec3 lighting = mix(coolShadow, warmLight, diffuse);

        float surfaceLight = cloudLightAt(vWorld);
        float planeLight = aircraftSunlightAt(vWorld);
        // Distinct cool-blue/lavender cloud shadows over sunny golden-green hills.
        vec3 cloudShadeTint = mix(mix(vec3(.62, .76, .92), cloudShadowColor, .45), vec3(1.), surfaceLight);
        col *= lighting * (1. - .09 * valleyShade) * cloudShadeTint * mix(.72, 1., surfaceLight) * mix(1., planeLight, surfaceLight);
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
      zenith: { value: new THREE.Color("#4d9ed6") },
      horizon: { value: new THREE.Color("#dff5f0") },
      sun: { value: new THREE.Color("#fff3cc") },
      haze: { value: new THREE.Color("#dff5f0") },
      valleyFog: { value: new THREE.Color("#d9f3f2") },
      sunTint: { value: new THREE.Color("#fff3cc") },
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
        float height=smoothstep(-.08,.62,direction.y);
        vec3 midSky=mix(horizon,zenith,.44);
        vec3 col=mix(horizon,midSky,smoothstep(-.05,.24,direction.y));
        col=mix(col,zenith,smoothstep(.18,.78,direction.y));
        // Soft horizon glow band and dreamy sun halo.
        float horizonGlow=exp(-abs(direction.y)*7.5);
        col=mix(col,mix(horizon,sun,.32),horizonGlow*.38);
        float sunDot=max(0.,dot(direction,landscapeSun));
        float sunHalo=pow(sunDot,10.)*.28+pow(sunDot,96.)*.65;
        col+=sun*sunHalo;
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
      haze: { value: new THREE.Color("#dff5f0") },
      valleyFog: { value: new THREE.Color("#d9f3f2") },
      sunTint: { value: new THREE.Color("#fff3cc") },
      skyZenith: { value: new THREE.Color("#4d9ed6") },
      skyHorizon: { value: new THREE.Color("#dff5f0") },
      shallows: { value: new THREE.Color("#93e4ca") },
      foamColor: { value: new THREE.Color("#eefbe8") },
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
      uniform vec3 tint, shallows, foamColor, skyZenith, skyHorizon;
      void main(){
        if (vDepth <= 0.) discard;
        vec2 at = vWorld.xz;
        vec2 localWind = sampleWind(at);
        float flow = .035 + length(localWind) * .045 + windGust * .018;
        vec2 windOffset = windDirection * time * flow;
        float wave = noise(at * vec2(.23, .58) + windOffset + localWind * .07);
        float waveFine = noise(at * vec2(.78, .64) - windOffset * 1.45);
        float ripple = sin(dot(at, windDirection) * .27 + at.y * 1.65 + wave * 2. - time * (.72 + length(localWind) * .5));
        float shallow = 1. - smoothstep(.05, 2.6, vDepth);
        vec3 col = mix(tint * (.82 + .26 * wave), shallows, shallow * .9);
        vec3 view = normalize(cameraPosition - vWorld);
        vec3 normalWorld = normalize(vec3((wave - .5) * .16 + (waveFine - .5) * .07, 1., ripple * .1));
        float fresnel = pow(1. - clamp(dot(view, normalWorld), 0., 1.), 3.4);
        vec3 reflDir = reflect(-view, normalWorld);
        vec3 skyRefl = mix(skyHorizon, skyZenith, smoothstep(.0, .65, max(0., reflDir.y)));
        col = mix(col, skyRefl, clamp(fresnel * .76 + .08, 0., .84));
        // Soft broad sun sheen + crisp sparkling highlights.
        float specDot = max(0., dot(reflect(-landscapeSun, normalWorld), view));
        float broadSun = pow(specDot, 18.) * .32;
        float sparkle = pow(specDot, 96.) * smoothstep(.52, .86, waveFine) * .85;
        col += mix(foamColor, sunTint, .55) * (broadSun + sparkle);
        float edge = 1. - smoothstep(.05, .36, vDepth + ripple * .11);
        float streak = (1. - smoothstep(.04, .18, abs(vDepth - .52 + ripple * .13))) * smoothstep(.56, .82, wave);
        col = mix(col, foamColor, max(edge * .74, streak * .34));
        float surfaceLight = cloudLightAt(vWorld);
        col *= mix(.76, 1., surfaceLight) * mix(1., aircraftSunlightAt(vWorld), surfaceLight * .88);
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
