// Real-time clock: timers follow the wall clock, the farm saves and keeps growing offline, fast mode + reset work.
const { chromium } = require('./pw');
(async () => {
  const b = await chromium.launch(); const errs = []; const ctx = await b.newContext({ viewport: { width: 1340, height: 1000 } });
  const p = await ctx.newPage(); p.on('pageerror', e => { errs.push(e.message); console.log('PAGEERROR', e.message); });
  const url = 'file://' + __dirname + '/preview-t.html';
  await p.goto(url); await p.waitForTimeout(800);
  const clock = await p.evaluate(() => { const d = new Date(); return { h: d.getHours(), m: d.getMinutes(), s: d.getSeconds() }; });
  console.log('local clock', clock);
  // lobby countdowns
  await p.click('[data-drawer="missions"]'); await p.waitForTimeout(300);
  console.log('missions head:', await p.evaluate(() => document.querySelector('.drawer-h, .drawer h4, .drawer .dh, .drawer')?.textContent.match(/new missions in [^A-Z]*/)?.[0]));
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.click('[data-drawer="journey"]'); await p.waitForTimeout(300);
  console.log('journey:', await p.evaluate(() => [...document.querySelectorAll('.jr-row.sm span, .jr-h span, .jr-spark span')].map(e => e.textContent.trim()).filter(t => /in /.test(t))));
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  // farm timers vs wall clock
  await p.click('#sc-farm'); await p.waitForTimeout(900);
  const t = await p.evaluate(() => { const F = __FM._dbg.F, d = new Date(), s = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds(); const exp = per => { let l = ((-s) % per + per) % per; return l / 240; }; const expShop = (() => { const per = 4 * 3600; let l = ((2 * 3600 - s) % per + per) % per; return l / 240; })();
    return { weather: [F.weather.until.toFixed(2), exp(4 * 3600).toFixed(2)], shop: [F.shop.at.toFixed(2), expShop.toFixed(2)], market: [F.market.until.toFixed(1), exp(86400).toFixed(1)], orbTitle: document.querySelector('[data-orb="weather"]')?.getAttribute('title') || document.querySelector('[data-orb="weather"]')?.getAttribute('aria-label') }; });
  console.log('farm timers [game, expected units]:', JSON.stringify(t));
  // growth speed: a wheat plot should gain about 1/(15 units * 240 s) per real second
  const g = await p.evaluate(async () => { const F = __FM._dbg.F; const i = F.plots.findIndex(p => !p.crop && !p.locked); const P = F.plots[i]; Object.assign(P, { crop: 'wheat', prog: 0, wet: false, fert: null, pests: 0, mut: [] }); const a = P.prog; await new Promise(r => setTimeout(r, 3000)); return { i, gained: P.prog - a, perSec: (P.prog - a) / 3, expected: 1 / (15 * 240) }; });
  console.log('growth', JSON.stringify(g));
  // save, pretend the save is 2 hours old, reload: wheat (1 h) should be ripe and the dog timer shorter
  const before = await p.evaluate(i => { const F = __FM._dbg.F; F.plots[i].prog = 0.1; __FM.save(); const d = JSON.parse(localStorage.getItem('ea-farm-v1')); const dog = d.F.dog?.until; d.t -= 2 * 3600 * 1000; localStorage.setItem('ea-farm-v1', JSON.stringify(d)); return { dog, lv: d.F.lv }; }, g.i);
  // stop this page from saving again (reset sets the no-save flag), then put the edited save back
  await p.evaluate(() => { const raw = localStorage.getItem('ea-farm-v1'); __FM.reset(); localStorage.setItem('ea-farm-v1', raw); });
  await p.reload(); await p.waitForFunction(() => typeof __FM !== 'undefined', null, { timeout: 30000 }); await p.waitForTimeout(400); await p.click('#sc-farm'); await p.waitForTimeout(700);
  const after = await p.evaluate(i => { const F = __FM._dbg.F; return { prog: F.plots[i].prog, crop: F.plots[i].crop, dog: F.dog?.until, lv: F.lv, log: [...document.querySelectorAll('#fm-log div')].map(d => d.textContent).join(' | ') }; }, g.i);
  console.log('offline catch-up: before', JSON.stringify(before), 'after', JSON.stringify(after), 'dog drop (units, expect 30):', (before.dog - after.dog).toFixed(2));
  // settings rows
  await p.click('#sc-lobby').catch(() => { }); await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelector('[data-drawer="settings"]')?.click()); await p.waitForTimeout(300);
  console.log('settings rows:', await p.evaluate(() => [...document.querySelectorAll('.list-row b')].map(b => b.textContent)), await p.evaluate(() => [...document.querySelectorAll('.list-row .mini-btn')].map(b => [b.textContent, Math.round(b.getBoundingClientRect().width), Math.round(b.getBoundingClientRect().left)])));
  await p.screenshot({ path: 'rt1-settings.png' });
  // fast mode
  await p.click('[data-fasttime]'); await p.waitForLoadState('load'); await p.waitForFunction(() => typeof __FM !== 'undefined', null, { timeout: 30000 });
  const fast = await p.evaluate(() => ({ flag: localStorage.getItem('ea-fast') }));
  await p.click('#sc-farm'); await p.waitForTimeout(500);
  const fs1 = await p.evaluate(async () => { const P = __FM._dbg.F.plots.find(p => p.crop && p.prog < 1); if (!P) return null; const a = P.prog; await new Promise(r => setTimeout(r, 2000)); return { crop: P.crop, perSec: (P.prog - a) / 2 }; });
  console.log('fast mode:', JSON.stringify(fast), JSON.stringify(fs1));
  // reset
  await p.evaluate(() => document.getElementById('sc-lobby')?.click()); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('[data-drawer="settings"]')?.click()); await p.waitForTimeout(300);
  await p.evaluate(() => localStorage.setItem('ea-fast', '0'));
  await p.click('[data-resetfarm]'); await p.waitForLoadState('load'); await p.waitForFunction(() => typeof __FM !== 'undefined', null, { timeout: 30000 });
  console.log('after reset:', await p.evaluate(() => ({ key: localStorage.getItem('ea-farm-v1') ? 'saved again' : 'cleared', fast: localStorage.getItem('ea-fast'), lv: __FM._dbg.F.lv })));
  // plaza: event countdown + time of day
  await p.click('#sc-plaza'); await p.waitForTimeout(600); await p.keyboard.down('d'); await p.waitForTimeout(400); await p.keyboard.up('d'); await p.waitForTimeout(500);
  console.log('plaza event:', await p.textContent('#pz-event'), '| expected secs to quarter:', await p.evaluate(() => { const d = new Date(); return 900 - ((d.getMinutes() % 15) * 60 + d.getSeconds()); }));
  console.log('plaza tod:', await p.evaluate(() => __PZ._dbg.tod?.toFixed?.(3) ?? 'n/a'), 'expected', ((clock.h * 3600 + clock.m * 60 + clock.s) / 86400).toFixed(3));
  console.log('errs', JSON.stringify(errs)); await b.close();
})();
