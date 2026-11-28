import { expect, test, type Page } from "@playwright/test";
import { openPlaza, snap } from "./helpers";
import { ISLAND, setInsets } from "./ui-measure";
import { onPlayersLook } from "./players-look";

// In the look players have (players-look.ts).
onPlayersLook();

// The Plaza's round HUD buttons (Map, the gift box, Album, Plaza today) are
// bare icons in the world, like the battle's corner icons (themes/poster/
// plaza.css; owner, 28 Nov: "drop the black circle, keep just the icon a
// little bigger, with a bit of shadow", then "the same for Today and the
// clock"): no disc behind them, the icon about 38 px with an ink outline,
// its word under it, a tap area of 44 px or more, and the gift box's and
// Today's counts a red badge on the icon's corner, the gifts' gone when no
// boxes are left. The clock loses its pill the same way: its sun or moon
// and its time in cream with an ink stroke, a tap area of 44 px; and so
// do fishing's day count and Book.
const SIZES = [
  { width: 667, height: 375, phone: true, island: false },
  { width: 844, height: 390, phone: true, island: false },
  { width: 852, height: 393, phone: true, island: true },
  { width: 1440, height: 900, phone: false, island: false },
];
const label = (s: (typeof SIZES)[number]) =>
  `${s.width}x${s.height}${s.island ? "-island" : ""}`;

const look = (page: Page) =>
  page.evaluate(() =>
    (
      [
        ["pz-map-btn", "#pz-map-btn"],
        ["pz-treat", "#pz-treat"],
        ["pz-album-btn", "#pz-album-btn"],
        ["today", "#pz-quests > .pz-qbtn"],
      ] as const
    ).map(([id, sel]) => {
      const b = document.querySelector<HTMLElement>(sel)!;
      const box = b.getBoundingClientRect();
      const cs = getComputedStyle(b);
      const icon = b.querySelector(".ico")!;
      const ib = icon.getBoundingClientRect();
      const badge =
        id === "pz-treat"
          ? b.querySelector("small")!
          : id === "today"
            ? b.querySelector(".pz-qbadge")!
            : null;
      const word =
        id === "pz-treat"
          ? getComputedStyle(b, "::after").content
          : b.querySelector("small")!.textContent;
      return {
        id,
        background: cs.backgroundColor,
        image: cs.backgroundImage,
        radius: cs.borderTopLeftRadius,
        box: [box.width, box.height],
        icon: [ib.width, ib.height],
        outline: getComputedStyle(icon).filter,
        word,
        badge: badge
          ? {
              shown: getComputedStyle(badge).display !== "none",
              background: getComputedStyle(badge).backgroundColor,
              text: badge.textContent,
              insideIcon:
                badge.getBoundingClientRect().left < ib.right &&
                badge.getBoundingClientRect().top < ib.top + ib.height / 2,
            }
          : null,
      };
    }),
  );

for (const size of SIZES)
  test(`the Plaza's Map, gift box, Album, Today and clock are bare at ${label(size)}`, async ({
    browser,
  }, info) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.phone,
      hasTouch: size.phone,
    });
    try {
      const page = await context.newPage();
      await openPlaza(page);
      if (size.island) await setInsets(page, ISLAND);
      // The clock's sun or moon and its time are written by the scene's
      // frame loop (plaza-scene.ts): until its first frame the clock holds
      // only "--:--". On a slow runner 300 ms was not always a frame (#680's
      // shard 21, twice at 1440x900).
      await expect(page.locator("#pz-clock .ico")).toHaveCount(1);
      await page.waitForTimeout(300);
      for (const b of await look(page)) {
        expect(b.background, b.id).toBe("rgba(0, 0, 0, 0)");
        expect(b.image, b.id).toBe("none");
        expect(b.radius, b.id).toBe("0px");
        expect(Math.min(...b.box), `${b.id} tap area`).toBeGreaterThanOrEqual(
          44,
        );
        expect(b.icon[0], `${b.id} icon`).toBeGreaterThanOrEqual(36);
        expect(b.outline, `${b.id} ink outline`).toContain("drop-shadow");
        expect(String(b.word), `${b.id} word`).toMatch(/Map|Gifts|Album|Today/);
        if (b.badge) {
          expect(b.badge.shown).toBe(true);
          expect(b.badge.text).toMatch(/^(\d+\+?|✓)$/);
          expect(b.badge.background).not.toBe("rgba(0, 0, 0, 0)");
          expect(b.badge.insideIcon).toBe(true);
        }
      }
      // The clock: no pill, its icon and time stroked in ink, a tap area of
      // 44 px (a phone's box is 34 px: the rest reaches above and below,
      // and a tap there lands on the clock).
      const clock = await page.evaluate(() => {
        const c = document.getElementById("pz-clock")!;
        const r = c.getBoundingClientRect();
        const cs = getComputedStyle(c);
        const hit = getComputedStyle(c, "::before");
        const x = r.left + r.width / 2;
        const on = (y: number) => c.contains(document.elementFromPoint(x, y));
        const reach = Math.max(0, -parseFloat(hit.top || "0"));
        return {
          background: cs.backgroundColor,
          image: cs.backgroundImage,
          shadow: cs.boxShadow,
          outline: getComputedStyle(c.querySelector(".ico")!).filter,
          stroke: getComputedStyle(c.querySelector("span")!).textShadow,
          tap: r.height + 2 * reach,
          above: reach ? on(r.top - reach + 1) : true,
          below: reach ? on(r.bottom + reach - 1) : true,
          right: r.right,
        };
      });
      expect(clock.background).toBe("rgba(0, 0, 0, 0)");
      expect(clock.image).toBe("none");
      expect(clock.shadow).toBe("none");
      expect(clock.outline).toContain("drop-shadow");
      expect(clock.stroke).toContain("rgb");
      expect(clock.tap, "clock tap area").toBeGreaterThanOrEqual(44);
      expect(clock.above, "a tap just above the clock").toBe(true);
      expect(clock.below, "a tap just below the clock").toBe(true);
      expect(clock.right).toBeLessThanOrEqual(
        size.width - (size.island ? ISLAND.right : 0),
      );
      for (const [tod, when] of [
        [0.42, "day"],
        [0.97, "night"],
      ] as const) {
        await page.evaluate((t) => (window as any).__plaza.setTod(t), tod);
        await page.waitForTimeout(300);
        await snap(page, info, `plaza-hud-${when}-${label(size)}`);
      }
      // Fishing's day count and Book are bare too, their words level and
      // the widest count (30/30) inside its box. (plaza-fishing.spec.ts
      // runs the real fishing in the old look; here only its HUD shows.)
      const fish = await page.evaluate(() => {
        const hud = document.getElementById("pz-fishhud")!;
        hud.hidden = false;
        const t = document.getElementById("pz-fish-today")!;
        t.innerHTML = `<b>30<i>/30</i></b><small>today</small>`;
        const book = document.getElementById("pz-fish-book2")!;
        const range = document.createRange();
        range.selectNodeContents(t.querySelector("b")!);
        const out = {
          backgrounds: [t, book].map(
            (e) => getComputedStyle(e).backgroundColor,
          ),
          stroke: getComputedStyle(t.querySelector("b")!).textShadow,
          words: [t, book].map(
            (e) => e.querySelector("small")!.getBoundingClientRect().top,
          ),
          count: range.getBoundingClientRect().width,
          box: t.getBoundingClientRect().width,
          apart:
            book.getBoundingClientRect().left - t.getBoundingClientRect().right,
        };
        hud.hidden = true;
        return out;
      });
      expect(fish.backgrounds).toEqual([
        "rgba(0, 0, 0, 0)",
        "rgba(0, 0, 0, 0)",
      ]);
      expect(fish.stroke).toContain("rgb");
      expect(Math.abs(fish.words[0] - fish.words[1])).toBeLessThanOrEqual(0.5);
      expect(fish.count).toBeLessThanOrEqual(fish.box);
      expect(fish.apart).toBeGreaterThan(0);
      // No boxes left: no badge.
      await page.evaluate(() => {
        document.getElementById("pz-treats")!.textContent = "0";
        document.getElementById("pz-treat")!.classList.add("empty");
      });
      const gift = (await look(page))[1];
      expect(gift.badge!.shown).toBe(false);
    } finally {
      await context.close();
    }
  });
