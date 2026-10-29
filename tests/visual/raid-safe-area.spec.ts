import { test, expect } from "@playwright/test";
import { raidAttacksOf, type RaidBossId } from "../../packages/shared/src/raid";
import { openTown, openTownMenu, pushUntilBattle, snap } from "./helpers";
const bosses=["grumblecrag","tidewyrm","gloomshade","somnara","prismatail","emberwing","storm-twins"];
for(const viewport of [{width:844,height:390},{width:1280,height:589},{width:844,height:280},{width:1440,height:900}]) {
 test(`raid HUD, revival and scenery fit safe areas at ${viewport.width}x${viewport.height}`,async({browser},info)=>{
  test.setTimeout(120000);
  const mobile=viewport.width<1400;
  const context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile});
  try {
   const page=await context.newPage(),errors=await openTown(page);
   if(mobile)await page.evaluate(()=>{
    for(const [key,value] of Object.entries({left:44,right:44,bottom:21,top:0}))document.documentElement.style.setProperty(`--safe-${key}`,`${value}px`);
   });
   await page.evaluate(()=>(window as any).__room("raid",{boss:"tidewyrm"}));
   await openTownMenu(page);await page.click('.town-play');await page.click('#play-create');await pushUntilBattle(page);
   const inspect=()=>page.locator('#battle').evaluate((battle)=>{
    const rect=(el:Element)=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
    const hud=battle.querySelector('#raid-hud')!,gear=battle.querySelector('#battle-menu')!,frame=battle.querySelector('.arena-frame')!,game=battle.querySelector('#game')!;
    return{hud:rect(hud),gear:rect(gear),frame:rect(frame),game:rect(game),bars:[...hud.querySelectorAll('.raid-twin-track, .raid-boss-health')].filter(el=>getComputedStyle(el).display!=='none').map(rect),cue:rect(hud.querySelector('.raid-callout')!),meta:rect(hud.querySelector('.raid-boss-heading > span')!)};
   });
   for(const boss of bosses){
    await page.evaluate((boss)=>{
     const w=window as any;w.__room("raid",{boss});w.__snap.raid.drill=boss==='storm-twins'?'twin-rush':null;
     const friend=w.__snap.players.find((p:any)=>p.id==='p2');
     w.__snap.players.push({...friend,id:'p3',name:'A very long teammate name',x:700},{...friend,id:'p4',name:'Fourth raider',x:900});
     w.__raidBasePlayers=w.__snap.players;
     w.__push();
    },boss);
    await expect(page.locator('.raid-boss-heading > b')).toContainText(boss==='storm-twins'?'STORM TWINS':boss==='grumblecrag'?'GRUMBLECRAG':boss.toUpperCase());
    await expect.poll(async()=>{const g=await inspect();return g.hud.right<=g.gear.x+1}).toBe(true);
    const g=await inspect();
    if(mobile){expect(g.game.x).toBeCloseTo(0,0);expect(g.game.y).toBeCloseTo(0,0);expect(g.game.width).toBeCloseTo(viewport.width,0);expect(g.game.height).toBeCloseTo(viewport.height,0);expect(g.hud.x).toBeGreaterThanOrEqual(44);expect(g.hud.right).toBeLessThanOrEqual(viewport.width-44);}
    for(const bar of [...g.bars,g.cue,g.meta]){expect(bar.x).toBeGreaterThanOrEqual(g.hud.x-1);expect(bar.right).toBeLessThanOrEqual(g.hud.right+1);}
    for(const self of [true,false]){
     await page.evaluate(({self,cause})=>{const w=window as any,s=w.__snap;s.players=self?w.__raidBasePlayers.filter((p:any)=>p.raidBoss||p.id==='me'):w.__raidBasePlayers;const me=s.players.find((p:any)=>p.id==='me');me.hp=0;s.raid.partySize=self?1:4;s.raid.downed[me.id]={progress:.42,self,cause};w.__push();},{self,cause:raidAttacksOf(boss as RaidBossId)[0]});
     const banner=page.locator('#spectate');await expect(banner).toBeVisible();
     const r=await banner.boundingBox();expect(r!.x).toBeGreaterThanOrEqual(mobile?44:0);expect(r!.x+r!.width).toBeLessThanOrEqual(viewport.width-(mobile?44:0));expect(r!.height).toBeLessThanOrEqual(116);
     expect(await banner.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
     await expect(banner.getByRole('progressbar',{name:'Revive progress'})).toHaveAttribute('aria-valuenow','42');
    }
    if(boss==='tidewyrm'||boss==='storm-twins')await snap(page,info,`raid-safe-${boss}-${viewport.width}x${viewport.height}`);
    await page.evaluate(()=>{const w=window as any,me=w.__snap.players.find((p:any)=>p.id==='me');me.hp=138;delete w.__snap.raid.downed[me.id];w.__push();});
    await expect(page.locator('#spectate')).toBeHidden();
   }
   if(viewport.width===844 && viewport.height===390){
    await page.evaluate(()=>{const w=window as any,s=w.__snap;s.players.find((p:any)=>p.id==='me').hp=0;s.raid.downed.me={progress:.42,self:false};w.__push();});
    await expect(page.locator('#spectate')).toBeVisible();
    await page.evaluate(()=>{const w=window as any;w.__snap.phase='paused';w.__push();});
    await expect(page.locator('#spectate')).toBeHidden();
    await expect(page.locator('body')).not.toHaveClass(/raid-downed/);
    await page.evaluate(()=>{const w=window as any,s=w.__snap;s.phase='playing';s.players.find((p:any)=>p.id==='me').hp=138;delete s.raid.downed.me;w.__push();});
    await expect(page.locator('.touch-buttons')).toBeVisible();
    await page.setViewportSize({width:844,height:280});
    await expect.poll(async()=>Math.round((await inspect()).game.height)).toBe(280);
    await page.setViewportSize(viewport);
    await expect.poll(async()=>Math.round((await inspect()).game.height)).toBe(390);
    const g=await inspect();expect(g.hud.right).toBeLessThanOrEqual(g.gear.x);
   }
   expect(errors).toEqual([]);
  }finally{await context.close();}
 });
}
