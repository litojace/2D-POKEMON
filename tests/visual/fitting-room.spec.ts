import { expect, test, type Page } from "@playwright/test";
import { box, inside, openLobby, snap } from "./helpers";
import { ISLAND, closeSpot, layoutProblems, setInsets } from "./ui-measure";
import { exposeAccount, shopServer } from "./shop-server";

// UI remodel step 2 (docs/ui-remodel/PLAN.md): the fitting room, the Shop and
// the Wardrobe in one screen inside the Lobby. Measured at the four review
// sizes with the shared layout rules (tests/visual/ui-measure.ts).
const SIZES = [
  { name: "1440x900", width: 1440, height: 900, phone: false },
  { name: "1280x720", width: 1280, height: 720, phone: false },
  { name: "844x390", width: 844, height: 390, phone: true },
  {
    name: "852x393-island",
    width: 852,
    height: 393,
    phone: true,
    island: true,
  },
];
const calls = (page: Page) =>
  page.evaluate(() => (window as any).__shop.calls as unknown[]);
/** The HUD, rail, stage and catalogue: nothing overlaps, all in the safe area. */
async function measured(
  page: Page,
  size: (typeof SIZES)[number],
  label: string,
) {
  const inset = size.island ? ISLAND : undefined;
  expect(
    await layoutProblems(page, { inset, phone: size.phone }),
    label,
  ).toEqual([]);
}

for (const size of SIZES)
  test(`the fitting room's layout at ${size.name}`, async ({
    browser,
  }, info) => {
    test.setTimeout(180_000);
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.phone,
      hasTouch: size.phone,
    });
    try {
      const page = await context.newPage();
      await shopServer(page, {
        owned: [
          "voltkit-midnight",
          "voltkit-stormcrown",
          "galaxy-aura",
          "candy-colours",
        ],
        raids: {
          cosmetics: ["conqueror"],
          bosses: { grumblecrag: { clears: 16 } },
        },
      });
      const errors = await openLobby(page);
      if (size.island) await setInsets(page, ISLAND);
      await page.click('.lobby-rail [data-lobby-action="shop"]');
      const room = page.locator(".fit-room");
      await expect(room).toBeVisible();
      // Inside the Lobby: the HUD and the rail stay; the rail marks the Shop.
      await expect(page.locator("#account-coins")).toBeVisible();
      await expect(
        page.locator('.lobby-rail [data-lobby-action="shop"]'),
      ).toHaveAttribute("aria-current", "page");
      // Opens on today's deal, already on the stage, Buy bottom right.
      await expect(
        page.locator('.fit-deal[aria-pressed="true"]'),
      ).toBeVisible();
      await expect(page.locator(".fit-stage .shop-live-stage")).toHaveAttribute(
        "data-preview-skin",
        "cindrake-blue-flame",
      );
      await expect(page.locator(".fit-stage .shop-live-stage")).toHaveClass(
        /is-ready/,
        { timeout: 60_000 },
      );
      const foot = await box(page, ".ui-panel-foot");
      const buy = await box(page, "[data-fit-buy]");
      expect(inside(buy, foot)).toBe(true);
      expect(foot.x + foot.width - (buy.x + buy.width)).toBeLessThan(20);
      // Close: one size, one spot, as on every screen (step 1).
      expect(await closeSpot(page)).toEqual([
        size.phone
          ? { right: 7, top: 7, size: 32 }
          : { right: 11, top: 11, size: 44 },
      ]);
      // The stage is on the left, the catalogue on the right, side by side.
      const stage = await box(page, ".fit-stage");
      const main = await box(page, ".ui-split-main");
      expect(stage.x + stage.width).toBeLessThanOrEqual(main.x);
      expect(Math.abs(stage.y - main.y)).toBeLessThan(1);
      await measured(page, size, "Today");
      await snap(page, info, `fitting-room-shop-today-${size.name}`);

      for (const section of ["skins", "mythic", "collections"]) {
        await page.click(`[data-ui-section="${section}"]`);
        await expect(
          page.locator(`[data-fit-region=body][data-section="${section}"]`),
        ).toBeVisible();
        await measured(page, size, section);
        // Tiles in a grid share one size, whatever their names.
        const sizes = await page
          .locator(".fit-grid > .ui-tile")
          .evaluateAll((els) =>
            els.map(
              (e) =>
                `${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`,
            ),
          );
        expect(new Set(sizes).size, section).toBe(1);
        await snap(page, info, `fitting-room-shop-${section}-${size.name}`);
      }

      // The Wardrobe: same stage and action bar, owned items only.
      await page.click('[data-ui-mode="wardrobe"]');
      await expect(room).toHaveAttribute("data-fit-mode", "wardrobe");
      await expect(
        page.locator('.lobby-rail [data-lobby-action="wardrobe"]'),
      ).toHaveAttribute("aria-current", "page");
      await expect(page.locator(".fit-slot")).toHaveCount(6);
      await page.click('[data-fit-fighter="voltkit"]');
      await page.click('[data-fit-slot="champion"]');
      await expect(page.locator(".fit-grid [data-ui-item]")).toHaveCount(3); // original, Midnight, Stormcrown
      await expect(page.locator(".fit-more")).toBeVisible();
      await page.click('[data-ui-item="voltkit-midnight"]');
      await expect(page.locator(".ui-panel-foot")).toContainText("1 change");
      await measured(page, size, "Wardrobe");
      await snap(page, info, `fitting-room-wardrobe-${size.name}`);
      await page.click('[data-fit-slot="frame"]');
      await expect(
        page.locator(".fit-stage .shop-live-stage.is-frame"),
      ).toBeVisible();
      await expect(page.locator("[data-fit-stars]")).toHaveCount(6);
      await measured(page, size, "Wardrobe frames");
      await snap(page, info, `fitting-room-wardrobe-frame-${size.name}`);

      // The purchase confirmation fits too.
      await page.click('[data-ui-mode="shop"]');
      await page.click('[data-ui-section="today"]');
      await page.click(".fit-deal");
      await page.click("[data-fit-buy]");
      await expect(page.locator(".ui-modal")).toBeVisible();
      await measured(page, size, "confirmation");
      await snap(page, info, `fitting-room-confirm-${size.name}`);
      await page.keyboard.press("Escape");
      await expect(page.locator(".ui-modal")).toHaveCount(0);
      expect(await calls(page)).toEqual([]);
      // Escape again leaves to the Lobby.
      await page.keyboard.press("Escape");
      await expect(room).toHaveCount(0);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

for (const size of [SIZES[0], SIZES[3]])
  test(`buying asks first, and what the server answers is what shows (${size.name})`, async ({
    browser,
  }, info) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.phone,
      hasTouch: size.phone,
    });
    try {
      const page = await context.newPage();
      await shopServer(page, { balance: 2340, cost: 1200 });
      const errors = await openLobby(page);
      if (size.island) await setInsets(page, ISLAND);
      await page.click("#account-coins");
      await expect(page.locator(".fit-room")).toBeVisible();
      await page.click(".fit-deal");
      await page.click("[data-fit-buy]");
      const modal = page.locator(".ui-modal");
      // The item, its price (and the full one), your coins and coins after.
      await expect(modal).toContainText("Blue Flame");
      await expect(modal.locator("dd").nth(0)).toContainText("1,500");
      await expect(modal.locator("dd").nth(0)).toContainText("1,200");
      await expect(modal.locator("dd").nth(1)).toContainText("2,340");
      await expect(modal.locator("dd").nth(2)).toContainText("1,140");
      await expect(modal.locator("[data-fit-wear]")).toBeChecked();
      await expect(modal.locator("[data-ui-confirm-ok]")).toBeFocused();
      // Cancel sends nothing.
      await modal.locator("[data-ui-cancel]").click();
      expect(await calls(page)).toEqual([]);

      // A refusal shows the server's reason and changes nothing.
      await page.evaluate(
        () => ((window as any).__shop.refuse = "Not enough coins."),
      );
      await page.click("[data-fit-buy]");
      await page.click("[data-ui-confirm-ok]");
      await expect(page.locator("#toast")).toHaveText("Not enough coins.");
      await expect(page.locator(".fit-status")).toHaveAttribute(
        "role",
        "alert",
      );
      await expect(page.locator("#account-coins")).toContainText("2,340");
      await expect(page.locator("[data-fit-buy]")).toBeVisible();

      // Bought: the server's balance and items show, and it is worn at once.
      await page.click("[data-fit-buy]");
      await page.click("[data-ui-confirm-ok]");
      await expect(page.locator("#toast")).toContainText("Blue Flame is yours");
      await expect(page.locator("#account-coins")).toContainText("1,140");
      await expect(page.locator("[data-fit-unequip]")).toBeVisible();
      expect(await calls(page)).toEqual([
        ["buy", "cindrake-blue-flame"],
        ["buy", "cindrake-blue-flame"],
        [
          "equip",
          { champion: "cindrake", skin: "cindrake-blue-flame", stage: 1 },
        ],
      ]);
      await snap(page, info, `fitting-room-bought-${size.name}`);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

test("the Wardrobe: try several things, then Equip once or Revert", async ({
  page,
}, info) => {
  await shopServer(page, {
    owned: [
      "voltkit-midnight",
      "voltkit-stormcrown",
      "galaxy-aura",
      "candy-colours",
    ],
  });
  const errors = await openLobby(page);
  await page.click('.lobby-rail [data-lobby-action="wardrobe"]');
  const room = page.locator(".fit-room");
  await expect(room).toHaveAttribute("data-fit-mode", "wardrobe");
  // Two try-ons, then Revert: nothing is sent, the stage is back.
  await page.click('[data-ui-item="voltkit-midnight"]');
  await page.click('[data-fit-slot="aura"]');
  await page.click('[data-ui-item="galaxy-aura"]');
  await expect(page.locator(".ui-panel-foot")).toContainText("2 changes");
  await expect(
    page.locator('[data-fit-slot][data-changed="true"]'),
  ).toHaveCount(2);
  await page.click("[data-fit-revert]");
  await expect(page.locator(".ui-panel-foot")).toContainText("no changes");
  await expect(page.locator(".fit-stage .shop-live-stage")).toHaveAttribute(
    "data-preview-skin",
    "voltkit-stormcrown",
  );
  expect(await calls(page)).toEqual([]);
  // Try again and Equip: one call per changed slot.
  await page.click('[data-ui-item="galaxy-aura"]');
  await page.click('[data-fit-slot="skin"]');
  await page.click('[data-ui-item="candy-colours"]');
  await page.click('[data-fit-slot="champion"]');
  await page.click('[data-ui-item="voltkit-midnight"]');
  await page.locator("[data-fit-save]").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#toast")).toContainText("3 changes saved");
  // Equip is disabled now (nothing to save): focus stays in the screen.
  expect(
    await page.evaluate(() => !!document.activeElement?.closest(".fit-room")),
  ).toBe(true);
  expect(await calls(page)).toEqual([
    ["equip", { champion: "voltkit", skin: "voltkit-midnight", stage: 1 }],
    ["look", { slot: "skin", item: "candy-colours" }],
    ["look", { slot: "aura", item: "galaxy-aura" }],
  ]);
  await expect(page.locator(".ui-panel-foot")).toContainText("no changes");
  await expect(page.locator('[data-fit-slot="aura"]')).toContainText(
    "Nebula aura",
  );
  // More in the Shop: the Shop on the same slot, things you don't own.
  await page.click(".fit-more");
  await expect(room).toHaveAttribute("data-fit-mode", "shop");
  await expect(page.locator('[data-ui-section="skins"]')).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator('[data-ui-own="unowned"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await snap(page, info, "fitting-room-more-in-shop");
  expect(errors).toEqual([]);
});

test("keyboard: tabs and grids move with the arrows, Escape leaves to the Lobby", async ({
  page,
}) => {
  await shopServer(page);
  const errors = await openLobby(page);
  const rail = page.locator('.lobby-rail [data-lobby-action="shop"]');
  await rail.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".fit-room")).toBeVisible();
  await page.locator('[data-ui-section="today"]').focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-ui-section="skins"]')).toBeFocused();
  await expect(page.locator('[data-ui-section="skins"]')).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const first = page.locator(".fit-grid > .ui-tile").first();
  await first.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".fit-grid > .ui-tile").nth(1)).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator(".fit-grid > .ui-tile").nth(5)).toBeFocused();
  // Enter tries it on (a button), focus stays on it after the screen refreshes.
  await page.keyboard.press("Enter");
  await expect(page.locator(".fit-grid > .ui-tile").nth(5)).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator(".fit-grid > .ui-tile").nth(5)).toBeFocused();
  // Hold to compare with the keyboard: Space held shows the original.
  const compare = page.locator("[data-preview-compare]");
  await expect(compare).toBeEnabled({ timeout: 60_000 });
  await compare.focus();
  await page.keyboard.down(" ");
  await expect(compare).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.up(" ");
  await expect(compare).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("Escape");
  await expect(page.locator(".fit-room")).toHaveCount(0);
  await expect(rail).toBeFocused();
  expect(errors).toEqual([]);
});

test("Low graphics: a still fighter, no live rig, and Hold to compare still works", async ({
  page,
}, info) => {
  await page.addInitScript(() => localStorage.setItem("ea-graphics", "low"));
  await shopServer(page);
  const errors = await openLobby(page);
  await page.click('.lobby-rail [data-lobby-action="shop"]');
  const stage = page.locator(".fit-stage .shop-live-stage");
  await expect(stage).toHaveClass(/is-still/);
  await expect(page.locator(".fit-room")).toHaveAttribute(
    "data-graphics",
    "low",
  );
  await page.waitForTimeout(1500);
  await expect(stage.locator("canvas")).toHaveCount(0);
  await expect(page.locator("[data-fit-play]")).toHaveCount(0);
  const compare = page.locator("[data-preview-compare]");
  const shown = stage.locator(".shop-preview-fallback").first();
  const original = stage.locator(".fit-original");
  await expect(original).toBeHidden();
  const b = await box(page, "[data-preview-compare]");
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await expect(original).toBeVisible();
  await expect(shown).toBeHidden();
  await page.mouse.up();
  await expect(original).toBeHidden();
  // No blur behind the screen on Low.
  expect(
    await page
      .locator(".ui-split-main")
      .evaluate((e) => getComputedStyle(e).backdropFilter),
  ).toBe("none");
  await snap(page, info, "fitting-room-low-graphics");
  expect(errors).toEqual([]);
});

test("reduced motion: the screen and its tiles don't animate", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await shopServer(page);
  const errors = await openLobby(page);
  await page.click('.lobby-rail [data-lobby-action="shop"]');
  await expect(page.locator(".fit-room")).toBeVisible();
  const moving = await page.evaluate(
    () =>
      Array.from(
        document.querySelectorAll<HTMLElement>(".fit-room, .fit-room *"),
      )
        .map((e) => getComputedStyle(e))
        .filter(
          (s) =>
            s.animationName !== "none" ||
            s.transitionDuration.split(",").some((d) => parseFloat(d) > 0),
        ).length,
  );
  expect(moving).toBe(0);
  expect(errors).toEqual([]);
});

test("opening another screen from the rail replaces the fitting room", async ({
  page,
}) => {
  await shopServer(page);
  const errors = await openLobby(page);
  await page.click('.lobby-rail [data-lobby-action="shop"]');
  await expect(page.locator(".fit-room")).toBeVisible();
  // Shop ⇄ Wardrobe from the rail switches in place.
  await page.click('.lobby-rail [data-lobby-action="wardrobe"]');
  await expect(page.locator(".fit-room")).toHaveAttribute(
    "data-fit-mode",
    "wardrobe",
  );
  await expect(page.locator(".fit-room")).toHaveCount(1);
  await page.click('.lobby-rail [data-lobby-action="missions"]');
  await expect(page.locator(".fit-room")).toHaveCount(0);
  await expect(page.locator("#dialog .missions-screen")).toBeVisible();
  expect(errors).toEqual([]);
});

test("a late answer can't reopen a closed Shop over another screen", async ({
  page,
}) => {
  await exposeAccount(page);
  await shopServer(page);
  const errors = await openLobby(page);
  await page.evaluate(() => {
    const w = window as any;
    w.__shop.delay = true;
    w.__pendingShop = w.__account.showShop();
  });
  await page.waitForFunction(() => !!(window as any).__shop.release);
  await page.locator(".fit-room .ui-close").click();
  await page.evaluate(() => void (window as any).__account.showFriends());
  await expect(page.locator(".friends-screen")).toBeVisible();
  await page.evaluate(async () => {
    const w = window as any;
    w.__shop.release();
    await w.__pendingShop;
  });
  await expect(page.locator(".friends-screen")).toBeVisible();
  await expect(page.locator(".fit-room")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("a slow first load can't undo a purchase that finished before it", async ({
  page,
}) => {
  await shopServer(page, { balance: 2340, cost: 1200 });
  const errors = await openLobby(page);
  // The Shop's own load of your coins hangs (it was read before the buy).
  await page.evaluate(() => ((window as any).__shop.delay = true));
  await page.click('.lobby-rail [data-lobby-action="shop"]');
  await page.waitForFunction(() => !!(window as any).__shop.release);
  await page.click(".fit-deal");
  await page.click("[data-fit-buy]");
  await page.locator("[data-ui-confirm] [data-fit-wear]").uncheck();
  await page.click("[data-ui-confirm-ok]");
  await expect(page.locator("#account-coins")).toContainText("1,140");
  await expect(
    page.locator('[data-fit-equip="cindrake-blue-flame"]'),
  ).toBeVisible();
  // Now the old answer arrives: it must not put the coins or Buy back.
  await page.evaluate(() => (window as any).__shop.release());
  await page.waitForTimeout(800);
  await expect(page.locator("#account-coins")).toContainText("1,140");
  await expect(
    page.locator('[data-fit-equip="cindrake-blue-flame"]'),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
