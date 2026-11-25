import * as THREE from "three";
import type { BodyRing, FighterSheet, SurfaceRib, WingReading } from "../../data/pistonFighterSheets";
import { partFromRecipe } from "../../simulation/parts";
import type { AircraftModelContext, AircraftVisualFrame } from "./aircraftModels";
import type { ReferenceAircraft } from "./AircraftFactory";
import { partAnchor } from "./anchors";
import { loft, type Vertex } from "./sectionLoft";

export const fighterUnit = .025;
const segments = 24;
const mix = THREE.MathUtils.lerp;

export function fighterFrame(sheet: FighterSheet): AircraftVisualFrame {
  const a = sheet.assembly;
  return { id: a.frameId, geometryProfile: a.profile, era: "ww2", shape: "plane",
    name: sheet.title, role: "单发螺旋桨战斗机", color: a.color, accent: a.trim,
    wingspan: 460 * fighterUnit, length: a.length * fighterUnit };
}

function frontEdges(rows: WingReading[], x: number) {
  const i = rows.findIndex(row => row[0] >= x);
  const b = rows[i < 0 ? rows.length - 1 : i];
  const a = rows[Math.max(0, i < 0 ? rows.length - 1 : i - 1)];
  const t = b[0] === a[0] ? 0 : (x - a[0]) / (b[0] - a[0]);
  return [mix(a[1]+a[3], b[1]+b[3],t)/2, mix(a[2]+a[4], b[2]+b[4],t)/2];
}

function wingRibs(sheet: FighterSheet) {
  const result = sheet.readings.plan.map<SurfaceRib>(([x,lu,ll,ru,rl]) => {
    const [top, bottom] = frontEdges(sheet.readings.front, x);
    return [250-x,(lu+ru)/2,(ll+rl)/2,top,bottom];
  }).reverse();
  const [,fore,aft,high,low] = result[0];
  result.unshift([0,fore-1,aft+3,high,low]);
  return result;
}

function ribAt(rows: SurfaceRib[], x: number): SurfaceRib {
  const i = rows.findIndex(row => row[0] >= x);
  if (i < 0) return rows[rows.length-1];
  const b = rows[i];
  const a = rows[Math.max(0,i-1)];
  const t = a === b ? 0 : (x-a[0])/(b[0]-a[0]);
  return [x,mix(a[1],b[1],t),mix(a[2],b[2],t),mix(a[3],b[3],t),mix(a[4],b[4],t)];
}

const chordSamples = [0,.025,.08,.16,.30,.48,.68,.84,.95,1];
function skinFraction(chord: number, upper: boolean) {
  // A rounded leading edge, maximum thickness near 30% and a sharp trailing
  // edge. The registered front silhouette supplies the actual rib thickness.
  const thickness = 5 * (.2969*Math.sqrt(chord)-.126*chord-.3516*chord**2+.2843*chord**3-.1036*chord**4);
  const camber = chord <= .2 ? (2*.2*chord-chord**2)/.04 : ((1-.4)+.4*chord-chord**2)/.64;
  return .40 + .10 * camber + (upper ? 1 : -1) * thickness;
}
const peak = skinFraction(.30,true), trough = Math.min(...chordSamples.map(c => skinFraction(c,false)));
const ribY = (r: SurfaceRib, c: number, upper: boolean) =>
  mix(r[4],r[3],(skinFraction(c,upper)-trough)/(peak-trough));

export function createFighterPreview(sheet: FighterSheet): ReferenceAircraft {
  const frame = fighterFrame(sheet);
  const z = (station: number) => (sheet.assembly.length/2-station)*fighterUnit;
  const firstRib = wingRibs(sheet)[1];
  const wing = (port: boolean) => partFromRecipe(port ? "left_wing" : "right_wing", {
    role: "wing", side: port ? -1 : 1, slot: port ? "leftWing" : "rightWing", parentId: "center_body",
    x: (port ? 1 : -1)*firstRib[0]*fighterUnit, y: (95-firstRib[3])*fighterUnit, z: z(firstRib[1]-14),
  });
  return { frame, parts: [
    partFromRecipe("center_body", { role: "body" }), wing(true), wing(false),
    partFromRecipe("engine_0",{ role: "engine", slot: "nose", parentId: "center_body", y: 0, z: z(sheet.assembly.propStation) }),
    partFromRecipe("tail",{ role: "tail", slot: "tail", parentId: "center_body", y: 0, z: z(sheet.assembly.fin[0][0]) }),
  ], weapons: [], x:0,z:0,prevX:0,prevZ:0,vx:0,vz:0,heading:0,bank:0,speed:0,energy:0,
  stats: { wingspan:frame.wingspan,length:frame.length,maxSpeed:1 } };
}

export function buildPistonFighter(ctx: AircraftModelContext, sheet: FighterSheet) {
  const a = sheet.assembly;
  const spit = a.profile === "spitfireVb";
  // Author in registered plate coordinates. Positive lateral distance is port
  // in the nose-on camera. The model roots own anchors in game units.
  const point = (x: number, ordinate: number, station: number): Vertex =>
    [x*fighterUnit,(95-ordinate)*fighterUnit,(a.length/2-station)*fighterUnit];
  const part = (id: string) => {
    const owner = ctx.actor.parts.find(p => p.id === id)!;
    const {root,material} = ctx.partRoot(owner);
    const anchor = partAnchor(owner);
    root.position.set(anchor.x,anchor.y,anchor.z);
    const datum = new THREE.Group();
    datum.position.copy(root.position).negate();
    root.add(datum);
    return {owner,datum,material};
  };
  const center = part("center_body"), tail = part("tail"), engine = part("engine_0");
  const metal = ctx.paint(a.trim), dark = ctx.paint("#293235"), glass = ctx.paint("#547684");
  const add = (parent: THREE.Object3D, name: string, make: () => THREE.BufferGeometry, material: THREE.Material) => {
    const node = ctx.mesh(ctx.geometry(a.profile+":"+name, make),material,parent);
    node.name = name;
    return node;
  };
  const shell = (rows: BodyRing[], dome = false) => loft(rows.map(([s,w,h,l]) =>
    Array.from({length:dome ? 13 : segments}, (_,i) => {
      const angle = i*Math.PI/12;
      return point(w*Math.cos(angle),dome ? l-(l-h)*Math.sin(angle) : (l+h)/2-(l-h)*Math.sin(angle)/2,s);
    })));
  const bodyRows: BodyRing[] = [...a.body, ...sheet.aftSections.map(r =>
    [r.station,(r.right-r.left)/2,r.deck,r.belly] as BodyRing)].sort((a,b)=>a[0]-b[0]);
  const spinnerEnd = spit ? 26 : 16;
  const cowlEnd = spit ? 108 : 56;
  add(engine.datum,"spinner",()=>shell(bodyRows.filter(r=>r[0]<=spinnerEnd)),metal);
  add(engine.datum,"engine-cowling",()=>shell(bodyRows.filter(r=>r[0]>=spinnerEnd && r[0]<=cowlEnd)),spit ? engine.material : dark);
  add(center.datum,"fuselage",()=>shell(bodyRows.filter(r=>r[0]>=cowlEnd)),center.material);
  add(center.datum,"canopy",()=>shell(a.canopy,true),glass);
  for (const i of spit ? [2,6] : [2,4,6]) {
    const [s,w,h,l] = a.canopy[i];
    add(center.datum,"canopy-frame-"+i,()=>shell([[s-.6,w+.35,h-.35,l],[s+.6,w+.35,h-.35,l]],true),center.material);
  }
  add(tail.datum,"fin-rudder",()=>shell(a.fin),tail.material);

  const rod = (parent: THREE.Object3D,name: string,from: Vertex,to: Vertex,r: number,mat: THREE.Material,rEnd=r) => {
    const start = new THREE.Vector3(...from), end = new THREE.Vector3(...to);
    const direction = end.clone().sub(start);
    const node = add(parent,name,()=>new THREE.CylinderGeometry(rEnd*fighterUnit,r*fighterUnit,direction.length(),8),mat);
    node.position.copy(start).lerp(end,.5);
    node.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
    return node;
  };
  const hub = add(engine.datum,"propeller-hub",()=>new THREE.CylinderGeometry(4*fighterUnit,4*fighterUnit,4*fighterUnit,12).rotateX(Math.PI/2),dark);
  hub.position.set(...point(0,95,a.propStation));
  for (let i=0;i<3;i++) {
    const blade = add(hub,"propeller-blade",()=> {
      const stations = [[3,1.4,0],[12,2,0],[26,3.4,1],[40,3.9,1.8],[a.propRadius-3,2,2],[a.propRadius,.5,1.5]];
      return loft(stations.map(([radius,width,sweep]) => Array.from({length:8},(_,j): Vertex => {
        const angle = j*Math.PI/4;
        return [(sweep+width*Math.cos(angle))*fighterUnit,radius*fighterUnit,(.85*Math.sin(angle)+.16*width*Math.cos(angle))*fighterUnit];
      })));
    },dark);
    blade.rotation.z = Math.PI + i*Math.PI*2/3;
  }
  ctx.registerPropeller(hub,engine.owner);
  const ribs = wingRibs(sheet);
  const skin = (rows: SurfaceRib[]) => loft(rows.map(r => {
    const v = (c: number,upper: boolean) => point(r[0],ribY(r,c,upper),mix(r[1],r[2],c)-14);
    return [...chordSamples.map(c=>v(c,true)),...chordSamples.slice(1,-1).reverse().map(c=>v(c,false))];
  }));
  const foldSpan = 204;
  for (const port of [true,false]) {
    const wing = part(port ? "left_wing" : "right_wing");
    const wingSpace = new THREE.Group();
    wing.datum.add(wingSpace);
    wingSpace.scale.x = port ? 1 : -1;
    const tailSkin = add(tail.datum,"tailplane-elevator",()=>skin(a.tailplane),tail.material);
    tailSkin.scale.x = wingSpace.scale.x;
    if (spit) {
      add(wingSpace,"main-wing",()=>skin(ribs),wing.material);
      rod(wingSpace,"cannon-fairing",point(85,118,83),point(85,118,49),2.3,dark,.85);
    } else {
      const seam = ribAt(ribs,foldSpan);
      add(wingSpace,"main-wing",()=>skin([...ribs.filter(r=>r[0]<foldSpan),seam]),wing.material);
      add(wingSpace,"folding-tip",()=>skin([seam,...ribs.filter(r=>r[0]>foldSpan)]),wing.material);
    }
    const skinPoint = (x: number, planY: number): Vertex => {
      const r = ribAt(ribs,x);
      const chord = THREE.MathUtils.clamp((planY-r[1])/(r[2]-r[1] || 1),0,1);
      return point(x,ribY(r,chord,true)-.2,planY-14);
    };
    const hingeInner = spit ? 114 : 100, hingeOuter = spit ? 202 : 210;
    const hingeFore = spit ? 176 : 142, hingeTip = spit ? 159 : 130;
    rod(wingSpace,"aileron-hinge",skinPoint(hingeInner,hingeFore),skinPoint(hingeOuter,hingeTip),.42,dark);
    rod(wingSpace,"aileron-inner-edge",skinPoint(hingeInner,hingeFore),skinPoint(hingeInner,ribAt(ribs,hingeInner)[2]),.42,dark);
    if (!spit) {
      const r = ribAt(ribs,foldSpan);
      for(let i=1;i<chordSamples.length;i++) {
        const prev = mix(r[1],r[2],chordSamples[i-1]), next = mix(r[1],r[2],chordSamples[i]);
        rod(wingSpace,"fold-line-"+i,skinPoint(foldSpan,prev),skinPoint(foldSpan,next),.37,metal);
      }
    }
    for (let i=0;i<(spit?3:1);i++) {
      const s = spit ? 32+i*13 : 48;
      const x = (port ? 1 : -1)*(spit ? 15 : 21);
      rod(engine.datum,"exhaust-"+(port?"port-":"starboard-")+i,point(x,spit?90:110,s),
        point(x+(port?2:-2),spit?92:112,s+8),spit?2.1:2.5,dark);
    }
    // Conform the national marking to the upper skin at its actual span and chord.
    const markX = spit ? 151 : 145;
    const markZ = spit ? 121 : 113;
    const disc = (radius: number, color: string, layer: number) => {
      const make = () => {
        const v: number[] = [], indices: number[] = [];
        for (let ring=0;ring<=4;ring++) for(let i=0;i<32;i++) {
          const ang = i*Math.PI/16;
          const x = markX + ring/4*radius*Math.cos(ang);
          const s = markZ + ring/4*radius*Math.sin(ang);
          const r = ribAt(ribs,x);
          v.push(...point(x,ribY(r,(s+14-r[1])/(r[2]-r[1]),true)-.36-layer*.09,s));
          if(ring>0) {
            const k = ring*32+i, next = ring*32+(i+1)%32;
            indices.push(k-32,k,next,next,next-32,k-32);
          }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute("position",new THREE.Float32BufferAttribute(v,3));g.setIndex(indices);g.computeVertexNormals();
        return g;
      };
      add(wingSpace,"roundel-"+layer,make,ctx.paint(color));
    };
    if (spit) { disc(17,"#263954",0); disc(6,"#a24039",1); }
    else disc(17,"#a43730",0);
    if (port) {
      const y = spit ? 121 : ribY(ribAt(ribs,186),0,true);
      if(spit) rod(wingSpace,"pitot-strut",point(183,110,98),point(184,y,98),.8,dark);
      rod(wingSpace,"pitot",point(spit ? 184 : 186,y,spit ? 98 : 79),point(spit ? 184 : 186,y,spit ? 89 : 56),.8,dark,.48);
    }
    if (spit) {
      const offset = port ? 40 : 38;
      const radius = port ? 5.5 : 14.5;
      // Inlet rim and recessed dark core are separate from the outer casing.
      const ring = (s: number, width: number, height: number, mid: number): Vertex[] => {
        const count = port ? 20 : 8;
        return Array.from({length:count},(_,i) => {
          const angle=i*2*Math.PI/count;
          const coord=(n:number)=>port ? n : Math.sign(n)*Math.abs(n)**.24;
          return point(offset+width*coord(Math.cos(angle)),mid-height*coord(Math.sin(angle)),s);
        });
      };
      const s = port ? 102 : 124;
      const end = port ? 139 : 170;
      const h = port ? 5.5 : 7;
      const mid = port ? 132.5 : 133;
      add(wingSpace,"cooler-"+(port?"oil":"radiator"),()=>loft([ring(s,radius,h,mid),ring(s+9,radius,h,mid),ring(end,radius*.85,h*.50,mid-3)],false,true),wing.material);
      add(wingSpace,"cooler-lip-"+port,()=>loft([ring(s,radius*.79,h*.73,mid),ring(s,radius,h,mid)],false,false),metal);
      add(wingSpace,"cooler-inlet-"+port,()=>loft([ring(s+2,radius*.79,h*.73,mid),ring(s,radius*.79,h*.73,mid)],true,false),dark);
    }
  }
  const mast = spit ? [208,72,208,45] : [165,65,160,36];
  rod(center.datum,"antenna-mast",point(0,mast[1],mast[0]),point(0,mast[3],mast[2]),1.2,metal,.55);
  const wheelStation = spit ? 358 : 331;
  const wheelY = spit ? 116 : 108.5;
  rod(tail.datum,"tailwheel-strut",point(0,wheelY-8,wheelStation-3),point(0,wheelY,wheelStation),1.1,metal);
  const wheel = add(tail.datum,"tailwheel",()=>new THREE.CylinderGeometry(3.2*fighterUnit,3.2*fighterUnit,2.2*fighterUnit,12).rotateZ(Math.PI/2),dark);
  wheel.position.set(...point(0,wheelY,wheelStation));
  if (!spit) rod(tail.datum,"arrestor-hook",point(0,109,278),point(0,125,300),1.2,metal);
}
