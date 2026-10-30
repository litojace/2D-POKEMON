import { expect, test } from "@playwright/test";
import { openTown, openTownMenu, snap } from "./helpers";

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

// The animated fighter is a canvas over the still artwork. The aura's front
// half is drawn again above that canvas, so orbiting pieces pass in front.
for (const [name, size] of [
  ["desktop", { width: 1440, height: 900 }],
  ["phone", { width: 844, height: 390 }],
] as const)
test(`the roster fighter's aura passes in front of the animated fighter (${name})`, async ({ page }, info) => {
  await page.setViewportSize(size);
  await openTown(page);
  await openTownMenu(page);
  await page.click("[data-action=fighters]");
  const stage = page.locator(".fighter-rig-stage").first();
  await expect(stage).toHaveClass(/is-ready/);
  const layer = stage.locator("> svg.ta-front-layer");
  await expect(layer).toBeVisible();
  const art = await stage.locator("> svg:not(.ta-front-layer)").boundingBox();
  const front = await layer.boundingBox();
  expect(Math.abs(art!.x - front!.x) + Math.abs(art!.y - front!.y)).toBeLessThan(1);
  expect(Math.abs(art!.width - front!.width) + Math.abs(art!.height - front!.height)).toBeLessThan(1);
  const order = await stage.evaluate((el) => {
    const z = (sel: string) => Number(getComputedStyle(el.querySelector(sel)!).zIndex);
    return { canvas: z(":scope > canvas"), front: z(":scope > svg.ta-front-layer") };
  });
  expect(order.front).toBeGreaterThan(order.canvas);
  // The artwork's own front half steps aside (no doubled pieces).
  await expect(stage.locator("> svg:not(.ta-front-layer) .ta-front")).toHaveCSS("visibility", "hidden");
  await snap(page, info, `roster-aura-front-${name}`);
});
