import { expect, test } from "@playwright/test";
import {
  box,
  inside,
  openHub,
  pushUntilBattle,
  snap,
  openPlayPanel,
  startPractice,
} from "./helpers";
import { onPlayersLook } from "./players-look";

// In the look players have (players-look.ts).
onPlayersLook();

// A short visible viewport includes Safari's expanded address/tab bars.
for (const size of [
  { width: 844, height: 280 },
  { width: 844, height: 390 },
  { width: 1024, height: 500 },
]) {
  test(`mobile victory keeps actions reachable at ${size.width}×${size.height}`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: size,
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    try {
      const errors = await openHub(page);
      await page.evaluate(() => (window as any).__room("practice"));
      await openPlayPanel(page);
      await startPractice(page);
      await pushUntilBattle(page);
      await page.evaluate(() => {
        const w = window as any;
        delete w.__snap.practice;
        Object.assign(w.__snap, {
          phase: "finished",
          matchId: "mobile-test",
          winner: "me",
          vsBot: true,
          scores: { me: 3, "target-ABC123": 0 },
        });
        w.__push();
      });
      await expect(page.locator(".action-overlay h2")).toContainText("Victory");
      // The real XP/level-up card makes the results taller than a short phone.
      await page.evaluate(async () => {
        const { resultXp } = await import("/rooms.ts");
        document.querySelector(".panel-scroll")!.insertAdjacentHTML(
          "beforeend",
          resultXp(
            {
              xp: 2600,
              recent: [
                {
                  ref: "match:mobile-test",
                  amount: 150,
                  at: new Date().toISOString(),
                  source: "match",
                },
              ],
              season: {} as any,
              unlocked: [],
            },
            "match:mobile-test",
          ),
        );
      });
      await expect(page.locator("#rotate-gate")).toBeHidden();
      const card = await box(page, ".action-overlay");
      for (const id of ["rematch", "share-result", "return"]) {
        const button = await box(page, `#${id}`);
        expect(inside(button, card)).toBe(true);
        expect(button.y).toBeGreaterThanOrEqual(0);
        expect(button.y + button.height).toBeLessThanOrEqual(size.height);
      }
      const scroller = page.locator(".panel-scroll");
      const canScroll = await scroller.evaluate(
        (e) => e.scrollHeight > e.clientHeight,
      );
      if (size.height < 400) expect(canScroll).toBe(true);
      if (canScroll) {
        // Dispatch a native finger swipe, so touch-action on all ancestors matters.
        const client = await context.newCDPSession(page);
        const region = await box(page, ".panel-scroll");
        const x = region.x + region.width / 2,
          y = region.y + region.height - 8;
        await client.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x, y }],
        });
        for (let step = 1; step <= 12; step++) {
          await client.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x, y: y - ((region.height - 20) * step) / 12 }],
          });
          await page.waitForTimeout(16);
        }
        await client.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
        await expect
          .poll(() => scroller.evaluate((e) => e.scrollTop))
          .toBeGreaterThan(20);
      }
      expect(
        inside(await box(page, "#return"), await box(page, ".action-overlay")),
      ).toBe(true);
      await snap(page, info, `mobile-victory-${size.width}x${size.height}`);
      // The level bar (a third full): a flat gold fill on an ink track
      // (themes/poster/results-level.css; a teal gradient on navy before).
      // Chromium paints a progress bar through its own parts, which
      // computed styles don't show, so read its pixels.
      const bar = page.locator(".journey-level progress");
      await bar.scrollIntoViewIfNeeded();
      const sample = async () => {
        const png = await bar.screenshot();
        return page.evaluate(async (data) => {
          const img = new Image();
          img.src = `data:image/png;base64,${data}`;
          await img.decode();
          const cv = document.createElement("canvas");
          cv.width = img.width;
          cv.height = img.height;
          const ctx = cv.getContext("2d")!;
          ctx.drawImage(img, 0, 0);
          const at = (fx: number) =>
            Array.from(
              ctx
                .getImageData(
                  Math.round(img.width * fx),
                  Math.floor(img.height / 2),
                  1,
                  1,
                )
                .data.slice(0, 3),
            ).join(",");
          return { fill: at(0.08), track: at(0.92) };
        }, png.toString("base64"));
      };
      await expect.poll(sample).toEqual({
        fill: "255,214,91",
        track: "42,42,48",
      });
      // Back to menu leaves the room: red, like every leave button (by its
      // hue: the old look's pink and Poster's red both are).
      expect(
        await page.locator("#return").evaluate((el) => {
          const cx = document.createElement("canvas").getContext("2d")!;
          cx.fillStyle = getComputedStyle(el).color;
          cx.fillRect(0, 0, 1, 1);
          const [r, g, b] = cx.getImageData(0, 0, 1, 1).data;
          return r >= 180 && r - g >= 80 && r - b >= 60;
        }),
        "Back to menu is red",
      ).toBe(true);
      await page.locator("#return").tap();
      await expect(page.locator("#lobby-play")).toBeVisible();
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
