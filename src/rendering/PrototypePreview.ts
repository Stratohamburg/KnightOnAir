import { Vector3 } from "three";
import { ProceduralAircraft, type ReferenceAircraft } from "../content/3d/AircraftFactory";
import { ContentCatalog } from "../content/3d/ContentCatalog";
import { PreviewStage, previewScene } from "./PreviewStage";

export class PrototypePreview {
  private readonly stage: PreviewStage;
  private readonly scene = previewScene();
  private readonly catalog = new ContentCatalog();
  private readonly target = new Vector3();
  private model?: ProceduralAircraft;
  private time = 0;
  private yaw = Math.PI + .55;
  private pitch = .14;
  private view: "orbit" | "front" | "side" | "top" = "orbit";

  constructor(host: HTMLElement) {
    this.stage = new PreviewStage(host, () => this.draw(0, ""));
  }

  setPlayer(player: ReferenceAircraft) {
    this.model?.dispose();
    this.model = new ProceduralAircraft(player, this.catalog);
    this.scene.add(this.model.group);
    return this.model.contentError;
  }

  setDisplayOrbit(yaw: number, pitch: number) {
    this.view = "orbit";
    this.yaw = yaw;
    this.pitch = pitch;
  }

  setDisplayView(view: "front" | "side" | "top") { this.view = view; }

  draw(dt: number, highlight: string) {
    if (!this.model) return;
    this.time += dt;
    this.model.update(this.time, dt, highlight, true);
    const { frame } = this.model.actor as ReferenceAircraft;
    const distance = Math.max(frame.wingspan, frame.length) * 1.66 * Math.max(1, .99 / this.stage.camera.aspect);
    const side = this.view === "side";
    this.stage.render(this.scene, this.target, distance,
      this.view === "orbit" ? this.yaw : side ? Math.PI / 2 : Math.PI,
      this.view === "orbit" ? this.pitch : this.view === "top" ? Math.PI / 2 - .001 : 0, false);
  }

  dispose() {
    this.model?.dispose();
    this.stage.dispose();
  }
}
