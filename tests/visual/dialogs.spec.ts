import { expect, test } from "@playwright/test";
import { CHARACTERS } from "@arena/shared";
import { box, inside, openHub, snap } from "./helpers";
import { onPlayersLook } from "./players-look";

// In the look players have (players-look.ts).
onPlayersLook();

const SCREENS = [
  { name: "desktop", viewport: { width: 1440, height: 900 }, touch: false },
  { name: "phone", viewport: { width: 844, height: 390 }, touch: true },
  { name: "phone-small", viewport: { width: 667, height: 375 }, touch: true },
];

for (const s of SCREENS)
  test.describe(s.name, () => {
    test.use({ viewport: s.viewport, hasTouch: s.touch, isMobile: s.touch });

    test("Settings fits the screen with every action reachable", async ({
      page,
    }, info) => {
      const errors = await openHub(page);
      await page.evaluate(() => document.getElementById("settings")!.click());
      const dialog = page.locator("#dialog");
      await expect(dialog.locator(".settings-screen")).toBeVisible();
      const screen = { x: 0, y: 0, ...s.viewport };
      expect(inside(await box(page, "#dialog"), screen)).toBe(true);
      for (const id of [
        "#open-controls",
        "#settings-report",
        "#settings-credits",
      ]) {
        await expect(dialog.locator(id)).toBeVisible();
        expect(inside(await box(page, id), screen)).toBe(true);
      }
      // In the hub, Settings → Display offers full screen (hub redesign);
      // battle Settings never shows it (see battle-settings.spec.ts).
      await expect(dialog.locator("#settings-fullscreen")).toHaveCount(1);
      await expect(dialog.locator(".settings-quick-actions")).toHaveCount(0);
      // Everything shows at once: the dialog's content doesn't need scrolling.
      const scroll = await dialog
        .locator(".dialog-content")
        .evaluate((el) => el.scrollHeight - el.clientHeight);
      expect(scroll).toBeLessThanOrEqual(1);
      // Sliders say their value.
      await expect(dialog.locator('output[data-pref-for="music"]')).toHaveText(
        /^\d+%$/,
      );
      // Vibration (owner, 25 Nov 2026): on by default, a tap turns it off,
      // and it stays off when Settings opens again.
      const vibration = dialog.locator("#settings-vibration");
      await expect(vibration).toHaveAttribute("aria-checked", "true");
      expect(inside(await box(page, "#settings-vibration"), screen)).toBe(true);
      // A finger's 44 px: the 28 px switch takes taps 20 px above and below
      // its middle (ui/phone-fit.css grows its hit area).
      if (s.touch)
        expect(
          await page.evaluate(() => {
            const el = document.getElementById("settings-vibration")!;
            const r = el.getBoundingClientRect(),
              x = r.x + r.width / 2,
              y = r.y + r.height / 2;
            return [y - 20, y + 20].every((ty) =>
              el.contains(document.elementFromPoint(x, ty)),
            );
          }),
        ).toBe(true);
      await snap(page, info, `settings-${s.name}`);
      await vibration.click();
      await expect(vibration).toHaveAttribute("aria-checked", "false");
      await expect(vibration).toHaveText("Off");
      expect(
        await page.evaluate(() => localStorage.getItem("arena-vibration")),
      ).toBe("off");
      await snap(page, info, `settings-${s.name}-vibration-off`);
      await page.keyboard.press("Escape");
      await expect(dialog.locator(".settings-screen")).toBeHidden();
      await page.evaluate(() => document.getElementById("settings")!.click());
      await expect(vibration).toHaveAttribute("aria-checked", "false");
      await dialog.locator("#settings-credits").click();
      await expect(dialog.locator(".credits-screen")).toBeVisible();
      // The way back reads on the masthead (ink, not the pale blue-grey
      // it had there), and the page counts the roster as it is ("Eight
      // original creatures" beside eighteen fighters).
      expect(
        await dialog
          .locator("#credits-back")
          .evaluate((back) => getComputedStyle(back).color),
      ).toBe("rgb(13, 13, 15)");
      await expect(dialog.locator(".credits-screen")).toContainText(
        `${Object.keys(CHARACTERS).length} original creatures`,
      );
      await snap(page, info, `credits-${s.name}`);
      await dialog.locator("#credits-back").click();
      await expect(dialog.locator(".settings-screen")).toBeVisible();
      expect(errors).toEqual([]);
    });
  });

test("on a phone, Controls has no joystick or button sliders; keys fold away", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    // Sizes saved before 22 Nov 2026 are no longer read.
    await page.addInitScript(() =>
      localStorage.setItem(
        "arena-controls",
        JSON.stringify({ joystickSize: 0.8, buttonSize: 0.85, opacity: 0.4 }),
      ),
    );
    const errors = await openHub(page);
    await page.evaluate(() => document.getElementById("settings")!.click());
    const dialog = page.locator("#dialog");
    await expect(dialog.locator(".settings-screen")).toBeVisible();
    await dialog.locator("#open-controls").click();
    await expect(dialog.locator("#raid-court")).toBeVisible();
    await expect(dialog.locator('input[type="range"]')).toHaveCount(0);
    await expect(dialog.locator("#control-reset")).toHaveCount(0);
    // Keys, mouse and controller are there, folded.
    const more = dialog.locator(".controls-more");
    await expect(more).not.toHaveAttribute("open", "");
    await expect(dialog.locator("button.binding").first()).toBeHidden();
    await more.locator("summary").click();
    await expect(dialog.locator("button.binding").first()).toBeVisible();
    // The touch controls are drawn at the default opacity.
    expect(
      await page.evaluate(() =>
        document
          .getElementById("mobile-controls")!
          .style.getPropertyValue("--hud-opacity"),
      ),
    ).toBe("0.85");
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
