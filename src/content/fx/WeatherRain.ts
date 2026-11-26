import { BufferAttribute, BufferGeometry, DynamicDrawUsage, LineBasicMaterial, LineSegments } from "three";
import type { Quality } from "../../data/config";
import { Random } from "../../services/Random";

const counts: Record<Quality, number> = { low: 28, standard: 80, high: 140 };
const span = 70;
export const rainPreview = { name: "降雨", trigger: "在参考空间开启降雨", kind: "rain", playback: "continuous" } as const;
const wrap = (value: number) => ((value % span) + span) % span;

export class WeatherRain {
  private readonly geometry = new BufferGeometry();
  private readonly material = new LineBasicMaterial({ color: "#c4e4f4", transparent: true, depthWrite: false });
  private readonly positions = new BufferAttribute(new Float32Array(counts.high * 6), 3).setUsage(DynamicDrawUsage);
  private readonly origins: { x: number; y: number; z: number }[];
  readonly lines = new LineSegments(this.geometry, this.material);

  constructor(seed = 8901) {
    const random = new Random(seed);
    this.origins = Array.from({ length: counts.high }, () => ({
      x: random.range(0, span), y: random.range(0, span), z: random.range(0, span),
    }));
    this.geometry.setAttribute("position", this.positions);
    this.geometry.setDrawRange(0, 0);
    this.lines.frustumCulled = false;
    this.lines.visible = false;
  }

  update(time: number, intensity: number, x: number, z: number, windX: number, windZ: number, quality: Quality,
    stoppedAt?: number,
  ) {
    const count = Math.ceil(counts[quality] * intensity);
    this.lines.visible = count > 0;
    if (!count) {
      this.geometry.setDrawRange(0, 0);
      return;
    }
    this.material.opacity = Math.min(.65, intensity * 1.2);
    let visible = 0;
    for (let index = 0; index < count; index++) {
      const origin = this.origins[index];
      const px = x + wrap(origin.x + time * windX - x) - span / 2;
      const pz = z + wrap(origin.z + time * windZ - z) - span / 2;
      const py = stoppedAt === undefined ? wrap(origin.y - time * 22)
        : wrap(origin.y - stoppedAt * 22) - (time - stoppedAt) * 22;
      if (py < 0) continue;
      this.positions.setXYZ(visible * 2, px, py, pz);
      this.positions.setXYZ(visible * 2 + 1, px - windX * .12, py + 1.85, pz - windZ * .12);
      visible++;
    }
    this.geometry.setDrawRange(0, visible * 2);
    this.positions.needsUpdate = true;
  }

  dispose() {
    this.lines.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
