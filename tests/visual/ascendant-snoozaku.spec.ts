import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  createRoom,
  openHub,
  openPlayPanel,
  pushUntilBattle,
  snap,
} from "./helpers";

// Ascendant Snoozaku (the Spire's fortieth floor, Somnara's id) in the real
// raid scene, on phones first: its two new attacks must be readable and
// nothing a raider must see may sit under the HUD or the touch controls.
// - Dream Tide: sleep mist closing in; every pad's awake ring dashed at its
//   exact size; the Seer marked for everyone (a speech bubble); the Seer's
//   own plaque and rune panel show the awake rune; once called, that pad's
//   ring lights up with a countdown. An eclipse icon: it can't be jumped.
// - Twin Dream: a thread between the two Dreamers with their order dots;
//   my plaque shows my runes and "?" for my partner's.
// The server's own combat runs in the page (boss-combat-demo.ts), with my
// private dream view added to each snapshot as the server sends it.
const SIZES = [
  { name: "844x390", width: 844, height: 390, phone: true },
  { name: "667x375", width: 667, height: 375, phone: true },
  { name: "desktop", width: 1280, height: 720, phone: false },
];
const PADS = {
  circle: { x: 530, y: 250 },
  star: { x: 1070, y: 250 },
  moon: { x: 960, y: 650 },
  wave: { x: 640, y: 650 },
};

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
      boss: "somnara",
      pos: [600, 520, 1000, 380],
    }),
  );
  await openPlayPanel(page);
  await createRoom(page);
  await pushUntilBattle(page);
  await page.evaluate(async () => {
    const { createBossCombatDemo } = await import("/boss-combat-demo.ts");
    const c = createBossCombatDemo("somnara", true, false, "ascendant");
    // The server sends each raider their own view of the dream.
    const snapshot = c.arena.snapshot.bind(c.arena);
    (c.arena as any).snapshot = (...args: unknown[]) => ({
      ...snapshot(...(args as [])),
      raidDream: c.arena.dreamFor("me"),
    });
    (window as any).__combat = c;
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
/** Draw a few frames without moving the fight on (time stands still). */
const frames = (page: Page, n = 4) =>
  page.evaluate(async (n) => {
    const c = (window as any).__combat;
    for (let i = 0; i < n; i++) {
      c.snapshot();
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      );
    }
  }, n);
/** Where the raiders stand now (me first). */
const heroes = (page: Page) =>
  page.evaluate(() =>
    (window as any).__combat.arena
      .heroes()
      .map((p: any) => ({ x: p.x, y: p.y })),
  ) as Promise<{ x: number; y: number }[]>;
/** Put the raiders somewhere and hold them still (the demo walks them). */
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
        "#raid-hud [data-hud], #raid-hud .raid-callout, .touch-buttons button, .joystick, #raid-dream-panel",
      ),
    ]
      .filter((e) => (e as HTMLElement).offsetWidth)
      .map((e) => {
        const r = e.getBoundingClientRect();
        return {
          what: (e as HTMLElement).dataset.hud ?? (e.id || e.className),
          x: r.x,
          y: r.y,
          right: r.right,
          bottom: r.bottom,
        };
      }),
  );
/** What covers this mark (page centre, radius), if anything (or off screen). */
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
/** Share of a ring's disc (world centre, radius) under the touch controls or off screen. */
async function coveredShare(
  page: Page,
  c: { x: number; y: number },
  radius: number,
  controls: Awaited<ReturnType<typeof covers>>,
  size: { width: number; height: number },
) {
  const ring = [{ x: c.x, y: c.y }];
  for (let k = 1; k <= 3; k++)
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ring.push({
        x: c.x + (Math.cos(a) * radius * k) / 3,
        y: c.y + (Math.sin(a) * radius * k) / 3,
      });
    }
  const pts = await onScreen(page, ring);
  const under = (p: { x: number; y: number }) =>
    controls.some(
      (b) => p.x > b.x && p.x < b.right && p.y > b.y && p.y < b.bottom,
    ) ||
    p.x < 0 ||
    p.y < 0 ||
    p.x > size.width ||
    p.y > size.height;
  return {
    centre: under(pts[0]),
    share: pts.slice(1).filter(under).length / (pts.length - 1),
  };
}
const context = (browser: Browser, s: (typeof SIZES)[number]) =>
  browser.newContext({
    viewport: { width: s.width, height: s.height },
    deviceScaleFactor: 2,
    ...(s.phone ? { isMobile: true, hasTouch: true } : {}),
  });

for (const s of SIZES)
  test(`Ascendant Snoozaku's Dream Tide and Twin Dream read at ${s.name}`, async ({
    browser,
  }, info) => {
    test.setTimeout(600_000);
    const ctx = await context(browser, s);
    try {
      const page = await ctx.newPage();
      const errors = await raid(page);
      await run(page, 0.4);
      expect(
        await page.evaluate(() => (window as any).__combat.arena.raid.variant),
      ).toBe("ascendant");

      // ---- Dream Tide, me the Seer: my plaque, my panel, every ring.
      await stand(page, [
        [760, 470],
        [1180, 420],
      ]);
      const tide = await page.evaluate(() => {
        const c = (window as any).__combat,
          a = c.arena;
        c.cast("dream-tide");
        const w = a.raid.warnings.find((x: any) => x.kind === "dream-tide");
        w.targetId = "me";
        c.snapshot();
        return {
          radius: w.radius,
          rune: a.dreamFor("me").runes[0],
          at: w.at - a.time,
        };
      });
      expect(tide.at).toBeGreaterThan(2.5);
      await run(page, 0.6, 1);
      await stand(page, [
        [760, 470],
        [1180, 420],
      ]);
      await frames(page);
      const panel = page.locator("#raid-dream-panel");
      await expect(panel).toBeVisible();
      await expect(panel).toContainText("Awake pad");
      await expect(
        panel.locator(`.dream-private-runes [data-rune="${tide.rune}"]`),
      ).toHaveCount(1);
      if (s.phone)
        await expect(panel.locator("[data-raid-rune]")).toHaveCount(4);
      const boxes = await covers(page);
      const controls = boxes.filter((b) =>
        /touch|joystick|^$/.test(String(b.what)),
      );
      // Every pad's awake ring: on screen, big enough to read, its glyph
      // (the middle) never covered; on phones never under the controls.
      for (const [rune, pad] of Object.entries(PADS)) {
        const [c] = await onScreen(page, [pad]);
        expect(tide.radius * c.scale, `${rune} ring`).toBeGreaterThan(22);
        expect(
          hidden({ x: c.x, y: c.y, r: 20 * c.scale + 4 }, boxes, s),
          `${rune} pad glyph`,
        ).toBeUndefined();
        if (s.phone) {
          const cover = await coveredShare(page, pad, tide.radius, controls, s);
          expect(cover.centre, `${rune} centre`).toBe(false);
          expect(cover.share, `${rune} ring under the controls`).toBe(0);
        }
      }
      // The eclipse icon (can't jump) and the Seer's bubble are in sight.
      const [seer] = await heroes(page);
      const [icon, bubble] = await onScreen(page, [
        { x: 800, y: 830 },
        { x: seer.x + 62, y: seer.y - 12 },
      ]);
      expect(
        hidden({ x: icon.x, y: icon.y, r: 24 * icon.scale }, boxes, s),
        "eclipse icon",
      ).toBeUndefined();
      expect(
        hidden({ x: bubble.x, y: bubble.y, r: 22 * bubble.scale }, boxes, s),
        "Seer's bubble",
      ).toBeUndefined();
      await snap(page, info, `asc-snooze-tide-seer-${s.name}`);

      // I call it: the pad's ring lights up for everyone.
      await page.evaluate((rune) => {
        const c = (window as any).__combat;
        c.arena.callRune("me", rune);
        c.snapshot();
      }, tide.rune);
      await run(page, 0.5, 1);
      await snap(page, info, `asc-snooze-tide-called-${s.name}`);
      // Kai's view: no vision, the call and the lit ring only.
      await page.evaluate(() => {
        const c = (window as any).__combat;
        const a = c.arena;
        const w = a.raid.warnings.find((x: any) => x.kind === "dream-tide");
        w.targetId = "p2";
        a.raid.runeCalls = a.raid.runeCalls.map((q: any) => ({
          ...q,
          playerId: "p2",
        }));
        c.snapshot();
      });
      await run(page, 0.3, 1);
      await expect(panel).toBeHidden();
      await snap(page, info, `asc-snooze-tide-listener-${s.name}`);
      // It lands: the awake pad flashes.
      await page.evaluate(() => {
        const a = (window as any).__combat.arena;
        const w = a.raid.warnings.find((x: any) => x.kind === "dream-tide");
        w.at = a.time + 0.2;
      });
      await run(page, 0.5, 1);
      await snap(page, info, `asc-snooze-tide-landed-${s.name}`);
      await run(page, 1.5);

      // ---- Twin Dream: me the first Dreamer, Kai the second.
      await stand(page, [
        [700, 450],
        [960, 470],
      ]);
      const twin = await page.evaluate(() => {
        const c = (window as any).__combat,
          a = c.arena;
        a.raid.warnings = [];
        a.raid.dreamRings = [];
        a.twinMode = true;
        a.previousDreamer = "p2";
        a.beginDream();
        const d = a.raid.dream;
        if (d.dreamerId !== "me") {
          d.partnerId = d.dreamerId;
          d.dreamerId = "me";
        }
        d.partnerId = "p2";
        c.snapshot();
        return { length: d.length, view: a.dreamFor("me") };
      });
      expect(twin.view.hidden.length).toBe(Math.floor(twin.length / 2));
      await frames(page, 6);
      await expect(panel).toBeVisible();
      await expect(panel).toContainText("Your half");
      await expect(
        panel.locator('.dream-private-runes [data-rune="hidden"]'),
      ).toHaveCount(twin.view.hidden.length);
      const [me, kai] = await heroes(page);
      // My plaque (above me) and both Dreamers' order dots are in sight.
      const after = await covers(page);
      const [plaque, dots1, dots2] = await onScreen(page, [
        { x: me.x, y: me.y - 150 },
        { x: me.x, y: me.y + 44 },
        { x: kai.x, y: kai.y + 44 },
      ]);
      const width = twin.length * 34 + 16;
      expect(
        hidden(
          { x: plaque.x, y: plaque.y, r: (width / 2) * plaque.scale },
          after.filter((b) => b.what !== "raid-dream-panel"),
          s,
        ),
        "plaque",
      ).toBeUndefined();
      for (const d of [dots1, dots2])
        expect(
          hidden({ x: d.x, y: d.y, r: 9 * d.scale + 2 }, after, s),
          "order dots",
        ).toBeUndefined();
      await snap(page, info, `asc-snooze-twin-${s.name}`);
      expect(errors).toEqual([]);
    } finally {
      await ctx.close();
    }
  });
