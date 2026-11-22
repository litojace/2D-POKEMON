import { expect, test } from "@playwright/test";
import {
  createRoom,
  openHub,
  openPlayPanel,
  pushUntilBattle,
  skipTour,
  snap,
} from "./helpers";

// The fighters' nameplates in a battle (main.ts, player-nameplate.ts).
test("a round starts every bar full, even when this app's health table is out of date; plates sit under the touch buttons", async ({
  browser,
}, info) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await skipTour(page);
    const errors = await openHub(page);
    await page.evaluate(() =>
      (window as any).__room("pvp", { mode: "duel", phase: "playing" }),
    );
    await openPlayPanel(page);
    await createRoom(page);
    await pushUntilBattle(page);
    // The server's Voltkit has 120 health; this app's table says otherwise
    // (the owner's phone, 22 Nov 2026: an old app had 157, the server 135,
    // and the bar began each round at 86%).
    await page.evaluate(() => {
      const w = window as any;
      w.__snap.phase = "countdown";
      w.__snap.remaining = 2;
      for (const p of w.__snap.players) if (p.id === "me") p.hp = 120;
      w.__push();
    });
    const mine = page.locator(
      '.battle-nameplate[data-fighter="me"] .fighter-health',
    );
    await expect(mine).toHaveAttribute("aria-valuemax", "120");
    await expect(mine).toHaveAttribute("aria-valuenow", "120");
    await expect(mine.locator("i")).toHaveAttribute("style", /scaleX\(1\)/);
    // In the fight, the bar reads against that full health.
    await page.evaluate(() => {
      const w = window as any;
      w.__snap.phase = "playing";
      for (const p of w.__snap.players) if (p.id === "me") p.hp = 60;
      w.__push();
    });
    await expect(mine.locator("i")).toHaveAttribute("style", /scaleX\(0\.5\)/);
    await snap(page, info, "nameplate-health");

    // A fighter behind the skill buttons: its name and bar go under them.
    const layers = await page.evaluate(() => {
      const plate = document.querySelector<HTMLElement>(".battle-nameplate")!;
      const pad = document.querySelector<HTMLElement>(".touch-pad")!;
      // Both are positioned inside #battle's stacking context.
      const z = (e: HTMLElement) => Number(getComputedStyle(e).zIndex);
      return { plate: z(plate), pad: z(pad) };
    });
    expect(layers.plate).toBeLessThan(layers.pad);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
