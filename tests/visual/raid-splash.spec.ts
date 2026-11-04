import { test, expect } from "@playwright/test";
import { box, inside, openHub, snap, hubMenu } from "./helpers";
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 844, height: 390 },
  { width: 844, height: 280 },
  { width: 568, height: 320 },
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
      const errors = await openHub(page);
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
      await hubMenu(page, "raids");
      // The Raid Hall's cards (UI remodel step 5) use the small pictures.
      const room = page.locator(".rh-room");
      await expect(room.locator(".rh-card-art img")).toHaveCount(7);
      for (const boss of [
        "grumblecrag",
        "tidewyrm",
        "gloomshade",
        "somnara",
        "prismatail",
        "emberwing",
        "storm-twins",
      ]) {
        const card = room.locator(`[data-raid-card="${boss}"]`);
        await card.scrollIntoViewIfNeeded();
        await card.click();
        await room.locator('[data-ui-raid-tab="attacks"]').click();
        await expect(room.locator("[data-raid-attack]")).toHaveCount(6);
        const narrow = viewport.width <= 700;
        const art = room.locator(".rh-art img");
        if (!narrow) {
          await expect(art).toBeVisible();
          await art.evaluate(async (img: HTMLImageElement) => {
            await img.decode();
          });
          expect(
            await art.evaluate((img: HTMLImageElement) => img.naturalWidth),
          ).toBeGreaterThanOrEqual(1200);
        }
        await page.evaluate(() => document.fonts.ready);
        const body = await box(page, ".rh-room .rh-body");
        const foot = await box(page, ".rh-room .ui-panel-foot");
        if (viewport.width > viewport.height) {
          for (const skill of await room.locator("[data-raid-attack]").all()) {
            await skill.scrollIntoViewIfNeeded();
            const rect = await skill.boundingBox();
            expect(
              rect && inside(rect, body),
              `${boss}: attack stays above the action bar ${JSON.stringify({ rect, body })}`,
            ).toBe(true);
            expect(rect!.height).toBeGreaterThanOrEqual(44);
          }
        }
        if (!narrow) {
          const stage = await box(page, ".rh-stage");
          expect(inside(stage, { x: 0, y: 0, ...viewport })).toBe(true);
          // The stage and the action bar sit side by side, never on top.
          expect(stage.x + stage.width).toBeLessThanOrEqual(foot.x + 1);
          expect(
            await art.evaluate((img: HTMLImageElement) => {
              const r = img.getBoundingClientRect(),
                scale = Math.max(
                  r.width / img.naturalWidth,
                  r.height / img.naturalHeight,
                );
              // The share of the picture shown along its tighter side.
              return Math.min(
                r.width / (img.naturalWidth * scale),
                r.height / (img.naturalHeight * scale),
              );
            }),
            // The whole picture on every device (owner's note, 4 Nov).
          ).toBeGreaterThanOrEqual(0.98);
        }
        expect(
          await room.evaluate((el) => el.scrollWidth - el.clientWidth),
        ).toBeLessThanOrEqual(1);
        await expect(page.locator(".splash-caption")).toHaveCount(0);
        if (boss === "grumblecrag" || boss === "storm-twins")
          await snap(
            page,
            info,
            `splash-${boss}-${viewport.width}x${viewport.height}`,
          );
        await room.locator("[data-raid-back]").click();
      }
      await room.locator('[data-raid-card="grumblecrag"]').click();
      await expect(room.locator("[data-raid-practice]")).toBeEnabled();
      const actions = await box(page, ".rh-room .ui-panel-foot");
      await room.locator('[data-ui-raid-tab="guide"]').click();
      await expect(room.locator(".rh-chapters > li")).toHaveCount(3);
      await room
        .locator(".rh-body")
        .evaluate((el) => (el.scrollTop = el.scrollHeight));
      expect(await box(page, ".rh-room .ui-panel-foot")).toEqual(actions);
      await room.locator('[data-ui-raid-tab="rewards"]').click();
      await expect(
        room.locator('[data-ui-raid-tab="rewards"]'),
      ).toHaveAttribute("aria-selected", "true");
      await expect(room.locator(".rh-reward").first()).toBeVisible();
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
    const errors = await openHub(page);
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
    await hubMenu(page, "raids");
    const room = page.locator(".rh-room");
    // Locked cards say why (UI remodel step 5).
    await expect(room.locator(".rh-card.is-locked")).toHaveCount(6);
    await expect(
      room.locator('[data-raid-card="emberwing"] .ui-tag'),
    ).toHaveText("Clear Grumblecrag first");
    await room.locator('[data-raid-card="emberwing"]').click();
    await expect(room.locator(".rh-stage-name")).toHaveText("Emberwing");
    await expect(room.locator("[data-raid-start]")).toBeDisabled();
    await expect(room.locator("[data-raid-practice]")).toBeDisabled();
    const notice = room.locator(".rh-foot-note.is-reason");
    await expect(notice).toHaveText(
      "Clear Grumblecrag once to unlock Emberwing.",
    );
    await expect(notice).toBeInViewport();
    await room.locator('[data-ui-raid-tab="attacks"]').click();
    for (const skill of await room.locator("[data-raid-attack]").all())
      await expect(skill).toBeDisabled();
    await room.locator('[data-ui-raid-tab="guide"]').click();
    await room
      .locator(".rh-body")
      .evaluate((el) => (el.scrollTop = el.scrollHeight));
    await expect(notice).toBeInViewport();
    await snap(page, info, "hub-locked-mobile");
    await page.click(".rh-room .ui-close");
    await page.evaluate(() => document.getElementById("settings")!.click());
    await expect(page.locator(".settings-screen")).toBeVisible();
    await expect(page.locator(".rh-room")).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
