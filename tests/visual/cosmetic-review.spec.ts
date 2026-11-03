import { expect, test, type Page } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { openHub, snap, box, inside } from "./helpers";

test.describe.configure({ mode: "parallel" });

async function fixtures(page: Page) {
  // Town is only the backdrop here. Keep software-rendered scenery cheap;
  // the fitting room still uses its real full-detail rig and live effects.
  await page.addInitScript(() => localStorage.setItem("ea-graphics", "low"));
  await page.route(/\/apps\/client\/src\/main\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()).replace(
        'window.dispatchEvent(new Event("arena:ready"));',
        'window.__account=accountsUI;window.__chooseReview=(id)=>{selected=id;syncHomePresentation();};window.dispatchEvent(new Event("arena:ready"));',
      ),
    });
  });
  await page.route(
    /\/apps\/client\/src\/shop-preview\.ts(?:\?|$)/,
    async (route) => {
      const response = await route.fetch();
      let body = await response.text();
      const marker =
        "rig.render(pose, x, y, clock, 1, paused && motion.matches);";
      expect(body).toContain(marker);
      body = body
        .replace(
          marker,
          `if(placement==='shop') window.__reviewPose={pose,clock};` + marker,
        )
        .replace(
          "scene = this;",
          "scene = this; if(placement==='shop')window.__reviewScene=this;",
        );
      await route.fulfill({ response, body });
    },
  );
  await page.route(/\/fake-api\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: `${await response.text()}
const previousReviewFetch=window.fetch.bind(window);
window.__reviewLooks={tidefin:{skin:'tidefin-moontide',stage:3}};
const reviewEconomy=(body)=>{body.owned.push('tidefin-moontide','galaxy-frame','winter-frame','festival-frame','garden-frame','candy-frame','galaxy-aura','galaxy-entrance','galaxy-victory');body.looks={...body.looks,...window.__reviewLooks};body.mythicTesting=true;return body;};
window.fetch=async(input,init)=>{
 const path=new URL(String(input),location.href).pathname;
 if(path==='/api/raids')return Response.json({v:1,clears:49,bosses:{grumblecrag:{clears:49}},cosmetics:['conqueror'],earned:['conqueror'],loadout:{frame:'conqueror',skin:'candy-colours'}});
 if(path==='/api/shop/equip'){const request=JSON.parse(init.body);window.__reviewLooks[request.champion]={skin:request.skin,stage:request.stage};const response=await previousReviewFetch('/api/economy');return Response.json({economy:reviewEconomy(await response.json())});}
 const response=await previousReviewFetch(input,init);if(path!=='/api/economy')return response;
 return Response.json(reviewEconomy(await response.json()));
};`,
    });
  });
}

// Render the actual effect stylesheet alone so its particle shape can be
// inspected independently of the portrait, ornament and scene underneath.
test("orbit sparks remain round at different angles and frame tiers", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 640, height: 640 });
  const effectCSS = await readFile("apps/client/src/cosmetic-fx.css", "utf8");
  await page.setContent(
    `<style>${effectCSS}</style><style>body{margin:0;background:#000}.raid-cosmetic-preview{position:relative;display:block;width:200px;height:200px;margin:140px;overflow:visible}</style><div class="raid-cosmetic-preview" data-tier="legendary"><i class="tier-orbit" style="animation:none!important"></i></div>`,
  );
  const orbit = page.locator(".tier-orbit");
  await expect(orbit).toBeVisible();
  await expect
    .poll(() => orbit.evaluate((el) => getComputedStyle(el).borderRadius))
    .toBe("0px");
  for (const tier of ["epic", "legendary", "mythic"]) {
    await page
      .locator("[data-tier]")
      .evaluate((el, t) => el.setAttribute("data-tier", t), tier);
    for (const angle of [0, 45]) {
      await orbit.evaluate(
        (el, a) => ((el as HTMLElement).style.transform = `rotate(${a}deg)`),
        angle,
      );
      const directory = process.env.VISUAL_SHOTS;
      if (directory) await mkdir(directory, { recursive: true });
      const bytes = await orbit.screenshot({
        animations: "disabled",
        ...(directory
          ? { path: `${directory}/orbit-${tier}-${angle}.png` }
          : {}),
      });
      await info.attach(`orbit-${tier}-${angle}`, {
        body: bytes,
        contentType: "image/png",
      });
    }
  }
});

for (const size of [
  { width: 1440, height: 900 },
  { width: 1280, height: 589 },
  { width: 844, height: 390 },
  { width: 844, height: 280 },
]) {
  test(`real cosmetic reviews, consistent Mythical stages and fitted Shop frames at ${size.width}x${size.height}`, async ({
    browser,
  }, info) => {
    test.setTimeout(240000);
    const context = await browser.newContext({
      viewport: size,
      isMobile: size.height < 600,
      hasTouch: size.height < 600,
    });
    try {
      const page = await context.newPage();
      await fixtures(page);
      const errors = await openHub(page);
      const header = page.locator(
        "#account-profile [data-portrait-frame=conqueror]",
      );
      await expect(header).toHaveAttribute("data-frame-stars", "4");
      await expect(header.locator(".tier-rays")).toBeVisible();
      await expect(header.locator(".tier-orbit")).toBeVisible();
      await snap(page, info, `real-frame-halo-${size.width}x${size.height}`);
      await page.evaluate(() => {
        (window as any).__chooseReview("tidefin");
        void (window as any).__account.showShop("champions");
      });
      await page.click("[data-shop-preview=tidefin-bubblegum]");
      const stage = page.locator(".shop .shop-live-stage");
      await expect(stage).toHaveClass(/is-ready/);
      await snap(page, info, `normal-preview-${size.width}x${size.height}`);
      await expect(stage).not.toHaveAttribute("aria-busy", "true");
      const normal = await box(page, ".shop .shop-live-stage");
      await page.click("[data-shop-tab=mythic]");
      await page.click("[data-shop-preview=tidefin-moontide]");
      for (const n of [1, 2, 3]) {
        await page.click(`[data-shop-stage="${n}"]`);
        await expect(stage).not.toHaveAttribute("aria-busy", "true");
        await expect(stage).toHaveAttribute("data-preview-stage", String(n));
        const current = await box(page, ".shop .shop-live-stage");
        expect(Math.abs(current.height - normal.height)).toBeLessThan(1);
        expect(Math.abs(current.width - normal.width)).toBeLessThan(1);
      }
      await expect(page.locator(".shop-stages button")).toHaveText([
        "I",
        "II",
        "III",
      ]);
      expect(
        inside(
          await box(page, ".shop-preview-purchase"),
          await box(page, "#dialog"),
        ),
      ).toBe(true);
      if (size.height <= 320) {
        await expect(page.locator(".shop-preview-description")).toBeHidden();
      } else if (size.height <= 600) {
        expect(
          await page
            .locator(".shop-preview-description")
            .evaluate((el) => getComputedStyle(el).webkitLineClamp),
        ).toBe("1");
      }
      await snap(page, info, `compact-mythical-${size.width}x${size.height}`);
      await page.click(".shop-awakening-details > summary");
      await expect(page.locator(".shop-awakening-details > p")).toBeVisible();
      await page.click(".shop-awakening-details > summary");
      await page.click("[data-shop-preview=cindrake-sunforged]");
      await expect(stage).not.toHaveAttribute("aria-busy", "true");
      await expect(
        page.locator(".shop-preview-purchase .shop-earn"),
      ).toBeVisible();
      expect(
        inside(
          await box(page, ".shop-preview-purchase"),
          await box(page, ".shop-preview"),
        ),
      ).toBe(true);
      expect(
        Math.abs(
          (await box(page, ".shop .shop-live-stage")).height - normal.height,
        ),
      ).toBeLessThan(1);
      await snap(
        page,
        info,
        `compact-mythical-purchase-${size.width}x${size.height}`,
      );
      await page.click("[data-shop-preview=tidefin-moontide]");
      await page.click("[data-shop-tab=collections]");
      await page.click("[data-shop-collection=galaxy]");
      for (const suffix of ["entrance", "victory", "aura"]) {
        await page.click(`[data-shop-preview=galaxy-${suffix}]`);
        await expect(stage).toHaveClass(/is-ready/);
        await expect(stage).not.toHaveAttribute("aria-busy", "true");
        await expect(stage.locator(":scope > canvas")).toHaveCount(1);
        await expect(stage).not.toHaveClass(/is-item/);
        await expect(stage).toHaveAttribute(
          "data-preview-skin",
          "tidefin-moontide",
        );
        await expect
          .poll(() =>
            page.evaluate(
              (s) => (window as any).__reviewPose?.pose.look[s],
              suffix,
            ),
          )
          .toBe(`galaxy-${suffix}`);
        expect(
          await page.evaluate(() => (window as any).__reviewPose.pose.skin),
        ).toEqual({ skin: "tidefin-moontide", stage: 3 });
        if (suffix !== "aura") {
          const flag = suffix === "entrance" ? "greet" : "victory";
          await expect
            .poll(() =>
              page.evaluate((f) => (window as any).__reviewPose?.pose[f], flag),
            )
            .toBe(true);
          // Advance the actual rig to the end, then the same click must replay
          // immediately while retaining its canvas and loaded textures.
          await page.evaluate(() => {
            const w = window as any;
            w.__heldCanvas = document.querySelector(
              ".shop-live-stage > canvas",
            );
            for (let i = 0; i < 75; i++) w.__reviewScene.update(0, 50);
          });
          expect(
            await page.evaluate(
              (f) => (window as any).__reviewPose.pose[f],
              flag,
            ),
          ).toBe(false);
          await page.click(`[data-shop-preview=galaxy-${suffix}]`);
          await expect
            .poll(() =>
              page.evaluate((f) => (window as any).__reviewPose?.pose[f], flag),
            )
            .toBe(true);
          expect(
            await page.evaluate(
              () =>
                (window as any).__heldCanvas ===
                document.querySelector(".shop-live-stage > canvas"),
            ),
          ).toBe(true);
        }
      }
      await snap(
        page,
        info,
        `equipped-effect-model-${size.width}x${size.height}`,
      );
      const collections =
        size.height > 600
          ? ["galaxy", "winter", "festival", "garden", "candy"]
          : ["galaxy", "candy"];
      for (const collection of collections) {
        await page.click(`[data-shop-collection=${collection}]`);
        await page.click(`[data-shop-preview=${collection}-frame]`);
        await expect(
          stage.locator(".portrait-disc svg[data-fighter=tidefin]"),
        ).toHaveCount(1);
        await expect(stage.locator(":scope > canvas")).toHaveCount(0);
        const art = page.locator(`[data-shop-preview=${collection}-frame]`);
        const outer = await art.boundingBox();
        const ring = await art.locator(".raid-cosmetic-preview").boundingBox();
        expect(Math.abs(outer!.width - outer!.height)).toBeLessThan(1);
        expect(inside(ring!, outer!)).toBe(true);
        const edge = await art.locator(".tier-fx").boundingBox();
        if (edge) expect(inside(edge, outer!)).toBe(true);
      }
      await snap(
        page,
        info,
        `shop-framed-portrait-${size.width}x${size.height}`,
      );
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
