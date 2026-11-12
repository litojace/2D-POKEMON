import { expect, test, type Page } from "@playwright/test";
import { openHub, pushUntilBattle, snap, openPlayPanel } from "./helpers";

// Phones aim at the nearest enemy; with two or more enemies the player can
// lock on to another one (a target row, or a tap on the fighter).
async function ffa(page: Page) {
  await page.route(/\/apps\/client\/src\/main\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch(),
      body = await response.text();
    const marker =
      "gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);";
    expect(body).toContain(marker);
    await route.fulfill({
      response,
      body: body.replace(marker, "window.__targetGame=gameInstance;" + marker),
    });
  });
  const errors = await openHub(page);
  await page.evaluate(() => {
    const w = window as any;
    w.__events = [];
    w.__emit = (event: string, data: unknown) =>
      w.__events.push({ event, data });
    w.__room("pvp", { mode: "ffa", phase: "playing" });
  });
  await openPlayPanel(page);
  await page.click("#play-create");
  await pushUntilBattle(page);
  // Spread the fighters out (all on a phone's screen): Kai nearest to you,
  // Rae and Mina farther.
  await page.evaluate(() => {
    const w = window as any,
      at: Record<string, [number, number]> = {
        me: [500, 380],
        p2: [650, 380],
        p3: [1000, 200],
        p4: [900, 330],
      };
    w.__snap.remaining = 90;
    for (const p of w.__snap.players) [p.x, p.y] = at[p.id];
    w.__push();
  });
  return errors;
}
const lastAim = (page: Page) =>
  page.evaluate(() => {
    const inputs = (window as any).__events.filter(
      (e: any) => e.event === "input",
    );
    const last = inputs.at(-1)?.data;
    return last
      ? { x: last.aimX as number, y: last.aimY as number }
      : undefined;
  });
const aimNear = async (page: Page, x: number, y: number) =>
  expect
    .poll(
      async () => {
        const a = await lastAim(page);
        return a ? Math.hypot(a.x - x, a.y - y) : Infinity;
      },
      { timeout: 8000 },
    )
    .toBeLessThan(2);

for (const size of [
  { width: 844, height: 390 },
  { width: 844, height: 280 },
]) {
  test(`phones can pick who to aim at with several enemies (${size.width}x${size.height})`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: size,
      isMobile: true,
      hasTouch: true,
    });
    try {
      const page = await context.newPage();
      const errors = await ffa(page);
      const picker = page.locator("#target-picker");
      await expect(picker).toBeVisible();
      await expect(picker.locator("button")).toHaveCount(3);
      // It fits on screen and clear of every touch control.
      const rows = await page.evaluate(() => {
        const r = (el: Element) => {
          const b = el.getBoundingClientRect();
          return { x: b.x, y: b.y, right: b.right, bottom: b.bottom };
        };
        return {
          picker: [...document.querySelectorAll("#target-picker button")].map(
            r,
          ),
          controls: [
            ...document.querySelectorAll(
              "#mobile-controls button, #mobile-controls .joystick, #battle-menu, #battle-menu .ping-badge",
            ),
          ].map(r),
          hud: [...document.querySelectorAll("#hud > *")]
            .filter((el) => el.getClientRects().length)
            .map(r),
        };
      });
      for (const b of rows.picker) {
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.right).toBeLessThanOrEqual(size.width);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.bottom).toBeLessThanOrEqual(size.height);
        for (const c of [...rows.controls, ...rows.hud])
          expect(
            b.right <= c.x ||
              c.right <= b.x ||
              b.bottom <= c.y ||
              c.bottom <= b.y,
          ).toBe(true);
      }
      // Automatic: the nearest enemy (Kai).
      await aimNear(page, 650, 380);
      // Lock on to Rae from the row.
      await picker.locator('button[data-target-id="p3"]').tap();
      await expect(
        picker.locator('button[data-target-id="p3"]'),
      ).toHaveAttribute("aria-pressed", "true");
      await aimNear(page, 1000, 200);
      await snap(page, info, `target-row-${size.width}x${size.height}`);
      // Tap again: back to automatic aiming.
      await picker.locator('button[data-target-id="p3"]').tap();
      await expect(
        picker.locator('button[data-target-id="p3"]'),
      ).toHaveAttribute("aria-pressed", "false");
      await aimNear(page, 650, 380);
      // A tap on Mina herself on the court locks her.
      const screen = await page.evaluate(() => {
        const cam = (window as any).__targetGame.scene.getScene("arena").cameras
          .main;
        const canvas = document
          .querySelector("#game canvas")!
          .getBoundingClientRect();
        const v = cam.worldView;
        return {
          x: canvas.left + ((900 - v.x) / v.width) * canvas.width,
          y: canvas.top + ((330 - v.y) / v.height) * canvas.height,
        };
      });
      await page.touchscreen.tap(screen.x, screen.y);
      await expect(
        picker.locator('button[data-target-id="p4"]'),
      ).toHaveAttribute("aria-pressed", "true");
      await aimNear(page, 900, 330);
      // A defeated target cannot be picked; aim returns to the nearest.
      await page.evaluate(() => {
        const w = window as any;
        w.__snap.players.find((p: any) => p.id === "p4").hp = 0;
        w.__push();
      });
      await expect(
        picker.locator('button[data-target-id="p4"]'),
      ).toBeDisabled();
      await aimNear(page, 650, 380);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

test("the target row is for touch play only", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await ffa(page);
  await page.waitForTimeout(500);
  await expect(page.locator("#target-picker")).toBeHidden();
});

// Owner, 7 Nov 2026: the row only answered when standing still. A browser
// makes a click only from the first finger on the screen, and while moving
// that finger is on the joystick; the row now answers the touch itself.
test("the target row answers a second finger while the other moves", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    const errors = await ffa(page);
    const picker = page.locator("#target-picker");
    await expect(picker.locator("button")).toHaveCount(3);
    const cdp = await context.newCDPSession(page);
    const centre = async (selector: string) => {
      const b = (await page.locator(selector).boundingBox())!;
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    };
    const stick = await centre("#mobile-controls .joystick");
    const rae = await centre('#target-picker button[data-target-id="p3"]');
    const thumb = { x: stick.x + 30, y: stick.y, id: 1 };
    const touch = (
      type: string,
      points: { x: number; y: number; id: number }[],
    ) =>
      cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: points.map((p) => ({ x: p.x, y: p.y, id: p.id })),
      });
    const moving = () =>
      page.evaluate(() => {
        const inputs = (window as any).__events.filter(
          (e: any) => e.event === "input",
        );
        return Math.abs(inputs.at(-1)?.data.dx ?? 0) > 0.3;
      });
    // The thumb holds the stick to the right: moving.
    await touch("touchStart", [thumb]);
    await touch("touchMove", [{ ...thumb, x: thumb.x + 10 }]);
    await expect.poll(moving).toBe(true);
    // A second finger taps Rae on the row: locked, still moving.
    const tap = async () => {
      await touch("touchStart", [
        { ...thumb, x: thumb.x + 10 },
        { ...rae, id: 2 },
      ]);
      // Lifting the tapping finger only (touchEnd lifts the points it lists).
      await touch("touchEnd", [{ ...rae, id: 2 }]);
    };
    await tap();
    await expect(picker.locator('button[data-target-id="p3"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await aimNear(page, 1000, 200);
    expect(await moving()).toBe(true);
    // Again: back to automatic aiming, once (no double toggle).
    await page.waitForTimeout(300);
    await tap();
    await expect(picker.locator('button[data-target-id="p3"]')).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await page.waitForTimeout(800);
    await expect(picker.locator('button[data-target-id="p3"]')).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await touch("touchEnd", [{ ...thumb, x: thumb.x + 10 }]);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

/** A raid on a phone, with only the fighters in `keep` beside the boss. */
async function raidBattle(page: Page, boss: string, keep: string[]) {
  await page.route(/\/apps\/client\/src\/main\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch(),
      body = await response.text();
    const marker =
      "gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);";
    expect(body).toContain(marker);
    await route.fulfill({
      response,
      body: body.replace(marker, "window.__targetGame=gameInstance;" + marker),
    });
  });
  const errors = await openHub(page);
  await page.evaluate(
    ([boss, keep]) => {
      const w = window as any;
      w.__events = [];
      w.__emit = (event: string, data: unknown) =>
        w.__events.push({ event, data });
      w.__room("raid", { boss });
      w.__snap.players = w.__snap.players.filter(
        (p: any) => p.raidBoss || keep.includes(p.id),
      );
      w.__snap.raid.partySize = keep.length;
    },
    [boss, keep] as const,
  );
  await openPlayPanel(page);
  await page.click("#play-create");
  await pushUntilBattle(page);
  return errors;
}
/** Tap the court at a world point. */
async function tapWorld(page: Page, x: number, y: number) {
  const screen = await page.evaluate(
    ([x, y]) => {
      const cam = (window as any).__targetGame.scene.getScene("arena").cameras
        .main;
      const canvas = document
        .querySelector("#game canvas")!
        .getBoundingClientRect();
      const v = cam.worldView;
      return {
        x: canvas.left + ((x - v.x) / v.width) * canvas.width,
        y: canvas.top + ((y - v.y) / v.height) * canvas.height,
      };
    },
    [x, y],
  );
  await page.touchscreen.tap(screen.x, screen.y);
}

// Gloomshade's copies are not players, so phones used to aim only at the real
// one, and the find-the-real-one puzzle vanished. Every body (the real one and
// its copies alike, labels at random) and every unlit lantern can be picked.
test("phones pick among Gloomshade's bodies and its unlit lanterns", async ({
  browser,
}, info) => {
  const size = { width: 844, height: 390 };
  const context = await browser.newContext({
    viewport: size,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    const errors = await raidBattle(page, "gloomshade", ["me"]);
    // The real one at (900, 420), its copies at (640, 380) and (1100, 520);
    // the first lantern out. You stand nearest the first copy.
    await page.evaluate(() => {
      const w = window as any,
        s = w.__snap;
      s.remaining = 300;
      const me = s.players.find((p: any) => p.id === "me"),
        boss = s.players.find((p: any) => p.raidBoss);
      [me.x, me.y] = [560, 400];
      [boss.x, boss.y] = [900, 420];
      s.raid.decoys = [
        { id: 51, x: 640, y: 380 },
        { id: 52, x: 1100, y: 520 },
      ];
      for (const l of s.raid.lanterns) [l.lit, l.hits] = [true, 0];
      s.raid.lanterns[0].lit = false;
      w.__push();
    });
    const picker = page.locator("#target-picker");
    await expect(picker).toBeVisible();
    // Three bodies and the lantern; the real body's button looks like the rest.
    await expect(picker.locator("button")).toHaveCount(4);
    const labels = await picker.locator("button").allTextContents();
    expect(labels.filter((t) => /Shade [A-C]/.test(t))).toHaveLength(3);
    expect(labels.filter((t) => /Lantern NW/.test(t))).toHaveLength(1);
    const lantern = await page.evaluate(
      () => (window as any).__snap.raid.lanterns[0],
    );
    // Automatic: the nearest body, here a copy (not the real one).
    await aimNear(page, 640, 380);
    // A tap on the far copy locks it.
    await tapWorld(page, 1100, 500);
    await expect(
      picker.locator('button[data-target-id="shade:52"]'),
    ).toHaveAttribute("aria-pressed", "true");
    await aimNear(page, 1100, 520);
    await snap(page, info, "gloom-target-copy");
    // The lantern from the row: aim goes to its glass.
    await picker.locator('button[data-target-id="lantern:0"]').tap();
    await aimNear(page, lantern.x, lantern.y);
    // Relit: it leaves the row, and aim falls back to the nearest body.
    await page.evaluate(() => {
      const w = window as any;
      w.__snap.raid.lanterns[0].lit = true;
      w.__push();
    });
    await expect(picker.locator("button")).toHaveCount(3);
    await aimNear(page, 640, 380);
    // A popped copy leaves the row.
    await page.evaluate(() => {
      const w = window as any;
      w.__snap.raid.decoys = [];
      w.__push();
    });
    await expect(picker).toBeHidden();
    await aimNear(page, 900, 420);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

// Tidewyrm seals raiders in bubbles that teammates pop with three hits; on a
// phone the bubble can be picked (row or tap), or aim stays on the boss.
test("phones can aim at the bubble holding a teammate", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    const errors = await raidBattle(page, "tidewyrm", ["me", "p2"]);
    await page.evaluate(() => {
      const w = window as any,
        s = w.__snap;
      s.remaining = 300;
      const me = s.players.find((p: any) => p.id === "me"),
        pal = s.players.find((p: any) => p.id === "p2"),
        boss = s.players.find((p: any) => p.raidBoss);
      [me.x, me.y] = [600, 450];
      [pal.x, pal.y] = [760, 560];
      [boss.x, boss.y] = [900, 330];
      s.raid.submerged = false;
      w.__push();
    });
    const picker = page.locator("#target-picker");
    // The battle is live once it sends inputs (the row being hidden says
    // nothing yet: it is hidden before the battle starts, too).
    await expect.poll(() => lastAim(page), { timeout: 60_000 }).toBeTruthy();
    // One enemy, no bubble: no row, aim on the boss.
    await expect(picker).toBeHidden();
    await aimNear(page, 900, 330);
    await page.evaluate(() => {
      const w = window as any,
        s = w.__snap;
      s.raid.prisons = [
        {
          playerId: "p2",
          x: 760,
          y: 560,
          hits: 0,
          presses: 0,
          until: s.time + 6,
          startedAt: s.time,
        },
      ];
      w.__push();
    });
    await expect(picker.locator("button")).toHaveCount(2);
    await expect(picker).toContainText("Free Kai");
    // Still the boss until you choose.
    await aimNear(page, 900, 330);
    await tapWorld(page, 760, 545);
    await expect(
      picker.locator('button[data-target-id="bubble:p2"]'),
    ).toHaveAttribute("aria-pressed", "true");
    await aimNear(page, 760, 560);
    // Popped: back to the boss.
    await page.evaluate(() => {
      const w = window as any;
      w.__snap.raid.prisons = [];
      w.__push();
    });
    await expect(picker).toBeHidden();
    await aimNear(page, 900, 330);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
