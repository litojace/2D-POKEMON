import { expect, it } from "vitest";
import { Arena } from "../../apps/server/src/simulation";
import { blankInput, CHARACTERS, EX, FIGHTER_IDS, type CharacterId } from "../../packages/shared/src/index";

function duel(character:CharacterId="voltkit") {
  const arena=new Arena("BUFFER");
  const p=arena.add("one","One",character);
  arena.add("two","Two","tidefin");
  arena.start();arena.phase="playing";arena.deadline=180;
  let seq=0;
  const send=(input:Partial<ReturnType<typeof blankInput>>={})=>arena.submit(p,{...blankInput(),seq:++seq,aimX:1300,aimY:450,...input});
  return {arena,p,send};
}

it.each(FIGHTER_IDS)("%s keeps a skill tapped during Basic recovery, prioritizes it, then resumes held Basic",(character)=>{
  const {arena,p,send}=duel(character);
  send({basic:true});arena.tick();
  expect(p.basicAt).toBeGreaterThan(arena.time);
  send({basic:true,skill:0});arena.tick();
  expect(p.stats.skills).toBe(0);
  for(let i=0;i<5;i++){send({basic:true});arena.tick();}
  expect(p.stats.skills).toBe(1);
  expect(p.cooldowns[0]).toBeGreaterThan(arena.time);
  const basicAt=p.basicAt;
  for(let i=0;i<90;i++){send({basic:true});arena.tick();}
  expect(p.stats.skills).toBe(1);
  expect(p.basicAt).toBeGreaterThan(basicAt);
});

it("keeps only the latest tapped skill and never repeats it while Basic is held",()=>{
  const {arena,p,send}=duel();
  p.recoveryUntil=arena.time+0.12;
  send({skill:0,basic:true});arena.tick();
  send({skill:1,basic:true});arena.tick();
  for(let i=0;i<12;i++){send({basic:true});arena.tick();}
  expect(p.cooldowns[0]).toBe(0);
  expect(p.cooldowns[1]).toBeGreaterThan(arena.time);
  expect(p.stats.skills).toBe(1);
});

it("does not queue an unavailable skill or starve Basic behind a long recovery",()=>{
  const {arena,p,send}=duel();
  p.cooldowns[0]=10;
  send({skill:0,basic:true});arena.tick();
  expect(p.basicAt).toBeGreaterThan(arena.time);
  p.cooldowns[0]=0;p.recoveryUntil=arena.time+0.8;
  send({skill:0});arena.tick();
  for(let i=0;i<30;i++){send({basic:true});arena.tick();}
  expect(p.stats.skills).toBe(0);
});

it("drops an expired buffered skill rather than firing it after a longer interruption",()=>{
  const {arena,p,send}=duel();
  p.recoveryUntil=arena.time+0.12;
  send({skill:0});arena.tick();
  p.recoveryUntil=arena.time+0.5;
  for(let i=0;i<20;i++){send();arena.tick();}
  expect(p.stats.skills).toBe(0);
});

for(const interruption of ["stun","down","paused","round"] as const)
  it(`clears the buffered skill on ${interruption}`,()=>{
    const {arena,p,send}=duel();
    p.recoveryUntil=arena.time+0.12;
    send({skill:0});arena.tick();
    if(interruption==="stun")arena.status(p,"stun",0.06);
    if(interruption==="down")p.hp=0;
    if(interruption==="paused")arena.phase="paused";
    if(interruption==="round")arena.resetRound();
    arena.tick();
    arena.phase="playing";p.hp=CHARACTERS[p.character].health;p.statuses=[];p.recoveryUntil=0;
    for(let i=0;i<8;i++){send();arena.tick();}
    expect(p.stats.skills).toBe(0);
  });

it("spends EX only when the buffered cast actually fires, once",()=>{
  const {arena,p,send}=duel();
  p.ult=80;p.recoveryUntil=arena.time+0.12;
  send({skill:0,ex:true,basic:true});arena.tick();
  expect(p.ult).toBeGreaterThanOrEqual(80);
  for(let i=0;i<6;i++){send({basic:true});arena.tick();}
  expect(p.stats.skills).toBe(1);
  expect(p.ult).toBeCloseTo(80-EX.cost+arena.time*0.6,4);
});

it("Dash and Jump respond immediately while a skill waits behind Basic recovery",()=>{
  const {arena,p,send}=duel();
  p.recoveryUntil=arena.time+0.12;
  send({basic:true,skill:0,dash:true,jump:true,dx:1});arena.tick();
  expect(p.dashUntil).toBeGreaterThan(arena.time);
  expect(p.jumpUntil).toBeGreaterThan(arena.time);
  expect(p.stats.skills).toBe(0);
  for(let i=0;i<5;i++){send({basic:true,dx:1});arena.tick();}
  expect(p.stats.skills).toBe(1);
});

for(const reason of ["paused","prison"] as const)
  it(`raid ${reason} cancels a pending skill rather than firing it on recovery`,async()=>{
    const {createRaidArena}=await import("../../apps/server/src/raid-bosses");
    const arena=createRaidArena("BUFFER", "tidewyrm");
    const p=arena.add("one","One","voltkit");
    arena.start();arena.phase="playing";
    p.recoveryUntil=arena.time+0.12;
    arena.submit(p,{...blankInput(),seq:1,skill:0});arena.tick();
    if(reason==="paused")arena.phase="paused";
    else arena.raid.prisons=[{playerId:p.id,x:p.x,y:p.y,hits:0,presses:0,until:arena.time+5,startedAt:arena.time}];
    arena.tick();
    arena.phase="playing";arena.raid.prisons=[];p.recoveryUntil=0;
    for(let seq=2;seq<10;seq++){arena.submit(p,{...blankInput(),seq});arena.tick();}
    expect(p.stats.skills).toBe(0);
  });
