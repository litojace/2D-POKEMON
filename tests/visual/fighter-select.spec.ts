import { expect, test } from "@playwright/test";
import { openTown, openTownMenu, snap } from "./helpers";

// The harness account wears a Voltkit skin. The still artwork must step aside
// once the animated (skinned) fighter is drawn, or the fighter shows twice.
test("fighter select shows one fighter, even with a skin on", async ({ page }, info) => {
  const errors = await openTown(page);
  await openTownMenu(page);
  await page.click("[data-action=fighters]");
  const stage = page.locator(".fighter-rig-stage").first();
  await expect(stage).toHaveAttribute("data-preview-item", "voltkit-stormcrown");
  await expect(stage).toHaveClass(/is-ready/);
  await expect(stage.locator("canvas")).toHaveCSS("opacity", "1");
  await expect(stage.locator("svg .fighter-character").first()).toHaveCSS("visibility", "hidden");
  await snap(page, info, "fighter-select");
  // Switching fighters keeps exactly one visible too.
  await page.getByRole("button", { name: /Terradon/ }).first().click();
  await expect(stage).toHaveAttribute("data-preview-champion", "terradon");
  await expect(stage).toHaveClass(/is-ready/);
  await expect(stage.locator("svg .fighter-character").first()).toHaveCSS("visibility", "hidden");
  expect(errors).toEqual([]);
});
