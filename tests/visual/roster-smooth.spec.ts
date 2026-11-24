import { expect, test } from "@playwright/test";
import { openHub, snap, hubMenu } from "./helpers";

// The roster's fighter (on the detail's stage, UI remodel step 3) keeps
// animating at the display's pace. (The Plaza resting behind panels is in
// plaza.spec.ts.)
test("the roster's fighter keeps animating", async ({ page }) => {
  await openHub(page);
  await hubMenu(page, "fighters");
  await page.click("[data-roster-details]");
  const stage = page.locator(".roster-stage .fighter-rig-stage");
  await expect(stage).toHaveClass(/is-ready/);
  // The preview is paced by the display, not a 30 fps timer.
  const time = async () =>
    Number(await stage.getAttribute("data-animation-time"));
  const before = await time();
  await expect.poll(time, { timeout: 15_000 }).toBeGreaterThan(before + 200);
  await page.locator(".roster-room .ui-close").click();
  await expect(page.locator("#lobby-play")).toBeVisible();
});

// The roster's fighter is dressed as the Wardrobe dresses it (owner, 5 Nov
// 2026): its skin and your shared looks, and no element aura orbiting it
// (the Shop, Wardrobe and battle rigs never had one).
for (const [name, size] of [
  ["desktop", { width: 1440, height: 900 }],
  ["phone", { width: 844, height: 390 }],
] as const)
  test(`the roster fighter wears what the Wardrobe shows, no element aura (${name})`, async ({
    page,
  }, info) => {
    await page.setViewportSize(size);
    await openHub(page);
    await hubMenu(page, "fighters");
    await page.click("[data-roster-details]");
    const stage = page.locator(".roster-stage .fighter-rig-stage");
    await expect(stage).toHaveClass(/is-ready/);
    await expect(stage.locator(".trait-aura, .ta-front-layer")).toHaveCount(0);
    await snap(page, info, `roster-no-aura-${name}`);
  });
