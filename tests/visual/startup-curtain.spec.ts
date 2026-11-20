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
  test(`a tip shows while it loads and never holds the game, fits ${size.width}x${size.height}`, async ({
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
      // Every status the curtain shows.
      await page.addInitScript(() => {
        const w = window as any;
        w.__statuses = [];
        new MutationObserver(() => {
          const text = document.querySelector("#server-startup p")?.textContent;
          if (text && w.__statuses.at(-1) !== text) w.__statuses.push(text);
        }).observe(document, {
          subtree: true,
          childList: true,
          characterData: true,
        });
      });
      await page.goto("/");
      const tip = page.locator("#server-startup .server-startup-tip");
      // A first start begins with where the orbs appear.
      await expect(tip).toBeVisible();
      await expect(tip).toContainText("healing orb spawns top centre");
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
      // Loaded long before the tip could be read (this one is long enough
      // for the 5 s ceiling): the game opens anyway, with no "Tap to enter".
      await page.evaluate(() => (window as any).__sock?.fire("connect"));
      const connected = Date.now();
      await connectUntilUncovered(page);
      expect(Date.now() - connected).toBeLessThan(4_500);
      const statuses = (await page.evaluate(
        () => (window as any).__statuses,
      )) as string[];
      expect(statuses.join(" | ")).not.toMatch(/tap/i);
      // The next start shows the next tip.
      await page.reload();
      await expect(tip).toBeVisible();
      await expect(tip).not.toContainText("healing orb spawns top centre");
    } finally {
      await context.close();
    }
  });
}

/**
 * Paintings in the game for this test (loading-art.ts lists only those whose
 * picture is in the repository): stand-ins drawn from the game's own
 * backgrounds, in the given scenes.
 */
async function withPaintings(page: Page, ids: string[]) {
  const stand = [
    "/assets/backgrounds/elemental-horizon.webp",
    "/assets/backgrounds/plaza-night-voltkit.webp",
  ];
  await page.route(/\/loading-art\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    expect(body).toContain("export const LOADING_ART");
    const add = ids
      .map(
        (id, i) =>
          `LOADING_ART.push({ ...LOADING_SCENES.find((s) => s.id === ${JSON.stringify(id)}), src: ${JSON.stringify(stand[i % stand.length])} });`,
      )
      .join("\n");
    await route.fulfill({ response, body: `${body}\n${add}` });
  });
}

// index.html's boot screen is laid out as the curtain that replaces it: the
// title, its divider and "Opening the arena…" stay exactly where they are,
// with or without a painting.
for (const [tips, art] of [
  ["on", ""],
  ["off", ""],
  ["on", "duel-storm-vs-forge"],
] as const)
  for (const size of [
    { width: 844, height: 390 },
    { width: 844, height: 280 },
    { width: 1920, height: 1200 },
  ])
    test(`the boot screen hands over without moving, tips ${tips}${art ? ", painting" : ""}, ${size.width}x${size.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      await page.addInitScript(
        ([t, a]) => {
          localStorage.setItem("ea-loading-tips", t);
          if (a) localStorage.setItem("ea-next-art", a);
        },
        [tips, art],
      );
      if (art) await withPaintings(page, [art]);
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
      // The starfield: title, divider, "Opening the arena…". A painting
      // (style K): title, gold star, the status line and the bar.
      const boot = art
        ? [
            await at("#app-boot h1"),
            await at("#app-boot .boot-crest"),
            await at("#app-boot p"),
            await at("#app-boot .boot-progress"),
          ]
        : [
            await at("#app-boot h1"),
            await at("#app-boot .boot-divider"),
            await at("#app-boot p"),
          ];
      release();
      await page.waitForSelector(
        `#server-startup${art ? ".has-art" : ""} .server-startup-brand h1`,
      );
      await page.evaluate(() => document.fonts.ready);
      expect(
        art
          ? [
              await at("#server-startup h1"),
              await at("#server-startup .server-startup-crest"),
              await at("#server-startup .server-startup-loading p"),
              await at("#server-startup .server-startup-progress"),
            ]
          : [
              await at("#server-startup h1"),
              await at("#server-startup .server-startup-divider"),
              await at("#server-startup .server-startup-loading h2"),
            ],
      ).toEqual(boot);
    });

for (const size of [
  { width: 844, height: 390 },
  { width: 568, height: 320 },
  { width: 1440, height: 900 },
])
  test(`a painting behind the curtain in style K, ${size.width}x${size.height}`, async ({
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
        localStorage.setItem("ea-next-art", "teams-hon-viet");
      });
      await withPaintings(page, ["teams-hon-viet"]);
      await page.goto("/");
      const curtain = page.locator("#server-startup");
      await expect(curtain).toHaveClass(/has-art/);
      await expect(curtain).toHaveClass(/has-painting/);
      await expect(curtain.locator(".server-startup-painting")).toHaveAttribute(
        "src",
        /elemental-horizon/,
      );
      // A 2v2 painting: a tip for 2v2 (or every mode), never the 1v1 one.
      const tip = curtain.locator(".server-startup-tip");
      await expect(tip).toBeVisible();
      await expect(tip).not.toContainText("1v1");
      await page.evaluate(() => document.fonts.ready);
      // One status at a time once the cross-fade is over.
      await expect(
        curtain.locator(".server-startup-loading p > span:not([aria-hidden])"),
      ).toHaveCount(1);
      const box = async (s: string) => (await page.locator(s).boundingBox())!;
      const [crest, title, tipBox, line, bar] = [
        await box("#server-startup .server-startup-crest"),
        await box("#server-startup h1"),
        await tip.boundingBox().then((b) => b!),
        await box(
          "#server-startup .server-startup-loading p > span:not([aria-hidden])",
        ),
        await box("#server-startup .server-startup-progress"),
      ];
      for (const [name, r] of Object.entries({
        crest,
        title,
        tipBox,
        line,
        bar,
      })) {
        expect(r.x, name).toBeGreaterThanOrEqual(0);
        expect(r.x + r.width, name).toBeLessThanOrEqual(size.width);
        expect(r.y + r.height, name).toBeLessThanOrEqual(size.height);
      }
      // The star and title top right, the star on the title's left.
      expect(title.x + title.width).toBeGreaterThan(size.width * 0.85);
      expect(title.y).toBeLessThan(size.height * 0.1);
      expect(crest.x + crest.width).toBeLessThanOrEqual(title.x);
      // The bar across the whole width, the status line on its left end,
      // the tip on the right above both.
      expect(bar.width).toBeGreaterThan(size.width * 0.85);
      expect(bar.y + bar.height).toBeGreaterThan(size.height * 0.9);
      expect(line.x).toBeLessThan(size.width * 0.1);
      expect(line.y + line.height).toBeLessThanOrEqual(bar.y);
      expect(tipBox.x + tipBox.width).toBeGreaterThan(size.width * 0.9);
      expect(tipBox.y + tipBox.height).toBeLessThanOrEqual(line.y);
      expect(tipBox.y).toBeGreaterThan(title.y + title.height);
      await snap(page, info, `startup-painting-${size.width}x${size.height}`);
    } finally {
      await context.close();
    }
  });

test("the next start's painting is chosen and downloaded once the game is up", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("seeded")) {
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem("ea-next-art", "duel-eclipse");
    }
  });
  await withPaintings(page, ["duel-eclipse", "ffa-sky-pirates"]);
  const asked: string[] = [];
  page.on("request", (r) => asked.push(r.url()));
  await page.goto("/");
  await expect(page.locator("#server-startup")).toHaveClass(/has-art/);
  await connectUntilUncovered(page);
  // The other painting (never the same twice in a row), fetched ahead.
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("ea-next-art")), {
      timeout: 10_000,
    })
    .toBe("ffa-sky-pirates");
  await expect
    .poll(() => asked.some((u) => u.includes("plaza-night-voltkit")))
    .toBe(true);
  // The next start shows it, from the first frame of the boot screen.
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/boot-art/);
  await expect(page.locator("#server-startup")).toHaveClass(/has-art/);
  await expect(page.locator(".server-startup-painting")).toHaveAttribute(
    "src",
    /plaza-night-voltkit/,
  );
});

test("a first start (no painting chosen yet) shows the starfield", async ({
  page,
}) => {
  await withPaintings(page, ["duel-eclipse"]);
  await page.goto("/");
  const curtain = page.locator("#server-startup");
  await expect(curtain).toBeVisible();
  await expect(curtain).not.toHaveClass(/has-art/);
  await expect(page.locator(".server-startup-painting")).toBeHidden();
  await connectUntilUncovered(page);
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("ea-next-art")), {
      timeout: 10_000,
    })
    .toBe("duel-eclipse");
});
