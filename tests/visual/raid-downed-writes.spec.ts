import { expect, test } from "@playwright/test";
import { createRoom, openHub, openPlayPanel, pushUntilBattle } from "./helpers";

/**
 * Down in a raid, the revive card and the touch buttons are written once,
 * not at every snapshot (30 a second).
 *
 * Until 25 Nov 2026 the card was rebuilt each time: its markup was compared
 * with `innerHTML`, which reads an icon's `<path/>` back as `<path></path>`
 * and so never matched. And main.ts switched every touch button off again
 * after `touch.update` had switched the ready ones on. Both restyled a
 * dozen elements a snapshot for as long as the player lay there, on the
 * phones that were already struggling (docs/network-performance.md,
 * section 20).
 */
test("a downed raider's card and buttons are written once", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    const errors = await openHub(page);
    await page.evaluate(() =>
      (window as any).__room("raid", { boss: "tidewyrm" }),
    );
    await openPlayPanel(page);
    await createRoom(page);
    await pushUntilBattle(page);
    const down = (progress: number) =>
      page.evaluate((progress) => {
        const w = window as any;
        const s = w.__snap;
        s.phase = "playing";
        const me = s.players.find((p: any) => p.id === "me");
        me.hp = 0;
        s.raid.downed[me.id] = { progress, self: false };
        w.__push();
      }, progress);
    await down(0.42);
    const banner = page.locator("#spectate");
    await expect(banner).toBeVisible();
    await expect(banner.locator(".raid-revive-head span")).toHaveText("42%");
    const buttons = page.locator(".touch-buttons button");
    expect(await buttons.count()).toBeGreaterThan(4);
    // Every button is off; the stick still crawls toward an ally.
    await expect(page.locator(".touch-buttons button:enabled")).toHaveCount(0);
    // Thirty more snapshots of the same moment: nothing is written.
    const written = await page.evaluate(async () => {
      const w = window as any;
      const card: string[] = [];
      let disabled = 0;
      const note = (list: MutationRecord[]) =>
        card.push(...list.map((m) => `${m.type} ${m.attributeName ?? ""}`));
      const cardWatch = new MutationObserver(note);
      cardWatch.observe(document.getElementById("spectate")!, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
      });
      const buttonWatch = new MutationObserver(
        (list) => (disabled += list.length),
      );
      buttonWatch.observe(document.querySelector(".touch-buttons")!, {
        subtree: true,
        attributes: true,
        attributeFilter: ["disabled"],
      });
      for (let i = 0; i < 30; i++) {
        w.__push();
        await new Promise((r) => setTimeout(r, 16));
      }
      note(cardWatch.takeRecords());
      disabled += buttonWatch.takeRecords().length;
      cardWatch.disconnect();
      buttonWatch.disconnect();
      return { card, disabled };
    });
    expect(written).toEqual({ card: [], disabled: 0 });
    // A revive that moves on is shown.
    await down(0.6);
    await expect(banner.locator(".raid-revive-head span")).toHaveText("60%");
    // Back on their feet: the card goes and the ready buttons come back.
    await page.evaluate(() => {
      const w = window as any;
      const s = w.__snap;
      s.players.find((p: any) => p.id === "me").hp = 50;
      delete s.raid.downed.me;
      w.__push();
    });
    await expect(banner).toBeHidden();
    await expect(
      page.locator('.touch-buttons button[data-action="attack"]'),
    ).toBeEnabled();
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
