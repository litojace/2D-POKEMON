import { expect, test, type Page } from "@playwright/test";
import { openLobby, snap } from "./helpers";
import { fakeBistro } from "./bistro-fake";

// Bistro Shop cards put their price (or lock) on the card's bottom edge, so
// a row of cards lines its prices up however long each blurb is (owner, 11
// Nov 2026: the gold price pills sat at different heights, which looked
// untidy; Seating's Garden Table and Velvet Armchair have longer blurbs).
const SIZES = [
  { name: "ipad-landscape", width: 1376, height: 950, touch: true },
  { name: "desktop", width: 1440, height: 900, touch: false },
  { name: "phone", width: 844, height: 390, touch: true },
];
const B = (page: Page, js: string) =>
  page.evaluate(
    `(() => { const b = window.__bistro; const srv = window.__bistroServer; ${js} })()`,
  );

/** Each row of cards: how far apart its prices' bottoms are, and the largest gap to a card's bottom. */
const rows = (page: Page) =>
  page.evaluate(() => {
    const cards = [
      ...document.querySelectorAll<HTMLElement>(
        "#bs-sheet .bs-items > .bs-item",
      ),
    ];
    const byRow = new Map<number, { price: number; card: number }[]>();
    for (const c of cards) {
      const tag = c.querySelector(":scope > :last-child:is(.pr, .lk)");
      if (!tag) continue;
      const r = c.getBoundingClientRect();
      const t = tag.getBoundingClientRect();
      const key = Math.round(r.top);
      byRow.set(key, [
        ...(byRow.get(key) ?? []),
        { price: t.bottom, card: r.bottom },
      ]);
    }
    return [...byRow.values()]
      .filter((row) => row.length > 1)
      .map((row) => ({
        spread:
          Math.max(...row.map((p) => p.price)) -
          Math.min(...row.map((p) => p.price)),
        gap: Math.max(...row.map((p) => p.card - p.price)),
      }));
  });

for (const size of SIZES)
  test(`Bistro Shop prices line up along each row at ${size.name}`, async ({
    browser,
  }, info) => {
    test.setTimeout(150_000);
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.touch,
      hasTouch: size.touch,
    });
    try {
      const page = await context.newPage();
      const errors = await openLobby(page);
      await fakeBistro(page);
      await page.click('#hub-scenes [data-hub-scene="bistro"]');
      await page.waitForFunction(() => (window as any).__bistro?.sync().ready);
      // Some cards unlocked (a price), some not (a lock), as in a real bistro.
      await B(page, "srv.S.level = 26; srv.S.coins = 36227; return b.load()");
      await page.click('.bs-rail [data-sheet="shop"]');
      let checked = 0;
      for (const tab of [
        "furniture",
        "decor",
        "machines",
        "kitchen",
        "style",
        "bank",
      ]) {
        await page.click(`#bs-sheet [data-tab="${tab}"]`);
        await expect(
          page.locator(`#bs-sheet [data-tab="${tab}"]`),
        ).toHaveAttribute("aria-pressed", "true");
        for (const row of await rows(page)) {
          expect(row.spread, `${tab}: prices in a row`).toBeLessThanOrEqual(1);
          // The card's own bottom padding, nothing more.
          expect(row.gap, `${tab}: price to card bottom`).toBeLessThanOrEqual(
            14,
          );
          checked++;
        }
        if (tab === "furniture")
          await snap(page, info, `bistro-shop-prices-${size.name}`);
      }
      expect(checked).toBeGreaterThan(0);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
