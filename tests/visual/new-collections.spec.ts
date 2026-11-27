import { expect, test, type Page } from "@playwright/test";
import { openHub, snap } from "./helpers";
import { ISLAND, setInsets } from "./ui-measure";
import { exposeAccount, shopServer } from "./shop-server";
import { CHARACTERS } from "@arena/shared";
import { LOOK_ITEMS } from "../../packages/shared/src/shop";

// The collections added from 25 Nov 2026 (docs/shop-new-items.md).
// Skins: each champion's skin previews on the Shop's stage and can be
// bought. Every champion at one phone size; three of them at the other
// review sizes. `NEW_COLLECTIONS_ALL=1` runs all eighteen at every size, to
// look them over (with VISUAL_SHOTS).
// Look sets: every piece has a drawn tile in Collections, and plays (or, a
// frame, shows) on the stage when chosen. Singles, the pieces sold outside
// any set, the same, from their own chip.
const COLLECTIONS = [
  "starlight-idol",
  "birthstone",
  "rainy-day",
  "grand-prix",
  "sun-dynasty",
];
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
const SINGLES = LOOK_ITEMS.filter((i) => i.collection === "singles");
const ids = Object.keys(CHARACTERS);
/**
 * How wide the Rainbow's green band (0x5fdc7a) spreads across a picture, as
 * a share of its width: an arch spans it, a stray green speck doesn't.
 */
const greenSpan = (page: Page, png: Buffer) =>
  page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let min = Infinity,
      max = -Infinity;
    for (let i = 0; i < d.length; i += 4) {
      const [r, g, b] = [d[i], d[i + 1], d[i + 2]];
      if (
        Math.abs(r - 95) < 40 &&
        Math.abs(g - 220) < 40 &&
        Math.abs(b - 122) < 45
      ) {
        const x = (i / 4) % c.width;
        min = Math.min(min, x);
        max = Math.max(max, x);
      }
    }
    return max > min ? (max - min) / c.width : 0;
  }, png.toString("base64"));

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

for (const size of SIZES.filter(
  (s) => s.all || !s.phone || process.env.NEW_COLLECTIONS_ALL,
))
  test(`the single pieces draw in Collections and play on the stage at ${size.name}`, async ({
    browser,
  }, info) => {
    test.setTimeout(240_000);
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.phone,
      hasTouch: size.phone,
    });
    try {
      const page = await context.newPage();
      await exposeAccount(page);
      await shopServer(page, {
        balance: 90000,
        cost: 900,
        cleared: ["voltkit"],
      });
      const errors = await openHub(page);
      if (size.island) await setInsets(page, ISLAND);
      const stage = page.locator(".fit-stage .shop-live-stage");
      await page.evaluate(
        () => void (window as any).__account.showShop("skins"),
      );
      await page.click("[data-ui-section=collections]");
      const chip = page.locator("[data-fit-collection=singles]");
      await chip.scrollIntoViewIfNeeded();
      await chip.click();
      await expect(page.locator(".fit-room")).toContainText(
        "Pieces sold on their own",
      );
      expect(SINGLES).toHaveLength(14);
      for (const item of SINGLES) {
        const tile = page.locator(`.fit-room [data-ui-item="${item.id}"]`);
        await tile.scrollIntoViewIfNeeded();
        await tile.click();
        await expect(page.locator(`[data-fit-buy="${item.id}"]`)).toBeVisible();
        if (item.slot === "frame") {
          await expect(stage).toHaveClass(/is-item/);
        } else {
          await expect(stage).toHaveClass(/is-ready/);
          // Mid-effect: an entrance or a finale is under way, an aura turns.
          await page.waitForTimeout(item.slot === "victory" ? 1500 : 450);
          const a = await stage.screenshot();
          await page.waitForTimeout(400);
          expect((await stage.screenshot()).equals(a), item.id).toBe(false);
        }
        if (item.id === "rainbow-entrance") {
          // The arch (DRAWN_ENTRANCES): its green band spans the tile's
          // picture (0.45 of the whole tile), and most of the stage (a
          // phone's narrow stage cuts its feet).
          expect(
            await greenSpan(page, await tile.screenshot()),
          ).toBeGreaterThan(0.35);
          // The stage shows the arch for only about a second and a half of
          // its 4.4 s cycle, and its clock runs slower than real time on a
          // slow renderer (CI's): sampling it at random missed every arch
          // for 10 s there. So each try replays the entrance (clicking the
          // tile again restarts the stage at 0) and looks a second in,
          // when the arch has grown and not yet rolled up (ARCH in
          // collection-fx.ts: grown by 0.34 s, rolls up from 1.45 s).
          await expect
            .poll(
              async () => {
                await tile.click();
                await page.waitForTimeout(1000);
                return greenSpan(page, await stage.screenshot());
              },
              { timeout: 30_000, intervals: [0] },
            )
            .toBeGreaterThan(0.6);
        }
        await snap(page, info, `${item.id}-${size.name}`);
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
