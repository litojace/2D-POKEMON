import { expect, test } from "@playwright/test";
import { box, inside, snap } from "./helpers";

for (const size of [
  { width: 1280, height: 720 },
  { width: 844, height: 390 },
  { width: 568, height: 320 },
]) {
  test(`animated welcome fits ${size.width}×${size.height}`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize(size);
    // Exercise the actual signed-out app and auth forms, with no real account.
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
    const camp = page.locator(".gate-camp");
    await expect(camp).toHaveAttribute("data-live", "", { timeout: 45_000 });
    await expect(camp.locator("[data-gate-champion]")).toHaveCount(8);
    const stage = await box(page, ".gate-camp"),
      card = await box(page, ".gate-card");
    expect(stage.width).toBeGreaterThan(200);
    expect(stage.height).toBeGreaterThan(150);
    expect(stage.x + stage.width).toBeLessThanOrEqual(card.x);
    expect(inside(card, { x: 0, y: 0, ...size })).toBe(true);
    expect(inside(await box(page, ".gate-camp-canvas canvas"), stage)).toBe(
      true,
    );
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
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForTimeout(250);
    const still = await camp.locator("canvas").screenshot();
    await page.waitForTimeout(250);
    expect(await camp.locator("canvas").screenshot()).toEqual(still);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(size.width);
    await snap(page, info, `welcome-${size.width}`);
    // Leaving the gate disposes its separate renderer rather than retaining a
    // hidden game loop behind the town or arena.
    await page.evaluate(() =>
      document.querySelector(".welcome-gate")!.remove(),
    );
    await expect(page.locator(".gate-camp-canvas")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
