import { expect, test, type Page } from "@playwright/test";
import {
  createRoom,
  hubMenu,
  openHub,
  openPlayPanel,
  pushUntilBattle,
  skipTour,
  snap,
} from "./helpers";
import { setInsets, type Insets } from "./ui-measure";
import { onPlayersLook } from "./players-look";

// In the look players have (players-look.ts).
onPlayersLook();

/*
 * An iPhone's screen corners are rounded (about 55 pt across on the
 * Dynamic Island phones, 47 pt on the notch ones), and in landscape the side
 * away from the notch keeps only 32 px (notch-insets.ts, CORNER_ROOM).
 * Poster's corner buttons are squares: a circle there cleared the curve, a
 * square's corner did not. The battle's settings button at the top right,
 * 4 px from the top, came within 0.6 px of the curve (owner, 27 Nov: "cut by
 * the screen's rounded corner and edge").
 *
 * Every painted box on screen, in each corner, keeps its own corner at
 * least CLEAR px inside the curve (a circle of the screen's corner radius:
 * iOS draws a slightly fuller curve, hence the margin), with the island on
 * either side.
 */
const CLEAR = 5;
const PHONES = [
  { width: 852, height: 393, radius: 55, notch: 59 },
  { width: 932, height: 430, radius: 55, notch: 59 },
  { width: 844, height: 390, radius: 47.33, notch: 47 },
];
const sides = (notch: number): [string, Insets][] => [
  ["island-left", { left: notch, right: 32, top: 0, bottom: 21 }],
  ["island-right", { left: 32, right: notch, top: 0, bottom: 21 }],
];

/** Boxes whose corner comes closer than CLEAR to the screen's curve. */
function cutCorners(page: Page, radius: number) {
  return page.evaluate(
    ({ R, CLEAR }) => {
      const vw = innerWidth,
        vh = innerHeight;
      const cut: string[] = [];
      for (const e of document.querySelectorAll("body *")) {
        const r = e.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) continue;
        // Wholly on screen: what a scroller cuts off is not drawn there.
        if (r.left < 0 || r.top < 0 || r.right > vw || r.bottom > vh) continue;
        // Nor what a scrolling row or panel cuts at its own edge: that edge
        // is the box drawn there, and it is checked itself.
        let clipped = false;
        for (let a = e.parentElement; a && !clipped; a = a.parentElement) {
          const o = getComputedStyle(a);
          if (o.overflowX === "visible" && o.overflowY === "visible") continue;
          const c = a.getBoundingClientRect();
          clipped =
            r.left < c.left - 0.5 ||
            r.top < c.top - 0.5 ||
            r.right > c.right + 0.5 ||
            r.bottom > c.bottom + 0.5;
        }
        if (clipped) continue;
        // The screen's own backdrops run under the corners by design.
        if (r.width > vw * 0.95 && r.height > vh * 0.95) continue;
        const cs = getComputedStyle(e);
        if (cs.visibility === "hidden" || Number(cs.opacity) < 0.05) continue;
        const painted =
          cs.backgroundColor !== "rgba(0, 0, 0, 0)" ||
          parseFloat(cs.borderTopWidth) > 0 ||
          cs.backgroundImage !== "none" ||
          cs.boxShadow !== "none" ||
          /^(img|svg|canvas)$/i.test(e.tagName);
        if (!painted) continue;
        const rad = Math.min(
          parseFloat(cs.borderTopLeftRadius) || 0,
          r.width / 2,
          r.height / 2,
        );
        const gaps = [
          [r.left, r.top, "top left"],
          [vw - r.right, r.top, "top right"],
          [r.left, vh - r.bottom, "bottom left"],
          [vw - r.right, vh - r.bottom, "bottom right"],
        ] as const;
        for (const [x, y, where] of gaps) {
          // The box's corner (rounded by its own radius) against the curve.
          const dx = R - (x + rad),
            dy = R - (y + rad);
          if (dx <= 0 || dy <= 0) continue;
          const clearance = R - (Math.hypot(dx, dy) + rad);
          if (clearance < CLEAR) {
            const id = e.id ? `#${e.id}` : "";
            const cls = [...e.classList].slice(0, 2).map((c) => `.${c}`);
            cut.push(
              `${e.tagName.toLowerCase()}${id}${cls.join("")} ${where}: ${clearance.toFixed(1)} px`,
            );
          }
        }
      }
      return cut;
    },
    { R: radius, CLEAR },
  );
}

for (const phone of PHONES)
  test(`nothing square is cut by an iPhone's rounded corners at ${phone.width}x${phone.height}`, async ({
    browser,
  }, info) => {
    test.setTimeout(180_000);
    const context = await browser.newContext({
      viewport: { width: phone.width, height: phone.height },
      isMobile: true,
      hasTouch: true,
    });
    try {
      const page = await context.newPage();
      await skipTour(page);
      await openHub(page);
      const check = async (screen: string) => {
        for (const [side, insets] of sides(phone.notch)) {
          await setInsets(page, insets);
          await page.waitForTimeout(300);
          expect
            .soft(await cutCorners(page, phone.radius), `${screen}, ${side}`)
            .toEqual([]);
        }
      };
      await check("the Lobby");
      for (const screen of ["fighters", "shop", "raids", "missions", "ranks"]) {
        await hubMenu(page, screen);
        await page.waitForTimeout(600);
        await check(screen);
        await page.locator("[data-ui-close]:visible").first().click();
        await page.waitForTimeout(500);
      }
      await page.evaluate(() =>
        (window as any).__room("pvp", { mode: "duel", phase: "playing" }),
      );
      await openPlayPanel(page);
      await createRoom(page);
      await pushUntilBattle(page);
      await check("a duel");
      if (phone.width === 852) {
        await setInsets(page, sides(phone.notch)[0][1]);
        await snap(page, info, `iphone-corners-duel-${phone.width}`);
      }
      await page.evaluate(() => {
        const w = window as any;
        w.__snap.phase = "finished";
        w.__snap.winner = "me";
        w.__push();
      });
      await expect(page.locator(".action-overlay h2")).toBeVisible();
      await check("the results");
    } finally {
      await context.close();
    }
  });
