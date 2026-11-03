import { expect, test } from "@playwright/test";
import { openHub, pushUntilBattle, snap, openPlayPanel } from "./helpers";

for (const size of [{width:844,height:390},{width:932,height:430},{width:844,height:280}]) {
  test(`approved mobile combat arc fits ${size.width}x${size.height}`, async ({browser},info) => {
    const context = await browser.newContext({viewport:size,isMobile:true,hasTouch:true,deviceScaleFactor:2});
    try {
      const page = await context.newPage();
      const errors = await openHub(page);
      await page.evaluate(() => (window as any).__room("pvp",{mode:"ffa",phase:"playing"}));
      await openPlayPanel(page);
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
      // One even ring: every neighbour pair, and every button to the basic
      // attack, has the same gap (within a pixel).
      const pairs: [string,string][] = [["0","1"],["1","2"],["2","3"],["3","dash"],["dash","jump"],
        ...["0","1","2","3","dash","jump"].map((id) => [id,"attack"] as [string,string])];
      const gaps = pairs.map(([a,b]) => gap(a,b));
      expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThanOrEqual(1);
      expect(Math.min(...gaps)).toBeGreaterThanOrEqual(8);
      expect(targets.attack.r).toBeGreaterThan(targets["0"].r*1.4);
      expect(targets["3"].r).toBeGreaterThan(targets["0"].r);
      // The ultimate stays clear of the target picker above it.
      const picker = await page.locator("#target-picker").boundingBox();
      if (picker) expect(targets["3"].y - targets["3"].r).toBeGreaterThanOrEqual(picker.y + picker.height + 8);
      for (const [id,t] of Object.entries(targets)) {
        expect(t.r*2).toBeGreaterThanOrEqual(44);
        expect(t.x-t.r).toBeGreaterThanOrEqual(0);
        expect(t.y-t.r).toBeGreaterThanOrEqual(0);
        expect(t.x+t.r).toBeLessThanOrEqual(size.width);
        expect(t.y+t.r).toBeLessThanOrEqual(size.height);
        for (const other of Object.keys(targets)) if (id!==other) expect(gap(id,other)).toBeGreaterThan(3);
      }
      expect(targets.dash.r).toBeGreaterThanOrEqual(24);
      expect(Math.abs(targets.dash.r-targets.jump.r)).toBeLessThanOrEqual(0.5); // Jump as big as Dash
      const ult = page.locator('.touch-ultimate');
      // The art is the label: no 1–3 / BASIC / ULT text over skill art.
      await expect(page.locator('.touch-buttons :is(.touch-skill,.touch-attack,.touch-ultimate) .touch-key')).toHaveCount(0);
      await expect(page.locator('.touch-buttons [data-action="dash"] .touch-key')).toHaveText("DASH");
      await expect(ult.locator('.skill-icon')).toBeVisible();
      await expect(ult.locator('.touch-cooldown')).toHaveText("72%");
      // The charge is a small pill on the bottom edge, not over the middle.
      const [ub, pill] = [await ult.boundingBox(), await ult.locator('.touch-cooldown').boundingBox()];
      expect(pill!.y).toBeGreaterThan(ub!.y + ub!.height * 0.6);
      expect(pill!.height).toBeLessThanOrEqual(16);
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
