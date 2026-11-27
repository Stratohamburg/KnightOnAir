import * as THREE from "three";
import { TERRAIN } from "../simulation/Terrain";
import type { AircraftLivery } from "../data/aircraftLiveries";
import { aircraftShadowGLSL } from "./AircraftShadows";
import { cloudShadowGLSL } from "./CloudShadowShader";
import { landscapeLightUniforms } from "./SortieLighting";
import { vegetationWindGLSL, vegetationWindUniforms } from "./VegetationWind";
const noise = `
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y); }
float fbm(vec2 p) { return noise(p)*.55+noise(p*2.03)*.28+noise(p*4.01)*.17; }
`;
export const landscapeLight = `
  uniform vec3 haze, valleyFog, sunTint, landscapeSun;
  uniform float sunlightAmount, ambientAmount, weatherVisibility;
  vec3 aerialPerspective(vec3 color, vec3 world) {
    vec3 toPoint = world - cameraPosition;
    float range = length(toPoint);
    // Keep the top-down playable view crystal clear and sunny; only soften far screen top edge.
    float farFog = smoothstep(155. * weatherVisibility, 285. * weatherVisibility, range);
    vec3 fogColor = mix(haze, sunTint, .12);
    return mix(color * ambientAmount, fogColor, farFog * mix(.48, .30, weatherVisibility));
  }
`;
export function aircraftMaterial(
  color: THREE.ColorRepresentation,
  accent = false,
  livery?: AircraftLivery,
) {
  const primary = new THREE.Color(livery?.primary ?? color);
  const secondary = new THREE.Color(livery?.secondary ?? color);
  const trim = new THREE.Color(livery?.trim ?? color);
  const liveryEnabled = livery && !accent ? 1 : 0;
  const pattern = {
    solid: 0, band: 1, panel: 2, checker: 3, cross: 4, stripe: 5, tailband: 6, anchor: 7,
  }[livery?.pattern ?? "solid"] ?? 0;
  return new THREE.ShaderMaterial({
    uniforms: {
      baseColor: { value: primary },
      liverySecondary: { value: secondary },
      liveryTrim: { value: trim },
      liveryPattern: { value: pattern },
      liveryStripeCenter: { value: livery?.stripeCenter ?? .5 },
      liveryStripeWidth: { value: livery?.stripeWidth ?? .08 },
      liveryPanelContrast: { value: livery?.panelContrast ?? 0 },
      liveryEnabled: { value: liveryEnabled },
      liveryDetail: { value: 1 },
      damage: { value: 0 },
      heat: { value: 0 },
      time: { value: 0 },
      highlight: { value: 0 },
      accent: { value: accent ? 1 : 0 },
      cloudVeil: { value: 0 },
      cloudTint: { value: new THREE.Color("#f3f9fc") },
      sceneSun: { value: new THREE.Vector3(-.6, 1, .8).normalize() },
      sceneAmbient: { value: 1 },
      sceneDirect: { value: 1 },
      cloudShadowMap: { value: null },
      cloudShadowCenter: { value: new THREE.Vector2() },
      cloudShadowStrength: { value: 0 },
      cloudShadowSun: { value: new THREE.Vector3(-.6, 1, .8).normalize() },
    },
    vertexShader: `varying vec3 vNormal; varying vec3 vView; varying vec3 vLocal; varying vec3 vWorld;
      #ifdef AIRCRAFT_PIECES
        attribute float pieceId;
        uniform mat4 pieceTransform[AIRCRAFT_PIECES];
        uniform vec4 pieceState[AIRCRAFT_PIECES], pieceFinish[AIRCRAFT_PIECES];
        uniform vec4 pieceLivery[AIRCRAFT_PIECES], piecePattern[AIRCRAFT_PIECES];
        uniform vec3 pieceTrim[AIRCRAFT_PIECES];
        varying vec4 vState, vFinish, vLivery, vPattern;
        varying vec3 vTrim;
        #endif
        void main(){
          vLocal=position;
          mat4 modelView=modelViewMatrix;
          vec4 localPosition=vec4(position,1.);
          mat3 normals=normalMatrix;
          #ifdef AIRCRAFT_PIECES
          int id=int(pieceId);
          vState=pieceState[id]; vFinish=pieceFinish[id]; vLivery=pieceLivery[id]; vPattern=piecePattern[id]; vTrim=pieceTrim[id];
          if(vState.w<.5){gl_Position=vec4(2.,2.,2.,1.);return;}
          mat4 transform=pieceTransform[id];
          localPosition=transform*localPosition;
          normals*=transpose(inverse(mat3(transform)));
          #endif
          vec4 mv=modelView*localPosition;
          vWorld=(modelMatrix*localPosition).xyz;
          vNormal=normalize(normals*normal); vView=-mv.xyz; gl_Position=projectionMatrix*mv;
        }`,
    fragmentShader: `${noise} ${cloudShadowGLSL}
      uniform vec3 baseColor, liverySecondary, liveryTrim, cloudTint, sceneSun;
      uniform float liveryPattern,liveryStripeCenter,liveryStripeWidth,liveryPanelContrast,liveryEnabled,liveryDetail;
      uniform float damage,heat,time,highlight,accent,cloudVeil,sceneAmbient,sceneDirect;
      #ifdef AIRCRAFT_PIECES
      varying vec4 vState, vFinish, vLivery, vPattern;
      varying vec3 vTrim;
      #define damage vState.x
      #define heat vState.y
      #define highlight vState.z
      #define baseColor vFinish.rgb
      #define accent vFinish.w
      #endif
      varying vec3 vNormal,vView,vLocal,vWorld;
      void main(){
        vec3 n=normalize(vNormal);
        vec3 secondary=liverySecondary, trim=liveryTrim;
        float pattern=liveryPattern, stripeCenter=liveryStripeCenter, stripeWidth=liveryStripeWidth;
        float panelContrast=liveryPanelContrast*liveryDetail, enabled=liveryEnabled;
        #ifdef AIRCRAFT_PIECES
          secondary=vLivery.rgb; trim=vTrim; enabled=vLivery.w;
          pattern=vPattern.x; stripeCenter=vPattern.y; stripeWidth=vPattern.z; panelContrast=vPattern.w;
        #endif
        float lightDot=dot(n,sceneSun);
        float wrap=smoothstep(-.42,.78,lightDot);
        float shadow=cloudLightAt(vWorld);
        float panel=fbm(vLocal.xz*2.35+vLocal.yz*1.2)-.5;
        float bandDistance=abs(fract(vLocal.z*.16+stripeCenter)-.5);
        float band=1.-smoothstep(stripeWidth,stripeWidth+.035,bandDistance);
        float checkerCell=mod(floor(abs(vLocal.x)*1.55)+floor((vLocal.z+4.)*1.55),2.);
        float checker=step(.5,checkerCell);
        float crossArm=max(1.-smoothstep(.11,.24,abs(vLocal.x)),1.-smoothstep(.11,.24,abs(vLocal.z)));
        float tailSection=smoothstep(1.05,2.25,abs(vLocal.z));
        float stripeSection=1.-smoothstep(stripeWidth,stripeWidth+.06,abs(fract(vLocal.x*.22+stripeCenter)-.5));
        float anchorStem=(1.-smoothstep(.055,.14,abs(vLocal.x)))*smoothstep(-1.2,.65,vLocal.z);
        float anchorBar=(1.-smoothstep(.055,.14,abs(vLocal.z+.15)))*(1.-smoothstep(.32,.48,abs(vLocal.x)));
        float anchorHook=1.-smoothstep(.06,.16,abs(length(vec2(vLocal.x,vLocal.z+.58))-.28));
        float anchorMark=max(max(anchorStem,anchorBar),max(anchorHook*.72, stripeSection*tailSection));
        vec3 painted=baseColor;
        painted=mix(painted,painted*(1.+panel*panelContrast),step(.5,pattern));
        painted=mix(painted,secondary,band*step(.5,pattern)*(1.-step(2.5,pattern))*enabled*.72);
        painted=mix(painted,secondary,checker*step(2.5,pattern)*enabled*.78);
        painted=mix(painted,trim,crossArm*step(3.5,pattern)*enabled*.78);
        painted=mix(painted,secondary,stripeSection*step(4.5,pattern)*enabled*.78);
        painted=mix(painted,secondary,tailSection*step(5.5,pattern)*enabled*.78);
        painted=mix(painted,trim,anchorMark*step(6.5,pattern)*enabled*.74);
        painted=mix(painted,trim,(1.-smoothstep(0.,.08,abs(vLocal.y)))*step(1.5,pattern)*enabled*.32);
        float grain=fbm(vLocal.xz*12.); float burn=smoothstep(.45,.72,grain+damage*.5)*damage;
        vec3 warmLight=vec3(1.16,1.08,.92);
        vec3 coolLight=vec3(.60,.76,.88);
        vec3 lighting=mix(coolLight,warmLight,wrap)*mix(.72,1.,shadow);
        float direct=max(0.,lightDot)*sceneDirect;
        vec3 col=painted*lighting*(.62*sceneAmbient+direct*.62)*(1.-burn*.8);
        float rim=pow(1.-max(0.,dot(n,normalize(vView))),2.7);
        col+=mix(coolLight,cloudTint,shadow)*rim*mix(.09,.16,liveryDetail); col+=vec3(1.,.23,.08)*heat*(.6+sin(time*22.)*.15);
        col=mix(col,vec3(.76,1.,.85),highlight*(.35+.2*sin(time*5.)));
        // Soft luminous cloud wrap when flying through clouds (bounded so player silhouette stays crisp).
        float veil = clamp(cloudVeil, 0., .32);
        col = mix(col, cloudTint * (1.04 + .16 * wrap), veil * (.55 + .45 * rim));
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
      ...landscapeLightUniforms(),
      detailTexture: { value: detailTexture },
      grass: { value: new THREE.Color("#68ad76") },
      road: { value: new THREE.Color("#94c779") },
      sand: { value: new THREE.Color("#e4d49d") },
      stone: { value: new THREE.Color("#709783") },
      flower: { value: new THREE.Color("#88bd79") },
      wetland: { value: new THREE.Color("#6da98c") },
      shoulder: { value: new THREE.Color("#9fc17b") },
      rock: { value: new THREE.Color("#5f7f79") },
      haze: { value: new THREE.Color("#dff5f0") },
      valleyFog: { value: new THREE.Color("#d9f3f2") },
      sunTint: { value: new THREE.Color("#fff3cc") },
      cloudShadowColor: { value: new THREE.Color("#7ea8d8") },
      waveDetail: { value: 0 },
      waveStrength: { value: 0 },
    },
    vertexShader: `attribute float roadMask, elevation, shoreMask, talusWeight, sedimentWeight, flowAccumulation;
      attribute vec4 landformWeights, reliefWeights;
      varying vec3 vWorld, vNormal;
      varying float vRoad, vElevation, vShore, vTalus, vSediment, vFlow;
      varying vec4 vLandform, vRelief;
      void main(){
        vec4 world=modelMatrix*vec4(position,1.);
        vWorld=world.xyz;
        vNormal=normalize(mat3(modelMatrix)*normal);
        vRoad=roadMask;
        vElevation=elevation;
        vLandform=landformWeights;
        vShore=shoreMask;
        vTalus=talusWeight;
        vSediment=sedimentWeight;
        vFlow=flowAccumulation;
        vRelief=reliefWeights;
        gl_Position=projectionMatrix*viewMatrix*world;
      }`,
    fragmentShader: `${noise} ${cloudShadowGLSL} ${aircraftShadowGLSL} ${landscapeLight}
      varying vec3 vWorld, vNormal;
      varying float vRoad, vElevation, vShore, vTalus, vSediment, vFlow;
      varying vec4 vLandform, vRelief;
      uniform vec3 grass, road, sand, stone, cloudShadowColor;
      uniform vec3 flower, wetland, shoulder, rock;
      uniform sampler2D detailTexture;
      uniform float waveDetail, waveStrength;
      void main(){
        vec3 normalWorld = normalize(vNormal);
        vec3 viewDir = normalize(cameraPosition - vWorld);
        vec2 at = vWorld.xz;
        float broad = fbm(at * .028);
        vec2 grainUv = at * .052;
        vec4 detailSample = texture2D(detailTexture, grainUv);
        vec3 grain = detailSample.rgb;
        float regionMask = detailSample.a;
        vec3 fineSample = texture2D(detailTexture, at * .38 + vec2(.17, -.09)).rgb;
        vec3 crispSample = texture2D(detailTexture, at * .72 + vec2(-.23, .41)).rgb;
        vec2 rotated = vec2(dot(at, vec2(.81, .59)), dot(at, vec2(-.59, .81)));
        vec3 relief = texture2D(detailTexture, rotated * .021 + .37).rgb;
        float detail = mix(grain.r, relief.r, .16);
        float patchNoise = fbm(at * .072 + vec2(2.4, -1.7));
        float patchBand = smoothstep(.22, .78, patchNoise);
        float blockMask = smoothstep(.24, .76, regionMask);
        float fleckMask = smoothstep(.28, .72, fineSample.b);
        float crispFleck = smoothstep(.3, .7, crispSample.r);
        vec2 blockUv = at * vec2(.12, .095);
        vec2 blockCell = floor(blockUv);
        float blockValue = smoothstep(.18, .82, hash(blockCell + vec2(7.4, -3.1)));
        vec2 blockEdgeDistance = min(fract(blockUv), 1. - fract(blockUv));
        float blockEdge = 1. - smoothstep(.035, .12, min(blockEdgeDistance.x, blockEdgeDistance.y));
        float bankHeight = vWorld.y - (${TERRAIN.waterLevel});
        float shore = 1. - smoothstep(.15, 2.35, bankHeight + (detail - .5) * .48);
        float track = smoothstep(.24, .88, vRoad) * (1. - shore);
        float slope = 1. - normalWorld.y;
        float rockSlope = smoothstep(.085, .31, slope + (broad - .5) * .08);

        // Clean painterly meadow gradient: warm sunlit chartreuse slopes to cool jade hollows.
        vec3 meadowCool = grass * vec3(.62, .88, .70);
        vec3 meadowWarm = grass * vec3(1.22, 1.12, .68);
        vec3 meadow = mix(meadowCool, meadowWarm, smoothstep(.22, .78, broad));
        vec3 blockCool = vec3(.86, 1.04, .89);
        vec3 blockWarm = vec3(1.08, 1.04, .76);
        vec3 blockTint = mix(blockCool, blockWarm, patchBand);
        meadow *= mix(vec3(.86), blockTint, (.42 + .4 * waveDetail) * blockMask);
        meadow *= mix(.94, 1.06, smoothstep(.24, .82, detail));
        meadow = mix(meadow, meadow * mix(vec3(.86, 1.08, .82), vec3(1.16, 1.0, .68), fleckMask), .36 + .2 * waveDetail);
        meadow = mix(meadow, meadow * mix(vec3(.88, 1.03, .86), vec3(1.08, .99, .78), crispFleck), .18);
        meadow *= mix(vec3(.84, .94, .84), vec3(1.1, 1.05, .78), blockValue * (.24 + .2 * blockMask));
        meadow = mix(meadow, meadow * vec3(.76, .9, .8), blockEdge * .18);

        float groundRock = max(rockSlope, vLandform.w);
        float meadowWeight = clamp(vLandform.x, 0., 1.) * (1. - track) * (1. - shore);
        vec3 flowerMeadow = mix(meadow, flower, .62);
        vec3 wet = mix(meadow, wetland, .72);
        vec3 shoulderGrass = mix(meadow, shoulder, .28);
        meadow = mix(meadow, flowerMeadow, clamp(vLandform.y, 0., 1.));
        meadow = mix(meadow, wet, clamp(vLandform.z, 0., 1.));
        meadow = mix(meadow, shoulderGrass, smoothstep(.52, .86, vElevation));

        // Keep the large-scale relief legible from the fixed top-down camera.
        // Ridge and peak colors stay saturated enough to survive bright sunlight,
        // while basin and saddle colors keep the valley network readable.
        vec3 ridgeGreen = vec3(.43, .67, .42);
        vec3 peakGreen = vec3(.55, .73, .47);
        vec3 basinGreen = vec3(.31, .60, .47);
        vec3 saddleGreen = vec3(.47, .69, .45);
        meadow = mix(meadow, ridgeGreen, clamp(vRelief.x * .52, 0., .58));
        meadow = mix(meadow, peakGreen, clamp(vRelief.y * .42, 0., .48));
        meadow = mix(meadow, basinGreen, clamp(vRelief.w * .34, 0., .38));
        meadow = mix(meadow, saddleGreen, clamp(vRelief.z * .28, 0., .3));
        float ridgeBand = smoothstep(.18, .44, vRelief.x) * (1. - smoothstep(.44, .72, vRelief.x));
        meadow = mix(meadow, vec3(.34, .56, .39), ridgeBand * .22);

        float strata = texture2D(detailTexture, vec2(rotated.x * .055, vWorld.y * .13 + relief.g * .12)).g;
        float rockFleck = smoothstep(.3, .7, texture2D(detailTexture, rotated * .16 + vec2(.31, .19)).b);
        vec3 col = mix(meadow, stone * (.78 + .24 * strata + .06 * grain.g), groundRock);
        col = mix(col, rock * (.72 + .38 * strata) * mix(.88, 1.12, rockFleck), clamp(max(vLandform.w, vTalus * .72), 0., 1.));
        col = mix(col, shoulder * (.82 + .16 * strata), clamp(vSediment * .42 + vFlow * .12, 0., .55));
        col = mix(col, mix(road, sand, .52) * (.88 + .24 * grain.b), track * .74);
        float drySand = smoothstep(.15, 1.35, bankHeight);
        vec3 beach = sand * (.78 + .22 * drySand + .16 * grain.b + .1 * relief.b);
        col = mix(col, beach, shore);

        float diffuse = smoothstep(-.12, .92, dot(normalWorld, landscapeSun));
        float valleyShade = 1. - smoothstep(0., 6.5, vWorld.y);
        vec3 coolShadow = mix(vec3(.68, .82, .92), cloudShadowColor, .35);
        vec3 warmLight = mix(vec3(1.18, 1.13, .98), sunTint * 1.15, .42);
        vec3 lighting = mix(coolShadow, warmLight, diffuse * sunlightAmount);

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
      ...landscapeLightUniforms(),
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
        col+=sun*sunHalo*sunlightAmount;
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
      ...landscapeLightUniforms(),
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
        col += mix(foamColor, sunTint, .55) * (broadSun + sparkle) * sunlightAmount;
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
