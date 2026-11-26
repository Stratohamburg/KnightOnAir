import { heavyJet } from "./fixtures/simulationFrames";
import { describe, expect, it, vi } from "vitest";
import { AIRFRAMES, airframeById, eraOf } from "../src/data/aircrafts";
import { upgradeById } from "../src/data/upgrades";
import { World } from "../src/simulation/World";
import { resolveBombAvailability } from "../src/content/2d/BattleStatus";
import { CombatHud } from "../src/content/2d/CombatHud";
import {
  renderEquipmentBody,
  renderSortieBody,
  updateEquipmentPartHighlight,
} from "../src/content/2d/HangarView";
import { patchShowroomPanel, renderShowroomBody } from "../src/content/2d/ShowroomView";
import { renderUpgradeModal, updateUpgradeSelection } from "../src/content/2d/ModalViews";

class FakeElement {
  tagName: string;
  id = "";
  className = "";
  textContent = "";
  hidden = false;
  disabled = false;
  scrollTop = 0;
  clientWidth = 390;
  clientHeight = 844;
  dataset: Record<string, string> = {};
  style: Record<string, string> = {};
  children: FakeElement[] = [];
  private attrs = new Map<string, string>();
  private classes = new Set<string>();
  private rawHtml = "";
  private childById = new Map<string, FakeElement>();
  private queryAllMap = new Map<string, FakeElement[]>();

  constructor(tag = "div") {
    this.tagName = tag.toUpperCase();
  }

  get innerHTML() {
    return this.rawHtml;
  }

  set innerHTML(value: string) {
    this.rawHtml = value;
  }

  setAttribute(name: string, value: string) {
    this.attrs.set(name, value);
  }

  getAttribute(name: string) {
    return this.attrs.get(name) ?? null;
  }

  classList = {
    add: (...names: string[]) => names.forEach((n) => this.classes.add(n)),
    remove: (...names: string[]) => names.forEach((n) => this.classes.delete(n)),
    toggle: (name: string, force?: boolean) => {
      const next = force ?? !this.classes.has(name);
      if (next) this.classes.add(name);
      else this.classes.delete(name);
      return next;
    },
    contains: (name: string) => this.classes.has(name),
  };

  append(...nodes: FakeElement[]) {
    this.children.push(...nodes);
  }

  prepend(node: FakeElement) {
    this.children = [node, ...this.children.filter((item) => item !== node)];
  }

  remove() {}

  replaceChildren() {
    this.children = [];
  }

  registerQuery(selector: string, node: FakeElement) {
    this.childById.set(selector, node);
  }

  registerQueryAll(selector: string, nodes: FakeElement[]) {
    this.queryAllMap.set(selector, nodes);
  }

  querySelector(selector: string) {
    return this.childById.get(selector) ?? null;
  }

  querySelectorAll(selector: string) {
    return this.queryAllMap.get(selector) ?? [];
  }

  getBoundingClientRect() {
    throw new Error("getBoundingClientRect should not be called per frame");
  }
}

describe("mobile retro aviation UI views", () => {
  it("renders the upgrade sheet with ordered actions and accessible prices", () => {
    const world = new World(airframeById("heron_09"), 7, { showroom: true });
    world.upgradesAvailable = 1;
    world.openUpgrades();
    const markup = renderUpgradeModal(world);
    expect([...markup.matchAll(/data-upgrade="([^"]+)"/g)].map(match => match[1]))
      .toEqual(world.choices.map(choice => choice.id));
    expect(markup).toContain('data-action="return-from-upgrade"');
    expect(markup).toContain('data-action="confirm-upgrade" class="upgrade-confirm" hidden disabled');
    expect(markup).toContain('aria-label="快速供弹，4 金币"');
    expect(markup).toMatch(/<p class="upgrade-payment" id="upgrade-payment" role="status">/);
  });

  it("updates the selected refit in place and gates the inline confirmation action", () => {
    const world = new World(airframeById("heron_09"), 7, { showroom: true });
    world.upgradesAvailable = 1;
    world.openUpgrades();
    const sheet = new FakeElement();
    const payment = new FakeElement("p");
    sheet.registerQuery("#upgrade-payment", payment);
    const rows = world.choices.map(({ id }) => {
      const option = new FakeElement();
      const select = new FakeElement("button");
      const confirm = new FakeElement("button");
      option.dataset.upgradeOption = id;
      option.registerQuery("[data-upgrade]", select);
      option.registerQuery(".upgrade-confirm", confirm);
      return { option, select, confirm };
    });
    sheet.registerQueryAll("[data-upgrade-option]", rows.map(({ option }) => option));
    const update = () => updateUpgradeSelection(sheet as unknown as ParentNode, world);
    world.selectUpgrade(world.choices[2].id);
    update();
    expect(rows[2].select.getAttribute("aria-pressed")).toBe("true");
    expect(rows[2].confirm).toMatchObject({ hidden: false, disabled: true });
    expect(payment.textContent).toBe("还需 8 金币");
    world.coins = 4;
    world.selectUpgrade(world.choices[0].id);
    update();
    expect(rows[2].select.getAttribute("aria-pressed")).toBe("false");
    expect(rows[2].confirm).toMatchObject({ hidden: true, disabled: true });
    expect(rows[0].confirm).toMatchObject({ hidden: false, disabled: false });
    expect(payment.textContent).toBe("将支付 4 金币");
    expect(world.confirmUpgrade()).toBe(true);
    expect(renderUpgradeModal(world)).toContain("已支付 · 正在安装 快速供弹");
  });

  it("renders same-era direct-select roster chips in equipment view without altering equipped state", () => {
    const equippedId = "reference_wright_flyer_1903";
    const preview = airframeById("reference_bleriot_xi");
    const html = renderEquipmentBody({
      frame: preview,
      unlocked: [equippedId, preview.id],
      equippedId,
      highlight: "",
    });
    const sameEra = AIRFRAMES.filter((f) => eraOf(f) === eraOf(preview));
    for (const candidate of sameEra) {
      expect(html).toContain(candidate.name);
      expect(html).toContain(`data-preview="${AIRFRAMES.indexOf(candidate)}"`);
    }
    expect(html).toContain("装备此机体");
    expect(html).not.toContain('data-preview="-1"');
    expect(html).not.toContain("当前已装备");

    const sortieHtml = renderSortieBody({
      frame: airframeById(equippedId),
      sortieEra: "ww1",
      missionNumber: "02",
      missionName: "云海前线",
      eraLabel: "一战",
      bestScore: 1200,
      canLaunch: true,
    });
    expect(sortieHtml).toContain(airframeById(equippedId).name);
    expect(sortieHtml).not.toContain("home-heading");
  });

  it("updates equipment part highlight chips and hint text in place", () => {
    const host = new FakeElement();
    const nose = new FakeElement("button");
    nose.dataset.part = "nose";
    const tail = new FakeElement("button");
    tail.dataset.part = "tail";
    const hint = new FakeElement("p");
    host.registerQueryAll(".part-selector button[data-part]", [nose, tail]);
    host.registerQuery("#equipment-part-hint", hint);

    const frame = airframeById("reference_wright_flyer_1903");
    updateEquipmentPartHighlight(host as unknown as HTMLElement, frame, "tail");
    expect(tail.classList.contains("selected")).toBe(true);
    expect(tail.getAttribute("aria-pressed")).toBe("true");
    expect(nose.classList.contains("selected")).toBe(false);
    expect(hint.textContent).toContain("机尾");
  });

  it("patches showroom panel locally, preserves card list scrollTop, and reflects reset state", () => {
    const world = new World(heavyJet, 11, {
      director: false,
      supply: false,
      showroom: true,
    });
    const initialHtml = renderShowroomBody({ frame: world.player.frame, world, build: [] });
    expect(initialHtml).toContain("id=\"showroom-card-list\"");
    expect(initialHtml).toContain("原装构型");

    const host = new FakeElement();
    const cardList = new FakeElement("div");
    cardList.scrollTop = 184;
    const activeList = new FakeElement("ol");
    const stats = new FakeElement("div");
    const count = new FakeElement("span");
    const undo = new FakeElement("button");
    const reset = new FakeElement("button");
    host.registerQuery("#showroom-card-list", cardList);
    host.registerQuery("#showroom-active-list", activeList);
    host.registerQuery("#showroom-stats", stats);
    host.registerQuery("#showroom-options-count", count);
    host.registerQuery("#showroom-undo", undo);
    host.registerQuery("#showroom-reset", reset);

    const card = upgradeById("left_wing_segment")!;
    world.installUpgrade(card);
    expect(patchShowroomPanel(host as unknown as HTMLElement, world, [card.id])).toBe(true);
    expect(cardList.scrollTop).toBe(184);
    expect(undo.disabled).toBe(false);
    expect(reset.disabled).toBe(false);
    expect(activeList.innerHTML).toContain(card.name);

    const freshWorld = new World(heavyJet, 11, {
      director: false,
      supply: false,
      showroom: true,
    });
    expect(patchShowroomPanel(host as unknown as HTMLElement, freshWorld, [])).toBe(true);
    expect(cardList.scrollTop).toBe(184);
    expect(undo.disabled).toBe(true);
    expect(reset.disabled).toBe(true);
    expect(activeList.innerHTML).toContain("原装构型");
  });

  it("distinguishes every bomb availability state accurately", () => {
    expect(
      resolveBombAvailability({
        hasWeapon: false,
        bombing: false,
        bombFactor: 1,
        cooldown: 0,
        validAim: true,
        stability: 1,
        canBomb: false,
      }),
    ).toMatchObject({ status: "no_bay", canToggleBombing: false });

    expect(
      resolveBombAvailability({
        hasWeapon: true,
        bombing: true,
        bombFactor: 0,
        cooldown: 0,
        validAim: true,
        stability: 1,
        canBomb: false,
      }),
    ).toMatchObject({ status: "damaged", label: "弹舱损毁" });

    expect(
      resolveBombAvailability({
        hasWeapon: true,
        bombing: true,
        bombFactor: 1,
        cooldown: 2.3,
        validAim: true,
        stability: 0.9,
        canBomb: false,
      }),
    ).toMatchObject({ status: "reloading", label: "2.3s" });

    expect(
      resolveBombAvailability({
        hasWeapon: true,
        bombing: true,
        bombFactor: 1,
        cooldown: 0,
        validAim: false,
        stability: 0.95,
        canBomb: false,
      }),
    ).toMatchObject({ status: "out_of_envelope", label: "超包线" });

    expect(
      resolveBombAvailability({
        hasWeapon: true,
        bombing: true,
        bombFactor: 1,
        cooldown: 0,
        validAim: true,
        stability: 0.5,
        canBomb: false,
      }),
    ).toMatchObject({ status: "stabilizing", label: "50%" });

    expect(
      resolveBombAvailability({
        hasWeapon: true,
        bombing: true,
        bombFactor: 1,
        cooldown: 0,
        validAim: true,
        stability: 0.92,
        canBomb: true,
      }),
    ).toMatchObject({ status: "ready", label: "投弹" });
  });

  it("updates CombatHud radar, edge indicators, and nameplates via transform without per-frame reflow", () => {
    const originalDoc = globalThis.document;
    vi.stubGlobal("document", {
      createElement: (tag: string) => new FakeElement(tag),
    });
    try {
      const host = new FakeElement();
      host.clientWidth = 390;
      host.clientHeight = 844;
      const labels = new FakeElement();
      const hud = new CombatHud(host as unknown as HTMLElement, labels as unknown as HTMLElement);
      hud.setViewportSize(360, 640);

      hud.update(
        "battle",
        { x: 0, z: 0, heading: 0 },
        [
          {
            id: 1,
            x: 30,
            y: 24,
            z: 20,
            layer: "air",
            distance: 36,
            bearing: Math.PI / 3,
            firing: true,
            onScreen: false,
            kind: "hunter",
          },
        ],
        1 / 60,
      );
      hud.updateLabels(
        [{ id: 2, layer: "air", label: "猎手", x: 180, y: 240, quality: 1, health: 0.6 }],
        { x: 180, y: 260, text: "锁定 80%" },
      );

      expect(hud.diagnostics.viewport).toEqual({ width: 360, height: 640 });
      expect(hud.diagnostics.radar.active).toBe(1);
      expect(hud.diagnostics.threats.active).toBe(1);
      expect(hud.diagnostics.nameplates.active).toBe(1);

      const nameplate = labels.children[0];
      expect(nameplate.style.transform).toContain("translate3d(180.0px, 240.0px, 0)");
      expect(nameplate.style.left).toBeUndefined();

      const edgesContainer = (hud.root as unknown as FakeElement).children[1];
      const arrow = edgesContainer.children[0];
      expect(arrow.style.transform).toContain("translate3d(");
      expect(arrow.style.left).toBeUndefined();

      hud.dispose();
    } finally {
      vi.stubGlobal("document", originalDoc);
    }
  });
});
