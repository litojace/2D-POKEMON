import { expect, test, type Page } from "@playwright/test";
import { openPlaza, snap } from "./helpers";

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
      ["leaves", "#account-leaves > *"],
      ["menu", ".header-menu > summary"],
      ["event", "#pz-event"],
      ["minimap", "#pz-mini"],
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
      await page.waitForTimeout(800);
      await snap(
        page,
        info,
        `plaza-${viewport.width}x${viewport.height}${viewport.inset ? "-island" : ""}`,
      );
      const all = await hudBoxes(page);
      expect(all.map((b) => b.name)).toEqual(
        expect.arrayContaining(["event", "minimap", "quests", "actions"]),
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

test("you walk where the server says, and Volt Boba costs 10 leaves", async ({
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
  await page.keyboard.down("d");
  await page.waitForTimeout(1200);
  await page.keyboard.up("d");
  await expect
    .poll(async () => (await server()).x)
    .toBeGreaterThan(start.x + 100);
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
  // Volt Boba: walk up to the truck, pay, run faster.
  await teleport(page, 1745, 520);
  await expect(page.locator("#pz-interact")).toContainText("Volt Boba", {
    timeout: 10_000,
  });
  await page.click("#pz-interact");
  await expect(page.locator("#toast")).toContainText("30% faster");
  await expect(page.locator("#account-leaves")).toContainText("1,224");
  expect((await server()).boost).toBeGreaterThan(25);
  // Still boosted: no second charge.
  await page.click("#pz-interact");
  await expect(page.locator("#toast")).toContainText("still active");
  await expect(page.locator("#account-leaves")).toContainText("1,224");
  await snap(page, info, "plaza-boba");
  expect(errors).toEqual([]);
});

test("the Photo Spot takes a polaroid, and quests update from the server", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await openPlaza(page);
  await expect(page.locator("#pz-quests h5")).toContainText("1/5");
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
  // The server pays a finished quest: the panel and the wallet follow.
  await page.evaluate(() => {
    const w = window as any;
    const p = structuredClone(w.__plazaProgress);
    p.quests.lap = { n: 1, done: true };
    p.leaves = 1274;
    w.__sock.fire("plaza-progress", p);
  });
  await expect(page.locator("#pz-quests h5")).toContainText("2/5");
  await expect(page.locator("#toast")).toContainText("+40 Gold Leaves");
  await expect(page.locator("#account-leaves")).toContainText("1,274");
  expect(errors).toEqual([]);
});

test("leaving the Plaza tab leaves the Plaza on the server", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await openPlaza(page);
  await page.click('#hub-scenes [data-hub-scene="lobby"]');
  await expect(page.locator(".plaza-layer")).toHaveCount(0);
  await expect(page.locator("#lobby-play")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => (window as any).__plazaWorld.size))
    .toBe(0);
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

test("a treat from your barn bursts for everyone, and T throws one too", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await openPlaza(page);
  // The server sends your count (regular crops in the barn) after joining.
  await expect(page.locator("#pz-treats")).toHaveText("3");
  await page.click("#pz-treat");
  await expect(page.locator("#toast")).toContainText(
    "Tossed Breeze Wheat to everyone!",
  );
  await expect(page.locator("#pz-treats")).toHaveText("2");
  // The burst is drawn where the server has you.
  await expect
    .poll(() => page.evaluate(() => (window as any).__plaza.treatFx()))
    .toBeGreaterThan(0);
  await snap(page, info, "plaza-treat");
  // T throws one too, once the server's cooldown has passed.
  await page.waitForTimeout(1600);
  await page.locator(".plaza-layer").focus();
  await page.keyboard.press("t");
  await expect(page.locator("#pz-treats")).toHaveText("1");
  expect(
    await page.evaluate(() => (window as any).__plazaTreatsThrown.length),
  ).toBe(2);
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
  await page.waitForTimeout(4000);
  const spot = await page.evaluate(() => {
    const p = (window as any).__plaza,
      dancer = [...p.others.values()].find((b: any) => b.name === "Dancer");
    return p.worldClient(dancer.x, dancer.y - 30);
  });
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
