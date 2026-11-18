import { expect, test } from "@playwright/test";
import { openHub, snap } from "./helpers";
import { exposeAccount, shopServer } from "./shop-server";

for (const size of [
  { width: 1440, height: 900 },
  { width: 844, height: 390 },
]) {
  test(`new Rare/Epic costumes preview and equip in Shop and Wardrobe at ${size.width}x${size.height}`, async ({
    browser,
  }, info) => {
    test.setTimeout(180000);
    const context = await browser.newContext({
      viewport: size,
      isMobile: size.width < 1000,
      hasTouch: size.width < 1000,
    });
    try {
      const page = await context.newPage();
      await exposeAccount(page);
      await shopServer(page, {
        balance: 20000,
        cost: 3500,
        cleared: ["voltkit", "cindrake", "auralynx", "terradon"],
      });
      const errors = await openHub(page);
      const stage = page.locator(".fit-stage .shop-live-stage");
      await page.evaluate(
        () => void (window as any).__account.showShop("skins"),
      );
      for (const [champion, collection] of [
        ["voltkit", "wayfarer"],
        ["cindrake", "moonlit-tea"],
        ["auralynx", "astral-court"],
        ["tidefin", "abyssal-expedition"],
        ["terradon", "hon-viet"],
        ["auralynx", "nova-vanguard"],
      ]) {
        await page.click(`.fit-room [data-fit-fighter="${champion}"]`);
        const skin = `${champion}-${collection}`;
        await page.click(`.fit-room [data-ui-item="${skin}"]`);
        await expect(stage).toHaveAttribute("data-preview-skin", skin);
        await expect(stage).toHaveClass(/is-ready/);
        await expect(stage).not.toHaveAttribute("aria-busy", "true");
        await expect(stage.locator(":scope > canvas")).toBeVisible();
        await expect(page.locator(`[data-fit-buy="${skin}"]`)).toBeVisible();
        await snap(page, info, `fashion-${collection}-${size.width}`);
      }
      await page.click('[data-fit-buy="auralynx-nova-vanguard"]');
      await page.click("[data-ui-confirm-ok]");
      await expect
        .poll(() => page.evaluate(() => (window as any).__shop.calls))
        .toContainEqual(["buy", "auralynx-nova-vanguard"]);
      await expect
        .poll(() =>
          page.evaluate(() =>
            (window as any).__shop.calls.some(
              ([action, body]: [string, any]) =>
                action === "equip" && body.skin === "auralynx-nova-vanguard",
            ),
          ),
        )
        .toBe(true);
      await page.click('[data-ui-mode="wardrobe"]');
      await expect(page.locator(".fit-room")).toHaveAttribute(
        "data-fit-mode",
        "wardrobe",
      );
      await expect(stage).toHaveAttribute(
        "data-preview-skin",
        "auralynx-nova-vanguard",
      );
      await expect(stage).toHaveClass(/is-ready/);
      await snap(page, info, `fashion-wardrobe-${size.width}`);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
