import { expect, test } from "@playwright/test";
import { CHARACTERS } from "../../packages/shared/src/index";
import { openHub, openPlayPanel, pushUntilBattle, createRoom } from "./helpers";

/**
 * Shots are drawn on your timeline (apps/client/src/networking/timeline-lead.ts):
 * past the last snapshot by the inputs the server has not answered, moving
 * smoothly between snapshots, an opponent's easing in from its snapshot.
 * Before, every shot sat where the last snapshot had it, so it moved in
 * 15 Hz steps and was drawn a round trip behind where it hit you.
 */
test("shots run on from their snapshot to where the server will have them", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.route(/\/apps\/client\/src\/main\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const hook =
      "const drawn = leadProjectile(pr, seconds, walls, slow, hits);";
    expect(body).toContain(hook);
    await route.fulfill({
      response,
      body: body.replace(
        hook,
        `${hook} window.__drawnShots?.push([drawn.id, drawn.x, drawn.y]);`,
      ),
    });
  });
  const errors = await openHub(page);
  await page.evaluate(() =>
    (window as any).__room("pvp", {
      mode: "duel",
      phase: "playing",
      pos: [150, 120, 800, 560],
    }),
  );
  await openPlayPanel(page);
  await createRoom(page);
  await pushUntilBattle(page);
  const speed = 300;
  const drawn = await page.evaluate(
    async ({ abilityId, speed }) => {
      const w = window as any;
      const shot = (id: number, owner: string, y: number) => ({
        id,
        owner,
        x: 200,
        y,
        vx: speed,
        vy: 0,
        remaining: 5000,
        // Snapshots travel packed: the client rebuilds the ability from its id.
        abilityId,
        color: 0xffd23f,
      });
      // Snapshots at the server's 15 Hz first, so your timeline sits on its
      // steady lead. After the gaps above (300 ms and more) it had run on to
      // its 0.3 s cap, and the shots' snapshot then eased it back down
      // (LocalTimeline.lead): drawn shots stepped back (285.50 after 285.85,
      // CI 19 Nov), a correction this test does not mean to measure.
      for (let i = 0; i < 8; i++) {
        w.__push();
        await new Promise((r) => setTimeout(r, 1000 / 15));
      }
      // Mid-court lanes with no cover on the classic court's rows.
      w.__snap.projectiles = [shot(950, "me", 60), shot(951, "p2", 640)];
      w.__drawnShots = [];
      w.__push();
      // No snapshot follows: the shots run on by themselves.
      await new Promise((r) => setTimeout(r, 2500));
      const seen = w.__drawnShots as [number, number, number][];
      w.__drawnShots = undefined;
      return seen;
    },
    { abilityId: CHARACTERS.voltkit.basic.id, speed },
  );
  const mine = drawn.filter(([id]) => id === 950).map(([, x]) => x);
  const theirs = drawn.filter(([id]) => id === 951).map(([, x]) => x);
  expect(mine.length).toBeGreaterThan(2);
  expect(theirs.length).toBeGreaterThan(2);
  // Past the snapshot, and never past the 0.3 s cap (a stall, not latency).
  const cap = 200 + speed * 0.3 + 0.01;
  for (const x of [...mine, ...theirs]) {
    expect(x).toBeGreaterThanOrEqual(200);
    expect(x).toBeLessThanOrEqual(cap);
  }
  expect(Math.max(...mine)).toBeGreaterThan(200 + speed * 0.25);
  expect(Math.max(...theirs)).toBeGreaterThan(200 + speed * 0.25);
  // They move forward frame by frame, never back.
  for (const xs of [mine, theirs])
    for (let i = 1; i < xs.length; i++)
      expect(xs[i]).toBeGreaterThanOrEqual(xs[i - 1] - 1e-6);
  // Yours is on your timeline at once; an opponent's eases in after it.
  expect(theirs[0]).toBeLessThanOrEqual(mine[0] + 1e-6);
  expect(errors).toEqual([]);
});

/**
 * Player report (22-23 Nov 2026): your shot reached the target, then waited
 * on it a round trip before its blast went off. Now a shot reaching a
 * fighter standing still plays its blast at once, and the server's impact
 * for it plays nothing more (timeline-lead.ts ImpactPrediction).
 */
test("your shot's blast plays when it reaches a still target, once", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.route(
    /\/apps\/client\/src\/skill-effects\.ts(?:\?|$)/,
    async (route) => {
      const response = await route.fetch(),
        body = await response.text();
      const marker = "export function playImpact(";
      expect(body).toContain(marker);
      await route.fulfill({
        response,
        body: body.replace(
          marker,
          "export function playImpact(...a) { (window.__impacts ??= []).push(a[1].id); return playImpactNow(...a); }\nfunction playImpactNow(",
        ),
      });
    },
  );
  const errors = await openHub(page);
  await page.evaluate(() =>
    (window as any).__room("pvp", {
      mode: "duel",
      phase: "playing",
      pos: [150, 120, 800, 560],
    }),
  );
  await openPlayPanel(page);
  await createRoom(page);
  await pushUntilBattle(page);
  const abilityId = CHARACTERS.voltkit.basic.id;
  const seen = await page.evaluate(
    async ({ abilityId }) => {
      const w = window as any;
      // Steady snapshots first, so p2 is drawn where the server has it.
      for (let i = 0; i < 10; i++) {
        w.__push();
        await new Promise((r) => setTimeout(r, 1000 / 15));
      }
      w.__impacts = [];
      // Your shot just short of p2's edge (p2 at 800,560), flying at it.
      w.__snap.projectiles = [
        {
          id: 960,
          owner: "me",
          x: 680,
          y: 560,
          vx: 600,
          vy: 0,
          remaining: 600,
          abilityId,
          color: 0xffd23f,
        },
      ];
      w.__push();
      await new Promise((r) => setTimeout(r, 450));
      const early = (w.__impacts as unknown[]).length;
      // The server's impact for it, a round trip later.
      w.__snap.projectiles = [];
      w.__snap.events = [
        {
          id: 95000,
          kind: "impact",
          owner: "me",
          abilityId,
          x: 765,
          y: 560,
          color: 0xffd23f,
        },
      ];
      w.__push();
      w.__snap.events = [];
      await new Promise((r) => setTimeout(r, 200));
      // Another of your impacts the client never predicted (a wall, say)
      // still plays.
      w.__snap.events = [
        {
          id: 95001,
          kind: "impact",
          owner: "me",
          abilityId,
          x: 300,
          y: 300,
          color: 0xffd23f,
        },
      ];
      w.__push();
      w.__snap.events = [];
      await new Promise((r) => setTimeout(r, 200));
      return { early, total: (w.__impacts as unknown[]).length };
    },
    { abilityId },
  );
  // Played before the server said so, not again when it did; the wall
  // impact on top.
  expect(seen).toEqual({ early: 1, total: 2 });
  expect(errors).toEqual([]);
});

/**
 * Player report (23 Nov 2026): a delayed blast of yours ran out its ring a
 * round trip before the damage showed up. Your zones now count down on the
 * snapshot's clock (where their hits arrive), an opponent's still on your
 * timeline (the time you have to get out): timeline-lead.ts zoneClock.
 */
test("your zone counts down on the snapshot's clock, an opponent's on yours", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.route(
    /\/apps\/client\/src\/skill-effects\.ts(?:\?|$)/,
    async (route) => {
      const response = await route.fetch(),
        body = await response.text();
      const marker = "export function drawZone(";
      expect(body).toContain(marker);
      await route.fulfill({
        response,
        body: body.replace(
          marker,
          "export function drawZone(...a) { (window.__zoneProgress ??= {})[a[1].id] = a[2]; return drawZoneNow(...a); }\nfunction drawZoneNow(",
        ),
      });
    },
  );
  const errors = await openHub(page);
  await page.evaluate(() =>
    (window as any).__room("pvp", {
      mode: "duel",
      phase: "playing",
      pos: [150, 120, 800, 560],
    }),
  );
  await openPlayPanel(page);
  await createRoom(page);
  await pushUntilBattle(page);
  const abilityId = CHARACTERS.cindrake.skills[1].id;
  const progress = await page.evaluate(
    async ({ abilityId }) => {
      const w = window as any;
      for (let i = 0; i < 8; i++) {
        w.__push();
        await new Promise((r) => setTimeout(r, 1000 / 15));
      }
      const t = w.__snap.time;
      const zone = (id: number, owner: string, x: number) => ({
        id,
        owner,
        x,
        y: 450,
        radius: 60,
        until: t + 2,
        nextTick: t + 9,
        abilityId,
        color: 0xff7a3d,
      });
      // The same timer: one yours, one your opponent's.
      w.__snap.zones = [zone(970, "me", 400), zone(971, "p2", 1200)];
      w.__zoneProgress = {};
      w.__push();
      await new Promise((r) => setTimeout(r, 250));
      const seen = { ...w.__zoneProgress };
      w.__snap.zones = [];
      w.__push();
      return seen;
    },
    { abilityId },
  );
  expect(progress[970]).toBeDefined();
  expect(progress[971]).toBeDefined();
  // Your timeline runs ahead of the snapshot's clock by the unanswered
  // inputs: the opponent's ring is further along than yours.
  expect(progress[971]).toBeGreaterThan(progress[970] + 0.005);
  expect(errors).toEqual([]);
});
