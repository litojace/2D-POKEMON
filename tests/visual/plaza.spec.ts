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
      // Today's quests, sized against their neighbours: on phones the
      // folded list is the player card's twin right under it; on desktop
      // a compact column (it was 220 x 203).
      const card = all.find((b) => b.name === "profile")!,
        quests = all.find((b) => b.name === "quests")!;
      if (phone) {
        expect(quests.w, "quests as wide as the card").toBeCloseTo(card.w, 0);
        expect(quests.h, "folded quests as tall as the card").toBeCloseTo(
          card.h,
          0,
        );
        expect(quests.x, "quests under the card").toBeCloseTo(card.x, 0);
      } else {
        expect(quests.w, "quests width").toBeLessThanOrEqual(208);
        expect(quests.h, "quests height").toBeLessThanOrEqual(175);
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
// left of Dash and Jump by the Volt Boba. The wheel opens left of the
// Emote row, under the header; the toast rises over the Dash and Jump row.
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
    await page.click("#pz-wheel-btn");
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
    await page.click("#pz-wheel-btn");
    await page.evaluate(() => (window as any).__plazaPosition(1745, 520));
    await expect(page.locator("#pz-interact")).toBeVisible({ timeout: 10_000 });
    await page.evaluate(() => {
      const t = document.getElementById("toast")!;
      t.textContent = "Volt Boba: 30% faster for 30 seconds";
      t.classList.add("show");
    });
    await page.waitForTimeout(600);
    const toast = await rect("#toast");
    expect(clear(toast, await rect(".pz-actions")), "toast clear").toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
