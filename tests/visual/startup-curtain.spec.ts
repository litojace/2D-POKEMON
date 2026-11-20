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

/**
 * The account route answers after `sessionStorage["slow-account"]` ms (or
 * fails, for "fail"), and notes when it did: a reload keeps the setting.
 */
async function controlledAccount(page: Page) {
  await page.route(/\/fake-api\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: `${await response.text()}
const copyFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const path = new URL(String(input), location.href).pathname;
  const slow = sessionStorage.getItem("slow-account");
  if (path === "/api/account" && slow) {
    if (slow === "fail") return Response.json({ error: "Down for a moment." }, { status: 503 });
    await new Promise((resolve) => setTimeout(resolve, Number(slow)));
    window.__accountAnswered = true;
  }
  return copyFetch(input, init);
};`,
    });
  });
  // The account, to sign out with.
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
}

async function phonePage(browser: import("@playwright/test").Browser) {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem("ea-graphics", "high");
    localStorage.setItem("ea-hub-scene", "lobby");
    (window as any).__savedFighter = "cindrake";
  });
  return { context, page };
}

const savedCopy = (page: Page) =>
  page.evaluate(() => localStorage.getItem("ea-profile-copy"));

test("a returning player's hub is drawn from this device's copy, not after the profile loads", async ({
  browser,
}) => {
  const { context, page } = await phonePage(browser);
  try {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await controlledAccount(page);
    // First start: the profile loads, and this device keeps a copy of it.
    await page.goto("/");
    await connectUntilUncovered(page);
    await expect.poll(() => savedCopy(page)).toContain('"cindrake"');
    expect(await savedCopy(page)).toContain("voltkit-stormcrown");
    // Next start, with the profile slow to answer.
    await page.evaluate(() => sessionStorage.setItem("slow-account", "6000"));
    await watchUncoveredHub(page);
    await page.reload();
    await connectUntilUncovered(page);
    // The curtain lifted on the saved copy before the profile answered.
    expect(await page.evaluate(() => !!(window as any).__accountAnswered)).toBe(
      false,
    );
    const seen = (await page.evaluate(() => (window as any).__uncovered)) as {
      name: string;
      coins: boolean;
      signedIn: boolean;
    }[];
    expect(seen.length).toBeGreaterThan(0);
    for (const frame of seen)
      expect(frame).toEqual({ name: "Cindrake", coins: true, signedIn: true });
    // The fresh profile replaces it, and is kept again.
    await expect
      .poll(() => page.evaluate(() => !!(window as any).__accountAnswered), {
        timeout: 15_000,
      })
      .toBe(true);
    await expect
      .poll(() => page.evaluate(() => (window as any).__account.fromCopy))
      .toBe(false);
    // Signing out forgets this device's copy.
    await page.evaluate(() => (window as any).__account.setSession(null));
    await expect.poll(() => savedCopy(page)).toBe(null);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("a saved copy never outlives a profile that fails to load", async ({
  browser,
}) => {
  const { context, page } = await phonePage(browser);
  try {
    await controlledAccount(page);
    await page.goto("/");
    await connectUntilUncovered(page);
    await expect.poll(() => savedCopy(page)).not.toBe(null);
    await page.evaluate(() => sessionStorage.setItem("slow-account", "fail"));
    await page.reload();
    // The front door offers to try again, as without a copy.
    await expect
      .poll(
        async () => {
          await page.evaluate(() => (window as any).__sock?.fire("connect"));
          return page.locator("#gate-auth").textContent();
        },
        { timeout: 20_000 },
      )
      .toContain("couldn't load your profile");
    await expect(page.locator("#account-coins > *")).toHaveCount(0);
  } finally {
    await context.close();
  }
});

for (const size of [
  { width: 844, height: 390 },
  { width: 844, height: 280 },
  { width: 1440, height: 900 },
]) {
  test(`a tip stays until it has been read, fits ${size.width}x${size.height}`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: size,
      isMobile: size.width < 1000,
      hasTouch: size.width < 1000,
    });
    try {
      const page = await context.newPage();
      await page.addInitScript(() => {
        localStorage.setItem("ea-loading-tips", "on");
        localStorage.setItem("ea-hub-scene", "lobby");
      });
      await page.goto("/");
      const tip = page.locator("#server-startup .server-startup-tip");
      // A first start begins with where the orbs appear, with its map.
      await expect(tip).toBeVisible();
      await expect(tip).toContainText("healing orb appears at the top centre");
      await expect(tip.locator("svg.server-startup-tip-map")).toBeVisible();
      const shownAt = Date.now();
      await page.evaluate(() => document.fonts.ready);
      for (const part of [
        ".server-startup-brand",
        ".server-startup-progress",
        ".server-startup-tip",
      ]) {
        const r = (await page.locator(part).boundingBox())!;
        expect(r.x, part).toBeGreaterThanOrEqual(0);
        expect(r.y, part).toBeGreaterThanOrEqual(0);
        expect(r.x + r.width, part).toBeLessThanOrEqual(size.width);
        expect(r.y + r.height, part).toBeLessThanOrEqual(size.height);
      }
      const art = (await page.locator(".server-startup-art").boundingBox())!;
      const loading = (await page
        .locator(".server-startup-loading")
        .boundingBox())!;
      expect(art.y + art.height).toBeLessThanOrEqual(loading.y + 1);
      await snap(page, info, `startup-tip-${size.width}x${size.height}`);
      // Loaded long before it's read: ready, waiting for the reader.
      await expect
        .poll(async () => {
          await page.evaluate(() => (window as any).__sock?.fire("connect"));
          return page.locator("#server-startup p").textContent();
        })
        .toContain("Tap to enter");
      await expect(page.locator("#server-startup")).toHaveCount(0, {
        timeout: 10_000,
      });
      // tipReadMs: this tip is long enough for the 7 s ceiling.
      expect(Date.now() - shownAt).toBeGreaterThan(6_000);
      // The next start shows the next tip, and a tap goes in once loaded.
      await page.reload();
      await expect(tip).toBeVisible();
      await expect(tip).not.toContainText("healing orb appears at the top");
      await expect
        .poll(async () => {
          await page.evaluate(() => (window as any).__sock?.fire("connect"));
          return page.locator("#server-startup p").textContent();
        })
        .toContain("Tap to enter");
      const tapped = Date.now();
      await page
        .locator("#server-startup")
        .click({ position: { x: 20, y: 20 } });
      await expect(page.locator("#server-startup")).toHaveCount(0);
      expect(Date.now() - tapped).toBeLessThan(2_000);
    } finally {
      await context.close();
    }
  });
}

// index.html's boot screen is laid out as the curtain that replaces it: the
// title, its divider and "Opening the arena…" stay exactly where they are.
for (const tips of ["on", "off"])
  for (const size of [
    { width: 844, height: 390 },
    { width: 844, height: 280 },
    { width: 1920, height: 1200 },
  ])
    test(`the boot screen hands over without moving, tips ${tips}, ${size.width}x${size.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      await page.addInitScript((t) => {
        localStorage.setItem("ea-loading-tips", t);
      }, tips);
      // Hold the game's code back to measure the boot screen alone.
      let release!: () => void;
      const held = new Promise<void>((resolve) => (release = resolve));
      await page.route(
        /\/apps\/client\/src\/main\.ts(?:\?|$)/,
        async (route) => {
          await held;
          await route.continue();
        },
      );
      void page.goto("/").catch(() => {});
      await page.waitForSelector("#app-boot h1");
      await page.evaluate(() => document.fonts.ready);
      const at = (selector: string) =>
        page.evaluate((s) => {
          const r = document.querySelector(s)!.getBoundingClientRect();
          return [r.x, r.y, r.width, r.height].map((v) => Math.round(v));
        }, selector);
      const boot = [
        await at("#app-boot h1"),
        await at("#app-boot .boot-divider"),
        await at("#app-boot p"),
      ];
      release();
      await page.waitForSelector("#server-startup .server-startup-brand h1");
      await page.evaluate(() => document.fonts.ready);
      expect([
        await at("#server-startup h1"),
        await at("#server-startup .server-startup-divider"),
        await at("#server-startup .server-startup-loading h2"),
      ]).toEqual(boot);
    });
