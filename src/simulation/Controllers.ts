import type { ControllerIntent } from "./types";

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
