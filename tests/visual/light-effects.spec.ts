import { expect, test, type Page } from "@playwright/test";
import { openLobby } from "./helpers";

// Lighter menus on weak devices (ui/light-effects.css): at Low graphics the
// hub has no backdrop blur and no decorative loops; with reduced motion the
// loops stop; at High the look stays.
const PHONE = { width: 844, height: 390 };

/** What still blurs, and which endless animations run, outside a battle. */
const effects = (page: Page) =>
  page.evaluate(() => {
    const name = (e: Element) =>
      `${e.tagName.toLowerCase()}${e.id ? "#" + e.id : ""}${e.classList.length ? "." + [...e.classList].slice(0, 2).join(".") : ""}`;
    const blurred = new Set<string>();
    for (const e of Array.from(document.querySelectorAll("body *"))) {
      if (e.closest("#battle")) continue;
      for (const pseudo of [null, "::before", "::after"]) {
        const s = getComputedStyle(e, pseudo);
        const f = s.backdropFilter || (s as any).webkitBackdropFilter;
        if (f && f !== "none") blurred.add(name(e) + (pseudo ?? ""));
      }
    }
    const loops = document
      .getAnimations()
      .filter(
        (a) =>
          a.playState === "running" &&
          a.effect?.getTiming().iterations === Infinity,
      )
      .map((a) => {
        const effect = a.effect as KeyframeEffect;
        const t = effect.target;
        return t
          ? name(t) +
              (effect.pseudoElement ?? "") +
              " " +
              (a as CSSAnimation).animationName
          : "?";
      });
    return { blurred: [...blurred], loops: [...new Set(loops)] };
  });

async function phone(
  browser: import("@playwright/test").Browser,
  graphics: "low" | "high",
  reducedMotion: "reduce" | "no-preference" = "no-preference",
) {
  const context = await browser.newContext({
    viewport: PHONE,
    isMobile: true,
    hasTouch: true,
    reducedMotion,
  });
  const page = await context.newPage();
  await page.addInitScript(
    (g) => localStorage.setItem("ea-graphics", g),
    graphics,
  );
  const errors = await openLobby(page);
  return { context, page, errors };
}

test("Low graphics: the hub has no blur and no decorative loops", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const { context, page, errors } = await phone(browser, "low");
  try {
    await expect(page.locator("html")).toHaveAttribute(
      "data-ui-effects",
      "light",
    );
    await page.waitForTimeout(800);
    expect(await effects(page), "the Lobby").toEqual({
      blurred: [],
      loops: [],
    });
    // A panel with cosmetic pictures (rarity sheens and frame ornaments).
    await page.click('.lobby-rail [data-lobby-action="shop"]');
    await expect(page.locator("[data-fit-slot]").first()).toBeVisible();
    await page.click('[data-fit-slot="frame"]');
    await page.waitForTimeout(800);
    expect(await effects(page), "the Wardrobe").toEqual({
      blurred: [],
      loops: [],
    });
    await page.keyboard.press("Escape");
    await page.evaluate(() => localStorage.setItem("ea-plaza-help", "1"));
    await page.click('#hub-scenes [data-hub-scene="plaza"]');
    await expect(page.locator(".plaza-layer #pz-cv")).toBeVisible();
    await page.waitForTimeout(800);
    expect((await effects(page)).blurred, "the Plaza").toEqual([]);
    // Choosing High in Settings brings the look back at once.
    await page.evaluate(() => document.getElementById("settings")!.click());
    await page.click('#dialog [data-graphics="high"]');
    await expect(page.locator("html")).toHaveAttribute(
      "data-ui-effects",
      "full",
    );
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("High graphics keeps the glass and PLAY's glow; reduced motion stops the loops", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  {
    const { context, page, errors } = await phone(browser, "high");
    try {
      await expect(page.locator("html")).toHaveAttribute(
        "data-ui-effects",
        "full",
      );
      await page.waitForTimeout(800);
      const e = await effects(page);
      expect(e.blurred).toContain("nav#hub-scenes.hub-scenes");
      expect(e.loops.some((l) => l.includes("lobby-play-glow"))).toBe(true);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  }
  {
    const { context, page, errors } = await phone(browser, "high", "reduce");
    try {
      await page.waitForTimeout(800);
      const e = await effects(page);
      expect(e.blurred).toContain("nav#hub-scenes.hub-scenes");
      expect(e.loops).toEqual([]);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  }
});
