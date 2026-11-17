import { expect, test, type Page } from "@playwright/test";
import { openLobby, snap } from "./helpers";

// Thick glass carries text: the header menu, the chat, dialogs. Unblurred,
// the scene behind it kept its edges and its text read through the menu's
// rows (the Lobby's cards) and the chat (the fighter), seen on an iPhone.
// Now it is blurred where blur is on, and solid where it is off (Low
// graphics, battles): ui/aero.css, ui/light-effects.css, ui/tokens.css.

const look = (page: Page, selector: string) =>
  page.locator(selector).evaluate((el) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, blur: s.backdropFilter };
  });

for (const mode of ["full", "light"] as const)
  test(`the menu and the chat are readable over the Lobby (${mode} effects)`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: { width: 852, height: 393 },
      isMobile: true,
      hasTouch: true,
    });
    try {
      const page = await context.newPage();
      const errors = await openLobby(page);
      if (mode === "light")
        await page.evaluate(
          () => (document.documentElement.dataset.uiEffects = "light"),
        );
      await page.click(".header-menu > summary");
      await expect(page.locator(".header-menu-panel")).toBeVisible();
      const menu = await look(page, ".header-menu-panel");
      await snap(page, info, `glass-readability-${mode}-menu`);
      await page.click(".header-menu > summary");
      await page.click("#chat-button");
      await expect(page.locator("#chat-drawer")).toBeVisible();
      const chat = await look(page, "#chat-drawer");
      await snap(page, info, `glass-readability-${mode}-chat`);
      for (const g of [menu, chat])
        if (mode === "full") {
          // See-through, and what shows through is blurred.
          expect(g.blur).toContain("blur(");
          expect(g.bg).toMatch(/^rgba\(/);
        } else {
          // Nothing blurred: solid.
          expect(g.blur).toBe("none");
          expect(g.bg).toBe("rgb(12, 18, 34)");
        }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

test("in a battle, panel and dialog glass is solid", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 852, height: 393 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await openLobby(page);
    const tokens = () =>
      page.evaluate(() => {
        const s = getComputedStyle(document.body);
        return [
          s.getPropertyValue("--glass-regular").trim(),
          s.getPropertyValue("--glass-thick").trim(),
        ];
      });
    // Outside a battle: see-through (it is blurred there).
    expect((await tokens()).every((t) => t.startsWith("rgba("))).toBe(true);
    await page.evaluate(() => document.body.classList.add("battle-active"));
    expect(await tokens()).toEqual(["rgb(12, 18, 34)", "rgb(12, 18, 34)"]);
  } finally {
    await context.close();
  }
});
