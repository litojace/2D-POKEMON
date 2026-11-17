import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  createRoom,
  openHub,
  openPlayPanel,
  pushUntilBattle,
  snap,
} from "./helpers";
import { ASCENDANT_PRISMELL as A } from "../../packages/shared/src/raid";

// Ascendant Prismell (the Spire's fiftieth floor, Prismatail's id) in the
// real raid scene, on phones first: its two new attacks must be readable
// and nothing a raider must see or reach may sit under the HUD or the touch
// controls.
// - Eclipse: sunfall on the old skylight (its exact circle) with the dark
//   moon over the lens, and the window the light opens at next (a gold ring
//   with a sun, a dashed arrow to it), shown from the start; as it lands the
//   skylight is drawn at the new window.
// - Umbral Prism: on its raider a violet ring with the countdown, the dark
//   prism beside their feet, the beam a teammate hands them and the gold arc
//   filling.
// - Every skylight window, every mirror and the heart stay clear of the
//   controls (the HUD too).
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
      boss: "prismatail",
      pos: [560, 450, 760, 560],
    }),
  );
  await openPlayPanel(page);
  await createRoom(page);
  await pushUntilBattle(page);
  await page.evaluate(async () => {
    const { createBossCombatDemo } = await import("/boss-combat-demo.ts");
    const c = createBossCombatDemo("prismatail", true, false, "ascendant");
    // The board starts unsolved (every arrow west): a relay completed by
    // the circling raiders would clear the warnings being checked.
    for (const m of c.arena.raid.mirrors ?? []) m.angle = Math.PI;
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
    (window as any).__combat.snapshot();
  }, spots);
/** Advance server time without the demo walking anyone (frames drawn). */
const hold = (page: Page, seconds: number, spots: [number, number][]) =>
  page.evaluate(
    async ([seconds, spots]) => {
      const c = (window as any).__combat,
        a = c.arena;
      for (let i = 0; i < Math.round(seconds * 30); i++) {
        a.heroes().forEach((p: any, j: number) => {
          p.x = spots[j][0];
          p.y = spots[j][1];
          p.vx = p.vy = 0;
        });
        a.tick(1 / 30);
        a.nextAttack = 1e6;
        c.snapshot();
        if (i % 2 === 1)
          await new Promise((r) =>
            requestAnimationFrame(() => requestAnimationFrame(r)),
          );
      }
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      );
    },
    [seconds, spots] as const,
  );
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
const context = (browser: Browser, s: (typeof SIZES)[number]) =>
  browser.newContext({
    viewport: { width: s.width, height: s.height },
    deviceScaleFactor: 2,
    ...(s.phone ? { isMobile: true, hasTouch: true } : {}),
  });

for (const s of SIZES)
  test(`Ascendant Prismell's Eclipse and Umbral Prism read at ${s.name}`, async ({
    browser,
  }, info) => {
    test.setTimeout(600_000);
    const ctx = await context(browser, s);
    try {
      const page = await ctx.newPage();
      const errors = await raid(page);
      await run(page, 0.4);
      const kit = await page.evaluate(() => {
        const a = (window as any).__combat.arena;
        return {
          variant: a.raid.variant,
          mirrors: a.raid.mirrors.map((m: any) => ({ x: m.x, y: m.y })),
        };
      });
      expect(kit.variant).toBe("ascendant");
      const boxes = await covers(page);
      const controls = boxes.filter((b) =>
        /touch|joystick|^$/.test(String(b.what)),
      );
      if (s.phone) expect(controls.length).toBeGreaterThan(4);

      // ---- Every skylight window, mirror and the heart: in sight.
      const wins: { x: number; y: number }[] = [
        ...A.windows.single.flat(),
        ...A.windows.pair.flat(),
      ];
      for (const [i, p] of (await onScreen(page, wins)).entries())
        expect(
          hidden({ x: p.x, y: p.y, r: 30 * p.scale }, boxes, s),
          `window ${wins[i].x},${wins[i].y}`,
        ).toBeUndefined();
      for (const [i, p] of (await onScreen(page, kit.mirrors)).entries())
        expect(
          hidden({ x: p.x, y: p.y, r: 34 * p.scale }, boxes, s),
          `mirror ${i}`,
        ).toBeUndefined();
      for (const x of A.home) {
        const [heart] = await onScreen(page, [{ x, y: 450 }]);
        expect(
          hidden(
            { x: heart.x, y: heart.y, r: A.heartClear * heart.scale },
            controls,
            s,
          ),
          `heart at ${x}`,
        ).toBeUndefined();
      }

      // ---- Eclipse: sunfall on the skylight, the gold window shown.
      const spots: [number, number][] = [
        [420, 470],
        [760, 560],
      ];
      await stand(page, spots);
      const eclipse = await page.evaluate(() => {
        const c = (window as any).__combat,
          a = c.arena;
        a.relayAt = 1e9;
        c.cast("eclipse");
        const w = a.raid.warnings.find((x: any) => x.kind === "eclipse");
        w.at = a.time + 3; // time to look
        w.startedAt = a.time;
        c.snapshot();
        return { x: w.x, y: w.y, tx: w.tx, ty: w.ty, radius: w.radius };
      });
      await hold(page, 0.9, spots);
      const now = await covers(page);
      const [old, to] = await onScreen(page, [
        { x: eclipse.x, y: eclipse.y },
        { x: eclipse.tx, y: eclipse.ty },
      ]);
      expect(eclipse.radius * old.scale, "sunfall circle").toBeGreaterThan(24);
      expect(
        hidden({ x: to.x, y: to.y, r: 62 * to.scale }, now, s),
        "new window",
      ).toBeUndefined();
      expect(
        hidden({ x: old.x, y: old.y, r: 30 * old.scale }, now, s),
        "old window",
      ).toBeUndefined();
      await expect(
        page.locator("#raid-hud .raid-callout").first(),
      ).toContainText("Eclipse");
      await snap(page, info, `asc-prism-eclipse-${s.name}`);
      // It lands: the skylight shines at the new window.
      await page.evaluate(() => {
        const a = (window as any).__combat.arena;
        const w = a.raid.warnings.find((x: any) => x.kind === "eclipse");
        w.at = a.time + 0.1;
      });
      await hold(page, 0.6, spots);
      expect(
        await page.evaluate(
          () => (window as any).__combat.arena.raid.lightSources,
        ),
      ).toEqual([{ x: eclipse.tx, y: eclipse.ty }]);
      await snap(page, info, `asc-prism-eclipse-landed-${s.name}`);

      // ---- Umbral Prism on me; Kai hands me the light from a step away.
      const sky = await page.evaluate(() => {
        const a = (window as any).__combat.arena;
        a.raid.lightSources = undefined;
        a.relayAt = a.time;
        return a.relaySpot({ x: 350, y: 450 });
      });
      const handoff: [number, number][] = [
        [sky.x + 220, sky.y],
        [sky.x, sky.y],
      ];
      await stand(page, handoff);
      await page.evaluate(() => {
        const c = (window as any).__combat,
          a = c.arena;
        c.cast("umbral-prism");
        const w = a.raid.warnings.find((x: any) => x.kind === "umbral-prism");
        // keep it lit but uncleansed while we look
        a.umbralLight = () => ({ lit: true, from: { x: 470, y: 450 } });
        w.at = a.time + 6;
        w.lit = 0;
        c.snapshot();
      });
      await hold(page, 0.4, handoff);
      const umbral = await page.evaluate(() => {
        const a = (window as any).__combat.arena;
        const w = a.raid.warnings.find((x: any) => x.kind === "umbral-prism");
        return w && { x: w.x, y: w.y, tx: w.tx, ty: w.ty, lit: w.lit };
      });
      expect(umbral).toBeTruthy();
      expect(umbral!.lit).toBeGreaterThan(0);
      expect([umbral!.tx, umbral!.ty]).toEqual([470, 450]);
      const after = await covers(page);
      const [ring, mark] = await onScreen(page, [
        { x: umbral!.x, y: umbral!.y },
        { x: umbral!.x + 66, y: umbral!.y - 16 },
      ]);
      expect(
        hidden({ x: ring.x, y: ring.y, r: 46 * ring.scale }, controls, s),
        "prism ring",
      ).toBeUndefined();
      expect(
        hidden({ x: mark.x, y: mark.y, r: 28 * mark.scale }, after, s),
        "dark prism",
      ).toBeUndefined();
      await expect(
        page.locator("#raid-hud .raid-callout").first(),
      ).toContainText("Umbral Prism");
      await snap(page, info, `asc-prism-umbral-${s.name}`);
      expect(errors).toEqual([]);
    } finally {
      await ctx.close();
    }
  });
