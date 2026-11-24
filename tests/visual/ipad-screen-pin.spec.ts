import { expect, test } from "@playwright/test";
import { openHub } from "./helpers";

// iPhone and iPad Safari lift the page to show the field the on-screen
// keyboard is for, and often leave it lifted when the keyboard closes: the
// whole interface then sits too high (owner's iPad Pro 13", landscape). The
// hub is exactly the window and never scrolls, so screen-pin.ts puts it back
// at the top, but never while typing. Chromium has no on-screen keyboard, so
// this recreates where Safari leaves the page: scrolled, then the field blurs.
const IPAD_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";

test("the hub goes back to the top once the keyboard closes", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 1376, height: 950 },
    hasTouch: true,
    isMobile: true,
    userAgent: IPAD_SAFARI,
  });
  try {
    const page = await context.newPage();
    const errors = await openHub(page);
    const play = page.locator("#lobby-play");
    const home = await play.boundingBox();
    // Room for Safari to lift the page into, and a field to type in.
    await page.evaluate(() => {
      const room = document.createElement("div");
      room.id = "lift-room";
      room.style.height = "2000px";
      document.body.append(room);
      const field = document.createElement("input");
      field.id = "lift-field";
      Object.assign(field.style, {
        position: "fixed",
        left: "40%",
        bottom: "8px",
        zIndex: "9999",
      });
      document.querySelector(".lobby-layer")!.append(field);
    });
    const scrollY = () => page.evaluate(() => window.scrollY);
    // Typing: the keyboard's lift stays.
    await page.focus("#lift-field");
    await page.evaluate(() => window.scrollTo(0, 320));
    await page.waitForTimeout(900);
    expect(await scrollY()).toBe(320);
    // The keyboard closes: back to the top, everything where it was.
    await page.evaluate(() => (document.activeElement as HTMLElement).blur());
    await expect.poll(scrollY, { timeout: 3000 }).toBe(0);
    expect(await play.boundingBox()).toEqual(home);
    // A stray lift with nothing being typed (toolbars, a fling) goes too.
    await page.evaluate(() => window.scrollTo(0, 140));
    await expect.poll(scrollY, { timeout: 3000 }).toBe(0);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
