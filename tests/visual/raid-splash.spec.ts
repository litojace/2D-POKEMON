import { test, expect } from "@playwright/test";
import { box, inside, openTown, openTownMenu, snap } from "./helpers";
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 844, height: 390 },
  { width: 844, height: 280 },
  { width: 568, height: 320 },
  { width: 414, height: 896 },
]) {
  test(`boss splash art stays readable and controls work at ${viewport.width}x${viewport.height}`, async ({
    browser,
  }, info) => {
    test.setTimeout(120000);
    const context = await browser.newContext({
      viewport,
      isMobile: viewport.width < 1000 && viewport.width > viewport.height,
      hasTouch: viewport.width < 1000 && viewport.width > viewport.height,
    });
    try {
      const page = await context.newPage();
      const errors = await openTown(page);
      await page.evaluate(() => {
        const fetch = window.fetch.bind(window);
        window.fetch = async (input, init) =>
          String(input).includes("/api/raids")
            ? new Response(
                JSON.stringify({
                  clears: 10,
                  highestPeril: 3,
                  totalClears: 35,
                  bestSeconds: 60,
                  bosses: Object.fromEntries(
                    [
                      "grumblecrag",
                      "tidewyrm",
                      "gloomshade",
                      "somnara",
                      "prismatail",
                      "emberwing",
                      "storm-twins",
                    ].map((id) => [
                      id,
                      { clears: 5, highestPeril: 2, bestSeconds: 90 },
                    ]),
                  ),
                  titles: [],
                  cosmetics: [],
                  weekly: [],
                  earned: [],
                  loadout: {},
                }),
                { headers: { "Content-Type": "application/json" } },
              )
            : fetch(input, init);
      });
      await openTownMenu(page);
      await page.click('[data-action="raids"]');
      // The Hub may open directly on the last selected boss.
      if (await page.locator(".raid-boss-card").count()) {
        await expect(page.locator(".raid-card-art img")).toHaveCount(7);
        await page.click('[data-raid-boss="grumblecrag"]');
      }
      await expect(page.locator(".raid-roster-card")).toHaveCount(7);
      await expect(page.locator(".raid-roster-art img")).toHaveCount(7);
      for (const boss of [
        "grumblecrag",
        "tidewyrm",
        "gloomshade",
        "somnara",
        "prismatail",
        "emberwing",
        "storm-twins",
      ]) {
        if (boss !== "grumblecrag")
          await page.click(`.raid-roster-card[data-raid-boss="${boss}"]`);
        await expect(page.locator("[data-hub-practice]")).toHaveCount(6);
        const art = page.locator(".raid-showcase-splash > img");
        await expect(art).toBeVisible();
        await art.evaluate(async (img: HTMLImageElement) => {
          await img.decode();
        });
        expect(
          await art.evaluate((img: HTMLImageElement) => img.naturalWidth),
        ).toBeGreaterThanOrEqual(1200);
        await page.locator("#dialog").evaluate(async (el) => {
          await document.fonts.ready;
          await Promise.all(
            el
              .getAnimations({ subtree: true })
              .filter(
                (a) => a.effect?.getComputedTiming().iterations !== Infinity,
              )
              .map((a) => a.finished.catch(() => {})),
          );
        });
        await expect(art).toBeVisible();
        const content = await box(page, ".raid-dialog-content");
        for (const tab of ["#raid-tab-overview", "#raid-tab-rewards"]) {
          expect(
            inside(await box(page, tab), await box(page, ".dialog-toolbar")),
          ).toBe(true);
        }
        if (viewport.width > viewport.height) {
          for (const skill of await page.locator("[data-hub-practice]").all()) {
            const rect = await skill.boundingBox();
            expect(
              rect && inside(rect, content),
              `${boss}: skill stays above the footer ${JSON.stringify({ rect, content })}`,
            ).toBe(true);
            expect(rect!.height).toBeGreaterThanOrEqual(44);
          }
        }
        await expect(
          page.locator(`.raid-roster-card[data-raid-boss="${boss}"]`),
        ).toBeInViewport();
        const stage = await box(page, ".raid-showcase-splash");
        expect(inside(stage, { x: 0, y: 0, ...viewport })).toBe(true);
        if (viewport.width < 1000 && viewport.width > viewport.height) {
          const actions = page
            .locator(".raid-hub-actions [data-raid-start]")
            .first();
          if (await actions.isVisible()) {
            const footer = await box(
              page,
              ".raid-hub-actions [data-raid-start]",
            );
            expect(stage.y + stage.height).toBeLessThanOrEqual(footer.y + 1);
          }
        }
        expect(
          await page
            .locator(".raid-boss-showcase")
            .evaluate((el) => el.scrollWidth - el.clientWidth),
        ).toBeLessThanOrEqual(1);
        expect(
          await art.evaluate((img: HTMLImageElement) => {
            if (getComputedStyle(img).objectFit === "contain") return 1;
            const r = img.getBoundingClientRect(),
              scale = Math.max(
                r.width / img.naturalWidth,
                r.height / img.naturalHeight,
              );
            return Math.min(
              r.width / (img.naturalWidth * scale),
              r.height / (img.naturalHeight * scale),
            );
          }),
        ).toBeGreaterThanOrEqual(0.9);
        await expect(page.locator(".splash-caption")).toHaveCount(0);
        if (boss === "grumblecrag" || boss === "storm-twins")
          await snap(
            page,
            info,
            `splash-${boss}-${viewport.width}x${viewport.height}`,
          );
      }
      await page.click('.raid-roster-card[data-raid-boss="grumblecrag"]');
      await expect(page.locator("[data-hub-practice]").first()).toBeEnabled();
      const rail = await box(page, ".raid-boss-roster"),
        actions = await box(page, ".dialog-footer");
      await page.click(".raid-field-guide > summary");
      await expect(page.locator(".raid-hub-chapters > li")).toHaveCount(3);
      await page
        .locator(".raid-dialog-content")
        .evaluate((el) => (el.scrollTop = el.scrollHeight));
      expect(await box(page, ".raid-boss-roster")).toEqual(rail);
      expect(await box(page, ".dialog-footer")).toEqual(actions);
      await page.click('[data-raid-tab="rewards"]');
      await expect(page.locator('[data-raid-tab="rewards"]')).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await expect(page.locator(".raid-reward-identity h2")).toHaveText(
        "Grumblecrag",
      );
      await snap(page, info, `rewards-${viewport.width}x${viewport.height}`);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

test("locked bosses keep their navigation and unlock instruction visible", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    const errors = await openTown(page);
    await page.evaluate(() => {
      const fetch = window.fetch.bind(window);
      window.fetch = async (input, init) =>
        String(input).includes("/api/raids")
          ? new Response(
              JSON.stringify({
                clears: 0,
                highestPeril: 0,
                titles: [],
                cosmetics: [],
                weekly: [],
                earned: [],
                bosses: {},
              }),
              { headers: { "Content-Type": "application/json" } },
            )
          : fetch(input, init);
    });
    await openTownMenu(page);
    await page.click('[data-action="raids"]');
    await page.click('.raid-roster-card[data-raid-boss="emberwing"]');
    await expect(page.locator(".raid-showcase-name h2")).toHaveText(
      "Emberwing",
    );
    await expect(page.locator(".raid-roster-lock")).toHaveCount(6);
    for (const skill of await page.locator("[data-hub-practice]").all())
      await expect(skill).toBeDisabled();
    await expect(page.locator("[data-raid-start]")).toHaveCount(0);
    const notice = page.locator(".dialog-footer .raid-hub-locked");
    await expect(notice).toHaveText(
      "Clear Grumblecrag once to unlock Emberwing.",
    );
    await expect(notice).toBeInViewport();
    await page.locator("#dialog").evaluate(async (el) => {
      await Promise.all(
        el
          .getAnimations({ subtree: true })
          .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
          .map((a) => a.finished.catch(() => {})),
      );
    });
    const rail = await box(page, ".raid-boss-roster");
    await page.click(".raid-field-guide > summary");
    await page
      .locator(".raid-dialog-content")
      .evaluate((el) => (el.scrollTop = el.scrollHeight));
    expect(await box(page, ".raid-boss-roster")).toEqual(rail);
    await expect(notice).toBeInViewport();
    await snap(page, info, "hub-locked-mobile");
    await page.click("#close-dialog");
    await page.evaluate(() => document.getElementById("settings")!.click());
    await expect(page.locator(".settings-screen")).toBeVisible();
    await expect(page.locator("#dialog")).not.toHaveClass(/has-raid-roster/);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
