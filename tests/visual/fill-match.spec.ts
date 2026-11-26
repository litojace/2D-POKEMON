import { expect, test, type Page } from "@playwright/test";
import { openHub, skipTour, snap } from "./helpers";

// 2v2 and Free-for-all on your own (docs/pvp-plan.md, "Bots fill in"): the
// mode menu lists them for a lone player and says bots fill in; PLAY opens
// a search sheet that says when bots take the empty seats, counts down to
// it, and starts at once on "Start with bots".
const SIZES = [
  { width: 667, height: 375 },
  { width: 844, height: 390 },
  {
    width: 852,
    height: 393,
    inset: { left: 59, right: 59, bottom: 21, top: 0 },
  },
  { width: 1440, height: 900, desktop: true },
];
/** Answer the queue as the server does for a lone searcher; record emits. */
async function lonelyQueue(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    w.__emitted = [];
    w.__emit = (ev: string, data: unknown) => w.__emitted.push({ ev, data });
    const base = w.__reply;
    w.__reply = (ev: string, data: unknown) =>
      ev === "quick-join"
        ? { ok: true, queued: true, online: 1 }
        : ev === "quick-leave" || ev === "quick-fill"
          ? { ok: true }
          : base?.(ev, data);
  });
}
const sent = (page: Page, ev: string) =>
  page.evaluate(
    (ev) => (window as any).__emitted.filter((e: any) => e.ev === ev),
    ev,
  );

for (const size of SIZES) {
  const name = `${size.width}x${size.height}${size.inset ? "-notch" : ""}`;
  test(`a lone player searches 2v2 and bots fill in (${name})`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: !size.desktop,
      hasTouch: !size.desktop,
    });
    try {
      const page = await context.newPage();
      await skipTour(page);
      const errors = await openHub(page);
      if (size.inset)
        await page.evaluate((inset) => {
          for (const [key, value] of Object.entries(inset))
            document.documentElement.style.setProperty(
              `--safe-${key}`,
              `${value}px`,
            );
        }, size.inset);
      await page.clock.install();
      await lonelyQueue(page);

      // The mode menu lists both for a lone player, and says bots fill in.
      await page.click("#lobby-mode");
      const teams = page.locator('#lobby-mode-menu [data-lobby-mode="teams"]'),
        ffa = page.locator('#lobby-mode-menu [data-lobby-mode="ffa"]');
      await expect(teams).toBeVisible();
      await expect(ffa).toBeVisible();
      await expect(teams.locator("small")).toHaveText(
        "Bots fill in · best of five",
      );
      await expect(ffa.locator("small")).toHaveText(
        "Bots fill in · 4 fighters",
      );
      await snap(page, info, `fill-modes-${name}`);
      await teams.click();
      await expect(page.locator("#lobby-mode")).toContainText("2v2 Teams");
      await expect(page.locator("#lobby-mode small")).toHaveText(
        "Bots fill in · best of five",
      );

      // PLAY: the search, with your fighter.
      await page.click("#lobby-play");
      const sheet = page.locator("#quick-search");
      await expect(sheet).toBeVisible();
      await expect(sheet.locator(".ui-kicker")).toHaveText("2v2 Teams");
      await expect(sheet).toContainText("Searching for players");
      await expect(sheet).toContainText("1 other player online");
      await expect(sheet.locator(".quick-fill")).toHaveText(
        "Bots take the empty seats in 15 s. They are labelled (Bot).",
      );
      expect((await sent(page, "quick-join"))[0].data).toMatchObject({
        mode: "teams",
        character: "voltkit",
      });
      // The sheet is whole, inside the safe area, its buttons a finger tall.
      const box = (await sheet.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(size.inset?.left ?? 0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(
        size.width - (size.inset?.right ?? 0),
      );
      expect(box.y + box.height).toBeLessThanOrEqual(
        size.height - (size.inset?.bottom ?? 0),
      );
      expect(
        await sheet.evaluate((el) => el.scrollHeight - el.clientHeight),
      ).toBeLessThanOrEqual(1);
      for (const b of await sheet.locator("button").all()) {
        const r = (await b.boundingBox())!;
        expect(r.height).toBeGreaterThanOrEqual(44);
        expect(
          await b.evaluate((el) => el.scrollWidth - el.clientWidth),
        ).toBeLessThanOrEqual(1);
      }
      await snap(page, info, `fill-search-${name}`);

      // It counts down in place...
      const width = (await sheet.locator(".quick-fill").boundingBox())!.width;
      await page.clock.fastForward(6_000);
      await expect(sheet.locator("[data-quick-count]")).toHaveText("9");
      expect(
        Math.abs(
          (await sheet.locator(".quick-fill").boundingBox())!.width - width,
        ),
      ).toBeLessThan(1);
      expect(await sent(page, "quick-fill")).toHaveLength(0);
      // ...and asks for bots when the wait runs out, once.
      await page.clock.fastForward(10_000);
      await expect(sheet).toHaveAttribute("data-state", "starting");
      await expect(sheet).toContainText("Starting your match");
      const asked = await sent(page, "quick-fill");
      expect(asked).toHaveLength(1);
      expect(["easy", "normal", "hard"]).toContain(asked[0].data.difficulty);
      await page.clock.fastForward(5_000);
      expect(await sent(page, "quick-fill")).toHaveLength(1);
      await snap(page, info, `fill-starting-${name}`);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

test("Start with bots skips the wait; Cancel leaves the search", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await skipTour(page);
  const errors = await openHub(page);
  await lonelyQueue(page);
  await page.click("#lobby-mode");
  await page.click('#lobby-mode-menu [data-lobby-mode="ffa"]');
  await page.click("#lobby-play");
  const sheet = page.locator("#quick-search");
  await expect(sheet.locator(".ui-kicker")).toHaveText("Free-for-all");
  await sheet.locator("[data-quick-cancel]").click();
  await expect(sheet).toHaveCount(0);
  expect(await sent(page, "quick-leave")).toHaveLength(1);
  expect(await sent(page, "quick-fill")).toHaveLength(0);

  await page.click("#lobby-play");
  await expect(sheet).toBeVisible();
  await sheet.locator("[data-quick-fill]").click();
  await expect(sheet).toHaveAttribute("data-state", "starting");
  expect(await sent(page, "quick-fill")).toHaveLength(1);
  // A second tap does nothing: the buttons are off while it starts.
  await expect(sheet.locator("[data-quick-fill]")).toBeDisabled();
  expect(errors).toEqual([]);
});
