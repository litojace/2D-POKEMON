import { expect, test, type Page } from "@playwright/test";
import { openHub, openPlayPanel, pushUntilBattle } from "./helpers";
const OUT = "/tmp/claude-0/-home-user-2D-POKEMON/5edba7b6-acb8-5e5e-bd3b-48895caa9937/scratchpad/w2battle";
async function expose(page: Page) {
  await page.route(/harness\/rooms\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      "w.__snap = packSnapshot(a.snapshot());",
      "w.__arena = a; w.__pack = packSnapshot; w.__snap = packSnapshot(a.snapshot());",
    );
    expect(body).toContain("w.__arena = a");
    await route.fulfill({ response, body });
  });
}
async function run(page: Page, n: number, setup?: string) {
  for (let i = 0; i < n; i++) {
    await page.evaluate(
      ([code]) => {
        const w = window as any, a = w.__arena;
        if (code) new Function("a", "me", "them", code)(a, a.players[0], a.players[1]);
        a.tick();
        w.__snap = w.__pack(a.snapshot());
        w.__push();
      },
      [i === 0 ? (setup ?? "") : ""],
    );
    await page.waitForTimeout(33);
  }
}
async function start(page: Page, character: string) {
  // exposed in rooms.ts for this run
  const errors = await openHub(page);
  await page.evaluate((c) => (window as any).__room("practice", { character: c, pos: [300, 150, 650, 150] }), character);
  await openPlayPanel(page);
  await page.click("#practice");
  await pushUntilBattle(page);
  await page.waitForTimeout(1500);
  return errors;
}
const shot = (page: Page, name: string) => page.locator("#game").screenshot({ path: `${OUT}/${name}.png` });
const skill = (id: string) => `a.kit(me).skills.find(k => k.id === "${id}")`;
const aim = (x: number, y: number) => `me.lastInput = {...me.lastInput, aimX: ${x}, aimY: ${y}}; me.angle = Math.atan2(${y} - me.y, ${x} - me.x);`;


const T = (name: string, who: string, fn: (page: Page) => Promise<void>) =>
  test(name, async ({ page }) => {
    test.setTimeout(240000);
    await page.setViewportSize({ width: 1280, height: 720 });
    const errors = await start(page, who);
    await fn(page);
    expect(errors).toEqual([]);
  });
T("lumoth flash and rays", "lumoth", async (page) => {
  await run(page, 6, `them.angle = Math.PI; them.lastInput = {...them.lastInput, aimX: me.x, aimY: me.y}; a.cast(me, ${skill("eyespot-flash")});`);
  await shot(page, "l1-flash");
  await run(page, 40);
  await run(page, 20, `a.cast(me, ${skill("radiant-flare")});`);
  await shot(page, "l2-rays");
});
T("coilemur clamp", "coilemur", async (page) => {
  await run(page, 12, `Object.assign(them, {x: 400, y: 150}); a.cast(me, ${skill("static-clamp")});`);
  await shot(page, "c1-clamped");
  await run(page, 36);
  await shot(page, "c2-burst");
});
T("shadopus grasp", "shadopus", async (page) => {
  await run(page, 8, `Object.assign(them, {x: 400, y: 150}); a.cast(me, ${skill("kraken-grasp")});`);
  await shot(page, "k1-held");
  await run(page, 12, `me.lastInput = {...me.lastInput, aimX: 300, aimY: 0};`);
  await shot(page, "k2-thrown");
});
T("astrabun pound", "astrabun", async (page) => {
  await run(page, 10, `Object.assign(them, {x: 400, y: 150}); a.cast(me, ${skill("mochi-pound")});`);
  await run(page, 2, `a.cast(me, ${skill("mochi-pound")});`);
  await shot(page, "m1-pound2");
});
T("auralynx cage", "auralynx", async (page) => {
  await run(page, 20, `Object.assign(me, {x: 600, y: 300}); Object.assign(them, {x: 700, y: 300}); a.cast(me, ${skill("crystal-cage")});`);
  await shot(page, "a1-cage");
});
