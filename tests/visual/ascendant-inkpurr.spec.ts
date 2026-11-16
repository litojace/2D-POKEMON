import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  createRoom,
  openHub,
  openPlayPanel,
  pushUntilBattle,
  snap,
} from "./helpers";

// Ascendant Inkpurr (the Spire's thirtieth floor, Gloomshade's id) in the
// real raid scene, on phones first: its two new attacks' warnings must be on
// screen, readable and never under the HUD or the touch controls.
// - Nightfall: the yard darkens and the dark closes in; each pool of
//   moonlight (a pale disc, a crescent, a timer) and every lit lantern's
//   gold ring is where to stand; an eclipse icon says it can't be jumped.
// - Shade Pounce: the bodies' dashed leaps, each exact circle with a paw
//   and its order in dots (inside, below the paw: name tags sit above).
// The server's own combat runs in the page (boss-combat-demo.ts).
const SIZES = [
  { name: "844x390", width: 844, height: 390, phone: true },
  { name: "667x375", width: 667, height: 375, phone: true },
  { name: "desktop", width: 1280, height: 720, phone: false },
];

async function raid(page: Page) {
  await page.route(/\/apps\/client\/src\/main\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch(),
      body = await response.text();
    const marker =
      "gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);";
    expect(body).toContain(marker);
    await route.fulfill({
      response,
      body: body.replace(marker, "window.__battle=gameInstance;" + marker),
    });
  });
  const errors = await openHub(page);
  await page.evaluate(() =>
    (window as any).__room("raid", {
      boss: "gloomshade",
      pos: [600, 520, 1000, 380],
    }),
  );
  await openPlayPanel(page);
  await createRoom(page);
  await pushUntilBattle(page);
  await page.evaluate(async () => {
    const { createBossCombatDemo } = await import("/boss-combat-demo.ts");
    (window as any).__combat = createBossCombatDemo(
      "gloomshade",
      true,
      false,
      "ascendant",
    );
  });
  return errors;
}
/** Run the server for `seconds`, a drawn frame after every few 1/30 s steps. */
const run = (page: Page, seconds: number, every = 3) =>
  page.evaluate(
    async ([seconds, every]) => {
      const c = (window as any).__combat;
      for (let i = 0; i < Math.round(seconds * 30); i++) {
        c.step(1 / 30);
        if (i % every === every - 1)
          await new Promise((r) =>
            requestAnimationFrame(() => requestAnimationFrame(r)),
          );
      }
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      );
    },
    [seconds, every],
  );
/** Put the two raiders somewhere and hold them still (the demo walks them). */
const stand = (page: Page, spots: [number, number][]) =>
  page.evaluate((spots) => {
    const a = (window as any).__combat.arena;
    a.heroes().forEach((p: any, i: number) => {
      if (!spots[i]) return;
      p.x = spots[i][0];
      p.y = spots[i][1];
      p.vx = p.vy = 0;
    });
  }, spots);
/** World points → page pixels through the battle camera. */
const onScreen = (page: Page, pts: { x: number; y: number }[]) =>
  page.evaluate((pts) => {
    const w = window as any;
    const scene = w.__battle.scene
      .getScenes(true)
      .find((s: any) => s.cameras?.main && s.children.list.length > 20);
    const cam = scene.cameras.main,
      canvas = w.__battle.canvas as HTMLCanvasElement;
    const r = canvas.getBoundingClientRect(),
      k = r.width / canvas.width;
    return pts.map((p) => {
      const v = cam.worldView;
      return {
        x: r.x + (cam.x + (p.x - v.x) * cam.zoom) * k,
        y: r.y + (cam.y + (p.y - v.y) * cam.zoom) * k,
        scale: cam.zoom * k,
      };
    });
  }, pts);
/** The HUD's and touch controls' boxes (page pixels). */
const covers = (page: Page) =>
  page.evaluate(() =>
    [
      ...document.querySelectorAll(
        "#raid-hud [data-hud], #raid-hud .raid-callout, .touch-buttons button, .joystick",
      ),
    ]
      .filter((e) => (e as HTMLElement).offsetWidth)
      .map((e) => {
        const r = e.getBoundingClientRect();
        return {
          what: (e as HTMLElement).dataset.hud ?? e.className,
          x: r.x,
          y: r.y,
          right: r.right,
          bottom: r.bottom,
        };
      }),
  );
/**
 * Is this mark (page centre, radius) on screen and clear of every HUD box
 * and touch control? Returns what covers it, if anything.
 */
function hidden(
  mark: { x: number; y: number; r: number },
  boxes: Awaited<ReturnType<typeof covers>>,
  size: { width: number; height: number },
) {
  if (
    mark.x - mark.r < 0 ||
    mark.y - mark.r < 0 ||
    mark.x + mark.r > size.width ||
    mark.y + mark.r > size.height
  )
    return "off screen";
  return boxes.find(
    (b) =>
      mark.x + mark.r > b.x &&
      mark.x - mark.r < b.right &&
      mark.y + mark.r > b.y &&
      mark.y - mark.r < b.bottom,
  )?.what;
}
const context = (browser: Browser, s: (typeof SIZES)[number]) =>
  browser.newContext({
    viewport: { width: s.width, height: s.height },
    deviceScaleFactor: 2,
    ...(s.phone ? { isMobile: true, hasTouch: true } : {}),
  });

for (const s of SIZES)
  test(`Ascendant Inkpurr's Nightfall and Shade Pounce read at ${s.name}`, async ({
    browser,
  }, info) => {
    test.setTimeout(600_000);
    const ctx = await context(browser, s);
    try {
      const page = await ctx.newPage();
      const errors = await raid(page);
      await run(page, 0.4);
      // It splits (three copies), so every body pounces.
      await page.evaluate(() => (window as any).__combat.cast("split"));
      await run(page, 2.2);
      expect(
        await page.evaluate(
          () => (window as any).__combat.arena.raid.decoys.length,
        ),
      ).toBeGreaterThan(0);

      // Nightfall: a lantern out, the raiders in the dark.
      await page.evaluate(() => {
        const a = (window as any).__combat.arena;
        a.raid.lanterns[1].lit = false;
        a.raid.lanterns[2].lit = false;
      });
      await stand(page, [
        [760, 520],
        [1040, 380],
      ]);
      await page.evaluate(() => (window as any).__combat.cast("nightfall"));
      await run(page, 0.9, 1);
      const night = await page.evaluate(() => {
        const a = (window as any).__combat.arena;
        const w = a.raid.warnings.find((x: any) => x.kind === "nightfall");
        const me = a.heroes()[0];
        return { pools: w?.pools ?? [], me: { x: me.x, y: me.y } };
      });
      expect(night.pools.length).toBeGreaterThan(0);
      // The pool nearest me is on screen, big enough to read, and uncovered.
      const pool = [...night.pools].sort(
        (a: any, b: any) =>
          Math.hypot(a.x - night.me.x, a.y - night.me.y) -
          Math.hypot(b.x - night.me.x, b.y - night.me.y),
      )[0];
      const [pc] = await onScreen(page, [pool]);
      const boxes = await covers(page);
      expect(pool.radius * pc.scale, "pool radius on screen").toBeGreaterThan(
        22,
      );
      // its crescent (the middle) is never covered; most of the disc shows
      expect(
        hidden({ x: pc.x, y: pc.y, r: 16 * pc.scale + 4 }, boxes, s),
        "pool crescent",
      ).toBeUndefined();
      await snap(page, info, `asc-ink-nightfall-${s.name}`);
      // Landed: the pools linger as moonlight.
      await run(page, 1.3, 1);
      await snap(page, info, `asc-ink-nightfall-landed-${s.name}`);
      await run(page, 3);

      // Shade Pounce at me: the copies first, the real one last.
      await stand(page, [
        [700, 560],
        [1040, 360],
      ]);
      await page.evaluate(() => (window as any).__combat.cast("pounce"));
      await run(page, 0.5, 1);
      const circles = await page.evaluate(() =>
        (window as any).__combat.arena.raid.warnings
          .filter((w: any) => w.kind === "pounce")
          .map((w: any) => ({
            x: w.x,
            y: w.y,
            radius: w.radius,
            chain: w.chain,
            body: w.body,
          })),
      );
      expect(circles.length).toBeGreaterThanOrEqual(2);
      expect(circles.at(-1).body).toBe(0);
      const marks = await onScreen(
        page,
        circles.flatMap((c: any) => [
          { x: c.x, y: c.y },
          { x: c.x, y: c.y + c.radius * 0.55 },
        ]),
      );
      const near = await page.evaluate(() => {
        const me = (window as any).__combat.arena.heroes()[0];
        return { x: me.x, y: me.y };
      });
      const after = await covers(page);
      circles.forEach((c: any, i: number) => {
        const centre = marks[i * 2],
          dots = marks[i * 2 + 1];
        expect(c.radius * centre.scale, "circle on screen").toBeGreaterThan(20);
        // The circles at me: paw and order dots in sight, uncovered.
        if (Math.hypot(c.x - near.x, c.y - near.y) > 260) return;
        expect(
          hidden({ x: centre.x, y: centre.y, r: 22 * centre.scale }, after, s),
          `circle ${c.chain} paw`,
        ).toBeUndefined();
        expect(
          hidden({ x: dots.x, y: dots.y, r: 9 * dots.scale + 2 }, after, s),
          `circle ${c.chain} dots`,
        ).toBeUndefined();
      });
      await snap(page, info, `asc-ink-pounce-${s.name}`);
      // The leaps land: the bodies on their circles, a splash of ink.
      await run(page, 1.0, 1);
      await snap(page, info, `asc-ink-pounce-landed-${s.name}`);
      expect(errors).toEqual([]);
    } finally {
      await ctx.close();
    }
  });
