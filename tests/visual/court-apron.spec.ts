import { expect, test } from "@playwright/test";
import { openTown, openTownMenu, pushUntilBattle, snap } from "./helpers";

for(const size of [{width:844,height:390},{width:844,height:280}]) {
  test(`mobile camera reveals themed foreground at the lower court edge ${size.height}`,async({browser},info)=>{
    const context=await browser.newContext({viewport:size,isMobile:true,hasTouch:true,deviceScaleFactor:2});
    try {
      const page=await context.newPage();
      await page.route(/\/apps\/client\/src\/main\.ts(?:\?|$)/,async(route)=>{
        const response=await route.fetch();
        await route.fulfill({response,body:(await response.text()).replace(
          "gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);",
          "window.__edgeGame=gameInstance;gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);",
        )});
      });
      const errors=await openTown(page);
      await page.evaluate(()=> (window as any).__room("pvp",{mode:"duel",phase:"playing",arena:"classic",pos:[800,882,1300,300]}));
      await openTownMenu(page);await page.click(".town-play");await page.click("#play-create");
      await pushUntilBattle(page);
      for(const arena of ["classic","tide-pools","ember-forge","shifting-ruins"]){
        await page.evaluate((arena)=>{
          const w=window as any; w.__snap.arena=arena;w.__snap.remaining=95;
          const me=w.__snap.players.find((p:any)=>p.id==="me");Object.assign(me,{x:800,y:882,vx:0,vy:0,angle:Math.PI/2});
          w.__push();
        },arena);
        await expect.poll(()=>page.evaluate(()=>
          (window as any).__edgeGame.scene.getScene("arena").activeCourt
        )).toBe(arena);
        await expect.poll(()=>page.evaluate(()=>{
          const s=(window as any).__edgeGame.scene.getScene("arena");
          return s.cameras.main.worldView.bottom;
        })).toBeGreaterThan(990);
        const geometry=await page.evaluate(()=>{
          const s=(window as any).__edgeGame.scene.getScene("arena"),c=s.cameras.main;
          return {bottom:c.worldView.bottom,aprons:[...s.courtAprons].filter(([,i]:any)=>i.visible).map(([id,i]:any)=>({id,y:i.y,height:i.displayHeight})),zoom:c.zoomX===c.zoomY};
        });
        expect(geometry.bottom).toBeLessThanOrEqual(996.1);
        expect(geometry.aprons).toEqual([{id:arena,y:900,height:96}]);
        expect(geometry.zoom).toBe(true);
        await snap(page,info,`court-bottom-${arena}-${size.height}`);
      }
      // A different mode must hide all the cached foreground strips.
      expect(await page.evaluate(()=>{
        const w=window as any,s=w.__edgeGame.scene.getScene("arena");
        s.showArena("classic",true);
        return [...s.courtAprons.values()].some((i:any)=>i.visible);
      })).toBe(false);
      expect(errors).toEqual([]);
    } finally {await context.close();}
  });
}
