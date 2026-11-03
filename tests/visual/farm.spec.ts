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
      pests: 0,
    }));
    Object.assign(plots[0], { crop: "wheat", progress: 1, ripeAt: at(-60) });
    Object.assign(plots[1], {
      crop: "carrot",
      progress: 0.4,
      ripeAt: at(2400),
      wet: true,
    });
    Object.assign(plots[2], {
      crop: "wheat",
      progress: 0.8,
      ripeAt: at(700),
      pests: 1,
    });
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
      // Every tool bar slot in use (7 tools), a scarecrow and a sprinkler.
      tools: {
        can: 2,
        bigNet: false,
        sickle: true,
        scarecrow: true,
        sprinklers: 1,
      },
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
      // The third forecast ("later") is only Mystowl's (migration 046).
      weather: { now: "storm", next: "rainbow", until: at(5000) },
      bookRewards: [5],
      wishReady: true,
      // No farmer before migration 046: set by the perk test.
      farmer: undefined as string | undefined,
      perksUsed: [] as string[],
      decor: [] as { slot: number; item: string }[],
      charm: 0,
      decorCredits: {} as Record<string, number>,
      // The Cow Pasture (migration 049).
      pasture: false,
      milkAt: null as string | null,
      milkMult: 1.12,
      dog: null as any,
      dogGifts: [] as any[],
      crows: {} as Record<string, string>,
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
    w.__fakeFarm = farm;
    const fetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = String(input);
      const json = (v: unknown) =>
        new Response(JSON.stringify(v), {
          headers: { "Content-Type": "application/json" },
        });
      if (url.endsWith("/api/farm")) return json({ ...farm, now: now() });
      // Friends' farms (migration 047).
      if (url.endsWith("/api/farm/friends")) return json(w.__friends ?? []);
      if (url.endsWith("/api/farm/visit/act")) {
        const body = JSON.parse(String(init?.body));
        w.__farmRequests.push(body);
        const v = w.__visit;
        const results = body.actions.map((a: any) => {
          const p = v.plots[a.plot];
          if (a.a === "sneak" && p.sneak) {
            p.sneak = false;
            return { ok: true, crop: p.crop, qty: 1, mutation: "" };
          }
          if (a.a === "catch" && p.pests) {
            p.pests--;
            return { ok: true, xp: 3 };
          }
          return { ok: false, error: "Not in this test" };
        });
        return json({ farm: { ...v, now: now() }, results, leaves: 1234 });
      }
      if (url.includes("/api/farm/visit/"))
        return json({ ...w.__visit, now: now() });
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
          if (a.a === "catch" && p?.pests) {
            p.pests--;
            return { ok: true, caught: 1, xp: 1 };
          }
          if (a.a === "decor") {
            farm.decor = farm.decor.filter((d: any) => d.slot !== a.slot);
            farm.decor.push({ slot: a.slot, item: a.item });
            farm.charm += 1;
            farm.leaves -= 300;
            return { ok: true, decor: a.item, slot: a.slot, cost: 300 };
          }
          if (a.a === "farmer") {
            farm.farmer = a.id;
            return { ok: true, farmer: a.id };
          }
          if (a.a === "perk" && farm.farmer === "voltkit") {
            farm.perksUsed = ["zap"];
            let cleared = 0;
            for (const q of plots) {
              cleared += q.pests;
              q.pests = 0;
            }
            return { ok: true, perk: "zap", cleared };
          }
          if (a.a === "shoo" && farm.crows[a.plot]) {
            delete farm.crows[a.plot];
            return { ok: true, shooed: true };
          }
          if (a.a === "hire-dog") {
            const price = { gold: [60, 150], black: [180, 450] } as any;
            farm.leaves -= price[a.dog][a.days === 3 ? 1 : 0];
            const extended = farm.dog?.type === a.dog;
            farm.dog = {
              type: a.dog,
              since: extended ? farm.dog.since : now(),
              until: at((extended ? 86400 : 0) + a.days * 86400),
            };
            return { ok: true, dog: a.dog, days: a.days, extended };
          }
          if (a.a === "buy-pasture" && !farm.pasture && farm.level >= 9) {
            farm.pasture = true;
            farm.milkAt = at(4800);
            farm.leaves -= 900;
            return { ok: true, pasture: true, milkAt: farm.milkAt };
          }
          if (a.a === "milk" && farm.pasture) {
            farm.milkAt = at(19200);
            farm.barn = [...farm.barn, { crop: "milk", mutation: "", qty: 2 }];
            return { ok: true, milk: 2, milkAt: farm.milkAt };
          }
          if (a.a === "sell-milk") {
            const m = farm.barn.find((b: any) => b.crop === "milk");
            if (!m || m.qty < a.qty)
              return { ok: false, error: "You don't have that many" };
            m.qty -= a.qty;
            const leaves = Math.round(60 * farm.milkMult) * a.qty;
            farm.leaves += leaves;
            return { ok: true, leaves };
          }
          if (a.a === "buy-tool" && a.tool === "net2") {
            farm.tools.bigNet = true;
            farm.leaves -= 700;
            return { ok: true, tool: "net2", cost: 700 };
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
      // A farmer (migration 046) adds the perk orb: all four orbs show.
      await page.evaluate(() => {
        (window as any).__fakeFarm.farmer = "voltkit";
      });
      await page.click('#hub-scenes [data-hub-scene="farm"]');
      await expect(page.locator(".farm-layer #fm-cv")).toBeVisible();
      await expect(page.locator("#fm-chips [data-orb]")).toHaveCount(4);
      await expect(page.locator("#fm-badge")).toContainText("tester's Farm");
      await expect(page.locator("#fm-badge")).toContainText("20/");
      await expect(page.locator("#fm-tools [data-tool]")).toHaveCount(7);
      await page.waitForTimeout(600);
      await snap(
        page,
        info,
        `farm-${viewport.width}x${viewport.height}${viewport.inset ? "-island" : ""}`,
      );
      const all = await hudBoxes(page);
      // The farm badge is the player card's twin: same width, height and left edge.
      const card = all.find((b) => b.name === "profile")!,
        badge = all.find((b) => b.name === "badge")!;
      expect(badge.w, "badge width").toBeCloseTo(card.w, 1);
      expect(badge.h, "badge height").toBeCloseTo(card.h, 1);
      expect(badge.x, "badge left edge").toBeCloseTo(card.x, 1);
      expect(badge.y - (card.y + card.h), "gap under the card").toBeCloseTo(
        4,
        1,
      );
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
  await expect(page.locator("#fm-sheet .mile")).toHaveCount(5);
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

test("a tap catches a bug, and the Tools tab sells tools", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  try {
    const page = await context.newPage();
    const errors = await openLobby(page);
    await fakeFarm(page);
    await page.evaluate(() => {
      (window as any).__fakeFarm.level = 12;
    });
    await page.click('#hub-scenes [data-hub-scene="farm"]');
    await expect(page.locator("#fm-badge")).toContainText("tester's Farm");
    // Seven tools, the can showing the one you own.
    await expect(page.locator("#fm-tools [data-tool]")).toHaveCount(7);
    await expect(page.locator('#fm-tools [data-tool="can"]')).toContainText(
      "Copper",
    );
    await page.waitForTimeout(400);
    const bug = await page.evaluate(() => (window as any).__farm.plotClient(2));
    await page.mouse.click(bug.x, bug.y);
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window as any).__farmRequests.flatMap((r: any) => r.actions),
        ),
      )
      .toEqual([{ a: "catch", plot: 2 }]);
    await page.click('#fm-dock [data-sheet="shop"]');
    await page.click('#fm-sheet [data-tab="tools"]');
    const sheet = page.locator("#fm-sheet");
    await expect(sheet).toContainText("Tools are yours forever.");
    await expect(
      sheet.locator(".item", { hasText: "Scarecrow" }).locator("button"),
    ).toHaveText("Owned");
    await expect(sheet.locator(".item", { hasText: "Gold Can" })).toContainText(
      "unlocks at Lv 30",
    );
    await expect(
      sheet.locator(".item", { hasText: "Sprinkler (1/5)" }),
    ).toContainText("unlocks at Lv 26");
    await snap(page, info, "farm-tools-1280x800");
    await sheet.locator('[data-buytool="net2"]').click();
    await expect(page.locator("#toast")).toContainText("Bought Big Net");
    await expect(
      sheet.locator(".item", { hasText: "Big Net" }).locator("button"),
    ).toHaveText("Owned");
    await expect(page.locator('#fm-tools [data-tool="net"]')).toContainText(
      "Big Net",
    );
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("a tap shoos a crow, and a guard dog can be hired from its orb", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  try {
    const page = await context.newPage();
    const errors = await openLobby(page);
    await fakeFarm(page);
    await page.evaluate(() => {
      const f = (window as any).__fakeFarm;
      f.level = 20;
      // A crow landed on the ripe wheat 2 s ago; Goldie dug up seeds.
      f.crows = { "0": new Date(Date.now() - 2000).toISOString() };
      f.dogGifts = [
        {
          at: new Date(Date.now() - 60_000).toISOString(),
          dog: "gold",
          kind: "seeds",
          crop: "mint",
          qty: 2,
        },
      ];
    });
    await page.click('#hub-scenes [data-hub-scene="farm"]');
    await expect(page.locator("#fm-badge")).toContainText("tester's Farm");
    await expect(page.locator("#toast")).toContainText(
      "Goldie dug up 2 Spirit Mint seeds!",
    );
    await page.waitForTimeout(1200);
    await snap(page, info, "farm-crow-1280x800");
    const plot = await page.evaluate(() =>
      (window as any).__farm.plotClient(0),
    );
    await page.mouse.click(plot.x, plot.y);
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window as any).__farmRequests.flatMap((r: any) => r.actions),
        ),
      )
      .toEqual([{ a: "shoo", plot: 0 }]);
    // No dog yet: the orb says so and opens the Guard Dogs tab.
    await page.click('#fm-chips [data-orb="dog"]');
    await expect(page.locator("#fm-orbpop")).toContainText("No guard dog");
    await page.click('#fm-orbpop [data-orbgo="dogs"]');
    const sheet = page.locator("#fm-sheet");
    await expect(sheet).toContainText("Hire a guard dog by the day.");
    await expect(
      sheet.locator(".dogcard", { hasText: "Fluffy" }),
    ).toContainText("Unlocks at Lv 40");
    await sheet.locator('[data-dog="gold"][data-days="3"]').click();
    await expect(page.locator("#toast")).toContainText(
      "Goldie is guarding your farm for 3 days!",
    );
    await expect(
      sheet.locator(".dogcard", { hasText: "Goldie" }),
    ).toContainText(/On guard · (3d|2d 23h) left/);
    await snap(page, info, "farm-dogs-1280x800");
    await expect(page.locator('#fm-chips [data-orb="dog"]')).toHaveAttribute(
      "title",
      /Goldie: (3d|2d 23h) left/,
    );
    // Goldie waits by her doghouse.
    await page.click("#fm-sheet [data-close]");
    await page.evaluate(() => (window as any).__farm.look(1500, 800));
    await page.waitForTimeout(600);
    await snap(page, info, "farm-dog-on-guard-1280x800");
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("the farm follows your Lobby fighter, and Zap clears the bugs", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  // Voltkit is the fighter on the Lobby.
  await context.addInitScript(() => {
    try {
      localStorage.setItem("arena-featured-fighter", "voltkit");
    } catch {}
  });
  try {
    const page = await context.newPage();
    const errors = await openLobby(page);
    await fakeFarm(page);
    await page.evaluate(() => {
      (window as any).__fakeFarm.farmer = "lumoth";
    });
    await page.click('#hub-scenes [data-hub-scene="farm"]');
    await expect(page.locator("#fm-badge")).toContainText("tester's Farm");
    // Last time Lumoth farmed: the farm is told the farmer is now Voltkit.
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window as any).__farmRequests.flatMap((r: any) => r.actions),
        ),
      )
      .toEqual([{ a: "farmer", id: "voltkit" }]);
    const orb = page.locator('#fm-chips [data-orb="perk"]');
    await expect(orb).toHaveAttribute(
      "title",
      "Zap: Clears every bug on the farm",
    );
    await orb.click();
    await expect(page.locator("#fm-orbpop")).toContainText("Ready");
    await page.waitForTimeout(600); // the card fades in
    await snap(page, info, "farm-perk-1280x800");
    await page.click("#fm-orbpop [data-perk]");
    await expect(page.locator("#toast")).toContainText("Zap! Cleared 1 bug");
    await orb.click();
    await expect(page.locator("#fm-orbpop")).toContainText("Used today");
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("visiting a friend's farm: sneak a ripe crop, catch a bug, go home", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  try {
    const page = await context.newPage();
    const errors = await openLobby(page);
    await fakeFarm(page);
    await page.evaluate(() => {
      const w = window as any,
        at = (s: number) => new Date(Date.now() + s * 1000).toISOString();
      w.__friends = [
        {
          id: "f1",
          name: "Rae",
          fighter: "tidefin",
          level: 7,
          dog: "gold",
          bugs: 1,
          ripe: 1,
        },
      ];
      const plots = Array.from({ length: 50 }, (_, i) => ({
        i,
        owned: i % 10 < 6 && Math.floor(i / 10) < 3,
        crop: null as string | null,
        progress: 0,
        ripeAt: null as string | null,
        wet: false,
        pests: 0,
        mutation: null,
        sneak: false,
      }));
      Object.assign(plots[0], {
        crop: "wheat",
        progress: 1,
        ripeAt: at(-60),
        sneak: true,
      });
      Object.assign(plots[1], {
        crop: "carrot",
        progress: 0.5,
        ripeAt: at(1800),
        pests: 1,
      });
      w.__visit = {
        id: "f1",
        name: "Rae",
        fighter: "tidefin",
        level: 7,
        farmer: "tidefin",
        plots,
        dog: "gold",
        scarecrow: false,
        sprinklers: 0,
        today: { helpXp: 0, sneaks: 0, pranks: 0 },
      };
    });
    await page.click('#hub-scenes [data-hub-scene="farm"]');
    await expect(page.locator("#fm-badge")).toContainText("tester's Farm");
    // A friend's farm has something to do: the Friends button shows a dot.
    await expect(page.locator("#fm-fr-dot")).toBeVisible();
    await page.click('#fm-dock [data-sheet="friends"]');
    const sheet = page.locator("#fm-sheet");
    const row = sheet.locator(".fr", { hasText: "Rae · Lv 7" });
    await expect(row).toContainText("1 bug");
    await expect(row).toContainText("1 ripe");
    await expect(row).toContainText("Goldie");
    await page.waitForTimeout(500); // the sheet slides in
    await snap(page, info, "farm-friends-1280x800");
    await row.locator("[data-visit]").click();
    const banner = page.locator("#fm-visit");
    await expect(banner).toContainText("Rae's Farm");
    await expect(banner).toContainText("Goldie is on guard");
    await expect(page.locator("#fm-tools [data-tool]")).toHaveCount(4);
    await expect(page.locator('#fm-tools [data-tool="prank"]')).toContainText(
      "3",
    );
    await page.waitForTimeout(400);
    const plot = (i: number) =>
      page.evaluate((i) => (window as any).__farm.plotClient(i), i);
    const ripe = await plot(0);
    await page.mouse.click(ripe.x, ripe.y);
    await expect(page.locator("#fm-log")).toContainText(
      "Snuck 1 Breeze Wheat from Rae's farm",
    );
    const bug = await plot(1);
    await page.mouse.click(bug.x, bug.y);
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window as any).__farmRequests
            .filter((r: any) => r.friend)
            .flatMap((r: any) => r.actions),
        ),
      )
      .toEqual([
        { a: "sneak", plot: 0 },
        { a: "catch", plot: 1 },
      ]);
    await snap(page, info, "farm-visit-1280x800");
    // Tapping the snuck plot again: you already tried it.
    await page.mouse.click(ripe.x, ripe.y);
    await expect(page.locator("#toast")).toContainText(
      "You already snuck a crop from this plot",
    );
    await banner.locator("[data-home]").click();
    await expect(banner).toBeHidden();
    await expect(page.locator("#fm-tools [data-tool]")).toHaveCount(7);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("decorating: buy a decoration and place it in a glowing spot", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  try {
    const page = await context.newPage();
    const errors = await openLobby(page);
    await fakeFarm(page);
    await page.evaluate(() => {
      const f = (window as any).__fakeFarm;
      f.decor = [{ slot: 0, item: "lamp" }];
      f.charm = 2;
    });
    await page.click('#hub-scenes [data-hub-scene="farm"]');
    await expect(page.locator("#fm-badge")).toContainText("tester's Farm");
    await page.click('#fm-dock [data-sheet="decor"]');
    const sheet = page.locator("#fm-sheet");
    await expect(sheet).toContainText("Charm 2 · +1% XP");
    await expect(
      sheet.locator(".item", { hasText: "Street Lamp" }),
    ).toContainText("unlocks at Lv 12");
    await sheet.locator('[data-deco="rock"]').click();
    await expect(sheet).toContainText("Placing Mossy Rock");
    await page.waitForTimeout(500);
    await snap(page, info, "farm-decor-1280x800");
    // The second spot (230, 870 on the farm).
    const spot = await page.evaluate(() =>
      (window as any).__farm.worldClient(230, 870),
    );
    await page.mouse.click(spot.x, spot.y);
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window as any).__farmRequests.flatMap((r: any) => r.actions),
        ),
      )
      .toEqual([{ a: "decor", slot: 1, item: "rock" }]);
    await expect(page.locator("#fm-log")).toContainText(
      "Placed Mossy Rock · +1 Charm",
    );
    await expect(sheet).toContainText("Charm 3 · +1% XP");
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 844, height: 390 },
]) {
  test(`the pasture opens in the shop and the cow gives Storm Milk at ${viewport.width}x${viewport.height}`, async ({
    browser,
  }, info) => {
    const phone = viewport.width < 1000;
    const context = await browser.newContext({
      viewport,
      isMobile: phone,
      hasTouch: phone,
    });
    try {
      const page = await context.newPage();
      const errors = await openLobby(page);
      await fakeFarm(page);
      await page.evaluate(() => {
        (window as any).__fakeFarm.level = 9;
      });
      await page.click('#hub-scenes [data-hub-scene="farm"]');
      await expect(page.locator("#fm-badge")).toContainText("tester's Farm");
      const tapPasture = async () => {
        const p = await page.evaluate(() => {
          const f = (window as any).__farm;
          f.look(1600, 560);
          return f.worldClient(1600, 590);
        });
        await page.waitForTimeout(200);
        if (phone) await page.touchscreen.tap(p.x, p.y);
        else await page.mouse.click(p.x, p.y);
      };
      // Locked: a FOR SALE sign; tapping it opens the shop's Land tab.
      await tapPasture();
      const sheet = page.locator("#fm-sheet");
      const item = sheet.locator(".item", { hasText: "Cow Pasture" });
      await expect(item).toContainText("2 Storm Milk every 5h 20m");
      await page.waitForTimeout(800);
      await snap(
        page,
        info,
        `farm-pasture-shop-${viewport.width}x${viewport.height}`,
      );
      await item.locator("[data-pasture]").click();
      await expect(page.locator("#toast")).toContainText(
        "Your pasture is open. A cow moved in!",
      );
      await expect(item.locator("button")).toHaveText("Owned");
      await sheet.locator("[data-close]").click();
      await expect(sheet).toBeHidden();
      // Grazing: the server set the first milk 1 h 20 m out.
      await tapPasture();
      await expect(page.locator("#toast")).toContainText(
        "The cow is grazing. Milk in 1h 19m",
      );
      // Ready: a milk bubble over the cow; a tap collects 2 Storm Milk.
      await page.evaluate(() => {
        (window as any).__farm.F.milkAt = 0;
      });
      await page.waitForTimeout(300);
      await snap(
        page,
        info,
        `farm-pasture-milk-${viewport.width}x${viewport.height}`,
      );
      await tapPasture();
      await expect(page.locator("#fm-log")).toContainText(
        "Collected 2 Storm Milk",
      );
      // Sold at the market like a crop, through its own action. (On phones
      // the side menu opens first.)
      const market = page.locator('#fm-dock [data-sheet="market"]');
      if (!(await market.isVisible())) await page.click("#fm-dock .dk-t");
      await market.click();
      const milk = sheet.locator(".item", { hasText: "Storm Milk" });
      await expect(milk).toContainText("67");
      await snap(
        page,
        info,
        `farm-pasture-sell-${viewport.width}x${viewport.height}`,
      );
      await milk.locator("[data-sell]").first().click();
      await expect
        .poll(() =>
          page.evaluate(() =>
            (window as any).__farmRequests.flatMap((r: any) => r.actions),
          ),
        )
        .toEqual([
          { a: "buy-pasture" },
          { a: "milk" },
          { a: "sell-milk", qty: 1 },
        ]);
      await sheet.locator('[data-tab="prices"]').click();
      await expect(
        sheet.locator(".item", { hasText: "Storm Milk" }),
      ).toContainText("today 67");
      await snap(
        page,
        info,
        `farm-pasture-prices-${viewport.width}x${viewport.height}`,
      );
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 852, height: 393, inset: 59 },
]) {
  test(`the guard dog walks around the farm, into the field through the gate, and chases a crow at ${viewport.width}x${viewport.height}`, async ({
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
      await page.evaluate((inset) => {
        if (inset)
          for (const k of ["left", "right"])
            document.documentElement.style.setProperty(
              `--safe-${k}`,
              `${inset}px`,
            );
        const f = (window as any).__fakeFarm;
        f.dog = {
          type: "gold",
          since: new Date().toISOString(),
          until: new Date(Date.now() + 86400e3).toISOString(),
        };
      }, viewport.inset ?? 0);
      await page.click('#hub-scenes [data-hub-scene="farm"]');
      await expect(page.locator("#fm-badge")).toContainText("tester's Farm");
      // It leaves its doghouse and walks: the route goes round the pond and
      // the well, and into the field only through the gate.
      const route = await page.evaluate(() => {
        const f = (window as any).__farm;
        Object.assign(f.dog, { x: 250, y: 780, wait: 0, path: [] });
        f.dogTo(500, 470, true);
        return { path: f.dog.path, gate: f.gate() };
      });
      const atGate = route.path.findIndex(
        ([x, y]: number[]) => x === route.gate.x && y === route.gate.inn,
      );
      expect(atGate).toBeGreaterThan(0);
      expect(route.path[atGate - 1]).toEqual([route.gate.x, route.gate.out]);
      expect(route.path.at(-1)).toEqual([500, 470]);
      const start = await page.evaluate(() => ({
        ...(window as any).__farm.dog,
      }));
      await expect
        .poll(() =>
          page.evaluate(() => {
            const d = (window as any).__farm.dog;
            return Math.hypot(d.x - 250, d.y - 780);
          }),
        )
        .toBeGreaterThan(20);
      expect(start.moving).toBe(true);
      // A crow comes for the ripe wheat: the dog barks and runs to it.
      await page.evaluate(() => {
        const f = (window as any).__farm;
        Object.assign(f.dog, {
          x: 1100,
          y: 850,
          path: [],
          wait: 0,
          chase: null,
          chasing: false,
        });
        f.decoys.push({ i: 0, t: 0.98 });
        f.look(700, 600);
      });
      await expect
        .poll(() => page.evaluate(() => (window as any).__farm.dog.chasing))
        .toBe(true);
      const chase = await page.evaluate(() =>
        (window as any).__farm.dog.path.at(-1),
      );
      expect(chase).toEqual([360 + 48, 380 + 62 + 4]);
      await page.waitForTimeout(300);
      await snap(
        page,
        info,
        `farm-dog-chase-${viewport.width}x${viewport.height}`,
      );
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

test("the farm rests behind Settings and wakes when it closes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await openLobby(page);
  await fakeFarm(page);
  await page.click('#hub-scenes [data-hub-scene="farm"]');
  const layer = page.locator(".farm-layer");
  await expect(layer).toHaveAttribute("data-frozen", "false");
  await page.evaluate(() => document.getElementById("settings")!.click());
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await expect(layer).toHaveAttribute("data-frozen", "true", {
    timeout: 15_000,
  });
  await page.click("#close-dialog");
  await expect(layer).toHaveAttribute("data-frozen", "false");
  // Still running: crops keep growing and taps still work.
  await page.click('#fm-dock [data-sheet="barn"]');
  await expect(page.locator("#fm-sheet")).toContainText("Barn storage");
  expect(errors).toEqual([]);
});

test("Low graphics draws the farm at 1x, and Auto switches a slow device to Low", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    // Low by hand.
    await page.addInitScript(() => localStorage.setItem("ea-graphics", "low"));
    const errors = await openLobby(page);
    await fakeFarm(page);
    await page.click('#hub-scenes [data-hub-scene="farm"]');
    const layer = page.locator(".farm-layer");
    await expect(layer).toHaveAttribute("data-graphics", "low");
    const size = () =>
      page.evaluate(() => {
        const cv = document.getElementById("fm-cv") as HTMLCanvasElement;
        return {
          px: cv.width,
          css: Math.round(cv.getBoundingClientRect().width),
        };
      });
    let s = await size();
    expect(s.px).toBe(s.css);
    expect(errors).toEqual([]);
    // Auto: this test machine draws far below 50 frames a second, so after
    // a few seconds of watching the farm switches to Low and remembers it.
    const auto = await context.newPage();
    await auto.addInitScript(() => {
      (window as any).__graphicsAuto = true;
      localStorage.removeItem("ea-graphics");
      localStorage.removeItem("ea-graphics-auto");
    });
    await openLobby(auto);
    await fakeFarm(auto);
    await auto.click('#hub-scenes [data-hub-scene="farm"]');
    const autoLayer = auto.locator(".farm-layer");
    await expect(autoLayer).toHaveAttribute("data-graphics", "high");
    await expect(autoLayer).toHaveAttribute("data-graphics", "low", {
      timeout: 30_000,
    });
    expect(
      await auto.evaluate(() => localStorage.getItem("ea-graphics-auto")),
    ).toBe("low");
    const a = await auto.evaluate(() => {
      const cv = document.getElementById("fm-cv") as HTMLCanvasElement;
      return {
        px: cv.width,
        css: Math.round(cv.getBoundingClientRect().width),
      };
    });
    expect(a.px).toBe(a.css);
  } finally {
    await context.close();
  }
});
