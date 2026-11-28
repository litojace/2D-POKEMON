import { expect, test, type Page } from "@playwright/test";
import { openPlaza, snap } from "./helpers";
import { playersLook } from "./players-look";

// A player's card, Plaza today and the Plaza map on a phone, in the look
// players have (themes/poster/plaza-lists.css). The card's labels each sit
// on one line ("Dance together" and "Invite to party" broke over two lines
// beside one-line neighbours, at 9.8 px), neighbours share one size, every
// control is a finger tall, and the card stays clear of Dash. Today's
// progress is gold; a map place with a quest has a gold edge.
const GOLD = "rgb(255, 214, 91)";

async function openCard(page: Page) {
  await page.evaluate(() => {
    const w = window as any,
      me = w.__plazaWorld.bodyOf("local");
    w.__plazaWorld.join("other", "acct-other", {
      name: "Rin",
      title: "Storm Chaser",
      titleColor: "#9fd0ff",
      level: 7,
      character: "tidefin",
      skin: null,
    });
    Object.assign(w.__plazaWorld.bodyOf("other"), { x: me.x + 90, y: me.y });
  });
  await expect
    .poll(() =>
      page.evaluate(() =>
        [...(window as any).__plaza.others.values()].some(
          (b: any) => b.name === "Rin",
        ),
      ),
    )
    .toBe(true);
  const spot = await page.evaluate(() => {
    const p = (window as any).__plaza,
      rin = [...p.others.values()].find((b: any) => b.name === "Rin");
    return p.worldClient(rin.tx, rin.ty - 30);
  });
  await page.mouse.click(spot.x, spot.y);
  const card = page.locator("#pz-card");
  await expect(card).toBeVisible();
  return card;
}

for (const size of [
  { width: 667, height: 375 },
  { width: 844, height: 390 },
])
  test(`the Plaza's card, today and map in Poster at ${size.width}x${size.height}`, async ({
    browser,
  }, info) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({
      viewport: size,
      isMobile: true,
      hasTouch: true,
    });
    try {
      await playersLook(context);
      const page = await context.newPage();
      const errors = await openPlaza(page);
      const name = `${size.width}x${size.height}`;

      // A player's card.
      const card = await openCard(page);
      await page.waitForTimeout(300);
      const buttons = await card.evaluate((c) =>
        [...c.querySelectorAll<HTMLElement>("button")].map((b) => {
          const r = b.getBoundingClientRect();
          return {
            text: b.textContent!.trim(),
            row: b.closest(".pc-pair")
              ? "pair"
              : b.closest(".pc-safety")
                ? "safety"
                : b.closest(".pc-acts")
                  ? "acts"
                  : "head",
            x: r.x,
            r: r.right,
            w: r.width,
            h: r.height,
            whole: b.scrollWidth <= b.clientWidth,
          };
        }),
      );
      for (const b of buttons) {
        expect(b.h, `${b.text} a finger tall`).toBeGreaterThanOrEqual(44);
        expect(b.whole, `${b.text} whole`).toBe(true);
      }
      // One line each: the label's text is one line high.
      const twoLines = await card.evaluate((c) =>
        [...c.querySelectorAll<HTMLElement>(".pc-acts button")]
          .filter((b) => {
            const range = document.createRange();
            const text = [...b.childNodes].filter(
              (n) => n.nodeType === Node.TEXT_NODE || n.nodeName === "SPAN",
            );
            const last = text.at(-1)!;
            range.selectNodeContents(last);
            return range.getClientRects().length > 1;
          })
          .map((b) => b.textContent!.trim()),
      );
      expect(twoLines, "labels on two lines").toEqual([]);
      for (const row of ["pair", "acts", "safety"]) {
        const ws = buttons.filter((b) => b.row === row).map((b) => b.w);
        expect(
          Math.max(...ws) - Math.min(...ws),
          `${row} buttons one size`,
        ).toBeLessThanOrEqual(1);
      }
      const box = (await card.boundingBox())!;
      const dash = (await page.locator("#pz-dash").boundingBox())!;
      expect(
        box.x + box.width <= dash.x || box.y + box.height <= dash.y,
        "the card clear of Dash",
      ).toBe(true);
      await snap(page, info, `plaza-card-poster-${name}`);
      await card.locator("[data-pc=close]").click();
      await expect(card).toBeHidden();

      // Plaza today.
      await page.locator("#pz-quests [data-qopen]").click();
      const panel = page.locator("#pz-qpanel");
      await expect(panel).toBeVisible();
      await page.waitForTimeout(300);
      const today = await panel.evaluate((p) => ({
        rows: [...p.querySelectorAll<HTMLElement>(".pz-q .row")].map(
          (r) => r.getBoundingClientRect().height,
        ),
        close: p.querySelector<HTMLElement>(".x")!.getBoundingClientRect()
          .height,
        bar: getComputedStyle(p.querySelector(".pz-q .bar i")!).backgroundColor,
      }));
      for (const h of today.rows) expect(h).toBeGreaterThanOrEqual(44);
      expect(today.close).toBeGreaterThanOrEqual(44);
      expect(today.bar).toBe(GOLD);
      await snap(page, info, `plaza-today-poster-${name}`);
      await panel.locator("[data-qclose]").click();
      await expect(panel).toBeHidden();

      // The map.
      await page.click("#pz-map-btn");
      const map = page.locator("#pz-map");
      await expect(map).toBeVisible();
      await page.waitForTimeout(300);
      const rows = await map.evaluate((m) =>
        [...m.querySelectorAll<HTMLElement>(".pz-map-list button")].map((b) => {
          const c = getComputedStyle(b);
          return {
            h: b.getBoundingClientRect().height,
            quest: b.classList.contains("quest"),
            edge: c.borderLeftColor,
            radius: c.borderTopLeftRadius,
            go: getComputedStyle(b.querySelector("i")!).borderTopLeftRadius,
          };
        }),
      );
      expect(rows.some((r) => r.quest)).toBe(true);
      for (const r of rows) {
        expect(r.h).toBeGreaterThanOrEqual(44);
        expect(r.radius).toBe("0px");
        expect(r.go).toBe("0px");
        if (r.quest) expect(r.edge).toBe(GOLD);
        else expect(r.edge).not.toBe(GOLD);
      }
      await snap(page, info, `plaza-map-poster-${name}`);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
