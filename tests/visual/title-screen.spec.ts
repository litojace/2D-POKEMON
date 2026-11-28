import { expect, test, type Page } from "@playwright/test";
import { box, inside, snap } from "./helpers";
import { ISLAND, setInsets } from "./ui-measure";

/** The title screen, as on a fresh launch (title-skip.ts skips it elsewhere). */
async function openTitle(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.addInitScript(() => {
    (window as any).__showTitle = true;
    try {
      localStorage.setItem("ea-graphics", "high");
      localStorage.setItem("ea-hub-scene", "lobby");
      localStorage.setItem(
        "arena-tour:11111111-1111-4111-8111-111111111111",
        "done",
      );
    } catch {
      /* No storage. */
    }
  });
  await page.goto("/");
  await expect(page.locator("[data-title-card]")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator("#server-startup")).toHaveCount(0, {
    timeout: 60_000,
  });
  return errors;
}
/** The game connection comes up (the harness's socket is told so). */
async function connect(page: Page) {
  await expect
    .poll(
      async () => {
        await page.evaluate(() => (window as any).__sock.fire("connect"));
        return page.locator("#title-start").isEnabled();
      },
      { timeout: 20_000, intervals: [300, 800] },
    )
    .toBe(true);
}

const SIZES = [
  { name: "667x375", width: 667, height: 375, phone: true },
  { name: "844x390", width: 844, height: 390, phone: true },
  {
    name: "852x393-island",
    width: 852,
    height: 393,
    phone: true,
    island: true,
  },
  { name: "1440x900", width: 1440, height: 900, phone: false },
];

for (const size of SIZES) {
  test(`title screen fits ${size.name}`, async ({ browser }, info) => {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.phone,
      hasTouch: size.phone,
    });
    const page = await context.newPage();
    try {
      const errors = await openTitle(page);
      if (size.island) await setInsets(page, ISLAND);
      // Before the connection: Start waits, and says so.
      await expect(page.locator("#title-start")).toBeDisabled();
      await expect(page.locator("#title-start")).toContainText("Connecting");
      await snap(page, info, `title-${size.name}-connecting`);
      await connect(page);
      await expect(page.locator("#title-status")).toContainText(
        "Server online",
      );
      await expect(page.locator(".title-name")).toHaveText(/\S/);
      // Phones say "Tap", computers "Click".
      await expect(
        page.locator(`.title-prompt .for-${size.phone ? "touch" : "mouse"}`),
      ).toBeVisible();
      await snap(page, info, `title-${size.name}`);
      const view = { x: 0, y: 0, width: size.width, height: size.height };
      const inset = size.island
        ? ISLAND
        : { left: 0, right: 0, bottom: 0, top: 0 };
      // Layout B (owner's pick): the whole screen is the Start button.
      const tap = await box(page, "#title-start");
      expect(Math.abs(tap.width - size.width)).toBeLessThanOrEqual(1);
      expect(Math.abs(tap.height - size.height)).toBeLessThanOrEqual(1);
      // The prompt sits under the name, and they don't touch: centred on
      // the screen, or in Poster (its cover) lined up with the name on the
      // ink slab at the left.
      const prompt = await box(page, ".title-prompt");
      const brand = await box(page, ".title-brand");
      const poster = await page.evaluate(
        () => document.documentElement.dataset.ui === "poster",
      );
      expect(
        poster
          ? Math.abs(prompt.x - brand.x)
          : Math.abs(prompt.x + prompt.width / 2 - size.width / 2),
      ).toBeLessThanOrEqual(2);
      expect(brand.y + brand.height).toBeLessThan(prompt.y);
      // The corners: inside the safe areas, clear of each other and the name.
      const who = await box(page, "#title-switch");
      const quick = await box(page, ".title-quick");
      const status = await box(page, "#title-status");
      for (const b of [who, quick, status, brand, prompt]) {
        expect(inside(b, view)).toBe(true);
        expect(b.x).toBeGreaterThanOrEqual(inset.left);
        expect(b.x + b.width).toBeLessThanOrEqual(size.width - inset.right);
      }
      const apart = (
        a: { x: number; y: number; width: number; height: number },
        b: { x: number; y: number; width: number; height: number },
      ) =>
        a.x + a.width <= b.x ||
        b.x + b.width <= a.x ||
        a.y + a.height <= b.y ||
        b.y + b.height <= a.y;
      expect(apart(who, quick)).toBe(true);
      expect(apart(who, brand)).toBe(true);
      expect(apart(quick, brand)).toBe(true);
      expect(apart(status, prompt)).toBe(true);
      // One round shape: the box around the avatar is a circle, like the
      // round portrait in it (no square box around a round picture).
      expect(
        await page
          .locator(".title-avatar")
          .evaluate((e) => getComputedStyle(e).borderRadius),
      ).toBe("50%");
      // The name reads in full.
      expect(
        await page
          .locator(".title-name")
          .evaluate((e) => e.scrollWidth <= e.clientWidth),
      ).toBe(true);
      // Every corner control is a real touch target, and a tap on it hits
      // it, never the Start button underneath.
      const corners = page.locator("#title-switch, [data-gate-quick]");
      expect(await corners.count()).toBe(5);
      for (const c of await corners.all()) {
        const hit = c
          .locator(".title-quick-icon")
          .or(c.filter({ has: page.locator(".title-avatar") }));
        const b = (await hit.first().boundingBox())!;
        expect(b.height).toBeGreaterThanOrEqual(44);
        expect(b.width).toBeGreaterThanOrEqual(44);
        expect(
          await c.evaluate((el) => {
            const r = el.getBoundingClientRect();
            const top = document.elementFromPoint(
              r.x + r.width / 2,
              r.y + Math.min(r.height / 2, 22),
            );
            return !!top && el.contains(top);
          }),
        ).toBe(true);
      }
      // Each quick label reads on one line, at 10 px or more
      // (phone-fit.spec's floor).
      for (const q of await page.locator("[data-gate-quick]").all()) {
        const label = q.locator("span").last();
        const lines = await label.evaluate((span) => {
          const r = span.getBoundingClientRect();
          return Math.round(
            r.height / parseFloat(getComputedStyle(span).lineHeight),
          );
        });
        expect(lines).toBe(1);
        expect(
          await label.evaluate((span) =>
            parseFloat(getComputedStyle(span).fontSize),
          ),
        ).toBeGreaterThanOrEqual(10);
        // The label is centred under its icon.
        const icon = (await q.locator(".title-quick-icon").boundingBox())!;
        const text = (await label.boundingBox())!;
        expect(
          Math.abs(icon.x + icon.width / 2 - (text.x + text.width / 2)),
        ).toBeLessThanOrEqual(2);
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

test("Start goes into the Lobby, and a reload goes straight back in", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 844, height: 390 });
  const errors = await openTitle(page);
  await connect(page);
  await page.click("#title-start");
  await expect(page.locator("#lobby-play")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[data-title-card]")).toHaveCount(0);
  // Same launch (the tab, the app still open): no title screen again.
  await page.reload();
  await page.waitForFunction(() => !!(window as any).__sock);
  await expect
    .poll(
      async () => {
        await page.evaluate(() => (window as any).__sock.fire("connect"));
        return page.locator("#lobby-play").isVisible();
      },
      { timeout: 30_000, intervals: [500, 1000] },
    )
    .toBe(true);
  await expect(page.locator("[data-title-card]")).toHaveCount(0);
  await snap(page, info, "title-start-lobby");
  expect(errors).toEqual([]);
});

test("Switch account signs out to the log-in form, without a title screen after", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 844, height: 390 });
  const errors = await openTitle(page);
  await connect(page);
  await page.click("#title-switch");
  await expect(page.locator(".auth-panel")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('[data-auth-tab="login"]')).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator("[data-title-card]")).toHaveCount(0);
  // The quick buttons stay on the sign-in screen too.
  await expect(page.locator("[data-gate-quick]")).toHaveCount(4);
  // The same buttons as on the title screen, at the same size: square ink
  // tiles in Poster (owner, 27 Nov 2026), round in the look underneath.
  const poster = await page.evaluate(
    () => document.documentElement.dataset.ui === "poster",
  );
  for (const icon of await page
    .locator("[data-gate-quick] .title-quick-icon")
    .all()) {
    expect(await icon.evaluate((e) => getComputedStyle(e).borderRadius)).toBe(
      poster ? "0px" : "50%",
    );
    const b = (await icon.boundingBox())!;
    expect(Math.round(b.width)).toBe(44);
    expect(Math.round(b.height)).toBe(44);
  }
  expect(
    await page.evaluate(() => sessionStorage.getItem("ea-title-passed")),
  ).toBe("1");
  await snap(page, info, "title-switch-login");
  expect(errors).toEqual([]);
});

test("the quick buttons open Settings, Help and Repair", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 667, height: 375 });
  const errors = await openTitle(page);
  const dialog = page.locator("#dialog");
  await page.click('[data-gate-quick="settings"]');
  await expect(dialog.locator(".settings-screen")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  // A quick button never starts the game under it.
  await expect(page.locator("[data-title-card]")).toBeVisible();
  await page.click('[data-gate-quick="help"]');
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await page.click('[data-gate-quick="repair"]');
  await expect(dialog.locator(".repair-screen")).toBeVisible();
  await snap(page, info, "title-repair-ask");
  // Repair empties the game's download caches and restarts.
  await page.evaluate(async () => {
    await caches.open("ea-test").then((c) => c.put("/x", new Response("x")));
  });
  await Promise.all([page.waitForEvent("load"), page.click("#repair-go")]);
  expect(await page.evaluate(() => caches.keys())).toEqual([]);
  expect(errors).toEqual([]);
});

test("Enter starts from the title screen on a computer", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const errors = await openTitle(page);
  await connect(page);
  // A mouse: "Click to start", not "Tap".
  await expect(page.locator(".title-prompt .for-mouse")).toBeVisible();
  await expect(page.locator(".title-prompt .for-touch")).toBeHidden();
  await page.keyboard.press("Enter");
  await expect(page.locator("#lobby-play")).toBeVisible({ timeout: 30_000 });
  expect(errors).toEqual([]);
});

test("an invite link skips the title screen", async ({ page }) => {
  await page.addInitScript(() => ((window as any).__showTitle = true));
  await page.goto("/?room=ABC123");
  await page.waitForFunction(() => !!(window as any).__sock);
  await page.evaluate(() => (window as any).__sock.fire("connect"));
  await page.waitForTimeout(1500);
  await expect(page.locator("[data-title-card]")).toHaveCount(0);
});
