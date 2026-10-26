import { expect, test } from "@playwright/test";
import { box, inside, snap } from "./helpers";

for (const size of [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 844, height: 390 },
  { width: 568, height: 320 },
]) {
  test(`static welcome fits ${size.width}×${size.height}`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    const requests: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => requests.push(r.url()));
    await page.setViewportSize(size);
    // Real signed-out app and auth forms, without a real account.
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
    const backdrop = page.locator(".gate-backdrop");
    await backdrop.evaluate(async (element) => {
      const url = getComputedStyle(element).backgroundImage.match(
        /url\(["']?([^"')]+)["']?\)/,
      )![1];
      const image = new Image();
      image.src = url;
      await image.decode();
      await document.fonts.ready;
      // The menu has a short, one-off entrance fade. Measure the painting
      // after that UI transition, rather than during changing page opacity.
      await Promise.all(
        document
          .getAnimations()
          .filter((animation) => {
            const effect = animation.effect as KeyframeEffect | null;
            return (
              effect?.target instanceof Element &&
              effect.target.contains(element) &&
              effect.getComputedTiming().iterations !== Infinity
            );
          })
          .map((animation) => animation.finished.catch(() => {})),
      );
    });
    await expect(
      page.locator(".welcome-gate canvas, [data-gate-champion], .gate-motes"),
    ).toHaveCount(0);
    expect(
      await backdrop.evaluate((e) => getComputedStyle(e).animationName),
    ).toBe("none");
    const card = await box(page, ".gate-card");
    expect(inside(card, { x: 0, y: 0, ...size })).toBe(true);
    expect(
      (await box(page, ".gate-heading")).x +
        (await box(page, ".gate-heading")).width,
    ).toBeLessThanOrEqual(card.x);
    // The actual background remains still under ordinary motion preferences.
    const clip = {
      x: 0,
      y: Math.round(size.height * 0.55),
      width: Math.round(size.width * 0.4),
      height: Math.round(size.height * 0.4),
    };
    const first = await page.screenshot({ clip });
    await page.waitForTimeout(350);
    expect((await page.screenshot({ clip })).equals(first)).toBe(true);
    for (const mode of ["signup", "login", "forgot"]) {
      if (mode === "forgot") await page.click("#auth-forgot");
      else await page.click(`[data-auth-tab="${mode}"]`);
      await expect(page.locator(".auth-panel")).toHaveAttribute(
        "data-mode",
        mode,
      );
      expect(
        inside(await box(page, ".gate-card"), { x: 0, y: 0, ...size }),
      ).toBe(true);
      const submit = page.locator(".gate-card .auth-submit").first();
      await submit.scrollIntoViewIfNeeded();
      expect(
        inside(
          await box(page, ".gate-card .auth-submit"),
          await box(page, ".gate-card"),
        ),
      ).toBe(true);
    }
    // Recovery deliberately replaces the tabs with a back action.
    await page.getByRole("button", { name: "Back to log in" }).click();
    // Save the sign-up screen, which has the most controls on small phones.
    await page.click('[data-auth-tab="signup"]');
    await page.locator(".gate-card").evaluate((e) => (e.scrollTop = 0));
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(size.width);
    await snap(page, info, `welcome-${size.width}`);
    expect(
      requests.some((url) =>
        /welcome-animation|campfire-(poster|clearing)/.test(url),
      ),
    ).toBe(false);
    expect(errors).toEqual([]);
  });
}
