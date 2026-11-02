import { expect, test } from "@playwright/test";

/**
 * Supabase sends an expired or reused email link back to the same address with
 * `#error=…`. The page must say the link failed, not "Email confirmed", and
 * tidy the address so a refresh doesn't repeat either message.
 */
test.beforeEach(async ({ page }) => {
  await page.route("**/stubs.ts*", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()).replace(
        "getSession: async () => ({ data: { session } })",
        "getSession: async () => ({ data: { session: null } })",
      ),
    });
  });
});

test("a working confirmation link says the email is confirmed", async ({
  page,
}) => {
  await page.goto("/?auth=email-confirmed");
  await expect(page.locator(".auth-panel")).toBeVisible();
  await expect(
    page.getByText("Email confirmed. You can now log in."),
  ).toBeVisible();
  expect(new URL(page.url()).search).toBe("");
});

test("an expired confirmation link says so instead of claiming success", async ({
  page,
}) => {
  await page.goto(
    "/?auth=email-confirmed#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&sb=",
  );
  await expect(page.locator(".auth-panel")).toBeVisible();
  await expect(
    page.getByText("This email link has expired or was already used", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.getByText("Email confirmed.")).toHaveCount(0);
  const url = new URL(page.url());
  expect(url.search + url.hash).toBe("");
});

test("an expired reset link points to Forgot password", async ({ page }) => {
  await page.goto(
    "/?auth=reset-password#error=access_denied&error_code=otp_expired",
  );
  await expect(page.locator(".auth-panel")).toBeVisible();
  await expect(
    page.getByText("This password reset link has expired", { exact: false }),
  ).toBeVisible();
});
