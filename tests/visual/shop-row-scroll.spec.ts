import { expect, test, type Page } from "@playwright/test";
import { openLobby } from "./helpers";

// The Shop's fighter row scrolls sideways on a phone. Picking a fighter far
// along it must leave it where it is: it went back to the first fighter
// whenever the next pick's page had another number of parts (no collection
// line, or no skins yet), because ui/patch.ts rebuilt the whole box then
// (owner, 19 Nov 2026).
test.use({
  viewport: { width: 956, height: 440 },
  isMobile: true,
  hasTouch: true,
});

async function tapAlongRow(page: Page) {
  const row = page.locator(".fit-room .fit-fighters").first();
  await expect(row).toBeVisible();
  const end = await row.evaluate((r) => {
    r.scrollLeft = r.scrollWidth;
    return Math.round(r.scrollLeft);
  });
  expect(end).toBeGreaterThan(50);
  const names = await row
    .locator(".fit-fighter")
    .evaluateAll((bs) => bs.map((b) => b.getAttribute("data-fit-fighter")!));
  const seen: string[] = [];
  // The last few, twice over: every kind of page lands on another.
  for (const name of [...names.slice(-5), ...names.slice(-5)]) {
    await row.locator(`[data-fit-fighter="${name}"]`).tap();
    await expect(row.locator(`[data-fit-fighter="${name}"]`)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    seen.push(
      `${name} ${await page
        .locator(".fit-room .fit-fighters")
        .first()
        .evaluate((r) => Math.round(r.scrollLeft))}`,
    );
  }
  expect(seen).toEqual(seen.map((s) => `${s.split(" ")[0]} ${end}`));
}

test("the Shop's and the Wardrobe's fighter rows stay where you scrolled them", async ({
  page,
}) => {
  const errors = await openLobby(page);
  await page.click('.lobby-rail [data-lobby-action="shop"]');
  await page.click('.fit-room [role="tab"]:has-text("Skins")');
  await tapAlongRow(page);
  await page.click('.fit-room [data-ui-mode="wardrobe"]');
  await tapAlongRow(page);
  expect(errors).toEqual([]);
});
