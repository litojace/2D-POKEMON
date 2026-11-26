/**
 * The website's Shop spotlight (docs/website.md): the game's own fitting
 * room, each piece tried on and its stage recorded for a few seconds as it
 * plays (the idle, the effect blooming), on a large screen. The stage
 * animates in real time, so each frame's time is written beside it and
 * apps/site/tools/make-shop.py builds a loop with the real timing.
 *
 *   npx playwright test --config scripts/site-clips/playwright.config.ts scripts/site-clips/shop.spec.ts
 *
 * Writes site-clips/shop/<name>/NNN.jpg (the whole page), times.json and
 * box.json (the stage's place on the page, in CSS pixels).
 */
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { openHub } from "../../tests/visual/helpers";
import { exposeAccount, shopServer } from "../../tests/visual/shop-server";

const OUT = "site-clips/shop";
/** How long each piece is recorded, in ms. */
const SPAN = 3600;
/** name: the fighter, the Shop tab, the piece tried on (gen-data's SHOWCASE). */
export const ITEMS: [
  name: string,
  champion: string,
  section: string,
  item: string,
][] = [
  ["cinder-medic", "pyranda", "skins", "pyranda-nova-vanguard"],
  ["storm-corsair", "voltkit", "skins", "voltkit-sky-pirates"],
  ["sun-sovereign", "sunbara", "skins", "sunbara-sun-dynasty"],
  ["hellforge", "cindrake", "skins", "cindrake-sunforged"],
  ["abyssal-reaver", "tidefin", "skins", "tidefin-moontide"],
  ["sky-curtain", "voltkit", "collections", "borealis-victory"],
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
      // A large screen at one device pixel: the screencast sends CSS pixels,
      // so the stage itself is drawn big instead.
      viewport: { width: 1600, height: 1000 },
      deviceScaleFactor: 1,
    });
    try {
      const page = await context.newPage();
      await open(page, champion);
      if (section !== "skins") {
        await page.click(`[data-ui-section=${section}]`);
        // A set's pieces show once its collection is picked (galaxy-aura: galaxy).
        await page.click(`[data-fit-collection=${item.split("-")[0]}]`);
      } else {
        // The piece's collection may be further along the Skins tab.
        await page
          .locator(`.fit-room [data-ui-item="${item}"]`)
          .scrollIntoViewIfNeeded();
      }
      await page.click(`.fit-room [data-ui-item="${item}"]`);
      // The picture is the stage alone: no Entrance / Victory / Your look
      // buttons, no name or price strip.
      await page.addStyleTag({
        content:
          ".fit-plays, .fit-stage-foot, .fit-stage-info { visibility: hidden !important; }",
      });
      await page.waitForTimeout(1200);
      const box = (await page.locator(".fit-stage").boundingBox())!;
      const dir = `${OUT}/${name}`;
      mkdirSync(dir, { recursive: true });
      // Chrome's screencast: every frame the page paints, with its time
      // (a screenshot per frame manages only about three a second).
      const cdp = await context.newCDPSession(page);
      const times: number[] = [];
      let first = 0;
      let f = 0;
      cdp.on("Page.screencastFrame", async (e: any) => {
        const t = e.metadata.timestamp * 1000;
        if (!first) first = t;
        if (t - first <= SPAN) {
          writeFileSync(
            `${dir}/${String(f++).padStart(3, "0")}.jpg`,
            Buffer.from(e.data, "base64"),
          );
          times.push(Math.round(t - first));
        }
        await cdp
          .send("Page.screencastFrameAck", { sessionId: e.sessionId })
          .catch(() => {});
      });
      await cdp.send("Page.startScreencast", {
        format: "jpeg",
        quality: 92,
        everyNthFrame: 1,
        // Device pixels, not CSS pixels: a sharp stage.
        maxWidth: 2560,
        maxHeight: 1600,
      });
      await page.waitForTimeout(SPAN + 600);
      await cdp.send("Page.stopScreencast");
      writeFileSync(`${dir}/box.json`, JSON.stringify(box));
      writeFileSync(`${dir}/times.json`, JSON.stringify(times));
    } finally {
      await context.close();
    }
  });
