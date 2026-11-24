import { expect, test, type Page } from "@playwright/test";
import { ROWS } from "../../apps/client/src/ui/scroll-rows";
import { hubMenu, openHub, openPlaza, snap } from "./helpers";

// Rows that scroll sideways share one behaviour (ui/scroll-rows.ts): an edge
// fades where more is hidden past it, and they never scroll up and down.
// The raid gallery on phones had no fade; quick chat's emoji row could be
// dragged up and down.

/** Each sideways row on screen: its fades, mask and vertical scrolling. */
async function rows(page: Page) {
  return page.evaluate((ROWS) => {
    return [...document.querySelectorAll<HTMLElement>(ROWS)]
      .filter((el) => el.getClientRects().length && el.clientWidth > 0)
      .map((el) => {
        const s = getComputedStyle(el);
        return {
          name: el.className.split(" ").slice(0, 2).join("."),
          overflows: el.scrollWidth - el.clientWidth > 1,
          left: el.classList.contains("has-more-left"),
          right: el.classList.contains("has-more-right"),
          mask: s.maskImage || (s as any).webkitMaskImage || "none",
          overflowY: s.overflowY,
          // Some rows scroll sideways only on narrow screens.
          sideways: s.overflowX === "auto" || s.overflowX === "scroll",
        };
      });
  }, ROWS);
}

/** A real finger drag (CDP touch) from the middle of `selector`; returns
 * how far it scrolled up or down. */
async function swipe(page: Page, selector: string, dx: number, dy: number) {
  const box = (await page.locator(selector).boundingBox())!;
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: string, px: number, py: number) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: type === "touchEnd" ? [] : [{ x: px, y: py }],
    } as any);
  await touch("touchStart", x, y);
  for (let i = 1; i <= 8; i++) {
    await touch("touchMove", x + (dx * i) / 8, y + (dy * i) / 8);
    await page.waitForTimeout(16);
  }
  await touch("touchEnd", x + dx, y + dy);
  await page.waitForTimeout(400);
  await cdp.detach();
  return page.locator(selector).evaluate((el) => el.scrollTop);
}

test("the raid gallery fades at the edge it hides more past", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    viewport: { width: 852, height: 393 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    const errors = await openHub(page);
    await hubMenu(page, "raids");
    const grid = page.locator(".rh-grid");
    await expect(grid).toBeVisible();
    // More cards than fit: the right edge fades, the left doesn't.
    await expect
      .poll(() => grid.evaluate((el) => el.className))
      .toContain("has-more-right");
    let g = (await rows(page)).find((r) => r.name.includes("rh-grid"))!;
    expect(g.overflows).toBe(true);
    expect(g.left).toBe(false);
    expect(g.mask).not.toBe("none");
    expect(g.overflowY).toBe("hidden");
    // The fade's mask kept Chromium from loading the cards past the edge
    // (lazy pictures): every card's picture loads, so a swipe isn't blank.
    await expect
      .poll(() =>
        grid.evaluate((el) =>
          [...el.querySelectorAll("img")].every(
            (i) => (i as HTMLImageElement).complete,
          ),
        ),
      )
      .toBe(true);
    await snap(page, info, "scroll-rows-raids-start");
    // Swiped to the end: only the left edge fades.
    await grid.evaluate((el) => (el.scrollLeft = el.scrollWidth));
    await expect
      .poll(() => grid.evaluate((el) => el.className))
      .not.toContain("has-more-right");
    g = (await rows(page)).find((r) => r.name.includes("rh-grid"))!;
    expect(g.left).toBe(true);
    await snap(page, info, "scroll-rows-raids-end");
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("quick chat's row only scrolls sideways, and every row on screen too", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    viewport: { width: 852, height: 393 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    // In the Plaza, where Nearby chat shows the quick row.
    const errors = await openPlaza(page);
    await page.click("#chat-button");
    const quick = page.locator("#chat-drawer .chat-quick");
    await expect(quick).toBeVisible();
    await snap(page, info, "scroll-rows-chat");
    const all = await rows(page);
    const q = all.find((r) => r.name.includes("chat-quick"))!;
    expect(q.overflowY).toBe("hidden");
    if (q.overflows) expect(q.right || q.left).toBe(true);
    // A finger dragged up and down on it doesn't move it (its emoji stand a
    // few pixels taller than the row, which a row that could scroll both
    // ways let a finger drag)...
    expect(await swipe(page, "#chat-drawer .chat-quick", 0, -40)).toBe(0);
    // ...and a sideways drag still scrolls it.
    await expect
      .poll(() =>
        page
          .locator("#chat-drawer .chat-quick")
          .evaluate((el) => el.scrollLeft),
      )
      .toBe(0);
    await swipe(page, "#chat-drawer .chat-quick", -120, 0);
    expect(
      await page
        .locator("#chat-drawer .chat-quick")
        .evaluate((el) => el.scrollLeft),
    ).toBeGreaterThan(20);
    // Every sideways row on this screen: sideways only, faded when it hides
    // something.
    for (const r of all.filter((r) => r.sideways)) {
      expect(r.overflowY, r.name).toBe("hidden");
      if (r.overflows) expect(r.left || r.right, r.name).toBe(true);
    }
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
