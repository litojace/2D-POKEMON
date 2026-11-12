import { expect, test, type Page } from "@playwright/test";
import { openHub, openPlayPanel, pushUntilBattle, snap } from "./helpers";

// Grumblecrag's pillars are drawn like the painted cave
// (raid-grumble-pillars.ts): one atlas drawn while the battle scene is
// created, then each frame only places images from it. Standing, crumbling,
// broken and rising pillars, and the impact ring, are each drawn from it.
test.use({ viewport: { width: 1440, height: 900 } });

const MARKER = 'this.cameras.main.setBackgroundColor("#142746");';
async function enter(page: Page) {
  await page.route(/\/apps\/client\/src\/main\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch(),
      body = await response.text(),
      loop =
        "gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);";
    expect(body).toContain(loop);
    expect(body).toContain(MARKER);
    await route.fulfill({
      response,
      body: body
        .replace(loop, "window.__pillarGame=gameInstance;" + loop)
        // The textures there are when the scene's create() ends, before its first frame.
        .replace(
          MARKER,
          MARKER + "window.__atCreate=this.textures.getTextureKeys();",
        ),
    });
  });
  const errors = await openHub(page);
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.evaluate(() =>
    (window as any).__room("raid", {
      boss: "grumblecrag",
      pos: [660, 470, 700, 760],
    }),
  );
  await openPlayPanel(page);
  await page.click("#play-create");
  await pushUntilBattle(page);
  // The scene clock the pillars run on, frozen on demand to look mid-change.
  await page.evaluate(() => {
    const w = window as any,
      t = w.__pillarGame.scene.getScene("arena").time;
    let real = t.now;
    Object.defineProperty(t, "now", {
      configurable: true,
      get: () => w.__frozen ?? real,
      set: (v) => (real = v),
    });
  });
  return errors;
}
/** Which pillar pieces show (by name), and the pooled effect pieces' frames. */
const pieces = (page: Page) =>
  page.evaluate(() => {
    const scene = (window as any).__pillarGame.scene.getScene("arena");
    const shown: Record<string, { alpha: number; crop: boolean; y: number }> =
      {};
    const fx: string[] = [];
    const keys = new Set<string>();
    for (const o of scene.children.list) {
      if (!o.visible || o.type !== "Image") continue;
      if (o.name === "pillar-fx") fx.push(o.frame.name);
      else if (o.name?.startsWith("pillar-"))
        shown[o.name.slice(7)] = { alpha: o.alpha, crop: o.isCropped, y: o.y };
      if (o.name?.startsWith("pillar-")) keys.add(o.texture.key);
    }
    return {
      shown,
      fx,
      keys: [...keys],
      drawn: scene.pillarRig?.drawn as number,
      blocks: scene.courtBlocks
        .get("classic")
        ?.some((b: any) => b.img.visible) as boolean,
    };
  });
const freeze = (page: Page) =>
  page.evaluate(() => {
    const w = window as any;
    w.__t0 = w.__pillarGame.scene.getScene("arena").time.now;
    w.__frozen = w.__t0;
  });
/** Two frames drawn since now (this machine draws a few a second). */
/** `n` frames drawn from now (this machine draws only a few a second under load). */
const frames = async (page: Page, n = 3) => {
  const f0 = await page.evaluate(() => (window as any).__pillarGame.loop.frame);
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const w = window as any;
          w.__push();
          return w.__pillarGame.loop.frame;
        }),
      { timeout: 90_000, intervals: [300] },
    )
    .toBeGreaterThanOrEqual(f0 + n);
};
const at = async (page: Page, ms: number) => {
  await page.evaluate(
    (ms) => ((window as any).__frozen = (window as any).__t0 + ms),
    ms,
  );
  await frames(page);
};
const push = (page: Page, fn: string) =>
  page.evaluate((fn) => {
    const w = window as any;
    new Function("s", fn)(w.__snap);
    w.__push();
  }, fn);

test("Grumblecrag's pillars stand, crumble, lie broken and rise from one atlas drawn at scene creation", async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  const errors = await enter(page);
  // Drawn while the scene was created, not on a fight's first frame.
  expect(
    await page.evaluate(() => (window as any).__atCreate as string[]),
  ).toContain("grumble-pillars-atlas");
  const size = await page.evaluate(() => {
    const s = (window as any).__pillarGame.scene
      .getScene("arena")
      .textures.get("grumble-pillars-atlas").source[0];
    return { w: s.width, h: s.height };
  });
  // Well under 10 MB of texture memory.
  expect(size.w * size.h * 4).toBeLessThan(6_000_000);

  // Standing: per pillar its shadow, stone and crystal light; the PvP blocks stay hidden.
  await frames(page, 3);
  const intact = await pieces(page);
  for (let i = 0; i < 5; i++) {
    expect(intact.shown[`block${i}`]?.alpha).toBe(1);
    expect(intact.shown[`shadow${i}`]).toBeDefined();
    expect(intact.shown[`light${i}`]).toBeDefined();
    expect(intact.shown[`rubble${i}`]).toBeUndefined();
  }
  expect(intact.blocks).toBe(false);
  expect(intact.keys).toEqual(["grumble-pillars-atlas"]);
  expect(intact.drawn).toBeLessThanOrEqual(16);
  const drawn: Record<string, number> = { intact: intact.drawn };
  await snap(page, info, "pillars-intact");

  // The boss charges into two: cracks, the stone sinking (cut at the floor)
  // into its rubble, the impact ring, dust and thrown stones.
  await freeze(page);
  await push(
    page,
    "s.raid.pillars[0].broken = true; s.raid.pillars[4].broken = true;" +
      "s.events = [{ id: 990001, kind: 'raid-impact', x: 535, y: 305, color: 0xffd65b, raidRadius: 100 }];",
  );
  await frames(page, 3);
  await at(page, 380);
  const crumbling = await pieces(page);
  expect(crumbling.shown.block0?.crop).toBe(true);
  expect(crumbling.shown.block0.y).toBeGreaterThan(intact.shown.block0.y);
  expect(crumbling.shown.cracks0).toBeDefined();
  expect(crumbling.shown.rubble0?.alpha).toBeGreaterThan(0);
  expect(crumbling.fx).toContain("ring");
  drawn.crumbling = crumbling.drawn;
  expect(crumbling.fx.filter((f) => f === "dust").length).toBeGreaterThan(0);
  expect(
    crumbling.fx.filter((f) => f.startsWith("chunk")).length,
  ).toBeGreaterThan(0);
  await snap(page, info, "pillars-crumbling");

  // Broken: a heap with its own light, no stone, no shadow; the others stand.
  await at(page, 5000);
  const broken = await pieces(page);
  for (const i of [0, 4]) {
    expect(broken.shown[`block${i}`]).toBeUndefined();
    expect(broken.shown[`shadow${i}`]).toBeUndefined();
    expect(broken.shown[`rubble${i}`]?.alpha).toBe(1);
    expect(broken.shown[`rlight${i}`]).toBeDefined();
  }
  expect(broken.shown.block1?.alpha).toBe(1);
  drawn.broken = broken.drawn;
  expect(broken.fx.filter((f) => f !== "glint")).toEqual([]);
  await snap(page, info, "pillars-broken");

  // All five down, then they rise back out of the floor.
  await freeze(page);
  await push(
    page,
    "s.events = []; s.raid.pillars.forEach(p => p.broken = true)",
  );
  await frames(page, 3);
  await at(page, 5000);
  await freeze(page);
  await push(page, "s.raid.pillars.forEach(p => p.broken = false)");
  await frames(page, 3);
  await at(page, 100);
  const rising = await pieces(page);
  for (let i = 0; i < 5; i++) {
    expect(rising.shown[`block${i}`]?.crop).toBe(true);
    expect(rising.shown[`rubble${i}`]?.alpha).toBeGreaterThan(0);
  }
  await snap(page, info, "pillars-rising");
  drawn.rising = rising.drawn;
  await at(page, 3000);
  const risen = await pieces(page);
  for (let i = 0; i < 5; i++) {
    expect(risen.shown[`block${i}`]?.crop).toBe(false);
    expect(risen.shown[`rubble${i}`]).toBeUndefined();
  }
  await page.evaluate(() => ((window as any).__frozen = undefined));

  // Low graphics: no crystal light or glint, the stones unchanged.
  await page.evaluate(() => localStorage.setItem("ea-graphics", "low"));
  await frames(page, 3);
  const low = await pieces(page);
  for (let i = 0; i < 5; i++) {
    expect(low.shown[`block${i}`]?.alpha).toBe(1);
    expect(low.shown[`light${i}`]).toBeUndefined();
  }
  expect(low.fx).toEqual([]);
  drawn.low = low.drawn;
  console.log("pillar images per frame", JSON.stringify(drawn));
  expect(errors).toEqual([]);
});
