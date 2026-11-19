export class Telemetry {
  readonly events: {
    time: number;
    type: string;
    data: Record<string, string | number>;
  }[] = [];
  record(
    time: number,
    type: string,
    data: Record<string, string | number> = {},
  ) {
    this.events.push({ time, type, data });
    if (this.events.length > 500) this.events.shift();
  }
}
