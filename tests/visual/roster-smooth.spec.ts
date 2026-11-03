import { expect, test } from "@playwright/test";
import { openHub, snap, hubMenu } from "./helpers";

// The roster fills the screen and its fighter keeps animating at the
// display's pace. (The Plaza resting behind panels is in plaza.spec.ts.)
test("the roster's fighter keeps animating", async ({ page }) => {
  await openHub(page);
  await hubMenu(page, "fighters");
  const stage = page.locator(".fighter-rig-stage").first();
  await expect(stage).toHaveClass(/is-ready/);
  // The preview is paced by the display, not a 30 fps timer.
  const time = async () => Number(await stage.getAttribute("data-animation-time"));
  const before = await time();
  await expect.poll(time, { timeout: 15_000 }).toBeGreaterThan(before + 200);
  await page.locator("#home-fighter-panel [data-home-close]").first().click();
  await expect(page.locator("#lobby-play")).toBeVisible();
});

// The animated fighter is a canvas over the still artwork. The aura's front
// half is drawn again above that canvas, so orbiting pieces pass in front.
for (const [name, size] of [
  ["desktop", { width: 1440, height: 900 }],
  ["phone", { width: 844, height: 390 }],
] as const)
test(`the roster fighter's aura passes in front of the animated fighter (${name})`, async ({ page }, info) => {
  await page.setViewportSize(size);
  await openHub(page);
  await hubMenu(page, "fighters");
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
