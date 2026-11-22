import { expect, test, type Page } from "@playwright/test";
import { openHub, openPlayPanel, snap } from "./helpers";

/**
 * Watching a room (main.ts renderWatchOverlay, chat/battle-chat.ts,
 * raid-ui.ts renderRaidWatchHud): the whole court, never a follow or a zoom;
 * the score badge in PvP and the boss's bar and the raiders' health in a
 * raid; and a quick-chat button whose grid holds cheers and emotes, no
 * calls (a watcher takes no side).
 */
const SIZES = [
  { name: "667x375", width: 667, height: 375, touch: true, inset: 0 },
  { name: "844x390", width: 844, height: 390, touch: true, inset: 47 },
  { name: "852x393-island", width: 852, height: 393, touch: true, inset: 59 },
  { name: "1280x720", width: 1280, height: 720, touch: false, inset: 0 },
];

async function watch(page: Page, kind: "pvp" | "raid") {
  // The game object, for the camera (as court-apron.spec.ts does).
  await page.route(/\/apps\/client\/src\/main\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()).replace(
        "gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);",
        "window.__edgeGame=gameInstance;gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);",
      ),
    });
  });
  const errors = await openHub(page);
  await page.evaluate((kind) => {
    const w = window as any;
    if (kind === "pvp") w.__room("pvp", { mode: "teams", phase: "playing" });
    else w.__room("raid");
    // The fighters spread to the court's corners: a camera that followed
    // one of them would leave the others out.
    const people = w.__snap.players.filter((p: any) => !p.raidBoss);
    const spots = [
      [90, 90],
      [1510, 810],
      [90, 810],
      [1510, 90],
    ];
    people.forEach((p: any, i: number) => ([p.x, p.y] = spots[i]));
    // Nobody in this room is the harness account: you are watching.
    for (const p of w.__snap.players) if (p.id === "me") p.id = "m1";
    const before = w.__reply;
    w.__reply = (ev: string, d: unknown) =>
      ev === "watch" ? { ok: true, code: w.__snap.code } : before(ev, d);
    w.__sent = [];
    w.__emit = (ev: string, data: unknown) => {
      if (ev === "chat-send") w.__sent.push(data);
    };
  }, kind);
  await openPlayPanel(page);
  const code = await page.evaluate(() => (window as any).__snap.code);
  await page.fill("#code", code);
  await page.click("#watch");
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          (window as any).__push();
          return document.body.classList.contains("spectating");
        }),
      { timeout: 60_000, intervals: [400] },
    )
    .toBe(true);
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => (window as any).__push());
    await page.waitForTimeout(300);
  }
  return errors;
}

/** The camera's view of the world holds the whole court (0–1600 × 0–900). */
const wholeCourt = (page: Page) =>
  page.evaluate(() => {
    const c = (window as any).__edgeGame.scene.getScene("arena").cameras.main;
    const v = c.worldView;
    return v.x <= 1 && v.y <= 1 && v.right >= 1599 && v.bottom >= 899;
  });

for (const size of SIZES)
  for (const kind of ["pvp", "raid"] as const)
    test(`watching a ${kind} match at ${size.name}`, async ({
      browser,
    }, info) => {
      test.setTimeout(180_000);
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        isMobile: size.touch,
        hasTouch: size.touch,
      });
      const page = await context.newPage();
      await page.addInitScript((inset) => {
        const set = () => {
          for (const [k, v] of Object.entries({
            left: inset,
            right: inset,
            bottom: inset ? 21 : 0,
            top: 0,
          }))
            document.documentElement.style.setProperty(`--safe-${k}`, `${v}px`);
        };
        if (document.documentElement) set();
        document.addEventListener("DOMContentLoaded", set);
      }, size.inset);
      try {
        const errors = await watch(page, kind);
        // The whole court, even with the fighters in its corners.
        await expect.poll(() => wholeCourt(page)).toBe(true);

        // The score, or the boss's bar and every raider's health.
        if (kind === "pvp") await expect(page.locator("#hud")).toBeVisible();
        else {
          await expect(page.locator("#raid-hud")).toBeVisible();
          await expect(page.locator("#raid-party .rp-ally")).toHaveCount(2);
        }
        const banner = page.locator("#spectate");
        await expect(banner).toContainText(
          size.touch ? "⚙ to stop" : "Esc to stop",
        );
        // It says so once, then fades off the court.
        expect(
          await banner.evaluate((e) => getComputedStyle(e).animationName),
        ).toBe("watch-banner-fade");

        // Quick chat, clear of the score, the banner and the gear.
        const btn = page.locator("#battle-chat");
        await expect(btn).toBeVisible();
        const b = (await btn.boundingBox())!;
        expect(b.width).toBeGreaterThanOrEqual(44);
        const clash = await page.evaluate(() => {
          const r = document
            .getElementById("battle-chat")!
            .getBoundingClientRect();
          const out: string[] = [];
          for (const e of document.querySelectorAll(
            "#hud, #raid-hud, #raid-party, #spectate, #battle-menu",
          )) {
            const o = e.getBoundingClientRect();
            if (!o.width || getComputedStyle(e).display === "none") continue;
            if (
              r.left < o.right &&
              o.left < r.right &&
              r.top < o.bottom &&
              o.top < r.bottom
            )
              out.push(e.id);
          }
          return out;
        });
        expect(clash).toEqual([]);
        await snap(page, info, `watch-${kind}-${size.name}`);

        await btn.click();
        const grid = page.locator("#battle-chat-grid");
        await expect(grid).toBeVisible();
        // Cheers and emotes; no calls, and no raid signals.
        await expect(grid.locator('[data-battle-quick="nice"]')).toBeVisible();
        await expect(grid.locator('[data-battle-quick="attack"]')).toHaveCount(
          0,
        );
        await expect(grid.locator("[data-battle-ping]")).toHaveCount(0);
        await expect(grid.locator("[data-battle-mute]")).toHaveText(
          "Mute players",
        );
        // The grid stays on screen.
        const g = (await grid.boundingBox())!;
        expect(g.x + g.width).toBeLessThanOrEqual(size.width);
        expect(g.y + g.height).toBeLessThanOrEqual(size.height);
        await snap(page, info, `watch-${kind}-grid-${size.name}`);
        await grid.locator('[data-battle-quick="nice"]').click();
        await expect(grid).toBeHidden();
        expect(await page.evaluate(() => (window as any).__sent)).toEqual([
          { channel: "room", quick: "nice" },
        ]);

        // Another watcher's cheer shows in the feed, marked as watching.
        await page.evaluate(() =>
          (window as any).__sock.fire("chat", {
            id: 7,
            channel: "room",
            from: { id: "acct-vi", name: "Vi" },
            at: Date.now(),
            quick: "wp",
            watcher: true,
          }),
        );
        await expect(
          page.locator(".battle-chat-feed li.is-watcher"),
        ).toHaveText("Vi Well played!");
        // To the whole room, with an eye before the name.
        const vi = page.locator(".battle-chat-feed li.is-watcher");
        await expect(vi).toHaveAttribute("data-to", "all");
        await expect(vi.locator('b svg[aria-label="Watching"]')).toHaveCount(1);
        await snap(page, info, `watch-${kind}-feed-${size.name}`);
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });

test("before the battle, a watcher's typed line has an eye in the room chat", async ({
  browser,
}, info) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  try {
    await openHub(page);
    await page.evaluate(() => {
      const w = window as any;
      w.__room("pvp", { mode: "duel" });
      w.__snap.watchers = ["Vi"];
    });
    await openPlayPanel(page);
    await page.evaluate(() =>
      document.querySelector<HTMLButtonElement>("#play-create")!.click(),
    );
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            (window as any).__push();
            return !!document.querySelector("#chat-button:not([hidden])");
          }),
        { timeout: 60_000, intervals: [400] },
      )
      .toBe(true);
    await page.evaluate(() => {
      const fire = (id: number, from: string, name: string, extra: object) =>
        (window as any).__sock.fire("chat", {
          id,
          channel: "room",
          from: { id: from, name },
          at: Date.now(),
          ...extra,
        });
      fire(1, "acct-kai", "Kai", { text: "ready?", fighter: "p2" });
      fire(2, "acct-vi", "Vi", { text: "good luck both!", watcher: true });
    });
    await page.click("#chat-button");
    const drawer = page.locator("#chat-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer.locator(".chat-line.is-watcher")).toHaveText(
      "Vigood luck both!",
    );
    await expect(
      drawer.locator('.chat-line.is-watcher b svg[aria-label="Watching"]'),
    ).toHaveCount(1);
    await expect(drawer.locator(".chat-line:not(.is-watcher) svg")).toHaveCount(
      0,
    );
    await snap(page, info, "watch-room-chat-drawer");
  } finally {
    await context.close();
  }
});

test("a player sees a watcher's cheer, and Mute others hides it", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  try {
    await openHub(page);
    await page.evaluate(() => {
      const w = window as any;
      w.__room("pvp", { mode: "duel", phase: "playing" });
      w.__snap.watchers = ["Vi"];
    });
    await openPlayPanel(page);
    await page.evaluate(() =>
      document.querySelector<HTMLButtonElement>("#play-create")!.click(),
    );
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            (window as any).__push();
            return document.body.classList.contains("battle-active");
          }),
        { timeout: 60_000, intervals: [400] },
      )
      .toBe(true);
    const cheer = (id: number) =>
      page.evaluate(
        (id) =>
          (window as any).__sock.fire("chat", {
            id,
            channel: "room",
            from: { id: "acct-vi", name: "Vi" },
            at: Date.now(),
            quick: "nice",
            watcher: true,
          }),
        id,
      );
    await expect(page.locator("#battle-chat")).toBeVisible();
    await cheer(1);
    await expect(page.locator(".battle-chat-feed li.is-watcher")).toHaveText(
      "Vi Nice!",
    );
    await page.click("#battle-chat");
    await page.click("[data-battle-mute]");
    await page.click("#battle-chat");
    await cheer(2);
    await expect(page.locator(".battle-chat-feed li.is-watcher")).toHaveCount(
      1,
    );
  } finally {
    await context.close();
  }
});
