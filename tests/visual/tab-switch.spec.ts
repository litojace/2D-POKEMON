import { expect, test, type Page } from "@playwright/test";
import { openHub } from "./helpers";

// Tab switches in hub screens (ui/motion.ts, playTabSwitch, wired once in
// ui/hub-panel.ts for every screen): like big games' menus, the head and the
// tab row stay put, the underline glides from the old tab to the new one,
// and the new contents slide in from the side of the tab you went to.
// Only the compositor's properties move, on a few elements.

const phone = {
  viewport: { width: 844, height: 390 },
  isMobile: true,
  hasTouch: true,
};

/** Click `selector` and, in the same moment, list the motion it started. */
const clickAndLook = (page: Page, selector: string) =>
  page.evaluate((selector) => {
    document.querySelector<HTMLElement>(selector)!.click();
    return document
      .getAnimations()
      .filter(
        (a) =>
          !(a instanceof CSSTransition) &&
          a.effect?.getTiming().iterations !== Infinity &&
          !!((a.effect as KeyframeEffect).target as Element | null)?.closest(
            ".ui-panel",
          ),
      )
      .map((a) => {
        const effect = a.effect as KeyframeEffect;
        const el = effect.target as HTMLElement;
        return {
          pseudo: effect.pseudoElement,
          from: String(effect.getKeyframes()[0].transform),
          tab:
            el.getAttribute("role") === "tab"
              ? el.outerHTML.match(/data-ui-[\w-]+="[^"]*"/)?.[0]
              : undefined,
          inHead:
            !!el.closest(".ui-panel-head, .ui-tabs") &&
            el.getAttribute("role") !== "tab",
          inBody: !!el.closest(".ui-panel-body"),
        };
      });
  }, selector);
const settle = (page: Page) =>
  page.evaluate(() =>
    document.getAnimations().forEach((a) => {
      if (a.effect?.getTiming().iterations !== Infinity) a.finish();
    }),
  );

test("a tab switch glides the underline and slides the new tab in; the head, tab row and art stay", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const context = await browser.newContext(phone);
  try {
    const page = await context.newPage();
    const errors = await openHub(page);
    await page.click('.lobby-rail [data-lobby-action="raids"]');
    const room = page.locator(".ui-panel.rh-room:not([data-ui-leaving])");
    await room.locator('[data-raid-card="storm-twins"]').click();
    await expect(room.locator('[data-ui-raid-tab="party"]')).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await settle(page);
    // Tag the parts that must survive the switch as the same elements.
    await page.evaluate(() => {
      const root = document.querySelector(
        ".ui-panel.rh-room:not([data-ui-leaving])",
      )!;
      for (const s of [
        ".ui-panel-head",
        ".ui-tabs",
        ".rh-stage, .ui-panel > :first-child",
      ])
        (root.querySelector(s) as any).__kept = true;
    });

    // To the right: the line starts left of Attacks, the contents from the right.
    const right = await clickAndLook(page, '[data-ui-raid-tab="attacks"]');
    const ink = right.filter((a) => a.pseudo === "::after");
    expect(ink).toHaveLength(1);
    expect(ink[0].tab).toBe('data-ui-raid-tab="attacks"');
    expect(ink[0].from).toMatch(/^translateX\(-\d/);
    const body = right.filter((a) => a.inBody);
    expect(body.length).toBeGreaterThan(0);
    expect(body.every((a) => a.from === "translateX(18px)")).toBe(true);
    // The head and the tab row don't move.
    expect(right.filter((a) => a.inHead)).toEqual([]);
    expect(
      await page.evaluate(() => {
        const root = document.querySelector(
          ".ui-panel.rh-room:not([data-ui-leaving])",
        )!;
        return [
          ".ui-panel-head",
          ".ui-tabs",
          ".rh-stage, .ui-panel > :first-child",
        ].map((s) => !!(root.querySelector(s) as any).__kept);
      }),
    ).toEqual([true, true, true]);
    await expect(room.locator('[data-ui-raid-tab="attacks"]')).toBeFocused();

    // A second tap mid-glide retargets: one line, from where it is drawn.
    const again = await clickAndLook(page, '[data-ui-raid-tab="party"]');
    expect(again.filter((a) => a.pseudo === "::after")).toHaveLength(1);
    expect(
      again
        .filter((a) => a.inBody)
        .every((a) => a.from === "translateX(-18px)"),
    ).toBe(true);
    await settle(page);
    // Settled: the underline sits under the picked tab, nothing left over.
    const line = await page.evaluate(() => {
      const tab = document.querySelector('[data-ui-raid-tab="party"]')!;
      const after = getComputedStyle(tab, "::after");
      return { transform: after.transform, height: after.height };
    });
    expect(line).toEqual({ transform: "none", height: "3px" });

    // No motion with reduced motion, or on Low graphics; the tab still switches.
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(await clickAndLook(page, '[data-ui-raid-tab="guide"]')).toEqual([]);
    await expect(room.locator('[data-ui-raid-tab="guide"]')).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.evaluate(() => localStorage.setItem("ea-graphics", "low"));
    expect(await clickAndLook(page, '[data-ui-raid-tab="rewards"]')).toEqual(
      [],
    );
    await expect(room.locator('[data-ui-raid-tab="rewards"]')).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("the Spire's Floors tab stays light: portraits are pictures, not inline art", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const context = await browser.newContext(phone);
  try {
    const page = await context.newPage();
    const errors = await openHub(page);
    await page.click('.lobby-rail [data-lobby-action="raids"]');
    const room = page.locator(".ui-panel.rh-room:not([data-ui-leaving])");
    await room.locator("[data-raid-spire]").click();
    await room.locator('[data-ui-spire-tab="floors"]').click();
    await expect(room.locator(".sp-floor").first()).toBeVisible();
    const shown = await page.evaluate(() => {
      const root = document.querySelector(
        ".ui-panel.rh-room:not([data-ui-leaving])",
      )!;
      const pictures = Array.from(
        root.querySelectorAll<HTMLImageElement>(".sp-floor .ui-avatar > img"),
      );
      return {
        elements: root.querySelectorAll("*").length,
        pictures: pictures.length,
        inline: root.querySelectorAll(".sp-floor .ui-avatar > svg").length,
        // Every fighter's portrait is drawn once and shared.
        sources: new Set(pictures.map((p) => p.src)).size,
        fighters: new Set(pictures.map((p) => p.dataset.fighter)).size,
      };
    });
    // It was 43,000 elements (150 inline portraits) and took seconds to open on a phone.
    expect(shown.elements).toBeLessThan(4000);
    expect(shown.pictures).toBeGreaterThan(50);
    expect(shown.inline).toBe(0);
    expect(shown.sources).toBe(shown.fighters);
    // The pictures in view are drawn.
    await expect
      .poll(() =>
        room
          .locator(".sp-floor .ui-avatar > img")
          .first()
          .evaluate(
            (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
          ),
      )
      .toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
