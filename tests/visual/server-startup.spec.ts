import { expect, test, type Page } from "@playwright/test";
import { box, inside, snap } from "./helpers";

async function coldServer(page: Page) {
  await page.route(/\/fake-api\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: `${await response.text()}
const originalStartupFetch = window.fetch.bind(window);
window.__startupProfileRequests = 0;
window.__startupHealthRequests = 0;
window.fetch = async (input, init) => {
  const path = new URL(String(input), location.href).pathname;
  if (path === '/api/health') {
    window.__startupHealthRequests++;
    return new Promise((resolve, reject) => {
      window.__releaseStartup = () => resolve(Response.json({ok:true}));
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {once:true});
    });
  }
  if (path === '/api/account') window.__startupProfileRequests++;
  return originalStartupFetch(input, init);
};`,
    });
  });
}

for (const size of [
  { width: 1440, height: 900 },
  { width: 844, height: 390 },
  { width: 844, height: 280 },
]) {
  test(`cold startup waits before loading a profile and fits ${size.width}x${size.height}`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: size,
      isMobile: size.width < 1000,
      hasTouch: size.width < 1000,
    });
    try {
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      await coldServer(page);
      await page.goto("/");
      const panel = page.locator("#server-startup");
      await expect(panel).toBeVisible();
      await expect(panel).toContainText("Opening the arena");
      expect(
        inside(await box(page, ".server-startup-card"), {
          x: 0,
          y: 0,
          ...size,
        }),
      ).toBe(true);
      expect(
        await page.evaluate(() => (window as any).__startupProfileRequests),
      ).toBe(0);
      expect(
        await page.evaluate(() => (window as any).__startupHealthRequests),
      ).toBe(1);
      await snap(page, info, `server-waking-${size.width}x${size.height}`);
      await page.evaluate(() => (window as any).__releaseStartup());
      await expect(panel).toHaveCount(0);
      await expect
        .poll(() =>
          page.evaluate(() => (window as any).__startupProfileRequests),
        )
        .toBe(1);
      await expect
        .poll(async () => {
          await page.evaluate(() => (window as any).__sock.fire("connect"));
          return page.locator("#town-menu-toggle").isVisible();
        })
        .toBe(true);
      await expect(page.locator("#toast")).not.toContainText(
        /couldn't load|taking longer|Connection lost/,
      );
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

test("offline startup resumes without a login error when the network returns", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).__online = false;
    Object.defineProperty(navigator, "onLine", {
      get: () => (window as any).__online,
    });
  });
  await page.goto("/");
  await expect(page.locator("#server-startup")).toContainText("You’re offline");
  await page.evaluate(() => {
    (window as any).__online = true;
  });
  await expect(page.locator("#server-startup")).toHaveCount(0);
  await expect(page.locator("#gate-auth")).not.toContainText(
    "couldn't load your profile",
  );
});

test("the startup illustration respects reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await coldServer(page);
  await page.goto("/");
  await expect(page.locator("#server-startup")).toBeVisible();
  const animations = await page
    .locator("#server-startup")
    .evaluate((el) => el.getAnimations({ subtree: true }).length);
  expect(animations).toBe(0);
});

test("a startup timeout exposes a working retry without reloading the page", async ({
  page,
}) => {
  await page.route(/\/server-startup\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    expect(body).toContain("deadlineMs:");
    await route.fulfill({
      response,
      body: body
        .replace(/deadlineMs:\s*[\d_e]+/, "deadlineMs: 2000")
        .replace(/requestMs:\s*[\d_e]+/, "requestMs: 800")
        .replace(/retryMs:\s*[\d_e]+/, "retryMs: 100"),
    });
  });
  await coldServer(page);
  await page.goto("/");
  const retry = page.locator("#server-startup button");
  await expect(retry).toBeVisible();
  await expect(page.locator("#server-startup")).toContainText("taking longer");
  const before = await page.evaluate(
    () => (window as any).__startupHealthRequests,
  );
  await retry.click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__startupHealthRequests))
    .toBeGreaterThan(before);
  await page.evaluate(() => (window as any).__releaseStartup());
  await expect(page.locator("#server-startup")).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => (window as any).__startupProfileRequests))
    .toBe(1);
});

test("a token refresh during cold start connects once with the fresh token", async ({
  page,
}) => {
  await page.route(/\/apps\/client\/src\/main\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const marker = 'window.dispatchEvent(new Event("arena:ready"));';
    expect(body).toContain(marker);
    await route.fulfill({
      response,
      body: body.replace(marker, "window.__account=accountsUI;" + marker),
    });
  });
  await coldServer(page);
  await page.goto("/");
  await expect(page.locator("#server-startup")).toBeVisible();
  await page.evaluate(() => {
    const w = window as any;
    w.__startupConnects = [];
    w.__sock.connect = () => {
      w.__startupConnects.push(w.__sock.auth.accessToken);
      return w.__sock;
    };
    void w.__account.setSession({
      ...w.__account.session,
      access_token: "fresh-token",
    });
    w.__releaseStartup();
  });
  await expect
    .poll(() => page.evaluate(() => (window as any).__startupConnects))
    .toEqual(["fresh-token"]);
  await expect
    .poll(() => page.evaluate(() => (window as any).__startupProfileRequests))
    .toBe(1);
});
