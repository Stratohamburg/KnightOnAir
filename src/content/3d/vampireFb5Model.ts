import * as THREE from "three";
import {
  fb5Boom, fb5BoomX, fb5Canopy, fb5Fin, fb5Frame, fb5Pod, fb5Probes, fb5TailFairing, fb5Tailplane, fb5Unit, fb5Wing, fb5Z, type Fb5Section,
} from "../../data/vampireFb5Sheet";
import { configuredParts } from "../../simulation/AirframeActor";
import { REFERENCE_JETS } from "../../data/referenceJetParts";
import { partAnchor } from "./anchors";
import type { ReferenceAircraft } from "./AircraftFactory";
import type { AircraftModelContext } from "./aircraftModels";
import { outlineVertex } from "./aircraftEffectSites";
import { loft, type Vertex } from "./sectionLoft";

const point = (x: number, y: number, s: number): Vertex => [x * fb5Unit, y * fb5Unit, fb5Z(s)];
const nozzle = fb5Pod[fb5Pod.length - 1];
const nozzleY = (nozzle[2] + nozzle[3]) / 2;

function ring([s, w, top, bottom]: Fb5Section, x = 0, dome = false) {
  return Array.from({length: dome ? 13 : 24}, (_, i) => {
    const angle = i * Math.PI / 12;
    const y = dome ? bottom + (top - bottom) * Math.sin(angle)
      : (top + bottom + (top - bottom) * Math.sin(angle)) / 2;
    return point(x + w * Math.cos(angle), y, s);
  });
}

type Rib = readonly [span: number, fore: number, aft: number, high: number, low: number];
function foil(ribs: readonly Rib[], chordStart = 0, chordEnd = 1, joinPod = false) {
  const profile = [[0,.4,.4],[.10,.8,.1],[.36,1,0],[.65,.74,.15],[.76,.60,.20],[1,.32,.32]];
  const section = profile.filter(([c]) => c >= chordStart && c <= chordEnd);
  return loft(ribs.map(([span, fore, aft, high, low]) => {
    const vertex = (c: number,h: number) => {
      const s = fore+(aft-fore)*c, y = low+(high-low)*h;
      if (!joinPod || span !== fb5Wing[0][0]) return point(span,y,s);
      const i = fb5Pod.findIndex(row => row[0] >= s);
      const a = fb5Pod[i-1], b = fb5Pod[i], f = (s-a[0])/(b[0]-a[0]);
      const lerp = (k:number) => a[k]+(b[k]-a[k])*f;
      const height = (2*y-lerp(2)-lerp(3))/(lerp(2)-lerp(3));
      return point(lerp(1)*Math.sqrt(Math.max(0,1-height*height)),y,s);
    };
    return [...section.map(([c,h])=>vertex(c,h)), ...section.slice().reverse().map(([c,,h])=>vertex(c,h))];
  }), true, true, chordEnd === 1 ? section.length-1 : undefined);
}

export function createVampireFb5Preview(): ReferenceAircraft {
  const parts = configuredParts(REFERENCE_JETS[fb5Frame.id]);
  return {frame:fb5Frame,parts,weapons:[],x:0,z:0,prevX:0,prevZ:0,vx:0,vz:0,heading:0,bank:0,speed:0,energy:0,
    stats:{length:fb5Frame.length,wingspan:fb5Frame.wingspan,maxSpeed:1}};
}

export function buildVampireFb5Model(ctx: AircraftModelContext) {
  const assembly = (id: string, side = 1) => {
    const owner = ctx.actor.parts.find(part => part.id === id)!;
    const {root,material} = ctx.partRoot(owner);
    const anchor = partAnchor(owner);
    root.position.set(anchor.x, anchor.y, anchor.z);
    const datum = new THREE.Group();
    datum.position.copy(root.position).negate();
    datum.scale.x = side;
    root.add(datum);
    return {id,datum,material};
  };
  const add = (part: ReturnType<typeof assembly>, name: string, make: () => THREE.BufferGeometry,
    material = part.material, skin = true) => {
    const node = ctx.mesh(ctx.geometry("vampire-fb5:"+name,make),material,part.datum);
    node.name = name;
    if (skin) ctx.effectSites.surfaces.push({partId:part.id,mesh:node});
    return node;
  };
  const body = assembly("center_body"), engine = assembly("engine_0"), tail = assembly("tail");
  const dark = ctx.paint("#253539"), glass = ctx.paint("#496779"), metal = ctx.paint("#737e80");
  const split = fb5Pod.findIndex(row => row[0] === 97);
  add(body,"fuselage",()=>loft(fb5Pod.slice(0,split+1).map(row=>ring(row)),true,false));
  add(engine,"aft-pod",()=>loft(fb5Pod.slice(split).map(row=>ring(row)),false,false));
  add(body,"canopy",()=>loft(fb5Canopy.map(row=>ring(row,0,true))),glass);
  const inner: Fb5Section = [nozzle[0],nozzle[1]*.84,nozzleY+2.45,nozzleY-2.45];
  add(engine,"nozzle-lip",()=>loft([ring(nozzle),ring(inner)],false,false),metal,false);
  add(engine,"nozzle-interior",()=>loft([ring(inner),ring([inner[0]-4,inner[1],inner[2],inner[3]])],false,true),dark,false);
  ctx.effectSites.add(engine.id,"nozzle","jetOutlet",engine.datum,point(0,nozzleY,nozzle[0]),{radius:2.45*fb5Unit});

  for (const probe of fb5Probes) {
    const side = probe.side;
    const wing = assembly(side < 0 ? "left_wing" : "right_wing",side);
    const boom = assembly(side < 0 ? "left_boom" : "right_boom",side);
    // The Observer belly view locates the inboard flap and outboard aileron.
    // Insert their end ribs into the same tapered wing to retain the silhouette.
    const ribAt = (span: number): Rib => {
      const i = fb5Wing.findIndex(rib => rib[0] >= span);
      const a = fb5Wing[i-1], b = fb5Wing[i], f = (span-a[0])/(b[0]-a[0]);
      const mix = (k:number) => a[k]+f*(b[k]-a[k]);
      return [span,mix(1),mix(2),mix(3),mix(4)];
    };
    const ribs = [...fb5Wing, ribAt(15), ribAt(53), ribAt(69)].sort((a,b)=>a[0]-b[0]);
    const skin = add(wing,"main-wing",()=>foil(ribs,0,.76,true));
    const trailing = (name: string, from: number, to: number, control = false) =>
      add(wing,name,()=>foil(ribs.filter(([span])=>span >= from && span <= to),.76,1,true),
        control ? ctx.partPaint(ctx.actor.parts.find(p=>p.id===wing.id)!,"#8b9994") : wing.material);
    trailing("wing-root-trailing-edge",11.5,15);
    trailing("flap",15,53,true);
    trailing("fixed-trailing-edge",53,69);
    const aileron = trailing("aileron",69,124.5,true);
    ctx.effectSites.add(wing.id,"tip","wingTip",aileron,outlineVertex(aileron,"x",1));
    ctx.effectSites.addWingFlow(wing.id,"wing",skin);
    add(boom,"tail-boom",()=>loft(fb5Boom.map(row=>ring(row,fb5BoomX))));
    add(boom,"tailplane-fairing",()=>loft(fb5TailFairing.map(row=>ring(row,fb5BoomX))));
    const fin = add(boom,"fin-rudder",()=>loft(fb5Fin.map(row=>ring(row,fb5BoomX))));
    ctx.effectSites.add(boom.id,"fin-tip","tailTip",fin,outlineVertex(fin,"y",1));
    // Angled mouth follows the root leading edge. Each lip has an open bore
    // and a recessed back wall, with the wing skin starting behind it.
    const intake = (scale: number, aft: number) => [[13,-5],[21,-3.5],[28,-.8],[28,2.4],[21,4.5],[13,5.2],[12.3,1]].map(([x,y]) =>
      point(20+(x-20)*scale,y*scale,43+(x-13)*.52+aft));
    add(wing,"intake-housing",()=>loft([intake(1,0),intake(1,11)],false,true));
    add(wing,"intake-lip",()=>loft([intake(.77,0),intake(1,0)],false,false),metal,false);
    add(wing,"intake-bore",()=>loft([intake(.77,5),intake(.77,0)],true,false),dark,false);
    const end = point("endSpan" in probe ? probe.endSpan : probe.span,probe.bottom,probe.station);
    const start = new THREE.Vector3(...point(probe.span,probe.top,probe.station));
    const delta = new THREE.Vector3(...end).sub(start);
    const rod = add(wing,"probe-"+side,()=>new THREE.CylinderGeometry(.012,.014,delta.length(),6),metal,false);
    rod.position.copy(start).addScaledVector(delta,.5);
    rod.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
    ctx.effectSites.add(wing.id,"probe-tip","protrusion",wing.datum,end);
  }
  add(tail,"fixed-tailplane",()=>foil(fb5Tailplane));
  add(tail,"elevator",()=>foil([[-29.8,187,197,13.3,11.8],[29.8,187,197,13.3,11.8]]));
}
