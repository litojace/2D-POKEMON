import { expect, test } from "@playwright/test";

import {
  createRoom,
  openHub,
  openPlayPanel,
  pushUntilBattle,
  snap,
} from "./helpers";
import { ISLAND, setInsets } from "./ui-measure";

// The countdown (3, 2, 1) in raids and the Spire is the PvP one
// (reveal.spec.ts): the whole screen edge to edge past the notch, a light
// see-through shade with the arena in view, one big number, no card. They
// used to keep the old card: raid-ui.ts draws their overlay and never marked
// it .is-countdown, and the full-screen rule left raids out (owner, 20 Nov
// 2026: the rites were new but the countdown still old).
const MODES = [
  {
    name: "raid",
    room: () => (window as any).__room("raid", { boss: "grumblecrag" }),
  },
  {
    name: "spire",
    room: () =>
      (window as any).__room("spire", { stage: "playing", floor: 2, seats: 2 }),
  },
] as const;
const SIZES = [
  { width: 956, height: 440, mobile: true, island: true },
  { width: 667, height: 375, mobile: true, island: false },
  { width: 1440, height: 900, mobile: false, island: false },
];

for (const mode of MODES)
  for (const size of SIZES)
    test(`the ${mode.name} countdown fills the whole screen at ${size.width}x${size.height}${size.island ? " with the Dynamic Island" : ""}`, async ({
      browser,
    }, info) => {
      test.setTimeout(120_000);
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        isMobile: size.mobile,
        hasTouch: size.mobile,
      });
      try {
        const page = await context.newPage();
        const errors = await openHub(page);
        await page.evaluate(mode.room);
        await openPlayPanel(page);
        await createRoom(page);
        await pushUntilBattle(page);
        if (size.island) await setInsets(page, ISLAND);

        await page.evaluate(() => {
          const w = window as any;
          w.__snap.phase = "countdown";
          w.__snap.remaining = 2;
          w.__push();
        });
        const overlay = page.locator("#arena-overlay");
        const card = overlay.locator(".countdown-card");
        await expect(card.locator("h2")).toHaveText("2");
        await expect(overlay).toHaveClass(/\bis-countdown\b/);
        const look = await page.evaluate(() => {
          const ov = document.getElementById("arena-overlay")!;
          const r = ov.getBoundingClientRect();
          const c = ov.querySelector<HTMLElement>(".countdown-card")!;
          const s = getComputedStyle(c);
          const line = c.querySelector(":scope > p, :scope > div")!;
          return {
            rect: [r.left, r.top, r.width, r.height].map(Math.round),
            card: [s.backgroundColor, s.backgroundImage, s.borderTopWidth],
            number: parseFloat(
              getComputedStyle(c.querySelector("h2")!).fontSize,
            ),
            line: [
              line.textContent!.trim().length > 0,
              getComputedStyle(line).color,
            ],
            // The shade is see-through: its darkest stop lets the arena show.
            alphas: [
              ...getComputedStyle(ov).backgroundImage.matchAll(
                /rgba\([^)]*,\s*([\d.]+)\)/g,
              ),
            ].map((m) => Number(m[1])),
          };
        });
        expect(look.rect).toEqual([0, 0, size.width, size.height]);
        expect(look.card).toEqual(["rgba(0, 0, 0, 0)", "none", "0px"]);
        expect(look.number).toBeGreaterThanOrEqual(110);
        // The objective (raid) or the floor (Spire) under the number.
        expect(look.line).toEqual([true, "rgb(234, 241, 255)"]);
        expect(look.alphas.length).toBeGreaterThan(0);
        expect(Math.max(...look.alphas)).toBeLessThanOrEqual(0.65);
        await snap(
          page,
          info,
          `${mode.name}-countdown-${size.width}x${size.height}${size.island ? "-island" : ""}`,
        );

        // The fight: nothing over the arena, and the mark is gone.
        await page.evaluate(() => {
          const w = window as any;
          w.__snap.phase = "playing";
          w.__push();
        });
        await expect(overlay).toBeEmpty();
        await expect(overlay).not.toHaveClass(/\bis-countdown\b/);
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });
