import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Scene, Vector3 } from "three";
import { airframeById } from "../src/data/aircrafts";
import { ProceduralAircraft } from "../src/content/3d/AircraftFactory";
import { selectDamageSite } from "../src/content/fx/SurfaceDamage";
import { Random } from "../src/services/Random";
import { AirflowLines } from "../src/content/fx/AirflowLines";
import { AircraftEffectSites } from "../src/content/3d/aircraftEffectSites";
import { AircraftFlightEffects } from "../src/content/fx/AircraftFlightEffects";
import { CombatEffects } from "../src/content/fx/CombatEffects";
import type { CombatSnapshot, WorldEvent } from "../src/simulation/types";
import { hitEntity } from "../src/simulation/HitTest";
import { World } from "../src/simulation/World";

describe("aircraft flight effects", () => {
  it("retains one muzzle cloud, solid flash and casing per preview barrel at low quality", () => {
    const world = new World(airframeById("heron_09"),491,{director:false,supply:false});
    const p = world.player, model = new ProceduralAircraft(p), effects = new CombatEffects(new Scene());
    p.bank = .8;
    model.update(0,0);
    world.previewFire();
    const events = world.consumeEvents().filter(event => event.type === "weapon_fired");
    expect(events.length).toBeGreaterThan(1);
    effects.update(0,new PerspectiveCamera(),"low",[],undefined,events,
      [{id:p.id, pose:world.actorPose(p), parts:p.parts,model}]);
    const pools = effects.diagnostics.pools;
    expect([pools.gunSmoke.active,pools.casings.active,pools.flashes.active]).toEqual(Array(3).fill(events.length));
    effects.dispose(); model.dispose(); world.dispose();
  });
  it("passes through an interplane gap and attributes the next contact to its deck", () => {
    const world = new World(airframeById("heron_09"),491,{director:false});
    const p = world.player;
    p.heading = p.bank = 0;
    const wing = p.parts.find(part => part.layeredWing && part.side === 1 && part.centerline?.segmentRole === "mount")!;
    const polygon = wing.silhouette![0];
    const x = polygon.reduce((sum,v) => sum+v.x,0)/polygon.length;
    const z = polygon.reduce((sum,v) => sum+v.z,0)/polygon.length;
    const y = polygon[0].y;
    const gap = {x,z,prevX:x,prevZ:z,y:y+.23,prevY:y+.23,radius:0};
    expect(hitEntity({x:0,z:0,heading:0,parts:p.parts},gap,0)).toBeUndefined();
    expect(hitEntity({x:0,z:0,heading:0,parts:p.parts},{...gap,y},0)?.part?.id).toBe(wing.id);
    world.dispose();
  });
  it("samples the attributed skin or a participating attached skin when a blast has no contact", () => {
    const w = new World(airframeById("heron_09"),491,{director:false});
    const p = w.player, model = new ProceduralAircraft(p);
    const wing = p.parts.find(part => part.role === "wing")!;
    const engine = p.parts.find(part => part.role === "engine")!;
    const source = {id:p.id,parts:p.parts,pose:w.actorPose(p),model};
    const shot: CombatSnapshot = {
      position:{x:500,y:0,z:500},direction:{x:0,y:1,z:0},velocity:{x:0,y:0,z:0},
      heading:0,bank:0,damageType:"explosive",damagedParts:[{id:wing.id,amount:3},{id:engine.id,amount:2}],
    };
    const random = new Random(123);
    const first = selectDamageSite(source,wing.id,shot,random)!;
    expect(first.partId).toBe(wing.id);
    expect(first.normal.length()).toBeCloseTo(1);
    wing.destroyed = true;
    expect(selectDamageSite(source,undefined,shot,random)?.partId).toBe(engine.id);
    expect(selectDamageSite(source,undefined,{...shot,damagedParts:[]},random)).toBeUndefined();
    model.dispose(); w.dispose();
  });
  it("keeps separate wing contacts through a roll, repair, detachment and reset", () => {
    const world = new World(airframeById("stingray_16"),491,{director:false,supply:false});
    const p = world.player, model = new ProceduralAircraft(p), effects = new CombatEffects(new Scene());
    p.heading = p.bank = 0;
    const pose = world.actorPose(p);
    model.group.position.set(pose.x,pose.y,pose.z);
    model.update(0,0);
    model.group.updateMatrixWorld(true);
    const part = p.parts.find(p => p.id === "right_wing_tip")!;
    const mesh = model.effectSites.surfaces.find(s => s.partId === part.id)!.mesh;
    const verts = mesh.geometry.getAttribute("position");
    const points = Array.from({length:verts.count},(_,i) => new Vector3().fromBufferAttribute(verts,i)
      .applyMatrix4(mesh.matrixWorld)).sort((a,b) => a.x-b.x);
    const amount = part.maxHealth*.14;
    const shot = (position: Vector3): CombatSnapshot => ({
      position, actorPose:pose, direction:{x:0,y:0,z:1},velocity:{x:1,y:0,z:0},
      heading:0,bank:0,contact:true,damageType:"kinetic",damagedParts:[{id:part.id,amount}],
    });
    const draw = (dt: number,events: WorldEvent[] = []) => {
      model.update(0,dt);
      effects.update(dt,new PerspectiveCamera(),"low",[],undefined,events,
        [{id:p.id,pose:world.actorPose(p),parts:p.parts,model}]);
    };
    const hit = (point: Vector3) => {
      part.health -= amount;
      draw(.01,[{type:"player_hit",time:0,amount,source:"test",part:part.id,snapshot:shot(point)}]);
    };
    hit(points[0]); hit(points[points.length-1]);
    expect(effects.diagnostics.holes).toBe(2);
    p.bank = .9; draw(.1);
    expect(effects.diagnostics.holes).toBe(2);
    part.health += amount+.000001; draw(.01);
    expect(effects.diagnostics.holes).toBe(1);
    part.destroyed = true;
    draw(.01,[{type:"part_detached",time:0,owner:"player",entityId:p.id,partId:part.id,partKind:"wing",
      color:"#999988",snapshot:shot(points[0])}]);
    expect(effects.diagnostics.holes).toBe(1);
    draw(2);
    expect(effects.diagnostics.holes).toBe(0);
    effects.reset();
    expect(effects.active).toBe(0);
    effects.dispose(); model.dispose(); world.dispose();
  });
  it("joins historical wingtip positions through a turn and fades the released strand", () => {
    const scene = new Scene(), lines = new AirflowLines(scene, 1);
    const tip = new AircraftEffectSites().add("wing","tip","wingTip",scene,[0,0,0]);
    const root = new Vector3(), aft = new Vector3(0,0,-1);
    const draw = () => {
      lines.follow(tip,root,aft,.5,.8,.06);
      lines.write();
    };
    draw();
    lines.advance(.06);
    root.z = 1;
    draw();
    lines.advance(.06);
    root.set(1,0,1);
    aft.set(-1,0,0);
    draw();
    const positions = lines.mesh.geometry.getAttribute("position");
    const opacity = lines.mesh.geometry.getAttribute("alpha");
    const point = (i: number) => new Vector3().fromBufferAttribute(positions,i).toArray();
    expect(lines.active).toBe(2);
    expect(point(0)).toEqual(root.toArray());
    expect(point(1)).toEqual(point(2));
    expect(positions.getX(3)).toBe(0);
    expect(opacity.getX(3)).toBeLessThan(opacity.getX(0));
    const tail = point(3);
    lines.advance(0);
    draw();
    expect(point(3)).toEqual(tail);
    lines.advance(.07); // The wing left the scene. Only its already released path remains.
    lines.write();
    expect(lines.active).toBeGreaterThan(0);
    expect(positions.getX(3)).toBe(0);
    lines.advance(.51);
    lines.write();
    expect(lines.active).toBe(0);
    lines.dispose();
    expect(scene.children).toHaveLength(0);
  });
  it("keeps the healthy Ho 229 nozzle and current wing roots after a bank", () => {
    const world = new World(airframeById("stingray_16"), 491, {director:false});
    const p = world.player, model = new ProceduralAircraft(p);
    const scene = new Scene(), camera = new PerspectiveCamera();
    const flight = new AircraftFlightEffects(scene);
    const draw = (dt: number) => {
      model.update(1,dt);
      flight.resetRoots();
      flight.lines.advance(dt);
      flight.bands.advance(dt);
      flight.emit(model,1,"low",camera);
      flight.lines.write();
      flight.bands.write();
      for (const batch of flight.batches) batch.write(camera);
    };
    p.boost = 1;
    p.effectiveThrottle = 1;
    draw(.1);
    expect(flight.cones.mesh.count).toBe(6);
    expect(flight.bands.active).toBeGreaterThan(0);
    const bandVertices = flight.bands.mesh.geometry.getAttribute("position");
    const left = new Vector3().fromBufferAttribute(bandVertices,2);
    const right = new Vector3().fromBufferAttribute(bandVertices,3);
    expect(right.distanceTo(left)).toBeGreaterThan(.5);
    expect(model.effectSites.sources.filter(site => site.kind === "wingFlow")
      .every(site => !p.parts.find(part => part.id === site.partId)?.visual?.detachable)).toBe(true);
    p.parts.find(part => part.role === "engine")!.health = 0;
    for (let step = 1; step <= 8; step++) {
      p.bank = step / 8;
      model.group.position.z += .2;
      draw(1/60);
    }
    draw(0);
    expect(flight.cones.mesh.count).toBe(3);
    const wingtip = model.effectSites.sources.find(site => site.kind === "wingTip")!;
    const root = new Vector3().fromArray(wingtip.position).applyMatrix4(wingtip.node.matrixWorld);
    const vertices = flight.lines.mesh.geometry.getAttribute("position");
    const matches = Array.from({length:flight.lines.active},(_,i) =>
      new Vector3().fromBufferAttribute(vertices,i*2).distanceTo(root) < .0001);
    expect(matches).toContain(true);
    for (const trail of flight.trails) trail.dispose();
    for (const batch of flight.batches) batch.dispose();
    model.dispose();
    world.dispose();
  });

  it.each([
    ["heron_09", "exhaust", "pistonSmoke", 0],
    ["stingray_16", "jetOutlet", "jetSmoke", 1],
  ] as const)("joins the %s smoke to its engine while banking", (frame, kind, smoke, flames) => {
    const world = new World(airframeById(frame), 491, { director: false });
    const model = new ProceduralAircraft(world.player);
    const scene = new Scene();
    const camera = new PerspectiveCamera();
    camera.position.set(0, 10, -5);
    camera.lookAt(0, 0, 0);
    const flight = new AircraftFlightEffects(scene);
    const trail = flight[smoke];
    const outlet = model.effectSites.sources.find(site => site.kind === kind)!;
    const draw = (time: number) => {
      model.update(time, .05);
      flight.resetRoots();
      for (const track of flight.trails) track.advance(.06);
      flight.emit(model, time, "low", camera, site => site === outlet);
      trail.write();
      flight.cones.write(camera);
    };
    draw(.06);
    draw(.12);
    world.player.heading = .45;
    world.player.bank = .7;
    model.group.position.z = .8;
    draw(.18);
    expect(flight.cones.mesh.count).toBe(flames);
    expect(trail.active).toBeGreaterThanOrEqual(2);
    const position = trail.mesh.geometry.getAttribute("position");
    const vertex = (i: number) => new Vector3().fromBufferAttribute(position, i);
    expect(vertex(2).distanceTo(vertex(4))).toBeLessThan(.00001);
    expect(vertex(3).distanceTo(vertex(5))).toBeLessThan(.00001);
    const root = new Vector3().fromArray(outlet.position).applyMatrix4(outlet.node.matrixWorld);
    const smokeRoot = vertex(0).add(vertex(1)).multiplyScalar(.5);
    if (kind === "exhaust") {
      expect(smokeRoot.distanceTo(root)).toBeLessThan(.00001);
    } else {
      const direction = new Vector3().fromArray(outlet.direction).transformDirection(outlet.node.matrixWorld);
      expect(smokeRoot.sub(root).normalize().distanceTo(direction)).toBeLessThan(.00001);
    }
    for (const track of flight.trails) track.dispose();
    for (const batch of flight.batches) batch.dispose();
    model.dispose();
    world.dispose();
  });
});
