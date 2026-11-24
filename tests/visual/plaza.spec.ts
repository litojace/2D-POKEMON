import { expect, test, type Page } from "@playwright/test";
import { asRgb, openPlaza, snap } from "./helpers";
import {
  PLAZA_FOUNTAIN,
  PLAZA_GIFT,
  PLAZA_HURDLE_SEGMENTS,
  PLAZA_QUESTS,
  PLAZA_TRACK,
} from "../../packages/shared/src/plaza";

// Hub redesign phase 3: the new Plaza. The harness runs the real PlazaWorld
// in the page (harness/plaza-sim.ts) in place of the game server.
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
      ["menu", ".header-menu > summary"],
      ["event", "#pz-event"],
      ["clock", "#pz-clock"],
      ["quests", "#pz-quests"],
      ["emote", ".pz-left"],
      ["actions", ".pz-actions"],
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
const teleport = (page: Page, x: number, y: number) =>
  page.evaluate(([x, y]) => (window as any).__plazaPosition(x, y), [x, y]);

for (const viewport of [
  { width: 1440, height: 900, inset: null },
  { width: 844, height: 390, inset: null },
  {
    width: 852,
    height: 393,
    inset: { left: 59, right: 59, bottom: 21, top: 0 },
  },
  // The narrowest phone: the scene switch used to run into the coins.
  { width: 667, height: 375, inset: null },
]) {
  test(`the Plaza HUD fits at ${viewport.width}x${viewport.height}${viewport.inset ? " with a Dynamic Island" : ""}`, async ({
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
      const errors = await openPlaza(page);
      if (viewport.inset)
        await page.evaluate((inset) => {
          for (const [key, value] of Object.entries(inset))
            document.documentElement.style.setProperty(
              `--safe-${key}`,
              `${value}px`,
            );
        }, viewport.inset);
      await expect(page.locator("#pz-quests")).toContainText("Plaza today");
      await expect(page.locator("#pz-event")).toContainText("Orb Shower");
      await expect(page.locator(".plaza-layer")).toHaveClass(
        phone ? /phone/ : /^plaza-layer$/,
      );
      // English only, and the joystick only on touch screens.
      await expect(page.locator(".pz-joy")).toBeVisible({ visible: phone });
      // Dash and Jump show their keyboard keys only where there is a
      // keyboard, and on phones they are sized for a thumb.
      for (const id of ["#pz-dash", "#pz-jump"])
        await expect(page.locator(`${id} small`)).toBeVisible({
          visible: !phone,
        });
      if (phone) {
        const size = (s: string) =>
          page.locator(s).evaluate((el) => el.getBoundingClientRect().width);
        expect(await size("#pz-dash")).toBeGreaterThanOrEqual(64);
        expect(await size("#pz-jump")).toBeGreaterThanOrEqual(80);
      }
      await page.waitForTimeout(800);
      await snap(
        page,
        info,
        `plaza-${viewport.width}x${viewport.height}${viewport.inset ? "-island" : ""}`,
      );
      const all = await hudBoxes(page);
      expect(all.map((b) => b.name)).toEqual(
        expect.arrayContaining(["event", "clock", "quests", "actions"]),
      );
      // The minimap is gone (it cost a second canvas every other frame).
      await expect(page.locator("#pz-mini")).toHaveCount(0);
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
      // One frame: whatever sits by an edge keeps the header's margin from
      // it (14 px, or the safe area where that is wider), so the header,
      // the panels and the buttons line up down each side.
      const ml = Math.max(14, left),
        mr = Math.max(14, right),
        mb = Math.max(14, bottom);
      for (const b of all) {
        if (b.x < ml + 30)
          expect(b.x, `${b.name} left margin`).toBeCloseTo(ml, 0);
        const gapR = viewport.width - (b.x + b.w);
        if (gapR < mr + 30)
          expect(gapR, `${b.name} right margin`).toBeCloseTo(mr, 0);
        const gapB = viewport.height - (b.y + b.h);
        if (gapB < mb + 30)
          expect(gapB, `${b.name} bottom margin`).toBeCloseTo(mb, 0);
      }
      // Today's quests: a round button like the round buttons over Jump
      // (the Lobby rail's Missions), under the player card on phones and
      // under the clock on desktop.
      const card = all.find((b) => b.name === "profile")!,
        clock = all.find((b) => b.name === "clock")!,
        quests = all.find((b) => b.name === "quests")!,
        round = await page
          .locator("#pz-map-btn")
          .evaluate((el) => el.getBoundingClientRect().width);
      expect(quests.w, "quests round").toBeCloseTo(quests.h, 0);
      expect(quests.w, "as big as the other round buttons").toBeCloseTo(
        round,
        0,
      );
      if (phone) {
        expect(quests.x, "quests under the card").toBeCloseTo(card.x, 0);
        expect(quests.y).toBeGreaterThan(card.y + card.h);
      } else {
        expect(quests.x + quests.w, "under the clock").toBeCloseTo(
          clock.x + clock.w,
          0,
        );
        expect(quests.y).toBeGreaterThan(clock.y + clock.h);
      }
      // Open, the list fits the screen (inside the safe area) and each
      // quest reads on one line.
      await page.click("#pz-quests [data-qopen]");
      const panel = page.locator("#pz-qpanel");
      await expect(panel).toBeVisible();
      await panel.evaluate((el) =>
        Promise.all(el.getAnimations().map((a) => a.finished)),
      );
      const pb = (await panel.boundingBox())!;
      expect(pb.x).toBeGreaterThanOrEqual(left - 1);
      expect(pb.x + pb.width).toBeLessThanOrEqual(viewport.width - right + 1);
      expect(pb.y + pb.height).toBeLessThanOrEqual(
        viewport.height - bottom + 1,
      );
      const lines = await panel.evaluate((el) =>
        [...el.querySelectorAll(".pz-q .tx b")].map((b) => {
          const r = b.getBoundingClientRect(),
            lh = parseFloat(getComputedStyle(b).lineHeight);
          return Math.round(r.height / lh);
        }),
      );
      expect(lines).toEqual(PLAZA_QUESTS.map(() => 1));
      await snap(
        page,
        info,
        `plaza-quests-${viewport.width}x${viewport.height}${viewport.inset ? "-island" : ""}`,
      );
      await page.click("#pz-quests [data-qclose]");
      await expect(panel).toBeHidden();
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

test("you walk where the server says, and Volt Boba is free", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await openPlaza(page);
  const server = () =>
    page.evaluate(() => {
      const w = (window as any).__plazaWorld;
      const b = w.bodyOf("local");
      return { x: b.x, y: b.y, boost: b.boost };
    });
  const start = await server();
  await page.locator(".plaza-layer").focus();
  // Hold D until the server has you 100 px east, then let go. A fixed 1.2 s
  // hold was flaky: the CPU-rendered test browser can stall for seconds as
  // the Plaza opens (a few frames a second after that), and the player then
  // moved only 12–24 px before the key came up.
  await page.keyboard.down("d");
  await expect
    .poll(async () => (await server()).x, { timeout: 30_000 })
    .toBeGreaterThan(start.x + 100);
  await page.keyboard.up("d");
  // The drawn player follows the server's position.
  await expect
    .poll(async () => {
      const [mine, srv] = await Promise.all([
        page.evaluate(() => (window as any).__plaza.P.x),
        server(),
      ]);
      return Math.abs(mine - srv.x);
    })
    .toBeLessThan(40);
  // Wait until the server has stopped you too. The key-up reaches it with
  // the next frame, which the CPU-drawn browser can hold back for a second
  // under load; teleporting before that left the server walking you east,
  // away from the truck, and the Volt Boba button never came.
  let was = NaN;
  await expect
    .poll(
      async () => {
        const x = (await server()).x,
          still = x === was;
        was = x;
        return still;
      },
      { timeout: 15_000, intervals: [500] },
    )
    .toBe(true);
  // Volt Boba: walk up to the truck, run faster (free).
  await teleport(page, 1745, 520);
  await expect(page.locator("#pz-interact")).toContainText("Volt Boba", {
    timeout: 10_000,
  });
  await page.click("#pz-interact");
  await expect(page.locator("#pz-interact")).not.toContainText("leaves");
  await expect(page.locator("#toast")).toContainText("30% faster");
  expect((await server()).boost).toBeGreaterThan(25);
  // Still boosted: the truck says so.
  await page.click("#pz-interact");
  await expect(page.locator("#toast")).toContainText("still active");
  // No Gold Leaves anywhere (retired): no wallet pill beside the coins.
  await expect(page.locator("#account-leaves")).toHaveCount(0);
  await snap(page, info, "plaza-boba");
  expect(errors).toEqual([]);
});

test("the Photo Spot takes a polaroid, and quests update from the server", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await openPlaza(page);
  await expect(page.locator("#pz-quests h5")).toContainText(
    `1/${PLAZA_QUESTS.length}`,
  );
  await teleport(page, 1010, 520);
  await expect(page.locator("#pz-interact")).toContainText("Take photo", {
    timeout: 10_000,
  });
  await page.click("#pz-interact");
  const photo = page.locator("#pz-photo .polaroid");
  await expect(photo).toBeVisible();
  await expect(photo).toContainText("tester at the Photo Spot");
  await expect(photo.locator("a[download]")).toHaveAttribute(
    "href",
    /^data:image\/jpeg/,
  );
  await snap(page, info, "plaza-photo");
  await photo.locator('[data-ph="close"]').click();
  await expect(photo).toBeHidden();
  // The server pays a finished quest in coins: the panel says so, and the
  // coin pill follows the account's refreshed balance.
  await expect(page.locator("#account-coins")).toContainText("2,340");
  await page.evaluate(() => {
    const w = window as any;
    w.__economyPatch = { balance: 2360 };
    const p = structuredClone(w.__plazaProgress);
    p.quests.lap = { n: 1, done: true };
    w.__sock.fire("plaza-progress", p);
  });
  await expect(page.locator("#pz-quests h5")).toContainText(
    `2/${PLAZA_QUESTS.length}`,
  );
  await expect(page.locator("#toast")).toContainText("+20 coins");
  await expect(page.locator("#account-coins")).toContainText("2,360");
  expect(errors).toEqual([]);
});

test("leaving the Plaza tab leaves the Plaza on the server; back, you and the townsfolk stand where you were", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await openPlaza(page);
  // Somewhere away from the fountain, and a mark on this Plaza.
  await page.evaluate(() => {
    (window as any).__plazaPosition(900, 1150);
    (window as any).__plaza.mark = "same plaza";
    // The townsfolk and bots of this Plaza (its copy on the server).
    (window as any).__plazaWorld.copies.get(1).mark = "same townsfolk";
  });
  await expect
    .poll(() => page.evaluate(() => Math.round((window as any).__plaza.P.x)))
    .toBe(900);
  await page.click('#hub-scenes [data-hub-scene="lobby"]');
  // Hidden here, gone on the server (nobody sees you standing there).
  await expect(page.locator(".plaza-layer")).toBeHidden();
  await expect(page.locator("#lobby-play")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => (window as any).__plazaWorld.size))
    .toBe(0);
  // Back: the same Plaza at once, joined again where you stood.
  await page.click('#hub-scenes [data-hub-scene="plaza"]');
  await expect(page.locator(".plaza-layer")).toBeVisible();
  expect(await page.evaluate(() => (window as any).__plaza.mark)).toBe(
    "same plaza",
  );
  await expect
    .poll(() => page.evaluate(() => (window as any).__plazaWorld.size))
    .toBe(1);
  const back = await page.evaluate(() => {
    const b = (window as any).__plazaWorld.bodyOf("local");
    return { x: Math.round(b.x), y: Math.round(b.y) };
  });
  expect(Math.hypot(back.x - 900, back.y - 1150)).toBeLessThan(3);
  // The townsfolk and bots waited where they were.
  expect(
    await page.evaluate(() => (window as any).__plazaWorld.copies.get(1).mark),
  ).toBe("same townsfolk");
  expect(errors).toEqual([]);
});

test("the Plaza rests behind Settings and wakes when it closes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await openPlaza(page);
  const layer = page.locator(".plaza-layer");
  await expect(layer).toHaveAttribute("data-frozen", "false");
  await page.evaluate(() => document.getElementById("settings")!.click());
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await expect(layer).toHaveAttribute("data-frozen", "true", {
    timeout: 15_000,
  });
  await page.click("#close-dialog");
  await expect(layer).toHaveAttribute("data-frozen", "false");
  // Still running: you can walk.
  const x0 = await page.evaluate(() => (window as any).__plaza.P.x);
  await layer.focus();
  await page.keyboard.down("a");
  await expect
    .poll(() => page.evaluate(() => (window as any).__plaza.P.x))
    .toBeLessThan(x0 - 30);
  await page.keyboard.up("a");
  expect(errors).toEqual([]);
});

test("tapping a player shows their card, to add them or invite them", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await openPlaza(page);
  // Someone else walks up beside you.
  await page.evaluate(() => {
    const w = window as any,
      me = w.__plazaWorld.bodyOf("local");
    w.__plazaWorld.join("other", "acct-other", {
      name: "Rin",
      title: "Storm Chaser",
      titleColor: "#9fd0ff",
      level: 7,
      character: "tidefin",
      skin: null,
    });
    Object.assign(w.__plazaWorld.bodyOf("other"), { x: me.x + 90, y: me.y });
  });
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          [...(window as any).__plaza.others.values()].some(
            (b: any) => b.name === "Rin",
          ),
        ),
      { timeout: 15_000 },
    )
    .toBe(true);
  const spot = await page.evaluate(() => {
    const p = (window as any).__plaza,
      rin = [...p.others.values()].find((b: any) => b.name === "Rin");
    return p.worldClient(rin.tx, rin.ty - 30);
  });
  await page.mouse.click(spot.x, spot.y);
  const card = page.locator("#pz-card");
  await expect(card).toBeVisible();
  await expect(card).toContainText("Rin");
  await expect(card).toContainText("Lv 7");
  await expect(card).toContainText("Storm Chaser");
  await snap(page, info, "plaza-player-card");
  // Add friend goes to the friends API; Invite goes to the party server.
  await page.evaluate(() => {
    const w = window as any,
      fetch = window.fetch.bind(window);
    w.__asked = [];
    window.fetch = async (input, init) => {
      if (String(input).includes("/api/friends/request")) {
        w.__asked.push(JSON.parse(String(init?.body)));
        return Response.json({ result: "sent" });
      }
      return fetch(input, init);
    };
    const reply = w.__reply;
    w.__reply = (ev: string, data: any) => {
      if (ev === "party-invite") {
        w.__asked.push({ ev, ...data });
        return { ok: true };
      }
      return reply(ev, data);
    };
  });
  await card.locator('[data-pc="friend"]').click();
  await expect(page.locator("#toast")).toContainText("Friend request sent");
  await card.locator('[data-pc="party"]').click();
  await expect(page.locator("#toast")).toContainText("Party invitation sent");
  expect(await page.evaluate(() => (window as any).__asked)).toEqual([
    { playerId: "acct-other" },
    expect.objectContaining({ ev: "party-invite", playerId: "acct-other" }),
  ]);
  await card.locator('[data-pc="close"]').click();
  await expect(card).toBeHidden();
  expect(errors).toEqual([]);
});

test("block a player from their card: asked first, gone from the Plaza, unblocked under Friends", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 844, height: 390 });
  const errors = await openPlaza(page);
  await page.evaluate(() => {
    const w = window as any,
      me = w.__plazaWorld.bodyOf("local");
    w.__plazaWorld.join("other", "acct-other", {
      name: "Rin",
      title: null,
      titleColor: null,
      level: 7,
      character: "tidefin",
      skin: null,
    });
    Object.assign(w.__plazaWorld.bodyOf("other"), { x: me.x + 90, y: me.y });
    // Blocking, answered as migration 110 does.
    w.__blocks = [];
    w.__blockCalls = [];
    const fetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const path = new URL(String(input), location.href).pathname;
      if (path === "/api/blocks") {
        if (init?.method === "POST") {
          const body = JSON.parse(String(init.body));
          w.__blockCalls.push(body);
          w.__blocks = body.block
            ? [{ id: body.playerId, name: "Rin" }]
            : w.__blocks.filter((b: any) => b.id !== body.playerId);
          return Response.json({ ok: true });
        }
        return Response.json(w.__blocks);
      }
      return fetch(input, init);
    };
  });
  const rinShown = () =>
    page.evaluate(() =>
      [...(window as any).__plaza.others.values()].some(
        (b: any) => b.name === "Rin",
      ),
    );
  await expect.poll(rinShown, { timeout: 15_000 }).toBe(true);
  const spot = await page.evaluate(() => {
    const p = (window as any).__plaza,
      rin = [...p.others.values()].find((b: any) => b.name === "Rin");
    return p.worldClient(rin.tx, rin.ty - 30);
  });
  await page.mouse.click(spot.x, spot.y);
  const card = page.locator("#pz-card");
  await expect(card.locator('[data-pc="block"]')).toBeVisible();
  await expect(card.locator('[data-pc="report"]')).toBeVisible();
  await snap(page, info, "plaza-player-card-block-844x390");
  // Block asks first; Cancel changes nothing.
  await card.locator('[data-pc="block"]').click();
  const confirm = page.locator("[data-ui-confirm] .ui-modal");
  await expect(confirm).toContainText("Block Rin?");
  await confirm.locator("[data-ui-cancel]").click();
  expect(await page.evaluate(() => (window as any).__blockCalls)).toEqual([]);
  await card.locator('[data-pc="block"]').click();
  await page.locator("[data-ui-confirm] [data-ui-confirm-ok]").click();
  await expect(page.locator("#toast")).toContainText("Rin is blocked.");
  await expect(card).toBeHidden();
  await expect.poll(rinShown, { timeout: 15_000 }).toBe(false);
  expect(await page.evaluate(() => (window as any).__blockCalls)).toEqual([
    { playerId: "acct-other", block: true },
  ]);
  // Unblock under Friends → Recent.
  await page.click('#hub-scenes [data-hub-scene="lobby"]');
  await page.click('.lobby-rail [data-lobby-action="friends"]');
  const sheet = page.locator(".friends-sheet");
  await expect(sheet).toBeVisible();
  await sheet.locator('[data-ui-friends-tab="recent"]').click();
  await expect(sheet.locator(".fr-blocked")).toContainText("Rin");
  await snap(page, info, "friends-blocked-844x390");
  await sheet.locator('[data-friend-unblock="acct-other"]').click();
  await expect(sheet.locator(".fr-status")).toHaveText("Unblocked.");
  await expect(sheet.locator(".fr-blocked")).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__blocks)).toEqual([]);
  expect(errors).toEqual([]);
});

// Gift boxes (PLAZA_GIFT): tossed ahead, a box flies, lands and bursts
// open (confetti, its lid, a shockwave); its orbs are for everyone else
// nearby, and each one caught counts as an orb. The thrower can't catch
// their own.
test("a gift box flies, bursts open, and its orbs are for the others", async ({
  page,
}, info) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 844, height: 390 });
  const errors = await openPlaza(page);
  const list = () =>
    page.evaluate(() => (window as any).__plaza.gifts() as any[]);
  // The count is today's progress (the database's): 3 to start.
  await expect(page.locator("#pz-treats")).toHaveText("3");
  await expect(page.locator("#pz-treat")).toHaveAttribute(
    "aria-label",
    "Toss a gift box (T)",
  );
  // A fixed spot south of the fountain (the spawn is random).
  await teleport(page, PLAZA_FOUNTAIN.x, PLAZA_FOUNTAIN.y + 300);
  await page.click("#pz-treat");
  await expect(page.locator("#toast")).toContainText("Gift box tossed!");
  await expect(page.locator("#pz-treats")).toHaveText("2");
  // In the air first, then landed and open.
  await expect.poll(async () => (await list()).length).toBe(1);
  const flying = (await list())[0];
  expect(flying.opened).toBe(false);
  await snap(page, info, "plaza-gift-flying");
  await expect.poll(async () => (await list())[0]?.opened).toBe(true);
  // The burst: confetti in the air, the box's orbs out.
  expect(
    await page.evaluate(() => (window as any).__plaza.confetti()),
  ).toBeGreaterThan(10);
  await snap(page, info, "plaza-gift-open");
  const mine = (await list())[0];
  expect(mine.orbs.length).toBe(4);
  // Your own box's orbs aren't for you: standing on one catches nothing.
  const [, ox, oy] = mine.orbs[0];
  await teleport(page, ox, oy);
  await page.waitForTimeout(1200);
  expect((await list())[0].orbs.length).toBe(4);
  // Someone else's box: walk onto an orb and it's yours, counted as an orb.
  // (Out of reach of where it lands, so none is caught before we look.)
  await teleport(page, PLAZA_FOUNTAIN.x + 420, PLAZA_FOUNTAIN.y + 300);
  await page.evaluate(
    ([x, y]) => (window as any).__plazaOtherGift(x, y),
    [PLAZA_FOUNTAIN.x - 10, PLAZA_FOUNTAIN.y + 300],
  );
  await expect
    .poll(async () => (await list()).find((g) => g.id !== mine.id)?.opened)
    .toBe(true);
  const theirs = (await list()).find((g) => g.id !== mine.id)!;
  expect(theirs.orbs.length).toBe(PLAZA_GIFT.orbs);
  const [, tx, ty] = theirs.orbs[0];
  await teleport(page, tx, ty);
  // Caught (that one, and any other within reach), each counted as an orb.
  const left = async () =>
    (await list()).find((g) => g.id === theirs.id)?.orbs.length ?? 0;
  await expect.poll(left).toBeLessThan(theirs.orbs.length);
  await expect
    .poll(async () => {
      const refs = await page.evaluate(
        () => ((window as any).__plazaOrbRefs ?? []).length,
      );
      return refs - (PLAZA_GIFT.orbs - (await left()));
    })
    .toBe(0);
  // A golden box: T tosses it, once the cooldown has passed.
  await page.waitForTimeout(1600);
  await page.evaluate(() => ((window as any).__plazaGolden = true));
  await page.locator(".plaza-layer").focus();
  await page.keyboard.press("t");
  await expect(page.locator("#toast")).toContainText("golden gift box");
  await expect(page.locator("#pz-treats")).toHaveText("1");
  await expect
    .poll(async () => (await list()).find((g) => g.golden)?.opened)
    .toBe(true);
  expect((await list()).find((g) => g.golden)!.orbs.length).toBe(8);
  await snap(page, info, "plaza-gift-golden");
  // None left: the button dims and says where more come from.
  await page.evaluate(() => ((window as any).__plazaGifts = 0));
  await page.waitForTimeout(1600);
  await page.click("#pz-treat");
  await expect(page.locator("#toast")).toContainText("No gift boxes left");
  await expect(page.locator("#pz-treats")).toHaveText("0");
  await expect(page.locator("#pz-treat")).toHaveClass(/empty/);
  expect(await page.evaluate(() => (window as any).__plazaGiftsThrown)).toEqual(
    [false, true],
  );
  expect(errors).toEqual([]);
});

test("townsfolk keep a quiet Plaza lively, marked as bots, with no card", async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  const errors = await openPlaza(page);
  // Stand at the top of the square: the runway, the dance spot and the café.
  await page.evaluate(() => (window as any).__plazaPosition(1350, 760));
  const folk = () =>
    page.evaluate(() =>
      [...(window as any).__plaza.others.values()]
        .filter((b: any) => b.bot)
        .map((b: any) => b.name),
    );
  await expect
    .poll(folk, { timeout: 20_000 })
    .toEqual(
      expect.arrayContaining(["Dancer", "Runway Model", "Café Regular"]),
    );
  // They are bots to the client too, and the Plaza counts only you.
  const world = await page.evaluate(() => {
    const w = (window as any).__plazaWorld;
    return {
      population: w.population(1),
      folk: w.copies.get(1).folk.map((f: any) => f.profile.bot),
    };
  });
  expect(world.population).toBe(1);
  expect(world.folk.length).toBeGreaterThanOrEqual(8);
  expect(world.folk.every(Boolean)).toBe(true);
  // Tapping one opens no player card (no Add friend for an NPC). Stand
  // below the dancer, so they're mid-screen and not under the top bar.
  await page.evaluate(() => (window as any).__plazaPosition(1480, 840));
  // The page takes the server's move a moment later (up to ~4 s here), then
  // its camera eases over, slowly on a CPU renderer and sometimes pausing a
  // second mid-way; it settles with the dancer at y ≈ 270. A fixed wait
  // raced that (y 135-146 read mid-ease): wait for the view instead.
  const dancerSpot = () =>
    page.evaluate(() => {
      const p = (window as any).__plaza,
        dancer = [...p.others.values()].find((b: any) => b.name === "Dancer");
      return p.worldClient(dancer.x, dancer.y - 30) as { x: number; y: number };
    });
  await expect
    .poll(async () => (await dancerSpot()).y, { timeout: 30_000 })
    .toBeGreaterThan(150);
  // Then still (two reads half a second apart), so the tap lands on them.
  let prev = await dancerSpot();
  await expect
    .poll(
      async () => {
        const now = await dancerSpot();
        const moved = Math.abs(now.y - prev.y);
        prev = now;
        return moved;
      },
      { timeout: 30_000, intervals: [500] },
    )
    .toBeLessThanOrEqual(1);
  const spot = prev;
  expect(spot.y).toBeGreaterThan(150);
  expect(spot.y).toBeLessThan(700);
  expect(
    await page.evaluate(
      ([x, y]) => document.elementFromPoint(x, y)?.id,
      [spot.x, spot.y],
    ),
  ).toBe("pz-cv");
  await page.mouse.click(spot.x, spot.y);
  await page.waitForTimeout(300);
  await expect(page.locator("#pz-card")).toBeHidden();
  await expect(page.locator(".plaza-layer #pz-cv")).toBeVisible();
  await snap(page, info, "plaza-townsfolk");
  expect(errors).toEqual([]);
});

test("Jump and Dash work while the other thumb holds the joystick", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    const errors = await openPlaza(page);
    const centre = (s: string) =>
      page.locator(s).evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
    const joy = await centre("#pz-joy"),
      jumpAt = await centre("#pz-jump"),
      dashAt = await centre("#pz-dash");
    // What the server did, sampled in the page (this machine is too slow to
    // catch a 0.65 s jump from the test runner).
    await page.evaluate(() => {
      const w = window as any;
      w.__peak = { air: 0, dash: 0 };
      setInterval(() => {
        const b = w.__plazaWorld.bodyOf("local");
        if (b.air > 0) w.__peak.air++;
        if (b.dash > 0) w.__peak.dash++;
      }, 10);
    });
    const peak = () => page.evaluate(() => ({ ...(window as any).__peak }));
    const cdp = await context.newCDPSession(page);
    const touch = (
      type: "touchStart" | "touchMove" | "touchEnd",
      points: { x: number; y: number; id: number }[],
    ) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points });
    const thumb = { x: joy.x, y: joy.y, id: 1 };
    // The left thumb holds the joystick to the right: you walk.
    await touch("touchStart", [thumb]);
    await touch("touchMove", [{ ...thumb, x: joy.x + 45 }]);
    const me = () =>
      page.evaluate(() => {
        const b = (window as any).__plazaWorld.bodyOf("local");
        return { x: b.x };
      });
    const before = await me();
    await expect
      .poll(async () => (await me()).x, { timeout: 5000 })
      .toBeGreaterThan(before.x + 20);
    // The right thumb taps Jump while still walking: you jump.
    const held = { ...thumb, x: joy.x + 45 };
    await touch("touchStart", [held, { ...jumpAt, id: 2 }]);
    await touch("touchEnd", [held]);
    await expect
      .poll(async () => (await peak()).air, { timeout: 3000 })
      .toBeGreaterThan(0);
    await page.waitForTimeout(900);
    // …and taps Dash: you dash.
    await touch("touchStart", [held, { ...dashAt, id: 3 }]);
    await touch("touchEnd", [held]);
    await expect
      .poll(async () => (await peak()).dash, { timeout: 3000 })
      .toBeGreaterThan(0);
    await touch("touchEnd", []);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

// A running jump was jittery: the idle bob's phase was the body's x, which
// moves ~4 px a frame while running, so in the air the body shook ±1.2 px
// every frame (owner, 23 Nov). In the air there is no bob now: the jump's
// arc carries the body, and the walk bob eases out at take-off.
/**
 * Run east on the pitch and take off mid-run: the same jump as Space
 * (plazaJump's fields) but 1.5 s long, so a CI runner drawing the Plaza at a
 * few frames a second still draws some of it. (Running onto a bounce pad
 * missed it on CI: the teleport hadn't reached the browser's copy of you
 * yet.) Each frame in the air after `skipMs` (the walk bob easing out), the
 * bob the game drew you with, and whether it drew you that frame at all
 * (bodyPose stamps `bobT` with the frame's time) and you were in the view:
 * a body not drawn keeps its last bob, so its "bob" says nothing.
 */
async function runningJump(page: Page, skipMs: number, airDur = 1.5) {
  await teleport(page, 2060, 760);
  await page.waitForTimeout(500);
  await page.locator(".plaza-layer").focus();
  await page.keyboard.down("d");
  await expect
    .poll(() => page.evaluate(() => (window as any).__plaza.P.sp), {
      timeout: 20_000,
    })
    .toBeGreaterThan(100);
  const { frames, end } = await page.evaluate(
    ([skipMs, airDur]) =>
      new Promise<{
        frames: { bob: number; drawn: boolean; seen: boolean }[];
        end: string;
      }>((done) => {
        const d = (window as any).__plaza,
          P = d.P,
          out: { bob: number; drawn: boolean; seen: boolean }[] = [],
          t0 = performance.now();
        // Who ends the jump, for the report when no frame was judged.
        let air = P.air,
          ended = "";
        Object.defineProperty(P, "air", {
          configurable: true,
          enumerable: true,
          get: () => air,
          set: (v: number) => {
            if (air && !v && !ended)
              ended = `at ${Math.round(performance.now() - t0)} ms, air ${air.toFixed(2)} s: ${new Error().stack?.split("\n").slice(2, 4).join(" <")}`;
            air = v;
          },
        });
        const finish = () => {
          Object.defineProperty(P, "air", {
            configurable: true,
            enumerable: true,
            writable: true,
            value: air,
          });
          done({
            frames: out,
            end: `${ended || "still in the air"}; x ${Math.round(P.x)} y ${Math.round(P.y)} stun ${P.stun}`,
          });
        };
        P.air = 1e-4;
        P.airDur = airDur;
        P.airH = 42;
        const loop = (now: number) => {
          if (!P.air || now - t0 > 8000) return finish();
          if (now - t0 > skipMs) {
            const v = d.view();
            out.push({
              bob: P.bob || 0,
              drawn: P.bobT === now / 1000,
              seen: P.x > v.x0 && P.x < v.x1 && P.y > v.y0 && P.y < v.y1,
            });
          }
          requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
      }),
    [skipMs, airDur],
  );
  await page.keyboard.up("d");
  if (!frames.length) console.log(`no frame judged: the jump ended ${end}`);
  return frames;
}

test("a running jump doesn't shake: no bob in the air", async ({ page }) => {
  test.setTimeout(90_000);
  const errors = await openPlaza(page);
  const frames = await runningJump(page, 250);
  expect(frames.length).toBeGreaterThan(0);
  expect(frames.filter((f) => !f.drawn || !f.seen)).toEqual([]);
  expect(Math.max(...frames.map((f) => Math.abs(f.bob)))).toBeLessThan(0.5);
  expect(errors).toEqual([]);
});

// At a few frames a second (a starved phone, or CI's software renderer,
// which went 2 s without a frame) the camera followed by the frame, not by
// the time that passed: after the teleport and the server's correction you
// ran off the screen and stayed there for seconds, undrawn, and the jump
// test read the bob from before take-off (3.99 on CI, 23 Nov). Here frames
// come every 1.5 s, whatever the machine, and you stay in view.
test("at a frame every 1.5 s the camera keeps you on the screen", async ({
  page,
}) => {
  test.setTimeout(120_000);
  // Animation frames held to one every 1.5 s once __slowFrames is set; timers
  // (the Plaza server in the page) run as usual, as on a starved renderer.
  await page.addInitScript(() => {
    const w = window as any,
      raf = window.requestAnimationFrame.bind(window);
    let queue: FrameRequestCallback[] = [],
      next = 0;
    window.requestAnimationFrame = (cb) => {
      if (!w.__slowFrames) return raf(cb);
      queue.push(cb);
      return 0;
    };
    setInterval(() => {
      if (!w.__slowFrames || !queue.length || performance.now() < next) return;
      next = performance.now() + 1500;
      const due = queue;
      queue = [];
      raf((t) => due.forEach((cb) => cb(t)));
    }, 5);
  });
  const errors = await openPlaza(page);
  await page.evaluate(() => ((window as any).__slowFrames = true));
  // 1.5 s a frame eases the walk bob out at once: judge every frame. A
  // frame moves you at most 1 s (plaza-scene.ts, moveDt), so a 1.5 s jump
  // lasted two frames and was judged on one; on CI it was sometimes judged
  // on none (#398 and #399, 24 Nov), when the game took both steps before
  // the test's first frame. A 4 s jump spans four frames (three judged
  // locally); if none is judged again, the log says what ended the jump.
  const frames = await runningJump(page, 0, 4);
  expect(frames.length).toBeGreaterThan(0);
  expect(frames.filter((f) => !f.drawn || !f.seen)).toEqual([]);
  expect(Math.max(...frames.map((f) => Math.abs(f.bob)))).toBeLessThan(0.5);
  expect(errors).toEqual([]);
});

// Bodies keep out of the fountain's basin (PLAZA_OBSTACLES), and so do
// the square's animals: they used to check only where a walk ended, so the
// corgi and the pigeons walked straight through the basin (owner, 22 Nov).
test("the corgi walks round the fountain, not through its basin", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors = await openPlaza(page);
  const F = PLAZA_FOUNTAIN;
  const inBasin = (x: number, y: number) =>
    ((x - F.x) / F.rx) ** 2 +
      ((y - (F.y + F.wall / 2)) / (F.ry + F.wall / 2)) ** 2 <
    1;
  // West of the basin, sent east: the straight line crosses it.
  await page.evaluate(
    ([x, y, tx, ty]) => (window as any).__plaza.sendPet(x, y, tx, ty),
    [F.x - F.rx - 40, F.y + 10, F.x + F.rx + 40, F.y + 10],
  );
  const seen: { x: number; y: number }[] = [];
  for (let i = 0; i < 25; i++) {
    const a = await page.evaluate(() => (window as any).__plaza.animals());
    seen.push(a.pet);
    for (const b of a.pigeons)
      if (!b.fly)
        expect(inBasin(b.x, b.y), `pigeon at ${b.x},${b.y}`).toBe(false);
    await page.waitForTimeout(120);
  }
  expect(seen.filter((p) => inBasin(p.x, p.y))).toEqual([]);
  expect(errors).toEqual([]);
});

test("the dash track's lane is whole (no wedge cut out of it)", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors = await openPlaza(page);
  // The painted ground where a wedge of the lane used to be missing: just
  // below the track's east end, near its inner edge. The rest of the lane
  // (above the east end) for comparison.
  const lane = (angles: number[], k: number) =>
    page.evaluate(
      ([angles, k]) => {
        const p = (window as any).__plaza,
          T = { cx: 540, cy: 930, ro: [400, 290], ri: [262, 168] };
        return (angles as number[]).map((a) =>
          p.groundAt(
            T.cx +
              Math.cos(a) * (T.ri[0] + (T.ro[0] - T.ri[0]) * (k as number)),
            T.cy +
              Math.sin(a) * (T.ri[1] + (T.ro[1] - T.ri[1]) * (k as number)),
          ),
        );
      },
      [angles, k] as const,
    );
  const isLane = ([r, g, b]: number[]) => r > 150 && r > g + 50 && r > b + 50;
  const wedge = [
    ...(await lane([0.02, 0.1, 0.18, 0.26, 0.34, 0.42], 0.1)),
    ...(await lane([0.02, 0.1, 0.18], 0.2)),
  ];
  const elsewhere = await lane([-0.1, -0.2, -0.3], 0.1);
  expect(elsewhere.every(isLane)).toBe(true);
  expect(wedge.filter((c) => !isLane(c))).toEqual([]);
  expect(errors).toEqual([]);
});

// Long things are drawn in depth order by their footprints
// (plaza-depth.ts): a runner just behind a hurdle laid at a slant across the
// lane is drawn under it, just in front of it over it. (Sorting by one
// number each drew the hurdles under everyone.)
test("a runner behind a hurdle is under it, in front of it over it", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors = await openPlaza(page);
  const [p0, p1] = PLAZA_HURDLE_SEGMENTS[0];
  const mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
  const placeOf = async (dy: number) => {
    await teleport(page, mid.x, mid.y + dy);
    await expect
      .poll(() =>
        page.evaluate(
          ([x, y]) => {
            const P = (window as any).__plaza.P;
            return Math.hypot(P.x - x, P.y - y);
          },
          [mid.x, mid.y + dy],
        ),
      )
      .toBeLessThan(4);
    await page.waitForTimeout(300);
    return page.evaluate(() => {
      const o: string[] = (window as any).__plaza.drawOrder();
      return o.indexOf("me") - o.indexOf("hurdle-0");
    });
  };
  await page.evaluate(() => (window as any).__plaza.drawOrder());
  expect(await placeOf(-14), "behind: drawn first").toBeLessThan(0);
  expect(await placeOf(14), "in front: drawn last").toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

// The lap gantry spans the lane along the view's depth, so in this
// front-and-above view its beam, posts and sign stack into one column.
// Drawn part by part in depth order, the beam's near slices and the near
// post striped a runner on the line (name tag included) and the sign
// itself. Now the gantry is one picture standing at the lane's far edge:
// a runner anywhere on the line is drawn over all of it, one beyond the
// far edge under it. Phone landscape, as on the owner's iPhone.
test("a runner on the start line is drawn over the whole gantry", async ({
  browser,
}, info) => {
  test.setTimeout(120_000);
  const ctx = await browser.newContext({
    viewport: { width: 956, height: 440 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await ctx.newPage();
    const errors = await openPlaza(page);
    const T = PLAZA_TRACK,
      x = T.cx,
      ya = T.cy - T.ro[1],
      yb = T.cy - T.ri[1];
    // Where "me" and each part of the gantry come in the drawing order
    // (earlier is under).
    const placeAt = async (y: number) => {
      await teleport(page, x, y);
      await expect
        .poll(() =>
          page.evaluate(
            ([x, y]) => {
              const P = (window as any).__plaza.P;
              return Math.hypot(P.x - x, P.y - y);
            },
            [x, y],
          ),
        )
        .toBeLessThan(4);
      await page.waitForTimeout(300);
      return page.evaluate(() => {
        const o: string[] = (window as any).__plaza.drawOrder();
        const me = o.indexOf("me");
        const parts = o.flatMap((n, i) => (n.startsWith("gantry") ? [i] : []));
        return { me, parts };
      });
    };
    await page.evaluate(() => (window as any).__plaza.drawOrder());
    for (const [k, y] of [
      ["far edge", ya + 10],
      ["middle", (ya + yb) / 2],
      ["near edge", yb - 10],
    ] as const) {
      const { me, parts } = await placeAt(y);
      await snap(page, info, `plaza-gantry-${k.replace(" ", "-")}`);
      expect(me, k).toBeGreaterThanOrEqual(0);
      expect(parts.length, k).toBeGreaterThan(0);
      expect
        .soft(
          parts.filter((i) => i > me).length,
          `on the line (${k}): no part of the gantry over the runner`,
        )
        .toBe(0);
    }
    // Beyond the far edge, on the grass: the gantry stands in front.
    const behind = await placeAt(ya - 30);
    await snap(page, info, "plaza-gantry-beyond");
    expect(
      behind.parts.filter((i) => i < behind.me).length,
      "beyond the far edge: the whole gantry over the runner",
    ).toBe(0);
    expect(errors).toEqual([]);
  } finally {
    await ctx.close();
  }
});

// A click on the ground (desktop) shows where you're going, as in MOBAs:
// a ring closing in with chevrons, then a small ring on the spot until you
// get there.
test("a click on the ground marks where you're going until you arrive", async ({
  page,
}, info) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await openPlaza(page);
  await teleport(page, 1350, 1090);
  await page.waitForTimeout(800);
  const spot = await page.evaluate(() =>
    (window as any).__plaza.worldClient(1640, 1130),
  );
  // The longest gap between drawn frames while you walk (see below).
  await page.evaluate(() => {
    const w = window as any;
    w.__walkGap = 0;
    let last = performance.now();
    const t = (now: number) => {
      w.__walkGap = Math.max(w.__walkGap, now - last);
      last = now;
      if (w.__walkGap >= 0) requestAnimationFrame(t);
    };
    requestAnimationFrame(t);
  });
  await page.mouse.click(spot.x, spot.y);
  const mark = await page.evaluate(() => (window as any).__plaza.clickMark());
  expect(mark?.ok).toBe(true);
  expect(Math.hypot(mark.x - 1640, mark.y - 1130)).toBeLessThan(30);
  await page.waitForTimeout(150);
  await snap(page, info, "plaza-click-mark");
  // Gone once you're there.
  await expect
    .poll(() => page.evaluate(() => (window as any).__plaza.clickMark()), {
      timeout: 20_000,
    })
    .toBeNull();
  const { P, gap } = await page.evaluate(() => {
    const w = window as any,
      p = w.__plaza.P,
      gap = w.__walkGap / 1000;
    w.__walkGap = -1;
    return { P: { x: p.x, y: p.y }, gap };
  });
  // (Near it: on a busy machine the in-page server runs ahead of the
  // drawn frames and you settle where it stopped you, a step or two on:
  // you stop on the frame after you arrive, so the server walks on at
  // PLAZA.speed, 240 px/s, for up to the longest frame gap. CI's runner
  // stopped 151-187 px on, PR #237, 19 Nov: gaps of half a second or more.)
  const near = Math.max(80, 40 + 240 * gap);
  expect(
    Math.hypot(P.x - 1640, P.y - 1130),
    `distance from the spot (longest frame gap ${Math.round(gap * 1000)} ms)`,
  ).toBeLessThan(near);
  expect(errors).toEqual([]);
});

// Zoom: the mouse wheel and + / − on a desktop, two fingers on a tablet;
// within limits (never past what is built or what the server shows), and
// kept for the next visit. Phones keep the usual zoom (0.8): a pinch there
// does nothing, and a zoom kept from before is not used.
test("the Plaza zooms with the wheel, the keys and a pinch", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const zoomOf = (page: Page) =>
    page.evaluate(() => (window as any).__plaza.view().z as number);
  // Desktop: the wheel and the keys.
  {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    try {
      const page = await ctx.newPage();
      const errors = await openPlaza(page);
      await page.evaluate(() => localStorage.removeItem("ea-plaza-zoom"));
      await page.evaluate(() => (window as any).__plaza.setZoom(1));
      expect(await zoomOf(page)).toBeCloseTo(1, 3);
      await page.mouse.move(640, 400);
      for (let i = 0; i < 6; i++) await page.mouse.wheel(0, -120);
      await expect.poll(() => zoomOf(page)).toBeGreaterThan(1.3);
      // Past the limit, it stops there.
      for (let i = 0; i < 20; i++) await page.mouse.wheel(0, -120);
      await expect.poll(() => zoomOf(page)).toBeCloseTo(1.5, 3);
      await page.locator(".plaza-layer").focus();
      for (let i = 0; i < 20; i++) await page.keyboard.press("-");
      const range = await page.evaluate(() =>
        (window as any).__plaza.zoomRange(),
      );
      expect(await zoomOf(page)).toBeCloseTo(range.min, 3);
      const v = await page.evaluate(() => (window as any).__plaza.view());
      expect(v.x1 - v.x0).toBeLessThanOrEqual(1500 + 0.5);
      // Kept on this device.
      expect(
        Number(
          await page.evaluate(() => localStorage.getItem("ea-plaza-zoom")),
        ),
      ).toBeCloseTo(range.min / range.base, 3);
      expect(errors).toEqual([]);
    } finally {
      await ctx.close();
    }
  }
  /** Two fingers on the playground, spreading twice as far apart. */
  const pinch = (page: Page) =>
    page.evaluate(() => {
      const cv = document.querySelector("#pz-cv")!;
      const at = (type: string, id: number, x: number) =>
        cv.dispatchEvent(
          new PointerEvent(type, {
            pointerId: id,
            pointerType: "touch",
            clientX: x,
            clientY: 200,
            bubbles: true,
          }),
        );
      at("pointerdown", 11, 500);
      at("pointerdown", 12, 600);
      at("pointermove", 11, 450);
      at("pointermove", 12, 650);
      at("pointerup", 11, 450);
      at("pointerup", 12, 650);
    });
  // Phone: the usual zoom, whatever was kept, and a pinch changes nothing.
  {
    const ctx = await browser.newContext({
      viewport: { width: 844, height: 390 },
      isMobile: true,
      hasTouch: true,
    });
    try {
      const page = await ctx.newPage();
      await page.addInitScript(() =>
        localStorage.setItem("ea-plaza-zoom", "1.6"),
      );
      const errors = await openPlaza(page);
      expect(await zoomOf(page)).toBeCloseTo(0.8, 3);
      await pinch(page);
      await page.mouse.wheel(0, -600);
      expect(await zoomOf(page)).toBeCloseTo(0.8, 3);
      expect(errors).toEqual([]);
    } finally {
      await ctx.close();
    }
  }
  // Tablet (an iPad mini on its side): a pinch zooms.
  {
    const ctx = await browser.newContext({
      viewport: { width: 1133, height: 744 },
      isMobile: true,
      hasTouch: true,
    });
    try {
      const page = await ctx.newPage();
      const errors = await openPlaza(page);
      await page.evaluate(() => (window as any).__plaza.setZoom(1));
      const r = await page.evaluate(() => (window as any).__plaza.zoomRange());
      expect(await zoomOf(page)).toBeCloseTo(r.base, 3);
      await pinch(page);
      // Fingers twice as far apart: twice the zoom, as far as it goes.
      expect(await zoomOf(page)).toBeCloseTo(Math.min(r.max, r.base * 2), 3);
      expect(errors).toEqual([]);
    } finally {
      await ctx.close();
    }
  }
});

// The world goes on past the Plaza's edge (plaza-surround*.ts): standing by
// the north railing, the camera looks out over the river, whose water moves.
test("past the north edge, the river flows", async ({ page }, info) => {
  test.setTimeout(90_000);
  const errors = await openPlaza(page);
  await teleport(page, 700, 120);
  await expect
    .poll(() => page.evaluate(() => (window as any).__plaza.view().y0), {
      timeout: 20_000,
    })
    .toBeLessThan(-150);
  const water = () =>
    page.evaluate(() => {
      const p = (window as any).__plaza,
        cv = document.querySelector("#pz-cv") as HTMLCanvasElement,
        r = cv.getBoundingClientRect(),
        g = cv.getContext("2d")!;
      const px = (x: number, y: number) => {
        const c = p.worldClient(x, y);
        return [
          ...g.getImageData(
            Math.round(((c.x - r.left) / r.width) * cv.width),
            Math.round(((c.y - r.top) / r.height) * cv.height),
            1,
            1,
          ).data,
        ];
      };
      const out: number[][] = [];
      // Across the river's rows of ripples, west of the first footbridge.
      for (let y = -125; y < -15; y += 10)
        for (let x = 520; x < 880; x += 24) out.push(px(x, y));
      return out;
    });
  // One meadow: the Plaza's ground picture goes on past its edges (no
  // second picture meeting it at a seam), with a hole where the river is.
  const ground = (x: number, y: number) =>
    page.evaluate(([x, y]) => (window as any).__plaza.groundAt(x, y), [x, y]);
  for (const [x, y] of [
    [-40, 800],
    [2740, 800],
    [1700, 1740],
    [600, -200],
  ]) {
    const [r, g, , alpha] = await ground(x, y);
    expect(alpha, `meadow at ${x},${y}`).toBe(255);
    expect(g, `grass at ${x},${y}`).toBeGreaterThan(r);
  }
  expect((await ground(700, -60))[3], "the river's hole").toBe(0);
  const a = await water();
  // Water: bluer than it is red.
  expect(a.filter(([r, , b]) => b > r + 40).length).toBeGreaterThan(
    a.length * 0.6,
  );
  // Ripples drift: the same stretch of water is not the same a moment later.
  const first = a.map((c) => c.join());
  await expect
    .poll(async () => (await water()).some((c, i) => c.join() !== first[i]), {
      timeout: 10_000,
    })
    .toBe(true);
  await snap(page, info, "plaza-river");
  expect(errors).toEqual([]);
});

// Arriving during an Orb Shower (the first minute of every quarter hour on
// the UTC clock), the event pill shows its countdown: it used to stay
// hidden until the next shower, since only the "starts in" state unhid it.
test("the event pill shows when you arrive mid-shower", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-04T05:15:20Z") });
  const errors = await openPlaza(page);
  await page.clock.runFor(1500);
  await expect(page.locator("#pz-event")).toBeVisible();
  await expect(page.locator("#pz-event")).toContainText("left");
  expect(errors).toEqual([]);
});

// Phones: the emote wheel ran up over the coins, the gear and the clock on
// a 360px-tall screen, and the toast sat on the action button that grows
// left of Dash and Jump by the Volt Boba. The wheel (Q) opens over you,
// under the header; the toast rises over the Dash and Jump row.
test("on a short phone the emote wheel and a toast keep clear of the HUD", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 740, height: 360 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    const errors = await openPlaza(page);
    const rect = (s: string) =>
      page.evaluate((s) => {
        const r = document.querySelector(s)!.getBoundingClientRect();
        return { l: r.left, t: r.top, r: r.right, b: r.bottom };
      }, s);
    const clear = (
      a: { l: number; t: number; r: number; b: number },
      b: typeof a,
    ) => a.r <= b.l + 1 || b.r <= a.l + 1 || a.b <= b.t + 1 || b.b <= a.t + 1;
    // The wheel is a keyboard's (Q): on touch, emotes are the Chat
    // button's quick chips (its own HUD button went, owner 22 Nov).
    await expect(page.locator("#pz-wheel-btn")).toHaveCount(0);
    await page.locator(".plaza-layer").focus();
    await page.keyboard.press("q");
    await expect(page.locator("#pz-wheel")).toBeVisible();
    // Full size: once its pop-in (from 0.6) has finished.
    await page
      .locator("#pz-wheel")
      .evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    const wheel = await rect("#pz-wheel");
    for (const s of [
      "#account-coins > *",
      ".header-menu > summary",
      "#pz-clock",
      ".pz-left",
      ".pz-actions",
    ])
      expect(clear(wheel, await rect(s)), `wheel clear of ${s}`).toBe(true);
    expect(wheel.t, "wheel under the header").toBeGreaterThanOrEqual(
      (await rect("#account-profile")).b,
    );
    await page.keyboard.press("q");
    await expect(page.locator("#pz-wheel")).toBeHidden();
    await page.evaluate(() => (window as any).__plazaPosition(1745, 520));
    await expect(page.locator("#pz-interact")).toBeVisible({ timeout: 10_000 });
    await page.evaluate(() => {
      const t = document.getElementById("toast")!;
      t.textContent = "Volt Boba: 30% faster for 30 seconds";
      t.classList.add("show");
    });
    // Where it rests once it has slid in. A fixed 600 ms wasn't always
    // enough: the CPU-drawn test browser can hold frames back for longer,
    // and the toast was measured before its slide had started.
    await page
      .locator("#toast")
      .evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    const toast = await rect("#toast");
    expect(clear(toast, await rect(".pz-actions")), "toast clear").toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

// The emote wheel opens with Q (its HUD button went: on touch, emotes are
// the Chat button's quick chips) and Q closes it. A tap on the Plaza with
// the wheel or a player's card open only closes it: you don't walk there.
test("Q opens and closes the emote wheel, and a tap on the Plaza only closes it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await openPlaza(page);
  const wheel = page.locator("#pz-wheel");
  await expect(page.locator("#pz-wheel-btn")).toHaveCount(0);
  await page.locator(".plaza-layer").focus();
  await page.keyboard.press("q");
  await expect(wheel).toBeVisible();
  await page.keyboard.press("q");
  await expect(wheel).toBeHidden();

  // Open ground east of you (where the walking test goes), on the canvas.
  const local = () =>
    page.evaluate(() => {
      const b = (window as any).__plazaWorld.bodyOf("local");
      return { x: b.x, y: b.y };
    });
  const start = await local();
  const spot = await page.evaluate(
    ([x, y]) => {
      const p = (window as any).__plaza.worldClient(x, y);
      return { ...p, hit: document.elementFromPoint(p.x, p.y)?.id };
    },
    [start.x + 160, start.y],
  );
  expect(spot.hit).toBe("pz-cv");
  await page.keyboard.press("q");
  await expect(wheel).toBeVisible();
  await page.mouse.click(spot.x, spot.y);
  await expect(wheel).toBeHidden();
  await page.waitForTimeout(1200);
  expect(await local(), "the tap that closed the wheel walked you").toEqual(
    start,
  );
  // The next tap walks there, as always.
  await page.mouse.click(spot.x, spot.y);
  await expect
    .poll(async () => (await local()).x, { timeout: 15_000 })
    .toBeGreaterThan(start.x + 40);

  // A button closes the wheel and does its own thing.
  await page.locator(".plaza-layer").focus();
  await page.keyboard.press("q");
  await expect(wheel).toBeVisible();
  await page.click("#pz-album-btn");
  await expect(wheel).toBeHidden();
  await expect(page.locator("#pz-album")).toBeVisible();
  expect(errors).toEqual([]);
});

// Emotes go through chat's Nearby channel (docs/chat-plan.md): a wheel
// emote is a quick line (the server pops it over your head, as before), the
// chat's Nearby tab shows it, and a player's phrase pops over them.
test("Nearby chat on the Plaza: the wheel sends quick chat, phrases pop over the speaker", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await openPlaza(page);
  await page.locator(".plaza-layer").focus();
  await page.keyboard.press("q");
  await page.click('#pz-wheel [data-emote="👋"]');
  // The Plaza's own state carries it, for everyone (older apps too).
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as any).__plazaWorld.visitors.get("local")?.emote,
      ),
    )
    .toBe(1);
  // Every toast from here on (the drawer's requests must all be answered).
  await page.evaluate(() => {
    const w = window as any,
      t = document.getElementById("toast")!;
    w.__toasts = [];
    new MutationObserver(() => w.__toasts.push(t.textContent)).observe(t, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  });
  await page.click("#chat-button");
  await expect(page.locator('[data-chat-tab="place"]')).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator("#chat-drawer .chat-line")).toHaveText("tester👋");
  // The Nearby history came back (the harness answers as the server does):
  // no "Offline harness" toast.
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as any).__toasts)).toEqual([]);
  // Typing waits for an account's own channels: here it is quick chat.
  await expect(page.locator("#chat-input")).toBeDisabled();
  await page.click("#chat-drawer .chat-close");
  // Another player joins; their "Hi!" pops over their head.
  const pal = "22222222-2222-4222-8222-222222222222";
  await page.evaluate((pal) => {
    const w = (window as any).__plazaWorld;
    const me = w.bodyOf("local");
    w.join("pal", pal, {
      name: "Pal",
      title: null,
      titleColor: null,
      level: 3,
      character: "tidefin",
      skin: null,
    });
    w.visitors.get("pal").body.x = me.x + 60;
    w.visitors.get("pal").body.y = me.y;
  }, pal);
  await expect
    .poll(() =>
      page.evaluate(() =>
        [...(window as any).__plaza.others.values()].some(
          (b: any) => b.name === "Pal",
        ),
      ),
    )
    .toBe(true);
  await page.evaluate((pal) => {
    (window as any).__sock.fire("chat", {
      id: 99,
      channel: "place",
      from: { id: pal, name: "Pal" },
      at: Date.now(),
      quick: "hi",
    });
  }, pal);
  expect(
    await page.evaluate(
      () =>
        [...(window as any).__plaza.others.values()].find(
          (b: any) => b.name === "Pal",
        )?.emote,
    ),
  ).toBe("Hi!");
  // A longer phrase: the bubble is sized to it, never the text past it.
  await page.evaluate((pal) => {
    (window as any).__sock.fire("chat", {
      id: 100,
      channel: "place",
      from: { id: pal, name: "Pal" },
      at: Date.now(),
      quick: "wp",
    });
  }, pal);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const b = [...(window as any).__plaza.others.values()].find(
          (x: any) => x.name === "Pal",
        );
        if (b?.bubbleFor !== "Well played!") return null;
        const g = document.createElement("canvas").getContext("2d")!;
        g.font = "800 17px 'Barlow Condensed', sans-serif";
        const text = Math.max(
          ...b.bubbleLines.map((t: string) => g.measureText(t).width),
        );
        return { lines: b.bubbleLines, room: b.bubbleW - text >= 20 };
      }),
    )
    .toEqual({ lines: ["Well played!"], room: true });
  await snap(page, info, "plaza-chat-bubble");
  expect(errors).toEqual([]);
});

// A champion skin's own effects, the Entrance slot when someone arrives and
// the Victory slot when they dance (or score, or finish a lap), drawn on a
// phone as in a match (plaza-cosmetics.ts).
test("the Plaza plays skins' effects, entrances and victories", async ({
  page,
}, info) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 844, height: 390 });
  const errors = await openPlaza(page);
  // Someone arrives while you're here (not the crowd you joined).
  await page.waitForTimeout(1800);
  await page.evaluate(() => {
    const w = window as any,
      me = w.__plazaWorld.bodyOf("local");
    w.__plazaWorld.join("nova", "acct-nova", {
      name: "Nova",
      title: null,
      titleColor: null,
      level: 9,
      character: "voltkit",
      skin: { skin: "voltkit-nova-vanguard", stage: 3 },
      look: { entrance: "galaxy-entrance", victory: "galaxy-victory" },
    });
    Object.assign(w.__plazaWorld.bodyOf("nova"), { x: me.x + 110, y: me.y });
  });
  const nova = () =>
    page.evaluate(() => {
      const b = [...(window as any).__plaza.others.values()].find(
        (x: any) => x.name === "Nova",
      );
      return b
        ? {
            greeted: !!b.greeted,
            entrance: b.entrance,
            victory: b.victory,
            particles: b.sfx?.particles.length ?? 0,
            cheering: b.sfx?.cheerAt != null,
            sprite: !!b.img?.sprite,
          }
        : null;
    });
  await expect
    .poll(async () => (await nova())?.greeted, { timeout: 15_000 })
    .toBe(true);
  expect(await nova()).toMatchObject({
    entrance: "galaxy-entrance",
    victory: "galaxy-victory",
  });
  // Its entrance burst (and the skin's landing) is in the air.
  await expect
    .poll(async () => (await nova())?.particles ?? 0, { timeout: 10_000 })
    .toBeGreaterThan(0);
  await snap(page, info, "plaza-skin-entrance-844x390");
  // A dance plays the victory finale.
  await page.waitForTimeout(1500);
  await page.evaluate(() =>
    (window as any).__plazaWorld.emote("nova", "💃", Date.now()),
  );
  await expect
    .poll(async () => (await nova())?.cheering, { timeout: 10_000 })
    .toBe(true);
  await page.waitForTimeout(900);
  expect((await nova())!.particles).toBeGreaterThan(0);
  await snap(page, info, "plaza-skin-victory-844x390");
  // Over after the finale.
  await expect
    .poll(async () => (await nova())?.cheering, { timeout: 10_000 })
    .toBe(false);
  expect(errors).toEqual([]);
});

test("the Plaza shows the skins players wear: yours at once, others' palettes and auras", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await openPlaza(page);
  // Yours, from your saved wardrobe (the harness: Voltkit in Stormcrown,
  // stage 2), even though the server's first copy of you is bare.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const P = (window as any).__plaza.P;
        return [P.skin?.skin ?? null, P.skin?.stage ?? null];
      }),
    )
    .toEqual(["voltkit-stormcrown", 2]);
  // The server sends your bare copy again (it changed, before or without
  // reading your wardrobe): you stay in what you wear.
  await page.evaluate(() =>
    (window as any).__plazaWorld.updateProfile("local", { level: 13 }),
  );
  await page.waitForTimeout(800);
  expect(
    await page.evaluate(() => (window as any).__plaza.P.skin?.skin ?? null),
  ).toBe("voltkit-stormcrown");
  // Someone in a Skin-slot palette, and someone in a champion skin over one
  // (the champion skin wins, as in battle).
  await page.evaluate(() => {
    const w = window as any,
      me = w.__plazaWorld.bodyOf("local");
    const join = (key: string, name: string, extra: object, dx: number) => {
      w.__plazaWorld.join(key, `acct-${key}`, {
        name,
        title: null,
        titleColor: null,
        level: 3,
        character: "voltkit",
        skin: null,
        ...extra,
      });
      Object.assign(w.__plazaWorld.bodyOf(key), { x: me.x + dx, y: me.y });
    };
    join("candy", "Candy", { look: { skin: "candy-colours" } }, 90);
    join(
      "crown",
      "Crown",
      {
        skin: { skin: "voltkit-stormcrown", stage: 1 },
        look: { skin: "candy-colours" },
      },
      -90,
    );
    // Someone showing off an Aura (the Plaza draws it as a match does).
    join("halo", "Halo", { look: { aura: "halo-aura" } }, 0);
    Object.assign(w.__plazaWorld.bodyOf("halo"), { y: me.y + 120 });
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          [...(window as any).__plaza.others.values()].find(
            (x: any) => x.name === "Halo",
          )?.aura ?? null,
      ),
    )
    .toBe("halo-aura");
  const srcOf = (name: string) =>
    page.evaluate((name) => {
      const b = [...(window as any).__plaza.others.values()].find(
        (x: any) => x.name === name,
      );
      return b ? decodeURIComponent(b.img.src) : null;
    }, name);
  await expect
    .poll(() => srcOf("Candy"), { timeout: 15_000 })
    .toContain("preview-palette-candy-colours");
  const crown = await srcOf("Crown");
  expect(crown).not.toContain("preview-palette");
  expect(crown).not.toBe(await srcOf("Candy"));
  await snap(page, info, "plaza-skins");
  expect(errors).toEqual([]);
});
