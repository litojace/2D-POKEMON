import { expect, test } from "@playwright/test";
import { openTown, openTownMenu, pushUntilBattle, snap } from "./helpers";

for (const size of [{width:844,height:390},{width:932,height:430},{width:844,height:280}]) {
  test(`approved mobile combat arc fits ${size.width}x${size.height}`, async ({browser},info) => {
    const context = await browser.newContext({viewport:size,isMobile:true,hasTouch:true,deviceScaleFactor:2});
    try {
      const page = await context.newPage();
      const errors = await openTown(page);
      await page.evaluate(() => (window as any).__room("pvp",{mode:"ffa",phase:"playing"}));
      await openTownMenu(page);
      await page.click(".town-play");
      await page.click("#play-create");
      await pushUntilBattle(page);
      await page.evaluate(() => {
        const w = window as any;
        w.__snap.remaining = 95;
        w.__snap.players.find((p: any) => p.id === "me").ult = 72;
        w.__push();
      });
      const targets = await page.locator("#mobile-controls .touch-buttons button").evaluateAll((buttons) => Object.fromEntries(buttons.map((button) => {
        const r = button.getBoundingClientRect();
        const el = button as HTMLElement;
        return [el.dataset.skill ?? el.dataset.action, {x:r.x+r.width/2,y:r.y+r.height/2,r:r.width/2}];
      })));
      const gap = (a:string,b:string) => Math.hypot(targets[a].x-targets[b].x,targets[a].y-targets[b].y)-targets[a].r-targets[b].r;
      expect(gap("0","1")).toBeCloseTo(gap("1","2"),1);
      expect(gap("0","attack")).toBeCloseTo(gap("1","attack"),1);
      expect(gap("1","attack")).toBeCloseTo(gap("2","attack"),1);
      expect(targets["3"].y).toBeLessThan(targets["2"].y-25);
      expect(targets.attack.r).toBeGreaterThan(targets["0"].r*1.4);
      for (const [id,t] of Object.entries(targets)) {
        expect(t.r*2).toBeGreaterThanOrEqual(44);
        expect(t.x-t.r).toBeGreaterThanOrEqual(0);
        expect(t.y-t.r).toBeGreaterThanOrEqual(0);
        expect(t.x+t.r).toBeLessThanOrEqual(size.width);
        expect(t.y+t.r).toBeLessThanOrEqual(size.height);
        for (const other of Object.keys(targets)) if (id!==other) expect(gap(id,other)).toBeGreaterThan(3);
      }
      const ult = page.locator('.touch-ultimate');
      await expect(ult.locator('.touch-key')).toHaveText("ULT");
      await expect(ult.locator('.touch-cooldown')).toHaveText("72%");
      if(size.height===390) {
        expect(targets["0"].r*2).toBeCloseTo(59.84,1);
        expect(targets.attack.r*2).toBeCloseTo(91.52,1);
      }
      await snap(page,info,`mobile-combat-live-${size.width}x${size.height}`);
      await ult.tap();
      await expect.poll(async () => {
        await page.evaluate(() => (window as any).__push());
        return ult.locator('.touch-cooldown').textContent();
      }).toBe("EX ✓");
      expect(errors).toEqual([]);
    } finally { await context.close(); }
  });
}
