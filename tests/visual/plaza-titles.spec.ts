import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { openPlaza, snap } from "./helpers";
import { onPlayersLook } from "./players-look";
import { MY_TITLE, TITLE_CROWD, titleCrowd } from "./plaza-title-crowd";
import { titleTier } from "../../packages/shared/src/title-tier";

// A player's title shows over their name in the Plaza, in a look that
// grows with its tier (plaza-title-art.ts, title-tier.ts).
onPlayersLook();

/** A clear stretch of the square, away from the fountain and the stalls. */
const SPOT = { x: 1180, y: 1010 };

/** What the scene last drew for each of the crowd, and for the player. */
const drawn = (page: Page) =>
  page.evaluate(
    (names) => {
      const p = (window as any).__plaza;
      const full = p.fullFx();
      const row = (b: any) => ({
        name: b.name,
        bot: !!b.bot,
        tier: b.titleTier ?? null,
        moving: !!b.titleMoving,
        // The scene picked it for the full effects this frame.
        full: full.has(b),
      });
      const others = [...p.others.values()];
      return {
        me: row(p.P),
        crowd: names.map((n) => {
          const b = others.find((o: any) => o.name === n);
          return b ? row(b) : null;
        }),
        bots: others.filter((o: any) => o.bot).map(row),
      };
    },
    TITLE_CROWD.map((c) => c[1]),
  );

/** The crowd is there and drawn, and the camera has come to rest on it. */
async function ready(page: Page) {
  const titled = TITLE_CROWD.filter((c) => c[2]).length;
  await expect
    .poll(
      async () => {
        const d = await drawn(page);
        return d.me.tier ? d.crowd.filter((c) => c?.tier).length : -1;
      },
      { timeout: 20_000 },
    )
    .toBe(titled);
  let last = "";
  await expect
    .poll(
      async () => {
        const v = await page.evaluate(() => {
          const v = (window as any).__plaza.view();
          return `${v.x0.toFixed(2)},${v.y0.toFixed(2)},${v.z.toFixed(3)}`;
        });
        const still = v === last;
        last = v;
        return still;
      },
      { timeout: 20_000 },
    )
    .toBe(true);
}

for (const viewport of [
  { width: 667, height: 375, inset: null },
  { width: 844, height: 390, inset: null },
  {
    width: 852,
    height: 393,
    inset: { left: 59, right: 59, bottom: 21, top: 0 },
  },
  { width: 1440, height: 900, inset: null },
]) {
  test(`titles show over names in a crowd at ${viewport.width}x${viewport.height}${viewport.inset ? " with a Dynamic Island" : ""}`, async ({
    browser,
  }, info) => {
    const phone = viewport.width < 1000;
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: phone,
      hasTouch: phone,
    });
    try {
      const page = await context.newPage();
      const errors = await openPlaza(page);
      if (viewport.inset)
        await page.evaluate((inset) => {
          for (const [key, value] of Object.entries(inset))
            document.documentElement.style.setProperty(
              `--safe-${key}`,
              `${value}px`,
            );
        }, viewport.inset);
      await titleCrowd(page, SPOT);
      await ready(page);
      const d = await drawn(page);
      // Everyone with a title shows it, in its tier; those without show none.
      expect(d.me.tier).toBe(titleTier(MY_TITLE.title));
      TITLE_CROWD.forEach(([, name, title], i) =>
        expect(d.crowd[i]?.tier ?? null, name).toBe(
          title ? titleTier(title) : null,
        ),
      );
      // Bots and the townsfolk have none. (Which of them are near enough to
      // be sent to this player changes as they wander: on CI none were, at
      // one size, so their number is not held to.)
      expect(d.bots.filter((b) => b.tier)).toEqual([]);
      // What moves plays for the player and the nearest five only: the
      // scene's own pick, which counts the townsfolk too, so which of the
      // staged crowd are in it depends on where they wander (a test that
      // named the four nearest failed when townsfolk came closer).
      expect(d.me).toMatchObject({ moving: true, full: true });
      const near = [...d.crowd, ...d.bots].filter((c) => c?.full);
      expect(near.length).toBeLessThanOrEqual(5);
      for (const c of d.crowd)
        expect(c?.moving, c?.name).toBe(!!c?.full && c?.tier !== null);
      // Those staged 200 px and more away are never among the nearest five
      // (five of the crowd stand within 100 px), so theirs hold still.
      expect(d.crowd.slice(5).filter((c) => c?.full || c?.moving)).toEqual([]);
      // And some of the near crowd's titles do move.
      expect(d.crowd.slice(0, 5).some((c) => c?.moving)).toBe(true);
      // Sol, who has no title, has nothing drawn over the name.
      expect(d.crowd[TITLE_CROWD.findIndex((c) => c[1] === "Sol")]?.tier).toBe(
        null,
      );
      await snap(
        page,
        info,
        `plaza-titles-${viewport.width}x${viewport.height}${viewport.inset ? "-island" : ""}`,
      );
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

/**
 * The titles' own painting, drawn by itself on a bare canvas (the town
 * behind a title twinkles and its people wander across, so the live
 * scene's pixels say little): what share of it is painted, and whether two
 * moments look the same.
 */
const ART = fileURLToPath(
  new URL("../../apps/client/src/plaza/plaza-title-art.ts", import.meta.url),
);
const SAMPLES: [string, string][] = [
  ["First Victory", "#9ee6a8"],
  ["Cragbreaker", "#e5bc73"],
  ["Mountain Conqueror", "#ffcf66"],
  ["Lone Mountain", "#c9a46a"],
  ["Stormbreaker of the Spire", "#8edfff"],
];
test("lettering only, no plate; only Epic and up move, and only when allowed", async ({
  page,
}) => {
  const errors = await openPlaza(page);
  const rows = await page.evaluate(
    async ([path, samples]) => {
      const { plazaTitleArt, drawPlazaTitle } = await import(
        /* @vite-ignore */ `/@fs${path}`
      );
      await document.fonts.ready;
      return samples.map(([title, color]) => {
        const art = plazaTitleArt(title, color, 2);
        const paint = (time: number, animate: boolean) => {
          const c = document.createElement("canvas");
          c.width = Math.ceil(art.w * 2);
          c.height = Math.ceil(art.h * 2);
          const g = c.getContext("2d")!;
          g.scale(2, 2);
          drawPlazaTitle(g, art, art.w / 2, art.h / 2, time, animate);
          return g.getImageData(0, 0, c.width, c.height).data;
        };
        const still = paint(0, false);
        let painted = 0;
        for (let i = 3; i < still.length; i += 4) if (still[i] > 200) painted++;
        // The lowest line of the title's own box (13 px tall, in a 4 px
        // margin; drawn at 2x): capitals stop short of it, a plate fills it.
        const W = Math.ceil(art.w * 2),
          row = (4 + 13) * 2 - 1;
        let edge = 0;
        for (let x = 0; x < W; x++)
          if (still[(row * W + x) * 4 + 3] > 60) edge++;
        const same = (a: Uint8ClampedArray, b: Uint8ClampedArray) =>
          a.every((v, i) => v === b[i]);
        const times = Array.from({ length: 32 }, (_, i) => i * 0.25);
        return {
          title,
          tier: art.tier as string,
          painted: painted / (still.length / 4),
          edge: edge / W,
          // Not allowed to move: the same picture at every moment.
          holds: times.every((t) => same(paint(t, false), still)),
          // Allowed to move: does any moment differ?
          moves: times.some((t) => !same(paint(t, true), still)),
        };
      });
    },
    [ART, SAMPLES] as const,
  );
  expect(rows.map((r) => r.tier)).toEqual(SAMPLES.map(([t]) => titleTier(t)));
  expect(rows.map((r) => r.tier)).toEqual([
    "common",
    "rare",
    "epic",
    "legendary",
    "mythic",
  ]);
  for (const r of rows) {
    // Letters and their outlines are there, and no plate behind them: a
    // plate would paint the box's lowest line from end to end.
    expect(r.painted, r.title).toBeGreaterThan(0.15);
    expect(r.edge, r.title).toBeLessThan(0.2);
    expect(r.holds, r.title).toBe(true);
    expect(r.moves, r.title).toBe(r.tier !== "common" && r.tier !== "rare");
  }
  expect(errors).toEqual([]);
});

test("Reduce motion holds every title still", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 844, height: 390 });
  const errors = await openPlaza(page);
  await titleCrowd(page, SPOT);
  await ready(page);
  const d = await drawn(page);
  expect(d.me.tier).toBe("mythic");
  // No title is drawn as one that may move: each is the still painting
  // (the test above: the same picture at every moment).
  expect(d.me.moving).toBe(false);
  expect(d.crowd.filter((c) => c?.moving)).toEqual([]);
  expect(errors).toEqual([]);
});

test("Low graphics shows titles, and nothing moves", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("ea-graphics", "low"));
  await page.setViewportSize({ width: 844, height: 390 });
  const errors = await openPlaza(page);
  await titleCrowd(page, SPOT);
  await ready(page);
  const d = await drawn(page);
  expect(d.me.tier).toBe("mythic");
  expect(d.me.moving).toBe(false);
  expect(d.crowd.filter((c) => c?.moving)).toEqual([]);
  expect(d.crowd.filter((c) => c?.tier).length).toBe(
    TITLE_CROWD.filter((c) => c[2]).length,
  );
  expect(errors).toEqual([]);
});
