import { expect, test, type Page } from "@playwright/test";
import { snap } from "./helpers";

/**
 * The startup curtain (docs/loading-screens.md): one loading screen covers
 * the game from its first frame until the first screen is complete, so a
 * player never watches the hub fill in (the default fighter swapping for
 * their own, coins and skins appearing a second after the Lobby).
 */

/** Slow answers for the parts of the profile that used to arrive late. */
async function slowProfile(page: Page, paths: string[], ms: number) {
  await page.route(/\/fake-api\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: `${await response.text()}
const curtainFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const path = new URL(String(input), location.href).pathname;
  if (${JSON.stringify(paths)}.includes(path)) {
    if (${ms} < 0) return new Promise(() => {});
    await new Promise((resolve) => setTimeout(resolve, ${ms}));
  }
  return curtainFetch(input, init);
};`,
    });
  });
}

/**
 * Every frame from the start: what an uncovered hub showed (the curtain
 * gone or fading). A covered frame is not recorded.
 */
async function watchUncoveredHub(page: Page) {
  await page.addInitScript(() => {
    const w = window as any;
    w.__uncovered = [];
    const sample = () => {
      const curtain = document.getElementById("server-startup");
      const covered =
        !!document.getElementById("app-boot") ||
        (!!curtain && !curtain.classList.contains("is-leaving"));
      const name = document.getElementById("lobby-fighter-name");
      if (!covered && name && !document.body.classList.contains("gate-active"))
        w.__uncovered.push({
          name: name.textContent,
          coins: !!document.querySelector("#account-coins > *"),
          signedIn: !!document.querySelector("#account-profile"),
        });
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}

async function connectUntilUncovered(page: Page) {
  await expect
    .poll(
      async () => {
        await page.evaluate(() => (window as any).__sock?.fire("connect"));
        return page.locator("#server-startup").count();
      },
      { timeout: 30_000, intervals: [200, 400] },
    )
    .toBe(0);
}

test("the hub is first seen complete: saved fighter, coins and profile", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.addInitScript(() => {
      localStorage.setItem("ea-graphics", "high");
      localStorage.setItem("ea-hub-scene", "lobby");
      // This device last showed Voltkit; the account's own pick is Cindrake.
      localStorage.setItem("arena-featured-fighter", "voltkit");
      (window as any).__savedFighter = "cindrake";
    });
    // Longer than the scene's own settle cap (2.5 s), shorter than the wait
    // for the saved fighter (4 s): only waiting for the profile covers it.
    await slowProfile(page, ["/api/economy", "/api/account/fighter"], 3500);
    await watchUncoveredHub(page);
    await page.goto("/");
    const curtain = page.locator("#server-startup");
    await expect(curtain).toBeVisible();
    // Connected early, as a warm server does: the hub is ready to draw
    // before the profile is.
    await page.evaluate(() => (window as any).__sock?.fire("connect"));
    await page.evaluate(() => document.fonts.ready);
    await snap(page, info, "startup-curtain-loading-844x390");
    await connectUntilUncovered(page);
    const seen = (await page.evaluate(() => (window as any).__uncovered)) as {
      name: string;
      coins: boolean;
      signedIn: boolean;
    }[];
    expect(seen.length).toBeGreaterThan(0);
    for (const frame of seen)
      expect(frame).toEqual({ name: "Cindrake", coins: true, signedIn: true });
    await snap(page, info, "startup-curtain-lifted-844x390");
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("signed out, the curtain lifts to the front door without connecting", async ({
  page,
}) => {
  await page.route(/\/stubs\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const signedIn = "getSession: async () => ({ data: { session } }),";
    expect(body).toContain(signedIn);
    await route.fulfill({
      response,
      body: body.replace(
        signedIn,
        "getSession: async () => ({ data: { session: null } }),",
      ),
    });
  });
  await page.goto("/");
  await expect(page.locator("#server-startup")).toHaveCount(0, {
    timeout: 10_000,
  });
  await expect(page.locator(".welcome-gate")).toBeVisible();
  await expect(page.locator("body")).toHaveClass(/gate-active/);
});

test("a profile that never answers cannot trap the player behind the curtain", async ({
  page,
}) => {
  await page.route(/\/startup-curtain\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    expect(body).toMatch(/CURTAIN_CAP_MS = [\d_e.]+/);
    await route.fulfill({
      response,
      body: body.replace(/CURTAIN_CAP_MS = [\d_e.]+/, "CURTAIN_CAP_MS = 1500"),
    });
  });
  await slowProfile(page, ["/api/account"], -1);
  await page.goto("/");
  await expect(page.locator("#server-startup")).toBeVisible();
  // Past the cap the game shows its own status instead.
  await expect(page.locator("#server-startup")).toHaveCount(0, {
    timeout: 10_000,
  });
  await expect(page.locator("#gate-auth")).toContainText(
    "Checking your account",
  );
});
