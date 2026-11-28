import { expect, test, type Page } from "@playwright/test";
import { askReducedMotion, snap } from "./helpers";
import { onPlayersLook } from "./players-look";
import { ISLAND, setInsets } from "./ui-measure";

// In the look players have (players-look.ts).
onPlayersLook();

/**
 * Poster's title screen (owner, 27 Nov 2026): one compact MENU keeps the four tools, and the cover's sunburst turns once in 100 s. That turn is the
 * one animation in Poster that runs for ever (docs/ui-themes.md), so these
 * tests say where it runs and where it stops: on the title screen only, on
 * a layer of its own that only turns, still with Reduce motion and on Low
 * graphics, and gone with the title screen.
 */
async function openTitle(page: Page, graphics = "high") {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.addInitScript((level) => {
    (window as any).__showTitle = true;
    try {
      localStorage.setItem("ea-graphics", level);
      localStorage.setItem("ea-hub-scene", "lobby");
      localStorage.setItem(
        "arena-tour:11111111-1111-4111-8111-111111111111",
        "done",
      );
    } catch {
      /* No storage. */
    }
  }, graphics);
  await page.goto("/");
  await expect(page.locator("[data-title-card]")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator("#server-startup")).toHaveCount(0, {
    timeout: 60_000,
  });
  return errors;
}
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
/** The rays' layer: how it is animated, and whether it covers the screen. */
const rays = (page: Page) =>
  page.evaluate(() => {
    const backdrop = document.querySelector(".welcome-gate .gate-backdrop")!;
    const layer = getComputedStyle(backdrop, "::before");
    const gate = backdrop.getBoundingClientRect();
    const cs = getComputedStyle(backdrop.closest(".welcome-gate")!);
    const x = parseFloat(cs.getPropertyValue("--cover-x")) * gate.width;
    const y = parseFloat(cs.getPropertyValue("--cover-y")) * gate.height;
    const scale = layer.scale === "none" ? 1 : parseFloat(layer.scale);
    return {
      there: layer.content !== "none",
      name: layer.animationName,
      seconds: parseFloat(layer.animationDuration),
      count: layer.animationIterationCount,
      // A circle of this radius, round where the rays meet, is covered at
      // every angle; the farthest corner must lie inside it.
      radius: (parseFloat(layer.width) * scale) / 2,
      farthest: Math.max(
        Math.hypot(x, y),
        Math.hypot(gate.width - x, y),
        Math.hypot(x, gate.height - y),
        Math.hypot(gate.width - x, gate.height - y),
      ),
      // What moves is the layer alone: no animation on the page's colours.
      moves: document
        .getAnimations()
        .map((a) => (a as CSSAnimation).animationName),
    };
  });

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

for (const size of SIZES)
  test(`Poster title at ${size.name}: compact MENU, the sunburst turns`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.phone,
      hasTouch: size.phone,
    });
    try {
      const page = await context.newPage();
      if (size.island) await setInsets(page, ISLAND);
      const errors = await openTitle(page);
      await connect(page);

      // Four tools live behind one compact, finger-sized disclosure.
      const menu = page.locator(".quick-menu-trigger");
      await expect(menu).toHaveAttribute("aria-expanded", "false");
      await expect(page.locator(".title-quick")).toBeHidden();
      await menu.click();
      await expect(page.locator("[data-gate-quick]")).toHaveCount(4);
      for (const tool of await page.locator("[data-gate-quick]").all()) {
        const r = (await tool.boundingBox())!;
        expect(r.width).toBeGreaterThanOrEqual(44);
        expect(r.height).toBeGreaterThanOrEqual(44);
      }
      await page.keyboard.press("Escape");

      // The sunburst: one turn in 100 s, for ever, on a layer that reaches
      // every corner at any angle.
      const turning = await rays(page);
      expect(turning.there).toBe(true);
      expect(turning.name).toBe("poster-cover-turn");
      expect(turning.seconds).toBe(100);
      expect(turning.count).toBe("infinite");
      expect(turning.radius).toBeGreaterThanOrEqual(turning.farthest);
      expect(turning.moves.filter((n) => n === "poster-cover-turn")).toEqual([
        "poster-cover-turn",
      ]);
      await snap(page, info, `poster-title-${size.name}`);

      // Reduce motion (Settings): it stands still.
      await askReducedMotion(page, true);
      await expect.poll(async () => (await rays(page)).name).toBe("none");
      await askReducedMotion(page, false);
      await expect
        .poll(async () => (await rays(page)).name)
        .toBe("poster-cover-turn");

      // Into the game: the title screen leaves the page, and its turn with it.
      await page.locator("#title-start").click();
      await expect(page.locator("[data-title-card]")).toHaveCount(0);
      expect(
        await page.evaluate(() =>
          document
            .getAnimations()
            .some(
              (a) => (a as CSSAnimation).animationName === "poster-cover-turn",
            ),
        ),
      ).toBe(false);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

test("Poster title on Low graphics: the sunburst stands still", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await openTitle(page, "low");
    await expect(page.locator("html")).toHaveAttribute(
      "data-ui-effects",
      "light",
    );
    const still = await rays(page);
    expect(still.there).toBe(true);
    expect(still.name).toBe("none");
  } finally {
    await context.close();
  }
});

for (const size of SIZES)
  test(`Poster sign-in at ${size.name}: compact MENU on the slab, a still cover`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.phone,
      hasTouch: size.phone,
    });
    try {
      const page = await context.newPage();
      if (size.island) await setInsets(page, ISLAND);
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
      await expect(page.locator("#server-startup")).toHaveCount(0);
      const menu = page.locator(".quick-menu-trigger");
      await expect(page.locator(".gate-quick")).toBeHidden();
      await menu.click();
      for (const tool of await page.locator("[data-gate-quick]").all()) {
        const r = (await tool.boundingBox())!;
        expect(r.width).toBeGreaterThanOrEqual(44);
        expect(r.height).toBeGreaterThanOrEqual(44);
      }
      await page.keyboard.press("Escape");
      // Behind the form the rays never move: no turning layer at all.
      const cover = await rays(page);
      expect(cover.there).toBe(false);
      expect(cover.moves).not.toContain("poster-cover-turn");
      await snap(page, info, `poster-signin-${size.name}`);
    } finally {
      await context.close();
    }
  });
