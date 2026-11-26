import { expect, test } from "@playwright/test";
import { centred } from "./ui-checks";
import { fileURLToPath } from "node:url";
import { openHub, snap } from "./helpers";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

// On the game's old address a banner offers the new one (domain-move.ts):
// Open and Later side by side, the whole sentence readable, clear of the
// notch, buttons 44 px. The harness runs on localhost, so the test shows
// the same notice main.ts shows on parena.litojace.com.
const VIEWS = [
  { width: 667, height: 375, inset: null },
  { width: 844, height: 390, inset: null },
  { width: 852, height: 393, inset: { left: 59, right: 59, bottom: 21 } },
  { width: 1280, height: 800, inset: null },
];

for (const view of VIEWS) {
  test(`the move notice at ${view.width}x${view.height}`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: view.width, height: view.height });
    await openHub(page);
    if (view.inset)
      await page.evaluate((inset) => {
        for (const [key, value] of Object.entries(inset))
          document.documentElement.style.setProperty(
            `--safe-${key}`,
            `${value}px`,
          );
      }, view.inset);
    await page.evaluate(async (root) => {
      const src = `/@fs${root}apps/client/src`;
      const { AnnouncementBanner } = await import(`${src}/announcements.ts`);
      const { moveNotice } = await import(`${src}/domain-move.ts`);
      const site = "https://play.elementarenausa.com";
      new AnnouncementBanner().notice(moveNotice(site), {
        href: `${site}/`,
        label: "Open",
      });
    }, ROOT);
    const banner = page.locator(".announcement-banner");
    await expect(banner).toHaveClass(/is-shown/);
    await expect
      .poll(async () => (await banner.boundingBox())!.y)
      .toBeGreaterThanOrEqual(8);
    const go = banner.locator(".announcement-go");
    const later = banner.locator(".announcement-ok");
    await expect(go).toHaveText("Open");
    await expect(go).toHaveAttribute(
      "href",
      "https://play.elementarenausa.com/",
    );
    await expect(later).toHaveText("Later");
    // The sentence reads in full: no clamp cuts it.
    const clipped = await banner
      .locator("p")
      .evaluate((p) => p.scrollHeight > p.clientHeight + 1);
    expect(clipped, "message cut short").toBe(false);
    const b = (await banner.boundingBox())!;
    const left = view.inset?.left ?? 0,
      right = view.inset?.right ?? 0;
    expect(b.x).toBeGreaterThanOrEqual(left);
    expect(b.x + b.width).toBeLessThanOrEqual(view.width - right);
    for (const button of [go, later]) {
      const r = (await button.boundingBox())!;
      expect(r.height).toBeGreaterThanOrEqual(44);
      expect(r.width).toBeGreaterThanOrEqual(44);
      // Both buttons sit inside the banner, on one row.
      expect(r.y).toBeGreaterThanOrEqual(b.y);
      expect(r.y + r.height).toBeLessThanOrEqual(b.y + b.height + 0.5);
    }
    expect(
      Math.abs((await go.boundingBox())!.y - (await later.boundingBox())!.y),
    ).toBeLessThan(1);
    await centred(page, ".announcement-go", "Open");
    await centred(page, ".announcement-ok", "Later");
    await snap(page, info, `move-notice-${view.width}x${view.height}`);
    // Later closes it; it comes back only with the next few days' id.
    await later.click();
    await expect(banner).toHaveCount(0);
  });
}
