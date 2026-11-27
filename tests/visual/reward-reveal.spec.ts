import { expect, test } from "@playwright/test";
import { openHub, snap } from "./helpers";
import { onPlayersLook } from "./players-look";

// In the look players have (players-look.ts).
onPlayersLook();

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
    // A frame's ornaments hang outside its ring (the Conqueror frame's gem
    // sat in the middle of its name: audit A09). The picture is drawn past
    // its box, so the check is that the ring keeps to 80% of the art box,
    // which leaves its ornaments room above the name.
    const share = await page.evaluate(() => {
      const art = document
        .querySelector(".reveal-art")!
        .getBoundingClientRect();
      const ring = document
        .querySelector(".reveal-art .raid-cosmetic-preview")!
        .getBoundingClientRect();
      return ring.height / art.height;
    });
    expect(share, "frame ring's share of the art box").toBeLessThanOrEqual(
      0.85,
    );
    // Whole card on screen.
    const box = (await card.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(size.height);
    await page.getByRole("button", { name: "Next reward" }).click();
    await expect(page.locator(".reveal-name")).toHaveText("Mountain Conqueror");
    await page.getByRole("button", { name: "Awesome!" }).click();
    await expect(page.locator("#reward-reveal")).toHaveCount(0);
  });

// "Wear it now": an appearance reward goes straight onto your fighter; a
// title (worn from the profile) doesn't offer it.
for (const size of [
  { width: 932, height: 430 },
  { width: 1440, height: 900 },
])
  test(`a new reward can be worn straight away (${size.width}x${size.height})`, async ({
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
      const w = window as any;
      w.__worn = [];
      w.__wearFails = true;
      void m.showRewardReveal(
        [pick("mountainborn"), pick("cragbreaker")],
        "voltkit",
        document.body,
        async (r: { id: string }) => {
          await new Promise((done) => setTimeout(done, 50));
          if (w.__wearFails) throw new Error("offline");
          w.__worn.push(r.id);
        },
      );
    }, path);
    const wear = page.getByRole("button", { name: "Wear it now" });
    await expect(wear).toBeFocused();
    await expect(page.locator(".reveal-name")).toHaveText(
      "Mountainborn entrance",
    );
    // The buttons fit on a short landscape phone too.
    for (const b of [wear, page.locator(".reveal-next")]) {
      const r = (await b.boundingBox())!;
      expect(r.y + r.height).toBeLessThanOrEqual(size.height);
    }
    await page.waitForTimeout(1300);
    await snap(page, info, `reward-wear-${size.width}`);
    // A failure says so and lets you try again.
    await wear.click();
    await expect(page.locator(".reveal-hint")).toContainText("Couldn't wear");
    await expect(wear).toBeEnabled();
    await page.evaluate(() => ((window as any).__wearFails = false));
    await wear.click();
    await expect(page.getByRole("button", { name: "Worn ✓" })).toBeDisabled();
    expect(await page.evaluate(() => (window as any).__worn)).toEqual([
      "mountainborn",
    ]);
    await page.getByRole("button", { name: "Next reward" }).click();
    // A title: no "Wear it now".
    await expect(page.locator(".reveal-name")).toHaveText("Cragbreaker");
    await expect(page.locator(".reveal-wear")).toHaveCount(0);
    await page.getByRole("button", { name: "Awesome!" }).click();
    await expect(page.locator("#reward-reveal")).toHaveCount(0);
  });
