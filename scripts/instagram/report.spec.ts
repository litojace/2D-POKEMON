/**
 * The open beta's "found a bug?" post (docs/instagram.md): the game's own
 * way to report one, captured in Poster on a phone held sideways: the Menu
 * (the gear, top right of the Lobby) with Report a problem in it, and the
 * report form it opens.
 *
 *   npx playwright test --config scripts/instagram/playwright.config.ts report.spec.ts
 *
 * Writes instagram-clips/report/menu.png and form.png (2532 x 1170), and
 * boxes.json: where the gear, Report a problem, the menu and the coins are.
 */
import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { openHub } from "../../tests/visual/helpers";
import { lookShown, onPlayersLook } from "../../tests/visual/players-look";

onPlayersLook();
const OUT = "instagram-clips/report";

test("report a problem", async ({ browser }) => {
  mkdirSync(OUT, { recursive: true });
  // An iPhone 16 / 17 Pro's screen held sideways, at its 3x.
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true,
  });
  try {
    const page = await context.newPage();
    await openHub(page);
    expect(await lookShown(page)).toBe("poster");
    // The gear at the top right opens the Menu, Report a problem in it.
    await page.locator("#header-menu > summary").click();
    const report = page.locator("#report-problem");
    await expect(report).toBeVisible();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/menu.png` });
    // Where the gear, Report a problem, the open menu and the coin count
    // are (CSS pixels), for the post's crop, its rings and its cover.
    const at = async (selector: string) =>
      (await page.locator(selector).first().boundingBox())!;
    writeFileSync(
      `${OUT}/boxes.json`,
      JSON.stringify({
        gear: await at("#header-menu > summary"),
        report: await at("#report-problem"),
        panel: await at(".header-menu-panel"),
        coins: await at("#account-coins"),
      }),
    );
    await report.click();
    await expect(page.locator("#report-form")).toBeVisible();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/form.png` });
  } finally {
    await context.close();
  }
});
