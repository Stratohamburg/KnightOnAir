import { AIRFRAMES, eraOf, type Airframe } from "../../data/aircrafts";
import { ERAS } from "../../data/eras";
import { upgradeById, type Upgrade } from "../../data/upgrades";
import type { Stats } from "../../simulation/types";
import type { World } from "../../simulation/World";
import { actionButton } from "./components";
import { icon, planePreview } from "./icons";

const STAT_LABELS: Partial<Record<keyof Stats, string>> = {
  maxSpeed: "极速",
  acceleration: "加速",
  turnRate: "转向",
  energyMax: "加力储备",
  health: "生命",
  wingspan: "翼展",
  length: "机长",
  energyRecover: "恢复",
  energyDrain: "加力消耗",
  fireRate: "射速倍率",
  lockTime: "锁定修正",
  bombCooldown: "装填修正",
  damage: "火力倍率",
  bombSettle: "稳定倍率",
};

export function formatUpgradeDelta(upgrade: Upgrade, world: World) {
  const p = world.player;
  const keys = [
    ...new Set([...Object.keys(upgrade.add ?? {}), ...Object.keys(upgrade.multiply ?? {})]),
  ] as (keyof Stats)[];
  const changes = keys
    .filter((key) => STAT_LABELS[key])
    .slice(0, 2)
    .map((key) => {
      const before = p.stats[key];
      const after = (before + (upgrade.add?.[key] ?? 0)) * (upgrade.multiply?.[key] ?? 1);
      const precision = ["fireRate", "damage", "bombSettle"].includes(key) ? 2 : 1;
      return `${STAT_LABELS[key]} ${Number(before.toFixed(precision))} → ${Number(after.toFixed(precision))}`;
    });
  if (!changes.length) {
    changes.push(`武器 ${p.weapons.length} → ${p.weapons.length + (upgrade.weapons?.length ?? 0)}`);
  }
  return changes.join(" · ");
}

function renderActiveBuildItems(build: readonly string[]) {
  if (!build.length) return `<li class="empty-build">原装构型</li>`;
  return build
    .map((id, index) => `<li><span>${String(index + 1).padStart(2, "0")}</span>${upgradeById(id)?.name ?? id}</li>`)
    .join("");
}

function renderUpgradeCards(world: World, options: readonly Upgrade[]) {
  if (!options.length) return `<p class="empty-build">当前构型没有更多合法强化卡。</p>`;
  const isDr1 = world.player.frame.geometryProfile === "fokkerDr1";
  return options
    .map((upgrade) => {
      const rarityLabel = upgrade.rarity === "common" ? "标准" : upgrade.rarity === "rare" ? "稀有" : "史诗";
      return `<button type="button" class="upgrade-card showroom-upgrade-card ${upgrade.rarity}" data-showroom-upgrade="${upgrade.id}">
        ${planePreview(upgrade.preview, isDr1 ? upgrade.id : undefined)}
        <div>
          <span class="upgrade-rarity">${rarityLabel} / ${upgrade.tag}</span>
          <h3>${upgrade.name}</h3>
          <p class="upgrade-gain">${upgrade.benefit}</p>
          <p class="upgrade-delta">${formatUpgradeDelta(upgrade, world)}</p>
          <small>${upgrade.description}</small>
        </div>
        ${icon("arrow")}
      </button>`;
    })
    .join("");
}

function statsText(world: World) {
  const barrels = world.player.weapons.reduce((total, weapon) => total + weapon.config.count, 0);
  return `部件 ${world.player.parts.length} · 炮位 ${world.player.weapons.length} · 枪管 ${barrels}`;
}

export interface ShowroomViewModel {
  frame: Airframe;
  world?: World;
  build: readonly string[];
  modelError?: string;
}

export function renderShowroomBody({ frame, world, build, modelError }: ShowroomViewModel) {
  if (modelError || !world) {
    return `<section class="showroom-page">
      <div class="showroom-stage">
        <div class="showroom-stage-header">
          <div class="showroom-stage-caption">
            <span class="eyebrow">AIRCRAFT SHOWROOM</span>
            <strong>${frame.name}</strong>
            <small>${modelError ?? "模型未就绪"}</small>
          </div>
        </div>
        <div class="showroom-stage-actions">
          ${actionButton("showroom-aircraft", "换机", { size: "xs", variant: "secondary" })}
          ${actionButton("reference", "校验 ↗", { size: "xs", variant: "ghost" })}
          <button type="button" class="btn btn-xs btn-ghost" data-tab="sortie">返回</button>
        </div>
      </div>
    </section>`;
  }

  const options = world.legalUpgradeOptions;
  const hasBuild = build.length > 0;
  return `<section class="showroom-page">
    <div class="showroom-stage">
      <div class="showroom-stage-header">
        <div class="showroom-stage-caption">
          <span class="eyebrow">SHOWROOM</span>
          <strong id="showroom-frame-name">${frame.name}</strong>
          <small>拖动环绕观察</small>
        </div>
        <div class="showroom-stage-stats" id="showroom-stats">${statsText(world)}</div>
      </div>
      <div class="showroom-stage-actions">
        ${actionButton("showroom-aircraft", "换机", { size: "xs", variant: "secondary" })}
        ${actionButton("showroom-undo", "撤销", {
          size: "xs",
          variant: "secondary",
          attributes: `id="showroom-undo"${hasBuild ? "" : " disabled"}`,
        })}
        ${actionButton("showroom-reset", "重置", {
          size: "xs",
          variant: "secondary",
          attributes: `id="showroom-reset"${hasBuild ? "" : " disabled"}`,
        })}
        ${actionButton("showroom-fire", `试射 ${icon("target")}`, { size: "xs", variant: "primary" })}
        ${actionButton("reference", "校验", { size: "xs", variant: "ghost" })}
        <button type="button" class="btn btn-xs btn-ghost" data-tab="sortie">返回</button>
      </div>
    </div>
    <section class="showroom-controls">
      <div class="showroom-active">
        <div class="showroom-active-head">
          <span class="eyebrow">当前生效构型</span>
          <span class="eyebrow" id="showroom-options-count">可用强化 · ${options.length}</span>
        </div>
        <ol id="showroom-active-list">${renderActiveBuildItems(build)}</ol>
      </div>
      <div class="showroom-card-list" id="showroom-card-list">${renderUpgradeCards(world, options)}</div>
    </section>
  </section>`;
}

/** Update showroom stats, toolbar state, active build strip, and card list in place while preserving scrollTop. */
export function patchShowroomPanel(host: HTMLElement, world: World, build: readonly string[]): boolean {
  const cardList = host.querySelector<HTMLElement>("#showroom-card-list");
  const activeList = host.querySelector<HTMLElement>("#showroom-active-list");
  if (!cardList || !activeList) return false;

  const savedScroll = cardList.scrollTop;
  const options = world.legalUpgradeOptions;
  const hasBuild = build.length > 0;

  const statsNode = host.querySelector<HTMLElement>("#showroom-stats");
  if (statsNode) statsNode.textContent = statsText(world);

  const countNode = host.querySelector<HTMLElement>("#showroom-options-count");
  if (countNode) countNode.textContent = `可用强化 · ${options.length}`;

  const undoBtn = host.querySelector<HTMLButtonElement>("#showroom-undo");
  if (undoBtn) undoBtn.disabled = !hasBuild;

  const resetBtn = host.querySelector<HTMLButtonElement>("#showroom-reset");
  if (resetBtn) resetBtn.disabled = !hasBuild;

  activeList.innerHTML = renderActiveBuildItems(build);
  cardList.innerHTML = renderUpgradeCards(world, options);
  cardList.scrollTop = savedScroll;
  return true;
}

export function renderShowroomAircraftPicker(currentFrameId?: string) {
  const choices = AIRFRAMES.map(
    (candidate, index) =>
      `<button type="button" class="showroom-aircraft${candidate.id === currentFrameId ? " selected" : ""}" data-preview="${index}">
        <strong>${candidate.name}</strong>
        <small>${ERAS[eraOf(candidate)].label} · ${candidate.role}</small>
      </button>`,
  ).join("");
  return `<div class="modal-heading">
      <span class="eyebrow">AIRCRAFT ROSTER</span>
      <h2>选择展厅机体</h2>
      <p>仅改变展厅预览，当前出击装备保持不变。</p>
    </div>
    <div class="showroom-aircraft-picker">${choices}</div>
    <div class="modal-actions">${actionButton("close-modal", "返回展厅", { size: "sm", variant: "secondary", block: true })}</div>`;
}
