/**
 * The website's Shop showcase (docs/website.md): the game's own Shop, at two
 * device pixels, with a Legendary and Mythical skins, a victory effect and
 * the Shop's front page. Each item is tried on in the fitting room and its
 * stage captured (as tests/visual/shop-spotlight.spec.ts opens it).
 * Writes site-clips/shop/<name>.png; apps/site/tools/make-scenes.py crops them.
 */
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { openHub } from "../../tests/visual/helpers";
import { exposeAccount, shopServer } from "../../tests/visual/shop-server";

const OUT = "site-clips/shop";
/** name: the fighter, the Shop tab, the item tried on. */
const ITEMS: [name: string, champion: string, section: string, item: string][] =
  [
    ["legendary", "pyranda", "skins", "pyranda-nova-vanguard"],
    ["hellforge", "cindrake", "skins", "cindrake-sunforged"],
    ["reaver", "tidefin", "skins", "tidefin-moontide"],
    ["victory", "voltkit", "collections", "borealis-victory"],
  ];

async function open(page: Page, champion: string) {
  await exposeAccount(page);
  await shopServer(page, { balance: 2340, cost: 500 });
  await openHub(page);
  await page.evaluate((c) => {
    (window as any).__choose(c);
    void (window as any).__account.showShop("skins");
  }, champion);
  await expect(page.locator(".fit-stage .shop-live-stage")).toHaveClass(
    /is-ready/,
  );
}

for (const [name, champion, section, item] of ITEMS)
  test(`shop ${name}`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 2,
    });
    try {
      const page = await context.newPage();
      await open(page, champion);
      if (section !== "skins") {
        await page.click(`[data-ui-section=${section}]`);
        // A set's pieces show once its collection is picked (galaxy-aura: galaxy).
        await page.click(`[data-fit-collection=${item.split("-")[0]}]`);
      }
      await page.click(`.fit-room [data-ui-item="${item}"]`);
      mkdirSync(OUT, { recursive: true });
      // The picture is the stage alone: no Entrance / Victory / Your look buttons.
      await page.addStyleTag({
        content: ".fit-plays { visibility: hidden !important; }",
      });
      // Let the try-on settle, then catch its effect over a few seconds
      // (an effect blooms and fades): make-scenes.py keeps the busiest.
      await page.waitForTimeout(1200);
      const takes = section === "skins" ? 1 : 10;
      for (let i = 0; i < takes; i++) {
        await page.locator(".fit-stage").screenshot({
          path: `${OUT}/${name}${takes > 1 ? `-${i}` : ""}.png`,
        });
        await page.waitForTimeout(350);
      }
    } finally {
      await context.close();
    }
  });

test("shop front page", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  });
  try {
    const page = await context.newPage();
    await open(page, "cindrake");
    await page.click("[data-ui-section=today]");
    await page.waitForTimeout(2500);
    mkdirSync(OUT, { recursive: true });
    await page.locator(".fit-room").screenshot({ path: `${OUT}/front.png` });
  } finally {
    await context.close();
  }
});
