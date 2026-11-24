import { expect, test, type Browser, type Page } from "@playwright/test";
import { RULES } from "../../packages/shared/src/index";
import {
  createRoom,
  openHub,
  openPlayPanel,
  pushUntilBattle,
  snap,
} from "./helpers";
import {
  ASCENDANT_LUMIWICK as A,
  EMBERWING as E,
} from "../../packages/shared/src/raid";
import { SHELTER_MARK } from "../../apps/client/src/ascendant-lumiwick-art";

// Ascendant Lumiwick (the Spire's sixtieth floor, Emberwing's id) in the
// real raid scene, on phones first: its two new attacks must be readable
// and nothing a raider must see or reach may sit under the HUD or the touch
// controls.
// - Snuffing Gale: its exact red lane with wind chevrons, every brazier ring
//   in it drawn as a gold shelter, and the flame it blows at ringed with
//   the countdown and a shield while its keeper holds it.
// - Bound Wicks: the burning cord between the bound braziers, their gold
//   rings (a tick when held) and the Backdraft's circle round each.
// - Every brazier ring and the heart's hover stay clear of the controls
//   (the HUD too), at every screen.
// The server's own combat runs in the page (boss-combat-demo.ts).
const SIZES = [
  { name: "844x390", width: 844, height: 390, phone: true },
  { name: "667x375", width: 667, height: 375, phone: true },
  { name: "932x430", width: 932, height: 430, phone: true },
  { name: "844x280", width: 844, height: 280, phone: true },
  { name: "iPad", width: 1180, height: 820, phone: true },
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
      boss: "emberwing",
      pos: [420, 450, 700, 380],
    }),
  );
  await openPlayPanel(page);
  await createRoom(page);
  await pushUntilBattle(page);
  await page.evaluate(async () => {
    const { createBossCombatDemo } = await import("/boss-combat-demo.ts");
    const c = createBossCombatDemo("emberwing", true, false, "ascendant");
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
/**
 * These checks read the whole arena against the HUD and touch controls, so
 * phones choose "Whole court in raids" (phones otherwise follow the raider;
 * raid-layout.spec.ts covers that camera).
 */
const context = async (browser: Browser, s: (typeof SIZES)[number]) => {
  const ctx = await browser.newContext({
    viewport: { width: s.width, height: s.height },
    deviceScaleFactor: 2,
    ...(s.phone ? { isMobile: true, hasTouch: true } : {}),
  });
  await ctx.addInitScript(() =>
    localStorage.setItem("arena-controls", JSON.stringify({ raidCourt: true })),
  );
  return ctx;
};

for (const s of SIZES)
  test(`Ascendant Lumiwick's Snuffing Gale and Bound Wicks read at ${s.name}`, async ({
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
          braziers: a.raid.braziers.map((b: any) => ({ x: b.x, y: b.y })),
        };
      });
      expect(kit.variant).toBe("ascendant");
      expect(kit.braziers).toEqual(A.braziers.map((b) => ({ ...b })));
      const boxes = await covers(page);
      const controls = boxes.filter((b) =>
        /touch|joystick|^$/.test(String(b.what)),
      );
      if (s.phone) expect(controls.length).toBeGreaterThan(4);

      // ---- Every brazier ring (a raider anywhere in it) and the heart's hover: in sight.
      for (const [i, p] of (await onScreen(page, kit.braziers)).entries())
        expect(
          hidden(
            { x: p.x, y: p.y, r: (E.brazierRadius + RULES.radius) * p.scale },
            boxes,
            s,
          ),
          `brazier ${i}`,
        ).toBeUndefined();
      for (const k of [-1, -0.5, 0, 0.5, 1]) {
        const [heart] = await onScreen(page, [
          { x: A.home.x + k * A.sway.air, y: A.home.y },
        ]);
        expect(
          hidden(
            { x: heart.x, y: heart.y, r: A.heartClear * heart.scale },
            controls,
            s,
          ),
          `heart at ${k}`,
        ).toBeUndefined();
      }

      // ---- Snuffing Gale: I hold the lit brazier; Kai is well away.
      const keep = A.braziers[2];
      const spots: [number, number][] = [
        [keep.x, keep.y],
        [380, 230],
      ];
      await stand(page, spots);
      const gale = await page.evaluate(() => {
        const c = (window as any).__combat,
          a = c.arena;
        const b = a.raid.braziers[2];
        b.progress = 1;
        b.litUntil = a.time + 60;
        c.cast("snuff-gale");
        const w = a.raid.warnings.find((x: any) => x.kind === "snuff-gale");
        w.at = a.time + 4; // time to look
        w.startedAt = a.time;
        c.snapshot();
        return w && { x: w.x, y: w.y, tx: w.tx, ty: w.ty, brazier: w.brazier };
      });
      expect(gale?.brazier).toBe(2);
      await hold(page, 0.9, spots);
      const now = await covers(page);
      const [ring, mark, start] = await onScreen(page, [
        keep,
        { x: keep.x + SHELTER_MARK.x, y: keep.y + SHELTER_MARK.y },
        { x: gale!.x, y: gale!.y },
      ]);
      expect(A.gale.width * 2 * ring.scale, "lane width").toBeGreaterThan(18);
      expect(
        hidden(
          { x: ring.x, y: ring.y, r: (E.brazierRadius + 18) * ring.scale },
          controls,
          s,
        ),
        "the flame it blows at",
      ).toBeUndefined();
      expect(
        hidden({ x: mark.x, y: mark.y, r: 16 * mark.scale }, now, s),
        "shelter mark",
      ).toBeUndefined();
      expect(
        hidden({ x: start.x, y: start.y, r: 20 * start.scale }, controls, s),
        "where it blows from",
      ).toBeUndefined();
      await expect(
        page.locator("#raid-hud .raid-callout").first(),
      ).toContainText("Snuffing Gale");
      await snap(page, info, `asc-lumi-gale-${s.name}`);
      // It lands: the held flame burns on.
      await page.evaluate(() => {
        const a = (window as any).__combat.arena;
        const w = a.raid.warnings.find((x: any) => x.kind === "snuff-gale");
        w.at = a.time + 0.1;
      });
      await hold(page, 0.4, spots);
      expect(
        await page.evaluate(() => {
          const a = (window as any).__combat.arena;
          return a.raid.braziers[2].litUntil > a.time && a.lumiReads.held;
        }),
      ).toBe(1);

      // ---- Bound Wicks: the wick ties two braziers; I stand in one.
      const wickSpots: [number, number][] = [
        [A.braziers[1].x, A.braziers[1].y],
        [300, 160],
      ];
      await stand(page, wickSpots);
      const wick = await page.evaluate(() => {
        const c = (window as any).__combat,
          a = c.arena;
        a.raid.warnings = [];
        for (const b of a.raid.braziers) {
          b.progress = 0;
          b.litUntil = 0;
        }
        c.cast("bound-wicks");
        const w = a.raid.warnings.find((x: any) => x.kind === "bound-wicks");
        w.at = a.time + 2.6; // its last seconds: the Backdraft fills
        w.startedAt = a.time - 5;
        c.snapshot();
        return w && { braziers: w.braziers, radius: w.radius };
      });
      expect(wick?.braziers).toHaveLength(2);
      await hold(page, 1.3, wickSpots);
      const after = await covers(page);
      const bound = wick!.braziers.map((i: number) => A.braziers[i]);
      for (const [i, p] of (await onScreen(page, bound)).entries())
        expect(
          hidden(
            { x: p.x, y: p.y, r: (E.brazierRadius + 14) * p.scale },
            controls,
            s,
          ),
          `bound ring ${i}`,
        ).toBeUndefined();
      const [mid] = await onScreen(page, [
        {
          x: (bound[0].x + bound[1].x) / 2,
          y: (bound[0].y + bound[1].y) / 2,
        },
      ]);
      expect(
        hidden({ x: mid.x, y: mid.y, r: 10 * mid.scale }, after, s),
        "the wick",
      ).toBeUndefined();
      await expect(
        page.locator("#raid-hud .raid-callout").first(),
      ).toContainText(/Bound Wicks|wick/);
      await snap(page, info, `asc-lumi-wicks-${s.name}`);
      expect(errors).toEqual([]);
    } finally {
      await ctx.close();
    }
  });
