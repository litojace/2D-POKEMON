import { expect, test, type Page } from "@playwright/test";
import {
  openHub,
  openPlaza,
  openPlayPanel,
  createRoom,
  pushUntilBattle,
  snap,
} from "./helpers";
import { exposeAccount, shopServer } from "./shop-server";
async function instrument(page: Page) {
  await page.route(/\/skins\/epic-skin-fx\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch(),
      body = await response.text();
    const pattern = /export function drawEpicSkinFx\(ctx, skin, art\) \{/;
    expect(body).toMatch(pattern);
    await route.fulfill({
      response,
      body: body.replace(
        pattern,
        `$&
   window.__epicSeen??={};
   window.__epicSeen[skin]={ambient:ctx.ambient,defeated:ctx.defeated,count:epicSignatureFrame(skin,{now:ctx.now,facing:ctx.facing??'down',moving:ctx.moving,dashing:ctx.dashing,ambient:ctx.ambient},art).length};
  `,
      ),
    });
  });
  await page.route(/\/skins\/epic-canvas-fx\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch(),
      body = await response.text();
    const pattern =
      /export function drawEpicCanvasFx\(g, marks, pose, plane\) \{/;
    expect(body).toMatch(pattern);
    await route.fulfill({
      response,
      body: body.replace(
        pattern,
        `$&
    window.__plazaEpic={full:pose.full,essential:marks.filter(m=>m.essential).length,extra:marks.filter(m=>!m.essential).length,plane};
  `,
      ),
    });
  });
}
for (const size of [
  { width: 1440, height: 900 },
  { width: 844, height: 390 },
]) {
  test(`personal Epic signatures render in the real fitting room at ${size.width}`, async ({
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
      await instrument(page);
      await exposeAccount(page);
      await shopServer(page, {
        cleared: ["voltkit", "tidefin", "mystowl", "sunbara"],
      });
      const errors = await openHub(page);
      await page.evaluate(
        () => void (window as any).__account.showShop("skins"),
      );
      for (const [champion, skin] of [
        ["voltkit", "neon-arcade"],
        ["voltkit", "arc-unit"],
        ["voltkit", "abyssal-expedition"],
        ["voltkit", "dream-carnival"],
        ["voltkit", "nova-vanguard"],
        ["tidefin", "glacier"],
        ["mystowl", "clockwork"],
        ["sunbara", "sunflower"],
      ]) {
        const id = `${champion}-${skin}`;
        await page.click(`.fit-room [data-fit-fighter="${champion}"]`);
        await page.click(`.fit-room [data-ui-item="${id}"]`);
        await expect(page.locator(".fit-stage .shop-live-stage")).toHaveClass(
          /is-ready/,
        );
        await expect
          .poll(() =>
            page.evaluate(
              (id) => (window as any).__epicSeen?.[id]?.count ?? 0,
              id,
            ),
          )
          .toBeGreaterThan(0);
        await snap(page, info, `epic-signature-${id}-${size.width}`);
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
for (const low of [false, true]) {
  test(`Epic effects render in Town at ${low ? "Low" : "High"} graphics`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: { width: 844, height: 390 },
      isMobile: true,
      hasTouch: true,
    });
    try {
      const page = await context.newPage();
      await page.addInitScript((low) => {
        localStorage.setItem("ea-graphics", low ? "low" : "high");
        // The local Town look now comes from the saved wardrobe, so a late
        // server profile cannot erase it while that profile is loading.
        (window as any).__economyPatch = {
          looks: { voltkit: { skin: "voltkit-neon-arcade", stage: 1 } },
        };
      }, low);
      await instrument(page);
      const errors = await openPlaza(page);
      expect(
        await page.evaluate(() => (window as any).__plaza.P.skin?.skin),
      ).toBe("voltkit-neon-arcade");
      await expect
        .poll(() =>
          page.evaluate(() => (window as any).__plazaEpic?.essential ?? 0),
        )
        .toBeGreaterThan(0);
      const fx = await page.evaluate(() => (window as any).__plazaEpic);
      expect(fx.full).toBe(!low);
      expect(fx.extra > 0).toBe(!low);
      await snap(page, info, `epic-town-${low ? "low" : "high"}`);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
test("a battle at Low retains the personal Epic signature", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await page.addInitScript(() => {
      localStorage.setItem("ea-graphics", "low");
      localStorage.setItem("ea-battle-quality", "low");
    });
    await instrument(page);
    const errors = await openHub(page);
    await page.evaluate(() =>
      (window as any).__room("pvp", { mode: "duel", phase: "playing" }),
    );
    await openPlayPanel(page);
    await createRoom(page);
    await pushUntilBattle(page);
    await page.evaluate(() => {
      const a = (window as any).__snap;
      const p = a.players.find((p: any) => p.id === "me") ?? a.players[0];
      p.character = "voltkit";
      p.championLooks = { voltkit: { skin: "voltkit-neon-arcade", stage: 1 } };
      (window as any).__push();
    });
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as any).__epicSeen?.["voltkit-neon-arcade"]?.count ?? 0,
        ),
      )
      .toBeGreaterThan(0);
    expect(
      await page.evaluate(
        () => (window as any).__epicSeen["voltkit-neon-arcade"].ambient,
      ),
    ).toBe(false);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
