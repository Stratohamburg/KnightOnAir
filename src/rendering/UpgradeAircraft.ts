import { Box3, Vector3, type Group, type Scene } from "three";
import { ProceduralAircraft } from "../content/3d/AircraftFactory";
import type { ContentCatalog } from "../content/3d/ContentCatalog";
import { clamp } from "../services/Random";
import type { Part, UpgradeInstalledEvent, UpgradePreview } from "../simulation/types";

export const upgradeInstallSeconds = .62;

export class UpgradeAircraft {
  private projection?: UpgradePreview;
  preview?: ProceduralAircraft;
  highlighted = new Set<string>();

  constructor(private readonly scene: Scene, private readonly catalog: ContentCatalog) {}

  show(projection: UpgradePreview | undefined, live: ProceduralAircraft) {
    if (projection !== this.projection) {
      this.clear();
      if (projection) {
        this.projection = projection;
        this.preview = new ProceduralAircraft(projection.player, this.catalog);
        this.scene.add(this.preview.group);
        this.highlighted = new Set(projection.focusPartIds);
      }
    }
    live.group.visible = !this.preview;
    return this.preview ?? live;
  }

  clear() {
    this.preview?.dispose();
    this.preview = undefined;
    this.projection = undefined;
    this.highlighted.clear();
  }
}

export function upgradeAircraftBounds(model: ProceduralAircraft, ids: ReadonlySet<string>) {
  const aircraft = new Box3().setFromObject(model.group);
  const affected = new Box3();
  for (const id of ids) {
    const part = model.partNode(id);
    if (part) affected.expandByObject(part);
  }
  return { aircraft, affected };
}

interface InstallingPart {
  node: Group;
  position: Vector3;
  scale: Vector3;
  pivot: Vector3;
  direction: Vector3;
}

export class UpgradePartMotion {
  private readonly parts: InstallingPart[];

  constructor(model: ProceduralAircraft, event: UpgradeInstalledEvent) {
    this.parts = event.partIds.flatMap(id => {
      const part = model.actor.parts.find(candidate => candidate.id === id);
      const node = model.partNode(id);
      if (!part || !node) return [];
      return [{
        node, position: node.position.clone(), scale: node.scale.clone(),
        pivot: new Vector3(part.x, part.y ?? 0, part.z).sub(node.position),
        direction: installationDirection(part),
      }];
    });
  }

  update(seconds: number) {
    const progress = clamp(seconds / upgradeInstallSeconds);
    const growth = clamp(progress / .68);
    const settle = clamp((progress - .68) / .32);
    const scale = .08 + .92 * (1 - (1 - growth) ** 2) + Math.sin(Math.PI * settle) * .1;
    for (const { node, position, pivot, direction, scale: baseScale } of this.parts) {
      const travel = Math.sin(Math.PI * clamp(progress / .72));
      node.position.copy(position).addScaledVector(pivot, 1 - scale).addScaledVector(direction, travel);
      node.scale.copy(baseScale).multiplyScalar(scale);
    }
  }

  reset() {
    for (const { node, position, scale } of this.parts) {
      node.position.copy(position);
      node.scale.copy(scale);
    }
  }
}

function installationDirection(part: Part) {
  const length = part.centerline?.segmentLength;
  if (length) {
    const amount = Math.max(.55, length * .75);
    if (part.slot === "leftWing" || part.slot === "rightWing")
      return new Vector3(part.slot === "leftWing" ? -amount : amount, 0, 0);
    return new Vector3(0, 0, -amount);
  }
  return new Vector3(part.side ? part.side * .35 : 0, part.slot === "bottom" ? -.5 : .5, 0);
}
