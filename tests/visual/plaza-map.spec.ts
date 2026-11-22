import { expect, test, type Page } from "@playwright/test";
import { openPlaza, snap } from "./helpers";
import {
  PLAZA_PLACES,
  PLAZA_QUESTS,
  plazaPlaceOf,
} from "../../packages/shared/src/plaza";

/*
 * The Plaza map (plaza-map.ts): a Map button and the map board by the
 * square open it; it shows every place and sends you walking there. Each
 * daily quest still to do has a Go button to its place.
 */
const me = (page: Page) =>
  page.evaluate(() => {
    const b = (window as any).__plazaWorld.bodyOf("local");
    return { x: b.x, y: b.y };
  });
async function box(page: Page, sel: string) {
  return page.locator(sel).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      x: r.left,
      y: r.top,
      r: r.right,
      b: r.bottom,
      w: r.width,
      h: r.height,
    };
  });
}

for (const viewport of [
  { width: 1440, height: 900, inset: null },
  { width: 667, height: 375, inset: null },
  {
    width: 852,
    height: 393,
    inset: { left: 59, right: 59, bottom: 21, top: 0 },
  },
]) {
  test(`the Plaza map fits and its places walk you there at ${viewport.width}x${viewport.height}${viewport.inset ? " with a Dynamic Island" : ""}`, async ({
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
      await page.click("#pz-map-btn");
      const map = page.locator("#pz-map");
      await expect(map).toBeVisible();
      // Every place: a pin on the map and a row in the list.
      await expect(map.locator(".pz-pin")).toHaveCount(PLAZA_PLACES.length);
      await expect(map.locator(".pz-map-list button")).toHaveCount(
        PLAZA_PLACES.length,
      );
      // You are on it, where you stand.
      await expect(map.locator(".pz-map-dots .me")).toHaveCount(1);
      // Inside the safe area, the picture keeps the Plaza's shape and every
      // pin sits on the picture.
      const inset = viewport.inset ?? { left: 0, right: 0, bottom: 0, top: 0 };
      const panel = await box(page, ".pz-map-panel");
      expect(panel.x).toBeGreaterThanOrEqual(inset.left - 0.5);
      expect(panel.r).toBeLessThanOrEqual(viewport.width - inset.right + 0.5);
      expect(panel.b).toBeLessThanOrEqual(viewport.height - inset.bottom + 0.5);
      const view = await box(page, ".pz-map-view");
      expect(view.w / view.h).toBeCloseTo(27 / 17, 1);
      expect(view.h).toBeGreaterThan(phone ? 150 : 300);
      expect(view.b).toBeLessThanOrEqual(panel.b);
      for (const p of PLAZA_PLACES) {
        const pin = await box(page, `.pz-pin[data-place="${p.id}"]`);
        const cx = pin.x + pin.w / 2,
          cy = pin.y + pin.h / 2;
        expect(cx, p.id).toBeGreaterThan(view.x - 1);
        expect(cx, p.id).toBeLessThan(view.r + 1);
        expect(cy, p.id).toBeGreaterThan(view.y - 1);
        expect(cy, p.id).toBeLessThan(view.b + 1);
      }
      await snap(page, info, `plaza-map-${viewport.width}`);
      // Go: the map closes and you walk toward the pond.
      const pond = PLAZA_PLACES.find((p) => p.id === "pond")!;
      const from = await me(page);
      await map.locator('.pz-map-list [data-place="pond"]').click();
      await expect(map).toBeHidden();
      await expect(page.locator("#toast")).toContainText(
        "Walking to Fishing pond",
      );
      await expect
        .poll(async () => {
          const at = await me(page);
          return Math.hypot(at.x - pond.x, at.y - pond.y);
        })
        .toBeLessThan(Math.hypot(from.x - pond.x, from.y - pond.y) - 120);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

test("M opens and closes the map; a quest's Go walks you to its place", async ({
  page,
}) => {
  const errors = await openPlaza(page);
  await page.locator(".plaza-layer").focus();
  await page.keyboard.press("m");
  await expect(page.locator("#pz-map")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#pz-map")).toBeHidden();
  await page.keyboard.press("m");
  await expect(page.locator("#pz-map")).toBeVisible();
  await page.keyboard.press("m");
  await expect(page.locator("#pz-map")).toBeHidden();
  // Each quest still to do has a Go to where it is done (the done one has none).
  const goal = plazaPlaceOf("goal")!;
  await page.click("#pz-quests [data-qopen]");
  const go = page.locator(`#pz-quests [data-go="${goal.id}"]`);
  await expect(go).toBeVisible();
  await expect(page.locator('#pz-quests [data-go="photo"]')).toHaveCount(0);
  const from = await me(page);
  await go.click();
  await expect
    .poll(async () => {
      const at = await me(page);
      return Math.hypot(at.x - goal.x, at.y - goal.y);
    })
    .toBeLessThan(Math.hypot(from.x - goal.x, from.y - goal.y) - 120);
  expect(errors).toEqual([]);
});

test("the map board by the square opens the map", async ({ page }) => {
  const errors = await openPlaza(page);
  await page.evaluate(() => (window as any).__plazaPosition(1080, 1300));
  const act = page.locator("#pz-interact");
  await expect(act).toBeVisible();
  await expect(act).toContainText("Plaza map");
  await act.click();
  await expect(page.locator("#pz-map")).toBeVisible();
  expect(errors).toEqual([]);
});

test("Plaza today is a round button that opens its list, on a phone too", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 667, height: 375 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    const errors = await openPlaza(page);
    const btn = page.locator("#pz-quests [data-qopen]"),
      panel = page.locator("#pz-qpanel");
    // Folded: the quests still to do on its badge (one of six is done).
    await expect(btn).toHaveAttribute("aria-expanded", "false");
    await expect(panel).toBeHidden();
    await expect(page.locator("#pz-quests .pz-qbadge")).toHaveText(
      String(PLAZA_QUESTS.length - 1),
    );
    const box = (await btn.boundingBox())!;
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await expect(panel).toBeVisible();
    await expect(btn).toHaveAttribute("aria-expanded", "true");
    await expect(panel.locator(".pz-q")).toHaveCount(PLAZA_QUESTS.length);
    // Its ✕ folds it again.
    await panel.locator("[data-qclose]").tap();
    await expect(panel).toBeHidden();
    await expect(btn).toHaveAttribute("aria-expanded", "false");
    // A tap on the Plaza beside it folds it too, without walking you.
    await btn.tap();
    await expect(panel).toBeVisible();
    await page.touchscreen.tap(400, 200);
    await expect(panel).toBeHidden();
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
