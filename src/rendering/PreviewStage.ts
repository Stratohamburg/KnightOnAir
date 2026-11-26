import { AmbientLight, Color, DirectionalLight, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from "three";
import { QUALITIES, type Quality } from "../data/config";

export class PreviewStage {
  readonly renderer: WebGLRenderer;
  readonly camera = new PerspectiveCamera(44, 1, .1, 350);
  private readonly resize: ResizeObserver;
  private quality: Quality = "standard";

  constructor(private readonly host: HTMLElement, redraw: () => void) {
    this.renderer = new WebGLRenderer({ antialias: true, alpha: false });
    host.append(this.renderer.domElement);
    this.resize = new ResizeObserver(() => {
      this.layout();
      redraw();
    });
    this.resize.observe(host);
    this.layout();
  }

  private layout() {
    const { clientWidth: width, clientHeight: height } = this.host;
    if (!width || !height) return;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * QUALITIES[this.quality].scale);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  setQuality(quality: Quality) {
    if (this.quality === quality) return;
    this.quality = quality;
    this.layout();
  }

  render(scene: Scene, target: Vector3, distance: number, yaw: number, pitch: number, dark: boolean,
    prepare?: () => void,
  ) {
    const horizontal = distance * Math.cos(pitch);
    this.camera.position.set(target.x + horizontal * Math.sin(yaw), target.y + distance * Math.sin(pitch),
      target.z + horizontal * Math.cos(yaw));
    this.camera.lookAt(target);
    this.camera.updateMatrixWorld();
    prepare?.();
    this.renderer.setClearColor(dark ? "#18282f" : "#c3d6d5");
    this.renderer.render(scene, this.camera);
  }

  dispose() {
    this.resize.disconnect();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}

export function previewScene() {
  const scene = new Scene();
  scene.add(new AmbientLight(new Color("#e0edf8"), 1.7));
  const key = new DirectionalLight("#fff1d7", 2.1);
  key.position.set(-4, 9, 7);
  scene.add(key);
  return scene;
}
