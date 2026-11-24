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
  ASCENDANT_STORM_TWINS as A,
  STORM_TWINS as S,
} from "../../packages/shared/src/raid";
import {
  RAIDER_SIGN,
  TWIN_BADGE,
  shortCount,
} from "../../apps/client/src/ascendant-storm-twins-art";

// Ascendant Storm Twins (the Spire's seventieth floor) in the real raid
// scene, on phones first: its two new attacks must be readable and nothing
// a raider must see or reach may sit under the HUD, the touch controls or
// the twins' own target buttons.
// - Mirror Charge: a charge badge over each twin (+ gold, − cyan) with its
//   pips, every raider's sign over them, the tether to the twin to hit; the
//   target buttons carry each twin's charge.
// - Short Circuit: the violet bar between the twins with its share count.
// - An overload ring round a twin left charged.
// - The twins (their whole bodies) and the copper posts stay clear of the
//   controls, at every screen.
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
      boss: "storm-twins",
      pos: [420, 450, 700, 380],
    }),
  );
  await openPlayPanel(page);
  await createRoom(page);
  await pushUntilBattle(page);
  await page.evaluate(async () => {
    const { createBossCombatDemo } = await import("/boss-combat-demo.ts");
    const c = createBossCombatDemo("storm-twins", true, false, "ascendant");
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
/** Advance server time with the raiders held still (frames drawn). */
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
/** The HUD's, the touch controls' and the twins' target buttons' boxes (page pixels). */
const covers = (page: Page) =>
  page.evaluate(() =>
    [
      ...document.querySelectorAll(
        "#raid-hud [data-hud], #raid-hud .raid-callout, .touch-buttons button, .joystick, #raid-storm-targets button",
      ),
    ]
      .filter((e) => (e as HTMLElement).offsetWidth)
      .map((e) => {
        const r = e.getBoundingClientRect();
        return {
          what:
            (e as HTMLElement).dataset.hud ??
            ((e as HTMLElement).dataset.twinIndex !== undefined
              ? "twin-target"
              : e.id || e.className),
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
const twinsNow = (page: Page) =>
  page.evaluate(() =>
    (window as any).__combat.arena
      .pair()
      .map((p: any) => ({ x: p.x, y: p.y, id: p.id })),
  ) as Promise<{ x: number; y: number; id: string }[]>;
/** Put the twins somewhere (they hold still while a move is drawn). */
const placeTwins = (page: Page, spots: [number, number][]) =>
  page.evaluate((spots) => {
    const c = (window as any).__combat;
    c.arena.pair().forEach((p: any, i: number) => {
      p.x = spots[i][0];
      p.y = spots[i][1];
    });
    c.snapshot();
  }, spots);

for (const s of SIZES)
  test(`Ascendant Storm Twins' Mirror Charge and Short Circuit read at ${s.name}`, async ({
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
        return { variant: a.raid.variant, name: a.raid.name };
      });
      expect(kit.variant).toBe("ascendant");
      const boxes = await covers(page);
      const controls = boxes.filter((b) =>
        /touch|joystick|^$/.test(String(b.what)),
      );
      if (s.phone) expect(controls.length).toBeGreaterThan(4);
      const targets = boxes.filter((b) => b.what === "twin-target");
      expect(targets.length).toBe(2);

      // ---- The twins' bodies wherever they drift, and the posts: in sight of the controls.
      const drift: { x: number; y: number }[] = [...A.spawns];
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        drift.push({
          x: A.home.x + Math.cos(a) * A.orbit.later,
          y: A.home.y + Math.sin(a) * Math.min(170, A.orbit.later * 0.6),
        });
      }
      for (const [i, p] of (await onScreen(page, drift)).entries())
        expect(
          hidden({ x: p.x, y: p.y, r: S.radius * p.scale }, controls, s),
          `twin at ${drift[i].x},${drift[i].y}`,
        ).toBeUndefined();
      for (const [i, p] of (await onScreen(page, [...A.posts])).entries())
        expect(
          hidden(
            { x: p.x, y: p.y - 18 * p.scale, r: 24 * p.scale },
            controls,
            s,
          ),
          `post ${i}`,
        ).toBeUndefined();

      // ---- Mirror Charge: I (+) stand by Crackle, Kai (−) by Fizz.
      await placeTwins(page, [
        [560, 470],
        [920, 430],
      ]);
      const spots: [number, number][] = [
        [880, 600],
        [600, 300],
      ];
      await hold(page, 0.1, spots);
      const mirror = await page.evaluate(() => {
        const c = (window as any).__combat,
          a = c.arena;
        c.cast("mirror-charge");
        const m = a.raid.stormMirror;
        const w = a.raid.warnings.find((x: any) => x.kind === "mirror-charge");
        // time to look
        m.until = w.at = a.time + 6;
        m.startedAt = w.startedAt = a.time;
        c.snapshot();
        return {
          signs: m.signs,
          twins: m.twins.map((t: any) => ({ id: t.id, sign: t.sign })),
        };
      });
      expect(mirror.signs.find((x) => x.playerId === "me")?.sign).toBe(1);
      await hold(page, 0.9, spots);
      const now = await covers(page);
      const twins = await twinsNow(page);
      const badges = await onScreen(
        page,
        twins.map((t) => ({ x: t.x, y: t.y + TWIN_BADGE.y })),
      );
      for (const [i, b] of badges.entries())
        expect(
          hidden({ x: b.x, y: b.y, r: (TWIN_BADGE.r + 8) * b.scale }, now, s),
          `charge badge ${i}`,
        ).toBeUndefined();
      const [mine] = await onScreen(page, [
        { x: spots[0][0] + RAIDER_SIGN.x, y: spots[0][1] + RAIDER_SIGN.y },
      ]);
      expect(
        hidden({ x: mine.x, y: mine.y, r: RAIDER_SIGN.r * mine.scale }, now, s),
        "my sign",
      ).toBeUndefined();
      expect(TWIN_BADGE.r * 2 * badges[0].scale, "badge size").toBeGreaterThan(
        13,
      );
      await expect(
        page.locator("#raid-hud .raid-callout").first(),
      ).toContainText("Mirror Charge");
      await expect(
        page.locator('#raid-storm-targets [data-twin-index="1"]'),
      ).toHaveText(/Crackle −/);
      await snap(page, info, `asc-twins-mirror-${s.name}`);

      // ---- It runs out with nobody hitting: both overload.
      await page.evaluate(() => {
        const a = (window as any).__combat.arena;
        a.raid.stormMirror.until = a.time + 0.05;
        a.raid.warnings.find((x: any) => x.kind === "mirror-charge").at =
          a.time + 0.05;
      });
      await hold(page, 0.5, spots);
      const rings = await page.evaluate(() =>
        (window as any).__combat.arena.raid.warnings
          .filter((x: any) => x.kind === "mirror-charge" && x.overload)
          .map((x: any) => ({ x: x.x, y: x.y, radius: x.radius })),
      );
      expect(rings).toHaveLength(2);
      for (const [i, p] of (await onScreen(page, rings)).entries())
        expect(
          hidden({ x: p.x, y: p.y, r: 20 * p.scale }, controls, s),
          `overload ${i}`,
        ).toBeUndefined();
      await expect(
        page.locator("#raid-hud .raid-callout").first(),
      ).toContainText(/Overload|overload/);
      await snap(page, info, `asc-twins-overload-${s.name}`);
      await page.evaluate(() => {
        const a = (window as any).__combat.arena;
        a.raid.warnings = [];
        a.clearAttacks();
      });

      // ---- Short Circuit: I stand on it, Kai is away.
      await placeTwins(page, [
        [520, 450],
        [960, 450],
      ]);
      const shortSpots: [number, number][] = [
        [700, 450],
        [400, 220],
      ];
      await hold(page, 0.1, shortSpots);
      const short = await page.evaluate(() => {
        const c = (window as any).__combat,
          a = c.arena;
        c.cast("short-circuit");
        const w = a.raid.warnings.find((x: any) => x.kind === "short-circuit");
        w.at = a.time + 5;
        w.startedAt = a.time;
        c.snapshot();
        return w && { x: w.x, y: w.y, tx: w.tx, ty: w.ty, radius: w.radius };
      });
      expect(short).toBeTruthy();
      await hold(page, 0.9, shortSpots);
      const after = await covers(page);
      const [a0, b0, mid, count] = await onScreen(page, [
        { x: short!.x, y: short!.y },
        { x: short!.tx, y: short!.ty },
        { x: (short!.x + short!.tx) / 2, y: (short!.y + short!.ty) / 2 },
        shortCount(short as any),
      ]);
      expect(short!.radius * 2 * mid.scale, "beam width").toBeGreaterThan(14);
      for (const [what, p] of [
        ["beam end", a0],
        ["beam end", b0],
      ] as const)
        expect(
          hidden({ x: p.x, y: p.y, r: S.radius * p.scale }, controls, s),
          what,
        ).toBeUndefined();
      expect(
        hidden({ x: mid.x, y: mid.y, r: short!.radius * mid.scale }, after, s),
        "the beam to stand on",
      ).toBeUndefined();
      expect(
        hidden({ x: count.x, y: count.y, r: 14 * count.scale }, after, s),
        "share count",
      ).toBeUndefined();
      await expect(
        page.locator("#raid-hud .raid-callout").first(),
      ).toContainText("Short Circuit");
      await snap(page, info, `asc-twins-short-${s.name}`);
      // It fires: I share it alone (Kai is away).
      await page.evaluate(() => {
        const a = (window as any).__combat.arena;
        a.raid.warnings.find((x: any) => x.kind === "short-circuit").at =
          a.time + 0.05;
      });
      await hold(page, 0.3, shortSpots);
      expect(
        await page.evaluate(
          () => (window as any).__combat.arena.raid.stormShort?.sharers,
        ),
      ).toEqual(["me"]);
      expect(errors).toEqual([]);
      void RULES;
    } finally {
      await ctx.close();
    }
  });
