import { RULES } from "../data/config";

export class PreviewClock<Input> {
  step = 0;
  paused = true;
  rate = 1;
  private remainder = 0;
  private inputs = new Map<number, Input[]>();

  queue(input: Input) {
    const next = this.step + 1;
    const inputs = this.inputs.get(next) ?? [];
    inputs.push(input);
    this.inputs.set(next, inputs);
  }

  advance(dt: number, update: (step: number, inputs: readonly Input[]) => void) {
    if (this.paused) return;
    this.remainder += Math.min(dt, RULES.maxFrame) * this.rate;
    while (this.remainder + 1e-9 >= RULES.step) {
      this.remainder -= RULES.step;
      this.singleStep(update);
    }
  }

  singleStep(update: (step: number, inputs: readonly Input[]) => void) {
    this.step++;
    update(this.step, this.inputs.get(this.step) ?? []);
  }

  reset(replay = false) {
    this.step = 0;
    this.remainder = 0;
    if (!replay) this.inputs.clear();
  }
}
