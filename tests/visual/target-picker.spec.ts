import { expect, test, type Page, type TestInfo } from "@playwright/test";
import {
  openHub,
  pushUntilBattle,
  snap,
  openPlayPanel,
  createRoom,
} from "./helpers";

// Phones aim at the nearest enemy; with two or more enemies the player can
// lock on to another one (a target portrait in the row over the combat
// buttons, or a tap on the fighter).
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
  await createRoom(page);
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

/**
 * The target portraits: round, 44 px to tap, faces or marks with no text,
 * on screen, never on each other, any touch control, the gear, the chat
 * button or the top HUD (scoreboard, raid bar, timer), and on the right of
 * the screen, away from the court's middle and the joystick. Returns their
 * boxes.
 */
async function portraitsClear(
  page: Page,
  size: { width: number; height: number },
) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          [...document.querySelectorAll("#target-picker button")].filter(
            (b) => b.getBoundingClientRect().width > 0,
          ).length,
      ),
    )
    .toBeGreaterThanOrEqual(2);
  const rows = await page.evaluate(() => {
    const r = (el: Element) => {
      const b = el.getBoundingClientRect();
      return {
        name:
          (el as HTMLElement).id ||
          (el as HTMLElement).dataset.action ||
          (el as HTMLElement).dataset.skill ||
          el.className.toString(),
        x: b.x,
        y: b.y,
        right: b.right,
        bottom: b.bottom,
        // The combat buttons are discs (and so are the portraits).
        round: el.matches(".touch-buttons button"),
      };
    };
    const shown = (el: Element) =>
      el.getClientRects().length > 0 &&
      getComputedStyle(el).visibility !== "hidden";
    return {
      picker: [...document.querySelectorAll("#target-picker button")].map(
        (b) => ({
          ...r(b),
          text: b.textContent!.replace(/\s/g, ""),
          face: (() => {
            const f = b.querySelector(".target-face")!.getBoundingClientRect();
            return { w: f.width, h: f.height };
          })(),
          label: b.getAttribute("aria-label"),
          img: !!b.querySelector("img"),
        }),
      ),
      controls: [
        ...document.querySelectorAll(
          "#mobile-controls .touch-buttons button, #mobile-controls .joystick, #battle-menu, #battle-menu .ping-badge, #battle-chat, #raid-hud, #raid-hud *, #hud > *, #hud .scoreboard, #hud .timer-wrap",
        ),
      ]
        .filter(shown)
        .map(r),
    };
  });
  const apart = (
    a: { x: number; y: number; right: number; bottom: number },
    b: { x: number; y: number; right: number; bottom: number },
  ) => a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y;
  const discsApart = (
    a: { x: number; y: number; right: number; bottom: number },
    b: { x: number; y: number; right: number; bottom: number },
  ) =>
    Math.hypot(
      (a.x + a.right - b.x - b.right) / 2,
      (a.y + a.bottom - b.y - b.bottom) / 2,
    ) >=
    (a.right - a.x + b.right - b.x) / 2;
  for (const [i, b] of rows.picker.entries()) {
    expect(b.right - b.x).toBeCloseTo(44, 0);
    expect(b.bottom - b.y).toBeCloseTo(44, 0);
    expect(b.face.w).toBeGreaterThanOrEqual(36);
    expect(b.face.w).toBeLessThanOrEqual(40);
    expect(b.label).toBeTruthy();
    // A face, or one short mark (a body's letter, a lantern's corner).
    if (!b.img) expect(b.text.length).toBeLessThanOrEqual(2);
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.right).toBeLessThanOrEqual(size.width);
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.bottom).toBeLessThanOrEqual(size.height);
    // The right half, above the middle third's bottom: never the court's
    // centre or the joystick.
    expect(b.x).toBeGreaterThan(size.width * 0.55);
    for (const c of rows.controls)
      expect(
        c.round ? discsApart(b, c) : apart(b, c),
        `portrait ${b.label} on ${c.name}`,
      ).toBe(true);
    // Round buttons (a touch lands inside the circle): never on each other.
    for (const o of rows.picker.slice(i + 1))
      expect(
        Math.hypot(b.x - o.x, b.y - o.y),
        `portrait ${b.label} on ${o.label}`,
      ).toBeGreaterThanOrEqual(43.5);
  }
  // One straight row (owner, 16 Nov 2026: the arc looked crooked): every
  // centre at one height, the same gap between neighbours, just over the
  // combat buttons, its right end on the ultimate's right edge.
  const shownPortraits = rows.picker
    .filter((b) => b.right > b.x)
    .map((b) => ({ x: (b.x + b.right) / 2, y: (b.y + b.bottom) / 2 }))
    .sort((a, b) => a.x - b.x);
  for (const p of shownPortraits)
    expect(Math.abs(p.y - shownPortraits[0].y)).toBeLessThanOrEqual(1);
  const gaps = shownPortraits.slice(1).map((p, i) => p.x - shownPortraits[i].x);
  for (const g of gaps) expect(Math.abs(g - gaps[0])).toBeLessThanOrEqual(1);
  const ult = rows.controls.find((c) => c.name === "3")!;
  const rowRight = rows.picker.reduce((m, b) => Math.max(m, b.right), 0);
  expect(Math.abs(rowRight - ult.right)).toBeLessThanOrEqual(1);
  const clusterTop = Math.min(
    ...rows.controls.filter((c) => c.round).map((c) => c.y),
  );
  const rowBottom = rows.picker.reduce((m, b) => Math.max(m, b.bottom), 0);
  expect(rowBottom).toBeLessThanOrEqual(clusterTop - 5.5);
  expect(rowBottom).toBeGreaterThanOrEqual(clusterTop - 8);
  return rows.picker;
}

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
      await expect(picker.locator("button").first()).toBeVisible();
      await expect(picker.locator("button")).toHaveCount(3);
      // Small round portraits, clear of every control (portraitsClear).
      await portraitsClear(page, size);
      // Automatic: the nearest enemy (Kai).
      await aimNear(page, 650, 380);
      // Lock on to Rae from her portrait.
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

const SIZES = [
  { width: 667, height: 375 },
  { width: 844, height: 390 },
  { width: 852, height: 393 },
  { width: 932, height: 430 },
  { width: 844, height: 280 },
  // iPad landscape (Air / 10th gen), and the 9.7-inch one.
  { width: 1180, height: 820 },
  { width: 1024, height: 768 },
];
/** The controls re-lay out on the frame after a resize (slow here). */
async function settleResize(
  page: Page,
  size: { width: number; height: number },
) {
  await expect.poll(() => page.evaluate(() => innerWidth)).toBe(size.width);
  for (let i = 0; i < 2; i++)
    await page.evaluate(
      () =>
        new Promise((done) =>
          requestAnimationFrame(() => requestAnimationFrame(done)),
        ),
    );
  await page.waitForTimeout(300);
}
/** The same battle at every phone size and on iPads (a turn, a resize). */
async function sweep(page: Page, label: string, info: TestInfo) {
  const boxes: Record<string, number> = {};
  for (const size of SIZES) {
    await page.setViewportSize(size);
    await settleResize(page, size);
    const picker = await portraitsClear(page, size);
    boxes[`${size.width}x${size.height}`] = picker.length;
    await snap(page, info, `${label}-${size.width}x${size.height}`);
  }
  return boxes;
}

// Portraits instead of the old row of name pills: they never sit on a
// control or the top HUD at any phone size or on an iPad.
test("the target portraits clear every control at every phone size and on iPad", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    const errors = await ffa(page);
    await expect(page.locator("#target-picker button")).toHaveCount(3);
    // Faces for fighters, in the scoreboard's order from left to right.
    await expect(page.locator("#target-picker button img")).toHaveCount(3);
    expect(await sweep(page, "target-portraits-ffa", info)).toEqual(
      Object.fromEntries(SIZES.map((s) => [`${s.width}x${s.height}`, 3])),
    );
    const order = await page
      .locator("#target-picker button")
      .evaluateAll((bs) =>
        bs
          .map((b) => ({
            id: (b as HTMLElement).dataset.targetId,
            x: b.getBoundingClientRect().x,
          }))
          .sort((a, b) => a.x - b.x)
          .map((b) => b.id),
      );
    expect(order).toEqual(["p2", "p3", "p4"]);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("the target portraits are for touch play only", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await ffa(page);
  await page.waitForTimeout(500);
  await expect(page.locator("#target-picker")).toBeHidden();
});

// Owner, 7 Nov 2026: the row only answered when standing still. A browser
// makes a click only from the first finger on the screen, and while moving
// that finger is on the joystick; the row now answers the touch itself.
test("a target portrait answers a second finger while the other moves", async ({
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
    // A second finger taps Rae's portrait: locked, still moving.
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
  await createRoom(page);
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

// Inkpurr's copies (boss id "gloomshade") are not players, so phones used to
// aim only at the real one, and the find-the-real-one puzzle vanished. Every
// body (the real one and its copies alike, labels at random) and every unlit
// lantern can be picked.
test("phones pick among Inkpurr's bodies and its unlit lanterns", async ({
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
    await expect(picker.locator("button").first()).toBeVisible();
    // Three bodies and the lantern; the real body's button looks like the rest.
    await expect(picker.locator("button")).toHaveCount(4);
    const labels = await picker
      .locator("button")
      .evaluateAll((bs) => bs.map((b) => b.getAttribute("aria-label") ?? ""));
    expect(labels.filter((t) => /^Inkpurr [A-C]$/.test(t))).toHaveLength(3);
    expect(labels.filter((t) => t === "Lantern NW")).toHaveLength(1);
    // Marks, not names: each body's letter, the lantern's corner.
    expect((await picker.locator("button").allTextContents()).sort()).toEqual([
      "A",
      "B",
      "C",
      "NW",
    ]);
    await portraitsClear(page, size);
    // The raid's bar and timer too, at every size (four portraits: the row
    // is full).
    expect(await sweep(page, "target-portraits-gloom", info)).toEqual(
      Object.fromEntries(SIZES.map((s) => [`${s.width}x${s.height}`, 4])),
    );
    await page.setViewportSize(size);
    await settleResize(page, size);
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
    // The lantern from its portrait: aim goes to its glass.
    await picker.locator('button[data-target-id="lantern:0"]').tap();
    await aimNear(page, lantern.x, lantern.y);
    // Relit: its portrait goes, and aim falls back to the nearest body.
    await page.evaluate(() => {
      const w = window as any;
      w.__snap.raid.lanterns[0].lit = true;
      w.__push();
    });
    await expect(picker.locator("button")).toHaveCount(3);
    await aimNear(page, 640, 380);
    // A popped copy's portrait goes (one body left: none).
    await page.evaluate(() => {
      const w = window as any;
      w.__snap.raid.decoys = [];
      w.__push();
    });
    await expect(picker.locator("button").first()).toBeHidden();
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
    // The battle is live once it sends inputs (no portraits says
    // nothing yet: it is hidden before the battle starts, too).
    await expect.poll(() => lastAim(page), { timeout: 60_000 }).toBeTruthy();
    // One enemy, no bubble: no row, aim on the boss.
    await expect(picker.locator("button").first()).toBeHidden();
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
    // The bubble shows the teammate inside it (their face), named aloud.
    const bubble = picker.locator('button[data-target-id="bubble:p2"]');
    await expect(bubble).toHaveAttribute("aria-label", "Free Kai");
    await expect(bubble.locator("img")).toHaveCount(1);
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
    await expect(picker.locator("button").first()).toBeHidden();
    await aimNear(page, 900, 330);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
