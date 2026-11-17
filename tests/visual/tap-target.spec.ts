import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  openHub,
  pushUntilBattle,
  snap,
  openPlayPanel,
  createRoom,
} from "./helpers";
import { decodePng } from "./png";
import { RETICLE_RX, RETICLE_RY } from "../../apps/client/src/target-lock";

// Phones aim at the nearest enemy. To aim at another one, tap it on the
// court (tap it again for automatic aiming). There is no target row: the
// owner removed it (16 Nov 2026: it took too much room over the buttons).

const PHONES = [
  { width: 844, height: 390 },
  { width: 667, height: 375 },
];

/** Expose the battle's game and the tap lock (main.ts, through the route). */
async function hook(page: Page) {
  await page.route(/\/apps\/client\/src\/main\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch(),
      body = await response.text();
    const game =
      "gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);";
    const lock = "const targetLock = new TargetLock();";
    expect(body).toContain(game);
    expect(body).toContain(lock);
    await route.fulfill({
      response,
      body: body
        .replace(game, "window.__targetGame=gameInstance;" + game)
        .replace(lock, lock + "window.__targetLock=targetLock;"),
    });
  });
}
const lockedId = (page: Page) =>
  page.evaluate(() => (window as any).__targetLock.id as string | undefined);

async function phone(
  browser: Browser,
  size: { width: number; height: number },
) {
  return browser.newContext({ viewport: size, isMobile: true, hasTouch: true });
}

/** A free-for-all with three enemies: Kai nearest, Rae and Mina farther. */
async function ffa(page: Page) {
  await hook(page);
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
/** A raid on a phone, with only the fighters in `keep` beside the boss. */
async function raidBattle(page: Page, boss: string, keep: string[]) {
  await hook(page);
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

/** A world point on the screen (CSS px), and CSS px per court unit. */
const toScreen = (page: Page, x: number, y: number) =>
  page.evaluate(
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
        sx: canvas.width / v.width,
        sy: canvas.height / v.height,
      };
    },
    [x, y],
  );
/** Tap the court at a world point (one finger). */
async function tapWorld(page: Page, x: number, y: number) {
  const s = await toScreen(page, x, y);
  // On the court, not on a control.
  const on = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x, y)?.tagName,
    [s.x, s.y],
  );
  expect(on, `a tap at ${x},${y} lands on the court`).toBe("CANVAS");
  await page.touchscreen.tap(s.x, s.y);
}

/**
 * How much of the lock marker shows around a world point on the floor: the
 * share of the marker's ring (where its red corner brackets turn) covered by
 * its bright red, read from a screenshot. A fighter's drawn feet sit a little
 * below its court point, so the ring is looked for up to 50 units lower.
 */
async function markerAt(page: Page, x: number, feetY: number) {
  const c = await toScreen(page, x, feetY);
  const shot = decodePng(await page.screenshot({ scale: "css" }));
  const rx = RETICLE_RX * c.sx,
    ry = RETICLE_RY * c.sy;
  let best = 0;
  for (let drop = 0; drop <= 50; drop += 5) {
    const cy = c.y + drop * c.sy;
    let red = 0,
      ring = 0;
    for (let py = Math.floor(cy - ry * 1.3); py <= cy + ry * 1.3; py++)
      for (let px = Math.floor(c.x - rx * 1.3); px <= c.x + rx * 1.3; px++) {
        if (px < 0 || py < 0 || px >= shot.width || py >= shot.height) continue;
        // The marker's ring on the floor, a little either way.
        const d = Math.hypot((px - c.x) / rx, (py - cy) / ry);
        if (d < 0.8 || d > 1.2) continue;
        ring++;
        const i = (py * shot.width + px) * 4;
        const [r, g, b] = [shot.data[i], shot.data[i + 1], shot.data[i + 2]];
        if (r > 200 && g < 140 && b < 160 && r - g > 90) red++;
      }
    if (ring) best = Math.max(best, red / ring);
  }
  return best;
}
/**
 * The marker is on `at`, or not: against `bare`, the same reading before
 * any lock (an enemy's own red team ring and red art count there too).
 */
async function expectMarker(
  page: Page,
  at: { x: number; y: number },
  shown: boolean,
  bare: number,
) {
  const poll = expect.poll(() => markerAt(page, at.x, at.y), {
    timeout: 8000,
  });
  if (shown) await poll.toBeGreaterThan(bare + 0.06);
  else await poll.toBeLessThan(bare + 0.03);
}
const noTargetRow = (page: Page) =>
  expect(page.locator("#target-picker")).toHaveCount(0);

for (const size of PHONES)
  test(`phones lock on by tapping an enemy on the court (${size.width}x${size.height})`, async ({
    browser,
  }, info) => {
    const context = await phone(browser, size);
    try {
      const page = await context.newPage();
      const errors = await ffa(page);
      await noTargetRow(page);
      // Automatic: the nearest enemy (Kai), no marker on anyone.
      await aimNear(page, 650, 380);
      expect(await lockedId(page)).toBeUndefined();
      await page.waitForTimeout(300);
      const bare = await markerAt(page, 1000, 200);
      await snap(
        page,
        info,
        `tap-target-pvp-auto-${size.width}x${size.height}`,
      );
      // Tap Rae (her body, above her feet): locked, the marker on her.
      await tapWorld(page, 1000, 160);
      await expect.poll(() => lockedId(page)).toBe("p3");
      await aimNear(page, 1000, 200);
      await snap(page, info, `tap-target-pvp-${size.width}x${size.height}`);
      await expectMarker(page, { x: 1000, y: 200 }, true, bare);
      // Again: back to automatic aiming, the marker gone.
      await tapWorld(page, 1000, 160);
      await expect.poll(() => lockedId(page)).toBeUndefined();
      await aimNear(page, 650, 380);
      await expectMarker(page, { x: 1000, y: 200 }, false, bare);
      // Mina: locked; a tap on empty ground keeps her.
      await tapWorld(page, 900, 300);
      await expect.poll(() => lockedId(page)).toBe("p4");
      await aimNear(page, 900, 330);
      await tapWorld(page, 780, 470);
      await page.waitForTimeout(400);
      expect(await lockedId(page)).toBe("p4");
      await aimNear(page, 900, 330);
      // Defeated: the lock ends (it does not come back with her), aim
      // returns to the nearest.
      await page.evaluate(() => {
        const w = window as any;
        w.__snap.players.find((p: any) => p.id === "p4").hp = 0;
        w.__push();
      });
      await expect.poll(() => lockedId(page)).toBeUndefined();
      await aimNear(page, 650, 380);
      await page.evaluate(() => {
        const w = window as any;
        w.__snap.players.find((p: any) => p.id === "p4").hp = 100;
        w.__push();
      });
      await page.waitForTimeout(400);
      expect(await lockedId(page)).toBeUndefined();
      await aimNear(page, 650, 380);
      await noTargetRow(page);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

// A browser makes a click only from the first finger, and while moving that
// finger holds the joystick: a court tap must still reach the game (Phaser
// takes up to four touches, `input.activePointers` in main.ts).
for (const size of PHONES)
  test(`a second finger on the court locks while the other moves (${size.width}x${size.height})`, async ({
    browser,
  }) => {
    const context = await phone(browser, size);
    try {
      const page = await context.newPage();
      const errors = await ffa(page);
      const cdp = await context.newCDPSession(page);
      const b = (await page
        .locator("#mobile-controls .joystick")
        .boundingBox())!;
      const thumb = { x: b.x + b.width / 2 + 30, y: b.y + b.height / 2, id: 1 };
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
      const held = { ...thumb, x: thumb.x + 10 };
      // The thumb holds the stick to the right: moving.
      await touch("touchStart", [thumb]);
      await touch("touchMove", [held]);
      await expect.poll(moving).toBe(true);
      // Rae stays put on the court while you move (the fake server).
      const rae = await toScreen(page, 1000, 160);
      const tap = async () => {
        await touch("touchStart", [held, { x: rae.x, y: rae.y, id: 2 }]);
        // Lifting the tapping finger only (touchEnd lifts the points it lists).
        await touch("touchEnd", [{ x: rae.x, y: rae.y, id: 2 }]);
      };
      await tap();
      await expect.poll(() => lockedId(page)).toBe("p3");
      await aimNear(page, 1000, 200);
      expect(await moving()).toBe(true);
      // Again: automatic, once (no double toggle).
      await page.waitForTimeout(300);
      await tap();
      await expect.poll(() => lockedId(page)).toBeUndefined();
      await page.waitForTimeout(800);
      expect(await lockedId(page)).toBeUndefined();
      expect(await moving()).toBe(true);
      await touch("touchEnd", [held]);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

test("taps lock on to Inkpurr's bodies and its unlit lanterns", async ({
  browser,
}, info) => {
  const context = await phone(browser, PHONES[0]);
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
    await noTargetRow(page);
    const lantern = await page.evaluate(
      () => (window as any).__snap.raid.lanterns[0],
    );
    // Automatic: the nearest body, here a copy (not the real one).
    await aimNear(page, 640, 380);
    const bare = await markerAt(page, 1100, 520);
    // A tap on the far copy locks it.
    await tapWorld(page, 1100, 490);
    await expect.poll(() => lockedId(page)).toBe("shade:52");
    await aimNear(page, 1100, 520);
    await snap(page, info, "tap-target-inkpurr-copy");
    await expectMarker(page, { x: 1100, y: 520 }, true, bare);
    // A copy that pops ends its lock.
    await page.evaluate(() => {
      const w = window as any;
      w.__snap.raid.decoys = [{ id: 51, x: 640, y: 380 }];
      w.__push();
    });
    await expect.poll(() => lockedId(page)).toBeUndefined();
    // The unlit lantern: aim goes to its glass.
    await tapWorld(page, lantern.x, lantern.y);
    await expect.poll(() => lockedId(page)).toBe("lantern:0");
    await aimNear(page, lantern.x, lantern.y);
    // Relit: the lock ends, aim falls back to the nearest body.
    await page.evaluate(() => {
      const w = window as any;
      w.__snap.raid.lanterns[0].lit = true;
      w.__push();
    });
    await expect.poll(() => lockedId(page)).toBeUndefined();
    await aimNear(page, 640, 380);
    await noTargetRow(page);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

// Tidewyrm seals raiders in bubbles that teammates pop with three hits; a
// tap on the bubble aims at it, or aim stays on the boss.
test("a tap aims at the bubble holding a teammate", async ({ browser }) => {
  const context = await phone(browser, PHONES[0]);
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
    await expect.poll(() => lastAim(page), { timeout: 60_000 }).toBeTruthy();
    await noTargetRow(page);
    // Still the boss until you choose.
    await aimNear(page, 900, 330);
    await tapWorld(page, 760, 545);
    await expect.poll(() => lockedId(page)).toBe("bubble:p2");
    await aimNear(page, 760, 560);
    // Popped: the lock ends, back to the boss.
    await page.evaluate(() => {
      const w = window as any;
      w.__snap.raid.prisons = [];
      w.__push();
    });
    await expect.poll(() => lockedId(page)).toBeUndefined();
    await aimNear(page, 900, 330);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

// The Spire's Echoes are fighters on the other side: a tap locks one, and
// its defeat ends the lock.
test("a tap locks on to a Spire Echo", async ({ browser }, info) => {
  test.setTimeout(120_000);
  const context = await phone(browser, PHONES[0]);
  try {
    const page = await context.newPage();
    await hook(page);
    const errors = await openHub(page);
    await page.evaluate(() => {
      const w = window as any;
      w.__events = [];
      w.__emit = (event: string, data: unknown) =>
        w.__events.push({ event, data });
      // Floor 2 opens with two Echoes.
      w.__room("spire", { stage: "playing", floor: 2 });
    });
    await openPlayPanel(page);
    await createRoom(page);
    await pushUntilBattle(page);
    // Two Echoes out, placed: one near you, one farther off.
    await page.evaluate(() => {
      const w = window as any,
        alive = () =>
          w.__spireArena.players.filter((p: any) => p.echo && p.hp > 0).length;
      for (let i = 0; i < 40 && alive() < 2; i++) w.__spireStep(0.5);
    });
    const [near, far] = await page.evaluate(() => {
      const w = window as any,
        a = w.__spireArena;
      const me = a.players.find((p: any) => p.id === "me");
      Object.assign(me, { x: 600, y: 420 });
      const echoes = a.players.filter((p: any) => p.echo && p.hp > 0);
      for (const e of echoes.slice(2)) e.hp = 0;
      Object.assign(echoes[0], { x: 720, y: 440 });
      Object.assign(echoes[1], { x: 1000, y: 660 });
      w.__spireStep(0);
      return echoes.slice(0, 2).map((e: any) => e.id as string);
    });
    await noTargetRow(page);
    await expect.poll(() => lastAim(page), { timeout: 60_000 }).toBeTruthy();
    // (The snapshot with the Echoes placed reaches the client.)
    await page.waitForTimeout(1000);
    await aimNear(page, 720, 440);
    const bare = await markerAt(page, 1000, 660);
    // The Echoes hold still (the arena only runs on __spireStep).
    await tapWorld(page, 1000, 620);
    await expect.poll(() => lockedId(page)).toBe(far);
    await aimNear(page, 1000, 660);
    await snap(page, info, "tap-target-spire-echo");
    await expectMarker(page, { x: 1000, y: 660 }, true, bare);
    // Beaten: the lock ends, aim goes to the other Echo.
    await page.evaluate((id) => {
      const w = window as any;
      w.__spireArena.players.find((p: any) => p.id === id).hp = 0;
      w.__spireStep(0);
    }, far);
    await expect.poll(() => lockedId(page)).toBeUndefined();
    await aimNear(page, 720, 440);
    expect(near).not.toBe(far);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("the court tap is for touch play only", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await ffa(page);
  await page.waitForTimeout(500);
  await noTargetRow(page);
  await page.mouse.click(
    ...(await toScreen(page, 1000, 160).then((s) => [s.x, s.y] as const)),
  );
  await page.waitForTimeout(400);
  expect(await lockedId(page)).toBeUndefined();
});
