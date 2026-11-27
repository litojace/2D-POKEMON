import { expect, test, type Page } from "@playwright/test";
import { openLobby, settle, snap } from "./helpers";
import { shopServer } from "./shop-server";

// Poster's split screens, a fighter's details and a raid boss's page
// (27 Nov 2026):
// - above a phone's height the tab row sits under the head, and its unchosen
//   tabs were the masthead's ink on the page's ink (only SKILLS or REWARDS
//   showed), in a 29 px row that cut their capitals;
// - at 667 x 375 the fighter's tabs ran under Close, "3/24" against its
//   edge (audit B12);
// - the mastery line beside the buttons ended in "…" on a phone (B10);
// - a raid reward's feat ended in "…" ("Feat: every charge in a…", B13).
const SIZES = [
  { width: 667, height: 375, phone: true },
  { width: 844, height: 390, phone: true },
  { width: 1440, height: 900, phone: false },
];

async function open(page: Page) {
  await page.addInitScript(() => {
    if (!location.search) history.replaceState(null, "", "/?ui=poster");
  });
  await shopServer(page, {
    raids: { bosses: { grumblecrag: { clears: 3 } } },
  });
  return openLobby(page);
}

/** Each tab of the split screen's row: its contrast, height and box. */
const tabs = (page: Page, room: string) =>
  page.evaluate((room) => {
    const rgba = (s: string) => s.match(/[\d.]+/g)!.map(Number);
    const lum = (c: number[]) => {
      const [x, y, z] = c.map((v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * x + 0.7152 * y + 0.0722 * z;
    };
    const row = document.querySelector<HTMLElement>(
      `${room} .ui-split-main > .ui-tabs`,
    )!;
    const close = document
      .querySelector(`${room} .ui-close`)!
      .getBoundingClientRect();
    const list = [...row.children].map((b) => {
      let el: Element | null = b,
        bg = "rgba(0, 0, 0, 0)";
      while (el && rgba(bg)[3] === 0) {
        bg = getComputedStyle(el).backgroundColor;
        el = el.parentElement;
      }
      const [br, bgg, bb] = rgba(bg);
      const [r, g, bl, a = 1] = rgba(getComputedStyle(b).color);
      const text = [
        r * a + br * (1 - a),
        g * a + bgg * (1 - a),
        bl * a + bb * (1 - a),
      ];
      const l1 = lum(text),
        l2 = lum([br, bgg, bb]);
      const box = b.getBoundingClientRect();
      return {
        name: b.textContent!.trim(),
        contrast: (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05),
        height: box.height,
        cut: b.scrollHeight > b.clientHeight + 1,
        right: box.right,
      };
    });
    return {
      list,
      closeLeft: close.left,
      hidden: row.scrollWidth - row.clientWidth,
    };
  }, room);

for (const size of SIZES)
  test(`Poster's split screens: tabs read, clear Close; the mastery and reward lines read whole (${size.width}x${size.height})`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.phone,
      hasTouch: size.phone,
    });
    try {
      const page = await context.newPage();
      const errors = await open(page);

      // A fighter's details.
      await page.click('.lobby-rail [data-lobby-action="fighters"]');
      await page.click("[data-roster-details]");
      await page.click('[data-ui-rtab="skills"]');
      await expect(page.locator('[data-ui-rtab="skills"]')).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await settle(page);
      const fighter = await tabs(page, ".roster-room");
      for (const t of fighter.list) {
        expect(t.contrast, `${t.name} reads`).toBeGreaterThanOrEqual(4.5);
        expect(t.cut, `${t.name} whole`).toBe(false);
      }
      expect(
        fighter.hidden,
        "tabs hidden past the row's end",
      ).toBeLessThanOrEqual(1);
      const last = fighter.list[fighter.list.length - 1];
      expect(
        fighter.closeLeft - last.right,
        "the last tab's gap before Close",
      ).toBeGreaterThanOrEqual(6);
      const mastery = await page
        .locator(".roster-foot-text .ui-note")
        .evaluate((e) =>
          Math.max(
            e.scrollHeight - e.clientHeight,
            e.scrollWidth - e.clientWidth,
          ),
        );
      expect(mastery, "the mastery line whole").toBeLessThanOrEqual(1);
      await snap(page, info, `poster-fighter-tabs-${size.width}`);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      await page.keyboard.press("Escape");

      // A raid boss's rewards.
      await page.click('.lobby-rail [data-lobby-action="raids"]');
      await page.click('[data-raid-card="grumblecrag"]');
      await page.click('[data-ui-raid-tab="rewards"]');
      await expect(page.locator(".rh-reward").first()).toBeVisible();
      await settle(page);
      const boss = await tabs(page, ".rh-room");
      for (const t of boss.list) {
        expect(t.contrast, `${t.name} reads`).toBeGreaterThanOrEqual(4.5);
        expect(t.cut, `${t.name} whole`).toBe(false);
      }
      if (!size.phone)
        for (const t of boss.list)
          expect(t.height, `${t.name} a finger tall`).toBeGreaterThanOrEqual(
            36,
          );
      // A desktop shows every feat whole; a phone's half-width card shows
      // two lines of it (tapped open, the card shows all of it).
      const cut = await page
        .locator(".rh-reward-text small")
        .evaluateAll((els) =>
          els
            .filter((e) => {
              const lh = parseFloat(getComputedStyle(e).lineHeight) || 14;
              if (e.scrollWidth > e.clientWidth + 1) return true;
              return innerHeight > 500
                ? e.scrollHeight > e.clientHeight + 1
                : e.clientHeight < 2 * lh - 2 &&
                    e.scrollHeight > e.clientHeight + 1;
            })
            .map((e) => e.textContent),
        );
      expect(cut, "reward lines cut short").toEqual([]);
      await snap(page, info, `poster-boss-tabs-${size.width}`);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
