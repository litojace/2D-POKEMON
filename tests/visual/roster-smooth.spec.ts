import { expect, test } from "@playwright/test";
import { openTown, openTownMenu } from "./helpers";

// The roster fills the screen: the town behind it stops drawing so the
// animated fighter gets the whole device, and it comes back on closing.
test("the town rests behind the roster, and the fighter keeps animating", async ({ page }) => {
  await openTown(page);
  const town = page.locator("#town-canvas");
  await openTownMenu(page);
  await page.click("[data-action=fighters]");
  const stage = page.locator(".fighter-rig-stage").first();
  await expect(stage).toHaveClass(/is-ready/);
  await expect(town).toHaveAttribute("data-frozen", "true", { timeout: 15_000 });
  // The preview is paced by the display, not a 30 fps timer.
  const time = async () => Number(await stage.getAttribute("data-animation-time"));
  const before = await time();
  await expect.poll(time, { timeout: 15_000 }).toBeGreaterThan(before + 200);

  await page.locator("#home-fighter-panel [data-home-close]").first().click();
  await expect(town).toHaveAttribute("data-frozen", "false");
});
