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

test("a movement key takes back a Go walk; a jump doesn't", async ({
  page,
}) => {
  const errors = await openPlaza(page);
  const at = () =>
    page.evaluate(() => {
      const b = (window as any).__plazaWorld.bodyOf("local");
      return { x: b.x, y: b.y };
    });
  await page.locator(".plaza-layer").focus();
  // Go to the pond, then jump on the way: still walking there.
  await page.keyboard.press("m");
  await page.locator('.pz-map-list [data-place="pond"]').click();
  await page.waitForTimeout(400);
  await page.keyboard.press(" ");
  const a = await at();
  await expect
    .poll(
      async () => {
        const b = await at();
        return Math.hypot(b.x - a.x, b.y - a.y);
      },
      { timeout: 20_000 },
    )
    .toBeGreaterThan(80);
  // (Polled: on a CI runner the Plaza can take seconds to get going.)
  // A tap of a movement key: the walk stops once it's let go.
  await page.keyboard.down("a");
  await page.waitForTimeout(120);
  await page.keyboard.up("a");
  await page.waitForTimeout(500);
  const c = await at();
  await page.waitForTimeout(800);
  const d = await at();
  expect(Math.hypot(d.x - c.x, d.y - c.y)).toBeLessThan(6);
  expect(errors).toEqual([]);
});

test("on a phone, moving the joystick takes back a Go walk", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    const errors = await openPlaza(page);
    const at = () =>
      page.evaluate(() => {
        const b = (window as any).__plazaWorld.bodyOf("local");
        return { x: b.x, y: b.y };
      });
    await page.click("#pz-map-btn");
    await page.locator('.pz-map-list [data-place="pond"]').click();
    // Walking there (or the stop below would prove nothing).
    const a = await at();
    await expect
      .poll(
        async () => {
          const b = await at();
          return Math.hypot(b.x - a.x, b.y - a.y);
        },
        { timeout: 20_000 },
      )
      .toBeGreaterThan(40);
    // A short push on the stick, then let go.
    const joy = (await page.locator("#pz-joy").boundingBox())!;
    const ox = joy.x + joy.width * 0.3,
      oy = joy.y + joy.height * 0.6;
    const ev = (type: string, x: number, y: number) =>
      page.locator("#pz-joy").dispatchEvent(type, {
        pointerId: 7,
        pointerType: "touch",
        clientX: x,
        clientY: y,
        bubbles: true,
        isPrimary: true,
      });
    await ev("pointerdown", ox, oy);
    await ev("pointermove", ox - 40, oy);
    await page.waitForTimeout(150);
    await ev("pointerup", ox - 40, oy);
    await page.waitForTimeout(500);
    const c = await at();
    await page.waitForTimeout(800);
    const d = await at();
    expect(Math.hypot(d.x - c.x, d.y - c.y)).toBeLessThan(6);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

// A device under 20 fps: the browser moved you only 0.05 s a frame while
// the server moved you for the time that really passed, so a Go walk
// stopped late on the server and its copy walked on past the place (40-66
// px with the CPU slowed 6x; on a CI runner, off the end of the dock). Now
// you move by the real time, in the server's own steps.
test("on a slow device a Go walk stops where it was going", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const errors = await openPlaza(page);
  await (
    await page.context().newCDPSession(page)
  ).send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const server = () =>
    page.evaluate(() => {
      const b = (window as any).__plazaWorld.bodyOf("local");
      return { x: b.x, y: b.y };
    });
  for (const id of ["pond", "cafe"]) {
    const p = PLAZA_PLACES.find((x) => x.id === id)!;
    await page.click("#pz-map-btn");
    await page.locator(`.pz-map-list [data-place="${id}"]`).click();
    // Until the server's copy stands still (four looks in a row).
    let last = await server(),
      still = 0;
    for (let i = 0; i < 160 && still < 4; i++) {
      await page.waitForTimeout(250);
      const b = await server();
      still = Math.hypot(b.x - last.x, b.y - last.y) < 1 ? still + 1 : 0;
      last = b;
    }
    expect(still, id).toBe(4);
    expect(Math.hypot(last.x - p.x, last.y - p.y), id).toBeLessThan(24);
  }
  expect(errors).toEqual([]);
});
