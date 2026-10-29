import { expect, test } from "@playwright/test";
import { openTown, openTownMenu, pushUntilBattle, snap } from "./helpers";

for (const viewport of [{width:844,height:390},{width:1280,height:589},{width:844,height:280},{width:1440,height:900}]) {
  test(`both Storm Twins health bars stay inside the HUD at ${viewport.width}x${viewport.height}`,async({browser},info)=>{
    const mobile=viewport.width<1400;
    const context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile});
    try {
      const page=await context.newPage();
      const errors=await openTown(page);
      await page.evaluate(()=>{
        const w=window as any;w.__room("raid",{boss:"storm-twins"});
        w.__snap.players=w.__snap.players.filter((p:any)=>p.raidBoss || p.id==="me");
        w.__snap.raid.partySize=1;
      });
      await openTownMenu(page);await page.click('.town-play');await page.click('#play-create');await pushUntilBattle(page);
      const geometry=await page.locator('#raid-hud').evaluate((hud)=>{
        const measure=(el:Element)=>{
          const r=el.getBoundingClientRect(),s=getComputedStyle(el);
          return {cls:el.className,x:r.x,right:r.right,y:r.y,bottom:r.bottom,width:r.width,minWidth:s.minWidth,gridArea:s.gridArea,columns:s.gridTemplateColumns,position:s.position};
        };
        return {hud:measure(hud),children:[...hud.children].map(measure),health:[...hud.querySelectorAll('.raid-twin-health,.raid-twin-bar,.raid-twin-track,.raid-twin-bar > div:first-child,.raid-callout,.raid-boss-heading > span')].map(measure),overflow:hud.scrollWidth-hud.clientWidth};
      });
      await snap(page,info,`twins-hud-${viewport.width}x${viewport.height}`);
      expect(geometry.health.filter(r=>String(r.cls)==='raid-twin-track')).toHaveLength(2);
      for(const r of geometry.health){expect(r.x).toBeGreaterThanOrEqual(geometry.hud.x-1);expect(r.right).toBeLessThanOrEqual(geometry.hud.right+1);}
      const tracks=geometry.health.filter(r=>String(r.cls)==='raid-twin-track');
      expect(tracks[0].right).toBeLessThan(tracks[1].x);
      expect(tracks[0].width).toBeCloseTo(tracks[1].width,1);
      const gear=await page.locator('#battle-menu').boundingBox();
      expect(geometry.hud.right).toBeLessThanOrEqual(gear!.x+1);
      expect(geometry.hud.right).toBeLessThanOrEqual(viewport.width);
      // Practice, a downed twin and a full party use the same bounded row.
      await page.evaluate(()=>{
        const w=window as any,s=w.__snap;
        s.raid.drill="twin-rush";
        const hero=s.players.find((p:any)=>p.id==="me");
        for(let i=2;i<=4;i++)s.players.push({...hero,id:`p${i}`,name:`Raider ${i}`});
        s.raid.partySize=4;
        const twin=s.raid.twins[1];
        s.players.find((p:any)=>p.id===twin.id).hp=0;
        twin.reviveAt=s.time+9;
        w.__push();
      });
      await expect(page.locator('#raid-drill')).toBeVisible();
      const bounded=()=>page.locator('#raid-hud').evaluate((hud)=>{
        const h=hud.getBoundingClientRect();
        return [...hud.querySelectorAll('.raid-twin-health,.raid-twin-track,.raid-twin-bar > div:first-child,.raid-callout')].every(el=>{
          const r=el.getBoundingClientRect();return r.x>=h.x-1 && r.right<=h.right+1;
        });
      });
      await expect.poll(bounded).toBe(true);
      await expect(page.locator('.raid-twin-bar').nth(1)).toContainText('REVIVES IN 9s');
      await snap(page,info,`twins-practice-${viewport.width}x${viewport.height}`);
      if(viewport.width===844 && viewport.height===390){
        await page.setViewportSize({width:844,height:280});
        await expect.poll(bounded).toBe(true);
        await page.setViewportSize(viewport);
        await expect.poll(bounded).toBe(true);
      }
      expect(errors).toEqual([]);
    }finally{await context.close();}
  });
}
