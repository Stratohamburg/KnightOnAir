import type { NpcProfile } from "../data/combatants";
import type { ControllerIntent } from "./types";

export interface ControllerSnapshot {
  x: number;
  z: number;
  heading: number;
  vx: number;
  vz: number;
  speed: number;
}

export interface PlayerControllerInput {
  heading: number;
  throttle: number;
  boost?: number;
  fire?: boolean;
  bomb?: boolean;
}

export function playerIntent(input: PlayerControllerInput): ControllerIntent {
  return {
    targetHeading: input.heading,
    throttle: Math.max(0, Math.min(1, input.throttle)),
    boost: Math.max(0, Math.min(1, input.boost ?? 0)),
    fire: Boolean(input.fire),
    bomb: Boolean(input.bomb),
    brake: false,
  };
}

export function npcIntent(
  profile: NpcProfile,
  actor: ControllerSnapshot & { health: number; maxHealth: number; damage: { engineFactor: number } },
  player: ControllerSnapshot,
  time: number,
  anchor?: ControllerSnapshot,
): ControllerIntent {
  const behavior = profile.behavior;
  const dx = player.x - actor.x, dz = player.z - actor.z;
  const distance = Math.hypot(dx, dz);
  const flee = behavior.kind === "flee" || (actor.health < actor.maxHealth * .2 && actor.damage.engineFactor < .65);
  let x = player.x, z = player.z;
  let throttle = distance > behavior.preferredRange[1] ? 1 : .7;
  const bearing = Math.atan2(dx, dz);

  if (flee) {
    x = actor.x - dx;
    z = actor.z - dz;
    throttle = 1;
  } else if (behavior.kind === "intercept") {
    const lead = Math.min(3, distance / Math.max(actor.speed, 2)) + behavior.leadTime;
    x += player.vx * lead;
    z += player.vz * lead;
  } else if (behavior.kind === "escort" && anchor) {
    x = anchor.x + Math.cos(anchor.heading) * 6 - Math.sin(anchor.heading) * 3;
    z = anchor.z - Math.sin(anchor.heading) * 6 - Math.cos(anchor.heading) * 3;
    throttle = Math.hypot(x - actor.x, z - actor.z) > 8 ? 1 : .3;
  } else if (behavior.kind === "standoff" && behavior.targetPolicy !== "route") {
    const offset = bearing + (distance < behavior.preferredRange[0] ? Math.PI * .8 : Math.PI * .38);
    x = actor.x + Math.sin(offset) * 12;
    z = actor.z + Math.cos(offset) * 12;
  } else if (behavior.kind === "patrol" && behavior.targetPolicy !== "route") {
    x = Math.sin(time * .12) * 18;
    z = 24 + Math.cos(time * .12) * 18;
    throttle = .35;
  } else if (behavior.kind === "crossing") {
    const side = Math.cos(time * .27);
    x += Math.cos(player.heading) * side * 15;
    z -= Math.sin(player.heading) * side * 15;
  } else if (behavior.kind === "dive" || behavior.kind === "strafe") {
    const attacking = time % 8 < 3;
    if (!attacking) {
      x -= Math.cos(player.heading) * 15;
      z += Math.sin(player.heading) * 15;
    }
    throttle = attacking ? 1 : .35;
  } else if (behavior.targetPolicy === "route" || behavior.kind === "static") {
    x = actor.x + Math.sin(actor.heading);
    z = actor.z + Math.cos(actor.heading);
  }
  return {
    targetHeading: Math.atan2(x - actor.x, z - actor.z),
    throttle, boost: 0,
    fire: !flee && distance <= behavior.engageRadius,
    bomb: false, brake: false,
  };
}

export interface TimedControllerIntent {
  /** Simulation time since the start of the sortie, in seconds. */
  time: number;
  intent: ControllerIntent;
}

export class NetworkController {
  private readonly buffer: TimedControllerIntent[] = [];
  private cursor = 0;
  private lastSample = -1;
  private current = playerIntent({ heading: Math.PI, throttle: 0 });

  push(sample: TimedControllerIntent) {
    const { time, intent } = sample;
    if (!Number.isFinite(time) || time <= this.lastSample ||
        !Number.isFinite(intent.throttle) || !Number.isFinite(intent.boost) ||
        (intent.targetHeading !== undefined && !Number.isFinite(intent.targetHeading))) return false;
    const snapshot = {
      ...intent,
      throttle: Math.min(1, Math.max(0, intent.throttle)),
      boost: Math.min(1, Math.max(0, intent.boost)),
    };
    const index = this.buffer.findIndex(({ time: queued }) => time <= queued);
    if (index === -1) this.buffer.push({ time, intent: snapshot });
    else if (this.buffer[index].time === time) this.buffer[index] = { time, intent: snapshot };
    else this.buffer.splice(index, 0, { time, intent: snapshot });
    return true;
  }

  sample(time: number): ControllerIntent {
    if (time >= this.lastSample) {
      while (this.cursor < this.buffer.length && this.buffer[this.cursor].time <= time + 1e-9)
        this.current = this.buffer[this.cursor++].intent;
      this.lastSample = time;
      if (this.cursor >= 64) {
        this.buffer.splice(0, this.cursor);
        this.cursor = 0;
      }
    }
    return this.current;
  }
}
