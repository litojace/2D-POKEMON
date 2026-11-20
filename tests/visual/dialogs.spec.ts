import { expect, test } from "@playwright/test";
import { box, inside, openHub, openLobby, snap } from "./helpers";

const SCREENS = [
  { name: "desktop", viewport: { width: 1440, height: 900 }, touch: false },
  { name: "phone", viewport: { width: 844, height: 390 }, touch: true },
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
      await snap(page, info, `settings-${s.name}`);
      await dialog.locator("#settings-credits").click();
      await expect(dialog.locator(".credits-screen")).toBeVisible();
      await snap(page, info, `credits-${s.name}`);
      await dialog.locator("#credits-back").click();
      await expect(dialog.locator(".settings-screen")).toBeVisible();
      expect(errors).toEqual([]);
    });

    // A landscape phone widens dialogs to fill the screen; a short one (a
    // confirmation, a short list) stays a narrow card instead of a few lines
    // stretched across mostly empty space (owner, 20 Nov).
    test("short dialogs stay a compact card", async ({ page }, info) => {
      await page.addInitScript(
        () => ((window as any).__accountPatch = { guest: true }),
      );
      const errors = await openLobby(page);
      const screen = { x: 0, y: 0, ...s.viewport };
      const compact = async (name: string) => {
        const card = await box(page, "#dialog");
        expect(card.width, name).toBeLessThanOrEqual(440);
        expect(inside(card, screen), name).toBe(true);
        // Centred across the screen.
        expect(
          Math.abs(card.x + card.width / 2 - s.viewport.width / 2),
          name,
        ).toBeLessThanOrEqual(2);
        await snap(page, info, `${name}-${s.name}`);
      };
      // Logging out of a guest pass asks first.
      await page.evaluate(() =>
        document.getElementById("account-logout")!.click(),
      );
      await expect(page.locator("#dialog #guest-leave")).toBeVisible();
      await compact("guest-logout");
      await page.locator("#close-dialog").click();
      // Invite a friend, from the open seat beside your fighter.
      await page.locator("[data-lobby-action=invite]").first().click();
      await expect(page.locator("#dialog #party-invite-list")).toBeVisible();
      await expect(page.locator("#party-invite-list")).not.toContainText(
        "Loading",
      );
      await compact("invite-friend");
      expect(errors).toEqual([]);
    });
  });
