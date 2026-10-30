import { expect, test, type Page } from "@playwright/test";
import { box, inside, openTown, snap } from "./helpers";

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
const portraitProgress=()=>({v:1,stats:{},unlocked:[],cosmetics:['conqueror'],earned:['conqueror'],loadout:{frame:window.__portraitFrame}});
window.fetch=async(input,init)=>{
 const path=new URL(String(input),location.href).pathname;
 if(path==='/api/raids') return Response.json(portraitProgress());
 if(path==='/api/raids/equip') {window.__portraitFrame=JSON.parse(init.body).item;return Response.json({progress:portraitProgress()});}
 if(path==='/api/economy') {const response=await previousPortraitFetch(input,init);const value=await response.json();value.owned.push('galaxy-frame','winter-frame','festival-frame','candy-frame');return Response.json(value);}
 if(path==='/api/friends') return Response.json({code:'ABCDEF12',friends:[{id:'offline',name:'Offline Buddy',online:false,frame:'conqueror'},{id:'online',name:'Online Buddy',online:true,activity:'town',fighter:'lumoth',frame:'winter-frame'}],incoming:[],outgoing:[]});
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
      const errors = await openTown(page);
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
