import { expect, test } from "@playwright/test";
import {
  createRoom,
  openHub,
  openPlayPanel,
  pushUntilBattle,
  snap,
} from "./helpers";

// On a phone, a chat button sits in the screen's top-left corner while the
// raid's cards are up: the battle's quick chat over the briefing, the room's
// chat over the results. Both cards used to start under it (the title and
// the first step hidden); now they start to its right (raid-cards.css,
// chat-corner in main.ts), with or without a notch on that side. Since the
// cards take the whole screen (match-sheet.css, 22 Nov 2026), their
// content (the steps or the scoreboard, and the foot) keeps that column.
for (const phone of [
  { name: "plain", insets: null },
  { name: "island", insets: { left: 59, right: 16, bottom: 21, top: 0 } },
])
  test(`the raid cards keep clear of the chat button (${phone.name})`, async ({
    browser,
  }, info) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({
      viewport: { width: 852, height: 393 },
      isMobile: true,
      hasTouch: true,
    });
    try {
      const page = await context.newPage();
      if (phone.insets)
        await page.addInitScript((insets) => {
          const set = () => {
            for (const [k, v] of Object.entries(insets))
              document.documentElement.style.setProperty(
                `--safe-${k}`,
                `${v}px`,
              );
          };
          if (document.documentElement) set();
          document.addEventListener("DOMContentLoaded", set);
        }, phone.insets);
      const errors = await openHub(page);
      await page.evaluate(() =>
        (window as any).__room("raid", { boss: "tidewyrm" }),
      );
      await openPlayPanel(page);
      await createRoom(page);
      await pushUntilBattle(page);
      for (const [phase, button] of [
        ["briefing", "#battle-chat"],
        ["finished", "#chat-button"],
      ]) {
        await page.evaluate((phase) => {
          const w = window as any;
          w.__snap.phase = phase;
          w.__push();
        }, phase);
        const card = page.locator(".rc-card");
        await expect(card).toBeVisible();
        await expect(page.locator(button)).toBeVisible();
        await expect
          .poll(async () => {
            const b = (await page.locator(button).boundingBox())!;
            const left = Math.min(
              ...(await Promise.all(
                [".rc-body", ".rc-foot"].map(
                  async (q) => (await card.locator(q).boundingBox())!.x,
                ),
              )),
            );
            return left - (b.x + b.width);
          })
          .toBeGreaterThanOrEqual(4);
        // The whole screen; the content still wide, inside it.
        const c = (await card.boundingBox())!;
        expect([c.x, c.width]).toEqual([0, 852]);
        const body = (await card.locator(".rc-body").boundingBox())!;
        expect(body.width).toBeGreaterThan(600);
        expect(body.x + body.width).toBeLessThanOrEqual(852);
        await snap(page, info, `raid-card-chat-${phone.name}-${phase}`);
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
