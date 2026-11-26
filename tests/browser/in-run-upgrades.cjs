const { chromium } = require(process.env.KOA_PLAYWRIGHT ?? "playwright");
const assert = require("node:assert/strict");

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true,
    args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--disable-background-timer-throttling"] });
  try {
    for (const [width, height] of [[360,640],[390,844],[430,932],[1440,900]]) {
      const mobile = width < 500;
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: mobile, isMobile: mobile });
      page.setDefaultTimeout(30000);
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(process.argv[2] ?? "http://localhost:5173");
      await page.waitForFunction(() => window.__koa?.renderer);
      await page.evaluate(() => window.__koa.renderer.setQuality("low"));
      const launch = page.locator('[data-action="launch"]');
      await launch.click();
      await page.waitForFunction(() => window.__koa.world?.phase === "battle");
      const opener = page.locator("#upgrade-button");
      const sheet = page.getByRole("dialog", { name: "选择升级" });
      const offers = sheet.locator("[data-upgrade]");
      const confirm = sheet.getByRole("button", { name: /^确认安装/ });
      const back = sheet.getByRole("button", { name: "返回战斗" });

      await page.evaluate(() => {
        const {world, renderer} = window.__koa;
        world.upgradesAvailable = 12;
        world.coins = 0;
        for (const pickup of world.pickups.items) pickup.active = false;
        renderer.render(world, 0, { display: false });
        const before = renderer.camera.position.clone();
        document.querySelector("#upgrade-button").focus();
        window.dispatchEvent(new KeyboardEvent("keydown", {code: "KeyU"}));
        renderer.render(world, 0, { display: false });
        if (before.distanceTo(renderer.camera.position) > 1e-7) throw Error("camera jumped on entry");
      });
      await sheet.waitFor();
      await page.waitForFunction(() => document.getAnimations().every(a => a.effect?.target?.className !== "modal upgrade-modal" || a.playState !== "running"));
      assert.equal(await offers.count(), 3);
      const ids = await offers.evaluateAll(buttons => buttons.map(button => button.dataset.upgrade));

      if (mobile) await offers.nth(2).tap();
      else await offers.nth(2).click();
      await confirm.waitFor();
      assert.equal(await confirm.isDisabled(), true);
      assert.match(await sheet.locator("#upgrade-payment").textContent(), /还需 8 金币/);
      const failedAttempt = await page.evaluate(() => window.__koa.world.confirmUpgrade());
      assert.equal(failedAttempt, false);
      await offers.first().focus();
      await page.keyboard.press("Enter");
      assert.equal(await offers.first().getAttribute("aria-pressed"), "true");
      assert.equal(await page.evaluate(() => document.activeElement.dataset.upgrade), ids[0]);
      assert.match(await sheet.locator("#upgrade-payment").textContent(), /还需 4 金币/);
      await page.keyboard.press("KeyP");
      await page.keyboard.press("KeyB");
      assert.equal(await page.evaluate(() => window.__koa.world.phase), "upgrade");

      const layout = await sheet.evaluate(panel => {
        const shell = panel.closest(".game-shell");
        const box = panel.getBoundingClientRect();
        const frame = shell.getBoundingClientRect();
        const options = [...panel.querySelectorAll(".upgrade-option")].map(el => el.getBoundingClientRect());
        return { x: box.x - frame.x, h: box.height, frame: frame.height, width: box.width,
          shellWidth: frame.width, bottom: frame.bottom - box.bottom, overflow: panel.scrollWidth - panel.clientWidth,
          rows: options.map(o => o.top), rowsEnd: options.at(-1).bottom - box.bottom,
          hudVisible: !!shell.querySelector(".ui-layer").getClientRects().length };
      });
      assert.ok(Math.abs(layout.h * 3 - layout.frame) < 1, JSON.stringify(layout));
      assert.ok(layout.x === 0 && layout.bottom === 0 && layout.width === layout.shellWidth && layout.overflow <= 0, JSON.stringify(layout));
      assert.ok(layout.rows[0] < layout.rows[1] && layout.rows[1] < layout.rows[2] && layout.rowsEnd <= 1 && layout.hudVisible, JSON.stringify(layout));

      const resourceAudit = await page.evaluate(async () => {
        const {world, renderer} = window.__koa;
        const snap = () => {
          const {content, aircraft} = renderer.diagnostics;
          const {creations, ...shared} = content.shared;
          return { ...shared, instances: aircraft.activeInstances, instanceMaterials: aircraft.instanceMaterials };
        };
        const click = i => document.querySelectorAll("[data-upgrade]")[i].click();
        const draw = () => renderer.render(world, 1/60, {display:false});
        click(2); draw(); const preview = snap();
        for (let i=0; i<4; i++) { click(0); draw(); click(2); draw(); }
        return { preview, repeated: snap() };
      });
      assert.deepEqual(resourceAudit.repeated, resourceAudit.preview);
      await back.click();
      await sheet.waitFor({state:"hidden"});
      assert.equal(await opener.evaluate(button => document.activeElement === button), true);
      await page.evaluate(() => { window.__koa.world.coins = 100; });
      await opener.click();
      await sheet.waitFor();
      assert.deepEqual(await offers.evaluateAll(buttons => buttons.map(button => button.dataset.upgrade)), ids);
      let wingId = ids[2];

      await page.evaluate(id => {
        const world = window.__koa.world;
        const confirm = world.confirmUpgrade.bind(world);
        world.confirmUpgrade = () => {
          const before = world.coins;
          const installed = confirm();
          if (installed) window.lastRefitPayment = before - world.coins;
          return installed;
        };
        const roll = world.rollUpgradeChoices.bind(world);
        world.rollUpgradeChoices = (...args) => {
          roll(...args);
          const wing = world.legalUpgradeOptions.find(upgrade => upgrade.id === id);
          if (wing && !world.choices.includes(wing)) world.choices[2] = wing;
        };
      }, wingId);
      for (let i = 0; i < (mobile ? 1 : 10); i++) {
        if (i > 0) await opener.click();
        await sheet.locator('[data-upgrade="' + wingId + '"]').click();
        assert.equal(await confirm.isEnabled(), true);
        const cameraEntry = await page.evaluate(() => {
          const {world, renderer} = window.__koa;
          for (let f=0; f<8; f++) renderer.render(world, .12, { display:false });
          const bounds = renderer.upgradeBounds;
          const point = bounds.affected.getCenter(bounds.aircraft.min.clone());
          return point.project(renderer.camera).toArray();
        });
        assert.ok(Math.abs(cameraEntry[0]) < .95 && cameraEntry[1] > -.30 && cameraEntry[1] < .97, JSON.stringify(cameraEntry));
        if (i === 0) { await confirm.focus(); await page.keyboard.press("Enter"); }
        else await confirm.click();
        await sheet.waitFor({state:"hidden"});
        const state = await page.evaluate(() => ({
          payment: window.lastRefitPayment, phase: window.__koa.world.phase,
          mounts: window.__koa.world.player.weapons.map(w => w.anchorId),
          instances: window.__koa.renderer.diagnostics.aircraft.activeInstances,
          enemies: window.__koa.renderer.enemies.size,
        }));
        assert.equal(state.payment, 8);
        assert.equal(state.phase, "battle");
        assert.equal(state.mounts.filter(id => id.startsWith(wingId)).length, i + 1);
        assert.equal(new Set(state.mounts).size, state.mounts.length);
        assert.equal(state.instances, state.enemies + 1);
      }
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({width,height,layout,resourceAudit, wingInstalls:mobile?1:10}));
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
