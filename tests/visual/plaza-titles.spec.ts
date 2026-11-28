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
      const row = (b: any) => ({
        name: b.name,
        bot: !!b.bot,
        tier: b.titleTier ?? null,
        moving: !!b.titleMoving,
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

/** The canvas's colours in a small box round a body's title (or where it would be). */
const titlePixels = (page: Page, name: string | null) =>
  page.evaluate((name) => {
    const p = (window as any).__plaza,
      cv = document.querySelector<HTMLCanvasElement>("#pz-cv")!;
    const b = name
      ? [...p.others.values()].find((o: any) => o.name === name)
      : p.P;
    const v = p.view(),
      k = cv.width / cv.clientWidth,
      w = b.titleW ?? 40;
    const cx = (b.x - v.x0) * v.z * k,
      cy = ((b.titleY ?? NaN) - v.y0) * v.z * k;
    if (Number.isNaN(cy)) return null;
    const half = Math.max(2, Math.floor((w / 2 - 3) * v.z * k));
    const d = cv
      .getContext("2d")!
      .getImageData(Math.round(cx - half), Math.round(cy), half * 2, 1).data;
    return [...d];
  }, name);

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
      // What moves plays for the player and the nearest five only.
      expect(d.me.moving).toBe(true);
      expect(d.crowd.filter((c) => c?.moving).map((c) => c?.name)).toEqual(
        TITLE_CROWD.slice(0, 5)
          .filter((c) => c[2])
          .map((c) => c[1]),
      );
      // On the canvas: Pip's Rare title is lettering with its dark outline
      // and no plate behind it (owner, 28 Nov: no frames), and there is
      // nothing over Sol, who has no title.
      const ink = (px: number[] | null) => {
        if (!px) return 0;
        let n = 0;
        for (let i = 0; i < px.length; i += 4)
          if (px[i] < 60 && px[i + 1] < 60 && px[i + 2] < 70) n++;
        return n / (px.length / 4);
      };
      await expect
        .poll(async () => ink(await titlePixels(page, "Pip")))
        .toBeGreaterThan(0.08);
      expect(ink(await titlePixels(page, "Pip"))).toBeLessThan(0.7);
      expect(await titlePixels(page, "Sol")).toBeNull();
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

/** The share of a title's pixels that changed clearly between two reads
 *  (the town behind the letters twinkles a little: that is not counted). */
function changed(a: number[], b: number[]) {
  let n = 0;
  for (let i = 0; i < a.length; i += 4)
    if (
      Math.abs(a[i] - b[i]) > 40 ||
      Math.abs(a[i + 1] - b[i + 1]) > 40 ||
      Math.abs(a[i + 2] - b[i + 2]) > 40
    )
      n++;
  return n / (a.length / 4);
}

test("a Mythical title's colours drift through its letters", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  const errors = await openPlaza(page);
  await titleCrowd(page, SPOT);
  await ready(page);
  // The player's own Mythical lettering changes from frame to frame.
  const first = (await titlePixels(page, null))!;
  await expect
    .poll(async () => changed(first, (await titlePixels(page, null))!), {
      timeout: 15_000,
    })
    .toBeGreaterThan(0.1);
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
  expect(d.me.moving).toBe(false);
  expect(d.crowd.filter((c) => c?.moving)).toEqual([]);
  // The lettering over the player is the same picture for the next seconds.
  const first = (await titlePixels(page, null))!;
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(400);
    expect(changed(first, (await titlePixels(page, null))!)).toBeLessThan(0.03);
  }
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
