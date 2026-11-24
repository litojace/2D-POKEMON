import { expect, test } from "@playwright/test";

/**
 * iOS Safari zooms into any focused text field under 16px and keeps the page
 * zoomed after the field closes, so a player who logs in on a phone lands in a
 * magnified game until they rotate. Every text field must be 16px or larger on
 * touch screens, including the compact auth panel on short phones.
 */
for (const size of [
  { width: 844, height: 390 },
  { width: 568, height: 320 },
  { width: 390, height: 844 },
]) {
  test(`touch text fields never trigger iOS focus zoom at ${size.width}x${size.height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: size,
      isMobile: true,
      hasTouch: true,
    });
    try {
      const page = await context.newPage();
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
      await page.goto("/");
      await expect(page.locator(".auth-panel")).toBeVisible();
      expect(
        await page.evaluate(() => matchMedia("(pointer: coarse)").matches),
      ).toBe(true);
      for (const mode of ["signup", "login", "forgot"]) {
        // Portrait shows the rotate notice over the form, so switch tabs
        // without a pointer; the fields are measured the same either way.
        await page
          .locator(
            mode === "forgot" ? "#auth-forgot" : `[data-auth-tab="${mode}"]`,
          )
          .dispatchEvent("click");
        await expect(page.locator(".auth-panel")).toHaveAttribute(
          "data-mode",
          mode,
        );
        const small = await page.evaluate(() =>
          [
            ...document.querySelectorAll<HTMLElement>(
              "input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=hidden]), select, textarea",
            ),
          ]
            .filter((el) => el.getClientRects().length > 0)
            .map((el) => ({
              field: `${el.tagName.toLowerCase()}[name=${el.getAttribute("name")}]`,
              px: parseFloat(getComputedStyle(el).fontSize),
            }))
            .filter((f) => f.px < 16),
        );
        expect(small, `${mode} fields under 16px`).toEqual([]);
      }
    } finally {
      await context.close();
    }
  });
}
