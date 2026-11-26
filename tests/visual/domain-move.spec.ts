import { expect, test } from "@playwright/test";
import { centred } from "./ui-checks";
import { fileURLToPath } from "node:url";
import { openHub, snap } from "./helpers";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

// On the game's old address a dialog offers the new one (domain-move.ts,
// announcements.ts): the whole message readable, Later and Open side by
// side, inside the screen and clear of the notch, buttons 44 px. It was a
// banner, but on a phone in landscape the banner covered the top bar and
// the sign-in card's tabs. Phones only (owner, 25 Nov: mobile first). The
// harness runs on localhost, so the test shows the same notice main.ts
// shows on parena.litojace.com.
const VIEWS = [
  { width: 667, height: 375, inset: null },
  { width: 844, height: 390, inset: null },
  { width: 852, height: 393, inset: { left: 59, right: 59, bottom: 21 } },
];
const SITE = "https://play.elementarenausa.com";

for (const view of VIEWS) {
  test(`the move notice at ${view.width}x${view.height}`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: { width: view.width, height: view.height },
      isMobile: true,
      hasTouch: true,
    });
    try {
      const page = await context.newPage();
      await openHub(page);
      if (view.inset)
        await page.evaluate((inset) => {
          for (const [key, value] of Object.entries(inset))
            document.documentElement.style.setProperty(
              `--safe-${key}`,
              `${value}px`,
            );
        }, view.inset);
      await page.evaluate(
        async ({ root, site }) => {
          const src = `/@fs${root}apps/client/src`;
          const { AnnouncementBanner } = await import(
            `${src}/announcements.ts`
          );
          const { moveLink, moveNotice } = await import(
            `${src}/domain-move.ts`
          );
          (window as any).__notices = new AnnouncementBanner();
          (window as any).__notices.notice(moveNotice(site), moveLink(site));
        },
        { root: ROOT, site: SITE },
      );
      const dialog = page.locator("[data-announcement-dialog] [role=dialog]");
      await expect(dialog).toBeVisible();
      // No banner as well: the dialog is the only copy.
      await expect(page.locator(".announcement-banner")).toHaveCount(0);
      await expect(dialog.locator(".ui-title")).toHaveText(
        "Element Arena has moved",
      );
      const text = dialog.locator(".ui-note");
      await expect(text).toContainText("play.elementarenausa.com");
      // The message reads in full: the dialog (which clips) holds all of
      // it, and no line runs out sideways. (The title's own box is a pixel
      // short of its glyphs at line-height 1; nothing clips it.)
      const clipped = await dialog.evaluate(
        (d) =>
          d.scrollHeight > d.clientHeight + 1 ||
          [...d.querySelectorAll<HTMLElement>(".ui-note, .ui-title")].some(
            (e) => e.scrollWidth > e.clientWidth + 1,
          ) ||
          (() => {
            const note = d.querySelector<HTMLElement>(".ui-note")!;
            return note.scrollHeight > note.clientHeight + 1;
          })(),
      );
      expect(clipped, "message cut short").toBe(false);
      // Inside the screen, clear of the notch and the home indicator.
      const d = (await dialog.boundingBox())!;
      const left = view.inset?.left ?? 0,
        right = view.inset?.right ?? 0,
        bottom = view.inset?.bottom ?? 0;
      expect(d.x).toBeGreaterThanOrEqual(left);
      expect(d.x + d.width).toBeLessThanOrEqual(view.width - right);
      expect(d.y).toBeGreaterThanOrEqual(0);
      expect(d.y + d.height).toBeLessThanOrEqual(view.height - bottom);
      const later = dialog.locator("[data-announcement-later]");
      const go = dialog.locator("[data-announcement-go]");
      await expect(later).toHaveText("Later");
      await expect(go).toHaveText("Open");
      await expect(go).toHaveAttribute("href", `${SITE}/`);
      const l = (await later.boundingBox())!,
        g = (await go.boundingBox())!;
      // A finger is 44 px: phones draw the button 36 px tall and catch
      // taps 44 px tall (components.css, .ui-btn::after). Tap-test it.
      for (const sel of [
        "[data-announcement-later]",
        "[data-announcement-go]",
      ]) {
        const reach = await page.evaluate((sel) => {
          const el = document.querySelector<HTMLElement>(sel)!;
          const r = el.getBoundingClientRect();
          const x = r.x + r.width / 2,
            y = r.y + r.height / 2;
          const hits = (dy: number) =>
            el.contains(document.elementFromPoint(x, y + dy));
          return { up: hits(-21.5), down: hits(21.5), width: r.width };
        }, sel);
        expect(reach, sel).toEqual({
          up: true,
          down: true,
          width: expect.any(Number),
        });
        expect(reach.width, sel).toBeGreaterThanOrEqual(44);
      }
      // One row, the same height, Open on the right.
      expect(Math.abs(l.y - g.y)).toBeLessThan(1);
      expect(Math.abs(l.height - g.height)).toBeLessThan(1);
      expect(g.x).toBeGreaterThan(l.x);
      await centred(page, "[data-announcement-later]", "Later");
      await centred(page, "[data-announcement-go]", "Open");
      await snap(page, info, `move-notice-${view.width}x${view.height}`);
      // Later closes it, and it stays closed for this notice's id.
      await later.tap();
      await expect(page.locator("[data-announcement-dialog]")).toHaveCount(0);
      await page.evaluate(
        async ({ root, site }) => {
          const src = `/@fs${root}apps/client/src`;
          const { moveLink, moveNotice } = await import(
            `${src}/domain-move.ts`
          );
          (window as any).__notices.notice(moveNotice(site), moveLink(site));
        },
        { root: ROOT, site: SITE },
      );
      await expect(page.locator("[data-announcement-dialog]")).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
}

test("Escape puts the move notice away, like Later", async ({ page }) => {
  await page.setViewportSize({ width: 667, height: 375 });
  await openHub(page);
  await page.evaluate(
    async ({ root, site }) => {
      const src = `/@fs${root}apps/client/src`;
      const { AnnouncementBanner } = await import(`${src}/announcements.ts`);
      const { moveLink, moveNotice } = await import(`${src}/domain-move.ts`);
      new AnnouncementBanner().notice(moveNotice(site), moveLink(site));
    },
    { root: ROOT, site: SITE },
  );
  await expect(page.locator("[data-announcement-dialog]")).toBeVisible();
  await expect(page.locator("[data-announcement-go]")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-announcement-dialog]")).toHaveCount(0);
  const seen = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("ea-announcements-seen") ?? "[]"),
  );
  expect(seen.length).toBeGreaterThan(0);
});
