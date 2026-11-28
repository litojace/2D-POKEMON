import { expect, test } from "@playwright/test";
import { openHub, settle, skipTour } from "./helpers";
import { onPlayersLook } from "./players-look";

onPlayersLook();

// A raid boss's line (its blurb, up to 225 letters) sat on the boss page's
// masthead beside All bosses, cut to one line with "…" on a desktop. It is
// the first line of the page's body now, under the tabs, and wraps: every
// boss's line reads whole, inside the panel, and it reads on the board.
// Phones held sideways still leave it out (no room beside the stage), as
// before.
const BOSSES = [
  "grumblecrag",
  "tidewyrm",
  "gloomshade",
  "somnara",
  "prismatail",
  "emberwing",
  "storm-twins",
];
for (const size of [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 1024, height: 768 },
])
  test(`a raid boss's line reads whole under the tabs (${size.width}x${size.height})`, async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({ viewport: size });
    try {
      const page = await context.newPage();
      await skipTour(page);
      const errors = await openHub(page);
      await page.click('.lobby-rail [data-lobby-action="raids"]');
      for (const boss of BOSSES) {
        await page.click(`[data-raid-card="${boss}"]`);
        const lede = page.locator(".rh-room .rh-body > .rh-lede");
        await expect(lede).toBeVisible();
        // The page slides in: measure it once it has settled (CLAUDE.md).
        await settle(page);
        const s = await lede.evaluate((el) => {
          const r = el.getBoundingClientRect();
          const body = el.closest(".rh-body")!.getBoundingClientRect();
          const c = getComputedStyle(el);
          // Its colour against the panel's board (Poster: #17171b).
          const panel = getComputedStyle(el.closest(".ui-panel")!);
          const rgb = (v: string) =>
            v
              .match(/[\d.]+/g)!
              .slice(0, 3)
              .map(Number);
          const lum = (x: number[]) => {
            const [a, b, d] = x.map((v) => {
              v /= 255;
              return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
            });
            return 0.2126 * a + 0.7152 * b + 0.0722 * d;
          };
          const l1 = lum(rgb(c.color)),
            l2 = lum(rgb(panel.backgroundColor));
          return {
            text: el.textContent ?? "",
            cut:
              el.scrollWidth > el.clientWidth + 1 ||
              el.scrollHeight > el.clientHeight + 1 ||
              c.textOverflow === "ellipsis",
            inside: r.left >= body.left - 1 && r.right <= body.right + 1,
            lines: Math.round(r.height / parseFloat(c.lineHeight)),
            contrast: (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05),
          };
        });
        expect(s.text.length, boss).toBeGreaterThan(40);
        expect(s.cut, boss).toBe(false);
        expect(s.inside, boss).toBe(true);
        expect(s.lines, boss).toBeLessThanOrEqual(4);
        expect(s.contrast, boss).toBeGreaterThanOrEqual(4.5);
        // The masthead no longer carries it.
        await expect(page.locator(".rh-room .rh-head .rh-hint")).toHaveCount(0);
        await page.click(".rh-room [data-raid-back]");
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
