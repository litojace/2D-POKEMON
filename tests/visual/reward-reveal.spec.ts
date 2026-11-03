import { expect, test } from "@playwright/test";
import { openHub, snap } from "./helpers";

// A raid clear that earns new rewards turns each one over as a card.
for (const size of [
  { width: 932, height: 430 },
  { width: 1440, height: 900 },
])
  test(`new rewards flip over one card at a time (${size.width}x${size.height})`, async ({
    page,
  }, info) => {
    await page.setViewportSize(size);
    await openHub(page);
    const path = new URL(
      "../../apps/client/src/reward-reveal.ts",
      import.meta.url,
    ).pathname;
    await page.evaluate(async (path) => {
      const m = await import(/* @vite-ignore */ `/@fs${path}`);
      const { RAID_REWARDS } = await import(
        /* @vite-ignore */ `/@fs${path.replace("apps/client/src/reward-reveal.ts", "packages/shared/src/raid.ts")}`
      );
      const pick = (id: string) =>
        RAID_REWARDS.find((r: { id: string }) => r.id === id);
      void m.showRewardReveal(
        [pick("conqueror"), pick("mountain-conqueror")],
        "voltkit",
      );
    }, path);
    const card = page.locator("#reward-reveal .reveal-card");
    await expect(card).toHaveClass(/is-flipped/);
    await expect(page.locator("#reward-reveal")).toContainText("1 of 2");
    await expect(page.locator(".reveal-name")).toHaveText("Conqueror frame");
    await page.waitForTimeout(1300);
    await snap(page, info, `reward-reveal-${size.width}`);
    // Whole card on screen.
    const box = (await card.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(size.height);
    await page.getByRole("button", { name: "Next reward" }).click();
    await expect(page.locator(".reveal-name")).toHaveText("Mountain Conqueror");
    await page.getByRole("button", { name: "Awesome!" }).click();
    await expect(page.locator("#reward-reveal")).toHaveCount(0);
  });
