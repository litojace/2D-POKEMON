import { expect, test } from "@playwright/test";

import {
  openHub,
  openPlayPanel,
  createRoom,
  pushUntilBattle,
  snap,
} from "./helpers";
import { ISLAND, setInsets } from "./ui-measure";

/*
 * Demo screenshots of the raid rites choice (owner review): the current
 * card and each prototype look (raid-rites-demo.css). Not a layout check:
 * run with VISUAL_SHOTS=<folder> to save the images. RITES_LOOKS picks the
 * looks ("current,a,b,c" by default).
 */
const LOOKS = (process.env.RITES_LOOKS ?? "current,a,b,c").split(",");
const SIZES = [
  { width: 844, height: 390, mobile: true, name: "844x390" },
  { width: 667, height: 375, mobile: true, name: "667x375" },
  { width: 1440, height: 900, mobile: false, name: "1440x900" },
  {
    width: 956,
    height: 440,
    mobile: true,
    name: "956x440-island",
    island: true,
  },
];
const OFFERS = ["shelter", "sharing", "core", "rescue", "courage", "mending"];

for (const look of LOOKS)
  for (const size of SIZES)
    test(`rites demo ${look} at ${size.name}`, async ({ browser }, info) => {
      test.setTimeout(120_000);
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        isMobile: size.mobile,
        hasTouch: size.mobile,
      });
      try {
        const page = await context.newPage();
        if (look !== "current")
          await page.addInitScript((look) => {
            localStorage.setItem("ea-rites-demo", look);
          }, look);
        await openHub(page);
        await page.evaluate(() =>
          (window as any).__room("raid", { boss: "prismatail" }),
        );
        await openPlayPanel(page);
        await createRoom(page);
        await pushUntilBattle(page);
        if (size.island) await setInsets(page, ISLAND);
        await page.evaluate((offers) => {
          const w = window as any,
            s = w.__snap,
            friend = s.players.find((p: any) => p.id === "p2");
          s.players.push({ ...friend, id: "p3", name: "Third raider", x: 700 });
          s.raid.partySize = 3;
          s.raid.phase = 2;
          s.phase = "intermission";
          s.remaining = 12;
          s.raid.offers.me = offers;
          s.raid.rites = { me: [], p2: ["mending"], p3: [] };
          w.__push();
        }, OFFERS);
        await expect(page.locator("[data-raid-rite]")).toHaveCount(6);
        await page.waitForTimeout(600);
        await snap(page, info, `${look}-${size.name}`);
        if (size.name === "844x390") {
          // One rite picked: it stays in place, checked.
          await page.evaluate(() => {
            const w = window as any,
              s = w.__snap;
            s.raid.rites.me = ["courage"];
            s.raid.offers.me = s.raid.offers.me.filter(
              (id: string) => id !== "courage",
            );
            s.remaining = 4;
            w.__push();
          });
          await expect(
            page.locator('[data-raid-rite="courage"].is-picked'),
          ).toHaveCount(1);
          await page.waitForTimeout(400);
          await snap(page, info, `${look}-${size.name}-one-picked`);
          // Rite details open.
          await page.locator(".raid-rite-more > summary").click();
          await page.waitForTimeout(300);
          await snap(page, info, `${look}-${size.name}-details`);
        }
      } finally {
        await context.close();
      }
    });
