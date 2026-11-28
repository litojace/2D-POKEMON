import { expect, test, type Page } from "@playwright/test";
import { openHub, skipTour, snap } from "./helpers";
import { ISLAND, setInsets } from "./ui-measure";
import { onPlayersLook } from "./players-look";

// In the look players have (players-look.ts).
onPlayersLook();

// Short dialogs are as wide as what they hold (themes/poster/dialogs.css,
// audit W01–W04, owner 27 Nov: "Invite a friend" spanned a phone held
// sideways for two lines and a button). A dialog's content names its size
// (data-dialog-size, dialog.ts): "s" up to 440 px, "m" up to 560 px; the
// rest (Settings here) keep their width. Behind any dialog the dim is flat:
// no blur.
const SIZES = [
  { width: 667, height: 375, phone: true, island: false },
  { width: 844, height: 390, phone: true, island: false },
  { width: 852, height: 393, phone: true, island: true },
  { width: 1440, height: 900, phone: false, island: false },
];
const label = (s: (typeof SIZES)[number]) =>
  `${s.width}x${s.height}${s.island ? "-island" : ""}`;

async function measure(page: Page) {
  await page.waitForTimeout(400);
  return page.evaluate(() => {
    const d = document.querySelector<HTMLDialogElement>("dialog[open]")!;
    const r = d.getBoundingClientRect();
    const content = d.querySelector<HTMLElement>(".dialog-content")!;
    return {
      size: d.dataset.size ?? "",
      left: r.left,
      right: r.right,
      top: r.top,
      bottom: r.bottom,
      width: r.width,
      // Nothing inside runs out sideways.
      sideways: content.scrollWidth - content.clientWidth,
      backdrop: getComputedStyle(d, "::backdrop").backdropFilter,
    };
  });
}
const menu = async (page: Page, id: string) => {
  await page.locator("#header-menu > summary").click();
  await page.locator(`#${id}`).click();
};
const close = async (page: Page) => {
  await page.locator("dialog[open] #close-dialog").click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
};

for (const size of SIZES)
  test(`short dialogs fit what they hold at ${label(size)}`, async ({
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
      await skipTour(page);
      await openHub(page);
      if (size.island) await setInsets(page, ISLAND);
      const onScreen = (m: Awaited<ReturnType<typeof measure>>) => {
        expect(m.left).toBeGreaterThanOrEqual(size.island ? ISLAND.left : 0);
        expect(m.right).toBeLessThanOrEqual(
          size.width - (size.island ? ISLAND.right : 0),
        );
        expect(m.top).toBeGreaterThanOrEqual(0);
        expect(m.bottom).toBeLessThanOrEqual(size.height);
        expect(m.sideways).toBeLessThanOrEqual(1);
        expect(m.backdrop).toBe("none");
      };

      // Invite a friend: a few lines and one button.
      await page.locator('[data-lobby-action="invite"]').first().click();
      let m = await measure(page);
      expect(m.size).toBe("s");
      expect(m.width).toBeLessThanOrEqual(440);
      onScreen(m);
      await snap(page, info, `dialog-invite-${label(size)}`);
      await close(page);

      // Want fullscreen?
      await menu(page, "install-app");
      m = await measure(page);
      expect(m.size).toBe("s");
      expect(m.width).toBeLessThanOrEqual(440);
      onScreen(m);
      await snap(page, info, `dialog-fullscreen-${label(size)}`);
      await close(page);

      // Settings keeps its width; its Credits page is a medium dialog.
      await menu(page, "settings");
      m = await measure(page);
      expect(m.size).toBe("");
      if (size.phone) expect(m.width).toBeGreaterThan(560);
      onScreen(m);
      await page.locator("#settings-credits").click();
      m = await measure(page);
      expect(m.size).toBe("m");
      expect(m.width).toBeLessThanOrEqual(560);
      onScreen(m);
      await snap(page, info, `dialog-credits-${label(size)}`);
    } finally {
      await context.close();
    }
  });
