const { chromium } = require('./pw');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1340, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push('PE ' + e.message + ' @' + (e.stack || '').split('\n')[1])); p.on('console', m => m.type() === 'error' && errs.push('CE ' + m.text()));
  await p.goto('file://' + __dirname + '/preview-t.html'); await p.waitForTimeout(1200);
  const f = await p.$('#frame'); await f.scrollIntoViewIfNeeded(); const shot = n => f.screenshot({ path: 'j-' + n + '.png' });
  const log = (...a) => console.log(...a);
  // Lobby: shop/wardrobe still work
  await p.click('.rail [data-fit="shop"]'); await p.waitForTimeout(400); log('fit scene', await p.evaluate(() => document.getElementById('screen').dataset.scene));
  await p.click('[data-fitmode="wardrobe"]'); await p.waitForTimeout(200); await shot('wardrobe');
  await p.click('#sc-lobby'); await p.waitForTimeout(300);
  await p.click('#mode-btn'); await p.waitForTimeout(200); await shot('modes'); await p.mouse.click(10, 10);
  // Farm
  await p.click('#sc-farm'); await p.waitForTimeout(1000);
  const st = () => p.evaluate(() => { const F = __FM._dbg.F; return { lv: F.lv, xp: F.xp, leaves: __ECON.leaves, can: F.can, dog: F.dog.type + ':' + Math.round(F.dog.until), barn: Object.values(F.barn).reduce((a, b) => a + b, 0), decor: F.decor.filter(Boolean).length, seeds: Object.values(F.seeds).reduce((a,b)=>a+b,0) }; });
  log('start', await st());
  // force crops ripe and harvest them all to level up
  await p.evaluate(() => { const { F } = __FM._dbg; F.plots.forEach(p => { if (!p.locked) { p.crop = p.crop || 'pepper'; p.prog = 1; p.mut = []; } }); });
  await p.evaluate(() => { const { F, harvest } = __FM._dbg; F.plots.forEach((p, i) => harvest(i)); });
  await p.waitForTimeout(500); log('after harvest', await st(), 'modal', await p.evaluate(() => !document.getElementById('fm-modal').hidden));
  await shot('levelup');
  await p.click('[data-lvok]').catch(() => {});
  // buy copper can
  await p.click('[data-sheet="shop"]'); await p.click('[data-tab="tools"]'); await p.waitForTimeout(200);
  await p.evaluate(() => { __ECON.leaves = 9999; __FM._dbg.F.lv = 25; }); await p.click('[data-tab="seeds"]'); await p.click('[data-tab="tools"]');
  await p.click('[data-buytool="can2"]').catch(e => log('can2 fail', e.message.slice(0, 60)));
  await p.click('[data-buytool="scarecrow"]').catch(e => log('scare fail', e.message.slice(0, 60)));
  log('after tools', await st());
  await p.click('[data-tab="dogs"]'); await p.waitForTimeout(200); await p.click('[data-dog="black"][data-days="1"]').catch(e => log('dog fail', e.message.slice(0, 60)));
  log('after dog', await st());
  // order deliver: give items then deliver first
  await p.evaluate(() => { const { F } = __FM._dbg; F.orders[0].items.forEach(([id, n]) => { F.barn[id + '|'] = (F.barn[id + '|'] || 0) + n; }); });
  await p.click('[data-sheet="orders"]'); await p.waitForTimeout(200); await p.click('[data-ord="0"]').catch(e => log('ord fail', e.message.slice(0, 60))); log('after order', await st());
  await p.click('[data-sheet="market"]'); await p.waitForTimeout(200); await shot('market'); const sb = await p.$('[data-sell]'); if (sb) await sb.click(); log('after sell', await st());
  await p.click('[data-tab="coins"]'); await p.waitForTimeout(100); await p.click('[data-coins]').catch(()=>{}); log('coins', await p.evaluate(() => document.getElementById('coins').textContent));
  // decor
  await p.click('[data-sheet="decor"]'); await p.waitForTimeout(200); await p.click('[data-deco="planter"]');
  const cvb = await (await p.$('#fm-cv')).boundingBox(); const K = cvb.width / 1280; await p.mouse.click(cvb.x + 118 * K, cvb.y + 690 * K); await p.waitForTimeout(300);
  log('after decor', await st());
  await p.click('[data-sheet="decor"]'); await p.waitForTimeout(150);
  // wish well
  await p.mouse.click(cvb.x + 112 * K, cvb.y + 520 * K); await p.waitForTimeout(300); log('after wish', await st());
  await shot('farm-full');
  // visit + steal against BaoTide black dog
  await p.click('[data-sheet="friends"]'); await p.click('[data-visit="1"]'); await p.waitForTimeout(400);
  const ripeIdx = await p.evaluate(() => __FM._dbg.FRIENDS[1].plots.map((p, i) => p.crop && p.prog >= 1 ? i : -1).filter(i => i >= 0));
  for (const i of ripeIdx.slice(0, 3)) { await p.mouse.click(cvb.x + (300 + (i % 6) * 116 + 52) * K, cvb.y + (318 + Math.floor(i / 6) * 78 + 40) * K); await p.waitForTimeout(150); }
  log('after steal', await st()); await shot('visit-steal');
  await p.click('#fm-visit [data-home]');
  // Plaza: orb event + claim
  await p.click('#sc-plaza'); await p.waitForTimeout(500); await p.click('#pz-start');
  await p.evaluate(() => { __PZ._dbg.ev.next = 0.1; }); await p.waitForTimeout(4000);
  await p.evaluate(() => { const { P, ev } = __PZ._dbg; if (ev.orbs[0]) { P.x = ev.orbs[0].x; P.y = ev.orbs[0].y; } }); await p.waitForTimeout(1500);
  log('orb', await p.evaluate(() => ({ on: __PZ._dbg.ev.on, orbs: __PZ._dbg.ev.orbs.length, q: __PZ._dbg.Q.find(q => q.id === 'orbs').n, leaves: __ECON.leaves })));
  await shot('orb');
  await p.evaluate(() => { const t = new Date(); }); 
  await p.click('#pz-clock'); await p.waitForTimeout(800); await shot('night');
  log('scroll', await p.evaluate(() => [...document.querySelectorAll('#frame, #frame-inner, #screen, .fm, .pz, .fm-hud, .pz-hud')].map(e => [e.id || e.className, e.scrollTop, e.scrollLeft]))); log('errors', JSON.stringify(errs.slice(0, 12)));
  await b.close();
})();
