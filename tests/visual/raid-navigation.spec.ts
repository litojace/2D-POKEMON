import { expect, test } from "@playwright/test";
import { openHub } from "./helpers";
import { onPlayersLook } from "./players-look";

// In the look players have (players-look.ts).
onPlayersLook();

test("raid navigation reverses motion, restores the gallery and respects motion settings", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    const errors = await openHub(page);
    await page.click('.lobby-rail [data-lobby-action="raids"]');
    const room = page.locator(".rh-room");
    await expect(room.locator("[data-raid-card]")).toHaveCount(7);
    await expect(room.locator("[data-raid-practice-card]")).toHaveCount(0);
    await expect
      .poll(() =>
        room.evaluate(
          (el) =>
            el
              .getAnimations({ subtree: true })
              .filter((a) => a.playState === "running").length,
        ),
      )
      .toBe(0);
    const grid = room.locator(".rh-grid");
    const scroll = await grid.evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
      return el.scrollLeft;
    });
    const navigate = (selector: string) =>
      page.evaluate((selector) => {
        document.querySelector<HTMLButtonElement>(selector)!.click();
        return document
          .querySelector(".rh-room")!
          .getAnimations({ subtree: true })
          .filter((a) => a.playState === "running")
          .map((a) => (a.effect as KeyframeEffect).getKeyframes()[0].transform);
      }, selector);
    expect(await navigate('[data-raid-card="storm-twins"]')).toContain(
      "translateX(24px)",
    );
    // Back is usable immediately, even before entry finishes.
    expect(await navigate("[data-raid-back]")).toContain("translateX(-24px)");
    await expect(room.locator('[data-raid-card="storm-twins"]')).toBeFocused();
    expect(
      Math.abs((await grid.evaluate((el) => el.scrollLeft)) - scroll),
    ).toBeLessThan(2);
    await expect
      .poll(() =>
        room.evaluate(
          (el) =>
            el
              .getAnimations({ subtree: true })
              .filter((a) => a.playState === "running").length,
        ),
      )
      .toBe(0);
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(await navigate('[data-raid-card="storm-twins"]')).toHaveLength(0);
    expect(await navigate("[data-raid-back]")).toHaveLength(0);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.evaluate(() => localStorage.setItem("ea-graphics", "low"));
    expect(await navigate('[data-raid-card="storm-twins"]')).toHaveLength(0);
    expect(await navigate("[data-raid-back]")).toHaveLength(0);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
