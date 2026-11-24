import { expect, test } from "@playwright/test";
import { openHub } from "./helpers";

// An iPad Pro 13" (1032×1376 points) in Safari, whose toolbars leave about
// 1290 upright. With a Magic Keyboard or trackpad attached, Safari reports a
// fine pointer that can hover, so the touch rule alone let an upright iPad
// through to the desktop layout (the court a strip across the middle,
// keyboard hints, squeezed panels). iPadOS still calls itself a Mac with
// five touch points, and that is what marks it (index.html, .ipad-gate).
const IPAD_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const withTrackpad = {
  userAgent: IPAD_SAFARI,
  hasTouch: false,
  isMobile: false,
};
const touchPoints = () =>
  Object.defineProperty(Navigator.prototype, "maxTouchPoints", {
    get: () => 5,
  });

test("an upright iPad with a trackpad sees the turn-sideways cover", async ({
  browser,
}) => {
  const context = await browser.newContext({
    ...withTrackpad,
    viewport: { width: 1032, height: 1290 },
  });
  try {
    const page = await context.newPage();
    await page.addInitScript(touchPoints);
    await page.goto("/");
    expect(
      await page.evaluate(
        () => matchMedia("(pointer: fine) and (hover: hover)").matches,
      ),
    ).toBe(true);
    await expect(page.locator("html")).toHaveClass(/ipad-gate/);
    const gate = page.locator("#rotate-gate");
    await expect(gate).toBeVisible();
    const box = await gate.boundingBox();
    expect(box).toEqual({ x: 0, y: 0, width: 1032, height: 1290 });
  } finally {
    await context.close();
  }
});

test("the same iPad turned sideways plays, and a Mac upright is never covered", async ({
  browser,
}) => {
  const ipad = await browser.newContext({
    ...withTrackpad,
    viewport: { width: 1376, height: 950 },
  });
  try {
    const page = await ipad.newPage();
    await page.addInitScript(touchPoints);
    const errors = await openHub(page);
    await expect(page.locator("#rotate-gate")).toBeHidden();
    await expect(page.locator("#lobby-play")).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await ipad.close();
  }
  // A desktop Mac browser (no touch points) in a tall window: no cover.
  const mac = await browser.newContext({
    ...withTrackpad,
    viewport: { width: 1032, height: 1290 },
  });
  try {
    const page = await mac.newPage();
    await page.goto("/");
    await expect(page.locator("html")).not.toHaveClass(/ipad-gate/);
    await expect(page.locator("#rotate-gate")).toBeHidden();
  } finally {
    await mac.close();
  }
});
