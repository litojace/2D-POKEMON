import { expect, test } from "@playwright/test";

for (const resource of ["main.ts", "style.css"]) {
  test(`failed ${resource} shows recovery instead of a bare white rotate page`, async ({
    page,
  }) => {
    // Exercise manual recovery after the bounded automatic retry was used.
    await page.addInitScript(() =>
      sessionStorage.setItem("arena-boot-retry", String(Date.now())),
    );
    await page.setViewportSize({ width: 844, height: 390 });
    const pattern = `**/apps/client/src/${resource}*`;
    await page.route(pattern, (route) => route.abort("failed"));
    await page.goto("/");
    await expect(page.locator("#app-boot h1")).toHaveText(
      "The arena couldn't load",
    );
    await expect(page.locator("#app-boot button")).toBeVisible();
    await expect(page.locator("#rotate-gate")).toBeHidden();
    expect(
      await page
        .locator("#app-boot")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
    ).toBe("rgb(11, 16, 32)");
    await page.unroute(pattern);
    await page.locator("#app-boot button").click();
    await page.waitForFunction(() => !!(window as any).__sock);
    await expect(page.locator("#app-boot")).toHaveCount(0);
    await expect
      .poll(async () => {
        await page.evaluate(() => (window as any).__sock.fire("connect"));
        return page.locator("#town-menu-toggle").isVisible();
      })
      .toBe(true);
  });
}

test("an interrupted entry module automatically recovers without clearing stored data", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/recovery-seed", (route) =>
    route.fulfill({ contentType: "text/html", body: "<body></body>" }),
  );
  await page.goto("/recovery-seed");
  await page.evaluate(() => localStorage.setItem("arena-recovery-check", "kept"));
  await page.route("**/apps/client/src/main.ts*", (route) =>
    ++requests === 1 ? route.abort("failed") : route.continue(),
  );
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).__sock);
  await expect(page.locator("#app-boot")).toHaveCount(0);
  expect(requests).toBe(2);
  expect(
    await page.evaluate(() => localStorage.getItem("arena-recovery-check")),
  ).toBe("kept");
});
