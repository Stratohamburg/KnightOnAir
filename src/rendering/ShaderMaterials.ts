import * as THREE from "three";
import { vegetationWindGLSL, vegetationWindUniforms } from "./VegetationWind";
const noise = `
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y); }
float fbm(vec2 p) { return noise(p)*.55+noise(p*2.03)*.28+noise(p*4.01)*.17; }
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
export function terrainMaterial(wind = vegetationWindUniforms()) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...wind,
      grass: { value: new THREE.Color("#68ad76") },
      road: { value: new THREE.Color("#94c779") },
      waveDetail: { value: 0 },
      waveStrength: { value: 0 },
    },
    vertexShader: `attribute float surfaceMask; attribute float roadMask; attribute float shoreMask; attribute float grassMask;
      varying vec3 vWorld; varying vec3 vNormal; varying float vSurface; varying float vRoad; varying float vShore; varying float vGrass;
      void main(){
        vec4 world=modelMatrix*vec4(position,1.);
        vWorld=world.xyz; vNormal=normalize(normalMatrix*normal);
        vSurface=surfaceMask; vRoad=roadMask; vShore=shoreMask; vGrass=grassMask;
        gl_Position=projectionMatrix*viewMatrix*world;
      }`,
    fragmentShader: `${noise} ${vegetationWindGLSL}
      varying vec3 vWorld; varying vec3 vNormal; varying float vSurface; varying float vRoad; varying float vShore; varying float vGrass;
      uniform vec3 grass,road; uniform float waveDetail,waveStrength;
      void main(){
        vec3 sand=vec3(.91,.72,.42); vec3 water=vec3(.24,.74,.84); vec3 rock=vec3(.38,.65,.53);
        vec3 col = vSurface < .5 ? grass : vSurface < 1.5 ? road : vSurface < 2.5 ? sand : vSurface < 3.5 ? water : rock;
        float light=max(0.,dot(normalize(vNormal),normalize(vec3(-.45,1.,.65))));
        float band=light < .32 ? .76 : light < .68 ? .93 : 1.08;
        float grain=fbm(vWorld.xz*.035)-.5;
        col*=band + grain*.08;
        if (vSurface < .5 && vGrass > .1 && vRoad < .3) {
          vec2 at = vWorld.xz;
          vec2 localWind = sampleWind(at);
          float gustSpeed = .9 + length(localWind) * .9 + windGust * .22;
          float zone = noise(at * .036);
          float phase = dot(at, windDirection) * .32 + zone * 1.85 - sceneTime * gustSpeed;
          float wave = sin(phase) * .78;
          if (waveDetail > 0.)
            wave += sin(phase * 1.7 + zone * 4.) * .22 * waveDetail;
          float weight = smoothstep(.1,.85,vGrass) * (1. - smoothstep(.12,.3,vRoad));
          col *= 1. + wave * weight * waveStrength;
          col += vec3(.052,.044,.008) * weight * max(0.,wave) * waveStrength;
        }
        col=mix(col,vec3(.95,.83,.60),vShore*.35);
        col=mix(col,vec3(.92,.79,.58),vRoad*.18);
        float fog=smoothstep(70.,240.,distance(cameraPosition,vWorld));
        col=mix(col,vec3(.68,.86,.96),fog*.72);
        gl_FragColor=vec4(col,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.FrontSide,
  });
}
export function cloudMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color("#fff6e5") },
      middleColor: { value: new THREE.Color("#f3ebdd") },
      shadowColor: { value: new THREE.Color("#b7d2ea") },
      time: { value: 0 },
      shell: { value: 0 },
    },
    vertexShader: `varying vec3 vNormal; varying vec3 vWorld; varying vec3 vLocal; varying vec3 vTint;
      void main(){vLocal=position; vTint=vec3(1.);
      vec4 local=vec4(position,1.);
      vec3 n=normal;
      #ifdef USE_INSTANCING
        local=instanceMatrix*local;
        n=mat3(instanceMatrix)*n;
      #endif
      #ifdef USE_INSTANCING_COLOR
        vTint=instanceColor;
      #endif
      vNormal=normalize(mat3(modelMatrix)*n);
      vec4 world=modelMatrix*local;vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`,
    fragmentShader: `${noise} varying vec3 vNormal; varying vec3 vWorld; varying vec3 vLocal; varying vec3 vTint;
      uniform vec3 topColor,middleColor,shadowColor; uniform float time,shell;
      void main(){vec3 n=normalize(vNormal); float light=dot(n,normalize(vec3(-.45,1.,.65)))*.5+.5; float grain=fbm(vLocal.xz*.18+time*.004)-.5;
        vec3 col=mix(shadowColor,middleColor,smoothstep(.28,.58,light)); col=mix(col,topColor,smoothstep(.62,.9,light));
        float rim=pow(1.-max(0.,dot(n,normalize(cameraPosition-vWorld))),2.2);
        col+=vec3(1.,.83,.68)*rim*mix(.055,.14,shell);
        col*=1.+grain*mix(.025,.075,shell);
        gl_FragColor=vec4(col*vTint,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>}`,
    transparent: false,
    depthWrite: true,
    depthTest: true,
    side: THREE.FrontSide,
  });
}

export function waterMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, tint: { value: new THREE.Color("#399db4") } },
    vertexShader: `varying vec3 vWorld; void main(){vec4 world=modelMatrix*vec4(position,1.);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`,
    fragmentShader: `${noise} varying vec3 vWorld; uniform float time; uniform vec3 tint;
      void main(){float wave=fbm(vWorld.xz*.045+vec2(time*.018,time*.012)); vec3 shallow=tint*1.9; vec3 deep=tint*.72; vec3 col=mix(deep,shallow,wave); gl_FragColor=vec4(col,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>}`,
    side: THREE.DoubleSide,
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
