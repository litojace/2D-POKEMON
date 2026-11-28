import { expect, test } from "@playwright/test";
import {
  createRoom,
  openHub,
  openPlayPanel,
  pushUntilBattle,
  skipTour,
  snap,
} from "./helpers";
import { playersLook } from "./players-look";

// A raid's results say whether the clear was saved, on an ink strip. The
// words are cream in every state: on a win sheet "Saving your rewards…"
// was ink on that ink (the sheet's ink for its notes), and saved or failed
// was a whole sentence in green or pink (the colour standard: a state
// colours an edge or a sign, never a sentence).
const CREAM = "rgb(244, 234, 213)";

test("a raid's save line reads in cream, its state on the edge", async ({
  browser,
}, info) => {
  test.setTimeout(180_000);
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    await playersLook(context);
    const page = await context.newPage();
    await skipTour(page);
    const errors = await openHub(page);
    await page.evaluate(() =>
      (window as any).__room("raid", { boss: "gloomshade" }),
    );
    await openPlayPanel(page);
    await createRoom(page);
    await pushUntilBattle(page);
    const look = async (status: string) => {
      await page.evaluate((status) => {
        const w = window as any;
        w.__snap.phase = "finished";
        w.__snap.raid.result = "victory";
        w.__snap.raid.rewardStatus = status;
        w.__push();
      }, status);
      const line = page.locator(".rc-card.is-results .rc-save");
      await expect(line).toBeVisible();
      await line.evaluate((e) => e.scrollIntoView({ block: "end" }));
      await snap(page, info, `raid-save-line-${status}`);
      return line.evaluate((e) => {
        const c = getComputedStyle(e);
        const sign = getComputedStyle(e, "::before");
        return {
          words: c.color,
          strip: c.backgroundColor,
          edge: c.borderLeftColor,
          sign: sign.content === "none" ? "" : sign.backgroundColor,
        };
      });
    };
    const saving = await look("pending");
    expect(saving.words).toBe(CREAM);
    expect(saving.strip).not.toBe(saving.words);
    const saved = await look("saved");
    expect(saved.words).toBe(CREAM);
    expect(saved.edge).toBe("rgb(62, 224, 122)");
    const failed = await look("unavailable");
    expect(failed.words).toBe(CREAM);
    expect(failed.edge).toBe("rgb(255, 46, 77)");
    expect(failed.sign).toBe("rgb(255, 46, 77)");
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
