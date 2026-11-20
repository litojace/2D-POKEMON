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
  // What happened to the row, for a failure: on CI the first tap once found
  // it at 8 (the picked fighter just brought into view), never here.
  await row.evaluate((r) => {
    const w = window as any;
    const t0 = performance.now();
    const log: string[] = (w.__rowLog = []);
    const at = () => Math.round(performance.now() - t0);
    w.__row = r;
    r.addEventListener("scroll", () =>
      log.push(`${at()} scroll ${Math.round(r.scrollLeft)}`),
    );
    new MutationObserver((records) => {
      for (const m of records)
        for (const n of Array.from(m.removedNodes))
          if (n === r || n.contains(r))
            log.push(
              `${at()} row removed with ${n === r ? "itself" : (n as Element).className || n.nodeName}`,
            );
    }).observe(document.body, { childList: true, subtree: true });
  });
  const seen: string[] = [];
  // The last few, twice over: every kind of page lands on another.
  for (const name of [...names.slice(-5), ...names.slice(-5)]) {
    await page.evaluate((name) => {
      const w = window as any;
      const now = document.querySelector<HTMLElement>(
        ".fit-room .fit-fighters",
      );
      w.__rowLog.push(
        `tap ${name}: row ${now === w.__row ? "same" : "new"} at ${Math.round(now?.scrollLeft ?? -1)}`,
      );
    }, name);
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
  expect(
    seen,
    (await page.evaluate(() => (window as any).__rowLog as string[])).join(
      "; ",
    ),
  ).toEqual(seen.map((s) => `${s.split(" ")[0]} ${end}`));
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
