import { expect, test } from "@playwright/test";
import { openTown, openTownMenu, snap } from "./helpers";

for (const viewport of [{width:844,height:390},{width:844,height:280},{width:1440,height:900},{width:414,height:896}]) {
  test(`lower boss selections preserve avatar rail and scroll ${viewport.width}x${viewport.height}`,async({browser},info)=>{
    const mobile=viewport.width>viewport.height && viewport.width<1000;
    const context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile});
    try {
      const page=await context.newPage();
      const errors=await openTown(page);
      await page.evaluate(()=>{
        const fetch=window.fetch.bind(window);
        window.fetch=async(input,init)=>String(input).includes("/api/raids") ? new Response(JSON.stringify({clears:10,highestPeril:3,totalClears:35,bestSeconds:60,bosses:Object.fromEntries(["grumblecrag","tidewyrm","gloomshade","somnara","prismatail","emberwing","storm-twins"].map(id=>[id,{clears:5,highestPeril:2,bestSeconds:90}])),titles:[],cosmetics:[],weekly:[],earned:[],loadout:{}}),{headers:{"Content-Type":"application/json"}}) : fetch(input,init);
      });
      await openTownMenu(page);await page.click('[data-action="raids"]');
      await expect(page.locator(".raid-roster-card")).toHaveCount(7);
      await page.locator("#dialog").evaluate(async(el)=>{
        await document.fonts.ready;
        await Promise.all(el.getAnimations({subtree:true}).filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));
      });
      await page.locator(".raid-boss-roster").evaluate((rail)=>{
        const w=window as any;
        w.__rail=rail;w.__railCards=[...rail.children];w.__railImages=[...rail.querySelectorAll("img")];w.__railDetached=false;
        w.__railObserver=new MutationObserver((entries)=>{
          if(entries.some(e=>[...e.removedNodes].includes(rail)))w.__railDetached=true;
        });
        w.__railObserver.observe(rail.parentElement!,{childList:true});
        rail.scrollTop=rail.scrollHeight;rail.scrollLeft=rail.scrollWidth;
      });
      for(const boss of ["storm-twins","emberwing","prismatail","storm-twins"]){
        const button=page.locator(`.raid-roster-card[data-raid-boss="${boss}"]`);
        await button.scrollIntoViewIfNeeded();
        const before=await page.locator(".raid-boss-roster").evaluate(el=>({top:el.scrollTop,left:el.scrollLeft,y:el.getBoundingClientRect().y,height:el.clientHeight}));
        await button.click();
        await expect(button).toHaveAttribute("aria-pressed","true");
        await expect(page.locator(".raid-roster-card.is-selected")).toHaveCount(1);
        await expect.poll(()=>page.locator(".raid-boss-roster").evaluate((rail)=>{
          const w=window as any;
          return rail===w.__rail && !w.__railDetached && [...rail.children].every((c,i)=>c===w.__railCards[i]) && [...rail.querySelectorAll("img")].every((c,i)=>c===w.__railImages[i]);
        })).toBe(true);
        await page.waitForTimeout(150);
        const after=await page.locator(".raid-boss-roster").evaluate(el=>({top:el.scrollTop,left:el.scrollLeft,y:el.getBoundingClientRect().y,height:el.clientHeight}));
        expect(after).toEqual(before);
        expect(await button.evaluate(el=>document.activeElement===el)).toBe(true);
      }
      const before=await page.locator(".raid-boss-roster").evaluate(el=>({top:el.scrollTop,left:el.scrollLeft}));
      await page.locator('#raid-tab-rewards').click();
      await expect(page.locator('.raid-reward-identity h2')).toHaveText('Storm Twins');
      await page.locator('#raid-tab-overview').click();
      expect(await page.locator(".raid-boss-roster").evaluate(el=>({top:el.scrollTop,left:el.scrollLeft}))).toEqual(before);
      expect(await page.evaluate(()=>(window as any).__railDetached)).toBe(false);
      expect(await page.locator('#dialog').evaluate(el=>el.scrollTop)).toBe(0);
      await snap(page,info,`raid-roster-stable-${viewport.width}x${viewport.height}`);
      await page.click('#close-dialog');
      await page.evaluate(()=>document.getElementById('settings')!.click());
      await expect(page.locator('.settings-screen')).toBeVisible();
      await expect(page.locator('.raid-boss-roster')).toHaveCount(0);
      expect(errors).toEqual([]);
    }finally{await context.close();}
  });
}
