import { expect, test, type Page } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { openHub, snap, box, inside } from "./helpers";

test.describe.configure({ mode: "parallel" });

async function fixtures(page: Page) {
  // The fitting room's live rig needs High graphics (Low shows a still
  // fighter, UI remodel step 2); openHub pins High.
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

// Render the actual effect stylesheet alone: frames shine by rarity with
// still light only (owner, 18 Nov 2026). Nothing moves, and the halo grows
// brighter from Rare to Legendary, with Mythic in every colour.
test("frame rarity light is still and brighter with rarity", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 640, height: 640 });
  const effectCSS = await readFile("apps/client/src/cosmetic-fx.css", "utf8");
  await page.setContent(
    `<style>${effectCSS}</style><style>body{margin:0;background:#000}.raid-cosmetic-preview{position:relative;display:block;width:200px;height:200px;margin:140px;overflow:visible;border-radius:50%}.disc{position:absolute;inset:0;border-radius:50%;background:#123;z-index:1}</style><div class="raid-cosmetic-preview" data-tier="common"><i class="disc"></i><i class="tier-glow"></i><i class="tier-fx"></i></div>`,
  );
  const frame = page.locator(".raid-cosmetic-preview");
  // Brightness of the halo a sixth of a portrait outside the rim.
  const halo = async () => {
    const shot = await page.screenshot({
      clip: { x: 140 + 100 - 2, y: 140 - 34, width: 4, height: 4 },
    });
    return page.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext("2d")!;
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
      return sum / (d.length / 4);
    }, shot.toString("base64"));
  };
  expect(await halo()).toBe(0);
  const seen: number[] = [];
  for (const tier of ["rare", "epic", "legendary", "mythic"]) {
    await frame.evaluate((el, t) => el.setAttribute("data-tier", t), tier);
    await expect(page.locator(".tier-glow")).toBeVisible();
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    seen.push(await halo());
    const directory = process.env.VISUAL_SHOTS;
    if (directory) await mkdir(directory, { recursive: true });
    const bytes = await frame.screenshot({
      ...(directory ? { path: `${directory}/frame-light-${tier}.png` } : {}),
    });
    await info.attach(`frame-light-${tier}`, {
      body: bytes,
      contentType: "image/png",
    });
  }
  expect(seen[0]).toBeGreaterThan(0);
  expect(seen[1]).toBeGreaterThan(seen[0]);
  expect(seen[2]).toBeGreaterThan(seen[1]);
  expect(seen[3]).toBeGreaterThan(seen[0]);
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
      await expect(header.locator(".tier-glow")).toBeVisible();
      await expect(header.locator(".tier-orbit, .tier-rays")).toHaveCount(0);
      await snap(page, info, `real-frame-halo-${size.width}x${size.height}`);
      // The fitting room (UI remodel step 2).
      await page.evaluate(() => {
        (window as any).__chooseReview("tidefin");
        void (window as any).__account.showShop("skins");
      });
      await page.click(".fit-room [data-ui-item=tidefin-bubblegum]");
      const stage = page.locator(".fit-stage .shop-live-stage");
      await expect(stage).toHaveClass(/is-ready/);
      await snap(page, info, `normal-preview-${size.width}x${size.height}`);
      await expect(stage).not.toHaveAttribute("aria-busy", "true");
      const normal = await box(page, ".fit-stage .shop-live-stage");
      await page.click("[data-ui-section=mythic]");
      await page.click(".fit-room [data-ui-item=tidefin-moontide]");
      // The stage keeps its size whatever stage of a Mythical it shows.
      for (const n of [1, 2, 3]) {
        await page.click(`[data-fit-awaken="${n}"]`);
        await expect(stage).not.toHaveAttribute("aria-busy", "true");
        await expect(stage).toHaveAttribute("data-preview-stage", String(n));
        const current = await box(page, ".fit-stage .shop-live-stage");
        expect(Math.abs(current.height - normal.height)).toBeLessThan(1);
        expect(Math.abs(current.width - normal.width)).toBeLessThan(1);
      }
      await expect(page.locator(".fit-awaken button")).toHaveText([
        "I",
        "II",
        "III",
      ]);
      // Every awakening control is on the stage, and the action in its bar.
      for (const n of [1, 2, 3])
        expect(
          inside(
            await box(page, `[data-fit-awaken="${n}"]`),
            await box(page, ".fit-stage"),
          ),
        ).toBe(true);
      // Phones keep only the stage's tools; the note is there on desktop.
      if (size.height <= 500)
        await expect(page.locator(".fit-awaken-note")).toBeHidden();
      else
        await expect(page.locator(".fit-awaken-note")).toContainText(
          "All stages unlocked for testing.",
        );
      await snap(page, info, `compact-mythical-${size.width}x${size.height}`);
      // A phone's Mythic Hall shows one fighter at a time: pick Cindrake.
      const cindrake = page.locator(".fit-body [data-fit-fighter=cindrake]");
      if (await cindrake.count()) await cindrake.click();
      await page.click(".fit-room [data-ui-item=cindrake-sunforged]");
      await expect(stage).not.toHaveAttribute("aria-busy", "true");
      // Short of coins: Earn coins beside a disabled Buy, in the action bar.
      await expect(page.locator("[data-fit-missions]")).toBeVisible();
      await expect(
        page.locator("[data-fit-buy=cindrake-sunforged]"),
      ).toBeDisabled();
      expect(
        inside(
          await box(page, "[data-fit-missions]"),
          await box(page, ".ui-panel-foot"),
        ),
      ).toBe(true);
      expect(
        Math.abs(
          (await box(page, ".fit-stage .shop-live-stage")).height -
            normal.height,
        ),
      ).toBeLessThan(1);
      await snap(
        page,
        info,
        `compact-mythical-purchase-${size.width}x${size.height}`,
      );
      // Effects are tried on the worn skin (Tidefin wears Abyssal Reaver, Stage III).
      const tidefin = page.locator(".fit-body [data-fit-fighter=tidefin]");
      if (await tidefin.count()) await tidefin.click();
      await page.click(".fit-room [data-ui-item=tidefin-moontide]");
      await page.click("[data-ui-section=collections]");
      await page.click("[data-fit-collection=galaxy]");
      for (const suffix of ["entrance", "victory", "aura"]) {
        await page.click(`.fit-room [data-ui-item=galaxy-${suffix}]`);
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
              ".fit-stage .shop-live-stage > canvas",
            );
            for (let i = 0; i < 75; i++) w.__reviewScene.update(0, 50);
          });
          expect(
            await page.evaluate(
              (f) => (window as any).__reviewPose.pose[f],
              flag,
            ),
          ).toBe(false);
          await page.click(`.fit-room [data-ui-item=galaxy-${suffix}]`);
          await expect
            .poll(() =>
              page.evaluate((f) => (window as any).__reviewPose?.pose[f], flag),
            )
            .toBe(true);
          expect(
            await page.evaluate(
              () =>
                (window as any).__heldCanvas ===
                document.querySelector(".fit-stage .shop-live-stage > canvas"),
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
        await page.click(`[data-fit-collection=${collection}]`);
        await page.click(`.fit-room [data-ui-item=${collection}-frame]`);
        // Your avatar in the frame, as everyone sees you; not the fighter.
        await expect(
          stage.locator(".portrait-disc img.portrait-avatar"),
        ).toHaveCount(1);
        await expect(
          stage.locator(".portrait-disc svg[data-fighter]"),
        ).toHaveCount(0);
        await expect(stage.locator(":scope > canvas")).toHaveCount(0);
        // The tile shows the whole ring, round, with its edge inside.
        const art = page.locator(
          `.fit-room [data-ui-item=${collection}-frame] .ui-tile-art`,
        );
        const outer = await art.boundingBox();
        const ring = await art.locator(".raid-cosmetic-preview").boundingBox();
        expect(Math.abs(ring!.width - ring!.height)).toBeLessThan(1);
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
