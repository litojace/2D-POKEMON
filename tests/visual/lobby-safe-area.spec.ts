import { expect, test, type Page } from "@playwright/test";
import { openLobby, snap } from "./helpers";

type Box = { name: string; x: number; y: number; w: number; h: number };
/** The Lobby's boxes, as in lobby.spec.ts. */
async function boxes(page: Page) {
  return page.evaluate(() => {
    const out: Box[] = [];
    const add = (name: string, el: Element | null) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (
        !r.width ||
        !r.height ||
        style.display === "none" ||
        style.visibility === "hidden"
      )
        return;
      out.push({ name, x: r.left, y: r.top, w: r.width, h: r.height });
    };
    add("profile", document.querySelector("#account-profile"));
    add("scenes", document.querySelector("#hub-scenes"));
    add("coins", document.querySelector("#account-coins > *"));
    add("menu", document.querySelector(".header-menu > summary"));
    add("rail", document.querySelector(".lobby-rail"));
    add("party", document.querySelector(".lobby-party"));
    add("nameplate", document.querySelector(".lobby-nameplate"));
    document
      .querySelectorAll(".lobby-card")
      .forEach((c, i) => add(`card${i}`, c));
    add("play", document.querySelector(".lobby-play"));
    add("emotes", document.querySelector(".lobby-emotes"));
    return out;
  });
}
const overlap = (a: Box, b: Box) =>
  a.x < b.x + b.w - 1 &&
  b.x < a.x + a.w - 1 &&
  a.y < b.y + b.h - 1 &&
  b.y < a.y + a.h - 1;

// Phones with a notch or Dynamic Island: in landscape the cut-out sits on
// the left or right, and the home indicator along the bottom. The game reads
// the insets into --safe-*; here they are set by hand as on an iPhone 15 Pro
// (852x393) and Pro Max (932x430): 59 px each side, 21 px at the bottom.
for (const viewport of [
  { width: 852, height: 393 },
  { width: 932, height: 430 },
]) {
  test(`the Lobby keeps clear of the Dynamic Island and the home indicator at ${viewport.width}x${viewport.height}`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport,
      isMobile: true,
      hasTouch: true,
    });
    try {
      const page = await context.newPage();
      const errors = await openLobby(page);
      const inset = { left: 59, right: 59, bottom: 21, top: 0 };
      await page.evaluate((inset) => {
        for (const [key, value] of Object.entries(inset))
          document.documentElement.style.setProperty(
            `--safe-${key}`,
            `${value}px`,
          );
      }, inset);
      // Let the layout settle after the insets change.
      await page.waitForTimeout(100);
      await snap(
        page,
        info,
        `lobby-safe-area-${viewport.width}x${viewport.height}`,
      );
      const all = await boxes(page);
      for (const b of all) {
        expect(b.x, `${b.name} clears the left inset`).toBeGreaterThanOrEqual(
          inset.left,
        );
        expect(
          b.x + b.w,
          `${b.name} clears the right inset`,
        ).toBeLessThanOrEqual(viewport.width - inset.right);
        expect(
          b.y + b.h,
          `${b.name} clears the home indicator`,
        ).toBeLessThanOrEqual(viewport.height - inset.bottom);
      }
      const clashes = all.flatMap((a, i) =>
        all
          .slice(i + 1)
          .filter((b) => overlap(a, b))
          .map((b) => `${a.name} × ${b.name}`),
      );
      expect(clashes).toEqual([]);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
