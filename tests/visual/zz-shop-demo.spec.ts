import { expect, test } from "@playwright/test";
import { openHub } from "./helpers";
import { exposeAccount, shopServer } from "./shop-server";

const OUT = process.env.DEMO_OUT!;
const VARIANT = process.env.DEMO_VARIANT ?? "now";
const sizes = [
  { width: 844, height: 390, inset: null },
  { width: 667, height: 375, inset: null },
  {
    width: 852,
    height: 393,
    inset: { left: 59, right: 59, bottom: 21, top: 0 },
  },
  { width: 1440, height: 900, inset: null },
];
for (const size of sizes) {
  test(`demo ${VARIANT} ${size.width}x${size.height}`, async ({ browser }) => {
    const phone = size.width < 1000;
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: phone,
      hasTouch: phone,
    });
    const page = await context.newPage();
    await page.addInitScript(
      (v) => ((window as any).__fitSortDemo = v),
      VARIANT,
    );
    await exposeAccount(page);
    await shopServer(page, { balance: 2340, cost: 500 });
    await openHub(page);
    if (size.inset)
      await page.evaluate((inset) => {
        for (const [k, v] of Object.entries(inset))
          document.documentElement.style.setProperty(`--safe-${k}`, `${v}px`);
      }, size.inset);
    await page.evaluate(() => {
      (window as any).__choose("pyranda");
      void (window as any).__account.showShop("skins");
    });
    const tile = '.fit-room [data-ui-item="pyranda-nova-vanguard"]';
    await page.click(tile);
    const stage = page.locator(".fit-stage .shop-live-stage");
    await expect(stage).toHaveClass(/is-ready/);
    await expect(page.locator(".fit-stage")).toHaveAttribute(
      "data-rarity",
      "legendary",
    );
    await page.evaluate(() => {
      document.querySelector("[data-fit-region=body]")!.scrollTop = 0;
    });
    await page.waitForTimeout(800);
    const name = `${VARIANT}-${size.width}x${size.height}${size.inset ? "-island" : ""}`;
    await page.screenshot({
      path: `${OUT}/${name}.png`,
      animations: "disabled",
    });
    // A second shot with the order flipped, to show the other state.
    const sort = page.locator("[data-fit-sort]").first();
    if (await sort.count()) {
      await page.locator('[data-fit-sort="price"]').first().click();
      await page.evaluate(() => {
        document.querySelector("[data-fit-region=body]")!.scrollTop = 0;
      });
      await page.waitForTimeout(400);
      await page.screenshot({
        path: `${OUT}/${name}-cheap.png`,
        animations: "disabled",
      });
    }
    const m = await page.evaluate(() => {
      const r = (s: string) =>
        document.querySelector(s)?.getBoundingClientRect();
      const st = r(".fit-stage")!,
        rays = r(".fit-stage .stage-light-rays");
      return {
        stageTop: st.top,
        stageH: st.height,
        raysTop: rays?.top,
        raysBottom: rays?.bottom,
        filters: r(".fit-filters"),
        vw: innerWidth,
      };
    });
    console.log(name, JSON.stringify(m));
    console.log(
      await page.evaluate(() => {
        const h = document.querySelector(".fit-stage .shop-live-stage")!;
        const hb = h.getBoundingClientRect();
        return JSON.stringify([
          hb.top,
          hb.height,
          ...[...h.children].map((c) => {
            const b = c.getBoundingClientRect();
            return [
              c.tagName,
              c.className.baseVal ?? c.className,
              b.top,
              b.height,
              getComputedStyle(c).visibility,
            ];
          }),
        ]);
      }),
    );
    await context.close();
  });
}
