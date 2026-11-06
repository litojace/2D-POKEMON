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
      // Giant crops (migration 050).
      giants: [] as {
        i: number;
        crop: string;
        plots: number[];
        formedAt: string;
      }[],
      giantsGrown: {} as Record<string, number>,
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
      if (url.endsWith("/api/farm")) {
        // Tests can change the farm as it is read, and slow the answer down.
        w.__farmGets = (w.__farmGets ?? 0) + 1;
        w.__onFarmGet?.();
        if (w.__farmDelay)
          await new Promise((r) => setTimeout(r, w.__farmDelay));
        return json({ ...farm, now: now() });
      }
      // Friends' farms (migration 047).
      if (url.endsWith("/api/farm/friends")) return json(w.__friends ?? []);
      // The Farm Stall (059), live visits and likes (061).
      if (url.endsWith("/api/farm/stall") && !init?.body)
        return json(
          w.__stall ?? {
            shelves: [],
            earnedToday: 0,
            boughtToday: 0,
            earnCap: 3000,
            buyCap: 10,
            paper: [],
          },
        );
      if (url.endsWith("/api/farm/stall")) {
        const body = JSON.parse(String(init?.body));
        w.__farmRequests.push({ stall: body.kind, ...body });
        const st = w.__stall;
        if (body.kind === "list")
          st.shelves.push({
            slot: body.slot,
            crop: body.crop,
            mutation: body.mutation ?? "",
            qty: body.qty,
            price: body.price,
            sold: false,
            buyer: null,
            collect: null,
          });
        if (body.kind === "buy")
          st.paper = st.paper.filter(
            (p: any) => !(p.seller === body.seller && p.slot === body.slot),
          );
        return json({
          ...st,
          ok: true,
          gained:
            body.kind === "buy" ? { crop: "melon", qty: 2, price: 50 } : null,
        });
      }
      if (url.endsWith("/api/farm/here"))
        return json(
          w.__here ?? {
            owner: "me",
            present: [],
            party: false,
            partyLeft: 3600,
          },
        );
      if (url.endsWith("/api/farm/gone")) return json({ ok: true });
      if (url.endsWith("/api/farm/tour")) return json(w.__tour ?? []);
      if (url.endsWith("/api/farm/like"))
        return json({ ok: true, tour: w.__tour ?? [] });
      // The Supply Balloon and friends' help (migration 058).
      if (url.endsWith("/api/farm/balloon") && !init?.body)
        return json(
          w.__balloon ?? {
            crates: null,
            arrivesAt: null,
            launches: 0,
            leaves: null,
            xp: null,
            helperStars: 0,
            helperLeavesToday: 0,
            helperCap: 600,
            helpers: {},
          },
        );
      if (url.endsWith("/api/farm/balloon")) {
        const body = JSON.parse(String(init?.body));
        w.__farmRequests.push({ balloon: body.kind, slot: body.slot });
        const b = w.__balloon;
        if (body.kind === "launch") {
          const gained = { leaves: b.leaves, xp: b.xp, bonus: "gold" };
          Object.assign(b, {
            crates: null,
            arrivesAt: at(3600),
            launches: b.launches + 1,
          });
          return json({ balloon: b, ok: true, gained });
        }
        b.crates[body.slot].state = body.kind === "ask" ? "asked" : "done";
        return json({ balloon: b, ok: true });
      }
      if (url.endsWith("/api/farm/help") && !init?.body)
        return json(
          w.__help ?? {
            requests: [],
            helperStars: 0,
            helperLeavesToday: 0,
            helperCap: 600,
          },
        );
      if (url.endsWith("/api/farm/help")) {
        const body = JSON.parse(String(init?.body));
        w.__farmRequests.push({ help: body.friend, slot: body.slot });
        w.__help.requests = w.__help.requests.filter(
          (r: any) => r.slot !== body.slot,
        );
        w.__help.helperStars++;
        return json({
          help: w.__help.requests,
          ok: true,
          gained: { leaves: 26, star: 1 },
        });
      }
      // Gifts, friendship days and invites (migration 057).
      if (url.endsWith("/api/farm/gifts"))
        return json(
          w.__gifts ?? {
            day: "2026-11-05",
            openedToday: 0,
            openCap: 20,
            friends: [],
            invites: {
              code: "AB12CD34",
              joined: 0,
              counted: 0,
              claimed: [],
              invitedBy: null,
            },
          },
        );
      if (
        url.endsWith("/api/farm/gifts/send") ||
        url.endsWith("/api/farm/gifts/open")
      ) {
        const body = JSON.parse(String(init?.body));
        const g = w.__gifts,
          f = g.friends.find((x: any) => x.id === body.friend);
        w.__farmRequests.push({
          gift: url.endsWith("send") ? "send" : "open",
          ...body,
        });
        if (url.endsWith("send")) {
          f.sent = true;
          return json({ ok: true, state: g });
        }
        f.waiting--;
        f.days++;
        g.openedToday++;
        return json({ ok: true, crop: "carrot", qty: 3, state: g });
      }
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
          if (a.a === "harvest-giant") {
            const g = farm.giants.find((x) => x.plots.includes(a.plot));
            if (!g) return { ok: false, error: "No giant crop here" };
            for (const j of g.plots)
              Object.assign(plots[j], {
                crop: null,
                progress: 0,
                ripeAt: null,
                mutation: null,
                pests: 0,
              });
            farm.giants = farm.giants.filter((x) => x !== g);
            farm.giantsGrown[g.crop] = (farm.giantsGrown[g.crop] ?? 0) + 1;
            // A giant counts as 9 harvests in the crop book.
            (farm.harvests as Record<string, number>)[g.crop] =
              ((farm.harvests as Record<string, number>)[g.crop] ?? 0) + 9;
            farm.barn = [...farm.barn, { crop: g.crop, mutation: "", qty: 36 }];
            return { ok: true, giant: g.i, crop: g.crop, qty: 36, xp: 72 };
          }
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
          // Decor (048) with storage (065): a stored copy places free, and
          // what it replaces, or what is put away, is stored.
          const store = (id: string) =>
            (farm.decorCredits[id] = (farm.decorCredits[id] ?? 0) + 1);
          if (a.a === "decor") {
            const old = farm.decor.find((d: any) => d.slot === a.slot)?.item;
            farm.decor = farm.decor.filter((d: any) => d.slot !== a.slot);
            farm.decor.push({ slot: a.slot, item: a.item });
            farm.charm += 1;
            const free = (farm.decorCredits[a.item] ?? 0) > 0;
            if (free && !--farm.decorCredits[a.item])
              delete farm.decorCredits[a.item];
            if (!free) farm.leaves -= 300;
            if (old) store(old);
            return {
              ok: true,
              decor: a.item,
              slot: a.slot,
              cost: free ? 0 : 300,
              ...(old ? { stored: old } : {}),
            };
          }
          if (a.a === "decor-remove") {
            const old = farm.decor.find((d: any) => d.slot === a.slot)?.item;
            if (!old) return { ok: false, error: "Nothing there" };
            farm.decor = farm.decor.filter((d: any) => d.slot !== a.slot);
            farm.charm -= 1;
            store(old);
            return { ok: true, removed: a.slot, stored: old };
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
            farm.milkAt = at(1200);
            farm.leaves -= 900;
            return { ok: true, pasture: true, milkAt: farm.milkAt };
          }
          if (a.a === "milk" && farm.pasture) {
            farm.milkAt = at(7200);
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
      // The right rail (with the zoom buttons under it on desktop) ends on
      // the tool bar's line, and its four buttons are all there.
      const tools = all.find((b) => b.name === "tools")!,
        corner = all
          .filter((b) => b.name === "rail" || b.name === "zoom")
          .reduce((a, b) => (b.y + b.h > a.y + a.h ? b : a));
      expect(corner.y + corner.h, "corner bottom").toBeCloseTo(
        tools.y + tools.h,
        0,
      );
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
    await expect(page.locator("#fm-tools [data-tool]")).toHaveCount(7);
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
      // Each frame starts with the background at the world's corner.
      if (a.length === 2 && a[0] === -360 && a[1] === -180) frames.push([]);
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
    await new Promise((r) => setTimeout(r, 2500));
    proto.drawImage = orig;
    // A whole frame: not the first or last (they may be cut).
    return frames.slice(1, -1).find((f) => f.length) ?? [];
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
      // …and a tap anywhere on it harvests all of it.
      await tap(p21);
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
    await page.click('#fm-tools [data-tool="sickle"]');
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
    await page.click('#fm-tools [data-tool="hand"]');
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

    // With nothing open, the tap harvests as always.
    await page.mouse.click(ripe.x, ripe.y);
    await expect.poll(actions).toEqual([{ a: "harvest", plot: 0 }]);

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
