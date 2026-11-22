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
      await snap(page, info, `title-${size.name}`);
      const view = { x: 0, y: 0, width: size.width, height: size.height };
      const card = await box(page, ".gate-card");
      expect(inside(card, view)).toBe(true);
      // The name reads in full, and every control is a real touch target.
      expect(
        await page
          .locator(".title-name")
          .evaluate((e) => e.scrollWidth <= e.clientWidth),
      ).toBe(true);
      const targets = page.locator(
        "#title-start, #title-switch, [data-gate-quick]",
      );
      expect(await targets.count()).toBe(6);
      for (const target of await targets.all()) {
        const b = (await target.boundingBox())!;
        expect(b.height).toBeGreaterThanOrEqual(44);
        expect(b.width).toBeGreaterThanOrEqual(44);
        expect(inside(b, view)).toBe(true);
        // Quick buttons stay clear of the card, and of the island's inset.
        if (await target.getAttribute("data-gate-quick")) {
          expect(b.x + b.width).toBeLessThanOrEqual(card.x);
          if (size.island) expect(b.x).toBeGreaterThanOrEqual(ISLAND.left);
        }
      }
      // Each label reads on one line, and phones get the compact size the
      // owner picked (option C: 52 × 44, still a full touch target).
      for (const q of await page.locator("[data-gate-quick]").all()) {
        const lines = await q.locator("span").evaluate((span) => {
          const r = span.getBoundingClientRect();
          return Math.round(
            r.height / parseFloat(getComputedStyle(span).lineHeight),
          );
        });
        expect(lines).toBe(1);
        if (size.phone) {
          const b = (await q.boundingBox())!;
          expect(b.height).toBeLessThanOrEqual(46);
          expect(b.width).toBeLessThanOrEqual(56);
        }
      }
      // Each quick button's icon and label sit centred in it.
      for (const q of await page.locator("[data-gate-quick]").all()) {
        const offset = await q.evaluate((button) => {
          const b = button.getBoundingClientRect();
          const parts = [...button.children].map((c) =>
            c.getBoundingClientRect(),
          );
          const top = Math.min(...parts.map((p) => p.top)),
            bottom = Math.max(...parts.map((p) => p.bottom));
          return Math.abs(top - b.top - (b.bottom - bottom));
        });
        expect(offset).toBeLessThanOrEqual(3);
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

test("an invite link skips the title screen", async ({ page }) => {
  await page.addInitScript(() => ((window as any).__showTitle = true));
  await page.goto("/?room=ABC123");
  await page.waitForFunction(() => !!(window as any).__sock);
  await page.evaluate(() => (window as any).__sock.fire("connect"));
  await page.waitForTimeout(1500);
  await expect(page.locator("[data-title-card]")).toHaveCount(0);
});
