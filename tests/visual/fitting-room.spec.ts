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
      // The stage light (owner's option C) is there from the first frame,
      // the same layer under the still fighter and the live rig, and in the
      // still fighter's frame, so its disc sits under the feet.
      const light = await page.evaluate(() => {
        const host = document.querySelector(".fit-stage .shop-live-stage")!;
        const svg = host.querySelector(":scope > .stage-light");
        const still = host.querySelector(".shop-preview-fallback > svg");
        return {
          shown: !!svg && getComputedStyle(svg).display !== "none",
          same: svg?.getAttribute("viewBox") === still?.getAttribute("viewBox"),
        };
      });
      expect(light).toEqual({ shown: true, same: true });
      // Inside the Lobby: the HUD and the rail stay; the rail marks the Shop.
      await expect(page.locator("#account-coins")).toBeVisible();
      await expect(
        page.locator('.lobby-rail [data-lobby-action="shop"]'),
      ).toHaveAttribute("aria-current", "page");
      // Opens on your fighter in the look you wear: nothing tried on, so no
      // "Your look" (owner, 5 Nov 2026: the Shop put today's deal on).
      const live = page.locator(".fit-stage .shop-live-stage");
      await expect(live).toHaveAttribute("data-preview-champion", "voltkit");
      await expect(page.locator('.fit-deal[aria-pressed="true"]')).toHaveCount(
        0,
      );
      await expect(page.locator(".fit-stage [data-fit-revert]")).toHaveCount(0);
      // A tap puts today's deal on the stage, Buy bottom right.
      await page.click(".fit-deal");
      await expect(live).toHaveAttribute(
        "data-preview-skin",
        "cindrake-blue-flame",
      );
      await expect(page.locator(".fit-stage [data-fit-revert]")).toBeVisible();
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
      // "Your look" takes it off: your own fighter, as you wear it.
      await page.click(".fit-stage [data-fit-revert]");
      await expect(live).toHaveAttribute("data-preview-champion", "voltkit");
      await expect(page.locator(".fit-stage [data-fit-revert]")).toHaveCount(0);
      await page.click(".fit-deal");

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
      await expect(page.locator(".fit-grid [data-ui-item]")).toHaveCount(3); // original, Midnight, Storm Revenant
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

test("Colors are bought for the fighter you dress, and worn on it only", async ({
  page,
}, info) => {
  // Migration 073: Shop Colors bought on their own are one champion's.
  await shopServer(page, { balance: 2340, cost: 300 });
  const errors = await openLobby(page);
  await page.click("#account-coins");
  await expect(page.locator(".fit-room")).toBeVisible();
  const champion = (await page
    .locator(".fit-stage .shop-live-stage")
    .getAttribute("data-preview-champion"))!;
  const other = champion === "cindrake" ? "voltkit" : "cindrake";
  const name = (id: string) => id[0].toUpperCase() + id.slice(1);
  await page.click('[data-ui-section="collections"]');
  await page.click('[data-fit-collection="candy"]');
  await page.click('[data-ui-item="candy-colours"]');
  await page.click("[data-fit-buy]");
  const modal = page.locator(".ui-modal");
  await expect(modal).toContainText(`For ${name(champion)} only`);
  await expect(modal).toContainText("buy them again for another fighter");
  await page.click("[data-ui-confirm-ok]");
  await expect(page.locator("#toast")).toContainText(
    `are ${name(champion)}'s, and you're wearing them`,
  );
  expect(await calls(page)).toEqual([
    ["buy", "candy-colours", champion],
    ["colours", { champion, item: "candy-colours" }],
  ]);
  await snap(page, info, "fitting-room-colours-bought");
  // The Wardrobe: this fighter has them; another fighter doesn't.
  await page.click('.lobby-rail [data-lobby-action="wardrobe"]');
  await expect(page.locator(".fit-room")).toHaveAttribute(
    "data-fit-mode",
    "wardrobe",
  );
  await page.click(`[data-fit-fighter="${champion}"]`);
  await page.click('[data-fit-slot="skin"]');
  await expect(page.locator('[data-ui-item="candy-colours"]')).toBeVisible();
  await page.click(`[data-fit-fighter="${other}"]`);
  await page.click('[data-fit-slot="skin"]');
  await expect(page.locator('[data-ui-item="candy-colours"]')).toHaveCount(0);
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
  // Low graphics draws the same stage light (gradients, no blur).
  await expect(stage.locator(":scope > .stage-light")).toBeVisible();
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
  await expect(page.locator(".missions-sheet")).toBeVisible();
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
  await expect(page.locator(".friends-sheet")).toBeVisible();
  await page.evaluate(async () => {
    const w = window as any;
    w.__shop.release();
    await w.__pendingShop;
  });
  await expect(page.locator(".friends-sheet")).toBeVisible();
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

// The rail icon of the open screen lights up (aria-current: a gold rim),
// and a second tap on it closes the screen; it used to reopen it.
test("the open screen's rail icon lights up, and a second tap on it closes the screen", async ({
  page,
}) => {
  await shopServer(page);
  const errors = await openLobby(page);
  const rim = (action: string) =>
    page
      .locator(`.lobby-rail [data-lobby-action="${action}"]`)
      .evaluate((b) => getComputedStyle(b).borderTopColor);
  const wardrobe = page.locator('.lobby-rail [data-lobby-action="wardrobe"]');
  await wardrobe.click();
  await expect(page.locator(".fit-room")).toBeVisible();
  await expect(wardrobe).toHaveAttribute("aria-current", "page");
  // Off the button, so its hover rim (gold too) can't stand in for it.
  await page.mouse.move(700, 450);
  // Once its 0.15 s border transition has run.
  await expect.poll(() => rim("wardrobe")).toBe("rgb(255, 214, 91)");
  expect(await rim("shop")).not.toBe("rgb(255, 214, 91)");
  await wardrobe.click();
  await expect(page.locator(".fit-room")).toHaveCount(0);
  await expect(wardrobe).not.toHaveAttribute("aria-current", "page");
  // A sheet too.
  const missions = page.locator('.lobby-rail [data-lobby-action="missions"]');
  await missions.click();
  await expect(page.locator(".missions-sheet")).toBeVisible();
  await expect(missions).toHaveAttribute("aria-current", "page");
  await missions.click();
  await expect(page.locator(".missions-sheet")).toHaveCount(0);
  // And it opens again on the next tap.
  await missions.click();
  await expect(page.locator(".missions-sheet")).toBeVisible();
  expect(errors).toEqual([]);
});

// The stage's buttons: a Mythical's three Awakening stages sit together on
// a phone (they were 16px apart down half the stage), and on desktop the
// stacked Entrance / Victory / Your look buttons start their icons and
// labels on one line (each was centred by its own label's length).
for (const size of [SIZES[0], SIZES[2]])
  test(`the stage's buttons line up at ${size.name}`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.phone,
      hasTouch: size.phone,
    });
    try {
      const page = await context.newPage();
      const errors = await openLobby(page);
      await page.click('.lobby-rail [data-lobby-action="wardrobe"]');
      await expect(page.locator(".fit-awaken .ui-btn")).toHaveCount(3);
      const stages = await page
        .locator(".fit-awaken .ui-btn")
        .evaluateAll((els) =>
          els.map((e) => {
            const r = e.getBoundingClientRect();
            return { x: r.left, y: r.top, w: r.width, h: r.height };
          }),
        );
      for (let i = 1; i < stages.length; i++) {
        const a = stages[i - 1],
          b = stages[i];
        const gap = size.phone
          ? Math.abs(b.y - a.y) - a.h
          : Math.abs(b.x - a.x) - a.w;
        expect(gap, "between two stages").toBeLessThanOrEqual(8);
      }
      if (size.phone) {
        // Round icon buttons: each icon in the middle of its circle (the
        // -3px nudge for an icon beside a label pulled them 1.5px left).
        const centres = await page
          .locator(".fit-plays .ui-btn")
          .evaluateAll((els) =>
            els.map((b) => {
              const r = b.getBoundingClientRect(),
                s = b.querySelector("svg")!.getBoundingClientRect();
              return {
                dx: s.left + s.width / 2 - (r.left + r.width / 2),
                dy: s.top + s.height / 2 - (r.top + r.height / 2),
                // Its CSS size: the panel still grows in (scale .985).
                w: getComputedStyle(b.querySelector("svg")!).width,
              };
            }),
          );
        expect(centres.length).toBeGreaterThanOrEqual(2);
        for (const c of centres) {
          expect(Math.abs(c.dx), "icon centred across").toBeLessThan(0.5);
          expect(Math.abs(c.dy), "icon centred down").toBeLessThan(0.5);
          expect(c.w, "icon size").toBe("18px");
        }
      }
      if (!size.phone) {
        // Try something on, so Your look joins the column.
        await page
          .locator(".fit-room .ui-tile")
          .filter({ hasText: "Midnight" })
          .first()
          .click();
        await expect(
          page.locator(".fit-plays [data-fit-revert]"),
        ).toBeVisible();
        const lines = await page
          .locator(".fit-plays .ui-btn")
          .evaluateAll((els) =>
            els.map((e) => [
              Math.round(e.querySelector("svg")!.getBoundingClientRect().left),
              Math.round(e.querySelector("span")!.getBoundingClientRect().left),
            ]),
          );
        expect(lines.length).toBe(3);
        expect(new Set(lines.map((l) => l[0])).size, "icons").toBe(1);
        expect(new Set(lines.map((l) => l[1])).size, "labels").toBe(1);
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
