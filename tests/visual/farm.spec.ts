import { expect, test, type Page } from "@playwright/test";
import { openLobby, snap } from "./helpers";

// Hub redesign phase 4: the Farm scene. The harness has no database, so this
// page answers /api/farm and /api/farm/act itself, the way the server does.
async function fakeFarm(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    const now = () => new Date().toISOString();
    const at = (s: number) => new Date(Date.now() + s * 1000).toISOString();
    const plots = Array.from({ length: 50 }, (_, i) => ({
      i,
      owned: i % 10 < 5 && Math.floor(i / 10) < 3,
      crop: null as string | null,
      progress: 0,
      ripeAt: null as string | null,
      wet: false,
      fertilizer: null,
      mutation: null,
    }));
    Object.assign(plots[0], { crop: "wheat", progress: 1, ripeAt: at(-60) });
    Object.assign(plots[1], {
      crop: "carrot",
      progress: 0.4,
      ripeAt: at(2400),
      wet: true,
    });
    Object.assign(plots[2], { crop: "wheat", progress: 0.8, ripeAt: at(700) });
    Object.assign(plots[4], {
      crop: "carrot",
      progress: 1,
      ripeAt: at(-30),
      mutation: "gold",
    });
    const farm = {
      now: now(),
      level: 3,
      xp: 20,
      landBought: 0,
      barnCap: 80,
      barnUpgrades: 0,
      fertilizer: { norm: 3, super: 1, gold: 0 },
      plots,
      seeds: { wheat: 9, carrot: 6 },
      barn: [{ crop: "wheat", mutation: "", qty: 4 }],
      harvests: { wheat: 2 },
      market: {
        day: "2026-11-02",
        hot: "carrot",
        mult: { wheat: 1.1, carrot: 1.7, voltberry: 0.9, mint: 1.2 },
      },
      shop: {
        window: "1",
        restockAt: at(5000),
        stock: { wheat: 24, carrot: 22, voltberry: 21, mint: 25 },
      },
      leaves: 1234,
      weather: { now: "storm", next: "rainbow", later: "sun", until: at(5000) },
      bookRewards: [5],
      wishReady: true,
      orders: [
        {
          slot: 0,
          items: [["wheat", 3]],
          leaves: 20,
          xp: 9,
          bonus: "super",
          who: "Tidefin's Kitchen",
          face: "tidefin",
          waitUntil: null,
        },
        {
          slot: 1,
          items: [["carrot", 4]],
          leaves: 30,
          xp: 16,
          bonus: null,
          who: "Raid Hall",
          face: "auralynx",
          waitUntil: null,
        },
        {
          slot: 2,
          items: null,
          leaves: null,
          xp: null,
          bonus: null,
          who: null,
          face: null,
          waitUntil: at(240),
        },
      ],
    };
    w.__farmRequests = [];
    const fetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = String(input);
      const json = (v: unknown) =>
        new Response(JSON.stringify(v), {
          headers: { "Content-Type": "application/json" },
        });
      if (url.endsWith("/api/farm")) return json({ ...farm, now: now() });
      if (url.endsWith("/api/farm/act")) {
        const body = JSON.parse(String(init?.body));
        w.__farmRequests.push(body);
        const results = body.actions.map((a: any) => {
          const p = plots[a.plot];
          if (a.a === "harvest" && p?.crop && p.progress >= 1) {
            Object.assign(p, { crop: null, progress: 0, ripeAt: null });
            return { ok: true, crop: "wheat", qty: 2, xp: 3 };
          }
          if (a.a === "plant" && p && !p.crop) {
            Object.assign(p, { crop: a.crop, progress: 0, ripeAt: at(3600) });
            return { ok: true };
          }
          return { ok: false, error: "Not in this test" };
        });
        return json({ farm: { ...farm, now: now() }, results });
      }
      if (url.endsWith("/api/farm/wish")) {
        w.__farmRequests.push({ wish: true });
        farm.wishReady = false;
        farm.seeds = { ...farm.seeds, mint: 1, voltberry: 2 };
        return json({
          farm: { ...farm, now: now() },
          ok: true,
          seeds: ["mint", "voltberry", "voltberry"],
        });
      }
      if (url.endsWith("/api/farm/order")) {
        const body = JSON.parse(String(init?.body));
        w.__farmRequests.push(body);
        const o = farm.orders[body.slot];
        const gained = {
          leaves: o.leaves,
          xp: o.xp,
          bonus: o.bonus,
          who: o.who,
        };
        farm.orders[body.slot] = {
          ...o,
          items: null,
          waitUntil: at(body.kind === "deliver" ? 4800 : 300),
        };
        if (body.kind === "deliver") {
          farm.barn = [{ crop: "wheat", mutation: "", qty: 1 }];
          farm.leaves += gained.leaves;
        }
        return json({
          farm: { ...farm, now: now() },
          ok: true,
          gained: body.kind === "deliver" ? gained : null,
        });
      }
      const response = await fetch(input, init);
      if (!url.includes("/api/economy")) return response;
      const body = await response.json();
      return json({
        ...body,
        leaves: {
          balance: 1234,
          tradedToday: 0,
          tradeCap: 40,
          tradeLeaves: 100,
          tradeCoins: 5,
        },
      });
    };
  });
}
type Box = { name: string; x: number; y: number; w: number; h: number };
const overlap = (a: Box, b: Box) =>
  a.x < b.x + b.w - 1 &&
  b.x < a.x + a.w - 1 &&
  a.y < b.y + b.h - 1 &&
  b.y < a.y + a.h - 1;
async function hudBoxes(page: Page) {
  return page.evaluate(() => {
    const out: Box[] = [];
    for (const [name, sel] of [
      ["profile", "#account-profile"],
      ["scenes", "#hub-scenes"],
      ["coins", "#account-coins > *"],
      ["leaves", "#account-leaves > *"],
      ["menu", ".header-menu > summary"],
      ["badge", "#fm-badge"],
      ["chips", "#fm-chips"],
      ["dock", "#fm-dock"],
      ["tools", "#fm-tools"],
      ["zoom", "#fm-zoom"],
    ]) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.width && r.height && getComputedStyle(el).display !== "none")
        out.push({ name, x: r.left, y: r.top, w: r.width, h: r.height });
    }
    return out;
  });
}

for (const viewport of [
  { width: 1440, height: 900, inset: null },
  { width: 844, height: 390, inset: null },
  {
    width: 852,
    height: 393,
    inset: { left: 59, right: 59, bottom: 21, top: 0 },
  },
]) {
  test(`the farm opens from the Lobby and its HUD fits at ${viewport.width}x${viewport.height}${viewport.inset ? " with a Dynamic Island" : ""}`, async ({
    browser,
  }, info) => {
    const phone = viewport.width < 1000;
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: phone,
      hasTouch: phone,
    });
    try {
      const page = await context.newPage();
      const errors = await openLobby(page);
      await fakeFarm(page);
      if (viewport.inset)
        await page.evaluate((inset) => {
          for (const [key, value] of Object.entries(inset))
            document.documentElement.style.setProperty(
              `--safe-${key}`,
              `${value}px`,
            );
        }, viewport.inset);
      await expect(page.locator("#account-leaves")).toContainText("1,234");
      await expect(page.locator("#account-leaves")).toContainText("1,234");
      await page.click('#hub-scenes [data-hub-scene="farm"]');
      await expect(page.locator(".farm-layer #fm-cv")).toBeVisible();
      await expect(page.locator("#fm-badge")).toContainText("tester's Farm");
      await expect(page.locator("#fm-badge")).toContainText("20/");
      await expect(page.locator("#fm-tools [data-tool]")).toHaveCount(5);
      await page.waitForTimeout(600);
      await snap(
        page,
        info,
        `farm-${viewport.width}x${viewport.height}${viewport.inset ? "-island" : ""}`,
      );
      const all = await hudBoxes(page);
      const left = viewport.inset?.left ?? 0,
        right = viewport.inset?.right ?? 0,
        bottom = viewport.inset?.bottom ?? 0;
      for (const b of all) {
        expect(b.x, `${b.name} left`).toBeGreaterThanOrEqual(left - 1);
        expect(b.x + b.w, `${b.name} right`).toBeLessThanOrEqual(
          viewport.width - right + 1,
        );
        expect(b.y + b.h, `${b.name} bottom`).toBeLessThanOrEqual(
          viewport.height - bottom + 1,
        );
      }
      const clashes = all.flatMap((a, i) =>
        all
          .slice(i + 1)
          .filter((b) => overlap(a, b))
          .map((b) => `${a.name} × ${b.name}`),
      );
      expect(clashes).toEqual([]);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

test("the weather orb shows the weather now and the forecast", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await openLobby(page);
  await fakeFarm(page);
  await page.click('#hub-scenes [data-hub-scene="farm"]');
  const orb = page.locator('#fm-chips [data-orb="weather"]');
  await expect(orb).toBeVisible();
  await expect(orb).toHaveAttribute("aria-label", /Thunderstorm: 25% Shocked/);
  await orb.click();
  const pop = page.locator("#fm-orbpop");
  await expect(pop).toBeVisible();
  await expect(pop).toContainText("Thunderstorm");
  await expect(pop).toContainText("until it changes");
  await expect(pop.locator(".op-next")).toContainText("Rainbow");
  await snap(page, info, "farm-weather-orb");
  // Tapping it again closes it; the barn orb sits beside it.
  await orb.click();
  await expect(pop).toBeHidden();
  await expect(page.locator('#fm-chips [data-orb="barn"]')).toBeVisible();
  // The almanac lists the crop book rewards, with the one already paid.
  await page.click('#fm-dock [data-sheet="book"]');
  await expect(page.locator("#fm-sheet")).toContainText("Collection rewards");
  await expect(page.locator("#fm-sheet .mile.done")).toHaveCount(1);
  await expect(page.locator("#fm-sheet .mile")).toHaveCount(4);
  // Mastery is the almanac's second tab; it opens at farm level 40.
  await page.click('#fm-sheet [data-tab="mastery"]');
  await expect(page.locator("#fm-sheet")).toContainText(
    "Unlocks at farm Lv 40",
  );
  await expect(page.locator('#fm-sheet [data-mast="wheat"]')).toBeDisabled();
  expect(errors).toEqual([]);
});

test("the order board delivers what the barn holds", async ({ page }, info) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await openLobby(page);
  await fakeFarm(page);
  await page.click('#hub-scenes [data-hub-scene="farm"]');
  // One order can be filled from the barn (4 wheat): the menu shows a dot.
  await expect(page.locator("#fm-ord-dot")).toBeVisible();
  await page.click('#fm-dock [data-sheet="orders"]');
  const sheet = page.locator("#fm-sheet");
  await expect(sheet).toContainText("Order board");
  await expect(sheet.locator(".order")).toHaveCount(3);
  await expect(sheet.locator('[data-ord="0"]')).toBeEnabled();
  await expect(sheet.locator('[data-ord="1"]')).toBeDisabled(); // no carrots
  await expect(sheet.locator(".order.wait")).toContainText("New order in");
  await snap(page, info, "farm-orders-1280x800");
  await sheet.locator('[data-ord="0"]').click();
  await expect(page.locator("#toast")).toContainText(
    "Delivered to Tidefin's Kitchen: +20 Gold Leaves",
  );
  expect(
    await page.evaluate(() =>
      (window as any).__farmRequests.find((r: any) => r.slot === 0),
    ),
  ).toMatchObject({ slot: 0, kind: "deliver", request: expect.any(String) });
  await expect(sheet.locator(".order.wait")).toHaveCount(2);
  await expect(page.locator("#fm-ord-dot")).toBeHidden();
  // The wishing well grants seeds once a day.
  await page.locator("#fm-sheet [data-close]").click();
  const well = await page.evaluate(() => {
    const f = (window as any).__farm;
    return f.worldClient(f.well.x, f.well.y - 50);
  });
  await page.mouse.click(well.x, well.y);
  await expect(page.locator("#toast")).toContainText(
    "Wish granted: Spirit Mint, Volt Berry, Volt Berry seeds",
  );
  expect(errors).toEqual([]);
});

test("tapping a ripe plot harvests it, and an empty plot opens the seed picker", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  try {
    const page = await context.newPage();
    const errors = await openLobby(page);
    await fakeFarm(page);
    await page.click('#hub-scenes [data-hub-scene="farm"]');
    await expect(page.locator("#fm-badge")).toContainText("tester's Farm");
    await page.waitForTimeout(400);
    const plot = (i: number) =>
      page.evaluate((i) => (window as any).__farm.plotClient(i), i);
    const ripe = await plot(0);
    await page.mouse.click(ripe.x, ripe.y);
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window as any).__farmRequests.flatMap((r: any) => r.actions),
        ),
      )
      .toEqual([{ a: "harvest", plot: 0 }]);
    const empty = await plot(3);
    await page.mouse.click(empty.x, empty.y);
    await expect(page.locator("#fm-pop")).toBeVisible();
    await snap(page, info, "farm-seed-picker-1280x800");
    await page.locator('#fm-pop [data-pseed="carrot"]').click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window as any).__farmRequests.flatMap((r: any) => r.actions),
        ),
      )
      .toContainEqual({ a: "plant", plot: 3, crop: "carrot" });
    // The market sheet opens from the menu.
    await page.click('#fm-dock [data-sheet="market"]');
    await expect(page.locator("#fm-sheet")).toContainText("Farmers' market");
    await expect(page.locator("#fm-sheet")).toContainText("Wheat ×");
    await snap(page, info, "farm-market-1280x800");
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
