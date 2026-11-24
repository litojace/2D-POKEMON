import { expect, test, type Page } from "@playwright/test";
import { snap } from "./helpers";

// The neutral age question before a new account (age-gate.ts, privacy
// policy "Children"): under 13 is refused and remembered on the device; 13
// or older goes on to sign in.
async function openSignedOut(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/stubs.ts*", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text())
        .replace(
          "getSession: async () => ({ data: { session } })",
          "getSession: async () => ({ data: { session: null } })",
        )
        .replace(
          "signOut: async () => ({}),",
          'signOut: async () => ({}),\n      signInAnonymously: async () => { w.__guestTries = (w.__guestTries ?? 0) + 1; return { data: {}, error: { message: "Offline harness" } }; },',
        ),
    });
  });
  await page.goto("/");
  await expect(page.locator("#guest-form")).toBeVisible();
  return errors;
}
const guestTries = (page: Page) =>
  page.evaluate(() => (window as any).__guestTries ?? 0);

test("under 13 can't make a guest account, and the answer is remembered", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 844, height: 390 });
  const errors = await openSignedOut(page);
  await page.locator("#guest-form button[type=submit]").click();
  const age = page.locator("[data-age-gate]");
  await expect(age).toBeVisible();
  // Neutral: nothing says what age is needed.
  const words = await age.evaluate((el) =>
    [...el.querySelectorAll(".ui-kicker, .ui-title, .ui-note, label > span")]
      .map((e) => e.textContent)
      .join(" "),
  );
  expect(words).not.toMatch(/\d|old|age/i);
  await snap(page, info, "age-gate-844x390");
  // Continue needs both answers.
  await age.locator('[name="year"]').selectOption("2016");
  await age.locator('button[type="submit"]').click();
  await expect(age).toBeVisible();
  await age.locator('[name="month"]').selectOption("3");
  await age.locator('button[type="submit"]').click();
  await expect(age).toHaveCount(0);
  await expect(page.locator("#toast")).toContainText(
    "you can't make an Element Arena account",
  );
  expect(await guestTries(page)).toBe(0);
  // Trying again doesn't ask again (or let a different year through).
  await page.locator("#guest-form button[type=submit]").click();
  await expect(page.locator("[data-age-gate]")).toHaveCount(0);
  expect(await guestTries(page)).toBe(0);
  expect(errors).toEqual([]);
});

test("13 or older goes on to sign in; Cancel and Escape stop without asking again", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await openSignedOut(page);
  const age = page.locator("[data-age-gate]");
  await page.locator("#guest-form button[type=submit]").click();
  await age.locator("[data-age-cancel]").click();
  await expect(age).toHaveCount(0);
  await page.locator("#guest-form button[type=submit]").click();
  await page.keyboard.press("Escape");
  await expect(age).toHaveCount(0);
  expect(await guestTries(page)).toBe(0);
  await page.locator("#guest-form button[type=submit]").click();
  await age.locator('[name="month"]').selectOption("6");
  await age.locator('[name="year"]').selectOption("2000");
  await age.locator('button[type="submit"]').click();
  await expect.poll(() => guestTries(page)).toBe(1);
  // Asked once per device.
  await page.locator("#guest-form button[type=submit]").click();
  await expect.poll(() => guestTries(page)).toBe(2);
  await expect(age).toHaveCount(0);
  expect(errors).toEqual([]);
});
