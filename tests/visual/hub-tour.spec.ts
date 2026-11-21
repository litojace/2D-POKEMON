import { expect, test, type Page } from "@playwright/test";
import { openHub, snap } from "./helpers";

// The Lobby tour (hub-tour.ts) and How to play (how-to-play.ts): a new
// account gets a short spotlight tour of the Lobby, with Skip on every step;
// it doesn't come back once done or skipped, and How to play replays it.
async function newPlayer(page: Page) {
  await page.addInitScript(() => {
    const w = window as any;
    w.__economyPatch = {
      journey: {
        xp: 0,
        recent: [],
        season: {
          id: "2026-10",
          xp: 0,
          week: "2026-W43",
          goals: {},
          completed: [],
        },
        unlocked: [],
      },
    };
    w.__accountPatch = { title: null, titleColor: null };
  });
}
const tour = (page: Page) => page.locator(".hub-tour");
type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width - 1 &&
  b.x < a.x + a.width - 1 &&
  a.y < b.y + b.height - 1 &&
  b.y < a.y + a.height - 1;

const SIZES = [
  { width: 844, height: 390, phone: true },
  { width: 700, height: 390, phone: true },
  { width: 1440, height: 900, phone: false },
];
for (const size of SIZES)
  test(`a new player's Lobby tour fits and can be skipped (${size.width}x${size.height})`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.phone,
      hasTouch: size.phone,
    });
    try {
      const page = await context.newPage();
      await newPlayer(page);
      const errors = await openHub(page);
      await expect(tour(page)).toBeVisible({ timeout: 15_000 });
      let steps = 0;
      while (await tour(page).count()) {
        // Let the spotlight and bubble settle on the step: their glide from
        // the last step ends (on a busy CI machine it can start late).
        await expect
          .poll(() =>
            page.evaluate(
              () =>
                document
                  .querySelector(".hub-tour")
                  ?.getAnimations({ subtree: true }).length ?? 0,
            ),
          )
          .toBe(0);
        const bubble = (await page.locator(".tour-bubble").boundingBox())!;
        const hole = (await page.locator(".tour-hole").boundingBox())!;
        // What CI needs to say if this step goes wrong.
        const where = JSON.stringify({
          step: steps,
          title: await page.locator(".tour-title").textContent(),
          side: await page.locator(".tour-bubble").getAttribute("data-side"),
          bubble,
          hole,
        });
        // Inside the screen, clear of the part it points at.
        expect(bubble.x).toBeGreaterThanOrEqual(0);
        expect(bubble.y).toBeGreaterThanOrEqual(0);
        expect(bubble.x + bubble.width).toBeLessThanOrEqual(size.width);
        expect(bubble.y + bubble.height).toBeLessThanOrEqual(size.height);
        expect(overlaps(bubble, hole), where).toBe(false);
        // Skip and Next are always there, big enough to tap, and on top.
        for (const b of ["skip", "next"]) {
          const el = page.locator(`[data-tour=${b}]`);
          await expect(el).toBeVisible();
          const r = (await el.boundingBox())!;
          expect(r.height).toBeGreaterThanOrEqual(36);
          const top = await page.evaluate(
            ([x, y]) =>
              document
                .elementFromPoint(x, y)
                ?.closest("[data-tour]")
                ?.getAttribute("data-tour"),
            [r.x + r.width / 2, r.y + r.height / 2],
          );
          expect(top).toBe(b);
        }
        await snap(page, info, `tour-${steps}-${size.width}x${size.height}`);
        steps++;
        if (steps === 3) break;
        await page.click("[data-tour=next]");
      }
      expect(steps).toBe(3);
      // The Lobby behind waits while the tour runs.
      await expect(page.locator(".lobby-play")).toHaveJSProperty(
        "inert",
        false,
      );
      expect(
        await page.evaluate(
          () => !!document.querySelector(".lobby-play")?.closest("[inert]"),
        ),
      ).toBe(true);
      await page.click("[data-tour=skip]");
      await expect(tour(page)).toHaveCount(0);
      expect(
        await page.evaluate(
          () => !!document.querySelector(".lobby-play")?.closest("[inert]"),
        ),
      ).toBe(false);
      expect(errors).toEqual([]);
      // Skipped once: not again on the next visit (same browser storage).
      await page.close();
      const again = await context.newPage();
      await newPlayer(again);
      const errors2 = await openHub(again);
      await expect(again.locator(".lobby-play")).toBeVisible();
      await again.waitForTimeout(1500);
      await expect(tour(again)).toHaveCount(0);
      expect(errors2).toEqual([]);
    } finally {
      await context.close();
    }
  });

test("the tour runs to the end, and How to play replays it", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await newPlayer(page);
    const errors = await openHub(page);
    await expect(tour(page)).toBeVisible({ timeout: 15_000 });
    // Keyboard works too: right arrow is Next.
    await page.keyboard.press("ArrowRight");
    await expect(page.locator(".tour-count")).toHaveText(/^2 \//);
    for (let i = 0; i < 10 && (await tour(page).count()); i++)
      await page.click("[data-tour=next]");
    await expect(tour(page)).toHaveCount(0);
    expect(
      await page.evaluate(() =>
        Object.entries(localStorage).filter(([k]) =>
          k.startsWith("arena-tour:"),
        ),
      ),
    ).toEqual([["arena-tour:11111111-1111-4111-8111-111111111111", "done"]]);
    // The account keeps it too, with how far the player got.
    const ends = () => page.evaluate(() => (window as any).__tourEnds ?? []);
    await expect
      .poll(ends)
      .toEqual([{ result: "done", reached: 6, steps: 6, replay: false }]);
    await page.click(".header-menu > summary");
    await page.click("#help");
    await page.click("[data-htp-tour]");
    await expect(page.locator("#dialog")).not.toHaveAttribute("open");
    await expect(tour(page)).toBeVisible();
    await expect(page.locator(".tour-count")).toHaveText(/^1 \//);
    await page.keyboard.press("Escape");
    await expect(tour(page)).toHaveCount(0);
    // A replay counts as one, apart from the first tour.
    await expect.poll(ends).toEqual([
      { result: "done", reached: 6, steps: 6, replay: false },
      { result: "skipped", reached: 1, steps: 6, replay: true },
    ]);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("a tour ended on another device doesn't show on this one", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await newPlayer(page);
    // This browser has never seen it; the account says it was skipped.
    await page.addInitScript(() => ((window as any).__tour = "skipped"));
    const errors = await openHub(page);
    await expect(page.locator(".lobby-play")).toBeVisible();
    await page.waitForTimeout(2000);
    await expect(tour(page)).toHaveCount(0);
    // This browser remembers it now, and nothing was sent back.
    expect(
      await page.evaluate(() =>
        localStorage.getItem("arena-tour:11111111-1111-4111-8111-111111111111"),
      ),
    ).toBe("skipped");
    expect(await page.evaluate(() => (window as any).__tourEnds ?? [])).toEqual(
      [],
    );
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

for (const size of SIZES.slice(0, 2))
  test(`How to play reads on a phone, with touch controls (${size.width}x${size.height})`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: true,
      hasTouch: true,
    });
    try {
      const page = await context.newPage();
      const errors = await openHub(page);
      await page.click(".header-menu > summary");
      await page.click("#help");
      const dialog = page.locator("#dialog");
      await expect(dialog.locator(".htp")).toBeVisible();
      for (const topic of [
        "basics",
        "battle",
        "controls",
        "modes",
        "progress",
        "social",
      ]) {
        await dialog.locator(`[data-htp-topic=${topic}]`).click();
        await expect(dialog.locator(".htp")).toHaveAttribute(
          "data-topic",
          topic,
        );
        // Nothing wider than the dialog (the tabs scroll inside their row).
        const wide = await dialog.evaluate((d) => {
          const box = d.querySelector(".dialog-content")!;
          return box.scrollWidth - box.clientWidth;
        });
        expect(wide).toBeLessThanOrEqual(1);
        // Go buttons line up: cards in one row put theirs at the same height.
        const rows = await dialog.evaluate((d) => {
          const byRow = new Map<number, number[]>();
          for (const card of Array.from(d.querySelectorAll(".htp-card"))) {
            const go = card.querySelector(".htp-go");
            if (!go) continue;
            const top = Math.round(card.getBoundingClientRect().top);
            byRow.set(top, [
              ...(byRow.get(top) ?? []),
              go.getBoundingClientRect().bottom,
            ]);
          }
          return Array.from(byRow.values());
        });
        for (const row of rows)
          expect(Math.max(...row) - Math.min(...row)).toBeLessThanOrEqual(1);
        await snap(page, info, `htp-${topic}-${size.width}x${size.height}`);
      }
      // A phone sees the touch buttons first, not keyboard keys.
      await dialog.locator("[data-htp-topic=controls]").click();
      await expect(dialog.locator('[data-htp-device="touch"]')).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(dialog.locator(".htp-keys")).toContainText("left half");
      await dialog.locator('[data-htp-device="keys"]').click();
      await expect(dialog.locator(".htp-keys")).toContainText("Basic attack");
      // The tabs stay in reach while a topic scrolls.
      await dialog.locator("[data-htp-topic=battle]").click();
      await dialog
        .locator(".dialog-content")
        .evaluate((e) => (e.scrollTop = 400));
      const tabs = (await dialog.locator(".htp-tabs").boundingBox())!;
      const content = (await dialog.locator(".dialog-content").boundingBox())!;
      expect(tabs.y).toBeGreaterThanOrEqual(content.y - 1);
      expect(tabs.y).toBeLessThan(content.y + 30);
      // Go opens the screen the card is about.
      await dialog.locator("[data-htp-topic=modes]").click();
      await dialog.locator('[data-htp-go="raids"]').click();
      await expect(dialog).not.toHaveAttribute("open");
      await expect(page.locator(".ui-panel-host .ui-panel")).toBeVisible();
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
