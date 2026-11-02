const { chromium } = require('./pw');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1340, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + __dirname + '/preview-t.html'); await p.waitForTimeout(900); const f = await p.$('#frame'); await f.scrollIntoViewIfNeeded();
  await p.click('#sc-farm'); await p.waitForTimeout(800);
  console.log('badge:', (await p.textContent('#fm-badge')).replace(/\s+/g, ' '));
  // level up 7 -> 8 by harvesting XP
  await p.evaluate(() => { const F = __FM._dbg.F; F.xp = 180; F.plots[0] = Object.assign(F.plots[0], { crop: 'wheat', prog: 1, mut: [], pests: 0 }); __FM._dbg.harvest(0); });
  await p.waitForTimeout(300); console.log('level up card:', (await p.textContent('#fm-modal')).replace(/\s+/g, ' ').slice(0, 160)); await f.screenshot({ path: 'e1-lvup.png' });
  await p.evaluate(() => document.querySelector('[data-lvok]')?.click());
  // jump to 40 to see mastery, dogs
  await p.evaluate(() => { const F = __FM._dbg.F; F.lv = 40; F.harv = { wheat: 30, carrot: 80 }; __FM._dbg.openSheet('book', 'mastery'); }); await p.waitForTimeout(300);
  console.log('mastery:', (await p.textContent('#fm-sheet')).replace(/\s+/g, ' ').slice(0, 220)); await f.screenshot({ path: 'e1-mastery.png' });
  await p.evaluate(() => { __FM._dbg.F.lv = 12; __FM._dbg.openSheet('shop', 'dogs'); }); await p.waitForTimeout(300);
  console.log('dogs:', (await p.textContent('#fm-sheet')).replace(/\s+/g, ' ').slice(0, 300));
  await p.evaluate(() => __FM._dbg.openSheet('shop', 'tools')); await p.waitForTimeout(200); console.log('tools:', (await p.textContent('#fm-sheet')).replace(/\s+/g, ' ').slice(0, 300));
  await p.evaluate(() => { __FM._dbg.F.lv = 99; __FM._dbg.F.xp = 0; }); await p.evaluate(() => { const F = __FM._dbg.F; F.xp = 1e7; F.plots[1] = Object.assign(F.plots[1], { crop: 'wheat', prog: 1, mut: [], pests: 0 }); __FM._dbg.harvest(1); });
  await p.waitForTimeout(300); console.log('lv100:', await p.evaluate(() => [__FM._dbg.F.lv, __FM._dbg.F.xp]), (await p.textContent('#fm-badge')).replace(/\s+/g, ' '));
  console.log('errs', JSON.stringify(errs)); await b.close(); })();
