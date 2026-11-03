import { expect, test, type Page } from "@playwright/test";
import { box, inside, openHub, snap, openPlayPanel } from "./helpers";

async function frameFixtures(page: Page) {
  await page.route(/\/apps\/client\/src\/main\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const marker = 'window.dispatchEvent(new Event("arena:ready"));';
    expect(body).toContain(marker);
    await route.fulfill({
      response,
      body: body.replace(
        marker,
        "window.__account=accountsUI;window.__choosePortrait=(id)=>{selected=id;syncHomePresentation();};" +
          marker,
      ),
    });
  });
  await page.route(/\/fake-api\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: `${await response.text()}
window.__portraitFrame='conqueror';
const previousPortraitFetch=window.fetch.bind(window);
const portraitProgress=()=>({v:1,bosses:{grumblecrag:{clears:40}},stats:{},unlocked:[],cosmetics:['conqueror'],earned:['conqueror'],loadout:{frame:window.__portraitFrame}});
window.fetch=async(input,init)=>{
 const path=new URL(String(input),location.href).pathname;
 if(path==='/api/raids') return Response.json(portraitProgress());
 if(path==='/api/raids/equip') {window.__portraitFrame=JSON.parse(init.body).item;return Response.json({progress:portraitProgress()});}
 if(path==='/api/economy') {const response=await previousPortraitFetch(input,init);const value=await response.json();value.owned.push('galaxy-frame','winter-frame','festival-frame','candy-frame');return Response.json(value);}
 if(path==='/api/friends') return Response.json({code:'ABCDEF12',friends:[{id:'offline',name:'Offline Buddy',online:false,fighter:'tidefin',championLooks:{tidefin:{skin:'tidefin-moontide',stage:3}},look:{frame:'conqueror'},raidClears:{grumblecrag:40},frame:'conqueror'},{id:'online',name:'Online Buddy',online:true,activity:'town',fighter:'lumoth',frame:'winter-frame'}],incoming:[],outgoing:[]});
 return previousPortraitFetch(input,init);
};`,
    });
  });
}

// Native close events are queued; let the previous panel dispose its handlers
// before reusing this dialog for the next screen.
async function closePanel(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const dialog = document.querySelector<HTMLDialogElement>("#dialog")!;
        dialog.addEventListener("close", () => resolve(), { once: true });
        document.querySelector<HTMLButtonElement>("#close-dialog")!.click();
      }),
  );
}

for (const size of [
  { width: 1440, height: 900 },
  { width: 844, height: 390 },
  { width: 844, height: 280 },
]) {
  test(`equipped frames follow header level, wardrobe and friends at ${size.width}x${size.height}`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: size,
      isMobile: size.width < 1000,
      hasTouch: size.width < 1000,
    });
    try {
      const page = await context.newPage();
      await frameFixtures(page);
      const errors = await openHub(page);
      const headerFrame = page.locator(
        "#account-profile [data-portrait-frame]",
      );
      await expect(headerFrame).toHaveAttribute(
        "data-portrait-frame",
        "conqueror",
      );
      await expect(page.locator("#account-profile .nav-level")).toBeVisible();
      const avatar = await box(page, ".account-avatar");
      const name = await box(page, "#account-profile .account-name");
      expect(avatar.x + avatar.width + 6).toBeLessThan(name.x);
      expect(
        inside(await box(page, "#account-profile"), { x: 0, y: 0, ...size }),
      ).toBe(true);
      expect(
        await page
          .locator(".account-avatar")
          .evaluate((el) => getComputedStyle(el).overflow),
      ).toBe("visible");
      await snap(
        page,
        info,
        `portrait-frame-header-${size.width}x${size.height}`,
      );

      await page.evaluate(() => (window as any).__account.showWardrobe());
      await expect(page.locator(".wardrobe")).toBeVisible();
      await page.click('.wardrobe-filters [data-wardrobe-slot="frame"]');
      await page.click('[data-wardrobe-preview="galaxy-frame"]');
      await page.click('[data-wardrobe-save="galaxy-frame"]');
      await expect(headerFrame).toHaveAttribute(
        "data-portrait-frame",
        "galaxy-frame",
      );
      // Equipping reloads the same player's profile (a new generation). A
      // second equip in the same Wardrobe must still save, not say the
      // session changed.
      await page.evaluate(() => (window as any).__account.generation++);
      await page.click('[data-wardrobe-preview="conqueror"]');
      await page.click('[data-wardrobe-save="conqueror"]');
      await expect(headerFrame).toHaveAttribute(
        "data-portrait-frame",
        "conqueror",
      );
      await expect(page.locator(".wardrobe-status")).not.toContainText(
        "session changed",
      );
      await page.click('[data-wardrobe-preview="galaxy-frame"]');
      await page.click('[data-wardrobe-save="galaxy-frame"]');
      await expect(headerFrame).toHaveAttribute(
        "data-portrait-frame",
        "galaxy-frame",
      );
      await closePanel(page);
      await page.evaluate(() => (window as any).__choosePortrait("auralynx"));
      await expect(page.locator(".account-avatar")).toHaveAttribute(
        "data-champion",
        "auralynx",
      );
      await expect(headerFrame).toHaveAttribute(
        "data-portrait-frame",
        "galaxy-frame",
      );
      // An unchanged refresh preserves the existing avatar subtree.
      expect(
        await page.evaluate(() => {
          const root = document.querySelector(".account-avatar")!;
          const child = root.firstElementChild;
          (window as any).__account.syncAvatar();
          return root.firstElementChild === child;
        }),
      ).toBe(true);

      await page.evaluate(() => (window as any).__account.showFriends());
      await expect(
        page.locator(
          '.friend-card[data-friend-row="offline"] [data-portrait-frame]',
        ),
      ).toHaveAttribute("data-portrait-frame", "conqueror");
      await expect(
        page.locator(
          '.friend-card[data-friend-row="online"] [data-portrait-frame]',
        ),
      ).toHaveAttribute("data-portrait-frame", "winter-frame");
      for (const id of ["offline", "online"]) {
        const friendAvatar = page.locator(
          `.friend-card[data-friend-row="${id}"] .friend-avatar`,
        );
        expect(
          await friendAvatar.evaluate((el) => getComputedStyle(el).overflow),
        ).toBe("visible");
      }
      await expect(page.locator(".friend-card").first()).toBeInViewport();
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );
      await snap(
        page,
        info,
        `portrait-frame-friends-${size.width}x${size.height}`,
      );
      await closePanel(page);

      await page.evaluate(() => (window as any).__account.showWardrobe());
      await expect(page.locator(".wardrobe")).toBeVisible();
      await page.click('[data-wardrobe-clear="frame"]');
      await expect(headerFrame).toHaveCount(0);
      await closePanel(page);
      await expect(page.locator("#account-profile .nav-level")).toBeVisible();
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

for (const size of [
  { width: 1440, height: 900 },
  { width: 844, height: 390 },
]) {
  test(`circular wardrobe identity stays consistent in PvP and raid parties at ${size.width}x${size.height}`, async ({
    browser,
  }, info) => {
    test.setTimeout(150000);
    const context = await browser.newContext({
      viewport: size,
      isMobile: size.width < 1000,
      hasTouch: size.width < 1000,
    });
    try {
      const page = await context.newPage();
      await frameFixtures(page);
      const errors = await openHub(page);
      for (const kind of ["pvp", "raid"] as const) {
        await page.evaluate((kind) => {
          const w = window as any;
          w.__room(kind, { mode: "ffa", phase: "lobby", boss: "prismatail" });
          w.__snap.phase = "lobby";
          w.__snap.players = w.__snap.players.filter((p: any) => !p.raidBoss);
          const pal = w.__snap.players.find((p: any) => p.id === "p2");
          pal.character = "duskveil";
          pal.championLooks = {
            duskveil: { skin: "duskveil-eclipse", stage: 3 },
          };
          pal.raidLook = { frame: "conqueror", skin: "candy-colours" };
          pal.raidClears = { grumblecrag: 50 };
        }, kind);
        await openPlayPanel(page);
        await page.click('[data-mode="duel"]');
        await page.click("#play-create");
        await expect
          .poll(async () => {
            await page.evaluate(() => (window as any).__push());
            return page.locator("body").getAttribute("class");
          })
          .toContain("lobby-active");
        const drawer = page.locator(".lobby-room-drawer > summary");
        if (await drawer.isVisible()) await drawer.click();
        const own = page.locator(
          kind === "pvp"
            ? "[data-me] .player-avatar"
            : '[data-raid-player="me"] .raid-party-avatar',
        );
        const others = page.locator(
          kind === "pvp" ? ".player-avatar" : ".raid-party-avatar",
        );
        await expect(
          own.locator('[data-portrait-frame="conqueror"]'),
        ).toHaveAttribute("data-frame-stars", "4");
        await expect(own.locator('[data-fighter="voltkit"]')).toHaveCount(1);
        expect(await own.innerHTML()).toContain("voltkit-stormcrown");
        await expect(page.locator('#menu [data-frame-stars="5"]')).toHaveCount(
          1,
        );
        expect((await others.allTextContents()).join(" ")).toContain("★★★★★");
        expect(
          await others.evaluateAll((els) =>
            els.every(
              (el) =>
                getComputedStyle(el).borderRadius === "50%" &&
                Math.abs(
                  el.getBoundingClientRect().width -
                    el.getBoundingClientRect().height,
                ) < 1 &&
                getComputedStyle(el.querySelector(".portrait-disc")!)
                  .overflow === "hidden",
            ),
          ),
        ).toBe(true);
        await expect(
          others.locator('svg[data-fighter="duskveil"]'),
        ).toHaveCount(1);
        await snap(
          page,
          info,
          `wardrobe-${kind}-circles-${size.width}x${size.height}`,
        );
        // A local Colors change updates every mounted identity immediately.
        await page.evaluate(() => {
          const a = (window as any).__account;
          a.economy.looks = {};
          a.raidLook = { skin: "candy-colours", frame: "conqueror" };
          a.hooks.onChange();
        });
        await expect(
          own.locator('filter[id*="preview-palette-candy-colours"]'),
        ).toHaveCount(1);
        await expect(
          page.locator(
            '.account-avatar filter[id*="preview-palette-candy-colours"]',
          ),
        ).toHaveCount(1);
        const updatedDrawer = page.locator(".lobby-room-drawer");
        if (
          (await updatedDrawer.locator(":scope > summary").isVisible()) &&
          (await updatedDrawer.getAttribute("open")) === null
        )
          await updatedDrawer.locator(":scope > summary").click();
        await page.click("#leave");
        // Raid exits return to the hub; close it to inspect the next room.
        if (await page.locator("dialog[open]").count()) await closePanel(page);
        await expect(page.locator("#lobby-play")).toBeVisible();
        await page.evaluate(() => {
          const a = (window as any).__account;
          a.economy.looks = {
            voltkit: { skin: "voltkit-stormcrown", stage: 2 },
          };
          a.raidLook = { frame: "conqueror" };
          a.hooks.onChange();
        });
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
