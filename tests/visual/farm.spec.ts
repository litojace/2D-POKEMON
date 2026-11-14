import { expect, test, type Page } from "@playwright/test";
import { openLobby, snap } from "./helpers";
import { fakeFarm } from "./farm-fake";

type Box = { name: string; x: number; y: number; w: number; h: number };
/** Open Shop, Friends, Decor or the Almanac from the right rail. */
async function openFromRail(page: Page, sheet: string) {
  await page.click(`#fm-rail [data-sheet="${sheet}"]`);
}
/** Tap a place on the farm (orders board, market, barn, balloon, well). */
async function tapPlace(page: Page, place: string) {
  const p = await page.evaluate((k) => {
    const f = (window as any).__farm,
      w = f.place(k);
    f.look(w.x, w.y);
    return f.worldClient(w.x, w.y);
  }, place);
  await page.waitForTimeout(150);
  await page.mouse.click(p.x, p.y);
}
/** Open a farm sheet the way a player does: a place on the farm or the rail. */
async function openSheet(page: Page, sheet: string) {
  if (["orders", "market", "barn", "balloon"].includes(sheet))
    await tapPlace(page, sheet);
  else await openFromRail(page, sheet);
}
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
      ["rail", "#fm-rail"],
      ["tools", "#fm-tools"],
      ["zoom", "#fm-zoom"],
    ]) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (
        r.width &&
        r.height &&
        cs.display !== "none" &&
        cs.visibility !== "hidden"
      )
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
      // The XP count is written in the bar.
      await expect(page.locator("#fm-badge .xpbar")).toContainText(
        /^20 \/ \d+ XP$/,
      );
      // No tool bar on your own farm: tools are bubbles by the plots.
      await expect(page.locator("#fm-tools")).toBeHidden();
      await page.waitForTimeout(600);
      await snap(
        page,
        info,
        `farm-${viewport.width}x${viewport.height}${viewport.inset ? "-island" : ""}`,
      );
      const all = await hudBoxes(page);
      // The player card (the account's level) is hidden on the farm, and the
      // farm badge takes its place: the same box, at the same spot.
      expect(all.map((b) => b.name)).not.toContain("profile");
      await expect(page.locator("#account-profile")).toHaveCSS(
        "visibility",
        "hidden",
      );
      const card = await page.locator("#account-profile").evaluate((e) => {
          const r = e.getBoundingClientRect();
          return { x: r.left, y: r.top, w: r.width, h: r.height };
        }),
        badge = all.find((b) => b.name === "badge")!;
      expect(badge.w, "badge width").toBeCloseTo(card.w, 1);
      expect(badge.h, "badge height").toBeCloseTo(card.h, 1);
      expect(badge.x, "badge left edge").toBeCloseTo(card.x, 1);
      expect(badge.y, "badge top").toBeCloseTo(card.y, 1);
      // The bar is thick enough for its text, and the text fits in it.
      const bar = await page.locator("#fm-badge .xpbar").evaluate((e) => {
        const r = e.getBoundingClientRect();
        return {
          h: r.height,
          w: r.width,
          sw: e.querySelector("span")!.scrollWidth,
        };
      });
      expect(bar.h, "bar height").toBeGreaterThanOrEqual(12);
      expect(bar.sw, "XP text fits the bar").toBeLessThanOrEqual(bar.w);
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
      // The right rail (with the zoom buttons under it on desktop) sits at
      // the bottom right, and its four buttons are all there.
      const corner = all
        .filter((b) => b.name === "rail" || b.name === "zoom")
        .reduce((a, b) => (b.y + b.h > a.y + a.h ? b : a));
      expect(
        viewport.height - bottom - (corner.y + corner.h),
        "corner bottom",
      ).toBeLessThan(24);
      await expect(page.locator("#fm-rail [data-sheet]")).toHaveCount(4);
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
  // Midday: the weather goes by its own name (after dark some look different).
  await page.evaluate(() => (window as any).__farm.tod(0.5));
  await expect(orb).toHaveAttribute(
    "aria-label",
    /Thunderstorm: Waters every plot · 25% Shocked/,
  );
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
  await openSheet(page, "book");
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

test("the weather follows the clock: a Sunny window after dark is a clear night, a Moonlit one by day a daytime moon", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await openLobby(page);
  await fakeFarm(page);
  await page.evaluate(() => {
    const f = (window as any).__fakeFarm;
    f.weather.now = "sun";
    f.weather.next = "rainbow";
  });
  await page.click('#hub-scenes [data-hub-scene="farm"]');
  await page.waitForFunction(() => (window as any).__farm?.F?.loaded);
  const orb = page.locator('#fm-chips [data-orb="weather"]'),
    pop = page.locator("#fm-orbpop");
  // The linear gradients drawn in the next frames, by where they start.
  const gradients = () =>
    page.evaluate(async () => {
      const proto = CanvasRenderingContext2D.prototype as any,
        orig = proto.createLinearGradient,
        at: Record<string, number> = {};
      proto.createLinearGradient = function (...a: number[]) {
        const k = `${Math.round(a[0])},${Math.round(a[1])}`;
        at[k] = (at[k] ?? 0) + 1;
        return orig.apply(this, a);
      };
      // A few whole frames: this machine draws in bursts, seconds apart.
      const t0 = performance.now(),
        total = () => Object.values(at).reduce((x, y) => x + y, 0);
      while (
        performance.now() - t0 < 1500 ||
        (total() < 30 && performance.now() - t0 < 20_000)
      )
        await new Promise((r) => setTimeout(r, 100));
      proto.createLinearGradient = orig;
      return at;
    });
  // The sun's shafts all fan out from the sun, above the view's top right
  // (other gradients start at its left edge).
  const shafts = (g: Record<string, number>) =>
    Object.entries(g)
      .filter(([k]) => {
        const [x, y] = k.split(",").map(Number);
        return x > 0 && y < 0;
      })
      .reduce((t, [, n]) => t + n, 0);
  // Midday: Sunny, with its shafts; a Rainbow next.
  await page.evaluate(() => (window as any).__farm.tod(0.5));
  await expect(orb).toHaveAttribute("aria-label", /^Sunny: Crops grow 10%/);
  expect(shafts(await gradients())).toBeGreaterThanOrEqual(7);
  // After dark (as the Plaza and the Bistro are): a clear night, same
  // effect, no sun shafts; the Rainbow ahead is a moonbow.
  await page.evaluate(() => (window as any).__farm.tod(0.95));
  await expect(orb).toHaveAttribute(
    "aria-label",
    /^Clear Night: Crops grow 10%/,
  );
  expect(shafts(await gradients())).toBe(0);
  await orb.click();
  await expect(pop).toContainText("Clear Night");
  await expect(pop.locator(".op-next")).toContainText("Moonbow");
  // The orb shows the same icon as its card (the night's star, not the sun).
  expect(await orb.locator(".wx-ic").innerHTML()).toBe(
    await pop.locator(".op-h > :first-child").evaluate((e) => e.outerHTML),
  );
  await snap(page, info, "farm-clear-night");
  await orb.click();
  // A Moonlit window by day is a daytime moon: no night painted over it.
  await page.evaluate(() => {
    const w = window as any;
    w.__fakeFarm.weather.now = "moon";
    w.__farm.F.weather.cur = "moon";
    w.__farm.tod(0.5);
  });
  await expect(orb).toHaveAttribute("aria-label", /^Daytime Moon: 25% Moonlit/);
  await page.evaluate(() => (window as any).__farm.tod(0.95));
  await expect(orb).toHaveAttribute(
    "aria-label",
    /^Moonlit Night: 25% Moonlit/,
  );
  expect(errors).toEqual([]);
});

test("the order board delivers what the barn holds", async ({ page }, info) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await openLobby(page);
  await fakeFarm(page);
  await page.click('#hub-scenes [data-hub-scene="farm"]');
  // One order can be filled from the barn (4 wheat). Tapping the board opens it.
  await page.waitForFunction(() => (window as any).__farm?.F?.loaded);
  await openSheet(page, "orders");
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
    // A Storm Melon seed from a gift: it grows at Lv 35, above this farm.
    await page.evaluate(() => {
      (window as any).__fakeFarm.seeds.melon = 2;
    });
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
      .toEqual([{ a: "harvest", plot: 0, tool: "sickle" }]);
    const empty = await plot(3);
    await page.mouse.click(empty.x, empty.y);
    await expect(page.locator("#fm-pop")).toBeVisible();
    // The melon is greyed out and can't be picked; it says when it grows.
    const melon = page.locator('#fm-pop [data-pseed="melon"]');
    await expect(melon).toBeDisabled();
    await expect(melon).toHaveClass(/locked/);
    await expect(melon).toContainText("Lv 35");
    await expect(page.locator('#fm-pop [data-pseed="carrot"]')).toBeEnabled();
    // No quick buy here: seeds come from the Shop.
    await expect(page.locator("#fm-pop [data-pbuy]")).toHaveCount(0);
    await snap(page, info, "farm-seed-picker-1280x800");
    // Picking a seed sows nothing yet: it shows the seed, ready to sow…
    await page.locator('#fm-pop [data-pseed="carrot"]').click();
    await expect(page.locator("#fm-pop")).toBeHidden();
    const bubble = page.locator("#fm-seed [data-seedbub]");
    await expect(bubble).toBeVisible();
    await expect(bubble).toContainText("×6");
    const sent = () =>
      page.evaluate(() =>
        (window as any).__farmRequests.flatMap((r: any) => r.actions),
      );
    expect(await sent()).not.toContainEqual(
      expect.objectContaining({ a: "plant" }),
    );
    // …and a tap on it sows the plot it was picked for.
    await bubble.click();
    await expect
      .poll(sent)
      .toContainEqual({ a: "plant", plot: 3, crop: "carrot" });
    await expect(page.locator("#fm-seed")).toBeHidden();
    // No seed tool on the bar any more: nothing sows a seed you didn't pick.
    await expect(page.locator('#fm-tools [data-tool="seed"]')).toHaveCount(0);
    // The market sheet opens from the menu.
    await openSheet(page, "market");
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
    await page.waitForTimeout(400);
    // Sunny (in the rain the crop is watered, and the can stays away).
    await page.evaluate(() => {
      const w = window as any;
      w.__fakeFarm.weather.now = "sun";
      w.__farm.F.weather.cur = "sun";
    });
    // A tap on the plot with a bug: its tools pop up (the net first, the
    // Copper Can you own, the shovel); the net catches it.
    const bug = await page.evaluate(() => (window as any).__farm.plotClient(2));
    await page.mouse.click(bug.x, bug.y);
    const acts = page.locator("#fm-acts");
    await expect(acts).toBeVisible();
    await expect(acts.locator("[data-act]").first()).toHaveAttribute(
      "data-act",
      "net",
    );
    await expect(acts.locator('[data-act="can"]')).toBeVisible();
    await expect(acts.locator('[data-act="shovel"]')).toBeVisible();
    await snap(page, info, "farm-tool-bubbles-1280x800");
    await acts.locator('[data-act="net"]').click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window as any).__farmRequests.flatMap((r: any) => r.actions),
        ),
      )
      .toEqual([{ a: "catch", plot: 2, tool: "net" }]);
    await openSheet(page, "shop");
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
    expect(await page.evaluate(() => (window as any).__farm.F.net)).toBe(2);
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
    await openSheet(page, "friends");
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
    // Home again: no tool bar (the friend's tools were for the visit).
    await expect(page.locator("#fm-tools")).toBeHidden();
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("decorating: buy a decoration, place it, and put one in storage to place again free", async ({
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
    await openSheet(page, "decor");
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
    // Put the Street Lamp (spot 0, at 80, 830) away: it goes to storage and
    // places again for free, even below its level.
    const tapSpot = async (x: number, y: number) => {
      const p = await page.evaluate(
        ([x, y]) => {
          const f = (window as any).__farm;
          f.look(x + 200, y - 100);
          return f.worldClient(x, y);
        },
        [x, y],
      );
      await page.waitForTimeout(150);
      await page.mouse.click(p.x, p.y);
    };
    // The Storage tab: empty, with the Remove tool.
    await sheet.locator('[data-tab="storage"]').click();
    await expect(sheet).toContainText("Storage is empty");
    await expect(sheet.locator('[data-tab="storage"]')).toHaveText("Storage");
    await sheet.locator('[data-deco="__remove"]').click();
    await expect(sheet).toContainText("It goes to storage");
    await tapSpot(80, 830);
    await expect(page.locator("#fm-log")).toContainText(
      "Put Street Lamp in storage",
    );
    await expect(sheet.locator('[data-tab="storage"]')).toHaveText(
      "Storage (1)",
    );
    const lamp = sheet.locator(".item", { hasText: "Street Lamp" });
    await expect(lamp).toContainText("×1");
    await expect(lamp.locator("button")).toHaveText("Place");
    // Placing from storage: the spots glow and carry a pin.
    await lamp.locator("button").click();
    await expect(sheet).toContainText("Placing Street Lamp");
    await page.evaluate(() => (window as any).__farm.look(400, 760));
    await page.waitForTimeout(400);
    await snap(page, info, "farm-decor-storage");
    await tapSpot(530, 870);
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window as any).__farmRequests.flatMap((r: any) => r.actions),
        ),
      )
      .toEqual([
        { a: "decor", slot: 1, item: "rock" },
        { a: "decor-remove", slot: 0 },
        { a: "decor", slot: 2, item: "lamp" },
      ]);
    // The last stored copy is placed: placing stops (nothing is bought).
    await expect(sheet).toContainText("Storage is empty");
    await expect(sheet).not.toContainText("Placing");
    await expect(sheet.locator('[data-tab="storage"]')).toHaveText("Storage");
    await sheet.locator('[data-tab="buy"]').click();
    await expect(
      sheet.locator(".item", { hasText: "Street Lamp" }),
    ).toContainText("unlocks at Lv 12");
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
      await expect(item).toContainText("2 Storm Milk every 2h");
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
      // Grazing: the server set the first milk 20 m out. The toast rounds
      // to the second, so a tap within half a second of opening still reads
      // 20m (seen on CI); later, 19m.
      await tapPasture();
      await expect(page.locator("#toast")).toContainText(
        /The cow is grazing\. Milk in (19|20)m/,
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
      // Sold at the market like a crop, through its own action.
      await openSheet(page, "market");
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

test('the balloon\'s tag gets a "!" when the barn can fill one of its crates, as the orders do', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await openLobby(page);
  await fakeFarm(page);
  await page.evaluate(() => {
    const crate = (crop: string, qty: number, state = "open") => ({
      crop,
      qty,
      state,
      by: null,
    });
    // 4 wheat in the barn: the 3-wheat crate can be filled.
    (window as any).__balloon = {
      crates: [
        crate("wheat", 3),
        crate("carrot", 6),
        crate("wheat", 2, "done"),
        crate("carrot", 4, "done"),
        crate("wheat", 1, "done"),
        crate("melon", 2, "asked"),
      ],
      arrivesAt: null,
      launches: 0,
      leaves: 140,
      xp: 90,
      helperStars: 0,
      helperLeavesToday: 0,
      helperCap: 600,
      helpers: {},
    };
  });
  await page.click('#hub-scenes [data-hub-scene="farm"]');
  await page.waitForFunction(() => (window as any).__farm?.hasBalloon?.());
  await page.evaluate(() => (window as any).__farm.look(1080, 300));
  // The text drawn in a whole frame: is there a "!" on the balloon tag's
  // corner (just right of its text, at its height)?
  const balloonBadge = () =>
    page.evaluate(async () => {
      const proto = CanvasRenderingContext2D.prototype as any,
        orig = proto.fillText,
        frames: { t: string; x: number; y: number }[][] = [[]];
      proto.fillText = function (t: string, x: number, y: number, ...a: any[]) {
        const m = this.getTransform();
        frames.at(-1)!.push({
          t: String(t),
          x: m.a * x + m.c * y + m.e,
          y: m.b * x + m.d * y + m.f,
        });
        return orig.call(this, t, x, y, ...a);
      };
      // A few frames (this machine draws in bursts).
      const t0 = performance.now();
      await new Promise<void>((done) => {
        const tick = () => {
          frames.push([]);
          const whole = frames.filter((f) =>
            f.some((e) => e.t.startsWith("SUPPLY BALLOON")),
          );
          if (whole.length >= 2 || performance.now() - t0 > 20_000)
            return done();
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      proto.fillText = orig;
      const f = frames.find((f) =>
        f.some((e) => e.t.startsWith("SUPPLY BALLOON")),
      );
      if (!f) return null;
      const tag = f.find((e) => e.t.startsWith("SUPPLY BALLOON"))!;
      return f.some(
        (e) =>
          e.t === "!" &&
          e.x > tag.x &&
          e.x - tag.x < 400 &&
          Math.abs(e.y - tag.y) < 80,
      );
    });
  await expect.poll(balloonBadge, { timeout: 60_000 }).toBe(true);
  await snap(page, info, "farm-balloon-fillable");
  // Nothing in the barn fills a crate (the wheat sold): no badge.
  await page.evaluate(() => {
    (window as any).__farm.F.barn = {};
  });
  await expect.poll(balloonBadge, { timeout: 60_000 }).toBe(false);
  expect(errors).toEqual([]);
});

test("the farm opens ready on every return: the same scenery, animals where they were, the balloon up", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await openLobby(page);
  await fakeFarm(page);
  // The first visit loads the farm (a ripe Breeze Wheat stands on plot 0).
  await page.click('#hub-scenes [data-hub-scene="farm"]');
  await page.waitForFunction(() => (window as any).__farm?.F?.loaded);
  const first = await page.evaluate(() => (window as any).__farm.scenery());
  expect(first.length).toBeGreaterThan(40);
  // A Supply Balloon is up, and the hens stand in spots of their own.
  await page.evaluate(() => {
    const w = window as any;
    w.__balloon = {
      crates: [{ crop: "wheat", qty: 3, state: "open", by: null }],
      arrivesAt: null,
      launches: 0,
      leaves: 140,
      xp: 90,
      helperStars: 0,
      helperLeavesToday: 0,
      helperCap: 600,
      helpers: {},
    };
  });
  await page.click('#hub-scenes [data-hub-scene="lobby"]');
  await page.click('#hub-scenes [data-hub-scene="farm"]');
  await expect
    .poll(() => page.evaluate(() => (window as any).__farm.hasBalloon()))
    .toBe(true);
  const spots = await page.evaluate(() =>
    (window as any).__farm.hens.map((h: any, k: number) => {
      Object.assign(h, { x: 340 + k * 50, y: 900, tx: null, ty: null });
      Object.assign(h, { st: "idle", wait: 99 });
      return [h.x, h.y];
    }),
  );
  // Away in the Lobby and the Plaza: nothing loads the farm again.
  await page.click('#hub-scenes [data-hub-scene="lobby"]');
  const gets = await page.evaluate(() => (window as any).__farmGets);
  await page.click('#hub-scenes [data-hub-scene="plaza"]');
  await page.click('#hub-scenes [data-hub-scene="lobby"]');
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as any).__farmGets)).toBe(gets);
  // Back with a slow server: the farm is ready on its first frame, the
  // trees and bushes stand where they stood, the hens where they were, and
  // the balloon is there at once.
  await page.evaluate(() => {
    (window as any).__farmDelay = 4000;
    (window as any).__balloonDelay = 4000;
  });
  for (let visit = 0; visit < 2; visit++) {
    await page.click('#hub-scenes [data-hub-scene="farm"]');
    const now = await page.evaluate(() => {
      const f = (window as any).__farm;
      return {
        loaded: !!f.F.loaded,
        crop: f.F.plots[0]?.crop ?? null,
        scenery: f.scenery(),
        balloon: f.hasBalloon(),
        hens: f.hens.map((h: any) => [h.x, h.y]),
      };
    });
    expect(now.loaded).toBe(true);
    expect(now.crop).toBe("wheat");
    expect(now.scenery).toEqual(first);
    expect(now.balloon).toBe(true);
    now.hens.forEach(([x, y]: number[], k: number) => {
      expect(Math.hypot(x - spots[k][0], y - spots[k][1])).toBeLessThan(25);
    });
    // Keep them still for the next visit.
    await page.evaluate(() =>
      (window as any).__farm.hens.forEach((h: any) =>
        Object.assign(h, { tx: null, ty: null, st: "idle", wait: 99 }),
      ),
    );
    await page.click('#hub-scenes [data-hub-scene="lobby"]');
  }
  await page.evaluate(() => {
    (window as any).__farmDelay = 0;
    (window as any).__balloonDelay = 0;
  });
  expect(errors).toEqual([]);
});

test("switching hub tabs keeps the same farm, paused and gone while hidden", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await openLobby(page);
  await fakeFarm(page);
  await page.click('#hub-scenes [data-hub-scene="farm"]');
  await page.waitForFunction(() => (window as any).__farm?.F?.loaded);
  // Mark this farm, then go to the Lobby.
  await page.evaluate(() => ((window as any).__farm.F.mark = "same farm"));
  const layer = page.locator(".farm-layer");
  await page.click('#hub-scenes [data-hub-scene="lobby"]');
  // Hidden and paused: not drawn, and friends see you left.
  await expect(layer).toBeHidden();
  await expect
    .poll(() => page.evaluate(() => (window as any).__gones ?? 0))
    .toBe(1);
  // Back: the very same farm, shown at once and drawing again.
  await page.click('#hub-scenes [data-hub-scene="farm"]');
  await expect(layer).toBeVisible();
  expect(await page.evaluate(() => (window as any).__farm.F.mark)).toBe(
    "same farm",
  );
  await expect(page.locator("body")).toHaveClass(/hub-farm/);
  await openSheet(page, "barn");
  await expect(page.locator("#fm-sheet")).toContainText("Barn storage");
  expect(errors).toEqual([]);
});

test("the farm is kept in this browser: after a reload it draws at once", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openLobby(page);
  await fakeFarm(page);
  await page.click('#hub-scenes [data-hub-scene="farm"]');
  await page.waitForFunction(() => (window as any).__farm?.F?.loaded);
  // Kept per player, a moment after the farm loads.
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(localStorage).filter((k) => k.startsWith("arena-farm:")),
      ),
    )
    .toHaveLength(1);
  // A new visit: the page reloads (the farm closed, its memory gone).
  await page.click('#hub-scenes [data-hub-scene="lobby"]');
  await openLobby(page);
  await fakeFarm(page);
  await page.evaluate(() => ((window as any).__farmDelay = 4000));
  await page.click('#hub-scenes [data-hub-scene="farm"]');
  // The Farm's code loads when first opened (hub-worlds.ts); its kept state
  // is drawn as soon as the scene exists, before the server (asked when it
  // opens, answering 4 s later) has said anything.
  await page.waitForFunction(() => !!(window as any).__farm);
  const now = await page.evaluate(() => {
    const f = (window as any).__farm;
    return { loaded: !!f.F.loaded, crop: f.F.plots[0]?.crop ?? null };
  });
  expect(now).toEqual({ loaded: true, crop: "wheat" });
  await page.evaluate(() => ((window as any).__farmDelay = 0));
  // Logging out forgets it: the next player on this browser starts clean.
  await page.evaluate(() => document.getElementById("account-logout")!.click());
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(localStorage).filter((k) => k.startsWith("arena-farm:")),
      ),
    )
    .toEqual([]);
  await expect(page.locator(".farm-layer")).toHaveCount(0);
});

test("on a phone, the Market's Sell and All buttons line up in columns", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    const errors = await openLobby(page);
    await fakeFarm(page);
    // Totals of very different lengths: 2, 30-odd, a few hundred.
    await page.evaluate(() => {
      (window as any).__fakeFarm.barn = [
        { crop: "wheat", mutation: "", qty: 1 },
        { crop: "carrot", mutation: "", qty: 4 },
        { crop: "carrot", mutation: "frost", qty: 2 },
        { crop: "wheat", mutation: "gold", qty: 30 },
      ];
    });
    await page.click('#hub-scenes [data-hub-scene="farm"]');
    await page.waitForFunction(() => (window as any).__farm?.F?.loaded);
    await tapPlace(page, "market");
    const sheet = page.locator("#fm-sheet");
    await expect(sheet.locator(".b-sellall")).toHaveCount(4);
    await sheet.evaluate((el) =>
      Promise.all(el.getAnimations().map((a) => a.finished)),
    );
    const cols = await sheet.evaluate((el) =>
      [".b-sell1", ".b-sellall"].map((sel) =>
        [...el.querySelectorAll(sel)].map((b) => {
          const r = b.getBoundingClientRect();
          return [Math.round(r.left), Math.round(r.width)];
        }),
      ),
    );
    for (const col of cols) {
      expect(new Set(col.map(([l]) => l)).size, "one left edge").toBe(1);
      expect(new Set(col.map(([, w]) => w)).size, "one width").toBe(1);
    }
    await snap(page, info, "farm-market-sell-844x390");
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("on a phone, a long press on an empty plot opens the seed tray and it stays; a tap under the seed bubble opens it again", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    const errors = await openLobby(page);
    await fakeFarm(page);
    await page.click('#hub-scenes [data-hub-scene="farm"]');
    await page.waitForFunction(() => (window as any).__farm?.F?.loaded);
    await page.waitForTimeout(400);
    const cdp = await context.newCDPSession(page);
    // A real finger, held for ms before it lifts.
    const press = async (p: { x: number; y: number }, ms: number) => {
      const at = [{ x: Math.round(p.x), y: Math.round(p.y) }];
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: at,
      });
      await page.waitForTimeout(ms);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    };
    const plant = () =>
      page.evaluate(() =>
        (window as any).__farmRequests
          .flatMap((r: any) => r.actions ?? [])
          .filter((x: any) => x.a === "plant"),
      );
    const p3 = await page.evaluate(() => (window as any).__farm.plotClient(3));
    // Held past the hold time, the tray opens under the finger: lifting it
    // picks nothing and the tray stays open.
    await press(p3, 600);
    const tray = page.locator("#fm-pop");
    await expect(tray).toBeVisible();
    await page.waitForTimeout(600);
    await expect(tray).toBeVisible();
    await expect(page.locator("#fm-seed")).toBeHidden();
    // A press on a seed picks it.
    await press(
      await page
        .locator('#fm-pop [data-pseed="wheat"]')
        .boundingBox()
        .then((b) => ({ x: b!.x + b!.width / 2, y: b!.y + b!.height / 2 })),
      80,
    );
    await expect(tray).toBeHidden();
    await expect(page.locator("#fm-seed [data-seedbub]")).toBeVisible();
    // The bubble floats over the field: a tap on the plot under its box
    // (not on the bubble itself) reaches the field and opens the tray.
    await press(p3, 80);
    await expect(tray).toBeVisible();
    await expect(page.locator("#fm-seed")).toBeHidden();
    expect(await plant()).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("on a phone, pick a seed and drag it to sow, and drag the sickle to harvest", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    const errors = await openLobby(page);
    await fakeFarm(page);
    // Ripe wheat on plots 0, 3 and 4 (1 and 2 are still growing).
    await page.evaluate(() => {
      const f = (window as any).__fakeFarm,
        past = new Date(Date.now() - 60_000).toISOString();
      for (const i of [3, 4])
        Object.assign(f.plots[i], { crop: "wheat", progress: 1, ripeAt: past });
      // No Sickle bought: the harvest bubble cuts one plot at a time.
      f.tools.sickle = false;
    });
    await page.click('#hub-scenes [data-hub-scene="farm"]');
    await page.waitForFunction(() => (window as any).__farm?.F?.loaded);
    await page.waitForTimeout(400);
    const plot = (i: number) =>
      page.evaluate((i) => (window as any).__farm.plotClient(i), i);
    const center = async (sel: string) => {
      const b = (await page.locator(sel).boundingBox())!;
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    };
    // A real finger: touch down, slide through the points, lift.
    const cdp = await context.newCDPSession(page);
    const swipe = async (pts: { x: number; y: number }[]) => {
      const at = (p: { x: number; y: number }) => [
        { x: Math.round(p.x), y: Math.round(p.y) },
      ];
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: at(pts[0]),
      });
      for (let k = 1; k < pts.length; k++)
        for (let s = 1; s <= 8; s++) {
          const a = pts[k - 1],
            b = pts[k];
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: at({
              x: a.x + ((b.x - a.x) * s) / 8,
              y: a.y + ((b.y - a.y) * s) / 8,
            }),
          });
        }
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    };
    const sent = (a: string) =>
      page.evaluate(
        (a) =>
          (window as any).__farmRequests
            .flatMap((r: any) => r.actions ?? [])
            .filter((x: any) => x.a === a)
            .map((x: any) => x.plot)
            .sort((x: number, y: number) => x - y),
        a,
      );
    // Sowing: tap an empty plot, pick Breeze Wheat, then drag the seed
    // across the row.
    const p11 = await plot(11);
    await page.touchscreen.tap(p11.x, p11.y);
    await page.locator('#fm-pop [data-pseed="wheat"]').tap();
    await expect(page.locator("#fm-seed [data-seedbub]")).toBeVisible();
    await snap(page, info, "farm-seed-bubble-844x390");
    await swipe([
      await center("#fm-seed [data-seedbub]"),
      await plot(12),
      await plot(14),
    ]);
    await expect.poll(() => sent("plant")).toEqual([11, 12, 13, 14]);
    await expect(page.locator("#fm-ghost")).toBeHidden();
    // Watering works the same: tap a growing crop, drag the can across.
    // (Sunny now: rain would water them all already.)
    await page.evaluate(() => {
      const w = window as any;
      w.__fakeFarm.weather.now = "sun";
      w.__farm.F.weather.cur = "sun";
    });
    const p12 = await plot(12);
    await page.touchscreen.tap(p12.x, p12.y);
    const can = page.locator('#fm-acts [data-act="can"]');
    await expect(can).toBeVisible();
    await swipe([
      await center('#fm-acts [data-act="can"]'),
      await plot(11),
      await plot(14),
    ]);
    // The Copper Can waters three in a row: together the waterings cover
    // plots 11–14 (the fake server forgets watering, so which plots are sent
    // varies; the bubble floats over the row above, so plot 1 gets some too).
    const covered = async () =>
      [
        ...new Set(
          (await sent("water")).flatMap((p: number) =>
            [p - 1, p, p + 1].filter(
              (q) => Math.floor(q / 10) === Math.floor(p / 10),
            ),
          ),
        ),
      ].sort((a, b) => a - b);
    await expect
      .poll(covered)
      .toEqual(expect.arrayContaining([11, 12, 13, 14]));
    // Harvesting: a tap on a ripe crop shows the sickle (nothing is cut yet)…
    const p3 = await plot(3);
    await page.touchscreen.tap(p3.x, p3.y);
    const sickle = page.locator("#fm-sickle [data-sickle]");
    await expect(sickle).toBeVisible();
    await snap(page, info, "farm-sickle-844x390");
    expect(await sent("harvest")).toEqual([]);
    // …drag it across the row: every ripe crop it passes is harvested, the
    // growing ones stay.
    await swipe([
      await center("#fm-sickle [data-sickle]"),
      await plot(4),
      await plot(0),
    ]);
    await expect.poll(() => sent("harvest")).toEqual([0, 3, 4]);
    await expect(page.locator("#fm-sickle")).toBeHidden();
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

for (const reduced of [false, true]) {
  test(`a storm brings lightning${reduced ? ", but not with reduced motion" : ""}`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      reducedMotion: reduced ? "reduce" : "no-preference",
    });
    try {
      const page = await context.newPage();
      const errors = await openLobby(page);
      await fakeFarm(page);
      await page.click('#hub-scenes [data-hub-scene="farm"]');
      await page.waitForFunction(() => (window as any).__farm?.F?.loaded);
      // The fake farm is in a storm; strike now.
      await page.evaluate(() => {
        const f = (window as any).__farm;
        f.F.weather.cur = "storm";
        f.wx.next = 0;
      });
      const bolt = () =>
        page.evaluate(() => {
          const wx = (window as any).__farm.wx;
          return wx.bolt ? wx.bolt.main.length : 0;
        });
      if (reduced) {
        // Two seconds of the farm running in the storm: no bolt, no flash.
        const t0 = await page.evaluate(() => (window as any).__farm.time());
        await expect
          .poll(() => page.evaluate(() => (window as any).__farm.time()), {
            timeout: 30_000,
          })
          .toBeGreaterThan(t0 + 2);
        expect(await bolt()).toBe(0);
      } else {
        // A bolt from the clouds down, several segments long.
        await expect.poll(bolt, { timeout: 30_000 }).toBeGreaterThan(4);
        await snap(page, info, "farm-storm-1280x800");
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

test("rain and storms water the growing crops: the soil isn't dry while it pours", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await openLobby(page);
  await fakeFarm(page);
  await page.click('#hub-scenes [data-hub-scene="farm"]');
  await page.waitForFunction(() => (window as any).__farm?.F?.loaded);
  // Plot 2 grows wheat that nobody watered by hand.
  const hover = async () => {
    const p = await page.evaluate(() => (window as any).__farm.plotClient(2));
    await page.mouse.move(p.x + 40, p.y + 40);
    await page.mouse.move(p.x, p.y);
    return page.locator("#fm-tip");
  };
  for (const [w, text] of [
    ["storm", "watered by the rain"],
    ["rain", "watered by the rain"],
    ["sun", "dry"],
  ]) {
    await page.evaluate((w) => ((window as any).__farm.F.weather.cur = w), w);
    const tip = await hover();
    await expect(tip).toBeVisible();
    await expect(tip.locator(".row", { hasText: "Water" })).toHaveText(
      new RegExp(`Water\\s*${text}$`),
    );
  }
  expect(errors).toEqual([]);
});

test("on a phone, carrying a seed to the edge scrolls the farm and keeps sowing", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    const errors = await openLobby(page);
    await fakeFarm(page);
    // The whole second row is yours and empty; plenty of wheat seeds.
    await page.evaluate(() => {
      const f = (window as any).__fakeFarm;
      for (let i = 10; i < 20; i++)
        Object.assign(f.plots[i], { owned: true, crop: null, progress: 0 });
      f.seeds.wheat = 20;
    });
    await page.click('#hub-scenes [data-hub-scene="farm"]');
    await page.waitForFunction(() => (window as any).__farm?.F?.loaded);
    // Zoomed in on the left of the row: its right end is off the screen.
    await page.evaluate(() => {
      const f = (window as any).__farm;
      f.zoom(2.2);
      const w = f.plotWorld(12);
      f.look(w.x, w.y);
    });
    await page.waitForTimeout(400);
    const plot = (i: number) =>
      page.evaluate((i) => (window as any).__farm.plotClient(i), i);
    expect((await plot(18)).x).toBeGreaterThan(844);
    const cdp = await context.newCDPSession(page);
    const touch = (type: string, p?: { x: number; y: number }) =>
      cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: p ? [{ x: Math.round(p.x), y: Math.round(p.y) }] : [],
      });
    const p11 = await plot(11);
    await page.touchscreen.tap(p11.x, p11.y);
    await page.locator('#fm-pop [data-pseed="wheat"]').tap();
    const b = (await page.locator("#fm-seed [data-seedbub]").boundingBox())!;
    // Press the seed, drag it along the row to the right edge, and hold.
    const p12 = await plot(12);
    await touch("touchStart", { x: b.x + b.width / 2, y: b.y + b.height / 2 });
    for (let s = 1; s <= 8; s++)
      await touch("touchMove", {
        x: b.x + b.width / 2 + ((p12.x - b.x - b.width / 2) * s) / 8,
        y: b.y + b.height / 2 + ((p12.y - b.y - b.height / 2) * s) / 8,
      });
    for (let s = 1; s <= 8; s++)
      await touch("touchMove", {
        x: p12.x + ((836 - p12.x) * s) / 8,
        y: p12.y,
      });
    const edge = { x: 836, y: p12.y };
    for (let k = 0; k < 30; k++) {
      await touch("touchMove", { x: edge.x, y: edge.y + (k % 2) });
      await page.waitForTimeout(100);
    }
    await touch("touchEnd");
    // The farm scrolled, and the far end of the row was sown as it came.
    const planted = await page.evaluate(() =>
      (window as any).__farmRequests
        .flatMap((r: any) => r.actions ?? [])
        .filter((x: any) => x.a === "plant")
        .map((x: any) => x.plot),
    );
    expect(planted).toContain(18);
    expect((await plot(12)).x).toBeLessThan(p12.x - 100);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

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
  await openSheet(page, "barn");
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

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 844, height: 390 },
  { width: 852, height: 393, inset: 59 },
]) {
  test(`the right rail and the places on the farm open every sheet at ${viewport.width}x${viewport.height}${viewport.inset ? " with a Dynamic Island" : ""}`, async ({
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
          for (const k of ["left", "right"])
            document.documentElement.style.setProperty(
              `--safe-${k}`,
              `${inset}px`,
            );
        }, viewport.inset);
      await page.click('#hub-scenes [data-hub-scene="farm"]');
      await expect(page.locator("#fm-badge")).toContainText("tester's Farm");
      await page.waitForFunction(() => (window as any).__farm?.F?.loaded);
      // No Menu: Shop, Friends, Decor and the Almanac are always on the rail.
      await expect(page.locator("#fm-menu-btn")).toHaveCount(0);
      const rail = page.locator("#fm-rail");
      await expect(rail).toBeVisible();
      await expect(rail.locator("button")).toHaveText([
        "Shop",
        "Friends",
        "Decor",
        "Almanac",
      ]);
      await page.waitForTimeout(300);
      await snap(
        page,
        info,
        `farm-rail-${viewport.width}x${viewport.height}${viewport.inset ? "-island" : ""}`,
      );
      const box = (sel: string) =>
        page.evaluate((s) => {
          const r = document.querySelector(s)!.getBoundingClientRect();
          return { l: r.left, t: r.top, r: r.right, b: r.bottom };
        }, sel);
      const [col, tools, chips] = await Promise.all(
        ["#fm-rail", "#fm-tools", "#fm-chips"].map(box),
      );
      // On the right edge, below the status orbs, right of the tool bar and
      // inside the safe area.
      expect(col.t).toBeGreaterThan(chips.b);
      expect(tools.r).toBeLessThan(col.l);
      expect(col.r).toBeLessThanOrEqual(viewport.width - (viewport.inset ?? 0));
      // One column of same-size buttons.
      const tiles = await rail.locator("button").evaluateAll((els) =>
        els.map((e) => {
          const r = e.getBoundingClientRect();
          return [
            Math.round(r.left),
            Math.round(r.top),
            Math.round(r.width),
            Math.round(r.height),
          ];
        }),
      );
      expect(new Set(tiles.map((t) => t[0])).size).toBe(1);
      expect(new Set(tiles.map((t) => t[1])).size).toBe(4);
      expect(new Set(tiles.map((t) => `${t[2]}x${t[3]}`)).size).toBe(1);
      // A rail button opens its sheet beside the rail, and again closes it.
      await rail.locator('[data-sheet="shop"]').click();
      const sheet = page.locator("#fm-sheet");
      await expect(sheet).toBeVisible();
      await expect(rail.locator('[data-sheet="shop"]')).toHaveAttribute(
        "aria-expanded",
        "true",
      );
      // The sheet slides in from 30px to the right: measure where it stops.
      await sheet.evaluate((el) =>
        Promise.all(el.getAnimations().map((a) => a.finished)),
      );
      const sh = await box("#fm-sheet");
      expect(sh.r).toBeLessThanOrEqual(col.l);
      await rail.locator('[data-sheet="shop"]').click();
      await expect(sheet).toBeHidden();
      // The barn on the farm opens the barn.
      await tapPlace(page, "barn");
      await expect(sheet).toContainText("Barn storage");
      await page.click("#fm-sheet [data-close]");
      // The wishing well makes today's wish.
      await tapPlace(page, "well");
      await expect
        .poll(() =>
          page.evaluate(() =>
            (window as any).__farmRequests.some((r: any) => r.wish),
          ),
        )
        .toBe(true);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

// Giant crops (migration 050). A ripe square of Earth Carrots at plot 10
// (rows 1–3, columns 0–2) that grew giant, with a Gold one among them and a
// bug left on plot 30; ripe wheat stands above it (plots 0 and 1) and below
// it (plot 41).
const GIANT_SQUARE = [10, 11, 12, 20, 21, 22, 30, 31, 32];
async function giantFarm(page: Page) {
  await page.evaluate((sq) => {
    const f = (window as any).__fakeFarm,
      at = (s: number) => new Date(Date.now() + s * 1000).toISOString();
    for (const j of [...sq, 41]) f.plots[j].owned = true;
    for (const j of sq)
      Object.assign(f.plots[j], {
        crop: "carrot",
        progress: 1,
        ripeAt: at(-120),
        wet: false,
        mutation: null,
        pests: 0,
      });
    f.plots[21].mutation = "gold";
    f.plots[30].pests = 1;
    Object.assign(f.plots[1], {
      crop: "wheat",
      progress: 1,
      ripeAt: at(-60),
      wet: false,
      pests: 0,
    });
    Object.assign(f.plots[41], {
      crop: "wheat",
      progress: 1,
      ripeAt: at(-60),
    });
    f.giants = [{ i: 10, crop: "carrot", plots: sq, formedAt: at(-120) }];
  }, GIANT_SQUARE);
}
/**
 * The crop pictures of one whole frame, in the order they were drawn: which
 * is the giant, and where each is on the page (from the canvas's own draw
 * calls, so this is what was painted).
 */
async function cropDraws(page: Page) {
  return page.evaluate(async () => {
    const proto = CanvasRenderingContext2D.prototype as any,
      orig = proto.drawImage,
      cv = document.querySelector(".farm-layer #fm-cv") as HTMLCanvasElement,
      frames: any[][] = [];
    proto.drawImage = function (img: any, ...a: number[]) {
      // Each frame starts with the baked ground (the whole world's size).
      if (
        img instanceof HTMLCanvasElement &&
        img.width === 2480 &&
        img.height === 1460
      )
        frames.push([]);
      else if (
        frames.length &&
        a.length === 4 &&
        img instanceof HTMLImageElement &&
        (img.naturalWidth === 660 || img.naturalWidth === 240)
      ) {
        const m = this.getTransform(),
          r = cv.getBoundingClientRect(),
          k = r.width / cv.width;
        frames.at(-1)!.push({
          giant: img.naturalWidth === 660,
          w: m.a * a[2] * k,
          x: r.left + (m.e + m.a * (a[0] + a[2] / 2)) * k,
          ground: r.top + m.f * k,
        });
      }
      return orig.call(this, img, ...a);
    };
    // At least 2.5s, and until a whole frame with crops in it came: this
    // machine draws on the CPU, a frame a second or slower while it rains,
    // with longer gaps, so a fixed wait can catch none.
    const whole = () => frames.slice(1, -1).find((f) => f.length);
    const t0 = performance.now();
    while (
      performance.now() - t0 < 2500 ||
      (!whole() && performance.now() - t0 < 20_000)
    )
      await new Promise((r) => setTimeout(r, 100));
    proto.drawImage = orig;
    // A whole frame: not the first or last (they may be cut).
    return whole() ?? [];
  });
}
const plotAt = (page: Page, i: number) =>
  page.evaluate((i) => (window as any).__farm.plotClient(i), i);

for (const viewport of [
  { width: 1440, height: 900, inset: null },
  { width: 844, height: 390, inset: null },
  {
    width: 852,
    height: 393,
    inset: { left: 59, right: 59, bottom: 21, top: 0 },
  },
]) {
  const tag = `${viewport.width}x${viewport.height}${viewport.inset ? "-island" : ""}`;
  test(`a giant crop stands across its square, depth-sorted, and a tap harvests it whole at ${tag}`, async ({
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
      await giantFarm(page);
      if (viewport.inset)
        await page.evaluate((inset) => {
          for (const [key, value] of Object.entries(inset))
            document.documentElement.style.setProperty(
              `--safe-${key}`,
              `${value}px`,
            );
        }, viewport.inset);
      await page.click('#hub-scenes [data-hub-scene="farm"]');
      await expect(page.locator("#fm-badge")).toContainText("tester's Farm");
      // First time this device sees it: a toast says so.
      await expect(page.locator("#toast")).toContainText(
        "A giant Earth Carrot grew! Tap it to harvest",
      );
      await page.waitForTimeout(900); // its pop-up animation
      await snap(page, info, `farm-giant-${tag}`);

      // One picture for the square, none for its 9 crops: the crops beside
      // it are plots 0, 1, 2 and 41 (plot 4's Gold carrot is a tinted copy).
      const draws = await cropDraws(page);
      expect(draws.filter((d) => d.giant)).toHaveLength(1);
      expect(draws.filter((d) => !d.giant)).toHaveLength(4);
      // Depth-sorted with them: each picture after those standing behind it,
      // so the wheat above comes before the giant and the wheat below after.
      const grounds = draws.map((d) => d.ground);
      expect(grounds).toEqual([...grounds].sort((a, b) => a - b));
      const at = draws.findIndex((d) => d.giant);
      expect(at).toBeGreaterThan(0);
      expect(at).toBeLessThan(draws.length - 1);
      // Across the square's 3 columns, standing on its bottom row.
      const [p10, p11, p20, p21, p31] = await Promise.all(
        [10, 11, 20, 21, 31].map((i) => plotAt(page, i)),
      );
      const colPitch = p11.x - p10.x,
        rowPitch = p20.y - p10.y,
        g = draws[at];
      expect(g.w / ((colPitch * 330) / 106)).toBeGreaterThan(0.97);
      expect(g.w / ((colPitch * 330) / 106)).toBeLessThan(1.03);
      expect(Math.abs(g.x - p21.x)).toBeLessThan(2);
      // The bottom row's ground: 19.6 world px under its plots' middle.
      expect(
        Math.abs(g.ground - (p31.y + (19.6 * rowPitch) / 72)),
      ).toBeLessThan(3);

      // The HUD still fits: inside the safe area, nothing overlapping.
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

      const tap = async (pt: { x: number; y: number }) =>
        phone ? page.touchscreen.tap(pt.x, pt.y) : page.mouse.click(pt.x, pt.y);
      const sent = () =>
        page.evaluate(() =>
          (window as any).__farmRequests.flatMap((r: any) => r.actions ?? []),
        );
      if (!phone) {
        // Desktop: hovering it shows what it gives, inside the window.
        await page.mouse.move(p21.x, p21.y);
        const tip = page.locator("#fm-tip");
        await expect(tip).toBeVisible();
        await expect(tip).toContainText("Giant Earth Carrot");
        await expect(tip).toContainText("36 crops");
        await expect(tip).toContainText("+72");
        await expect(tip).toContainText("1 Gold");
        const tb = (await tip.boundingBox())!;
        expect(tb.x).toBeGreaterThanOrEqual(0);
        expect(tb.y).toBeGreaterThanOrEqual(0);
        expect(tb.x + tb.width).toBeLessThanOrEqual(viewport.width);
        expect(tb.y + tb.height).toBeLessThanOrEqual(viewport.height);
        await snap(page, info, `farm-giant-tip-${tag}`);
      }
      // A tap on the plot with the bug catches the bug first…
      await tap(await plotAt(page, 30));
      await expect.poll(sent).toEqual([{ a: "catch", plot: 30 }]);
      // …and a tap anywhere on it harvests all of it (on a phone the tap
      // shows the sickle, and a tap on the sickle cuts the whole giant).
      await tap(p21);
      if (phone) {
        await expect.poll(sent).toEqual([{ a: "catch", plot: 30 }]);
        await page.locator("#fm-sickle [data-sickle]").tap();
      }
      await expect.poll(sent).toEqual([
        { a: "catch", plot: 30 },
        { a: "harvest-giant", plot: 10 },
      ]);
      await expect(page.locator("#toast")).toContainText(
        "Giant Earth Carrot harvested: +36 crops",
      );
      const after = await cropDraws(page);
      expect(after.filter((d) => d.giant)).toHaveLength(0);

      // The crop book marks the crops that can grow giant, and lights the
      // one that did; the marks stay inside their fixed-size boxes.
      await openSheet(page, "book");
      const sheet = page.locator("#fm-sheet");
      await expect(sheet).toContainText("Crops marked GIANT can grow");
      await expect(sheet.locator(".bk .gt")).toHaveCount(4);
      await expect(sheet.locator(".bk .gt.on")).toHaveText("GIANT ×1");
      // The sheet slides in (slowly on this CPU-drawn machine): measure at rest.
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              getComputedStyle(document.querySelector("#fm-sheet")!).transform,
          ),
        )
        .toBe("none");
      const book = await page.evaluate(() =>
        [...document.querySelectorAll("#fm-sheet .bk")].map((bk) => {
          const r = bk.getBoundingClientRect(),
            t = bk.querySelector(".gt")?.getBoundingClientRect(),
            im = bk.querySelector("img")!.getBoundingClientRect();
          return {
            w: Math.round(r.width),
            inside:
              !t ||
              (t.left >= r.left - 0.5 &&
                t.right <= r.right + 0.5 &&
                t.top >= r.top - 0.5 &&
                t.bottom <= r.bottom + 0.5),
            // The mark sits in the corner, clear of most of the picture.
            covers: t
              ? (Math.max(
                  0,
                  Math.min(t.right, im.right) - Math.max(t.left, im.left),
                ) *
                  Math.max(
                    0,
                    Math.min(t.bottom, im.bottom) - Math.max(t.top, im.top),
                  )) /
                (im.width * im.height)
              : 0,
          };
        }),
      );
      expect(book).toHaveLength(25);
      expect(book.every((b) => b.inside)).toBe(true);
      expect(new Set(book.map((b) => b.w)).size).toBe(1);
      expect(Math.max(...book.map((b) => b.covers))).toBeLessThan(0.2);
      const sb = (await sheet.boundingBox())!;
      expect(sb.x).toBeGreaterThanOrEqual(left - 1);
      expect(sb.x + sb.width).toBeLessThanOrEqual(viewport.width - right + 1);
      expect(sb.y + sb.height).toBeLessThanOrEqual(
        viewport.height - bottom + 1,
      );
      await snap(page, info, `farm-giant-book-${tag}`);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

test("the Sickle takes a giant whole, and a ripe square waits for the server's answer", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  try {
    const page = await context.newPage();
    const errors = await openLobby(page);
    await fakeFarm(page);
    await giantFarm(page);
    // Ripe wheat right of the square (plots 3 and 13); and a second square
    // of carrots (plot 15: rows 1–3, columns 5–7) that ripens in 6 s.
    const ripeIn = 6;
    await page.evaluate((ripeIn) => {
      const f = (window as any).__fakeFarm,
        at = (s: number) => new Date(Date.now() + s * 1000).toISOString();
      for (const j of [3, 13])
        Object.assign(f.plots[j], {
          owned: true,
          crop: "wheat",
          progress: 1,
          ripeAt: at(-60),
        });
      for (const j of [15, 16, 17, 25, 26, 27, 35, 36, 37])
        Object.assign(f.plots[j], {
          owned: true,
          crop: "carrot",
          progress: 0.999,
          ripeAt: at(ripeIn),
          mutation: null,
          pests: 0,
        });
    }, ripeIn);
    await page.click('#hub-scenes [data-hub-scene="farm"]');
    await expect(page.locator("#fm-badge")).toContainText("tester's Farm");
    const sent = () =>
      page.evaluate(() =>
        (window as any).__farmRequests.flatMap((r: any) => r.actions ?? []),
      );
    // The Sickle at plot 13: its 3×3 touches the giant, which goes first and
    // whole; then the other ripe plots in reach, one by one.
    const p13 = await plotAt(page, 13);
    await page.mouse.click(p13.x, p13.y);
    await expect.poll(sent).toEqual([
      { a: "harvest-giant", plot: 10 },
      { a: "harvest", plot: 3 },
      { a: "harvest", plot: 4 },
      { a: "harvest", plot: 13 },
    ]);
    // The second square ripens on the screen: the farm asks the server at
    // once, and holds its harvest until the answer (slowed down here) comes.
    await page.evaluate(() => {
      const w = window as any;
      w.__farmGets = 0;
      w.__farmDelay = 2500;
      w.__onFarmGet = () => {
        const f = w.__fakeFarm,
          sq = [15, 16, 17, 25, 26, 27, 35, 36, 37];
        if (Date.parse(f.plots[15].ripeAt) > Date.now()) return;
        for (const j of sq) f.plots[j].progress = 1;
        f.giants = [
          { i: 15, crop: "carrot", plots: sq, formedAt: f.plots[15].ripeAt },
        ];
      };
    });
    await expect
      .poll(() => page.evaluate(() => (window as any).__farmGets), {
        timeout: (ripeIn + 6) * 1000,
      })
      .toBeGreaterThan(0);
    const p26 = await plotAt(page, 26);
    await page.mouse.click(p26.x, p26.y);
    await expect(page.locator("#toast")).toContainText(
      "Something big is growing here",
    );
    await snap(page, info, "farm-giant-pending-1280x800");
    expect((await sent()).length).toBe(4);
    await expect(page.locator("#toast")).toContainText(
      "A giant Earth Carrot grew!",
    );
    await page.evaluate(() => ((window as any).__farmDelay = 0));
    await page.mouse.click(p26.x, p26.y);
    await expect
      .poll(async () => (await sent()).at(-1))
      .toEqual({ a: "harvest-giant", plot: 15 });
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("a friend's giant crop: each tap sneaks one of its crops", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  try {
    const page = await context.newPage();
    const errors = await openLobby(page);
    await fakeFarm(page);
    await page.evaluate((sq) => {
      const w = window as any,
        at = (s: number) => new Date(Date.now() + s * 1000).toISOString();
      w.__friends = [
        {
          id: "f1",
          name: "Rae",
          fighter: "tidefin",
          level: 20,
          dog: null,
          bugs: 0,
          ripe: 9,
        },
      ];
      const plots = Array.from({ length: 50 }, (_, i) => ({
        i,
        owned: Math.floor(i / 10) < 4,
        crop: null as string | null,
        progress: 0,
        ripeAt: null as string | null,
        wet: false,
        pests: 0,
        mutation: null,
        sneak: false,
      }));
      for (const j of sq)
        Object.assign(plots[j], {
          crop: "pumpkin",
          progress: 1,
          ripeAt: at(-60),
          sneak: true,
        });
      w.__visit = {
        id: "f1",
        name: "Rae",
        fighter: "tidefin",
        level: 20,
        farmer: "tidefin",
        plots,
        dog: null,
        scarecrow: false,
        sprinklers: 0,
        giants: [{ i: 10, crop: "pumpkin", plots: sq, formedAt: at(-60) }],
        today: { helpXp: 0, sneaks: 0, pranks: 0 },
      };
    }, GIANT_SQUARE);
    await page.click('#hub-scenes [data-hub-scene="farm"]');
    await expect(page.locator("#fm-badge")).toContainText("tester's Farm");
    await openSheet(page, "friends");
    await page
      .locator("#fm-sheet .fr", { hasText: "Rae" })
      .locator("[data-visit]")
      .click();
    await expect(page.locator("#fm-visit")).toContainText("Rae's Farm");
    await page.waitForTimeout(500);
    const draws = await cropDraws(page);
    expect(draws.filter((d) => d.giant)).toHaveLength(1);
    await snap(page, info, "farm-giant-friend-1280x800");
    const sneaks = () =>
      page.evaluate(() =>
        (window as any).__farmRequests
          .filter((r: any) => r.friend)
          .flatMap((r: any) => r.actions),
      );
    // The crop under the tap first, then the next one not tried yet.
    const p21 = await plotAt(page, 21);
    await page.mouse.click(p21.x, p21.y);
    await expect.poll(sneaks).toEqual([{ a: "sneak", plot: 21 }]);
    await page.mouse.click(p21.x, p21.y);
    await expect.poll(sneaks).toEqual([
      { a: "sneak", plot: 21 },
      { a: "sneak", plot: 10 },
    ]);
    // Still a giant: one crop smaller.
    expect((await cropDraws(page)).filter((d) => d.giant)).toHaveLength(1);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

// Phones: an open sheet keeps 10px under the player card (it touched it)
// and the farm badge steps aside with the orbs and tools; a toast never
// lands on the first-visit hint (they shared a spot 8px over the tool bar).
for (const view of [
  { width: 844, height: 390, inset: null },
  { width: 932, height: 430, inset: { left: 59, right: 59, bottom: 21 } },
]) {
  test(`a phone sheet clears the card, and toasts clear the hint at ${view.width}x${view.height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: view.width, height: view.height },
      isMobile: true,
      hasTouch: true,
    });
    try {
      const page = await context.newPage();
      const errors = await openLobby(page);
      await fakeFarm(page);
      if (view.inset)
        await page.evaluate((inset) => {
          for (const [key, value] of Object.entries(inset))
            document.documentElement.style.setProperty(
              `--safe-${key}`,
              `${value}px`,
            );
        }, view.inset);
      await page.click('#hub-scenes [data-hub-scene="farm"]');
      await expect(page.locator(".farm-layer #fm-cv")).toBeVisible();
      const rect = (s: string) =>
        page.evaluate((s) => {
          const r = document.querySelector(s)!.getBoundingClientRect();
          return { l: r.left, t: r.top, r: r.right, b: r.bottom };
        }, s);
      // The toast, shown while the hint is up, sits clear of it.
      await expect(page.locator("#fm-hint")).toBeVisible();
      await page.evaluate(() => {
        const t = document.getElementById("toast")!;
        t.textContent = "Harvested 3 Breeze Wheat";
        t.classList.add("show");
      });
      await page.waitForTimeout(600);
      const hint = await rect("#fm-hint"),
        toast = await rect("#toast");
      expect(toast.b, "toast over the hint").toBeLessThanOrEqual(hint.t);
      await page.evaluate(() =>
        document.getElementById("toast")!.classList.remove("show"),
      );
      // A sheet: 10px under the card, the badge stepped aside.
      await openSheet(page, "shop");
      // Measure once its slide-in has finished.
      await page
        .locator("#fm-sheet")
        .evaluate((el) =>
          Promise.all(el.getAnimations().map((a) => a.finished)),
        );
      const card = await rect("#account-profile"),
        sheet = await rect("#fm-sheet");
      expect(sheet.t - card.b, "sheet under the card").toBeGreaterThanOrEqual(
        8,
      );
      expect(sheet.l, "sheet on the card's left edge").toBeCloseTo(card.l, 0);
      await expect(page.locator("#fm-badge")).toBeHidden();
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

test("tapping the farm's animals, trees and buildings reacts and sends nothing; night lights the farm", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors = await openLobby(page);
  await fakeFarm(page);
  await page.click('#hub-scenes [data-hub-scene="farm"]');
  await expect(page.locator(".farm-layer")).toHaveAttribute(
    "data-frozen",
    "false",
  );
  await page.waitForFunction(() => (window as any).__farm?.F?.loaded);
  const sent = () =>
    page.evaluate(() =>
      (window as any).__farmRequests.flatMap((r: any) => r.actions ?? [r]),
    );
  const before = await sent();
  const hen = await page.evaluate(() => {
    const h = (window as any).__farm.hens[0];
    return h ? [h.x, h.y - 12] : null;
  });
  // A hen, the cat by the house, the pond, the apple tree, the house, the mill.
  const spots = [
    ...(hen ? [hen] : []),
    [150, 294],
    [250, 990],
    [338, 180],
    [205, 215],
    [470, 170],
  ];
  for (const [x, y] of spots) {
    await page.evaluate(([x, y]) => (window as any).__farm.look(x, y), [x, y]);
    const pt = await page.evaluate(
      ([x, y]) => (window as any).__farm.worldClient(x, y),
      [x, y],
    );
    await page.mouse.click(pt.x, pt.y);
  }
  // Leaves, feathers, ripples… are on the farm; nothing went to the server.
  expect(
    await page.evaluate(() => (window as any).__farm.feel.parts.length),
  ).toBeGreaterThan(0);
  expect(await sent()).toEqual(before);
  await expect(page.locator("#fm-sheet")).toBeHidden();
  await snap(page, info, "farm-pokes");
  // Golden hour, then night: the grade and the lit windows draw without errors.
  await page.evaluate(() => (window as any).__farm.look(600, 520));
  await page.evaluate(() => (window as any).__farm.tod(0.73));
  await page.waitForTimeout(400);
  await snap(page, info, "farm-golden-hour");
  await page.evaluate(() => (window as any).__farm.tod(0.95));
  await page.waitForTimeout(400);
  await snap(page, info, "farm-night");
  expect(errors).toEqual([]);
});

test("friends trade seed gifts and grow friendship days; the invite tab shares a link", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await openLobby(page);
  await fakeFarm(page);
  await page.evaluate(() => {
    (window as any).__gifts = {
      day: "2026-11-05",
      openedToday: 0,
      openCap: 20,
      friends: [
        {
          id: "00000000-0000-4000-8000-0000000000a1",
          name: "Mai",
          fighter: "voltkit",
          level: 44,
          days: 6,
          bond: 1,
          sent: false,
          waiting: 1,
        },
        {
          id: "00000000-0000-4000-8000-0000000000a2",
          name: "Khoa",
          fighter: "tidefin",
          level: 38,
          days: 31,
          bond: 3,
          sent: true,
          waiting: 0,
        },
      ],
      invites: {
        code: "AB12CD34",
        joined: 2,
        counted: 1,
        claimed: [1],
        invitedBy: null,
      },
    };
  });
  await page.click('#hub-scenes [data-hub-scene="farm"]');
  await page.waitForFunction(() => (window as any).__farm?.F?.loaded);
  // A waiting gift puts a dot on the Friends button.
  await expect(page.locator("#fm-fr-dot")).toBeVisible();
  await openSheet(page, "friends");
  await page.click('#fm-sheet [data-tab="gifts"]');
  const sheet = page.locator("#fm-sheet");
  await expect(sheet).toContainText("Mai · Lv 44");
  await expect(sheet).toContainText(
    "Bud · 6 friendship days · 1 more to Bloom",
  );
  await expect(sheet).toContainText("Grove");
  await expect(
    sheet.locator('[data-gift-send="00000000-0000-4000-8000-0000000000a2"]'),
  ).toBeDisabled();
  await snap(page, info, "farm-gifts");
  await sheet
    .locator('[data-gift-open="00000000-0000-4000-8000-0000000000a1"]')
    .click();
  await expect(sheet).toContainText("7 friendship days");
  await expect(sheet.locator("[data-gift-open]")).toHaveCount(0);
  await sheet
    .locator('[data-gift-send="00000000-0000-4000-8000-0000000000a1"]')
    .click();
  await expect(
    sheet.locator('[data-gift-send="00000000-0000-4000-8000-0000000000a1"]'),
  ).toBeDisabled();
  expect(
    await page.evaluate(() =>
      (window as any).__farmRequests
        .filter((r: any) => r.gift)
        .map((r: any) => r.gift),
    ),
  ).toEqual(["open", "send"]);
  await page.click('#fm-sheet [data-tab="invite"]');
  await expect(page.locator("#fm-invite-link")).toHaveValue(/\?farm=AB12CD34$/);
  await expect(sheet).toContainText("reached level 10: 1");
  await snap(page, info, "farm-invite");
  expect(errors).toEqual([]);
});

test("the Supply Balloon: fill a crate, ask friends, launch it; help a friend's crate", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await openLobby(page);
  await fakeFarm(page);
  await page.evaluate(() => {
    const crate = (
      crop: string,
      qty: number,
      state = "open",
      by: string | null = null,
    ) => ({ crop, qty, state, by });
    (window as any).__balloon = {
      crates: [
        crate("wheat", 3),
        crate("carrot", 6),
        crate("wheat", 2, "done"),
        crate("carrot", 4, "done", "f1"),
        crate("wheat", 1, "done"),
        crate("melon", 2, "asked"),
      ],
      arrivesAt: null,
      launches: 0,
      leaves: 140,
      xp: 90,
      helperStars: 3,
      helperLeavesToday: 40,
      helperCap: 600,
      helpers: { f1: "Mai" },
    };
    (window as any).__help = {
      requests: [
        {
          friend: "00000000-0000-4000-8000-0000000000a1",
          name: "Mai",
          fighter: "voltkit",
          slot: 4,
          crop: "wheat",
          qty: 2,
          reward: 12,
          have: 4,
        },
      ],
      helperStars: 3,
      helperLeavesToday: 40,
      helperCap: 600,
    };
  });
  await page.click('#hub-scenes [data-hub-scene="farm"]');
  await page.waitForFunction(() => (window as any).__farm?.F?.loaded);
  // The balloon floats by the farm; a tap on it opens its sheet.
  await page.evaluate(() => (window as any).__farm.look(1080, 300));
  await page.waitForTimeout(500);
  await snap(page, info, "farm-balloon-world");
  const pt = await page.evaluate(() =>
    (window as any).__farm.worldClient(1080, 60),
  );
  await page.mouse.click(pt.x, pt.y);
  const sheet = page.locator("#fm-sheet");
  await expect(sheet).toContainText("Supply balloon");
  await expect(sheet).toContainText("Filled by Mai");
  await expect(sheet).toContainText("Friends can fill it");
  // 4 wheat in the barn: the 3-wheat crate can be filled.
  await sheet.locator('[data-bfill="0"]').click();
  await expect(sheet.locator(".fm-crate").nth(0)).toHaveClass(/done/);
  await sheet.locator('[data-bask="1"]').click();
  await expect(sheet.locator(".fm-crate").nth(1)).toHaveClass(/asked/);
  await snap(page, info, "farm-balloon-sheet");
  // Not all six yet: it can leave early with the filled ones, after a
  // second tap (the first sends nothing).
  const launch = sheet.locator("[data-blaunch]");
  await expect(launch).toBeEnabled();
  await expect(launch).toContainText("Send it off now");
  await launch.click();
  await expect(launch).toContainText("Tap again: leave with");
  expect(
    await page.evaluate(() =>
      (window as any).__farmRequests.filter((r: any) => r.balloon === "launch"),
    ),
  ).toEqual([]);
  // Everything filled (the fake fills the asked crates): launch.
  await page.evaluate(() =>
    (window as any).__balloon.crates.forEach((c: any) => (c.state = "done")),
  );
  await page.evaluate(() => (window as any).__farm.F && null);
  // Close the sheet and tap the balloon again: it loads the filled crates.
  await page.click("#fm-sheet [data-close]");
  await tapPlace(page, "balloon");
  await expect(sheet.locator("[data-blaunch]")).toBeEnabled();
  await sheet.locator("[data-blaunch]").click();
  await expect(sheet).toBeHidden();
  expect(
    await page.evaluate(() =>
      (window as any).__farmRequests
        .filter((r: any) => r.balloon)
        .map((r: any) => r.balloon),
    ),
  ).toEqual(["fill", "ask", "launch"]);
  // Helping a friend from Friends → Help.
  await openSheet(page, "friends");
  await page.click('#fm-sheet [data-tab="help"]');
  await expect(sheet).toContainText("Mai needs 2 Breeze Wheat");
  await sheet.locator("[data-hfill]").click();
  await expect(sheet).toContainText("No requests right now");
  expect(errors).toEqual([]);
});

test("the Farm Stall: put crops on a shelf, and buy from a friend in the Valley Paper", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await openLobby(page);
  await fakeFarm(page);
  await page.evaluate(() => {
    (window as any).__stall = {
      shelves: [
        {
          slot: 1,
          crop: "carrot",
          mutation: "",
          qty: 4,
          price: 26,
          sold: true,
          buyer: "Mai",
          collect: 23,
        },
      ],
      earnedToday: 0,
      boughtToday: 0,
      earnCap: 3000,
      buyCap: 10,
      paper: [
        {
          seller: "00000000-0000-4000-8000-0000000000a1",
          name: "Mai",
          fighter: "voltkit",
          slot: 0,
          crop: "melon",
          mutation: "",
          qty: 2,
          price: 50,
          market: 44,
        },
      ],
    };
  });
  await page.click('#hub-scenes [data-hub-scene="farm"]');
  await page.waitForFunction(() => (window as any).__farm?.F?.loaded);
  await openSheet(page, "market");
  await page.click('#fm-sheet [data-tab="stall"]');
  const sheet = page.locator("#fm-sheet");
  await expect(sheet).toContainText("Sold to Mai");
  await sheet.locator('[data-shelf="0"]').click();
  await expect(page.locator("#fm-st-crop")).toBeVisible();
  // 4 wheat in the barn; the price follows the slider.
  await page.locator("#fm-st-qty").selectOption("3");
  await page.locator("#fm-st-price").fill("1.5");
  await expect(page.locator("#fm-st-read")).toContainText("Asking");
  await snap(page, info, "farm-stall");
  await sheet.locator("[data-slist]").click();
  await expect(sheet.locator(".fm-shelf").nth(0)).toContainText(
    "3 Breeze Wheat",
  );
  const list = await page.evaluate(() =>
    (window as any).__farmRequests.find((r: any) => r.stall === "list"),
  );
  expect(list).toMatchObject({ kind: "list", slot: 0, crop: "wheat", qty: 3 });
  // The server's band: 0.5×–1.5× the market price.
  const unit = await page.evaluate(() => {
    const f = (window as any).__farm.F;
    return Math.max(1, Math.round(5 * (f.market.mult.wheat?.m ?? 1)));
  });
  expect(list.price).toBeLessThanOrEqual(Math.floor(unit * 3 * 1.5));
  expect(list.price).toBeGreaterThanOrEqual(Math.ceil(unit * 3 * 0.5));
  await page.click('#fm-sheet [data-tab="paper"]');
  await expect(sheet).toContainText("2 Storm Melon");
  await expect(sheet).toContainText("you grow it at Lv 35");
  await sheet.locator("[data-sbuy]").click();
  await expect(sheet).toContainText("shelves are empty");
  expect(errors).toEqual([]);
});

test("a friend on your farm: they stand by the gate, emotes show, and a Harvest Party starts", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await openLobby(page);
  await fakeFarm(page);
  await page.evaluate(() => {
    (window as any).__here = {
      owner: "me",
      present: [
        {
          id: "00000000-0000-4000-8000-0000000000a1",
          name: "Mai",
          fighter: "voltkit",
          owner: false,
          emote: "wave",
          emoteAt: new Date().toISOString(),
        },
      ],
      party: true,
      partyLeft: 1800,
    };
    const f = window.fetch;
    (window as any).__pings = [];
    window.fetch = (input: any, init?: any) => {
      if (String(input).endsWith("/api/farm/here"))
        (window as any).__pings.push(init?.body ? JSON.parse(init.body) : {});
      return f(input, init);
    };
  });
  await page.click('#hub-scenes [data-hub-scene="farm"]');
  await page.waitForFunction(() => (window as any).__farm?.F?.loaded);
  const pill = page.locator("#fm-here");
  await expect(pill).toContainText("Mai is here");
  await expect(pill).toContainText("Harvest Party: +1 crop a harvest");
  await pill.locator('[data-emote="heart"]').click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).__pings.some((p: any) => p.emote === "heart"),
      ),
    )
    .toBe(true);
  await page.evaluate(() => (window as any).__farm.look(780, 760));
  await page.waitForTimeout(400);
  await snap(page, info, "farm-party");
  expect(errors).toEqual([]);
});

// A tap on the farm with a sheet or a status orb's card open only closes
// it (it doesn't also harvest), as the lit rail button does; the land
// deed closes on a tap on its dim background. Placing decor on desktop is
// the exception: those taps place (the decorating test).
test("a tap on the farm closes the open sheet or orb card and does nothing else", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  try {
    const page = await context.newPage();
    const errors = await openLobby(page);
    await fakeFarm(page);
    await page.click('#hub-scenes [data-hub-scene="farm"]');
    await expect(page.locator("#fm-badge")).toContainText("tester's Farm");
    await page.waitForFunction(() => (window as any).__farm?.F?.loaded);
    await page.waitForTimeout(400);
    const actions = () =>
      page.evaluate(() =>
        (window as any).__farmRequests.flatMap((r: any) => r.actions ?? []),
      );
    const shop = page.locator('#fm-rail [data-sheet="shop"]'),
      sheet = page.locator("#fm-sheet");
    await shop.click();
    await expect(sheet).toBeVisible();
    await expect(shop).toHaveAttribute("aria-expanded", "true");
    expect(
      await shop.evaluate((el) => getComputedStyle(el).boxShadow),
    ).toContain("rgba(255, 214, 91, 0.35)");
    // The lit button closes it again.
    await shop.click();
    await expect(sheet).toBeHidden();
    await expect(shop).toHaveAttribute("aria-expanded", "false");
    expect(
      await shop.evaluate((el) => getComputedStyle(el).boxShadow),
    ).not.toContain("rgba(255, 214, 91");

    // A ripe plot under an open sheet: the tap only closes the sheet.
    const ripe = await page.evaluate(() =>
      (window as any).__farm.plotClient(0),
    );
    await shop.click();
    await expect(sheet).toBeVisible();
    await page.mouse.click(ripe.x, ripe.y);
    await expect(sheet).toBeHidden();
    await expect(shop).toHaveAttribute("aria-expanded", "false");
    await page.waitForTimeout(1200);
    expect(await actions(), "the closing tap harvested").toEqual([]);

    // An orb's card: the same.
    await page.click('#fm-chips [data-orb="weather"]');
    await expect(page.locator("#fm-orbpop")).toBeVisible();
    await page.mouse.click(ripe.x, ripe.y);
    await expect(page.locator("#fm-orbpop")).toBeHidden();
    await page.waitForTimeout(1200);
    expect(await actions(), "the closing tap harvested").toEqual([]);

    // With nothing open, the tap harvests as always (a 3×3 cut: this farm
    // owns the Sickle).
    await page.mouse.click(ripe.x, ripe.y);
    await expect
      .poll(actions)
      .toEqual([{ a: "harvest", plot: 0, tool: "sickle" }]);

    // The land deed: a tap beside it, on its dim background, closes it
    // (and leaves the shop open behind it).
    await shop.click();
    await page.click('#fm-sheet [data-tab="land"]');
    await page.locator("#fm-sheet [data-landbuy]").first().click();
    const deed = page.locator("#fm-modal");
    await expect(deed.locator(".deed")).toBeVisible();
    const out = await page.evaluate(() => {
      const r = document
          .querySelector("#fm-modal .deed")!
          .getBoundingClientRect(),
        x = r.left - 40,
        y = r.top + r.height / 2;
      return { x, y, hit: document.elementFromPoint(x, y)?.id };
    });
    expect(out.hit).toBe("fm-modal");
    await deed.locator(".deed h5").click();
    await expect(deed).toBeVisible();
    await page.mouse.click(out.x, out.y);
    await expect(deed).toBeHidden();
    await expect(sheet).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("a server answer keeps the open sheet scrolled where it was", async ({
  page,
}) => {
  await page.setViewportSize({ width: 667, height: 375 });
  const errors = await openLobby(page);
  await fakeFarm(page);
  await page.click('#hub-scenes [data-hub-scene="farm"]');
  await page.waitForFunction(() => (window as any).__farm?.F?.loaded);
  await openSheet(page, "shop");
  const body = page.locator("#fm-sheet .sh-body");
  await body.evaluate((el) => (el.scrollTop = el.scrollHeight));
  const y = await body.evaluate((el) => el.scrollTop);
  expect(y).toBeGreaterThan(20);
  // The minute poll reads the farm again: more wheat seeds now.
  const gets = await page.evaluate(() => (window as any).__farmGets);
  await page.evaluate(() => {
    const w = window as any;
    w.__fakeFarm.seeds.wheat = 21;
    void w.__farm.refresh();
  });
  await page.waitForFunction(
    (n) => (window as any).__farmGets > n,
    gets as number,
  );
  await page.waitForTimeout(200);
  // The sheet shows the new count, and its list stays where it was.
  await expect(page.locator("#fm-sheet")).toContainText("You have 21");
  expect(await body.evaluate((el) => el.scrollTop)).toBe(y);
  expect(errors).toEqual([]);
});
