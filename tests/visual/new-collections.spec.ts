import { expect, test } from "@playwright/test";
import { openHub, snap } from "./helpers";
import { ISLAND, setInsets } from "./ui-measure";
import { exposeAccount, shopServer } from "./shop-server";
import { CHARACTERS } from "@arena/shared";

// The collections added from 25 Nov 2026 (docs/shop-new-items.md).
// Skins: each champion's skin previews on the Shop's stage and can be
// bought. Every champion at one phone size; three of them at the other
// review sizes. `NEW_COLLECTIONS_ALL=1` runs all eighteen at every size, to
// look them over (with VISUAL_SHOTS).
// Look sets: every piece has a drawn tile in Collections, and plays (or, a
// frame, shows) on the stage when chosen.
const COLLECTIONS = ["starlight-idol", "birthstone", "rainy-day", "grand-prix"];
const SIZES = [
  { name: "844x390", width: 844, height: 390, phone: true, all: true },
  { name: "667x375", width: 667, height: 375, phone: true },
  {
    name: "852x393-island",
    width: 852,
    height: 393,
    phone: true,
    island: true,
  },
  { name: "1440x900", width: 1440, height: 900, phone: false },
];
const LOOK_SETS = ["seaside", "steamworks", "borealis"];
const ids = Object.keys(CHARACTERS);

for (const collection of COLLECTIONS)
  for (const size of SIZES)
    test(`${collection} skins preview in the Shop at ${size.name}`, async ({
      browser,
    }, info) => {
      test.setTimeout(420_000);
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        isMobile: size.phone,
        hasTouch: size.phone,
      });
      try {
        const page = await context.newPage();
        await exposeAccount(page);
        await shopServer(page, { balance: 90000, cost: 500 });
        const errors = await openHub(page);
        if (size.island) await setInsets(page, ISLAND);
        const stage = page.locator(".fit-stage .shop-live-stage");
        await page.evaluate(
          () => void (window as any).__account.showShop("skins"),
        );
        const champions =
          size.all || process.env.NEW_COLLECTIONS_ALL
            ? ids
            : [ids[0], ids[7], ids[17]];
        for (const champion of champions) {
          await page.click(`.fit-room [data-fit-fighter="${champion}"]`);
          const skin = `${champion}-${collection}`;
          const tile = page.locator(`.fit-room [data-ui-item="${skin}"]`);
          await tile.scrollIntoViewIfNeeded();
          await tile.click();
          await expect(stage).toHaveAttribute("data-preview-skin", skin);
          await expect(stage).toHaveClass(/is-ready/);
          await expect(stage).not.toHaveAttribute("aria-busy", "true");
          await expect(stage.locator(":scope > canvas")).toBeVisible();
          await expect(page.locator(`[data-fit-buy="${skin}"]`)).toBeVisible();
          await snap(page, info, `${skin}-${size.name}`);
        }
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });

for (const size of SIZES.filter((s) => s.all || !s.phone))
  test(`the new Look sets' pieces draw in Collections and play on the stage at ${size.name}`, async ({
    browser,
  }, info) => {
    test.setTimeout(300_000);
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.phone,
      hasTouch: size.phone,
    });
    try {
      const page = await context.newPage();
      await exposeAccount(page);
      // The stage's fighter in its own colours: a worn skin hides Colours.
      await shopServer(page, {
        balance: 90000,
        cost: 900,
        cleared: ["voltkit"],
      });
      const errors = await openHub(page);
      const stage = page.locator(".fit-stage .shop-live-stage");
      await page.evaluate(
        () => void (window as any).__account.showShop("skins"),
      );
      await page.click("[data-ui-section=collections]");
      for (const set of LOOK_SETS) {
        await page.click(`[data-fit-collection=${set}]`);
        for (const piece of ["colours", "aura", "entrance", "victory"]) {
          const id = `${set}-${piece}`;
          const tile = page.locator(`.fit-room [data-ui-item="${id}"]`);
          await tile.scrollIntoViewIfNeeded();
          await tile.click();
          await expect(stage).toHaveClass(/is-ready/);
          await expect(page.locator(`[data-fit-buy="${id}"]`)).toBeVisible();
          // Mid-effect: an entrance or a finale is under way, an aura turns.
          await page.waitForTimeout(piece === "victory" ? 1500 : 450);
          const a = await stage.screenshot();
          if (piece === "aura") {
            await page.waitForTimeout(400);
            expect((await stage.screenshot()).equals(a), id).toBe(false);
          }
          await snap(page, info, `${id}-${size.name}`);
        }
        const frame = `${set}-frame`;
        await page.click(`.fit-room [data-ui-item="${frame}"]`);
        await expect(stage).toHaveClass(/is-item/);
        await expect(page.locator(`[data-fit-buy="${frame}"]`)).toBeVisible();
        await snap(page, info, `${frame}-${size.name}`);
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
