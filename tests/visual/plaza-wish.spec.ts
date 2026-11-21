import { expect, test } from "@playwright/test";
import { openPlaza, snap } from "./helpers";
import { PLAZA_FOUNTAIN, PLAZA_WISH } from "../../packages/shared/src/plaza";
import { FIREWORKS } from "../../apps/client/src/plaza/plaza-fireworks";

// The wishing fountain on the smallest phone in landscape: a treat thrown at
// the fountain is a wish on the copy's meter (drawn over the fountain), and a
// full meter sets off fireworks over the square. The harness runs the real
// PlazaWorld in the page (harness/plaza-sim.ts).
test.use({ viewport: { width: 667, height: 375 }, hasTouch: true });

test("a treat at the fountain is a wish; a full meter brings fireworks for everyone", async ({
  page,
}, info) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => localStorage.setItem("ea-graphics", "high"));
  const errors = await openPlaza(page);
  const plaza = (fn: string) =>
    page.evaluate((f) => (window as any).__plaza[f](), fn);
  // Away from it, the treat button is the usual one and no meter shows.
  await expect(page.locator("#pz-treat")).not.toHaveClass(/wish/);
  // Walk up to the basin (the server's position, and yours).
  await page.evaluate(
    ([x, y]) => {
      (window as any).__plazaPosition(x, y);
      Object.assign((window as any).__plaza.P, { x, y });
    },
    [PLAZA_FOUNTAIN.x, PLAZA_FOUNTAIN.y + 110],
  );
  await expect(page.locator("#pz-treat")).toHaveClass(/wish/);
  await expect(page.locator("#pz-treat")).toHaveAttribute(
    "aria-label",
    "Make a wish (T)",
  );
  // Alone in the copy, the meter needs PLAZA_WISH.min wishes.
  expect(await plaza("wish")).toEqual({
    n: 0,
    target: 0,
    goal: PLAZA_WISH.min,
  });
  await page.click("#pz-treat");
  await expect(page.locator("#toast")).toContainText(
    "You made a wish with a cupcake!",
  );
  await expect
    .poll(() => plaza("wish"))
    .toEqual({ n: 1, target: PLAZA_WISH.min, goal: PLAZA_WISH.min });
  // The HUD shows the meter wherever you stand: a ring round the treat
  // button and a badge, on screen and clear of the other controls.
  await expect(page.locator("#pz-treat")).toHaveClass(/wishing/);
  await expect(page.locator("#pz-wishn")).toBeVisible();
  await expect(page.locator("#pz-wishn")).toHaveText(`1/${PLAZA_WISH.min}`);
  const badge = (await page.locator("#pz-wishn").boundingBox())!;
  expect(badge.x).toBeGreaterThanOrEqual(0);
  expect(badge.y).toBeGreaterThanOrEqual(0);
  expect(badge.x + badge.width).toBeLessThanOrEqual(667);
  expect(badge.y + badge.height).toBeLessThanOrEqual(375);
  for (const sel of [
    "#pz-wheel-btn",
    "#pz-album-btn",
    "#pz-dash",
    "#pz-jump",
  ]) {
    const b = await page.locator(sel).boundingBox();
    if (!b) continue;
    const apart =
      badge.x >= b.x + b.width ||
      b.x >= badge.x + badge.width ||
      badge.y >= b.y + b.height ||
      b.y >= badge.y + badge.height;
    expect(apart, `the badge is clear of ${sel}`).toBe(true);
  }
  await snap(page, info, "plaza-wish-meter");

  // Others' wishes fill it: the fireworks, the banner and the feed line.
  for (let i = 1; i < PLAZA_WISH.min; i++)
    await page.evaluate(() => (window as any).__plazaWish());
  await expect
    .poll(() => plaza("wish"))
    .toEqual({ n: 0, target: 0, goal: PLAZA_WISH.min });
  await expect(page.locator("#pz-feed")).toContainText(
    "The Plaza's wish came true!",
  );
  // No banner over the show.
  await expect(page.locator("#pz-banner")).not.toHaveClass(/\bon\b/);
  await expect(page.locator("#pz-wishn")).toBeHidden();
  await expect(page.locator("#pz-treat")).not.toHaveClass(/wishing/);
  // Every burst is centred below the top HUD (the scene switch and the event
  // pill) and its sparks stay on this phone's screen, for the whole show.
  const hudBottom = await page.evaluate(() =>
    Math.max(
      ...["#hub-scenes", "#pz-event"].map((s) => {
        const el = document.querySelector(s);
        return el ? el.getBoundingClientRect().bottom : 0;
      }),
    ),
  );
  let seen = 0;
  const until = Date.now() + PLAZA_WISH.showMs;
  while (Date.now() < until) {
    const { fw, v } = await page.evaluate(() => ({
      fw: (window as any).__plaza.fireworks(),
      v: (window as any).__plaza.view(),
    }));
    if (fw.box) {
      seen++;
      const top = (fw.box.y0 - v.y0) * v.z,
        bottom = (fw.box.y1 - v.y0) * v.z,
        left = (fw.box.x0 - v.x0) * v.z,
        right = (fw.box.x1 - v.x0) * v.z;
      for (const c of fw.centres)
        expect((c.y - v.y0) * v.z, `${c.kind} under the HUD`).toBeGreaterThan(
          hudBottom,
        );
      expect(top).toBeGreaterThan(0);
      expect(bottom).toBeLessThan(375);
      expect(left).toBeGreaterThan(0);
      expect(right).toBeLessThan(667);
    }
    if (seen === 4) await snap(page, info, "plaza-wish-fireworks");
    if (seen === 12) await snap(page, info, "plaza-wish-fireworks-late");
    await page.waitForTimeout(150);
  }
  expect(seen).toBeGreaterThan(5);
  // Over in about PLAZA_WISH.showMs, never past the spark cap.
  await expect
    .poll(async () => (await plaza("fireworks")).active, { timeout: 4000 })
    .toBe(false);
  const fw = await plaza("fireworks");
  expect(fw.peak.sparks).toBeGreaterThan(100);
  expect(fw.centres.map((c: { kind: string }) => c.kind)).toContain("heart");
  expect(fw.peak.sparks).toBeLessThanOrEqual(FIREWORKS.maxSparks);
  expect(fw.peak.flashes).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test.describe("on a wide screen", () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false });
  test("the meter also shows over the fountain", async ({ page }, info) => {
    await page.addInitScript(() => localStorage.setItem("ea-graphics", "high"));
    const errors = await openPlaza(page);
    await page.evaluate(
      ([x, y]) => {
        (window as any).__plazaPosition(x, y);
        Object.assign((window as any).__plaza.P, { x, y });
      },
      [PLAZA_FOUNTAIN.x, PLAZA_FOUNTAIN.y + 110],
    );
    await page.evaluate(() => (window as any).__plazaWish());
    await expect(page.locator("#pz-wishn")).toHaveText(`1/${PLAZA_WISH.min}`);
    // Over the fountain, inside the view (the label is 24 px tall).
    await page.waitForTimeout(800);
    const v = await page.evaluate(() => (window as any).__plaza.view());
    expect(PLAZA_FOUNTAIN.y - 150).toBeGreaterThan(v.y0);
    await snap(page, info, "plaza-wish-meter-wide");
    expect(errors).toEqual([]);
  });
});
