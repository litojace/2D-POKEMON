import { fileURLToPath } from "node:url";
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

/** Connect the hub (the harness's socket waits to be told) until the curtain lifts. */
async function enterHub(page: Page) {
  await expect
    .poll(
      async () => {
        await page.evaluate(() => (window as any).__sock?.fire("connect"));
        return page.locator("#server-startup").count();
      },
      { timeout: 20_000, intervals: [300, 500] },
    )
    .toBe(0);
  await expect(page.locator("body")).not.toHaveClass(/gate-active/);
  await expect(page.locator("#lobby-play")).toBeVisible();
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
      // The runner (startup-runner.ts): the fighter's own side view, drawn.
      const runner = panel.locator(".server-startup-runner");
      await expect(runner.locator("svg .fighter-character")).toHaveCount(1);
      await page.evaluate(() => document.fonts.ready);
      const logo = await box(page, ".server-startup-brand");
      const loading = await box(page, ".server-startup-loading");
      for (const rect of [logo, loading]) {
        expect(inside(rect, { x: 0, y: 0, ...size })).toBe(true);
        expect(Math.abs(rect.x + rect.width / 2 - size.width / 2)).toBeLessThan(
          1,
        );
      }
      expect(logo.y + logo.height).toBeLessThanOrEqual(loading.y);
      // It stands on the bar, at the end of the fill, clear of the name and
      // of the line above it, and it runs while the bar moves (a waking
      // server's estimate creeps along).
      await expect(runner).toHaveClass(/is-running/);
      const place = await panel.evaluate((el) => {
        const r = (s: string) => {
          const b = el.querySelector(s)!.getBoundingClientRect();
          return { x: b.x, y: b.y, width: b.width, height: b.height };
        };
        return {
          runner: r(".server-startup-runner"),
          bar: r(".server-startup-progress"),
          fill: r(".server-startup-progress > i"),
          line: r(".server-startup-loading h2"),
        };
      });
      expect(inside(place.runner, { x: 0, y: 0, ...size })).toBe(true);
      expect(place.runner.width).toBeCloseTo(place.runner.height, 0);
      expect(place.runner.y).toBeGreaterThanOrEqual(logo.y + logo.height);
      expect(place.runner.y).toBeGreaterThanOrEqual(
        place.line.y + place.line.height - 1,
      );
      // Feet on the bar (the drawing keeps a little room under them).
      const feet = place.runner.y + place.runner.height * 0.915;
      expect(Math.abs(feet - place.bar.y)).toBeLessThanOrEqual(3);
      // Its middle a little behind the end of the fill (both glide there).
      const fillEnd = place.fill.x + place.fill.width;
      const middle = place.runner.x + place.runner.width / 2;
      expect(middle).toBeLessThanOrEqual(fillEnd + 2);
      expect(fillEnd - middle).toBeLessThanOrEqual(place.runner.width * 0.3);
      const progress = panel.getByRole("progressbar");
      await expect(progress).toBeVisible();
      await expect(progress).not.toHaveAttribute("aria-valuenow");
      const before = await progress.evaluate((el) =>
        Number(
          (el as HTMLElement).style.getPropertyValue("--startup-progress"),
        ),
      );
      await expect
        .poll(() =>
          progress.evaluate((el) =>
            Number(
              (el as HTMLElement).style.getPropertyValue("--startup-progress"),
            ),
          ),
        )
        .toBeGreaterThan(before);
      expect(
        await progress.evaluate((el) =>
          Number(
            (el as HTMLElement).style.getPropertyValue("--startup-progress"),
          ),
        ),
      ).toBeLessThan(0.93);
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
      await progress.evaluate((el) => {
        new MutationObserver((_mutations, observer) => {
          if (el.getAttribute("aria-valuenow") === "100") {
            // The bar completes only over a finished hub: profile and coins.
            (window as any).__startupCompleted =
              !document.body.classList.contains("gate-active") &&
              !!document.querySelector("#account-profile") &&
              !!document.querySelector("#account-coins > *");
            observer.disconnect();
          }
        }).observe(el, {
          attributes: true,
          attributeFilter: ["aria-valuenow"],
        });
      });
      await page.evaluate(() => (window as any).__releaseStartup());
      // The server answering no longer lifts the curtain: it stays over the
      // profile load and the connection, so the hub never fills in on screen.
      await expect
        .poll(() =>
          page.evaluate(() => (window as any).__startupProfileRequests),
        )
        .toBe(1);
      await enterHub(page);
      expect(
        await page.evaluate(() => (window as any).__startupCompleted),
      ).toBe(true);
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
  const progress = page.getByRole("progressbar", {
    name: "Game server connection",
  });
  const paused = await progress.evaluate((el) =>
    (el as HTMLElement).style.getPropertyValue("--startup-progress"),
  );
  await page.waitForTimeout(350);
  expect(
    await progress.evaluate((el) =>
      (el as HTMLElement).style.getPropertyValue("--startup-progress"),
    ),
  ).toBe(paused);
  await page.evaluate(() => {
    (window as any).__online = true;
  });
  // A profile error would leave the front door up instead of the hub.
  await enterHub(page);
  await expect(page.locator("#toast")).not.toContainText(
    "couldn't load your profile",
  );
});

// Every champion's arms swing from the shoulder as it runs (owner, 28 Nov:
// a paw flew clear of the body). Each limb turns about the battle rig's
// joint (startup-runner.ts); turned about a point of its own box (50% 14%),
// the shoulder itself travelled and the arm ended a gap away from the body
// at each end of its swing.
test("the startup runner's arms and legs swing from their joints", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 844, height: 390 });
  await coldServer(page);
  await page.goto("/");
  const runner = page.locator("#server-startup .server-startup-runner");
  await expect(runner.locator("svg .fighter-character")).toHaveCount(1);
  const src = (path: string) =>
    "/@fs" + fileURLToPath(new URL(`../../${path}`, import.meta.url));
  const moved = await page.evaluate(
    async ([shared, startup, design, profile]) => {
      const { CHARACTERS } = await import(/* @vite-ignore */ shared);
      const { runnerMarkup } = await import(/* @vite-ignore */ startup);
      const { proportioned } = await import(/* @vite-ignore */ design);
      const { profilePivot } = await import(/* @vite-ignore */ profile);
      const host = document.querySelector<HTMLElement>(
        ".server-startup-runner",
      )!;
      host.style.visibility = "hidden";
      // A runner of our own beside the page's, so the page never redraws it.
      const box = document.createElement("span");
      box.className = "server-startup-runner is-running";
      host.after(box);
      const found: string[] = [];
      for (const id of Object.keys(CHARACTERS)) {
        box.innerHTML = runnerMarkup(id);
        for (const at of [0, 200]) {
          for (const a of box.getAnimations({ subtree: true })) {
            a.pause();
            a.currentTime = at;
          }
          for (const part of ["armL", "armR", "legL", "legR"]) {
            const el = box.querySelector<SVGGraphicsElement>(
              `.fighter-${part}`,
            );
            const joint = profilePivot(id, "right", part);
            if (!el || !joint) continue;
            const [x, y] = proportioned(part, ...joint);
            // The joint as the swung part draws it, and as its parent
            // (the unswung body) does: the same point when it swings
            // about its joint.
            const swung = new DOMPoint(x, y).matrixTransform(
              el.getScreenCTM()!,
            );
            const still = new DOMPoint(x, y).matrixTransform(
              (el.parentNode as SVGGraphicsElement).getScreenCTM()!,
            );
            // In the drawing's units: a leg also steps 2 up and down
            // (server-runner-leg); an arm only turns.
            const scale = Math.hypot(
              el.getScreenCTM()!.a,
              el.getScreenCTM()!.b,
            );
            const off =
              Math.hypot(swung.x - still.x, swung.y - still.y) / scale;
            if (off > (part.startsWith("leg") ? 2.1 : 0.1))
              found.push(`${id} ${part} at ${at} ms: ${off.toFixed(1)}`);
          }
        }
      }
      box.remove();
      return found;
    },
    [
      src("packages/shared/src/index.ts"),
      src("apps/client/src/startup-runner.ts"),
      src("apps/client/src/creature-design.ts"),
      src("apps/client/src/creature-profile.ts"),
    ],
  );
  expect(moved).toEqual([]);
});

test("the startup runner respects reduced motion", async ({ page }) => {
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
  const progress = page.getByRole("progressbar", {
    name: "Game server connection",
  });
  const paused = await progress.evaluate((el) =>
    (el as HTMLElement).style.getPropertyValue("--startup-progress"),
  );
  await page.waitForTimeout(350);
  expect(
    await progress.evaluate((el) =>
      (el as HTMLElement).style.getPropertyValue("--startup-progress"),
    ),
  ).toBe(paused);
  const before = await page.evaluate(
    () => (window as any).__startupHealthRequests,
  );
  await retry.click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__startupHealthRequests))
    .toBeGreaterThan(before);
  await page.evaluate(() => (window as any).__releaseStartup());
  await expect
    .poll(() => page.evaluate(() => (window as any).__startupProfileRequests))
    .toBe(1);
  await enterHub(page);
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

test("the short phone retry layout fits without covering the logo or progress", async ({
  browser,
}, info) => {
  const size = { width: 844, height: 280 };
  const context = await browser.newContext({
    viewport: size,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await page.addInitScript(() =>
      Object.defineProperty(navigator, "onLine", { get: () => false }),
    );
    await page.route(/\/server-startup\.ts(?:\?|$)/, async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body: (await response.text()).replace(
          /deadlineMs:\s*[\d_e]+/,
          "deadlineMs: 1500",
        ),
      });
    });
    await page.goto("/");
    const retry = page.locator("#server-startup button");
    await expect(retry).toBeVisible();
    const logo = await box(page, ".server-startup-brand");
    const footer = await box(page, ".server-startup-loading");
    for (const rect of [
      logo,
      footer,
      await box(page, "#server-startup button"),
    ])
      expect(inside(rect, { x: 0, y: 0, ...size })).toBe(true);
    expect(logo.y + logo.height).toBeLessThan(footer.y);
    // The heading owns up to it; "Opening the arena…" would not be true.
    await expect(page.locator("#server-startup h2")).toHaveText(
      "Connection paused",
    );
    await snap(page, info, "server-starforged-retry-844x280");
  } finally {
    await context.close();
  }
});

test("unavailable fonts still allow connection and entry", async ({ page }) => {
  // The startup screens draw the name in two font files at a fixed address
  // (index.html, server-connection.css); without them, system fonts.
  await page.route(/\/assets\/fonts\/(anton|archivo)-/, (route) =>
    route.abort(),
  );
  await coldServer(page);
  await page.goto("/");
  await expect(page.locator("#server-startup")).toBeVisible();
  await expect(
    page
      .locator("#server-startup")
      .getByRole("heading", { name: "Element Arena", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("progressbar", { name: "Game server connection" }),
  ).toBeVisible();
  await page.evaluate(() => (window as any).__releaseStartup());
  await expect
    .poll(() => page.evaluate(() => (window as any).__startupProfileRequests))
    .toBe(1);
  await enterHub(page);
});

test("the startup runner still fits after turning the phone upright and back", async ({
  browser,
}) => {
  const land = { width: 956, height: 440 };
  const context = await browser.newContext({
    viewport: land,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await coldServer(page);
    await page.goto("/");
    await expect(page.locator("#server-startup")).toBeVisible();
    await page.setViewportSize({ width: 440, height: 956 });
    await page.waitForTimeout(300);
    await page.setViewportSize(land);
    await page.waitForTimeout(300);
    const logo = await box(page, ".server-startup-brand");
    const runner = await box(page, ".server-startup-runner");
    const loading = await box(page, ".server-startup-loading");
    const bar = await box(page, ".server-startup-progress");
    expect(logo.y + logo.height).toBeLessThanOrEqual(loading.y);
    expect(runner.y).toBeGreaterThanOrEqual(logo.y + logo.height);
    expect(runner.width).toBeCloseTo(runner.height, 0);
    expect(
      Math.abs(runner.y + runner.height * 0.915 - bar.y),
    ).toBeLessThanOrEqual(3);
  } finally {
    await context.close();
  }
});
