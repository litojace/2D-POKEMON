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
    add("leaves", document.querySelector("#account-leaves > *"));
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

// Small phones in landscape, with and without a notch: no box runs into
// another, each rail button counts on its own (the rail's buttons ran out
// of their column over the emote tile on 320–360 px tall screens), and the
// scene switch keeps 8 px from the player card and the pills (it sat over
// the coins at 640–812 px wide). On a wide screen it stays in the middle.
const SMALL = [
  { width: 568, height: 320, inset: null },
  { width: 640, height: 360, inset: null },
  { width: 667, height: 375, inset: null },
  {
    width: 740,
    height: 360,
    inset: { left: 32, right: 32, bottom: 0, top: 0 },
  },
  {
    width: 812,
    height: 375,
    inset: { left: 44, right: 44, bottom: 21, top: 0 },
  },
  {
    width: 844,
    height: 390,
    inset: { left: 47, right: 47, bottom: 21, top: 0 },
  },
  {
    width: 852,
    height: 393,
    inset: { left: 59, right: 59, bottom: 21, top: 0 },
  },
];
for (const size of SMALL)
  test(`nothing overlaps on a ${size.width}x${size.height} phone${size.inset ? " with a notch" : ""}`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: true,
      hasTouch: true,
    });
    try {
      const page = await context.newPage();
      const errors = await openLobby(page);
      if (size.inset)
        await page.evaluate((inset) => {
          for (const [key, value] of Object.entries(inset))
            document.documentElement.style.setProperty(
              `--safe-${key}`,
              `${value}px`,
            );
        }, size.inset);
      // The switch is placed on the next frame (scene-switch-place.ts);
      // this machine draws one every second or two.
      await expect
        .poll(
          async () => {
            const b = await boxes(page);
            const by = (n: string) => b.find((x) => x.name === n)!;
            const s = by("scenes"),
              p = by("profile"),
              c = by("coins");
            return Math.min(s.x - (p.x + p.w), c.x - (s.x + s.w));
          },
          { timeout: 15_000 },
        )
        .toBeGreaterThanOrEqual(8);
      const all = (await boxes(page)).filter((b) => b.name !== "rail");
      const rail = await page.evaluate(() =>
        Array.from(document.querySelectorAll(".lobby-rail button")).map(
          (e, i) => {
            const r = e.getBoundingClientRect();
            return {
              name: `rail${i}`,
              x: r.left,
              y: r.top,
              w: r.width,
              h: r.height,
            };
          },
        ),
      );
      const everything = [...all, ...rail];
      const clashes = everything.flatMap((a, i) =>
        everything
          .slice(i + 1)
          .filter((b) => overlap(a, b))
          .map((b) => `${a.name} × ${b.name}`),
      );
      expect(clashes).toEqual([]);
      for (const b of everything) {
        expect(b.x, `${b.name} on screen`).toBeGreaterThanOrEqual(
          size.inset?.left ?? 0,
        );
        expect(b.x + b.w, `${b.name} on screen`).toBeLessThanOrEqual(
          size.width - (size.inset?.right ?? 0),
        );
        expect(b.y + b.h, `${b.name} on screen`).toBeLessThanOrEqual(
          size.height - (size.inset?.bottom ?? 0),
        );
      }
      // Rail buttons stay big enough to tap.
      for (const b of rail) expect(b.h, b.name).toBeGreaterThanOrEqual(28);
      // The switch: 8 px from the card and from the pills.
      const by = (n: string) => everything.find((b) => b.name === n)!;
      const scenes = by("scenes"),
        profile = by("profile"),
        coins = by("coins");
      expect(scenes.x - (profile.x + profile.w)).toBeGreaterThanOrEqual(8);
      expect(coins.x - (scenes.x + scenes.w)).toBeGreaterThanOrEqual(8);
      // Every tab's label fits its tab.
      expect(
        await page.evaluate(() =>
          Array.from(document.querySelectorAll("#hub-scenes button"))
            .filter((b) => b.scrollWidth > b.clientWidth + 1)
            .map((b) => b.textContent),
        ),
      ).toEqual([]);
      await snap(page, info, `lobby-small-${size.width}x${size.height}`);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

test("the scene switch stays in the middle of a wide screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openLobby(page);
  await page.waitForTimeout(300);
  const box = (await page.locator("#hub-scenes").boundingBox())!;
  expect(Math.abs(box.x + box.width / 2 - 720)).toBeLessThanOrEqual(1);
});
