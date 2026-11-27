import { expect, test } from "@playwright/test";
import {
  createRoom,
  openHub,
  openPlayPanel,
  pushUntilBattle,
  snap,
} from "./helpers";
import { onPlayersLook } from "./players-look";

// In the look players have (players-look.ts).
onPlayersLook();

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

// Over the whole-screen briefing and results the chat buttons read on the
// card and sit on top of it: on a desktop the sheet used to cover them
// (#battle is no stacking context there, as it is on a phone). The old look
// draws the room banner's bare gold icon, no disc (match-sheet.css; owner,
// 24 Nov 2026); on Poster's element-colour sheet a gold icon vanished, so
// Poster draws it on an ink square (themes/poster/screens.css). Either way
// the icon stands at 3:1 against what is behind it (WCAG's for graphics),
// with no outline.
for (const device of [
  { name: "phone", width: 667, height: 375, touch: true },
  { name: "desktop", width: 1280, height: 720, touch: false },
])
  test(`the chat buttons over the raid cards read on the card, on top (${device.name})`, async ({
    browser,
  }, info) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({
      viewport: { width: device.width, height: device.height },
      isMobile: device.touch,
      hasTouch: device.touch,
    });
    try {
      const page = await context.newPage();
      const errors = await openHub(page);
      await page.evaluate(() =>
        (window as any).__room("raid", { boss: "tidewyrm" }),
      );
      await page.evaluate(() => ((window as any).__snap.raid.partySize = 2));
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
        await expect(page.locator(".rc-card")).toBeVisible();
        await expect(page.locator(button)).toBeVisible();
        await expect
          .poll(() =>
            page.evaluate((sel) => {
              const b = document.querySelector(sel) as HTMLElement;
              const r = b.getBoundingClientRect();
              const top = document.elementFromPoint(
                r.x + r.width / 2,
                r.y + r.height / 2,
              );
              // Colours through a canvas (Poster's compute as oklch()).
              const rgba = (c: string) => {
                const cx = document.createElement("canvas").getContext("2d")!;
                cx.fillStyle = c;
                cx.fillRect(0, 0, 1, 1);
                return [...cx.getImageData(0, 0, 1, 1).data];
              };
              const lum = ([r, g, bl]: number[]) =>
                [r, g, bl]
                  .map((v) => {
                    const x = v / 255;
                    return x <= 0.03928
                      ? x / 12.92
                      : ((x + 0.055) / 1.055) ** 2.4;
                  })
                  .reduce((n, v, i) => n + v * [0.2126, 0.7152, 0.0722][i], 0);
              // The icon against what is behind it: the button's own fill
              // where it has one (Poster's ink square), the sheet's
              // otherwise (the old look's bare icon).
              const own = rgba(getComputedStyle(b).backgroundColor);
              const card = document.querySelector("#arena-overlay > .rc-card");
              const back =
                own[3] === 255
                  ? own
                  : rgba(
                      card ? getComputedStyle(card).backgroundColor : "#000",
                    );
              const icon = rgba(
                getComputedStyle(b.querySelector("svg") ?? b).color,
              );
              const [hi, lo] = [lum(icon), lum(back)].sort((x, y) => y - x);
              return {
                onTop: !!top && b.contains(top),
                border: getComputedStyle(b).borderTopColor,
                iconContrast: (hi + 0.05) / (lo + 0.05) >= 3,
              };
            }, button),
          )
          .toMatchObject({
            onTop: true,
            border: "rgba(0, 0, 0, 0)",
            iconContrast: true,
          });
        await snap(page, info, `raid-card-chat-icon-${device.name}-${phase}`);
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
