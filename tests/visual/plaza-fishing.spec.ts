import { expect, test, type Page } from "@playwright/test";
import { openPlaza, snap } from "./helpers";
import { ISLAND, setInsets } from "./ui-measure";
import {
  PLAZA_FISH,
  PLAZA_FISHING,
  PLAZA_SPOTS,
} from "../../packages/shared/src/plaza";

// Fishing at the pond: cast, the bobber dips, tap to catch; and the Fish
// book. The harness runs the real PlazaWorld (harness/plaza-sim.ts), which
// decides the bite and the fish; __plazaBiteNow makes the fish bite at once.
const SPOT = PLAZA_SPOTS.find((s) => s.id === "fish")!;
const fishing = (page: Page) =>
  page.evaluate(() => (window as any).__plaza.fishing);
const toast = (page: Page) => page.locator("#toast");
async function toPond(page: Page) {
  await page.evaluate(
    ([x, y]) => (window as any).__plazaPosition(x, y),
    [SPOT.x, SPOT.y],
  );
  await expect(page.locator("#pz-interact")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("#pz-interact")).toContainText("Fish");
}
async function cast(page: Page) {
  await page.click("#pz-interact");
  await expect.poll(() => fishing(page)).toBe("wait");
  await expect(page.locator("#pz-interact")).toContainText("Reel in");
}
const box = (page: Page, s: string) =>
  page.evaluate((s) => {
    const r = document.querySelector(s)!.getBoundingClientRect();
    return { l: r.left, t: r.top, r: r.right, b: r.bottom };
  }, s);

for (const size of [
  { width: 667, height: 375, inset: null },
  { width: 852, height: 393, inset: ISLAND },
]) {
  const name = `${size.width}x${size.height}${size.inset ? "-island" : ""}`;
  test(`fishing on a phone (${name}): cast, bite, catch, and the Fish book`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: true,
      hasTouch: true,
    });
    try {
      const page = await context.newPage();
      const errors = await openPlaza(page);
      if (size.inset) await setInsets(page, size.inset);
      await toPond(page);
      await cast(page);
      await snap(page, info, `fishing-wait-${name}`);
      // The server says it bit: tap at once (the window is about a second).
      await page.evaluate(() => (window as any).__plazaBiteNow());
      await expect.poll(() => fishing(page), { intervals: [50] }).toBe("bite");
      // Forced: the gold button pulses, and Playwright waits for a still one.
      await page.click("#pz-interact", { force: true });
      // The catch card: the fish drawn in full, its name and rarity.
      const card = page.locator("#pz-catch");
      await expect(card).toBeVisible();
      await expect(card).toContainText("You caught");
      await expect(card.locator("svg")).toHaveCount(1);
      await snap(page, info, `fishing-catch-${name}`);
      const c = await box(page, "#pz-catch");
      expect(c.l).toBeGreaterThanOrEqual(size.inset?.left ?? 0);
      expect(c.r).toBeLessThanOrEqual(size.width - (size.inset?.right ?? 0));
      await expect.poll(() => fishing(page)).toBeNull();
      await expect
        .poll(() =>
          page.evaluate(() => (window as any).__plaza.progress?.fishToday),
        )
        .toBe(1);

      // The Fish book: one caught, the rest unknown; it fits inside the
      // safe area and its list scrolls to the last fish.
      await page.click("#pz-fish-btn");
      const book = page.locator("#pz-fishbook");
      await expect(book).toBeVisible();
      await expect(page.locator("#pz-fishbook-count")).toHaveText(
        `1 / ${PLAZA_FISH.length}`,
      );
      await expect(page.locator(".pz-fish:not(.unknown)")).toHaveCount(1);
      await expect(page.locator(".pz-fish.unknown")).toHaveCount(
        PLAZA_FISH.length - 1,
      );
      await expect(page.locator("#pz-fishbook-note")).toContainText(
        "Today: 1 / 30",
      );
      const panel = await box(page, ".pz-fishbook-panel");
      expect(panel.l).toBeGreaterThanOrEqual(size.inset?.left ?? 0);
      expect(panel.r).toBeLessThanOrEqual(
        size.width - (size.inset?.right ?? 0),
      );
      expect(panel.t).toBeGreaterThanOrEqual(0);
      expect(panel.b).toBeLessThanOrEqual(
        size.height - (size.inset?.bottom ?? 0),
      );
      // The panel's header stays under the game's header row.
      expect(panel.t).toBeGreaterThanOrEqual(
        (await box(page, "#account-profile")).b,
      );
      await snap(page, info, `fishbook-${name}`);
      const list = page.locator("#pz-fishbook-list");
      const scroll = await list.evaluate((el) => ({
        overflow: el.scrollHeight > el.clientHeight + 1,
        style: getComputedStyle(el).overflowY,
      }));
      expect(scroll.style).toBe("auto");
      if (scroll.overflow) {
        // A finger can reach the last fish.
        await list.evaluate((el) => (el.scrollTop = el.scrollHeight));
        const last = await box(page, ".pz-fish:last-child");
        const l = await box(page, "#pz-fishbook-list");
        expect(last.b).toBeLessThanOrEqual(l.b + 1);
        expect(last.t).toBeGreaterThanOrEqual(l.t - 1);
      }
      // Closes with its ✕, and a tap on the dimmed background.
      await page.click('[data-fb="close"]');
      await expect(book).toBeHidden();
      await page.click("#pz-fish-btn");
      await expect(book).toBeVisible();
      await page.mouse.click(size.width / 2, size.height - 4);
      await expect(book).toBeHidden();

      // Another bite, left alone: the bobber dips, the button turns gold
      // and pulses, then the server lets the fish go.
      await page.waitForTimeout(PLAZA_FISHING.castGapMs);
      await cast(page);
      await page.evaluate(() => (window as any).__plazaBiteNow());
      await expect.poll(() => fishing(page), { intervals: [50] }).toBe("bite");
      await snap(page, info, `fishing-bite-${name}`);
      await expect(page.locator("#pz-interact")).toHaveClass(/bite/);
      await expect(page.locator("#pz-interact")).toContainText("Reel!");
      // The action row stays on screen and inside the safe area.
      const act = await box(page, "#pz-interact");
      expect(act.l).toBeGreaterThanOrEqual(size.inset?.left ?? 0);
      expect(act.r).toBeLessThanOrEqual(size.width - (size.inset?.right ?? 0));
      expect(act.b).toBeLessThanOrEqual(size.height);
      await expect(toast(page)).toContainText("got away");
      await expect.poll(() => fishing(page)).toBeNull();
      await expect(page.locator("#pz-interact")).not.toHaveClass(/bite/);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

test("a tap before the bite loses the fish, and walking off reels the line in", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const errors = await openPlaza(page);
  await toPond(page);
  await cast(page);
  await page.click("#pz-interact");
  await expect(toast(page)).toContainText("Too soon");
  await expect.poll(() => fishing(page)).toBeNull();
  // After a moment (PLAZA_FISHING.castGapMs) the next cast goes.
  await page.waitForTimeout(PLAZA_FISHING.castGapMs + 100);
  await cast(page);
  await page.evaluate(
    ([x, y]) => (window as any).__plazaPosition(x, y),
    [SPOT.x - 400, SPOT.y - 200],
  );
  await expect(toast(page)).toContainText("walked away");
  await expect.poll(() => fishing(page)).toBeNull();
  // Escape closes the Fish book on a keyboard.
  await page.click("#pz-fish-btn");
  await expect(page.locator("#pz-fishbook")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#pz-fishbook")).toBeHidden();
  expect(errors).toEqual([]);
});
