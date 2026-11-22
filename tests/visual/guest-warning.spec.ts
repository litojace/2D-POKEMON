import { expect, test, type Page } from "@playwright/test";
import { snap } from "./helpers";
import { layoutProblems } from "./ui-measure";

// A new guest pass is said plainly once, when it's made (accounts.ts,
// warnNewGuest): it lives on this device only and can't be recovered; Save
// account goes to the email box on the player card.
const SIZES = [
  { name: "844x390", width: 844, height: 390, phone: true },
  { name: "667x375", width: 667, height: 375, phone: true },
  { name: "1280x800", width: 1280, height: 800, phone: false },
];

async function newGuest(page: Page, fresh = false) {
  const errors: string[] = [];
  // A brand-new pass (level 1): the Lobby tour is due for it.
  if (fresh)
    await page.addInitScript(() => {
      (window as any).__economyPatch = {
        journey: {
          xp: 0,
          recent: [],
          season: {
            id: "2026-10",
            xp: 0,
            week: "2026-W43",
            goals: {},
            completed: [],
          },
          unlocked: [],
        },
      };
    });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    (window as any).__accountPatch = { guest: true, displayName: "Guest 7F3A" };
  });
  // Signed out, and the guest button makes a guest pass (the harness's
  // usual session).
  await page.route("**/stubs.ts*", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text())
        .replace(
          "getSession: async () => ({ data: { session } })",
          "getSession: async () => ({ data: { session: w.__signedIn ? session : null } })",
        )
        .replace(
          "signOut: async () => ({}),",
          "signOut: async () => ({}),\n      signInAnonymously: async () => { w.__signedIn = true; return { data: { session }, error: null }; },",
        ),
    });
  });
  await page.goto("/");
  await expect(page.locator("#guest-form")).toBeVisible();
  await page.locator("#guest-form button[type=submit]").click();
  const age = page.locator("[data-age-gate]");
  await age.locator('[name="month"]').selectOption("6");
  await age.locator('[name="year"]').selectOption("2000");
  await age.locator('button[type="submit"]').click();
  const modal = page.locator(".ui-modal", {
    hasText: "You're playing as a guest",
  });
  // The warning waits for the Lobby, after the log-in's loading curtain
  // (docs/loading-screens.md): connect, as the game server would.
  await expect
    .poll(
      async () => {
        await page.evaluate(() => (window as any).__sock.fire("connect"));
        return modal.isVisible();
      },
      { timeout: 30_000, intervals: [500, 1000] },
    )
    .toBe(true);
  // The moment it shows, no curtain is left over or under it.
  expect(await page.locator("#server-startup").count()).toBe(0);
  return { errors, modal };
}

for (const size of SIZES)
  test(`a new guest is warned once, clearly, at ${size.name}`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.phone,
      hasTouch: size.phone,
    });
    try {
      const page = await context.newPage();
      const { errors, modal } = await newGuest(page);
      await expect(modal).toContainText("Saved on this device only");
      await expect(modal).toContainText("Nobody can bring it back");
      await expect(modal.locator("[data-ui-confirm-ok]")).toHaveText(
        "Save account",
      );
      await expect(modal.locator("[data-ui-cancel]")).toHaveText("Got it");
      // The whole warning and both buttons are on screen, nothing cut.
      for (const b of ["[data-ui-confirm-ok]", "[data-ui-cancel]"])
        await expect(modal.locator(b)).toBeInViewport({ ratio: 1 });
      await page.waitForTimeout(400);
      await snap(page, info, `guest-warning-${size.name}`);
      expect(await layoutProblems(page, { phone: size.phone })).toEqual([]);
      // Save account: the player card, the email box ready to type in.
      await modal.locator("[data-ui-confirm-ok]").click();
      await expect(page.locator(".profile-panel")).toBeVisible();
      await expect(
        page.locator("[data-profile-save] input[type=email]"),
      ).toBeFocused();
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

test("Got it closes the warning; the Lobby tour comes after it, never over it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  const { errors, modal } = await newGuest(page, true);
  // The tour (hub-tour.ts) is due for this new account, but waits: it
  // opened over the warning on the owner's phone (22 Nov 2026).
  await page.waitForTimeout(2500);
  await expect(page.locator(".hub-tour")).toHaveCount(0);
  await modal.locator("[data-ui-cancel]").click();
  await expect(modal).toHaveCount(0);
  await expect(page.locator(".profile-panel")).toHaveCount(0);
  await expect(page.locator(".hub-tour .tour-bubble")).toBeVisible({
    timeout: 10_000,
  });
  expect(errors).toEqual([]);
});

test("Save account: the tour waits for the player card to close", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  const { errors, modal } = await newGuest(page, true);
  await modal.locator("[data-ui-confirm-ok]").click();
  await expect(page.locator(".profile-panel")).toBeVisible();
  await page.waitForTimeout(2000);
  await expect(page.locator(".hub-tour")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.locator(".profile-panel")).toHaveCount(0);
  await expect(page.locator(".hub-tour .tour-bubble")).toBeVisible({
    timeout: 10_000,
  });
  expect(errors).toEqual([]);
});
