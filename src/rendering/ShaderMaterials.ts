import * as THREE from "three";
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
export function terrainMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: `${noise} varying vec3 vWorld; varying float vHeight;
      void main(){ vec4 world=modelMatrix*vec4(position,1.); float h=fbm(world.xz*.035)*1.7-1.2; world.y=h; vWorld=world.xyz; vHeight=h; gl_Position=projectionMatrix*viewMatrix*world; }`,
    fragmentShader: `${noise} varying vec3 vWorld; varying float vHeight; uniform float time;
      void main(){ vec2 p=vWorld.xz; float n=fbm(p*.15); vec2 cell=floor((p+vec2(sin(p.y*.015)*2.,0.))/7.);
        float field=hash(cell); vec3 grass=mix(vec3(.16,.25,.12),vec3(.34,.39,.19),field);
        vec3 col=grass*(.7+n*.5); float road=1.-smoothstep(.15,.4,abs(mod(p.x+p.y*.26,28.)-14.));
        col=mix(col,vec3(.69,.65,.47),road*.55);
        float river=abs(p.x-12.-sin(p.y*.018)*9.-sin(p.y*.047)*3.);
        col=mix(col,vec3(.13,.32,.30),1.-smoothstep(2.2,2.8,river));
        col+=sin(p.y*3.)*.008*smoothstep(4.,6.,river);
        float fog=smoothstep(35.,125.,distance(cameraPosition,vWorld));
        col=mix(col,vec3(.39,.50,.40),fog*.8);
        gl_FragColor=vec4(col,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.DoubleSide,
  });
}
export function cloudMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, opacity: { value: 0.22 } },
    vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `${noise} varying vec2 vUv; uniform float time,opacity;
      void main(){vec2 p=vUv*2.-1.; float density=fbm(vUv*5.+vec2(time*.008,0.));
        float edge=1.-smoothstep(.15,1.,length(p*vec2(.8,1.2))); float a=smoothstep(.27,.66,density)*edge*opacity;
        gl_FragColor=vec4(mix(vec3(.75,.82,.77),vec3(.94,.96,.88),density),a);}`,
    transparent: true,
    depthWrite: false,
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
    vertexShader: `varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform vec3 color;uniform float time;varying vec3 vP;void main(){gl_FragColor=vec4(color*(1.+.18*sin(vP.z*8.+time*20.)),1.);}`,
  });
}
