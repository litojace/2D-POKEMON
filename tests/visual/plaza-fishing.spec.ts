import { expect, test, type Page } from "@playwright/test";
import { openPlaza, snap } from "./helpers";
import { ISLAND, setInsets } from "./ui-measure";
import {
  PLAZA_FISH,
  PLAZA_FISHING,
  PLAZA_SPOTS,
} from "../../packages/shared/src/plaza";

// Fishing mode at the pond: the round Fish button at the dock opens it (the
// camera comes in close, fishing's own buttons replace the walking ones),
// Cast, the bite, Reel!, the fish leaps in, Leave. The harness runs the
// real PlazaWorld (harness/plaza-sim.ts), which decides the bite and the
// fish; __plazaBiteNow makes the fish bite at once.
const SPOT = PLAZA_SPOTS.find((s) => s.id === "fish")!;
const mode = (page: Page) =>
  page.evaluate(() => (window as any).__plaza.fishingMode);
const phase = async (page: Page) => (await mode(page)).phase;
const toast = (page: Page) => page.locator("#toast");
const act = (page: Page) => page.locator("#pz-fish-act");
async function toPond(page: Page) {
  await page.evaluate(
    ([x, y]) => (window as any).__plazaPosition(x, y),
    [SPOT.x, SPOT.y],
  );
  await expect(page.locator("#pz-interact")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("#pz-interact")).toContainText("Fish");
}
async function enter(page: Page) {
  await page.click("#pz-interact");
  await expect(page.locator("#pz-fishhud")).toBeVisible();
  await expect(act(page)).toHaveAttribute("data-kind", "cast");
}
async function cast(page: Page) {
  await act(page).click();
  await expect.poll(() => phase(page)).toBe("wait");
  await expect(act(page)).toHaveAttribute("data-kind", "reel");
}
const box = (page: Page, s: string) =>
  page.evaluate((s) => {
    const r = document.querySelector(s)!.getBoundingClientRect();
    return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width };
  }, s);

for (const size of [
  { width: 667, height: 375, inset: null },
  { width: 852, height: 393, inset: ISLAND },
]) {
  const name = `${size.width}x${size.height}${size.inset ? "-island" : ""}`;
  test(`fishing mode on a phone (${name}): in close, cast, bite, catch, the Fish book, leave`, async ({
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
      // At the dock: a round Fish button, not the long pill.
      const fishBtn = await box(page, "#pz-interact");
      expect(fishBtn.w).toBeLessThanOrEqual(70);
      await snap(page, info, `fishing-dock-${name}`);
      await enter(page);
      // The walking controls step aside; the camera comes in close.
      for (const s of [".pz-joy", ".pz-actions", ".pz-left", "#pz-quests"])
        await expect(page.locator(s)).toBeHidden();
      await expect.poll(async () => (await mode(page)).fz).toBeGreaterThan(1.4);
      await snap(page, info, `fishing-mode-${name}`);
      await cast(page);
      await snap(page, info, `fishing-wait-${name}`);
      // The server says it bit: tap at once (the window is about a second).
      await page.evaluate(() => (window as any).__plazaBiteNow());
      await expect.poll(() => phase(page), { intervals: [50] }).toBe("bite");
      // Forced: the gold button pulses, and Playwright waits for a still one.
      await act(page).click({ force: true });
      await expect.poll(() => phase(page), { intervals: [50] }).toBe("leap");
      await snap(page, info, `fishing-leap-${name}`);
      // The catch card: the fish in full, its name, rarity and coins.
      const card = page.locator("#pz-catch");
      await expect(card).toBeVisible();
      await expect(card).toContainText("First catch!");
      await expect(card).toContainText(/\+\d+ coins/);
      await expect(page.locator("#pz-feed")).toContainText("First catch:");
      await snap(page, info, `fishing-catch-${name}`);
      await expect.poll(() => phase(page)).toBe("idle");
      await expect
        .poll(() =>
          page.evaluate(() => (window as any).__plaza.progress?.fishToday),
        )
        .toBe(1);
      await expect(page.locator("#pz-fish-today")).toContainText("1/30");
      // Fishing's buttons stay on screen and inside the safe area.
      for (const s of ["#pz-fish-act", "#pz-fish-exit", "#pz-fish-book2"]) {
        const b = await box(page, s);
        expect(b.l, s).toBeGreaterThanOrEqual(size.inset?.left ?? 0);
        expect(b.r, s).toBeLessThanOrEqual(
          size.width - (size.inset?.right ?? 0),
        );
        expect(b.b, s).toBeLessThanOrEqual(size.height);
      }

      // Another bite, left alone: the button turns gold and pulses, then
      // the server lets the fish go.
      await page.waitForTimeout(PLAZA_FISHING.castGapMs);
      await cast(page);
      await page.evaluate(() => (window as any).__plazaBiteNow());
      await expect.poll(() => phase(page), { intervals: [50] }).toBe("bite");
      await snap(page, info, `fishing-bite-${name}`);
      await expect(act(page)).toHaveAttribute("data-kind", "bite");
      await expect(page.locator("#pz-fish-hint")).toContainText("biting");
      await expect(page.locator("#pz-fish-hint")).toContainText("got away");

      // The Fish book, from fishing's own button: one caught, inside the
      // safe area, its list scrolling to the last fish.
      await page.click("#pz-fish-book2");
      const book = page.locator("#pz-fishbook");
      await expect(book).toBeVisible();
      await expect(page.locator("#pz-fishbook-count")).toHaveText(
        `1 / ${PLAZA_FISH.length}`,
      );
      await expect(page.locator(".pz-fish:not(.unknown)")).toHaveCount(1);
      await expect(page.locator(".pz-fish.unknown small.first")).toHaveCount(
        PLAZA_FISH.length - 1,
      );
      const panel = await box(page, ".pz-fishbook-panel");
      expect(panel.l).toBeGreaterThanOrEqual(size.inset?.left ?? 0);
      expect(panel.r).toBeLessThanOrEqual(
        size.width - (size.inset?.right ?? 0),
      );
      expect(panel.b).toBeLessThanOrEqual(
        size.height - (size.inset?.bottom ?? 0),
      );
      await snap(page, info, `fishbook-${name}`);
      const list = page.locator("#pz-fishbook-list");
      expect(await list.evaluate((el) => getComputedStyle(el).overflowY)).toBe(
        "auto",
      );
      await page.click('[data-fb="close"]');
      await expect(book).toBeHidden();

      // Leave: the walking controls and the usual camera come back.
      await page.click("#pz-fish-exit");
      await expect(page.locator("#pz-fishhud")).toBeHidden();
      await expect(page.locator(".pz-joy")).toBeVisible();
      await expect.poll(async () => (await mode(page)).fz).toBeLessThan(1.05);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

test("on a keyboard: E enters and casts, a tap before the bite loses the fish, Esc leaves, and a line left out comes in", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const errors = await openPlaza(page);
  await toPond(page);
  await page.keyboard.press("e");
  await expect(page.locator("#pz-fishhud")).toBeVisible();
  await page.keyboard.press("e");
  await expect.poll(() => phase(page)).toBe("wait");
  // A nibble is not a bite: reeling now loses the fish.
  await page.keyboard.press("e");
  await expect(page.locator("#pz-fish-hint")).toContainText("Too soon");
  await expect.poll(() => phase(page)).toBe("idle");
  // Leaving with the line out reels it in on the server too.
  await page.waitForTimeout(PLAZA_FISHING.castGapMs + 100);
  await page.keyboard.press("e");
  await expect.poll(() => phase(page)).toBe("wait");
  await page.keyboard.press("Escape");
  await expect(page.locator("#pz-fishhud")).toBeHidden();
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__plazaWorld.lineOf("local")),
    )
    .toBeNull();
  // Moved off the dock while fishing (the server's word): out of the mode.
  await toPond(page);
  await page.keyboard.press("e");
  await page.waitForTimeout(PLAZA_FISHING.castGapMs);
  await page.keyboard.press("e");
  await expect.poll(() => phase(page)).toBe("wait");
  await page.evaluate(
    ([x, y]) => (window as any).__plazaPosition(x, y),
    [SPOT.x - 400, SPOT.y - 200],
  );
  await expect(toast(page)).toContainText("walked away");
  await expect(page.locator("#pz-fishhud")).toBeHidden();
  // The whole book filled: the server's progress brings the title.
  await page.evaluate(
    (ids) => {
      const w = window as any;
      const p = structuredClone(w.__plazaProgress);
      p.fishBook = Object.fromEntries(ids.map((id: string) => [id, 1]));
      p.fishTitle = true;
      w.__sock.fire("plaza-progress", p);
    },
    PLAZA_FISH.map((f) => f.id),
  );
  await expect(toast(page)).toContainText("Title earned: Master Angler");
  await page.click("#pz-fish-btn");
  await expect(page.locator("#pz-fishbook-note")).toContainText(
    "Title earned: Master Angler",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("#pz-fishbook")).toBeHidden();
  expect(errors).toEqual([]);
});
