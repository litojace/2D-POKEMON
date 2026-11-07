import { expect, test, type Page } from "@playwright/test";
import { openLobby } from "./helpers";

// A long press on a phone is a game action (hold to harvest or plant many on
// the Farm), never the phone's text selection or Copy menu (owner, 6 Nov
// 2026). Fields you type in keep both; a mouse keeps selecting text.
// (iOS's -webkit-touch-callout isn't in Chromium; tests/unit/touch-hold.test.ts
// checks the stylesheet sets it.)
const selectable = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((e) => {
      const s = getComputedStyle(e);
      return s.userSelect || s.webkitUserSelect;
    });
/** Was a context menu on this element cancelled? `touch`: as Chrome reports a
 * finger's long press; `held`: a menu with no pointer type while a finger is
 * down (Safari, older Chrome). */
const menuCancelled = (
  page: Page,
  selector: string,
  how: "touch" | "mouse" | "held",
) =>
  page
    .locator(selector)
    .first()
    .evaluate((e, how) => {
      if (how === "held")
        e.dispatchEvent(
          new TouchEvent("touchstart", {
            bubbles: true,
            touches: [new Touch({ identifier: 1, target: e })],
          }),
        );
      const menu =
        how === "held"
          ? new MouseEvent("contextmenu", { bubbles: true, cancelable: true })
          : new PointerEvent("contextmenu", {
              bubbles: true,
              cancelable: true,
              pointerType: how,
            });
      e.dispatchEvent(menu);
      if (how === "held")
        e.dispatchEvent(
          new TouchEvent("touchend", { bubbles: true, touches: [] }),
        );
      return menu.defaultPrevented;
    }, how);

test("a long press on a phone selects nothing and opens no menu", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 852, height: 393 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    const errors = await openLobby(page);
    // The Lobby's text and buttons.
    for (const selector of ["#lobby-play", ".lobby-layer"])
      expect(await selectable(page, selector), selector).toBe("none");
    expect(await menuCancelled(page, "#lobby-play", "touch")).toBe(true);
    expect(await menuCancelled(page, "#lobby-play", "held")).toBe(true);
    // The Farm, where holding a plot harvests or plants many.
    await page.click('#hub-scenes [data-hub-scene="farm"]');
    await expect(page.locator(".farm-layer #fm-cv")).toBeVisible();
    for (const selector of [".farm-layer #fm-cv", ".farm-layer", "#fm-badge"])
      expect(await selectable(page, selector), selector).toBe("none");
    expect(await menuCancelled(page, ".farm-layer #fm-cv", "touch")).toBe(true);
    expect(await menuCancelled(page, ".farm-layer #fm-cv", "held")).toBe(true);
    // A field you type in keeps selection and its menu (paste a code).
    await page.evaluate(() => {
      const input = document.createElement("input");
      input.id = "zz-field";
      document.body.append(input);
    });
    expect(await selectable(page, "#zz-field")).toBe("text");
    expect(await menuCancelled(page, "#zz-field", "touch")).toBe(false);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("a mouse still selects text and right-clicks as usual", async ({
  page,
}) => {
  const errors = await openLobby(page);
  expect(await selectable(page, "#lobby-play")).not.toBe("none");
  expect(await menuCancelled(page, "#lobby-play", "mouse")).toBe(false);
  expect(errors).toEqual([]);
});
