export class WindField {
  time = 0;
  gust = 0;
  update(dt: number) {
    this.time += dt;
    this.gust =
      Math.max(0, Math.sin(this.time * 0.12)) * Math.min(1.5, this.time / 180);
  }
  sample(x: number, z: number) {
    const strength = 0.28 + Math.min(0.8, this.time / 240);
    return {
      x: Math.sin(z * 0.018 + this.time * 0.075) * strength + this.gust * 0.5,
      z: Math.cos(x * 0.02 - this.time * 0.055) * strength * 0.6,
    };
  }
}
